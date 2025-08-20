// routes.ts - COMPLETE IMPLEMENTATION WITH AUTO-CRUD
import { Express, Request, Response } from 'express';
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
import axios from "axios";
import { telegramBot } from './bot/telegram';

const RADAR_SECRET_KEY = process.env.RADAR_SECRET_KEY;
const RADAR_PUBLISHABLE_KEY = process.env.RADAR_PUBLISHABLE_KEY;

// Internal function for geocoding address
async function geocodeAddress(address: string) {
  const response = await fetch(`https://api.radar.io/v1/geocode/forward?query=${encodeURIComponent(address)}`, {
    headers: {
      'Authorization': RADAR_PUBLISHABLE_KEY
    }
  });
  if (!response.ok) {
    throw new Error('Geocoding failed');
  }
  const data = await response.json();

  if (!data.addresses || data.addresses.length === 0) {
    throw new Error('Address not found');
  }
  const address_result = data.addresses[0];
  return {
    latitude: address_result.latitude,
    longitude: address_result.longitude,
    confidence: address_result.confidence,
    formattedAddress: address_result.formattedAddress
  };
}
export async function reverseGeocode(latitude: number, longitude: number) {
  try {
    const resp = await axios.get("https://api.radar.io/v1/geocode/reverse", {
      params: { coordinates: `${latitude},${longitude}` },
      headers: { Authorization: RADAR_PUBLISHABLE_KEY }
    });

    if (resp.data?.addresses?.length > 0) {
      const addr = resp.data.addresses[0];
      return addr.formattedAddress || addr.addressLabel || null;
    }
    return null;
  } catch (err) {
    console.error("Reverse geocode failed:", err.message);
    return null;
  }
}

// Internal function for creating office geofence
export async function createOfficeGeofence(companyId: number) {
  try {
    // Get company data from database
    const company = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);

    if (company.length === 0) {
      throw new Error('Company not found');
    }
    const companyData = company[0];
    // Geocode the office address
    const geocoded = await geocodeAddress(companyData.officeAddress);
    // Create geofence in Radar
    const geofenceResponse = await fetch(`https://api.radar.io/v1/geofences/office/${companyId}`, {
      method: 'PUT',
      headers: {
        'Authorization': RADAR_SECRET_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        description: `${companyData.companyName} Office`,
        type: 'circle',
        coordinates: [geocoded.longitude, geocoded.latitude], // Note: longitude first!
        radius: 100, // 100 meters default
        tag: 'office',
        externalId: companyId.toString(),
        enabled: true,
        operatingHours: {
          Monday: [["09:00", "18:00"]],
          Tuesday: [["09:00", "18:00"]],
          Wednesday: [["09:00", "18:00"]],
          Thursday: [["09:00", "18:00"]],
          Friday: [["09:00", "18:00"]]
        },
        metadata: {
          companyName: companyData.companyName,
          region: companyData.region || '',
          area: companyData.area || ''
        }
      })
    });
    if (!geofenceResponse.ok) {
      const errorData = await geofenceResponse.json();
      throw new Error(`Geofence creation failed: ${errorData.meta?.message || 'Unknown error'}`);
    }
    const geofenceData = await geofenceResponse.json();
    return {
      success: true,
      geofence: geofenceData.geofence,
      geocoded: geocoded,
      company: companyData
    };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Unknown error');
  }
}

