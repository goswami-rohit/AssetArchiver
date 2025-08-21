// routes.ts - COMPLETE IMPLEMENTATION WITH AUTO-CRUD
import { Express, Request, Response } from 'express';
import express from "express";
import { db } from 'server/db';
import {
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
  companies,
  dealerReportsAndScores,
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
  insertDealerReportsAndScoresSchema
} from 'shared/schema';
import { eq, desc, asc, and, gte, lte, isNull, inArray, notInArray, like, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import multer from 'multer';
import { getDistance } from 'geolib';
import * as turf from '@turf/turf';
import { ChatMessage } from 'server/bot/aiService';
import EnhancedRAGService from 'server/bot/aiService';
import { telegramBot } from './bot/telegram';

// Fix multer typing
interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

// Configure multer for image uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Office location coordinates with geo-fencing polygons
// const OFFICE_LOCATIONS = [
//   {
//     name: "Head Office",
//     lat: 26.1200853,
//     lng: 91.7955807,
//     radius: 100,
//     polygon: turf.circle([91.7955807, 26.1200853], 0.1, { units: 'kilometers' })
//   }
// ];

// ----------------- Small utils -----------------
const OFFICE_SPLITTER = "||"; // do not change formatting once saved

function formatOfficeAddress(address: string, lat: number, lng: number) {
  return `${address.trim()} ${OFFICE_SPLITTER} ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

function parseOfficeAddress(raw?: string | null): null | { address: string; lat: number; lng: number } {
  if (!raw) return null;
  const parts = raw.split(OFFICE_SPLITTER);
  if (parts.length !== 2) return null;
  const address = parts[0].trim();
  const coords = parts[1].split(",").map(s => s.trim());
  if (coords.length !== 2) return null;
  const lat = Number(coords[0]);
  const lng = Number(coords[1]);
  if (!isFinite(lat) || !isFinite(lng)) return null;
  return { address, lat, lng };
}

// Haversine in meters. No extra deps, no turf drama.
function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// ----------------- Radar client (server-side) -----------------
// const RADAR_BASE = "https://api.radar.io/v1";
// const RADAR_SECRET = process.env.RADAR_SECRET_KEY; // server key
// async function radarGet(path: string, params: Record<string, string>) {
//   if (!RADAR_SECRET) throw new Error("RADAR_SECRET not configured");
//   const url = new URL(RADAR_BASE + path);
//   Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
//   const res = await fetch(url, { headers: { Authorization: `Bearer ${RADAR_SECRET}` } });
//   if (!res.ok) throw new Error(`Radar error ${res.status}: ${await res.text()}`);
//   return res.json();
// }

const LOCATIONIQ_KEY = process.env.LOCATIONIQ_KEY; // you said you set this
if (!LOCATIONIQ_KEY) {
  console.warn("⚠️ LOCATION_IO_KEY is missing; geocoding routes will fail.");
}

async function liqFetch(url: string) {
  const r = await fetch(url);
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`LocationIQ ${r.status}: ${t}`);
  }
  return r.json();
}


// ----------------- Zod payloads -----------------
const zCompanyId = z.object({ companyId: z.string().min(1) });

const zSetCurrent = z.object({
  companyId: z.string().min(1),
  latitude: z.number().finite(),
  longitude: z.number().finite(),
  address: z.string().optional()
});

const zSetAddress = z.object({
  companyId: z.string().min(1),
  address: z.string().min(3)
});

const zReverseGeo = z.object({ latitude: z.number(), longitude: z.number() });
const zForwardGeo = z.object({ address: z.string().min(3) });

const zValidate = z.object({
  companyId: z.string().min(1),
  latitude: z.number().finite(),
  longitude: z.number().finite()
});

const zPunchIn = z.object({
  userId: z.string().min(1),
  companyId: z.string().min(1),
  latitude: z.number().finite(),
  longitude: z.number().finite(),
  accuracy: z.number().finite().optional(),
  selfieUrl: z.string().url().optional()
});

const zPunchOut = z.object({
  userId: z.string().min(1),
  latitude: z.number().finite().optional(),
  longitude: z.number().finite().optional(),
  selfieUrl: z.string().url().optional()
});

const zPunchIn3 = z.object({
  userId: z.coerce.number().int().positive(),
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
  accuracy: z.coerce.number().optional(),
  speed: z.coerce.number().optional(),
  heading: z.coerce.number().optional(),
  altitude: z.coerce.number().optional(),
  selfieUrl: z.string().url().optional(),
});

const zPunchOut3 = z.object({
  userId: z.coerce.number().int().positive(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  accuracy: z.coerce.number().optional(),
  speed: z.coerce.number().optional(),
  heading: z.coerce.number().optional(),
  altitude: z.coerce.number().optional(),
  selfieUrl: z.string().url().optional(),
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
  dateField?: string // For date range filtering
}) {
  const { endpoint, table, schema, tableName, autoFields = {}, dateField } = config;

  // CREATE - with perfect schema validation
  app.post(`/api/${endpoint}`, async (req: Request, res: Response) => {
    try {
      // Parse and validate against exact schema
      const parseResult = schema.safeParse(req.body);

      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          error: `Validation failed for ${tableName}`,
          details: parseResult.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            received: err.received
          }))
        });
      }

      const validatedData = parseResult.data;

      // Apply auto-generated fields (only if not provided)
      const finalData = { ...validatedData };
      Object.entries(autoFields).forEach(([field, generator]) => {
        if (finalData[field] === undefined || finalData[field] === null) {
          finalData[field] = generator();
        }
      });

      // Schema handles createdAt/updatedAt with defaultNow(), but ensure they're set
      if (table.createdAt && !finalData.createdAt) {
        finalData.createdAt = new Date();
      }
      if (table.updatedAt && !finalData.updatedAt) {
        finalData.updatedAt = new Date();
      }

      const newRecord = await db.insert(table).values(finalData).returning();
      res.json({
        success: true,
        data: newRecord[0],
        message: `${tableName} created successfully`
      });
    } catch (error) {
      console.error(`Create ${tableName} error:`, error);
      res.status(500).json({
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

export function setupWebRoutes(app: Express) {
  // PWA route
  app.get('/pwa', (req: Request, res: Response) => {
    res.redirect('/login');
  });

  // ==================== AUTH ====================
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { loginId, password } = req.body;

      if (!loginId || !password) {
        return res.status(400).json({ error: 'Login ID and password are required' });
      }

      // Find user by salesmanLoginId or email
      const user = await db.query.users.findFirst({
        where: or(
          eq(users.salesmanLoginId, loginId),
          eq(users.email, loginId)
        ),
        with: {
          company: true
        }
      });

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check if user is active
      if (user.status !== 'active') {
        return res.status(401).json({ error: 'Account is not active' });
      }

      // For now, simple password check (you should use bcrypt in production)
      if (user.hashedPassword !== password) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Success - return user data (without password)
      const { hashedPassword, ...userWithoutPassword } = user;

      res.json({
        success: true,
        user: userWithoutPassword,
        message: 'Login successful'
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  // ==================== ENHANCED AI/RAG ROUTES ====================
  // Import the enhanced service

  // 🚀 ENHANCED RAG CHAT with Vector Search
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

  // 🤖 INTELLIGENT RAG CHAT (Complete Vector Flow)
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

  // 🔍 VECTOR-POWERED ENDPOINT DISCOVERY
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

  // ⚡ DIRECT API EXECUTION
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

  // 📋 ENHANCED DATA EXTRACTION & SUBMISSION
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

  // 📊 SMART DATA FETCHING
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

  // 🎯 RAG HEALTH CHECK with Vector Status
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
    endpoint: 'daily-tasks',
    table: dailyTasks,
    schema: insertDailyTaskSchema,
    tableName: 'Daily Task',
    dateField: 'taskDate',
    autoFields: {
      taskDate: () => new Date().toISOString().split('T')[0],
      status: () => 'Assigned' // matches schema default
    }
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

  // app.post('/api/attendance/punch-in', async (req: Request, res: Response) => {
  //   try {
  //     // Validate input against schema expectations
  //     const { userId, latitude, longitude, locationName, accuracy, selfieUrl } = req.body;

  //     if (!userId || !latitude || !longitude) {
  //       return res.status(400).json({
  //         success: false,
  //         error: 'userId, latitude, and longitude are required'
  //       });
  //     }

  //     // Geo-fencing validation
  //     const userPoint = turf.point([longitude, latitude]);
  //     let isValid = false;
  //     let officeName = '';

  //     for (const office of OFFICE_LOCATIONS) {
  //       if (turf.booleanPointInPolygon(userPoint, office.polygon)) {
  //         isValid = true;
  //         officeName = office.name;
  //         break;
  //       }
  //     }

  //     if (!isValid) {
  //       return res.status(400).json({
  //         success: false,
  //         error: 'You are not within office premises'
  //       });
  //     }

  //     const today = new Date().toISOString().split('T')[0];

  //     // Build data matching exact schema
  //     const attendanceData = {
  //       userId: parseInt(userId), // integer type
  //       attendanceDate: today, // date type
  //       locationName: locationName || officeName, // varchar not null
  //       inTimeTimestamp: new Date(), // timestamp not null
  //       inTimeImageCaptured: !!selfieUrl, // boolean not null
  //       outTimeImageCaptured: false, // boolean not null  
  //       inTimeImageUrl: selfieUrl || null, // varchar nullable
  //       inTimeLatitude: latitude.toString(), // decimal as string
  //       inTimeLongitude: longitude.toString(), // decimal as string
  //       inTimeAccuracy: accuracy ? accuracy.toString() : null, // decimal nullable
  //       // All other nullable fields will be null by default
  //     };

  //     // Validate against schema
  //     const parseResult = insertSalesmanAttendanceSchema.safeParse(attendanceData);
  //     if (!parseResult.success) {
  //       return res.status(400).json({
  //         success: false,
  //         error: 'Attendance data validation failed',
  //         details: parseResult.error.errors
  //       });
  //     }

  //     const [result] = await db.insert(salesmanAttendance).values(parseResult.data).returning();
  //     res.json({
  //       success: true,
  //       data: result,
  //       message: `Punched in at ${officeName}`,
  //       geoInfo: { officeName, isValid }
  //     });
  //   } catch (error) {
  //     console.error('Punch in error:', error);
  //     res.status(500).json({ success: false, error: 'Punch in failed' });
  //   }
  // });

  // app.post('/api/attendance/punch-out', async (req: Request, res: Response) => {
  //   try {
  //     const { userId, latitude, longitude, selfieUrl } = req.body;

  //     if (!userId) {
  //       return res.status(400).json({
  //         success: false,
  //         error: 'userId is required'
  //       });
  //     }

  //     const today = new Date().toISOString().split('T')[0];

  //     // Find unpunched record
  //     const [unpunchedRecord] = await db.select().from(salesmanAttendance)
  //       .where(and(
  //         eq(salesmanAttendance.userId, parseInt(userId)),
  //         eq(salesmanAttendance.attendanceDate, today),
  //         isNull(salesmanAttendance.outTimeTimestamp)
  //       ))
  //       .orderBy(desc(salesmanAttendance.inTimeTimestamp))
  //       .limit(1);

  //     if (unpunchedRecord) {
  //       // Update with proper data types
  //       const updateData = {
  //         outTimeTimestamp: new Date(), // timestamp
  //         outTimeImageCaptured: !!selfieUrl, // boolean
  //         outTimeImageUrl: selfieUrl || null, // varchar nullable
  //         outTimeLatitude: latitude ? latitude.toString() : null, // decimal nullable
  //         outTimeLongitude: longitude ? longitude.toString() : null, // decimal nullable
  //         updatedAt: new Date()
  //       };

  //       const [result] = await db.update(salesmanAttendance)
  //         .set(updateData)
  //         .where(eq(salesmanAttendance.id, unpunchedRecord.id))
  //         .returning();

  //       res.json({
  //         success: true,
  //         data: result,
  //         message: 'Punched out successfully'
  //       });
  //     } else {
  //       res.status(404).json({
  //         success: false,
  //         error: 'No active punch-in record found'
  //       });
  //     }
  //   } catch (error) {
  //     console.error('Punch out error:', error);
  //     res.status(500).json({ success: false, error: 'Punch out failed' });
  //   }
  // });

  // ============================================
  // DASHBOARD STATS (with proper type handling)
  // ============================================

  app.get('/api/dashboard/stats/:userId', async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid userId - must be a number'
        });
      }

      const today = new Date().toISOString().split('T')[0];
      const currentMonth = new Date().toISOString().slice(0, 7);

      const [
        todayAttendance,
        monthlyReports,
        pendingTasks,
        totalDealers,
        pendingLeaves
      ] = await Promise.all([
        db.select().from(salesmanAttendance)
          .where(and(
            eq(salesmanAttendance.userId, userId),
            eq(salesmanAttendance.attendanceDate, today)
          )).limit(1),

        db.select({ count: sql<number>`cast(count(*) as int)` })
          .from(dailyVisitReports)
          .where(and(
            eq(dailyVisitReports.userId, userId),
            like(dailyVisitReports.reportDate, `${currentMonth}%`)
          )),

        db.select({ count: sql<number>`cast(count(*) as int)` })
          .from(dailyTasks)
          .where(and(
            eq(dailyTasks.userId, userId),
            eq(dailyTasks.status, 'Assigned')
          )),

        db.select({ count: sql<number>`cast(count(*) as int)` })
          .from(dealers)
          .where(eq(dealers.userId, userId)),

        db.select({ count: sql<number>`cast(count(*) as int)` })
          .from(salesmanLeaveApplications)
          .where(and(
            eq(salesmanLeaveApplications.userId, userId),
            eq(salesmanLeaveApplications.status, 'Pending')
          ))
      ]);

      res.json({
        success: true,
        data: {
          attendance: {
            isPresent: todayAttendance?.length > 0,
            punchInTime: todayAttendance?.[0]?.inTimeTimestamp,
            punchOutTime: todayAttendance?.[0]?.outTimeTimestamp
          },
          stats: {
            monthlyReports: monthlyReports[0]?.count || 0,
            pendingTasks: pendingTasks[0]?.count || 0,
            totalDealers: totalDealers[0]?.count || 0,
            pendingLeaves: pendingLeaves[0]?.count || 0
          }
        }
      });
    } catch (error) {
      console.error('Dashboard stats error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch dashboard stats' });
    }
  });

  //RG new endpoints----------------------------------------------------------------
  // GET office config
  app.get("/api/office/:companyId", async (req: Request, res: Response) => {
    try {
      const { companyId } = req.params;
      const [row] = await db.select().from(companies).where(eq(companies.id, Number(companyId))).limit(1);
      if (!row || !row.officeAddress) return res.json({ success: true, data: null });
      const parsed = parseOfficeAddress(row.officeAddress);
      return res.json({ success: true, data: parsed });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Set office by current location (LocationIQ reverse geocode)
  app.post("/api/office/set-current", async (req: Request, res: Response) => {
    try {
      const body = zSetCurrent.parse(req.body); // companyId (coerced), latitude, longitude, address?
      const { companyId, latitude, longitude } = body;

      let address = body.address?.trim();
      if (!address) {
        // Reverse geocode: lat/lon -> pretty address
        const url = `https://us1.locationiq.com/v1/reverse?key=${LOCATIONIQ_KEY}&lat=${latitude}&lon=${longitude}&format=json`;
        const j = await liqFetch(url);
        address = j?.display_name || `Lat ${latitude}, Lng ${longitude}`;
      }

      const officeAddress = formatOfficeAddress(address!, latitude, longitude); // "addr || lat, lng"
      await db
        .update(companies)
        .set({ officeAddress })
        .where(eq(companies.id, Number(companyId)));

      return res.json({ success: true, data: parseOfficeAddress(officeAddress) });
    } catch (e: any) {
      const code = e?.issues ? 400 : 500;
      return res.status(code).json({ success: false, error: e.message });
    }
  });

  // Set office by manual address (LocationIQ forward geocode)
  app.post("/api/office/set-address", async (req: Request, res: Response) => {
    try {
      const { companyId, address } = zSetAddress.parse(req.body); // companyId (coerced), address string
      const q = encodeURIComponent(address.trim());

      // Forward geocode: address -> lat/lon
      const url = `https://us1.locationiq.com/v1/search?key=${LOCATIONIQ_KEY}&q=${q}&format=json&limit=1`;
      const j = await liqFetch(url);
      const best = Array.isArray(j) ? j[0] : null;
      if (!best) {
        return res.status(404).json({ success: false, error: "Address not found" });
      }

      const lat = Number(best.lat);
      const lng = Number(best.lon);
      const pretty = best.display_name || address;

      const officeAddress = formatOfficeAddress(pretty, lat, lng); // "addr || lat, lng"
      await db
        .update(companies)
        .set({ officeAddress })
        .where(eq(companies.id, Number(companyId)));

      return res.json({ success: true, data: parseOfficeAddress(officeAddress) });
    } catch (e: any) {
      const code = e?.issues ? 400 : 500;
      return res.status(code).json({ success: false, error: e.message });
    }
  });

  // Geocoding helpers (JourneyTracker already calls these)
  app.post("/reverse-geocode", async (req, res) => {
    try {
      const { latitude, longitude } = z.object({
        latitude: z.number(),
        longitude: z.number()
      }).parse(req.body);

      // us1 datacenter; switch to eu1 if your account is EU
      const url = `https://us1.locationiq.com/v1/reverse?key=${LOCATIONIQ_KEY}&lat=${latitude}&lon=${longitude}&format=json`;
      const j = await liqFetch(url);

      res.json({
        success: true,
        address: { formatted: j?.display_name ?? "" },
        raw: j ?? null
      });
    } catch (e: any) {
      res.status(400).json({ success: false, error: e.message || "Reverse geocode failed" });
    }
  });


  app.post("/geocode-address", async (req, res) => {
    try {
      const { address } = z.object({ address: z.string().min(3) }).parse(req.body);
      const q = encodeURIComponent(address.trim());

      const url = `https://us1.locationiq.com/v1/search?key=${LOCATIONIQ_KEY}&q=${q}&format=json&limit=1`;
      const j = await liqFetch(url);
      const first = Array.isArray(j) ? j[0] : null;
      if (!first) return res.status(404).json({ success: false, error: "Address not found" });

      const lat = Number(first.lat);
      const lng = Number(first.lon);

      res.json({
        success: true,
        latitude: lat,
        longitude: lng,
        address: first.display_name ?? address
      });
    } catch (e: any) {
      res.status(400).json({ success: false, error: e.message || "Forward geocode failed" });
    }
  });


  // Validate location within 100 m of office
  app.post("/validate-location", async (req: Request, res: Response) => {
    try {
      const { companyId, latitude, longitude } = zValidate.parse(req.body);
      const [row] = await db.select().from(companies).where(eq(companies.id, Number(companyId))).limit(1);
      const parsed = parseOfficeAddress(row?.officeAddress);
      if (!parsed) return res.json({ success: true, data: { isInside: false, distanceMeters: null, radius: 100, message: "Office not configured" } });

      const distance = distanceMeters({ lat: latitude, lng: longitude }, { lat: parsed.lat, lng: parsed.lng });
      const isInside = distance <= 100;
      res.json({ success: true, data: { isInside, distanceMeters: Math.round(distance), radius: 100 } });
    } catch (e: any) {
      const code = e?.issues ? 400 : 500;
      res.status(code).json({ success: false, error: e.message });
    }
  });

  // ===== NEW ATTENDANCE v2 ENDPOINTS =====
  // Punch-IN with 100 m geofence (office from companies.officeAddress)
  app.post("/api/attendance2/punch-in", async (req, res) => {
    try {
      const Body = z.object({
        userId: z.coerce.number().int().positive(),
        companyId: z.coerce.number().int().positive(),
        latitude: z.number(),
        longitude: z.number(),
        accuracy: z.number().optional(),
        selfieUrl: z.string().url().optional(),
        locationName: z.string().optional()
      });
      const { userId, companyId, latitude, longitude, accuracy, selfieUrl, locationName } = Body.parse(req.body);

      // 1) Load office center from companies.officeAddress: "address || lat, lng"
      const [co] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
      const parsed = parseOfficeAddress(co?.officeAddress);
      if (!parsed) {
        return res.status(400).json({ success: false, error: "Office geofence not configured for this company" });
      }

      // 2) GPS accuracy gate (optional)
      if (typeof accuracy === "number" && accuracy > 50) {
        return res.status(400).json({ success: false, error: "Low GPS accuracy. Move outdoors and try again." });
      }

      // 3) Distance gate
      const dist = distanceMeters({ lat: latitude, lng: longitude }, { lat: parsed.lat, lng: parsed.lng });
      if (dist > 100) {
        return res.status(400).json({ success: false, error: `Outside office geofence (${Math.round(dist)} m).` });
      }

      // 4) Build row per schema (decimal fields as strings)
      const today = new Date().toISOString().split("T")[0];
      const attendanceData = {
        userId,
        attendanceDate: today,
        locationName: locationName || parsed.address,
        inTimeTimestamp: new Date(),
        inTimeImageCaptured: !!selfieUrl,
        outTimeImageCaptured: false,
        inTimeImageUrl: selfieUrl ?? null,
        inTimeLatitude: latitude.toString(),
        inTimeLongitude: longitude.toString(),
        inTimeAccuracy: accuracy != null ? accuracy.toString() : null
      };

      const [inserted] = await db.insert(salesmanAttendance).values(attendanceData).returning();
      return res.json({ success: true, data: inserted, message: "Punch-in recorded." });
    } catch (e: any) {
      console.error("attendance2/punch-in error", e?.issues || e);
      return res.status(e?.issues ? 400 : 500).json({ success: false, error: e?.message || "Punch-in failed" });
    }
  });

  // Punch-OUT (no geofence)
  app.post("/api/attendance2/punch-out", async (req, res) => {
    try {
      const Body = z.object({
        userId: z.coerce.number().int().positive(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        selfieUrl: z.string().url().optional()
      });
      const { userId, latitude, longitude, selfieUrl } = Body.parse(req.body);

      const today = new Date().toISOString().split("T")[0];
      const [open] = await db.select().from(salesmanAttendance)
        .where(and(
          eq(salesmanAttendance.userId, userId),
          eq(salesmanAttendance.attendanceDate, today),
          isNull(salesmanAttendance.outTimeTimestamp)
        ))
        .orderBy(desc(salesmanAttendance.inTimeTimestamp))
        .limit(1);
      if (!open) return res.status(404).json({ success: false, error: "No active punch-in record found" });

      const updateData = {
        outTimeTimestamp: new Date(),
        outTimeImageCaptured: !!selfieUrl,
        outTimeImageUrl: selfieUrl ?? null,
        outTimeLatitude: latitude != null ? latitude.toString() : null,
        outTimeLongitude: longitude != null ? longitude.toString() : null,
        updatedAt: new Date()
      };

      const [updated] = await db.update(salesmanAttendance)
        .set(updateData)
        .where(eq(salesmanAttendance.id, open.id))
        .returning();

      return res.json({ success: true, data: updated, message: "Punch-out recorded." });
    } catch (e: any) {
      console.error("attendance2/punch-out error", e?.issues || e);
      return res.status(e?.issues ? 400 : 500).json({ success: false, error: e?.message || "Punch-out failed" });
    }
  });


  // -------- Attendance v3 (no geofence, no Radar) --------
  app.use(express.json({ limit: "1mb" }));

  // Punch IN: just record GPS + timestamps
  app.post("/api/attendance3/punch-in", async (req, res) => {
    try {
      console.log("punch-in body:", req.body);
      const { userId, latitude, longitude, accuracy, speed, heading, altitude, selfieUrl } =
        zPunchIn3.parse(req.body);

      const today = new Date().toISOString().split("T")[0];
      const locationName = `Lat ${latitude.toFixed(5)}, Lng ${longitude.toFixed(5)}`;

      const row = {
        userId,
        attendanceDate: today,            // date column accepts 'YYYY-MM-DD'
        locationName,                     // NOT NULL
        inTimeTimestamp: new Date(),
        inTimeImageCaptured: !!selfieUrl,
        outTimeImageCaptured: false,
        inTimeImageUrl: selfieUrl ?? null,
        // decimals as strings (your schema uses decimal())
        inTimeLatitude: latitude.toString(),
        inTimeLongitude: longitude.toString(),
        inTimeAccuracy: accuracy != null ? accuracy.toString() : null,
        inTimeSpeed: speed != null ? speed.toString() : null,
        inTimeHeading: heading != null ? heading.toString() : null,
        inTimeAltitude: altitude != null ? altitude.toString() : null,
      };

      const [inserted] = await db.insert(salesmanAttendance).values(row).returning();
      return res.json({ success: true, data: inserted, message: "Punch-in recorded." });
    } catch (e: any) {
      console.error("attendance3/punch-in error:", e?.issues || e);
      if (e?.issues) return res.status(400).json({ success: false, error: "Validation failed", details: e.issues });
      return res.status(400).json({ success: false, error: e?.message || "Punch-in failed" });
    }
  });

  // Punch OUT: update latest open record for today
  app.post("/api/attendance3/punch-out", async (req, res) => {
    try {
      console.log("punch-out body:", req.body);
      const { userId, latitude, longitude, accuracy, speed, heading, altitude, selfieUrl } =
        zPunchOut3.parse(req.body);

      const today = new Date().toISOString().split("T")[0];

      const [open] = await db
        .select()
        .from(salesmanAttendance)
        .where(and(
          eq(salesmanAttendance.userId, userId),
          eq(salesmanAttendance.attendanceDate, today),
          isNull(salesmanAttendance.outTimeTimestamp)
        ))
        .orderBy(desc(salesmanAttendance.inTimeTimestamp))
        .limit(1);

      if (!open) {
        return res.status(404).json({ success: false, error: "No active punch-in record found." });
      }

      const updateData = {
        outTimeTimestamp: new Date(),
        outTimeImageCaptured: !!selfieUrl,
        outTimeImageUrl: selfieUrl ?? null,
        outTimeLatitude: latitude != null ? latitude.toString() : null,
        outTimeLongitude: longitude != null ? longitude.toString() : null,
        outTimeAccuracy: accuracy != null ? accuracy.toString() : null,
        outTimeSpeed: speed != null ? speed.toString() : null,
        outTimeHeading: heading != null ? heading.toString() : null,
        outTimeAltitude: altitude != null ? altitude.toString() : null,
        updatedAt: new Date()
      };

      const [updated] = await db
        .update(salesmanAttendance)
        .set(updateData)
        .where(eq(salesmanAttendance.id, open.id))
        .returning();

      return res.json({ success: true, data: updated, message: "Punch-out recorded." });
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message || "Punch-out failed" });
    }
  });

}

