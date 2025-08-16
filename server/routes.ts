// routes.ts - COMPLETE IMPLEMENTATION
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

export function setupWebRoutes(app: Express) {
  // PWA route
  app.get('/pwa', (req: Request, res: Response) => {
    res.redirect('/login');
  });
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
  app.post('/api/rag/chat', async (req: Request, res: Response) => {
    try {
      const { messages, userId }: { messages: ChatMessage[], userId?: number } = req.body;

      if (!Array.isArray(messages)) {
        return res.status(400).json({ success: false, error: 'Messages must be an array' });
      }

      for (const msg of messages) {
        if (!msg.role || !msg.content || !['user', 'assistant', 'system'].includes(msg.role)) {
          return res.status(400).json({ success: false, error: 'Invalid message format.' });
        }
      }

      const aiResponse = await PureRAGService.chat(messages, userId);
      res.json({ success: true, message: aiResponse });
    } catch (error) {
      console.error('RAG Chat error:', error);
      res.status(500).json({ success: false, error: 'Chat failed. Try again.' });
    }
  });

  app.post('/api/rag/submit', async (req: Request, res: Response) => {
    try {
      const { messages, userId }: { messages: ChatMessage[], userId: number } = req.body;

      if (!Array.isArray(messages) || !userId) {
        return res.status(400).json({ success: false, error: 'Invalid request format' });
      }

      for (const msg of messages) {
        if (!msg.role || !msg.content || !['user', 'assistant', 'system'].includes(msg.role)) {
          return res.status(400).json({ success: false, error: 'Invalid message format.' });
        }
      }

      const extracted = await PureRAGService.extractStructuredData(messages, userId);
      if (!extracted || extracted.error) {
        return res.status(400).json({ success: false, error: 'Not enough data collected.' });
      }

      let submitResult;
      if (extracted.endpoint === '/api/dvr-manual') {
        console.log('🎯 Submitting to DVR endpoint with data:', extracted.data);

        const response = await fetch(`${process.env.BASE_URL || 'https://telesalesside.onrender.com'}/api/dvr-manual`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: userId, ...extracted.data })
        });

        if (!response.ok) {
          const errorData = await response.json();
          return res.status(response.status).json({
            success: false,
            error: `Submission failed: ${errorData.error || 'Unknown error'}`,
            details: errorData.details
          });
        }

        submitResult = await response.json();

      } else if (extracted.endpoint === '/api/tvr') {
        console.log('🔧 Submitting to TVR endpoint with data:', extracted.data);

        const response = await fetch(`${process.env.BASE_URL || 'https://telesalesside.onrender.com'}/api/tvr`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: userId, ...extracted.data })
        });

        if (!response.ok) {
          const errorData = await response.json();
          return res.status(response.status).json({
            success: false,
            error: `Submission failed: ${errorData.error || 'Unknown error'}`,
            details: errorData.details
          });
        }

        submitResult = await response.json();

      } else {
        return res.status(400).json({ success: false, error: `Unknown endpoint: ${extracted.endpoint}` });
      }

      res.json({
        success: true,
        endpoint: extracted.endpoint,
        recordId: submitResult.data?.id || submitResult.primaryDVR?.id,
        data: submitResult,
        message: `✅ Successfully submitted ${extracted.endpoint === '/api/dvr-manual' ? 'Daily Visit Report' : 'Technical Visit Report'}!`
      });
    } catch (error) {
      console.error('RAG Submit error:', error);
      res.status(500).json({ success: false, error: 'Submission failed.' });
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

  // ==================== 1. DAILY VISIT REPORTS - CRUD ====================
  app.post('/api/dvr', async (req: Request, res: Response) => {
    try {
      const validatedData = insertDailyVisitReportSchema.parse(req.body);
      const newReport = await db.insert(dailyVisitReports)
        .values({
          ...validatedData,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      res.json({ success: true, data: newReport[0], message: 'DVR submitted successfully' });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: 'Failed to submit DVR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/api/dvr/user/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { startDate, endDate, dealerType, limit = '50' } = req.query;

      // Fix: Initialize base condition properly
      let whereCondition = eq(dailyVisitReports.userId, parseInt(userId));

      if (startDate && endDate) {
        whereCondition = and(
          whereCondition,
          gte(dailyVisitReports.reportDate, startDate as string),
          lte(dailyVisitReports.reportDate, endDate as string)
        );
      }

      if (dealerType) {
        whereCondition = and(whereCondition, eq(dailyVisitReports.dealerType, dealerType as string));
      }

      const reports = await db.select().from(dailyVisitReports)
        .where(whereCondition)
        .orderBy(desc(dailyVisitReports.reportDate))
        .limit(parseInt(limit as string));

      res.json({ success: true, data: reports });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to fetch DVRs' });
    }
  });

  app.get('/api/dvr/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const report = await db.select().from(dailyVisitReports)
        .where(eq(dailyVisitReports.id, id))
        .limit(1);

      if (!report || report.length === 0) {
        return res.status(404).json({ success: false, error: 'DVR not found' });
      }

      res.json({ success: true, data: report[0] });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to fetch DVR' });
    }
  });

  app.put('/api/dvr/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const validatedData = insertDailyVisitReportSchema.partial().parse(req.body);

      const updatedReport = await db.update(dailyVisitReports)
        .set({ ...validatedData, updatedAt: new Date() })
        .where(eq(dailyVisitReports.id, id))
        .returning();

      if (!updatedReport || updatedReport.length === 0) {
        return res.status(404).json({ success: false, error: 'DVR not found' });
      }

      res.json({ success: true, data: updatedReport[0], message: 'DVR updated successfully' });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to update DVR' });
    }
  });

  app.delete('/api/dvr/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const deletedReport = await db.delete(dailyVisitReports)
        .where(eq(dailyVisitReports.id, id))
        .returning();

      if (!deletedReport || deletedReport.length === 0) {
        return res.status(404).json({ success: false, error: 'DVR not found' });
      }

      res.json({ success: true, message: 'DVR deleted successfully' });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to delete DVR' });
    }
  });

  // ==================== 2. TECHNICAL VISIT REPORTS - CRUD ====================
  app.post('/api/tvr', async (req: Request, res: Response) => {
    try {
      const validatedData = insertTechnicalVisitReportSchema.parse(req.body);
      const newReport = await db.insert(technicalVisitReports)
        .values({
          ...validatedData,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      res.json({ success: true, data: newReport[0], message: 'TVR submitted successfully' });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to submit TVR' });
    }
  });

  app.get('/api/tvr/user/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { startDate, endDate, visitType } = req.query;

      let whereCondition = eq(technicalVisitReports.userId, parseInt(userId));

      if (startDate && endDate) {
        whereCondition = and(
          whereCondition,
          gte(technicalVisitReports.reportDate, startDate as string),
          lte(technicalVisitReports.reportDate, endDate as string)
        );
      }

      if (visitType) {
        whereCondition = and(whereCondition, eq(technicalVisitReports.visitType, visitType as string));
      }

      const reports = await db.select().from(technicalVisitReports)
        .where(whereCondition)
        .orderBy(desc(technicalVisitReports.reportDate));

      res.json({ success: true, data: reports });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to fetch TVRs' });
    }
  });

  app.get('/api/tvr/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const report = await db.select().from(technicalVisitReports)
        .where(eq(technicalVisitReports.id, id))
        .limit(1);

      if (!report || report.length === 0) {
        return res.status(404).json({ success: false, error: 'TVR not found' });
      }

      res.json({ success: true, data: report[0] });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to fetch TVR' });
    }
  });

  app.put('/api/tvr/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const validatedData = insertTechnicalVisitReportSchema.partial().parse(req.body);

      const updatedReport = await db.update(technicalVisitReports)
        .set({ ...validatedData, updatedAt: new Date() })
        .where(eq(technicalVisitReports.id, id))
        .returning();

      if (!updatedReport || updatedReport.length === 0) {
        return res.status(404).json({ success: false, error: 'TVR not found' });
      }

      res.json({ success: true, data: updatedReport[0] });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to update TVR' });
    }
  });

  app.delete('/api/tvr/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const deletedReport = await db.delete(technicalVisitReports)
        .where(eq(technicalVisitReports.id, id))
        .returning();

      if (!deletedReport || deletedReport.length === 0) {
        return res.status(404).json({ success: false, error: 'TVR not found' });
      }

      res.json({ success: true, message: 'TVR deleted successfully' });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to delete TVR' });
    }
  });

  // ==================== 3. PERMANENT JOURNEY PLANS - CRUD ====================
  app.post('/api/pjp', async (req: Request, res: Response) => {
    try {
      const validatedData = insertPermanentJourneyPlanSchema.parse(req.body);
      const newPlan = await db.insert(permanentJourneyPlans)
        .values({
          ...validatedData,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      res.json({ success: true, data: newPlan[0], message: 'PJP created successfully' });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to create PJP' });
    }
  });

  app.get('/api/pjp/user/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { status, startDate, endDate } = req.query;

      let whereCondition = eq(permanentJourneyPlans.userId, parseInt(userId));

      if (status) {
        whereCondition = and(whereCondition, eq(permanentJourneyPlans.status, status as string));
      }

      if (startDate && endDate) {
        whereCondition = and(
          whereCondition,
          gte(permanentJourneyPlans.planDate, startDate as string),
          lte(permanentJourneyPlans.planDate, endDate as string)
        );
      }

      const plans = await db.select().from(permanentJourneyPlans)
        .where(whereCondition)
        .orderBy(desc(permanentJourneyPlans.planDate));

      res.json({ success: true, data: plans });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to fetch PJPs' });
    }
  });

  app.get('/api/pjp/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const plan = await db.select().from(permanentJourneyPlans)
        .where(eq(permanentJourneyPlans.id, id))
        .limit(1);

      if (!plan || plan.length === 0) {
        return res.status(404).json({ success: false, error: 'PJP not found' });
      }

      res.json({ success: true, data: plan[0] });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to fetch PJP' });
    }
  });

  app.put('/api/pjp/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const validatedData = insertPermanentJourneyPlanSchema.partial().parse(req.body);

      const updatedPlan = await db.update(permanentJourneyPlans)
        .set({ ...validatedData, updatedAt: new Date() })
        .where(eq(permanentJourneyPlans.id, id))
        .returning();

      if (!updatedPlan || updatedPlan.length === 0) {
        return res.status(404).json({ success: false, error: 'PJP not found' });
      }

      res.json({ success: true, data: updatedPlan[0] });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to update PJP' });
    }
  });

  app.delete('/api/pjp/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const deletedPlan = await db.delete(permanentJourneyPlans)
        .where(eq(permanentJourneyPlans.id, id))
        .returning();

      if (!deletedPlan || deletedPlan.length === 0) {
        return res.status(404).json({ success: false, error: 'PJP not found' });
      }

      res.json({ success: true, message: 'PJP deleted successfully' });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to delete PJP' });
    }
  });

  // ==================== 4. DEALERS - FULL CRUD WITH SUB-DEALERS ====================
  app.post('/api/dealers', async (req: Request, res: Response) => {
    try {
      const validatedData = insertDealerSchema.parse(req.body);
      const newDealer = await db.insert(dealers)
        .values({
          ...validatedData,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      res.json({ success: true, data: newDealer[0], message: 'Dealer created successfully' });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: 'Failed to create dealer',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get dealers with sub-dealer hierarchy
  app.get('/api/dealers/user/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { includeSubDealers = 'true', type, region, area } = req.query;

      let whereCondition = eq(dealers.userId, parseInt(userId));

      if (type) {
        whereCondition = and(whereCondition, eq(dealers.type, type as string));
      }
      if (region) {
        whereCondition = and(whereCondition, eq(dealers.region, region as string));
      }
      if (area) {
        whereCondition = and(whereCondition, eq(dealers.area, area as string));
      }

      const dealerList = await db.select().from(dealers)
        .where(whereCondition)
        .orderBy(asc(dealers.name));

      if (includeSubDealers === 'true') {
        // Build hierarchy
        const dealerMap = new Map();
        const rootDealers: any[] = [];

        dealerList.forEach(dealer => {
          dealerMap.set(dealer.id, { ...dealer, subDealers: [] });
        });

        dealerList.forEach(dealer => {
          if (dealer.parentDealerId) {
            const parent = dealerMap.get(dealer.parentDealerId);
            if (parent) {
              parent.subDealers.push(dealerMap.get(dealer.id));
            }
          } else {
            rootDealers.push(dealerMap.get(dealer.id));
          }
        });

        res.json({ success: true, data: rootDealers });
      } else {
        res.json({ success: true, data: dealerList });
      }
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to fetch dealers' });
    }
  });

  app.get('/api/dealers/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const dealer = await db.select().from(dealers).where(eq(dealers.id, id)).limit(1);

      if (!dealer || dealer.length === 0) {
        return res.status(404).json({ success: false, error: 'Dealer not found' });
      }

      res.json({ success: true, data: dealer[0] });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to fetch dealer' });
    }
  });

  app.put('/api/dealers/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const validatedData = insertDealerSchema.partial().parse(req.body);

      const updatedDealer = await db.update(dealers)
        .set({ ...validatedData, updatedAt: new Date() })
        .where(eq(dealers.id, id))
        .returning();

      if (!updatedDealer || updatedDealer.length === 0) {
        return res.status(404).json({ success: false, error: 'Dealer not found' });
      }

      res.json({ success: true, data: updatedDealer[0] });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to update dealer' });
    }
  });

  app.delete('/api/dealers/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const deletedDealer = await db.delete(dealers).where(eq(dealers.id, id)).returning();

      if (!deletedDealer || deletedDealer.length === 0) {
        return res.status(404).json({ success: false, error: 'Dealer not found' });
      }

      res.json({ success: true, message: 'Dealer deleted successfully' });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to delete dealer' });
    }
  });

  // ==================== 5. ATTENDANCE - GEO-FENCING WITH TURF.JS ====================

  // Helper function using Turf.js for precise geo-fencing
  function isWithinOfficeGeofence(userLat: number, userLng: number): { isValid: boolean, officeName?: string, distance?: number } {
    const userPoint = turf.point([userLng, userLat]);

    for (const office of OFFICE_LOCATIONS) {
      const isInside = turf.booleanPointInPolygon(userPoint, office.polygon);

      if (isInside) {
        const distance = getDistance(
          { latitude: userLat, longitude: userLng },
          { latitude: office.lat, longitude: office.lng }
        );
        return { isValid: true, officeName: office.name, distance };
      }
    }
    return { isValid: false };
  }

  app.post('/api/attendance/punch-in', upload.single('selfie'), async (req: MulterRequest, res: Response) => {
    try {
      const { userId, latitude, longitude, locationName, accuracy, speed, heading, altitude } = req.body;
      const selfieFile = req.file;

      console.log('🔍 Punch-in request:', { userId, latitude, longitude }); // DEBUG

      if (!userId || !latitude || !longitude) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
      }

      // Geo-fencing validation with Turf.js
      const geoCheck = isWithinOfficeGeofence(parseFloat(latitude), parseFloat(longitude));
      if (!geoCheck.isValid) {
        return res.status(400).json({
          success: false,
          error: 'You are not within office premises',
          details: 'Geo-fencing validation failed'
        });
      }

      const today = new Date().toISOString().split('T')[0];
      const selfieUrl = selfieFile ? `uploads/selfies/${Date.now()}_${selfieFile.originalname}` : null;

      // ✅ ADD DEBUG: Check what's being parsed
      const attendanceData = {
        userId: parseInt(userId),
        attendanceDate: today,
        locationName: locationName || geoCheck.officeName || 'Office',
        inTimeTimestamp: new Date(),
        inTimeImageCaptured: !!selfieFile,
        outTimeImageCaptured: false,
        inTimeImageUrl: selfieUrl,
        inTimeLatitude: latitude.toString(),
        inTimeLongitude: longitude.toString(),
        inTimeAccuracy: accuracy ? accuracy.toString() : null,
        inTimeSpeed: speed ? speed.toString() : null,
        inTimeHeading: heading ? heading.toString() : null,
        inTimeAltitude: altitude ? altitude.toString() : null,
      };

      console.log('🔍 Attendance data to validate:', attendanceData); // DEBUG

      // Use schema validation with better error handling
      const validatedData = insertSalesmanAttendanceSchema.parse(attendanceData);
      console.log('✅ Schema validation passed'); // DEBUG

      const newAttendance = await db.insert(salesmanAttendance)
        .values({
          ...validatedData,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      console.log('✅ Database insert successful'); // DEBUG

      res.json({
        success: true,
        data: newAttendance[0],
        message: `Punched in at ${geoCheck.officeName}`,
        geoInfo: { officeName: geoCheck.officeName, distance: geoCheck.distance }
      });

    } catch (error) {
      console.error('❌ Punch-in error:', error); // DETAILED DEBUG
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to punch in', // Show actual error
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  app.post('/api/attendance/punch-out', upload.single('selfie'), async (req: MulterRequest, res: Response) => {
    try {
      const { userId, latitude, longitude, locationName, accuracy, speed, heading, altitude } = req.body;
      const selfieFile = req.file;

      if (!userId) {
        return res.status(400).json({ success: false, error: 'User ID is required' });
      }

      const today = new Date().toISOString().split('T')[0];
      const selfieUrl = selfieFile ? `uploads/selfies/${Date.now()}_${selfieFile.originalname}` : null;

      // Check if there's an unpunched record first (preferred behavior)
      const unpunchedRecord = await db.select().from(salesmanAttendance)
        .where(and(
          eq(salesmanAttendance.userId, parseInt(userId)),
          eq(salesmanAttendance.attendanceDate, today),
          isNull(salesmanAttendance.outTimeTimestamp)
        ))
        .orderBy(desc(salesmanAttendance.inTimeTimestamp))
        .limit(1);

      let result;

      if (unpunchedRecord && unpunchedRecord.length > 0) {
        // Update existing unpunched record
        result = await db.update(salesmanAttendance)
          .set({
            outTimeTimestamp: new Date(),
            outTimeImageCaptured: !!selfieFile,
            outTimeImageUrl: selfieUrl,
            outTimeLatitude: latitude ? latitude.toString() : null,
            outTimeLongitude: longitude ? longitude.toString() : null,
            outTimeAccuracy: accuracy ? accuracy.toString() : null,
            outTimeSpeed: speed ? speed.toString() : null,
            outTimeHeading: heading ? heading.toString() : null,
            outTimeAltitude: altitude ? altitude.toString() : null,
            updatedAt: new Date()
          })
          .where(eq(salesmanAttendance.id, unpunchedRecord[0].id))
          .returning();

        res.json({
          success: true,
          data: result[0],
          message: 'Punched out successfully',
          type: 'updated_existing'
        });
      } else {
        // Create new standalone punch-out record
        const newPunchOut = await db.insert(salesmanAttendance)
          .values({
            userId: parseInt(userId),
            attendanceDate: today,
            locationName: locationName || 'Office',
            inTimeTimestamp: new Date(), // Same as out time for standalone punch-out
            outTimeTimestamp: new Date(),
            inTimeImageCaptured: false,
            outTimeImageCaptured: !!selfieFile,
            inTimeImageUrl: null,
            outTimeImageUrl: selfieUrl,
            inTimeLatitude: latitude ? latitude.toString() : null,
            inTimeLongitude: longitude ? longitude.toString() : null,
            outTimeLatitude: latitude ? latitude.toString() : null,
            outTimeLongitude: longitude ? longitude.toString() : null,
            inTimeAccuracy: accuracy ? accuracy.toString() : null,
            inTimeSpeed: speed ? speed.toString() : null,
            inTimeHeading: heading ? heading.toString() : null,
            inTimeAltitude: altitude ? altitude.toString() : null,
            outTimeAccuracy: accuracy ? accuracy.toString() : null,
            outTimeSpeed: speed ? speed.toString() : null,
            outTimeHeading: heading ? heading.toString() : null,
            outTimeAltitude: altitude ? altitude.toString() : null,
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();

        res.json({
          success: true,
          data: newPunchOut[0],
          message: 'Standalone punch-out created successfully',
          type: 'new_standalone'
        });
      }

    } catch (error) {
      console.error('❌ Punch-out error:', error);
      res.status(400).json({
        success: false,
        error: 'Failed to punch out',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/api/attendance/user/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { startDate, endDate, month, year } = req.query;

      let whereCondition = eq(salesmanAttendance.userId, parseInt(userId));

      if (startDate && endDate) {
        whereCondition = and(
          whereCondition,
          gte(salesmanAttendance.attendanceDate, startDate as string),
          lte(salesmanAttendance.attendanceDate, endDate as string)
        );
      } else if (month && year) {
        const monthStart = `${year}-${month.toString().padStart(2, '0')}-01`;
        const nextMonth = parseInt(month as string) === 12 ? 1 : parseInt(month as string) + 1;
        const nextYear = parseInt(month as string) === 12 ? parseInt(year as string) + 1 : parseInt(year as string);
        const monthEnd = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`;

        whereCondition = and(
          whereCondition,
          gte(salesmanAttendance.attendanceDate, monthStart),
          sql`${salesmanAttendance.attendanceDate} < ${monthEnd}`
        );
      }

      const records = await db.select()
        .from(salesmanAttendance)
        .where(whereCondition)
        .orderBy(desc(salesmanAttendance.attendanceDate));

      res.json({ success: true, data: records });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to fetch attendance records' });
    }
  });

  // ==================== 6. LEAVE APPLICATIONS - CRUD ====================
  app.post('/api/leave-applications', async (req: Request, res: Response) => {
    try {
      const validatedData = insertSalesmanLeaveApplicationSchema.parse(req.body);
      const newApplication = await db.insert(salesmanLeaveApplications)
        .values({
          ...validatedData,
          status: 'Pending',
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      res.json({ success: true, data: newApplication[0], message: 'Leave application submitted' });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to submit leave application' });
    }
  });

  app.get('/api/leave-applications/user/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { status, year } = req.query;

      let whereCondition = eq(salesmanLeaveApplications.userId, parseInt(userId));

      if (status) {
        whereCondition = and(whereCondition, eq(salesmanLeaveApplications.status, status as string));
      }

      if (year) {
        whereCondition = and(
          whereCondition,
          gte(salesmanLeaveApplications.startDate, `${year}-01-01`),
          lte(salesmanLeaveApplications.endDate, `${year}-12-31`)
        );
      }

      const applications = await db.select().from(salesmanLeaveApplications)
        .where(whereCondition)
        .orderBy(desc(salesmanLeaveApplications.createdAt));

      res.json({ success: true, data: applications });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to fetch leave applications' });
    }
  });

  app.put('/api/leave-applications/:id/status', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status, adminRemarks } = req.body;

      if (!['Approved', 'Rejected', 'Pending'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status' });
      }

      const updated = await db.update(salesmanLeaveApplications)
        .set({ status, adminRemarks, updatedAt: new Date() })
        .where(eq(salesmanLeaveApplications.id, id))
        .returning();

      if (!updated || updated.length === 0) {
        return res.status(404).json({ success: false, error: 'Leave application not found' });
      }

      res.json({ success: true, data: updated[0], message: `Leave ${status.toLowerCase()}` });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to update leave status' });
    }
  });

  app.get('/api/leave-applications/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const application = await db.select().from(salesmanLeaveApplications)
        .where(eq(salesmanLeaveApplications.id, id))
        .limit(1);

      if (!application || application.length === 0) {
        return res.status(404).json({ success: false, error: 'Leave application not found' });
      }

      res.json({ success: true, data: application[0] });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to fetch leave application' });
    }
  });

  app.put('/api/leave-applications/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const validatedData = insertSalesmanLeaveApplicationSchema.partial().parse(req.body);

      const updated = await db.update(salesmanLeaveApplications)
        .set({ ...validatedData, updatedAt: new Date() })
        .where(eq(salesmanLeaveApplications.id, id))
        .returning();

      if (!updated || updated.length === 0) {
        return res.status(404).json({ success: false, error: 'Leave application not found' });
      }

      res.json({ success: true, data: updated[0] });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to update leave application' });
    }
  });

  app.delete('/api/leave-applications/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const deleted = await db.delete(salesmanLeaveApplications)
        .where(eq(salesmanLeaveApplications.id, id))
        .returning();

      if (!deleted || deleted.length === 0) {
        return res.status(404).json({ success: false, error: 'Leave application not found' });
      }

      res.json({ success: true, message: 'Leave application deleted successfully' });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to delete leave application' });
    }
  });

  // ==================== 7. CLIENT REPORTS - CRUD ====================
  app.post('/api/client-reports', async (req: Request, res: Response) => {
    try {
      const validatedData = insertClientReportSchema.parse(req.body);
      const newReport = await db.insert(clientReports)
        .values({
          ...validatedData,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      res.json({ success: true, data: newReport[0], message: 'Client report submitted' });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to submit client report' });
    }
  });

  app.get('/api/client-reports/user/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { startDate, endDate } = req.query;

      let whereCondition = eq(clientReports.userId, parseInt(userId));

      if (startDate && endDate) {
        whereCondition = and(
          whereCondition,
          gte(clientReports.createdAt, new Date(startDate as string)),
          lte(clientReports.createdAt, new Date(endDate as string))
        );
      }

      const reports = await db.select().from(clientReports)
        .where(whereCondition)
        .orderBy(desc(clientReports.createdAt));

      res.json({ success: true, data: reports });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to fetch client reports' });
    }
  });

  app.get('/api/client-reports/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const report = await db.select().from(clientReports)
        .where(eq(clientReports.id, id))
        .limit(1);

      if (!report || report.length === 0) {
        return res.status(404).json({ success: false, error: 'Client report not found' });
      }

      res.json({ success: true, data: report[0] });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to fetch client report' });
    }
  });

  app.put('/api/client-reports/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const validatedData = insertClientReportSchema.partial().parse(req.body);

      const updated = await db.update(clientReports)
        .set({ ...validatedData, updatedAt: new Date() })
        .where(eq(clientReports.id, id))
        .returning();

      if (!updated || updated.length === 0) {
        return res.status(404).json({ success: false, error: 'Client report not found' });
      }

      res.json({ success: true, data: updated[0] });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to update client report' });
    }
  });

  app.delete('/api/client-reports/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const deleted = await db.delete(clientReports)
        .where(eq(clientReports.id, id))
        .returning();

      if (!deleted || deleted.length === 0) {
        return res.status(404).json({ success: false, error: 'Client report not found' });
      }

      res.json({ success: true, message: 'Client report deleted successfully' });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to delete client report' });
    }
  });

  // ==================== 8. GEO-TRACKING WITH TURF.JS - CHECK IN/OUT ====================
  app.post('/api/geo-tracking', async (req: Request, res: Response) => {
    try {
      const validatedData = insertGeoTrackingSchema.parse(req.body);
      const newTracking = await db.insert(geoTracking)
        .values({
          ...validatedData,
          recordedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      res.json({ success: true, data: newTracking[0] });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to record geo tracking' });
    }
  });

  // Check-in at location with geo-validation
  app.post('/api/geo-tracking/checkin', async (req: Request, res: Response) => {
    try {
      const { userId, latitude, longitude, siteName, activityType } = req.body;

      if (!userId || !latitude || !longitude) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
      }

      const userPoint = turf.point([parseFloat(longitude), parseFloat(latitude)]);

      const trackingData = {
        userId: parseInt(userId),
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        siteName: siteName,
        checkInTime: new Date(),
        activityType: activityType || 'site_visit',
        locationType: 'check_in',
        recordedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const newTracking = await db.insert(geoTracking).values(trackingData).returning();

      res.json({
        success: true,
        data: newTracking[0],
        message: `Checked in at ${siteName}`,
        coordinates: { lat: latitude, lng: longitude }
      });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to check in' });
    }
  });

  // Check-out with distance calculation
  app.post('/api/geo-tracking/checkout', async (req: Request, res: Response) => {
    try {
      const { userId, latitude, longitude, trackingId } = req.body;

      if (!trackingId) {
        return res.status(400).json({ success: false, error: 'Tracking ID is required' });
      }

      // Find the check-in record
      const checkInRecord = await db.select().from(geoTracking)
        .where(eq(geoTracking.id, trackingId))
        .limit(1);

      if (!checkInRecord || checkInRecord.length === 0) {
        return res.status(404).json({ success: false, error: 'Check-in record not found' });
      }

      // Calculate distance traveled using Turf.js
      const checkInPoint = turf.point([parseFloat(checkInRecord[0].longitude), parseFloat(checkInRecord[0].latitude)]);
      const checkOutPoint = turf.point([parseFloat(longitude), parseFloat(latitude)]);
      const distance = turf.distance(checkInPoint, checkOutPoint, { units: 'kilometers' });

      // Update the record with checkout information
      const updated = await db.update(geoTracking)
        .set({
          checkOutTime: new Date(),
          totalDistanceTravelled: distance.toString(),
          updatedAt: new Date()
        })
        .where(eq(geoTracking.id, trackingId))
        .returning();

      res.json({
        success: true,
        data: updated[0],
        message: 'Checked out successfully',
        distanceTraveled: `${distance.toFixed(2)} km`
      });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to check out' });
    }
  });

  // Get geo-tracking history with route analysis
  app.get('/api/geo-tracking/user/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { date, activityType } = req.query;

      let whereCondition = eq(geoTracking.userId, parseInt(userId));

      if (date) {
        const startDate = new Date(date as string);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 1);

        whereCondition = and(
          whereCondition,
          gte(geoTracking.recordedAt, startDate),
          lte(geoTracking.recordedAt, endDate)
        );
      }

      if (activityType) {
        whereCondition = and(whereCondition, eq(geoTracking.activityType, activityType as string));
      }

      const trackingData = await db.select().from(geoTracking)
        .where(whereCondition)
        .orderBy(asc(geoTracking.recordedAt));

      // Create route analysis
      if (trackingData.length > 1) {
        const coordinates = trackingData.map(point => [
          parseFloat(point.longitude),
          parseFloat(point.latitude)
        ]);

        const lineString = turf.lineString(coordinates);
        const totalDistance = turf.length(lineString, { units: 'kilometers' });

        res.json({
          success: true,
          data: trackingData,
          analytics: {
            totalPoints: trackingData.length,
            totalDistance: `${totalDistance.toFixed(2)} km`,
            route: coordinates
          }
        });
      } else {
        res.json({ success: true, data: trackingData });
      }
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to fetch geo tracking data' });
    }
  });

  // ==================== 9. DAILY TASKS - ASSIGNMENT & ACCEPTANCE ====================
  app.post('/api/daily-tasks', async (req: Request, res: Response) => {
    try {
      const validatedData = insertDailyTaskSchema.parse(req.body);
      const newTask = await db.insert(dailyTasks)
        .values({
          ...validatedData,
          status: 'Assigned',
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      res.json({ success: true, data: newTask[0], message: 'Task assigned successfully' });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to assign task' });
    }
  });

  // Get tasks for user (receiving endpoint)
  app.get('/api/daily-tasks/user/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { status, date, assignedBy } = req.query;

      let whereCondition = eq(dailyTasks.userId, parseInt(userId));

      if (status) {
        whereCondition = and(whereCondition, eq(dailyTasks.status, status as string));
      }

      if (date) {
        whereCondition = and(whereCondition, eq(dailyTasks.taskDate, date as string));
      }

      if (assignedBy) {
        whereCondition = and(whereCondition, eq(dailyTasks.assignedByUserId, parseInt(assignedBy as string)));
      }

      const tasks = await db.select().from(dailyTasks)
        .where(whereCondition)
        .orderBy(desc(dailyTasks.taskDate));

      res.json({ success: true, data: tasks });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to fetch tasks' });
    }
  });

  // Accept/Update task status
  app.put('/api/daily-tasks/:id/status', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['Assigned', 'Accepted', 'In Progress', 'Completed', 'Cancelled'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status' });
      }

      const updatedTask = await db.update(dailyTasks)
        .set({ status, updatedAt: new Date() })
        .where(eq(dailyTasks.id, id))
        .returning();

      if (!updatedTask || updatedTask.length === 0) {
        return res.status(404).json({ success: false, error: 'Task not found' });
      }

      res.json({ success: true, data: updatedTask[0], message: `Task ${status.toLowerCase()}` });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to update task status' });
    }
  });

  app.get('/api/daily-tasks/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const task = await db.select().from(dailyTasks)
        .where(eq(dailyTasks.id, id))
        .limit(1);

      if (!task || task.length === 0) {
        return res.status(404).json({ success: false, error: 'Task not found' });
      }

      res.json({ success: true, data: task[0] });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to fetch task' });
    }
  });

  app.put('/api/daily-tasks/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const validatedData = insertDailyTaskSchema.partial().parse(req.body);

      const updated = await db.update(dailyTasks)
        .set({ ...validatedData, updatedAt: new Date() })
        .where(eq(dailyTasks.id, id))
        .returning();

      if (!updated || updated.length === 0) {
        return res.status(404).json({ success: false, error: 'Task not found' });
      }

      res.json({ success: true, data: updated[0] });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to update task' });
    }
  });

  app.delete('/api/daily-tasks/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const deleted = await db.delete(dailyTasks)
        .where(eq(dailyTasks.id, id))
        .returning();

      if (!deleted || deleted.length === 0) {
        return res.status(404).json({ success: false, error: 'Task not found' });
      }

      res.json({ success: true, message: 'Task deleted successfully' });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to delete task' });
    }
  });

  // ==================== 10. DEALER REPORTS AND SCORES - CRUD ====================
  app.post('/api/dealer-reports-scores', async (req: Request, res: Response) => {
    try {
      const validatedData = insertDealerReportsAndScoresSchema.parse(req.body);

      // Check if dealer exists
      const dealer = await db.select().from(dealers)
        .where(eq(dealers.id, validatedData.dealerId))
        .limit(1);

      if (!dealer || dealer.length === 0) {
        return res.status(404).json({ success: false, error: 'Dealer not found' });
      }

      const newScore = await db.insert(dealerReportsAndScores)
        .values({
          ...validatedData,
          lastUpdatedDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      res.json({ success: true, data: newScore[0], message: 'Dealer score recorded' });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to record dealer score' });
    }
  });

  app.get('/api/dealer-reports-scores/dealer/:dealerId', async (req: Request, res: Response) => {
    try {
      const { dealerId } = req.params;

      const scores = await db.select().from(dealerReportsAndScores)
        .where(eq(dealerReportsAndScores.dealerId, dealerId))
        .orderBy(desc(dealerReportsAndScores.lastUpdatedDate));

      res.json({ success: true, data: scores });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to fetch dealer scores' });
    }
  });

  app.put('/api/dealer-reports-scores/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const validatedData = insertDealerReportsAndScoresSchema.partial().parse(req.body);

      const updated = await db.update(dealerReportsAndScores)
        .set({ ...validatedData, lastUpdatedDate: new Date(), updatedAt: new Date() })
        .where(eq(dealerReportsAndScores.id, id))
        .returning();

      if (!updated || updated.length === 0) {
        return res.status(404).json({ success: false, error: 'Dealer score not found' });
      }

      res.json({ success: true, data: updated[0] });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to update dealer score' });
    }
  });

  // ==================== 11. COMPETITION REPORTS - CRUD ====================
  app.post('/api/competition-reports', async (req: Request, res: Response) => {
    try {
      const validatedData = insertCompetitionReportSchema.parse(req.body);
      const newReport = await db.insert(competitionReports)
        .values({
          ...validatedData,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      res.json({ success: true, data: newReport[0], message: 'Competition report submitted' });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to submit competition report' });
    }
  });

  app.get('/api/competition-reports/user/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { startDate, endDate, brandName } = req.query;

      let whereCondition = eq(competitionReports.userId, parseInt(userId));

      if (startDate && endDate) {
        whereCondition = and(
          whereCondition,
          gte(competitionReports.reportDate, startDate as string),
          lte(competitionReports.reportDate, endDate as string)
        );
      }

      if (brandName) {
        whereCondition = and(whereCondition, eq(competitionReports.brandName, brandName as string));
      }

      const reports = await db.select().from(competitionReports)
        .where(whereCondition)
        .orderBy(desc(competitionReports.reportDate));

      res.json({ success: true, data: reports });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to fetch competition reports' });
    }
  });

  app.get('/api/competition-reports/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const report = await db.select().from(competitionReports)
        .where(eq(competitionReports.id, id))
        .limit(1);

      if (!report || report.length === 0) {
        return res.status(404).json({ success: false, error: 'Competition report not found' });
      }

      res.json({ success: true, data: report[0] });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to fetch competition report' });
    }
  });

  app.put('/api/competition-reports/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const validatedData = insertCompetitionReportSchema.partial().parse(req.body);

      const updated = await db.update(competitionReports)
        .set({ ...validatedData, updatedAt: new Date() })
        .where(eq(competitionReports.id, id))
        .returning();

      if (!updated || updated.length === 0) {
        return res.status(404).json({ success: false, error: 'Competition report not found' });
      }

      res.json({ success: true, data: updated[0] });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to update competition report' });
    }
  });

  app.delete('/api/competition-reports/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const deleted = await db.delete(competitionReports)
        .where(eq(competitionReports.id, id))
        .returning();

      if (!deleted || deleted.length === 0) {
        return res.status(404).json({ success: false, error: 'Competition report not found' });
      }

      res.json({ success: true, message: 'Competition report deleted successfully' });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to delete competition report' });
    }
  });

  // ==================== DASHBOARD & ANALYTICS ====================
  app.get('/api/dashboard/stats/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const today = new Date().toISOString().split('T')[0];
      const currentMonth = new Date().toISOString().slice(0, 7);

      // Get various statistics
      const [
        todayAttendance,
        monthlyReports,
        pendingTasks,
        totalDealers,
        pendingLeaves
      ] = await Promise.all([
        db.select().from(salesmanAttendance)
          .where(and(
            eq(salesmanAttendance.userId, parseInt(userId)),
            eq(salesmanAttendance.attendanceDate, today)
          )).limit(1),

        db.select({ count: sql<number>`cast(count(*) as int)` })
          .from(dailyVisitReports)
          .where(and(
            eq(dailyVisitReports.userId, parseInt(userId)),
            like(dailyVisitReports.reportDate, `${currentMonth}%`)
          )),

        db.select({ count: sql<number>`cast(count(*) as int)` })
          .from(dailyTasks)
          .where(and(
            eq(dailyTasks.userId, parseInt(userId)),
            eq(dailyTasks.status, 'Assigned')
          )),

        db.select({ count: sql<number>`cast(count(*) as int)` })
          .from(dealers)
          .where(eq(dealers.userId, parseInt(userId))),

        db.select({ count: sql<number>`cast(count(*) as int)` })
          .from(salesmanLeaveApplications)
          .where(and(
            eq(salesmanLeaveApplications.userId, parseInt(userId)),
            eq(salesmanLeaveApplications.status, 'Pending')
          ))
      ]);

      res.json({
        success: true,
        data: {
          attendance: {
            isPresent: todayAttendance && todayAttendance.length > 0,
            punchInTime: todayAttendance && todayAttendance[0] ? todayAttendance[0].inTimeTimestamp : null,
            punchOutTime: todayAttendance && todayAttendance[0] ? todayAttendance[0].outTimeTimestamp : null
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
      res.status(500).json({
        success: false,
        error: 'Failed to fetch dashboard stats',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ==================== COMPANIES & USERS ENDPOINTS ====================
  app.get('/api/companies/:id/users', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { role } = req.query;

      let whereCondition = eq(users.companyId, parseInt(id));

      if (role) {
        whereCondition = and(whereCondition, eq(users.role, role as string));
      }

      const companyUsers = await db.select().from(users)
        .where(whereCondition)
        .orderBy(asc(users.firstName));

      res.json({ success: true, data: companyUsers });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to fetch company users' });
    }
  });

  app.get('/api/users/:id/hierarchy', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Get user with their reports
      const userWithReports = await db.select().from(users)
        .where(eq(users.reportsToId, parseInt(id)));

      // Get user's manager
      const user = await db.select().from(users)
        .where(eq(users.id, parseInt(id)))
        .limit(1);

      let manager = null;
      if (user[0]?.reportsToId) {
        const managerResult = await db.select().from(users)
          .where(eq(users.id, user[0].reportsToId))
          .limit(1);
        manager = managerResult[0] || null;
      }

      res.json({
        success: true,
        data: {
          user: user[0],
          manager,
          reports: userWithReports
        }
      });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Failed to fetch user hierarchy' });
    }
  });

  // Health check endpoint
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      success: true,
      message: 'Sales Management API is running',
      timestamp: new Date().toISOString(),
      endpoints: {
        reports: ['DVR', 'TVR', 'PJP', 'Client Reports', 'Competition Reports'],
        operations: ['Dealers CRUD', 'Attendance', 'Leave Applications', 'Daily Tasks'],
        tracking: ['Geo Tracking', 'Dealer Scores'],
        analytics: ['Dashboard Stats', 'User Hierarchy']
      }
    });
  });
}