// Internal function for validating location
export async function validateLocationInOffice(latitude: number, longitude: number, companyId: number | string) {
  try {
    const response = await fetch(`https://api.radar.io/v1/geofences/match`, {
      method: "POST",
      headers: {
        "Authorization": RADAR_SECRET_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        latitude,
        longitude,
        tags: ["office"],
        externalId: String(companyId), // 🔑 force it to string
      })
    });

    if (!response.ok) {
      throw new Error(`Radar validation failed: ${response.status}`);
    }

    const data = await response.json();

    return {
      isInside: data.matchedGeofences.length > 0,
      matchedGeofences: data.matchedGeofences,
      officeName: data.matchedGeofences[0]?.description || null,
      distance: data.matchedGeofences[0]?.distance || null,
      radius: data.matchedGeofences[0]?.geometryRadius || null,
    };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Location validation failed");
  }
}


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

      // ✅ ADD THIS CHECK RIGHT HERE - BEFORE THE PROBLEMATIC LINE
      if (endpoint === 'dealer-reports-scores') {
        // Special handling for dealer reports - join with dealers table
        const records = await db.select({
          id: dealerReportsAndScores.id,
          dealerId: dealerReportsAndScores.dealerId,
          dealerScore: dealerReportsAndScores.dealerScore,
          trustWorthinessScore: dealerReportsAndScores.trustWorthinessScore,
          creditWorthinessScore: dealerReportsAndScores.creditWorthinessScore,
          orderHistoryScore: dealerReportsAndScores.orderHistoryScore,
          visitFrequencyScore: dealerReportsAndScores.visitFrequencyScore,
          lastUpdatedDate: dealerReportsAndScores.lastUpdatedDate,
          createdAt: dealerReportsAndScores.createdAt,
          updatedAt: dealerReportsAndScores.updatedAt,
        })
          .from(dealerReportsAndScores)
          .innerJoin(dealers, eq(dealerReportsAndScores.dealerId, dealers.id))
          .where(eq(dealers.userId, parseInt(userId)))
          .orderBy(desc(dealerReportsAndScores.lastUpdatedDate))
          .limit(parseInt(limit as string));

        return res.json({ success: true, data: records });
      }

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

  // ===========USER INFO ENDPOINT to GET COMPANY ID==============
  // Get user profile with company info
  app.get('/api/users/:userId', async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);

      // Query your users table to get companyId
      const user = await db.select({
        id: users.id,
        companyId: users.companyId,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        region: users.region,
        area: users.area
      })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (user.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      res.json({
        success: true,
        data: user[0]
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
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
  // GEOFENCING ENDPOINTS for OFFICE creations and SO ON
  // ============================================

  // HTTP Endpoint: Create office geofence (for frontend)
  app.post('/create-office', async (req, res) => {
    try {
      const { companyId } = req.body;
      if (!companyId) {
        return res.status(400).json({
          success: false,
          error: 'Company ID is required'
        });
      }
      const result = await createOfficeGeofence(companyId);
      res.json({
        success: true,
        message: 'Office geofence created successfully',
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  // HTTP Endpoint: Validate location (for frontend)
  app.post('/validate-location', async (req, res) => {
    try {
      const { companyId, latitude, longitude } = req.body;
      if (!companyId || !latitude || !longitude) {
        return res.status(400).json({
          success: false,
          error: 'Company ID, latitude, and longitude are required'
        });
      }
      const result = await validateLocationInOffice(companyId, latitude, longitude);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  // HTTP Endpoint: Get office geofence info
  app.get('/office/:companyId', async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      const response = await fetch(`https://api.radar.io/v1/geofences/office/${companyId}`, {
        headers: {
          'Authorization': RADAR_SECRET_KEY
        }
      });
      if (!response.ok) {
        if (response.status === 404) {
          return res.status(404).json({
            success: false,
            error: 'Office geofence not found'
          });
        }
        throw new Error('Failed to get geofence');
      }
      const data = await response.json();
      res.json({
        success: true,
        data: data.geofence
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.delete('/office/:companyId', async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);

      const response = await fetch(`https://api.radar.io/v1/geofences/office/${companyId}`, {
        method: 'DELETE',
        headers: { 'Authorization': RADAR_SECRET_KEY }
      });

      if (!response.ok) {
        throw new Error('Failed to delete geofence');
      }

      res.json({ success: true, message: 'Office geofence deleted successfully' });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });


  app.post('/geocode-address', async (req, res) => {
    try {
      const { address } = req.body;
      if (!address) {
        return res.status(400).json({ success: false, error: 'Address is required' });
      }
      const result = await geocodeAddress(address);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/reverse-geocode', async (req, res) => {
    try {
      const { latitude, longitude } = req.body;
      if (!latitude || !longitude) {
        return res.status(400).json({ success: false, error: 'Latitude and longitude are required' });
      }

      const response = await fetch(`https://api.radar.io/v1/geocode/reverse?coordinates=${latitude},${longitude}`, {
        headers: { 'Authorization': RADAR_PUBLISHABLE_KEY }
      });

      if (!response.ok) {
        throw new Error('Reverse geocoding failed');
      }

      const data = await response.json();
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
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

  app.post('/api/attendance/punch-in', async (req: Request, res: Response) => {
    try {
      const { userId, latitude, longitude, accuracy, selfieUrl, companyId } = req.body;

      if (!userId || !latitude || !longitude || !companyId) {
        return res.status(400).json({ success: false, error: "userId, companyId, latitude, and longitude are required" });
      }

      // ✅ geofence validation with correct argument order
      const geoResult = await validateLocationInOffice(
        parseFloat(latitude),
        parseFloat(longitude),
        String(companyId)
      );

      if (!geoResult.isInside) {
        return res.status(400).json({
          success: false,
          error: "Location not within valid office geofence",
          distance: geoResult.distance,
          radius: geoResult.radius
        });
      }

      // ✅ reverse geocode for pretty address
      const formattedAddress = await reverseGeocode(
        parseFloat(latitude),
        parseFloat(longitude)
      );

      const now = new Date();
      const attendanceData = {
        userId: parseInt(userId),
        attendanceDate: now, // DB will cast to DATE
        locationName: geoResult.officeName || formattedAddress || "Mobile App",
        inTimeTimestamp: now,
        inTimeImageCaptured: !!selfieUrl,
        outTimeImageCaptured: false,
        inTimeImageUrl: selfieUrl || null,
        inTimeLatitude: parseFloat(latitude),
        inTimeLongitude: parseFloat(longitude),
        inTimeAccuracy: accuracy ? parseFloat(accuracy) : null
      };

      const validated = insertSalesmanAttendanceSchema.safeParse(attendanceData);
      if (!validated.success) {
        return res.status(400).json({ success: false, error: validated.error.errors });
      }

      const [result] = await db.insert(salesmanAttendance).values(validated.data).returning();

      res.json({ success: true, data: result, message: "Punched in successfully" });
    } catch (error) {
      console.error("Punch in error:", error);
      res.status(500).json({ success: false, error: "Punch in failed" });
    }
  });


  app.post('/api/attendance/punch-out', async (req: Request, res: Response) => {
    try {
      const { userId, latitude, longitude, accuracy, selfieUrl, companyId } = req.body;

      if (!userId) {
        return res.status(400).json({ success: false, error: "userId is required" });
      }

      const today = new Date().toISOString().split("T")[0];

      const [unpunchedRecord] = await db.select().from(salesmanAttendance)
        .where(and(
          eq(salesmanAttendance.userId, parseInt(userId)),
          eq(salesmanAttendance.attendanceDate, today),
          isNull(salesmanAttendance.outTimeTimestamp)
        ))
        .orderBy(desc(salesmanAttendance.inTimeTimestamp))
        .limit(1);

      if (!unpunchedRecord) {
        return res.status(404).json({ success: false, error: "No active punch-in record found" });
      }

      let formattedAddress: string | null = null;

      if (latitude && longitude && companyId) {
        // ✅ Optional: also validate geofence on punch-out
        const geoResult = await validateLocationInOffice(
          parseFloat(latitude),
          parseFloat(longitude),
          String(companyId)
        );

        if (!geoResult.isInside) {
          return res.status(400).json({
            success: false,
            error: "Punch-out location not within valid office geofence",
            distance: geoResult.distance,
            radius: geoResult.radius
          });
        }

        formattedAddress = await reverseGeocode(parseFloat(latitude), parseFloat(longitude));
      }

      const updateData = {
        outTimeTimestamp: new Date(),
        outTimeImageCaptured: !!selfieUrl,
        outTimeImageUrl: selfieUrl || null,
        outTimeLatitude: latitude ? parseFloat(latitude) : null,
        outTimeLongitude: longitude ? parseFloat(longitude) : null,
        outTimeAccuracy: accuracy ? parseFloat(accuracy) : null,
        locationName: formattedAddress || unpunchedRecord.locationName || "Mobile App",
        updatedAt: new Date()
      };

      const [result] = await db.update(salesmanAttendance)
        .set(updateData)
        .where(eq(salesmanAttendance.id, unpunchedRecord.id))
        .returning();

      res.json({ success: true, data: result, message: "Punched out successfully" });
    } catch (error) {
      console.error("Punch out error:", error);
      res.status(500).json({ success: false, error: "Punch out failed" });
    }
  });



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

        // ✅ FIXED LINE - using proper date filtering instead of like()
        db.select({ count: sql<number>`cast(count(*) as int)` })
          .from(dailyVisitReports)
          .where(and(
            eq(dailyVisitReports.userId, userId),
            sql`date_trunc('month', ${dailyVisitReports.reportDate}) = ${currentMonth + '-01'}::date`
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
}