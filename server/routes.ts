// routes.ts - ENHANCED WITH SMART RADAR.IO INTEGRATION
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
import { ChatMessage } from 'server/bot/aiService';
// ✅ Import services
import EnhancedRAGService from './bot/aiService';
// 🎯 Smart Radar integration - no more hardcoded locations!
import { radarService } from 'server/services/RadarService';

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

// ============================================
// 🎯 SMART OFFICE VALIDATION (RADAR-POWERED)
// ============================================
async function validateOfficeLocation(userId: string, latitude: number, longitude: number) {
  try {
    // Use Radar's intelligent geofencing instead of hardcoded coordinates
    const validation = await radarService.validateAttendanceLocation(
      userId,
      latitude,
      longitude,
      'office' // Use office geofences created in Radar
    );

    return {
      isValid: validation.isValid,
      officeName: validation.events?.find(e => e.type === 'user.entered_geofence')?.geofence?.description || 'Office',
      confidence: validation.confidence,
      fraudDetected: validation.fraudDetected,
      distance: validation.distance,
      events: validation.events
    };
  } catch (error) {
    console.error('Smart office validation failed:', error);
    return { 
      isValid: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      officeName: 'Unknown Office'
    };
  }
}

// ============================================
// 🚀 ENHANCED AUTO-CRUD WITH RADAR.IO INTEGRATION
// ============================================
function createAutoCRUD(app: Express, config: {
  endpoint: string,
  table: any,
  schema: z.ZodSchema,
  tableName: string,
  autoFields?: { [key: string]: () => any },
  dateField?: string,
  // 🎯 Radar integration based on exact schema
  locationConfig?: {
    enabled: boolean,
    // Schema-specific field mapping
    latField?: string,    // 'latitude' for DVR, 'inTimeLatitude' for attendance
    lngField?: string,    // 'longitude' for DVR, 'inTimeLongitude' for attendance  
    locationField?: string, // 'location' for DVR, 'locationName' for attendance
    // Radar features
    createGeofence?: boolean,
    validateLocation?: boolean,
    trackLocation?: boolean,
    geofenceTag?: string,
    geofenceRadius?: number,
    requireLocationValidation?: boolean,
    dealerIdField?: string  // field that contains dealer ID for validation
  }
}) {
  const { endpoint, table, schema, tableName, autoFields = {}, dateField, locationConfig } = config;

  // CREATE - with Radar integration
  app.post(`/api/${endpoint}`, async (req: Request, res: Response) => {
    try {
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

      let validatedData = parseResult.data;

      // 🎯 RADAR INTEGRATION based on exact schema fields
      if (locationConfig?.enabled) {
        const latField = locationConfig.latField || 'latitude';
        const lngField = locationConfig.lngField || 'longitude';
        const locationField = locationConfig.locationField || 'location';

        const lat = validatedData[latField];
        const lng = validatedData[lngField];

        if (lat && lng) {
          
          // 1. Location validation for dealer visits
          if (locationConfig.validateLocation && locationConfig.dealerIdField) {
            const dealerId = validatedData[locationConfig.dealerIdField];
            if (dealerId && validatedData.userId) {
              try {
                const validation = await radarService.validateAttendanceLocation(
                  validatedData.userId.toString(),
                  parseFloat(lat.toString()),
                  parseFloat(lng.toString()),
                  dealerId.toString()
                );

                if (locationConfig.requireLocationValidation && !validation.isValid) {
                  return res.status(400).json({
                    success: false,
                    error: 'Location validation failed - not within valid geofence area',
                    details: {
                      distance: validation.distance,
                      fraudDetected: validation.fraudDetected,
                      confidence: validation.confidence,
                      suggestion: 'Move closer to the dealer location'
                    }
                  });
                }

                // Add validation results to response metadata
                validatedData.locationValidated = validation.isValid;
                validatedData.locationConfidence = validation.confidence;
              } catch (error) {
                console.warn('Radar location validation failed:', error);
              }
            }
          }

          // 2. Reverse geocode for address if location field exists but is empty
          if (locationField && !validatedData[locationField]) {
            try {
              const geocodeResult = await radarService.reverseGeocode(
                parseFloat(lat.toString()),
                parseFloat(lng.toString())
              );
              if (geocodeResult.addresses?.[0]?.formattedAddress) {
                validatedData[locationField] = geocodeResult.addresses[0].formattedAddress;
              }
            } catch (error) {
              console.warn('Reverse geocoding failed:', error);
            }
          }

          // 3. Track location in Radar
          if (locationConfig.trackLocation && validatedData.userId) {
            try {
              await radarService.trackUserLocation(
                validatedData.userId.toString(),
                parseFloat(lat.toString()),
                parseFloat(lng.toString()),
                {
                  metadata: {
                    action: `create_${endpoint}`,
                    recordType: tableName,
                    timestamp: new Date().toISOString()
                  }
                }
              );
            } catch (error) {
              console.warn('Location tracking failed:', error);
            }
          }
        }
      }

      // Apply auto-generated fields
      const finalData = { ...validatedData };
      Object.entries(autoFields).forEach(([field, generator]) => {
        if (finalData[field] === undefined || finalData[field] === null) {
          finalData[field] = generator();
        }
      });

      // Handle timestamps
      if (table.createdAt && !finalData.createdAt) {
        finalData.createdAt = new Date();
      }
      if (table.updatedAt && !finalData.updatedAt) {
        finalData.updatedAt = new Date();
      }

      const newRecord = await db.insert(table).values(finalData).returning();

      // 🎯 POST-CREATE: Geofence creation for relevant records
      if (locationConfig?.createGeofence && newRecord[0]) {
        const record = newRecord[0];
        const latField = locationConfig.latField || 'latitude';
        const lngField = locationConfig.lngField || 'longitude';
        
        if (record[latField] && record[lngField]) {
          try {
            await radarService.createDealerGeofence({
              externalId: record.id,
              description: record.name || record.dealerName || `${tableName} ${record.id}`,
              tag: locationConfig.geofenceTag || endpoint,
              latitude: parseFloat(record[latField].toString()),
              longitude: parseFloat(record[lngField].toString()),
              radius: locationConfig.geofenceRadius || 100,
              metadata: {
                recordType: tableName,
                createdAt: new Date().toISOString()
              }
            });
          } catch (error) {
            console.warn('Geofence creation failed:', error);
          }
        }
      }

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

  // GET ALL by User ID - with optional location context
  app.get(`/api/${endpoint}/user/:userId`, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { startDate, endDate, limit = '50', completed, lat, lng, ...filters } = req.query;

      let whereCondition = eq(table.userId, parseInt(userId));

      if (startDate && endDate && dateField && table[dateField]) {
        whereCondition = and(
          whereCondition,
          gte(table[dateField], startDate as string),
          lte(table[dateField], endDate as string)
        );
      }

      if (completed === 'true' && table.status) {
        whereCondition = and(whereCondition, eq(table.status, 'completed'));
      }

      Object.entries(filters).forEach(([key, value]) => {
        if (value && table[key]) {
          whereCondition = and(whereCondition, eq(table[key], value));
        }
      });

      const orderField = table[dateField] || table.createdAt || table.updatedAt;
      const records = await db.select().from(table)
        .where(whereCondition)
        .orderBy(desc(orderField))
        .limit(parseInt(limit as string));

      // 🎯 Optional location context from Radar
      let locationContext = null;
      if (locationConfig?.enabled && lat && lng) {
        try {
          const tracking = await radarService.checkApproachingDealer(
            userId,
            parseFloat(lat as string),
            parseFloat(lng as string)
          );
          locationContext = {
            isApproaching: tracking.isApproaching,
            hasArrived: tracking.hasArrived,
            distance: tracking.distance,
            eta: tracking.eta
          };
        } catch (error) {
          console.warn('Location context failed:', error);
        }
      }

      res.json({ 
        success: true, 
        data: records,
        locationContext,
        count: records.length
      });

    } catch (error) {
      console.error(`Get ${tableName}s error:`, error);
      res.status(500).json({
        success: false,
        error: `Failed to fetch ${tableName}s`,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET BY ID
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

  // UPDATE - with location tracking on updates
  app.put(`/api/${endpoint}/:id`, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
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

      let validatedData = parseResult.data;

      // 🎯 Track location updates
      if (locationConfig?.trackLocation && locationConfig?.enabled) {
        const latField = locationConfig.latField || 'latitude';
        const lngField = locationConfig.lngField || 'longitude';
        
        if (validatedData[latField] && validatedData[lngField] && validatedData.userId) {
          try {
            await radarService.trackUserLocation(
              validatedData.userId.toString(),
              parseFloat(validatedData[latField].toString()),
              parseFloat(validatedData[lngField].toString()),
              {
                metadata: {
                  action: `update_${endpoint}`,
                  recordId: id,
                  recordType: tableName,
                  timestamp: new Date().toISOString()
                }
              }
            );
          } catch (error) {
            console.warn('Location tracking on update failed:', error);
          }
        }
      }

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

      if (user.status !== 'active') {
        return res.status(401).json({ error: 'Account is not active' });
      }

      if (user.hashedPassword !== password) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

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
  app.post('/api/rag/chat', async (req: Request, res: Response) => {
    try {
      const { messages, userId }: { messages: ChatMessage[], userId?: number } = req.body;

      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Messages must be a non-empty array'
        });
      }

      for (const msg of messages) {
        if (!msg.role || !msg.content || !['user', 'assistant', 'system'].includes(msg.role)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid message format. Each message must have role (user/assistant/system) and content.'
          });
        }
      }

      const aiResponse = await EnhancedRAGService.chat(messages, userId);

      res.json({
        success: true,
        message: aiResponse,
        timestamp: new Date().toISOString(),
        userId: userId,
        messageCount: messages.length,
        enhanced: true
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

  app.post('/api/rag/submit', async (req: Request, res: Response) => {
    try {
      const { messages, userId }: { messages: ChatMessage[], userId: number } = req.body;

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

      for (const msg of messages) {
        if (!msg.role || !msg.content || !['user', 'assistant', 'system'].includes(msg.role)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid message format in conversation history'
          });
        }
      }

      console.log(`📋 Enhanced data extraction for user ${userId}`);

      const extracted = await EnhancedRAGService.extractStructuredData(messages, userId);

      if (!extracted || extracted.error) {
        return res.status(400).json({
          success: false,
          error: extracted?.error || 'Unable to extract sufficient data from conversation.',
          suggestion: 'Try providing specific information like dealer name, location, visit type, etc.',
          vectorSearch: true
        });
      }

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

  app.get('/api/rag/health', async (req: Request, res: Response) => {
    try {
      res.json({
        success: true,
        status: 'Enhanced RAG System Online',
        features: {
          vectorSearch: true,
          directExecution: true,
          autoCrudIntegration: true,
          radarIntegration: true,
          smartOfficeValidation: true,
          uiAwareness: true
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        status: 'RAG System Degraded',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ============================================
  // 🚀 ENHANCED AUTO-CRUD ROUTES WITH RADAR INTEGRATION
  // ============================================

  // 1. ✅ AUTO-CRUD: Daily Visit Reports - with dealer location validation
  createAutoCRUD(app, {
    endpoint: 'dvr',
    table: dailyVisitReports,
    schema: insertDailyVisitReportSchema,
    tableName: 'Daily Visit Report',
    dateField: 'reportDate',
    autoFields: {
      reportDate: () => new Date().toISOString().split('T')[0],
      checkInTime: () => new Date()
    },
    locationConfig: {
      enabled: true,
      latField: 'latitude',       // matches your schema
      lngField: 'longitude',      // matches your schema  
      locationField: 'location',  // matches your schema
      validateLocation: true,
      requireLocationValidation: true,
      trackLocation: true,
      dealerIdField: 'dealerName',
      geofenceTag: 'dealer'
    }
  });

  // 2. ✅ AUTO-CRUD: Technical Visit Reports - with location tracking
  createAutoCRUD(app, {
    endpoint: 'tvr',
    table: technicalVisitReports,
    schema: insertTechnicalVisitReportSchema,
    tableName: 'Technical Visit Report',
    dateField: 'reportDate',
    autoFields: {
      reportDate: () => new Date().toISOString().split('T')[0],
      checkInTime: () => new Date()
    },
    locationConfig: {
      enabled: true,
      trackLocation: true,
      geofenceTag: 'technical_visit'
    }
  });

  // 3. ✅ AUTO-CRUD: Permanent Journey Plans - basic tracking
  createAutoCRUD(app, {
    endpoint: 'pjp',
    table: permanentJourneyPlans,
    schema: insertPermanentJourneyPlanSchema,
    tableName: 'Permanent Journey Plan',
    dateField: 'planDate',
    autoFields: {
      planDate: () => new Date().toISOString().split('T')[0],
      status: () => 'planned'
    }
  });

  // 4. ✅ AUTO-CRUD: Dealers - with address geocoding
  createAutoCRUD(app, {
    endpoint: 'dealers',
    table: dealers,
    schema: insertDealerSchema,
    tableName: 'Dealer',
    locationConfig: {
      enabled: true,
      locationField: 'address',
      // Note: Enable geofence creation when adding lat/lng fields to dealer schema
      createGeofence: false,
      geofenceTag: 'dealer'
    }
  });

  // 5. ✅ AUTO-CRUD: Daily Tasks - basic functionality
  createAutoCRUD(app, {
    endpoint: 'daily-tasks',
    table: dailyTasks,
    schema: insertDailyTaskSchema,
    tableName: 'Daily Task',
    dateField: 'taskDate',
    autoFields: {
      taskDate: () => new Date().toISOString().split('T')[0],
      status: () => 'Assigned'
    }
  });

  // 6. ✅ AUTO-CRUD: Leave Applications - basic functionality
  createAutoCRUD(app, {
    endpoint: 'leave-applications',
    table: salesmanLeaveApplications,
    schema: insertSalesmanLeaveApplicationSchema,
    tableName: 'Leave Application',
    dateField: 'startDate',
    autoFields: {
      status: () => 'Pending'
    }
  });

  // 7. ✅ AUTO-CRUD: Client Reports - basic functionality
  createAutoCRUD(app, {
    endpoint: 'client-reports',
    table: clientReports,
    schema: insertClientReportSchema,
    tableName: 'Client Report'
  });

  // 8. ✅ AUTO-CRUD: Competition Reports - basic functionality
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

  // 9. ✅ AUTO-CRUD: Geo Tracking - comprehensive location tracking
  createAutoCRUD(app, {
    endpoint: 'geo-tracking',
    table: geoTracking,
    schema: insertGeoTrackingSchema,
    tableName: 'Geo Tracking',
    dateField: 'recordedAt',
    locationConfig: {
      enabled: true,
      latField: 'latitude',
      lngField: 'longitude',
      trackLocation: true,
      geofenceTag: 'tracking'
    }
  });

  // 10. ✅ AUTO-CRUD: Dealer Reports and Scores - basic functionality
  createAutoCRUD(app, {
    endpoint: 'dealer-reports-scores',
    table: dealerReportsAndScores,
    schema: insertDealerReportsAndScoresSchema,
    tableName: 'Dealer Report and Score',
    autoFields: {
      lastUpdatedDate: () => new Date()
    }
  });

  // ============================================
  // 🔧 SPECIAL ROUTES (NOT AUTO-CRUD)
  // ============================================

  // 🏢 SMART OFFICE MANAGEMENT (Radar-powered)
  app.post('/api/admin/create-office-geofence', async (req: Request, res: Response) => {
    try {
      const { name, address, latitude, longitude, radius = 100 } = req.body;

      if (!name || !latitude || !longitude) {
        return res.status(400).json({
          success: false,
          error: 'Name, latitude, and longitude are required'
        });
      }

      const geofence = await radarService.createDealerGeofence({
        externalId: `office_${Date.now()}`,
        description: name,
        tag: 'office',
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        radius,
        metadata: {
          type: 'office',
          address,
          createdAt: new Date().toISOString()
        }
      });

      res.json({
        success: true,
        data: geofence,
        message: `Office geofence "${name}" created successfully`
      });
    } catch (error) {
      console.error('Create office geofence error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create office geofence'
      });
    }
  });

  app.get('/api/admin/office-locations', async (req: Request, res: Response) => {
    try {
      const offices = await radarService.listGeofences('office', 50);
      
      res.json({
        success: true,
        data: offices.geofences || [],
        count: offices.geofences?.length || 0
      });
    } catch (error) {
      console.error('List office locations error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch office locations'
      });
    }
  });

  // 👤 ATTENDANCE ROUTES (Custom Logic - Smart Radar validation)
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

  // 🎯 SMART PUNCH-IN (Radar-powered office validation)
  app.post('/api/attendance/punch-in', async (req: Request, res: Response) => {
    try {
      const { userId, latitude, longitude, locationName, accuracy, selfieUrl } = req.body;

      if (!userId || !latitude || !longitude) {
        return res.status(400).json({
          success: false,
          error: 'userId, latitude, and longitude are required'
        });
      }

      // 🎯 Smart office validation using Radar (no hardcoded coordinates!)
      const officeValidation = await validateOfficeLocation(
        userId.toString(),
        latitude,
        longitude
      );

      if (!officeValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Not within office premises',
          details: {
            distance: officeValidation.distance,
            fraudDetected: officeValidation.fraudDetected,
            confidence: officeValidation.confidence,
            suggestion: 'Move closer to your office location'
          }
        });
      }

      const today = new Date().toISOString().split('T')[0];

      const attendanceData = {
        userId: parseInt(userId),
        attendanceDate: today,
        locationName: locationName || officeValidation.officeName,
        inTimeTimestamp: new Date(),
        inTimeImageCaptured: !!selfieUrl,
        outTimeImageCaptured: false,
        inTimeImageUrl: selfieUrl || null,
        inTimeLatitude: latitude.toString(),
        inTimeLongitude: longitude.toString(),
        inTimeAccuracy: accuracy ? accuracy.toString() : null,
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
      
      res.json({
        success: true,
        data: result,
        message: `Punched in at ${officeValidation.officeName}`,
        radarInfo: {
          officeName: officeValidation.officeName,
          confidence: officeValidation.confidence,
          fraudDetected: officeValidation.fraudDetected,
          validated: true
        }
      });
    } catch (error) {
      console.error('Smart punch in error:', error);
      res.status(500).json({ success: false, error: 'Punch in failed' });
    }
  });

  // 🎯 SMART PUNCH-OUT
  app.post('/api/attendance/punch-out', async (req: Request, res: Response) => {
    try {
      const { userId, latitude, longitude, selfieUrl } = req.body;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'userId is required'
        });
      }

      const today = new Date().toISOString().split('T')[0];

      const [unpunchedRecord] = await db.select().from(salesmanAttendance)
        .where(and(
          eq(salesmanAttendance.userId, parseInt(userId)),
          eq(salesmanAttendance.attendanceDate, today),
          isNull(salesmanAttendance.outTimeTimestamp)
        ))
        .orderBy(desc(salesmanAttendance.inTimeTimestamp))
        .limit(1);

      if (unpunchedRecord) {
        const updateData = {
          outTimeTimestamp: new Date(),
          outTimeImageCaptured: !!selfieUrl,
          outTimeImageUrl: selfieUrl || null,
          outTimeLatitude: latitude ? latitude.toString() : null,
          outTimeLongitude: longitude ? longitude.toString() : null,
          updatedAt: new Date()
        };

        const [result] = await db.update(salesmanAttendance)
          .set(updateData)
          .where(eq(salesmanAttendance.id, unpunchedRecord.id))
          .returning();

        res.json({
          success: true,
          data: result,
          message: 'Punched out successfully'
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'No active punch-in record found'
        });
      }
    } catch (error) {
      console.error('Punch out error:', error);
      res.status(500).json({ success: false, error: 'Punch out failed' });
    }
  });

  // 📊 DASHBOARD STATS (Custom aggregation logic)
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
}