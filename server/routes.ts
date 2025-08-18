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
import PureRAGService from 'server/bot/aiService';
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
const OFFICE_LOCATIONS = [
  {
    name: "Head Office",
    lat: 26.1200853,
    lng: 91.7955807,
    radius: 100,
    polygon: turf.circle([91.7955807, 26.1200853], 0.1, { units: 'kilometers' })
  }
];

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

  // ==================== AI/RAG ROUTES (EXISTING) ====================
  // ==================== IMPROVED RAG ENDPOINTS ====================
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

      // Process with improved RAG service
      const aiResponse = await PureRAGService.chat(messages, userId);

      res.json({
        success: true,
        message: aiResponse,
        timestamp: new Date().toISOString(),
        userId: userId,
        messageCount: messages.length
      });
    } catch (error) {
      console.error('RAG Chat error:', error);
      res.status(500).json({
        success: false,
        error: 'RAG chat processing failed. Please try again.',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

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

      // Extract structured data using improved service
      const extracted = await PureRAGService.extractStructuredData(messages, userId);

      if (!extracted || extracted.error) {
        return res.status(400).json({
          success: false,
          error: extracted?.error || 'Unable to extract sufficient data from conversation. Please provide more details.',
          suggestion: 'Try providing specific information like dealer name, location, visit type, etc.'
        });
      }

      // Enhanced submission with proper endpoint routing
      let submitResult;
      const baseUrl = process.env.BASE_URL || 'https://telesalesside.onrender.com';

      if (extracted.endpoint === '/api/dvr') {
        console.log('🎯 Submitting to auto-CRUD DVR endpoint with data:', extracted.data);

        const response = await fetch(`${baseUrl}/api/dvr`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'RAG-Service/1.0'
          },
          body: JSON.stringify({ userId: userId, ...extracted.data })
        });

        if (!response.ok) {
          const errorData = await response.json();
          return res.status(response.status).json({
            success: false,
            error: `Daily Visit Report submission failed: ${errorData.error || 'Validation error'}`,
            details: errorData.details || {},
            endpoint: extracted.endpoint,
            validationErrors: errorData.details || []
          });
        }

        submitResult = await response.json();

      } else if (extracted.endpoint === '/api/tvr') {
        console.log('🔧 Submitting to auto-CRUD TVR endpoint with data:', extracted.data);

        const response = await fetch(`${baseUrl}/api/tvr`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'RAG-Service/1.0'
          },
          body: JSON.stringify({ userId: userId, ...extracted.data })
        });

        if (!response.ok) {
          const errorData = await response.json();
          return res.status(response.status).json({
            success: false,
            error: `Technical Visit Report submission failed: ${errorData.error || 'Validation error'}`,
            details: errorData.details || {},
            endpoint: extracted.endpoint,
            validationErrors: errorData.details || []
          });
        }

        submitResult = await response.json();

      } else {
        return res.status(400).json({
          success: false,
          error: `Unsupported endpoint: ${extracted.endpoint}`,
          supportedEndpoints: ['/api/dvr', '/api/tvr'],
          suggestion: 'Please specify if this is a Daily Visit Report (DVR) or Technical Visit Report (TVR)'
        });
      }

      // Enhanced success response
      const reportType = extracted.endpoint === '/api/dvr' ? 'Daily Visit Report' : 'Technical Visit Report';

      res.json({
        success: true,
        endpoint: extracted.endpoint,
        recordId: submitResult.data?.id,
        data: submitResult.data,
        message: `✅ Successfully submitted ${reportType}!`,
        submissionDetails: {
          reportType,
          recordId: submitResult.data?.id,
          submittedAt: new Date().toISOString(),
          userId: userId,
          fieldsSubmitted: Object.keys(extracted.data || {}).length
        }
      });
    } catch (error) {
      console.error('RAG Submit error:', error);
      res.status(500).json({
        success: false,
        error: 'RAG submission processing failed. Please try again.',
        details: error instanceof Error ? error.message : 'Unknown error',
        suggestion: 'Check your data format and try submitting again'
      });
    }
  });

  app.post('/api/ai/chat', async (req: Request, res: Response) => {
    try {
      const { message, userId, context }: {
        message: string,
        userId: number,
        context?: any
      } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Message is required and must be a string'
        });
      }

      if (!userId || typeof userId !== 'number') {
        return res.status(400).json({
          success: false,
          error: 'UserId is required and must be a number'
        });
      }

      console.log(`🎭 AI Orchestration request from user ${userId}: "${message.substring(0, 50)}..."`);

      const orchestrationResult = await PureRAGService.orchestrateAI(message, userId, context || {});

      if (!orchestrationResult.success) {
        return res.status(500).json({
          success: false,
          error: orchestrationResult.error || 'Orchestration failed',
          executedSteps: orchestrationResult.executedSteps
        });
      }

      res.json({
        success: true,
        message: orchestrationResult.finalResponse,
        executedSteps: orchestrationResult.executedSteps,
        orchestrationData: {
          stepsCount: orchestrationResult.executedSteps.length,
          toolsUsed: orchestrationResult.executedSteps.map(step => step.type)
        }
      });

    } catch (error) {
      console.error('❌ AI Orchestration error:', error);
      res.status(500).json({
        success: false,
        error: 'AI orchestration failed. Try again.'
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

  app.post('/api/attendance/punch-in', async (req: Request, res: Response) => {
    try {
      // Validate input against schema expectations
      const { userId, latitude, longitude, locationName, accuracy, selfieUrl } = req.body;

      if (!userId || !latitude || !longitude) {
        return res.status(400).json({
          success: false,
          error: 'userId, latitude, and longitude are required'
        });
      }

      // Geo-fencing validation
      const userPoint = turf.point([longitude, latitude]);
      let isValid = false;
      let officeName = '';

      for (const office of OFFICE_LOCATIONS) {
        if (turf.booleanPointInPolygon(userPoint, office.polygon)) {
          isValid = true;
          officeName = office.name;
          break;
        }
      }

      if (!isValid) {
        return res.status(400).json({
          success: false,
          error: 'You are not within office premises'
        });
      }

      const today = new Date().toISOString().split('T')[0];

      // Build data matching exact schema
      const attendanceData = {
        userId: parseInt(userId), // integer type
        attendanceDate: today, // date type
        locationName: locationName || officeName, // varchar not null
        inTimeTimestamp: new Date(), // timestamp not null
        inTimeImageCaptured: !!selfieUrl, // boolean not null
        outTimeImageCaptured: false, // boolean not null  
        inTimeImageUrl: selfieUrl || null, // varchar nullable
        inTimeLatitude: latitude.toString(), // decimal as string
        inTimeLongitude: longitude.toString(), // decimal as string
        inTimeAccuracy: accuracy ? accuracy.toString() : null, // decimal nullable
        // All other nullable fields will be null by default
      };

      // Validate against schema
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
        message: `Punched in at ${officeName}`,
        geoInfo: { officeName, isValid }
      });
    } catch (error) {
      console.error('Punch in error:', error);
      res.status(500).json({ success: false, error: 'Punch in failed' });
    }
  });

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

      // Find unpunched record
      const [unpunchedRecord] = await db.select().from(salesmanAttendance)
        .where(and(
          eq(salesmanAttendance.userId, parseInt(userId)),
          eq(salesmanAttendance.attendanceDate, today),
          isNull(salesmanAttendance.outTimeTimestamp)
        ))
        .orderBy(desc(salesmanAttendance.inTimeTimestamp))
        .limit(1);

      if (unpunchedRecord) {
        // Update with proper data types
        const updateData = {
          outTimeTimestamp: new Date(), // timestamp
          outTimeImageCaptured: !!selfieUrl, // boolean
          outTimeImageUrl: selfieUrl || null, // varchar nullable
          outTimeLatitude: latitude ? latitude.toString() : null, // decimal nullable
          outTimeLongitude: longitude ? longitude.toString() : null, // decimal nullable
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
}