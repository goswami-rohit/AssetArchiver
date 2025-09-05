// routes.ts - COMPLETE IMPLEMENTATION WITH AUTO-CRUD
// two major functions: createAutoCRUD ->>> for AI ChatInterface && setupWebRoutes ->>> for manual endpoint fixing
import { Express, Request, Response } from 'express';
import { radar } from "server/integrations/radar";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { db } from 'server/db';
import {
  companies,
  dailyVisitReports,
  technicalVisitReports,
  permanentJourneyPlans,
  salesmanAttendance,
  salesmanLeaveApplications,
  clientReports,
  competitionReports,
  geoTracking,
  dailyTasks,
  users,
  dealers,
  dealerReportsAndScores,
  salesReport,
  collectionReports,
  ddp,
  ratings,
  brands,
  dealerBrandMapping,
  masterConnectedTable,
  insertDailyVisitReportSchema,
  insertTechnicalVisitReportSchema,
  insertPermanentJourneyPlanSchema,
  insertSalesmanAttendanceSchema,
  insertSalesmanLeaveApplicationSchema,
  insertClientReportSchema,
  insertCompetitionReportSchema,
  insertGeoTrackingSchema,
  insertDailyTaskSchema,
  insertDealerSchema,
  insertDealerReportsAndScoresSchema,
  insertCompanySchema,
  insertSalesReportSchema,
  insertCollectionReportSchema,
  insertDdpSchema,
  insertRatingSchema,
  insertBrandSchema,
  insertDealerBrandMappingSchema,
  insertMasterConnectedTableSchema
} from 'shared/schema';
import { eq, desc, asc, and, gte, lte, isNull, inArray, notInArray, like, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { randomUUID } from "crypto";
import { ChatMessage } from 'server/bot/aiService';
import EnhancedRAGService from 'server/bot/aiService';
import crypto from "crypto";
import { telegramBot } from './bot/telegram';

const dePref = (s?: string) => (s && s.startsWith("dealer:") ? s.slice(7) : s);

// validators tied to your schema
const StartTripBody = z.object({
  userId: z.coerce.number().int().positive(),     // users.id is integer
  dealerId: z.string().min(1),                     // dealers.id is varchar (you treat it as string)
  lat: z.coerce.number(),                          // numeric(10,7)
  lng: z.coerce.number(),                          // numeric(10,7)
  radarTripId: z.string().min(1),                  // geo_tracking.journey_id is varchar
});

const JourneyIdParam = z.object({
  journeyId: z.string().min(1),                    // geo_tracking.journey_id is varchar
});

// ============================================
// SCHEMA-PERFECT AUTO-CRUD GENERATOR
// ============================================
function createAutoCRUD(app: Express, config: {
  endpoint: string,
  table: any,
  schema: z.ZodSchema,
  tableName: string,
  autoFields?: { [key: string]: () => any },
  dateField?: string
}) {
  const { endpoint, table, schema, tableName, autoFields = {}, dateField } = config;

  // CREATE
  app.post(`/api/${endpoint}`, async (req: Request, res: Response) => {
    try {
      // =========================
      // SPECIAL-CASE: dealer-reports-scores (upsert by dealerId)
      // =========================
      if (endpoint === 'dealer-reports-scores') {
        const body = req.body as any;

        // minimal helpers (keep it self-contained)
        const toDec2 = (v: unknown, field: string) => {
          const n = Number(v);
          if (!Number.isFinite(n)) throw new Error(`${field} must be a number`);
          return n.toFixed(2); // drizzle decimal prefers strings
        };

        // required
        const dealerId = String(body.dealerId ?? '').trim();
        if (!dealerId) {
          return res.status(400).json({ success: false, error: 'dealerId is required' });
        }

        // ensure dealer exists
        const dealer = await db.query.dealers.findFirst({
          where: eq(dealers.id, dealerId),
          columns: { id: true }
        });
        if (!dealer) {
          return res.status(400).json({ success: false, error: 'dealerId does not exist' });
        }

        // coerce payload
        let payload;
        try {
          payload = {
            dealerId,
            dealerScore: toDec2(body.dealerScore, 'dealerScore'),
            trustWorthinessScore: toDec2(body.trustWorthinessScore, 'trustWorthinessScore'),
            creditWorthinessScore: toDec2(body.creditWorthinessScore, 'creditWorthinessScore'),
            orderHistoryScore: toDec2(body.orderHistoryScore, 'orderHistoryScore'),
            visitFrequencyScore: toDec2(body.visitFrequencyScore, 'visitFrequencyScore'),
            lastUpdatedDate: new Date(), // required column
            updatedAt: new Date()        // let createdAt default
          };
        } catch (e) {
          return res.status(400).json({ success: false, error: (e as Error).message });
        }

        // upsert by unique dealerId
        const [row] = await db
          .insert(dealerReportsAndScores)
          .values(payload)
          .onConflictDoUpdate({
            target: dealerReportsAndScores.dealerId,
            set: {
              dealerScore: payload.dealerScore,
              trustWorthinessScore: payload.trustWorthinessScore,
              creditWorthinessScore: payload.creditWorthinessScore,
              orderHistoryScore: payload.orderHistoryScore,
              visitFrequencyScore: payload.visitFrequencyScore,
              lastUpdatedDate: payload.lastUpdatedDate,
              updatedAt: payload.updatedAt
            }
          })
          .returning();

        return res.json({
          success: true,
          message: 'Dealer report & scores upserted',
          data: row
        });
      }
      // =========================
      // END SPECIAL-CASE
      // =========================

      // Parse & validate strictly against the table schema
      const parseResult = schema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          error: `Validation failed for ${tableName}`,
          details: parseResult.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            received: (err as any).received
          }))
        });
      }

      const validatedData: any = parseResult.data;

      // Auto fields (if any)
      const finalData: any = { ...validatedData };
      Object.entries(autoFields).forEach(([field, generator]) => {
        if (finalData[field] === undefined || finalData[field] === null) {
          finalData[field] = generator();
        }
      });

      // Ensure timestamps if present in table shape
      if (table.createdAt && !finalData.createdAt) finalData.createdAt = new Date();
      if (table.updatedAt && !finalData.updatedAt) finalData.updatedAt = new Date();

      // Special-case ONLY for Dealers: create the DB record, then upsert a Radar geofence
      if (endpoint === 'dealers') {
        // Coordinates are NOT part of your dealers schema; read them from the raw body
        const raw = req.body as any;

        const lat = Number(
          raw.latitude ??
          raw.lat ??
          raw.locationLat ??
          raw.locationLatitude ??
          raw.location?.latitude
        );
        const lon = Number(
          raw.longitude ??
          raw.lng ??
          raw.lon ??
          raw.locationLng ??
          raw.locationLongitude ??
          raw.location?.longitude
        );

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          return res.status(400).json({
            success: false,
            error: 'Dealer latitude and longitude are required (not stored in DB, used for geofence)'
          });
        }

        // Insert dealer first to get its UUID primary key
        const [dealer] = await db.insert(table).values(finalData).returning();

        // Build Radar PUT exactly like docs: PUT /v1/geofences/:tag/:externalId
        const tag = 'dealer';
        const externalId = `dealer:${dealer.id}`;
        const radarUrl = `https://api.radar.io/v1/geofences/${encodeURIComponent(tag)}/${encodeURIComponent(externalId)}`;

        // Description: from dealers.name (schema), fallback to "Dealer <id>"
        const description = String(dealer.name ?? `Dealer ${dealer.id}`).slice(0, 120);

        // Radius: allow client override in body, clamp to [10, 10000]; default 25m
        const radius = Math.min(10000, Math.max(10, Number(raw.radius ?? 25)));

        // Form-encoded body per Radar sample
        const form = new URLSearchParams();
        form.set('description', description);
        form.set('type', 'circle');
        form.set('coordinates', JSON.stringify([lon, lat])); // [longitude, latitude]
        form.set('radius', String(radius));

        // Optional metadata (must be string/number/boolean)
        const metadata: Record<string, any> = {
          dealerId: dealer.id,
          userId: dealer.userId,
          region: dealer.region,
          area: dealer.area,
          phoneNo: dealer.phoneNo
        };
        Object.keys(metadata).forEach(k => metadata[k] == null && delete metadata[k]);
        if (Object.keys(metadata).length) {
          form.set('metadata', JSON.stringify(metadata));
        }

        // PUT to Radar with your SECRET key
        const upRes = await fetch(radarUrl, {
          method: 'PUT',
          headers: {
            Authorization: process.env.RADAR_SECRET_KEY as string,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: form.toString()
        });
        const upJson = await upRes.json().catch(() => ({} as any));

        if (!upRes.ok || upJson?.meta?.code !== 200 || !upJson?.geofence) {
          // Roll back the dealer insert if Radar failed
          await db.delete(table).where(eq(table.id, dealer.id));
          return res.status(400).json({
            success: false,
            error: upJson?.meta?.message || upJson?.message || 'Failed to upsert dealer geofence in Radar'
          });
        }

        // If you later add columns (radarGeofenceId/tag/externalId) this patch will auto-fill them:
        try {
          if (table.radarGeofenceId || table.radarTag || table.radarExternalId) {
            const patch: any = {};
            if (table.radarGeofenceId) patch.radarGeofenceId = upJson.geofence._id;
            if (table.radarTag) patch.radarTag = upJson.geofence.tag;
            if (table.radarExternalId) patch.radarExternalId = upJson.geofence.externalId;
            if (Object.keys(patch).length) {
              await db.update(table).set(patch).where(eq(table.id, dealer.id));
            }
          }
        } catch { /* ignore if those columns don't exist */ }

        // Success
        return res.json({
          success: true,
          data: dealer,
          message: `${tableName} created and geofence upserted`,
          geofenceRef: {
            id: upJson.geofence._id,
            tag: upJson.geofence.tag,
            externalId: upJson.geofence.externalId,
            radiusMeters: upJson.geofence.geometryRadius ?? radius
          }
        });
      }

      // Default path for all other endpoints
      const [newRecord] = await db.insert(table).values(finalData).returning();
      return res.json({
        success: true,
        data: newRecord,
        message: `${tableName} created successfully`
      });

    } catch (error) {
      console.error(`Create ${tableName} error:`, error);
      return res.status(500).json({
        success: false,
        error: `Failed to create ${tableName}`,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET ALL by User ID - with proper date field handling
  app.get(`/api/${endpoint}/user/:userId`, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { startDate, endDate, limit = '50', completed, ...filters } = req.query;

      // Base condition - userId is integer in schema
      let whereCondition = eq(table.userId, parseInt(userId));

      // Date range filtering using the correct date field for each table
      if (startDate && endDate && dateField && table[dateField]) {
        whereCondition = and(
          whereCondition,
          gte(table[dateField], startDate as string),
          lte(table[dateField], endDate as string)
        );
      }

      // Handle completed filter for PJPs
      if (completed === 'true' && table.status) {
        whereCondition = and(whereCondition, eq(table.status, 'completed'));
      }

      // Additional filters from query params
      Object.entries(filters).forEach(([key, value]) => {
        if (value && table[key]) {
          whereCondition = and(whereCondition, eq(table[key], value));
        }
      });

      // Order by most relevant date field or createdAt
      const orderField = table[dateField] || table.createdAt || table.updatedAt;

      const records = await db.select().from(table)
        .where(whereCondition)
        .orderBy(desc(orderField))
        .limit(parseInt(limit as string));

      res.json({ success: true, data: records });
    } catch (error) {
      console.error(`Get ${tableName}s error:`, error);
      res.status(500).json({
        success: false,
        error: `Failed to fetch ${tableName}s`,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET BY ID - with proper UUID/varchar handling
  app.get(`/api/${endpoint}/:id`, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const [record] = await db.select().from(table).where(eq(table.id, id)).limit(1);

      if (!record) {
        return res.status(404).json({
          success: false,
          error: `${tableName} not found`
        });
      }

      res.json({ success: true, data: record });
    } catch (error) {
      console.error(`Get ${tableName} error:`, error);
      res.status(500).json({
        success: false,
        error: `Failed to fetch ${tableName}`,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // UPDATE - with partial schema validation
  app.put(`/api/${endpoint}/:id`, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Create partial schema for updates
      const partialSchema = schema.partial();
      const parseResult = partialSchema.safeParse(req.body);

      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          error: `Validation failed for ${tableName} update`,
          details: parseResult.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            received: err.received
          }))
        });
      }

      const validatedData = parseResult.data;

      // Always update the updatedAt field
      const updateData = {
        ...validatedData,
        updatedAt: new Date()
      };

      const updatedRecord = await db.update(table)
        .set(updateData)
        .where(eq(table.id, id))
        .returning();

      if (!updatedRecord || updatedRecord.length === 0) {
        return res.status(404).json({
          success: false,
          error: `${tableName} not found`
        });
      }

      res.json({
        success: true,
        data: updatedRecord[0],
        message: `${tableName} updated successfully`
      });
    } catch (error) {
      console.error(`Update ${tableName} error:`, error);
      res.status(500).json({
        success: false,
        error: `Failed to update ${tableName}`,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // DELETE
  app.delete(`/api/${endpoint}/:id`, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const deletedRecord = await db.delete(table).where(eq(table.id, id)).returning();

      if (!deletedRecord || deletedRecord.length === 0) {
        return res.status(404).json({
          success: false,
          error: `${tableName} not found`
        });
      }

      res.json({
        success: true,
        message: `${tableName} deleted successfully`,
        data: deletedRecord[0]
      });
    } catch (error) {
      console.error(`Delete ${tableName} error:`, error);
      res.status(500).json({
        success: false,
        error: `Failed to delete ${tableName}`,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
const asNum = (v: unknown) => Number(v);
const toStrDec = (v: unknown, d: number) => Number(v).toFixed(d);
const ll = (lat: number, lng: number) => `${Number(lat).toFixed(6)},${Number(lng).toFixed(6)}`;

export function setupWebRoutes(app: Express) {
  // PWA route
  app.get('/pwa', (req: Request, res: Response) => {
    res.redirect('/login');
  });

  // ==================== AUTH ====================
  //JSON normalizer to help in /api/auth/login
  function toJsonSafe<T>(obj: T): T {
    return JSON.parse(
      JSON.stringify(obj, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
    );
  }

  app.post("/api/auth/login", async (req, res) => {
    try {
      const loginId = String(req.body?.loginId ?? "").trim();
      const password = String(req.body?.password ?? "");

      if (!loginId || !password)
        return res.status(400).json({ error: "Login ID and password are required" });

      // Pull exactly what you need
      const [row] = await db
        .select({
          id: users.id,
          email: users.email,
          status: users.status,
          hashedPassword: users.hashedPassword,
          salesmanLoginId: users.salesmanLoginId,
          companyId: users.companyId,
          companyName: companies.companyName, // optional
        })
        .from(users)
        .leftJoin(companies, eq(users.companyId, companies.id))
        .where(or(eq(users.salesmanLoginId, loginId), eq(users.email, loginId)))
        .limit(1);

      if (!row) return res.status(401).json({ error: "Invalid credentials" });
      if (row.status !== "active") return res.status(401).json({ error: "Account is not active" });

      // If you actually store bcrypt hashes, use bcrypt.compare here.
      if (!row.hashedPassword || row.hashedPassword !== password)
        return res.status(401).json({ error: "Invalid credentials" });

      const { hashedPassword, ...safe } = row;
      return res.json({ success: true, user: toJsonSafe(safe), message: "Login successful" });
    } catch (err) {
      console.error("Login error:", err);
      return res.status(500).json({ error: "Login failed" });
    }
  });

  // fetching user details to populate HomePage.tsx and ProfilePage.tsx
  // Returns the current user's profile + company
  app.get("/api/user/:id", async (req: Request, res: Response) => {
    try {
      const userId = Number(req.params.id);
      if (!userId || Number.isNaN(userId)) {
        return res.status(400).json({ error: "Invalid user id" });
      }

      // Manual join
      const rows = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
          phoneNumber: users.phoneNumber,
          companyId: users.companyId,
          companyName: companies.companyName,
        })
        .from(users)
        .leftJoin(companies, eq(companies.id, users.companyId))
        .where(eq(users.id, userId))
        .limit(1);

      if (!rows.length) {
        return res.status(404).json({ error: "User not found" });
      }

      const row = rows[0];
      const user = {
        id: row.id,
        email: row.email,
        firstName: row.firstName ?? null,
        lastName: row.lastName ?? null,
        role: row.role,
        phoneNumber: row.phoneNumber ?? null,
        company: row.companyId
          ? { id: row.companyId, companyName: row.companyName ?? "" }
          : null,
      };

      res.json({ user });
    } catch (err) {
      console.error("GET /api/user error:", err);
      res.status(500).json({ error: "Failed to load user" });
    }
  });

  //=====================CLOUDFARE===============================
  const r2 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  app.post("/api/upload-url", async (req, res) => {
    const { fileName, fileType } = req.body;

    try {
      const command = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET!,
        Key: fileName,
        ContentType: fileType,
      });

      const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 60 });
      const publicUrl = `${process.env.R2_PUBLIC_URL}/${fileName}`;

      res.json({ success: true, uploadUrl, publicUrl });
    } catch (err) {
      console.error("Upload URL error:", err);
      res.status(500).json({ success: false, error: "Failed to generate upload URL" });
    }
  });
  // ==================== ENHANCED AI/RAG ROUTES ====================
  // Import the enhanced service

  //  ENHANCED RAG CHAT with Vector Search
  app.post('/api/rag/chat', async (req: Request, res: Response) => {
    try {
      const { messages, userId }: { messages: ChatMessage[], userId?: number } = req.body;

      // Enhanced validation
      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Messages must be a non-empty array'
        });
      }

      // Validate message format
      for (const msg of messages) {
        if (!msg.role || !msg.content || !['user', 'assistant', 'system'].includes(msg.role)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid message format. Each message must have role (user/assistant/system) and content.'
          });
        }
      }

      // Process with enhanced RAG service (vector search enabled)
      const aiResponse = await EnhancedRAGService.chat(messages, userId);

      res.json({
        success: true,
        message: aiResponse,
        timestamp: new Date().toISOString(),
        userId: userId,
        messageCount: messages.length,
        enhanced: true // Flag to indicate vector search was used
      });
    } catch (error) {
      console.error('Enhanced RAG Chat error:', error);
      res.status(500).json({
        success: false,
        error: 'Enhanced RAG chat processing failed. Please try again.',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // INTELLIGENT RAG CHAT (Complete Vector Flow)
  app.post('/api/rag/vector-chat', async (req: Request, res: Response) => {
    try {
      const { message, userId }: { message: string, userId?: number } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Message is required and must be a string'
        });
      }

      console.log(`🤖 Vector RAG request from user ${userId}: "${message.substring(0, 50)}..."`);

      // Use intelligent RAG with vector search + direct execution
      const result = await EnhancedRAGService.ragChat(message, userId);

      res.json({
        success: result.success,
        message: result.message,
        endpoint: result.endpoint,
        similarity: result.similarity,
        data: result.data,
        guidance: result.guidance,
        error: result.error,
        suggestion: result.suggestion,
        timestamp: new Date().toISOString(),
        vectorSearch: true
      });
    } catch (error) {
      console.error('Vector RAG Chat error:', error);
      res.status(500).json({
        success: false,
        error: 'Vector RAG processing failed. Please try again.',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  //  VECTOR-POWERED ENDPOINT DISCOVERY
  app.post('/api/rag/find-endpoint', async (req: Request, res: Response) => {
    try {
      const { query }: { query: string } = req.body;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Query is required and must be a string'
        });
      }

      console.log(`🔍 Vector endpoint search: "${query}"`);

      const bestEndpoint = await EnhancedRAGService.findBestEndpoint(query);

      if (!bestEndpoint) {
        return res.status(404).json({
          success: false,
          error: 'No relevant endpoint found via vector search',
          suggestion: 'Try a more specific query about visits, reports, dealers, or attendance'
        });
      }

      res.json({
        success: true,
        endpoint: bestEndpoint,
        message: `✅ Found relevant endpoint: ${bestEndpoint.name}`,
        similarity: bestEndpoint.similarity,
        description: bestEndpoint.description,
        requiredFields: bestEndpoint.requiredFields
      });
    } catch (error) {
      console.error('Vector endpoint discovery error:', error);
      res.status(500).json({
        success: false,
        error: 'Vector endpoint discovery failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // DIRECT API EXECUTION
  app.post('/api/rag/execute', async (req: Request, res: Response) => {
    try {
      const { endpoint, data, userId }: { endpoint: string, data: any, userId?: number } = req.body;

      if (!endpoint || !data) {
        return res.status(400).json({
          success: false,
          error: 'Endpoint and data are required for direct execution'
        });
      }

      console.log(`⚡ Direct execution: ${endpoint} for user ${userId}`);

      const result = await EnhancedRAGService.executeEndpoint(endpoint, data, userId);

      res.json({
        success: result.success,
        data: result.data,
        endpoint: result.endpoint,
        error: result.error,
        details: result.details,
        timestamp: new Date().toISOString(),
        directExecution: true
      });
    } catch (error) {
      console.error('Direct API execution error:', error);
      res.status(500).json({
        success: false,
        error: 'Direct API execution failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  //  ENHANCED DATA EXTRACTION & SUBMISSION
  app.post('/api/rag/submit', async (req: Request, res: Response) => {
    try {
      const { messages, userId }: { messages: ChatMessage[], userId: number } = req.body;

      // Enhanced validation
      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Messages must be a non-empty array for data extraction'
        });
      }

      if (!userId || typeof userId !== 'number') {
        return res.status(400).json({
          success: false,
          error: 'Valid numeric userId is required for submission'
        });
      }

      // Validate message format
      for (const msg of messages) {
        if (!msg.role || !msg.content || !['user', 'assistant', 'system'].includes(msg.role)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid message format in conversation history'
          });
        }
      }

      console.log(`📋 Enhanced data extraction for user ${userId}`);

      // Enhanced structured data extraction with vector context
      const extracted = await EnhancedRAGService.extractStructuredData(messages, userId);

      if (!extracted || extracted.error) {
        return res.status(400).json({
          success: false,
          error: extracted?.error || 'Unable to extract sufficient data from conversation.',
          suggestion: 'Try providing specific information like dealer name, location, visit type, etc.',
          vectorSearch: true
        });
      }

      // Direct execution using enhanced service
      const executionResult = await EnhancedRAGService.executeEndpoint(
        extracted.endpoint,
        extracted.data,
        userId
      );

      if (!executionResult.success) {
        return res.status(400).json({
          success: false,
          error: `Submission failed: ${executionResult.error}`,
          details: executionResult.details,
          endpoint: extracted.endpoint,
          validationErrors: executionResult.details
        });
      }

      // Enhanced success response
      const endpointName = extracted.endpoint.replace('/api/', '').toUpperCase();

      res.json({
        success: true,
        endpoint: extracted.endpoint,
        recordId: executionResult.data?.id,
        data: executionResult.data,
        message: `✅ Successfully submitted ${endpointName} via enhanced RAG!`,
        submissionDetails: {
          endpointName,
          recordId: executionResult.data?.id,
          submittedAt: new Date().toISOString(),
          userId: userId,
          fieldsSubmitted: Object.keys(extracted.data || {}).length,
          vectorSearch: true,
          directExecution: true
        }
      });
    } catch (error) {
      console.error('Enhanced RAG Submit error:', error);
      res.status(500).json({
        success: false,
        error: 'Enhanced RAG submission processing failed. Please try again.',
        details: error instanceof Error ? error.message : 'Unknown error',
        suggestion: 'Check your data format and try submitting again'
      });
    }
  });

  // SMART DATA FETCHING
  app.get('/api/rag/fetch/:endpoint/user/:userId', async (req: Request, res: Response) => {
    try {
      const { endpoint, userId } = req.params;
      const { limit = '10', ...filters } = req.query;

      if (!endpoint || !userId) {
        return res.status(400).json({
          success: false,
          error: 'Endpoint and userId are required'
        });
      }

      console.log(`📊 Smart data fetch: ${endpoint} for user ${userId}`);

      const data = await EnhancedRAGService.fetchData(
        `/api/${endpoint}`,
        parseInt(userId),
        { limit, ...filters }
      );

      res.json({
        success: true,
        endpoint: `/api/${endpoint}`,
        data: data,
        count: data.length,
        userId: parseInt(userId),
        filters: filters,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Smart data fetch error:', error);
      res.status(500).json({
        success: false,
        error: 'Smart data fetching failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  //  RAG HEALTH CHECK with Vector Status
  app.get('/api/rag/health', async (req: Request, res: Response) => {
    try {
      // Test Qdrant connection
      const qdrantStatus = await qdrantClient.getCollections();

      res.json({
        success: true,
        status: 'Enhanced RAG System Online',
        features: {
          vectorSearch: true,
          directExecution: true,
          autoCrudIntegration: true,
          uiAwareness: true
        },
        qdrant: {
          connected: true,
          collections: qdrantStatus.collections.length
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        status: 'RAG System Degraded',
        error: error instanceof Error ? error.message : 'Unknown error',
        qdrant: {
          connected: false,
          error: 'Connection failed'
        }
      });
    }
  });
  // ============================================
  // SCHEMA-PERFECT AUTO-GENERATED CRUD ROUTES
  // ============================================

  // 1. Daily Visit Reports - date field, auto reportDate
  createAutoCRUD(app, {
    endpoint: 'dvr',
    table: dailyVisitReports,
    schema: insertDailyVisitReportSchema,
    tableName: 'Daily Visit Report',
    dateField: 'reportDate',
    autoFields: {
      reportDate: () => new Date().toISOString().split('T')[0], // date type
      checkInTime: () => new Date() // timestamp type
    }
  });

  // 2. Technical Visit Reports - date field, auto reportDate
  createAutoCRUD(app, {
    endpoint: 'tvr',
    table: technicalVisitReports,
    schema: insertTechnicalVisitReportSchema,
    tableName: 'Technical Visit Report',
    dateField: 'reportDate',
    autoFields: {
      reportDate: () => new Date().toISOString().split('T')[0],
      checkInTime: () => new Date()
    }
  });

  // 3. Permanent Journey Plans - date field, auto planDate and status
  createAutoCRUD(app, {
    endpoint: 'pjp',
    table: permanentJourneyPlans,
    schema: insertPermanentJourneyPlanSchema,
    tableName: 'Permanent Journey Plan',
    dateField: 'planDate',
    autoFields: {
      planDate: () => new Date().toISOString().split('T')[0],
      status: () => 'planned' // varchar type with default
    }
  });

  // 4. Dealers - no date field for filtering
  createAutoCRUD(app, {
    endpoint: 'dealers',
    table: dealers,
    schema: insertDealerSchema,
    tableName: 'Dealer'
    // No auto fields needed - all required fields should be provided
  });

  // 5. Daily Tasks - date field, auto taskDate and status
  createAutoCRUD(app, {
    endpoint: "daily-tasks",
    table: dailyTasks,
    schema: insertDailyTaskSchema,
    tableName: "Daily Task",
    dateField: "taskDate",
    autoFields: {
      id: () => randomUUID(), // <-- force-generate id
      taskDate: () => new Date().toISOString().split("T")[0],
      status: () => "Assigned",
    },
  });

  // 6. Leave Applications - date field, auto status
  createAutoCRUD(app, {
    endpoint: 'leave-applications',
    table: salesmanLeaveApplications,
    schema: insertSalesmanLeaveApplicationSchema,
    tableName: 'Leave Application',
    dateField: 'startDate',
    autoFields: {
      status: () => 'Pending' // varchar type
    }
  });

  // 7. Client Reports - no specific date field for range filtering
  createAutoCRUD(app, {
    endpoint: 'client-reports',
    table: clientReports,
    schema: insertClientReportSchema,
    tableName: 'Client Report'
    // checkOutTime is timestamp but not used for filtering
  });

  // 8. Competition Reports - date field, auto reportDate
  createAutoCRUD(app, {
    endpoint: 'competition-reports',
    table: competitionReports,
    schema: insertCompetitionReportSchema,
    tableName: 'Competition Report',
    dateField: 'reportDate',
    autoFields: {
      reportDate: () => new Date().toISOString().split('T')[0]
    }
  });

  // 9. Dealer Reports and Scores - no date field for filtering
  createAutoCRUD(app, {
    endpoint: 'dealer-reports-scores',
    table: dealerReportsAndScores,
    schema: insertDealerReportsAndScoresSchema,
    tableName: 'Dealer Report and Score',
    autoFields: {
      lastUpdatedDate: () => new Date() // timestamp type
    }
  });
  createAutoCRUD(app, {
    endpoint: 'sales-reports',
    table: salesReport,
    schema: insertSalesReportSchema, // ← Need this import
    tableName: 'Sales Report',
    dateField: 'reportDate'
  });
  createAutoCRUD(app, {
    endpoint: 'dealer-brand-mapping',
    table: dealerBrandMapping,
    schema: insertDealerBrandMappingSchema, // ← Need this import
    tableName: 'Dealer Brand Mapping'
  });
  createAutoCRUD(app, {
    endpoint: 'brands',
    table: brands,
    schema: insertBrandSchema, // ← Need this import
    tableName: 'Brand'
  });
  createAutoCRUD(app, {
    endpoint: 'ratings',
    table: ratings,
    schema: insertRatingSchema, // ← Need this import
    tableName: 'Rating'
  });
  createAutoCRUD(app, {
    endpoint: 'ddp',
    table: ddp,
    schema: insertDdpSchema, // ← Need this import
    tableName: 'DDP'
  });
  createAutoCRUD(app, {
    endpoint: 'collection-reports',
    table: collectionReports,
    schema: insertCollectionReportSchema, // ← Need this import
    tableName: 'Collection Report'
  });
  createAutoCRUD(app, {
    endpoint: 'sales-reports',
    table: salesReport,
    schema: insertSalesReportSchema, // ← Need this import
    tableName: 'Sales Report',
    dateField: 'reportDate'
  });


  // ============================================
  // SPECIAL ATTENDANCE ROUTES (with schema validation)
  // ============================================
  app.get('/api/attendance/user/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { startDate, endDate, limit = '50' } = req.query;

      let whereCondition = eq(salesmanAttendance.userId, parseInt(userId));

      if (startDate && endDate) {
        whereCondition = and(
          whereCondition,
          gte(salesmanAttendance.attendanceDate, startDate as string),
          lte(salesmanAttendance.attendanceDate, endDate as string)
        );
      }

      const records = await db.select().from(salesmanAttendance)
        .where(whereCondition)
        .orderBy(desc(salesmanAttendance.attendanceDate))
        .limit(parseInt(limit as string));

      res.json({ success: true, data: records });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to fetch attendance' });
    }
  });
  app.post('/api/attendance/punch-in', async (req: Request, res: Response) => {
    try {
      const {
        userId,
        companyId,        // required if you don't pass geofenceId
        geofenceId,       // optional: allows GET /v1/geofences/:id
        latitude,
        longitude,
        locationName,
        accuracy,
        speed,
        heading,
        altitude,
        selfieUrl
      } = req.body;

      if (!userId || latitude == null || longitude == null || (!companyId && !geofenceId)) {
        return res.status(400).json({
          success: false,
          error: 'userId, latitude, longitude, and (companyId OR geofenceId) are required'
        });
      }

      // 1) Build the EXACT endpoint with REAL values.
      let radarUrl: string;
      if (geofenceId) {
        // DOCS: GET /v1/geofences/:id
        radarUrl = `https://api.radar.io/v1/geofences/${geofenceId}`;
      } else {
        // DOCS: GET /v1/geofences/:tag/:externalId
        const tag = 'office';
        const externalId = `company:${companyId}`; // must be "1" per your CSV
        radarUrl = `https://api.radar.io/v1/geofences/${encodeURIComponent(tag)}/${encodeURIComponent(externalId)}`;
      }

      const gfRes = await fetch(radarUrl, {
        method: 'GET',
        headers: { Authorization: process.env.RADAR_SECRET_KEY as string }
      });
      const gfJson = await gfRes.json().catch(() => ({} as any));

      if (!gfRes.ok || !gfJson?.geofence || gfJson?.meta?.code !== 200) {
        console.error('[radar] FAIL', {
          status: gfRes.status,
          url: radarUrl,
          envKeyPrefix: (process.env.RADAR_SECRET_KEY || '').slice(0, 12),
          resp: gfJson
        });
        return res.status(400).json({
          success: false,
          error: gfJson?.meta?.message || gfJson?.message || 'Could not fetch geofence from Radar'
        });
      }

      const geofence = gfJson.geofence;

      // 2) Compare coordinates (circle check; exact equality is nonsense)
      const lat = Number(latitude);
      const lon = Number(longitude);
      const acc = accuracy != null ? Number(accuracy) : 0;

      let inside = false;
      if (geofence.type === 'circle' && geofence.geometryCenter && typeof geofence.geometryRadius === 'number') {
        const [cLon, cLat] = geofence.geometryCenter.coordinates; // [lng, lat]
        const R = 6371000;
        const toRad = (d: number) => d * Math.PI / 180;
        const dLat = toRad(lat - cLat);
        const dLon = toRad(lon - cLon);
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(cLat)) *
          Math.cos(toRad(lat)) *
          Math.sin(dLon / 2) ** 2;
        const distanceMeters = 2 * R * Math.asin(Math.sqrt(a));
        const buffer = Math.max(0, acc); // give a bit of grace for GPS noise
        inside = distanceMeters <= (geofence.geometryRadius + buffer);
      } else {
        // You said no Turf; if it’s a polygon fence, fallback
        inside = true;
      }

      if (!inside) {
        return res.status(400).json({
          success: false,
          error: 'You are not within office premises'
        });
      }

      // 3) Insert row exactly matching your schema
      const today = new Date().toISOString().split('T')[0];

      const attendanceData = {
        userId: parseInt(userId),                                // integer NOT NULL
        attendanceDate: today,                                   // date NOT NULL
        locationName: (locationName || geofence.description || 'Office').slice(0, 500),
        inTimeTimestamp: new Date(),                             // timestamptz NOT NULL
        outTimeTimestamp: null,                                  // timestamptz nullable
        inTimeImageCaptured: !!selfieUrl,                        // boolean NOT NULL
        outTimeImageCaptured: false,                             // boolean NOT NULL
        inTimeImageUrl: selfieUrl || null,                       // varchar(500)
        outTimeImageUrl: null,                                   // varchar(500)
        inTimeLatitude: lat.toFixed(7),                          // decimal(10,7) NOT NULL
        inTimeLongitude: lon.toFixed(7),                         // decimal(10,7) NOT NULL
        inTimeAccuracy: accuracy != null ? Number(accuracy).toFixed(2) : null, // decimal(10,2)
        inTimeSpeed: speed != null ? Number(speed).toFixed(2) : null, // decimal(10,2)
        inTimeHeading: heading != null ? Number(heading).toFixed(2) : null, // decimal(10,2)
        inTimeAltitude: altitude != null ? Number(altitude).toFixed(2) : null, // decimal(10,2)
        outTimeLatitude: null,
        outTimeLongitude: null,
        outTimeAccuracy: null,
        outTimeSpeed: null,
        outTimeHeading: null,
        outTimeAltitude: null
      };

      const parseResult = insertSalesmanAttendanceSchema.safeParse(attendanceData);
      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          error: 'Attendance data validation failed',
          details: parseResult.error.errors
        });
      }

      const [result] = await db.insert(salesmanAttendance).values(parseResult.data).returning();

      return res.json({
        success: true,
        data: result,
        message: `Punched in at ${attendanceData.locationName}`,
        geofenceRef: {
          id: geofence._id,
          tag: geofence.tag,
          externalId: geofence.externalId,
          radiusMeters: geofence.geometryRadius ?? null
        }
      });
    } catch (err: any) {
      console.error('Punch in error:', err);
      res.status(500).json({ success: false, error: 'Punch in failed' });
    }
  });

  app.post('/api/attendance/punch-out', async (req: Request, res: Response) => {
    try {
      const { userId, latitude, longitude, accuracy, speed, heading, altitude, selfieUrl } = req.body;

      if (!userId) {
        return res.status(400).json({ success: false, error: 'userId is required' });
      }

      const today = new Date().toISOString().split('T')[0];

      const [unpunched] = await db.select().from(salesmanAttendance)
        .where(and(
          eq(salesmanAttendance.userId, parseInt(userId)),
          eq(salesmanAttendance.attendanceDate, today),
          isNull(salesmanAttendance.outTimeTimestamp)
        ))
        .orderBy(desc(salesmanAttendance.inTimeTimestamp))
        .limit(1);

      if (!unpunched) {
        return res.status(404).json({ success: false, error: 'No active punch-in record found' });
      }

      const updateData = {
        outTimeTimestamp: new Date(),
        outTimeImageCaptured: !!selfieUrl,
        outTimeImageUrl: selfieUrl || null,
        outTimeLatitude: latitude != null ? latitude.toString() : null,
        outTimeLongitude: longitude != null ? longitude.toString() : null,
        outTimeAccuracy: accuracy != null ? Number(accuracy).toFixed(2) : null,
        outTimeSpeed: speed != null ? Number(speed).toFixed(2) : null,
        outTimeHeading: heading != null ? Number(heading).toFixed(2) : null,
        outTimeAltitude: altitude != null ? Number(altitude).toFixed(2) : null,
        updatedAt: new Date()
      };

      const [result] = await db.update(salesmanAttendance)
        .set(updateData)
        .where(eq(salesmanAttendance.id, unpunched.id))
        .returning();

      return res.json({ success: true, data: result, message: 'Punched out successfully' });

    } catch (error) {
      console.error('Punch out error:', error);
      res.status(500).json({ success: false, error: 'Punch out failed' });
    }
  });
  // ========== 1) START TRIP ==========
  app.post("/api/geo/start", async (req: Request, res: Response) => {
    try {
      const parsed = StartTripBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
      }
      const { userId, dealerId, lat, lng, radarTripId } = parsed.data;

      const [dealerRow] = await db.select().from(dealers).where(eq(dealers.id, dealerId)).limit(1);
      if (!dealerRow) return res.status(404).json({ error: "Dealer not found" });

      const now = new Date();

      const [row] = await db.insert(geoTracking).values({
        id: crypto.randomUUID(),     // varchar PK (schema requires non-null)
        userId,
        latitude: lat,
        longitude: lng,
        journeyId: radarTripId,
        checkInTime: now,
        appState: "started",
        isActive: true,
        createdAt: now,              // your table has NOT NULL on these; set explicitly
        updatedAt: now,
      }).returning({ id: geoTracking.id });

      return res.json({ success: true, data: { dbJourneyId: row.id, dealer: dealerRow } });
    } catch (err: any) {
      console.error("[geo/start] error", err.message);
      return res.status(500).json({ error: "Failed to start trip" });
    }
  });

  // ========== 2) GET TRIP BY ID ==========
  app.get("/api/geo/trips/:journeyId", async (req: Request, res: Response) => {
    try {
      const p = JourneyIdParam.safeParse(req.params);
      if (!p.success) return res.status(400).json({ error: "Invalid journeyId" });
      const { journeyId } = p.data;

      const radarTrip = await radar.server.getTrip(journeyId, true);
      const [row] = await db.select().from(geoTracking)
        .where(eq(geoTracking.journeyId, journeyId))
        .limit(1);

      let dealerRow = null;
      const extId = radarTrip?.trip?.destinationGeofenceExternalId;
      if (extId) {
        const cleanId = dePref(extId); // Radar returns dealer:xyz; DB stores xyz
        const [dealer] = await db.select().from(dealers)
          .where(eq(dealers.id, cleanId as any))
          .limit(1);
        dealerRow = dealer || null;
      }

      const lastLoc = radarTrip?.trip?.locations?.at(-1);
      const currentLocation = lastLoc
        ? { latitude: lastLoc.coordinates[1], longitude: lastLoc.coordinates[0], timestamp: lastLoc.timestamp }
        : null;

      const locationData = {
        currentLocation,
        allLocations: (radarTrip?.trip?.locations || []).map((loc: any) => ({
          latitude: loc.coordinates[1],
          longitude: loc.coordinates[0],
          timestamp: loc.timestamp,
        })),
        eta: radarTrip?.trip?.eta,
        status: radarTrip?.trip?.status,
      };

      return res.json({
        success: true,
        data: { radarTrip: radarTrip.trip, db: row, dealer: dealerRow, locationData },
      });
    } catch (err: any) {
      console.error("[geo/trips/:id] error", err.message);
      return res.status(500).json({ error: "Failed to fetch trip" });
    }
  });

  // ========== 3) LIST ACTIVE TRIPS ==========
  app.get("/api/geo/trips", async (_req: Request, res: Response) => {
    try {
      const radarTrips = await radar.server.listTrips({ status: "started", includeLocations: true });
      const dbRows = await db.select().from(geoTracking).where(eq(geoTracking.isActive, true));

      const enriched = await Promise.all(
        (radarTrips.trips || []).map(async (trip: any) => {
          let dealerRow = null;
          if (trip.destinationGeofenceExternalId) {
            const cleanId = dePref(trip.destinationGeofenceExternalId);
            const [dealer] = await db.select().from(dealers)
              .where(eq(dealers.id, cleanId as any))
              .limit(1);
            dealerRow = dealer || null;
          }
          const dbRow = dbRows.find(r => r.journeyId === trip._id);
          const lastLoc = trip.locations?.at(-1);
          const locationSummary = {
            totalLocations: trip.locations?.length || 0,
            lastUpdate: lastLoc?.timestamp || null,
            currentStatus: trip.status,
          };
          return { radarTrip: trip, db: dbRow, dealer: dealerRow, locationSummary };
        })
      );

      return res.json({ success: true, data: enriched });
    } catch (err: any) {
      console.error("[geo/trips] error", err.message);
      return res.status(500).json({ error: "Failed to list trips" });
    }
  });

  // ========== 4) UPDATE TRIP (DB only; frontend updates Radar) ==========
  app.patch("/api/geo/trips/:journeyId", async (req: Request, res: Response) => {
    try {
      const p = JourneyIdParam.safeParse(req.params);
      if (!p.success) return res.status(400).json({ error: "Invalid journeyId" });
      const { journeyId } = p.data;

      await db.update(geoTracking).set({
        appState: req.body?.status || "updated",
        updatedAt: new Date(),  // keep NOT NULL happy
      }).where(eq(geoTracking.journeyId, journeyId));

      return res.json({ success: true, data: { message: "DB updated" } });
    } catch (err: any) {
      console.error("[geo/trips/:id][PATCH] error", err.message);
      return res.status(500).json({ error: "Failed to update trip" });
    }
  });

  // ========== 5) FINISH TRIP ==========
  app.post("/api/geo/finish/:journeyId", async (req: Request, res: Response) => {
    try {
      const p = JourneyIdParam.safeParse(req.params);
      if (!p.success) return res.status(400).json({ error: "Invalid journeyId" });
      const { journeyId } = p.data;

      const finalTrip = await radar.server.getTrip(journeyId, true);
      const totalLocations = finalTrip.trip.locations?.length || 0;
      const finalDistance = finalTrip.trip.distance?.value ?? finalTrip.trip.eta?.distance ?? 0;

      await radar.server.updateTrip(journeyId, 'completed');

      await db.update(geoTracking).set({
        checkOutTime: new Date(),
        appState: "completed",
        isActive: false,
        totalDistanceTravelled: Number.isFinite(finalDistance) ? (finalDistance / 1000).toFixed(3) : "0",
        updatedAt: new Date(),
      }).where(eq(geoTracking.journeyId, journeyId));

      return res.json({
        success: true,
        data: {
          journeyId,
          deleted: true,
          finalStats: {
            totalLocations,
            finalDistance: (finalDistance / 1000).toFixed(3) + " km",
            duration: finalTrip.trip.eta?.duration || 0,
          },
        },
      });
    } catch (err: any) {
      const status = err?.response?.status;
      const body = err?.response?.data;
      const headers = err?.response?.headers;

      console.error("[geo/finish] error status:", status || "no status");
      if (body) {
        console.error("[geo/finish] error body:", JSON.stringify(body, null, 2));
      }
      if (headers) {
        console.error("[geo/finish] response headers:", headers);
      }
      console.error("[geo/finish] raw error:", err.message);

      return res.status(500).json({
        error: "Failed to finish trip",
        details: body || err.message,
      });
    }
  });

  // ========== 6) GET TRIP ROUTE ==========
  app.get("/api/geo/trips/:journeyId/route", async (req: Request, res: Response) => {
    try {
      const p = JourneyIdParam.safeParse(req.params);
      if (!p.success) return res.status(400).json({ error: "Invalid journeyId" });
      const { journeyId } = p.data;

      const route = await radar.server.getTripRoute(journeyId);

      await db.update(geoTracking).set({
        totalDistanceTravelled: route?.distance?.value ? (route.distance.value / 1000).toFixed(3) : "0",
        updatedAt: new Date(),
      }).where(eq(geoTracking.journeyId, journeyId));

      return res.json({ success: true, data: route });
    } catch (err: any) {
      console.error("[geo/trips/:id/route] error", err.message);
      return res.status(500).json({ error: "Failed to fetch trip route" });
    }
  });
  // ============================================
  // DASHBOARD STATS (with proper type handling)
  // ============================================
  app.get('/api/dashboard/stats/:userId', async (req: Request, res: Response) => {
    try {
      const userId = Number(req.params.userId);
      console.log("[DEBUG] Incoming userId param:", req.params.userId, "→ parsed:", userId);

      if (!Number.isFinite(userId)) {
        console.warn("[DEBUG] Invalid userId detected:", req.params.userId);
        return res.status(400).json({ success: false, error: 'Invalid userId - must be a number' });
      }

      const monthStartTs = sql`date_trunc('month', now())`;
      const nextMonthStartTs = sql`date_trunc('month', now()) + interval '1 month'`;
      const todayDate = sql`current_date`;

      console.log("[DEBUG] Query boundaries:",
        {
          monthStartTs: "date_trunc('month', now())",
          nextMonthStartTs: "date_trunc('month', now()) + interval '1 month'",
          todayDate: "current_date"
        }
      );

      // wrap each query in try/catch to isolate
      let todayAttendance, monthlyReports, pendingTasks, totalDealers, pendingLeaves;

      try {
        console.log("[DEBUG] Running attendance query for user:", userId);
        todayAttendance = await db.select().from(salesmanAttendance)
          .where(and(
            eq(salesmanAttendance.userId, userId),
            eq(salesmanAttendance.attendanceDate, todayDate)
          ))
          .orderBy(desc(salesmanAttendance.inTimeTimestamp))
          .limit(1);
        console.log("[DEBUG] Attendance result:", todayAttendance);
      } catch (err) {
        console.error("[ERROR] Attendance query failed:", err);
        throw err;
      }

      try {
        console.log("[DEBUG] Running monthly reports query");
        monthlyReports = await db.select({ count: sql<number>`cast(count(*) as int)`.as('count') })
          .from(dailyVisitReports)
          .where(and(
            eq(dailyVisitReports.userId, userId),
            gte(dailyVisitReports.reportDate, monthStartTs),
            lt(dailyVisitReports.reportDate, nextMonthStartTs)
          ));
        console.log("[DEBUG] Monthly reports result:", monthlyReports);
      } catch (err) {
        console.error("[ERROR] Monthly reports query failed:", err);
        throw err;
      }

      try {
        console.log("[DEBUG] Running pending tasks query");
        pendingTasks = await db.select({ count: sql<number>`cast(count(*) as int)`.as('count') })
          .from(dailyTasks)
          .where(and(
            eq(dailyTasks.userId, userId),
            eq(dailyTasks.status, 'Assigned')
          ));
        console.log("[DEBUG] Pending tasks result:", pendingTasks);
      } catch (err) {
        console.error("[ERROR] Pending tasks query failed:", err);
        throw err;
      }

      try {
        console.log("[DEBUG] Running dealers query");
        totalDealers = await db.select({ count: sql<number>`cast(count(*) as int)`.as('count') })
          .from(dealers)
          .where(eq(dealers.userId, userId));
        console.log("[DEBUG] Dealers result:", totalDealers);
      } catch (err) {
        console.error("[ERROR] Dealers query failed:", err);
        throw err;
      }

      try {
        console.log("[DEBUG] Running pending leaves query");
        pendingLeaves = await db.select({ count: sql<number>`cast(count(*) as int)`.as('count') })
          .from(salesmanLeaveApplications)
          .where(and(
            eq(salesmanLeaveApplications.userId, userId),
            eq(salesmanLeaveApplications.status, 'Pending')
          ));
        console.log("[DEBUG] Pending leaves result:", pendingLeaves);
      } catch (err) {
        console.error("[ERROR] Pending leaves query failed:", err);
        throw err;
      }

      res.json({
        success: true,
        data: {
          attendance: {
            isPresent: todayAttendance.length > 0,
            punchInTime: todayAttendance[0]?.inTimeTimestamp ?? null,
            punchOutTime: todayAttendance[0]?.outTimeTimestamp ?? null
          },
          stats: {
            monthlyReports: monthlyReports[0]?.count ?? 0,
            pendingTasks: pendingTasks[0]?.count ?? 0,
            totalDealers: totalDealers[0]?.count ?? 0,
            pendingLeaves: pendingLeaves[0]?.count ?? 0
          }
        }
      });
    } catch (error) {
      console.error('Dashboard stats master error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch dashboard stats' });
    }
  });

}