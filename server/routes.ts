// routes.ts
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
  insertDailyVisitReportSchema,
  insertTechnicalVisitReportSchema,
  insertPermanentJourneyPlanSchema,
  insertSalesmanAttendanceSchema,
  insertSalesmanLeaveApplicationSchema,
  insertClientReportSchema,
  insertCompetitionReportSchema,
  insertGeoTrackingSchema,
  insertDailyTaskSchema
} from 'shared/schema';
import { eq, desc, and, gte, or } from 'drizzle-orm';
import { z } from 'zod';
import { AIService } from 'server/bot/aiService';
import { telegramBot } from './bot/telegram';

const aiService = new AIService(process.env.OPENROUTER_API_KEY || '');

export function setupWebRoutes(app: Express) {
  // PWA route
  app.get('/pwa', (req: Request, res: Response) => {
    res.redirect('/login');
  });

  // ===== DAILY VISIT REPORTS =====
  app.get('/api/dvr/recent', async (req: Request, res: Response) => {
    try {
      const reports = await db.query.dailyVisitReports.findMany({
        orderBy: [desc(dailyVisitReports.reportDate)],
        limit: 10
      });
      res.json(reports);
    } catch (error) {
      console.error('Error fetching reports:', error);
      res.status(500).json({ error: 'Failed to fetch reports' });
    }
  });

  app.post('/api/dvr', async (req: Request, res: Response) => {
    try {
      const validatedData = insertDailyVisitReportSchema.parse({
        ...req.body,
        reportDate: new Date().toISOString().split('T')[0],
        latitude: req.body.latitude || "0",
        longitude: req.body.longitude || "0",
        brandSelling: req.body.brandSelling || [],
        contactPerson: req.body.contactPerson || "",
        contactPersonPhoneNo: req.body.contactPersonPhoneNo || "",
        solutionBySalesperson: req.body.solutionBySalesperson || "",
        checkInTime: req.body.checkInTime ? new Date(req.body.checkInTime).toISOString() : new Date().toISOString(),
        checkOutTime: req.body.checkOutTime ? new Date(req.body.checkOutTime).toISOString() : null,
        inTimeImageUrl: req.body.inTimeImageUrl || null,
        outTimeImageUrl: req.body.outTimeImageUrl || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const result = await db.insert(dailyVisitReports).values(validatedData).returning();
      res.status(201).json(result[0]);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      console.error('Error creating DVR:', error);
      res.status(500).json({ error: 'Failed to create DVR' });
    }
  });

  // ===== TECHNICAL VISIT REPORTS =====
  app.get('/api/tvr/recent', async (req: Request, res: Response) => {
    try {
      const reports = await db.query.technicalVisitReports.findMany({
        orderBy: [desc(technicalVisitReports.reportDate)],
        limit: 10
      });
      res.json(reports);
    } catch (error) {
      console.error('Error fetching technical reports:', error);
      res.status(500).json({ error: 'Failed to fetch technical reports' });
    }
  });

  app.post('/api/tvr', async (req: Request, res: Response) => {
    try {
      const validatedData = insertTechnicalVisitReportSchema.parse({
        ...req.body,
        reportDate: new Date().toISOString().split('T')[0],
        checkInTime: req.body.checkInTime ? new Date(req.body.checkInTime).toISOString() : new Date().toISOString(),
        checkOutTime: req.body.checkOutTime ? new Date(req.body.checkOutTime).toISOString() : null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const result = await db.insert(technicalVisitReports).values(validatedData).returning();
      res.status(201).json(result[0]);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      console.error('Error creating technical report:', error);
      res.status(500).json({ error: 'Failed to create technical report' });
    }
  });

  // ===== JOURNEY PLANS =====
  app.get('/api/journey/recent', async (req: Request, res: Response) => {
    try {
      const plans = await db.query.permanentJourneyPlans.findMany({
        orderBy: [desc(permanentJourneyPlans.planDate)],
        limit: 10
      });
      res.json(plans);
    } catch (error) {
      console.error('Error fetching journey plans:', error);
      res.status(500).json({ error: 'Failed to fetch journey plans' });
    }
  });

  app.post('/api/journey', async (req: Request, res: Response) => {
    try {
      const validatedData = insertPermanentJourneyPlanSchema.parse({
        ...req.body,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const result = await db.insert(permanentJourneyPlans).values(validatedData).returning();
      res.status(201).json(result[0]);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      console.error('Error creating journey plan:', error);
      res.status(500).json({ error: 'Failed to create journey plan' });
    }
  });

  // ===== ATTENDANCE =====
  app.get('/api/attendance/recent', async (req: Request, res: Response) => {
    try {
      const attendance = await db.query.salesmanAttendance.findMany({
        orderBy: [desc(salesmanAttendance.attendanceDate)],
        limit: 10
      });
      res.json(attendance);
    } catch (error) {
      console.error('Error fetching attendance:', error);
      res.status(500).json({ error: 'Failed to fetch attendance' });
    }
  });

  app.post('/api/attendance', async (req: Request, res: Response) => {
    try {
      const validatedData = insertSalesmanAttendanceSchema.parse({
        ...req.body,
        attendanceDate: new Date().toISOString().split('T')[0],
        inTimeTimestamp: req.body.inTimeTimestamp ? new Date(req.body.inTimeTimestamp).toISOString() : new Date().toISOString(),
        outTimeTimestamp: req.body.outTimeTimestamp ? new Date(req.body.outTimeTimestamp).toISOString() : null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const result = await db.insert(salesmanAttendance).values(validatedData).returning();
      res.status(201).json(result[0]);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      console.error('Error creating attendance:', error);
      res.status(500).json({ error: 'Failed to create attendance' });
    }
  });

  // ===== LEAVE APPLICATIONS =====
  app.get('/api/leave/recent', async (req: Request, res: Response) => {
    try {
      const leaves = await db.query.salesmanLeaveApplications.findMany({
        orderBy: [desc(salesmanLeaveApplications.createdAt)],
        limit: 10
      });
      res.json(leaves);
    } catch (error) {
      console.error('Error fetching leaves:', error);
      res.status(500).json({ error: 'Failed to fetch leaves' });
    }
  });

  app.post('/api/leave', async (req: Request, res: Response) => {
    try {
      const validatedData = insertSalesmanLeaveApplicationSchema.parse({
        ...req.body,
        status: 'Pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const result = await db.insert(salesmanLeaveApplications).values(validatedData).returning();
      res.status(201).json(result[0]);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      console.error('Error creating leave application:', error);
      res.status(500).json({ error: 'Failed to create leave application' });
    }
  });

  // ===== CLIENT REPORTS =====
  app.get('/api/client-reports/recent', async (req: Request, res: Response) => {
    try {
      const reports = await db.query.clientReports.findMany({
        orderBy: [desc(clientReports.createdAt)],
        limit: 10
      });
      res.json(reports);
    } catch (error) {
      console.error('Error fetching client reports:', error);
      res.status(500).json({ error: 'Failed to fetch client reports' });
    }
  });

  app.post('/api/client-reports', async (req: Request, res: Response) => {
    try {
      const validatedData = insertClientReportSchema.parse({
        ...req.body,
        checkOutTime: req.body.checkOutTime ? new Date(req.body.checkOutTime).toISOString() : new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const result = await db.insert(clientReports).values(validatedData).returning();
      res.status(201).json(result[0]);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      console.error('Error creating client report:', error);
      res.status(500).json({ error: 'Failed to create client report' });
    }
  });

  // ===== COMPETITION REPORTS =====
  app.get('/api/competition/recent', async (req: Request, res: Response) => {
    try {
      const reports = await db.query.competitionReports.findMany({
        orderBy: [desc(competitionReports.reportDate)],
        limit: 10
      });
      res.json(reports);
    } catch (error) {
      console.error('Error fetching competition reports:', error);
      res.status(500).json({ error: 'Failed to fetch competition reports' });
    }
  });

  app.post('/api/competition', async (req: Request, res: Response) => {
    try {
      const validatedData = insertCompetitionReportSchema.parse({
        ...req.body,
        reportDate: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const result = await db.insert(competitionReports).values(validatedData).returning();
      res.status(201).json(result[0]);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      console.error('Error creating competition report:', error);
      res.status(500).json({ error: 'Failed to create competition report' });
    }
  });

  // ===== GEO TRACKING =====
  app.get('/api/geo-tracking/recent', async (req: Request, res: Response) => {
    try {
      const tracking = await db.query.geoTracking.findMany({
        orderBy: [desc(geoTracking.recordedAt)],
        limit: 50
      });
      res.json(tracking);
    } catch (error) {
      console.error('Error fetching geo tracking:', error);
      res.status(500).json({ error: 'Failed to fetch geo tracking' });
    }
  });

  app.post('/api/geo-tracking', async (req: Request, res: Response) => {
    try {
      const validatedData = insertGeoTrackingSchema.parse({
        ...req.body,
        recordedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const result = await db.insert(geoTracking).values(validatedData).returning();
      res.status(201).json(result[0]);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      console.error('Error creating geo tracking:', error);
      res.status(500).json({ error: 'Failed to create geo tracking' });
    }
  });

  // ===== DAILY TASKS =====
  app.get('/api/tasks/recent', async (req: Request, res: Response) => {
    try {
      const tasks = await db.query.dailyTasks.findMany({
        orderBy: [desc(dailyTasks.taskDate)],
        limit: 10
      });
      res.json(tasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  });

  app.post('/api/tasks', async (req: Request, res: Response) => {
    try {
      const validatedData = insertDailyTaskSchema.parse({
        ...req.body,
        status: 'Assigned',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const result = await db.insert(dailyTasks).values(validatedData).returning();
      res.status(201).json(result[0]);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      console.error('Error creating task:', error);
      res.status(500).json({ error: 'Failed to create task' });
    }
  });

  // ===== EXISTING ROUTES =====
  app.post('/api/ai-assist', async (req: Request, res: Response) => {
    try {
      const { dealerName, dealerType, visitType, todayOrderMt, todayCollectionRupees, feedbacks, anyRemarks, solutionBySalesperson } = req.body;

      const prompt = `
        As a sales expert, analyze this daily visit report and provide actionable insights:
        
        Dealer: ${dealerName || 'Not specified'} (${dealerType || 'Not specified'})
        Visit Type: ${visitType}
        Order: ${todayOrderMt} MT
        Collection: ₹${todayCollectionRupees}
        Customer Feedback: ${feedbacks}
        Solution Provided: ${solutionBySalesperson || 'None'}
        Additional Remarks: ${anyRemarks || 'None'}
        
        Please provide:
        1. 🎯 Key insights from this visit
        2. 📈 Recommendations for improving performance
        3. 🔄 Suggested follow-up actions
        4. ⚠️ Any concerns that need immediate attention
        5. 💡 Strategic opportunities identified
        
        Format your response with clear sections and actionable bullet points.
      `;

      const assistance = await aiService.generateText(prompt);
      res.json({ assistance });
    } catch (error) {
      console.error('AI assistance error:', error);
      res.status(500).json({ error: 'Failed to generate AI assistance' });
    }
  });

  app.get('/api/dealers', async (req: Request, res: Response) => {
    try {
      const dealerList = await db.query.dealers.findMany({
        orderBy: [dealers.name]
      });
      res.json(dealerList);
    } catch (error) {
      console.error('Error fetching dealers:', error);
      res.status(500).json({ error: 'Failed to fetch dealers' });
    }
  });



  // ===== AI ANALYSIS ROUTES =====
  app.post('/api/ai/location-analysis', async (req: Request, res: Response) => {
    try {
      const locationContext = req.body;
      const analysis = await aiService.analyzeLocationPattern(locationContext);
      res.json(analysis);
    } catch (error) {
      console.error('Error in location analysis:', error);
      res.status(500).json({ error: 'Failed to analyze location data' });
    }
  });

  // ===== JOURNEY STATE MANAGEMENT =====
  app.post('/api/journey/start', async (req: Request, res: Response) => {
    try {
      const { userId, planId } = req.body;

      // Start geo tracking for this user
      const startData = {
        userId,
        planId,
        latitude: req.body.latitude || "0",
        longitude: req.body.longitude || "0",
        recordedAt: new Date().toISOString(),
        sessionId: `journey_${userId}_${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const result = await db.insert(geoTracking).values(startData).returning();

      // Notify via Socket.IO
      if (req.app.get('socketio')) {
        req.app.get('socketio').emit('journey_started', { userId, sessionId: startData.sessionId });
      }

      res.json({
        success: true,
        sessionId: startData.sessionId,
        message: 'Journey started successfully'
      });
    } catch (error) {
      console.error('Error starting journey:', error);
      res.status(500).json({ error: 'Failed to start journey' });
    }
  });

  // ===== AUTHENTICATION ROUTES =====
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

  app.post('/api/journey/end', async (req: Request, res: Response) => {
    try {
      const { userId, sessionId } = req.body;

      // Get all tracking points for this session
      const trackingPoints = await db.query.geoTracking.findMany({
        where: eq(geoTracking.sessionId, sessionId),
        orderBy: [geoTracking.recordedAt]
      });

      // Calculate total distance
      let totalDistance = 0;
      for (let i = 1; i < trackingPoints.length; i++) {
        const prev = trackingPoints[i - 1];
        const curr = trackingPoints[i];
        // Simple distance calculation (you can use more accurate formulas)
        const dist = Math.sqrt(
          Math.pow(parseFloat(curr.latitude) - parseFloat(prev.latitude), 2) +
          Math.pow(parseFloat(curr.longitude) - parseFloat(prev.longitude), 2)
        ) * 111000; // Rough conversion to meters
        totalDistance += dist;
      }

      // End tracking record
      const endData = {
        userId,
        sessionId,
        latitude: req.body.latitude || "0",
        longitude: req.body.longitude || "0",
        recordedAt: new Date().toISOString(),
        totalDistance: totalDistance.toFixed(2),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await db.insert(geoTracking).values(endData);

      // Generate AI travel summary
      const travelSummary = await aiService.generateTravelSummary({
        startTime: new Date(trackingPoints[0]?.recordedAt || new Date()),
        endTime: new Date(),
        totalDistance,
        locationCount: trackingPoints.length
      });

      res.json({
        success: true,
        totalDistance: totalDistance.toFixed(2),
        summary: travelSummary,
        message: 'Journey ended successfully'
      });
    } catch (error) {
      console.error('Error ending journey:', error);
      res.status(500).json({ error: 'Failed to end journey' });
    }
  });

  app.post('/api/journey/track', async (req: Request, res: Response) => {
    try {
      const trackingData = {
        ...req.body,
        recordedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const result = await db.insert(geoTracking).values(trackingData).returning();
      res.json(result[0]);
    } catch (error) {
      console.error('Error tracking location:', error);
      res.status(500).json({ error: 'Failed to track location' });
    }
  });

  app.post('/api/ai/travel-summary', async (req: Request, res: Response) => {
    try {
      const sessionData = req.body;
      const summary = await aiService.generateTravelSummary(sessionData);
      res.json(summary);
    } catch (error) {
      console.error('Error generating travel summary:', error);
      res.status(500).json({ error: 'Failed to generate travel summary' });
    }
  });

  app.post('/api/ai/general-query', async (req: Request, res: Response) => {
    try {
      const { prompt } = req.body;
      const response = await aiService.generateText(prompt);
      res.json({ response });
    } catch (error) {
      console.error('Error in AI query:', error);
      res.status(500).json({ error: 'Failed to process AI query' });
    }
  });

  // ===== TELEGRAM INTEGRATION ROUTES =====
  app.post('/api/telegram/notify-user', async (req: Request, res: Response) => {
    try {
      const { userId, message } = req.body;
      await telegramBot.notifyTelegramUser(userId, message);
      res.json({ success: true });
    } catch (error) {
      console.error('Error notifying telegram user:', error);
      res.status(500).json({ error: 'Failed to send telegram notification' });
    }
  });

  app.get('/api/telegram/link-status/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      // Check if user is linked to telegram
      // This would need a method in telegram service to check link status
      res.json({ linked: false }); // Placeholder
    } catch (error) {
      console.error('Error checking telegram link:', error);
      res.status(500).json({ error: 'Failed to check link status' });
    }
  });

  app.post('/api/dealers', async (req: Request, res: Response) => {
    try {
      const newDealer = await db.insert(dealers).values(req.body).returning();
      res.status(201).json(newDealer[0]);
    } catch (error) {
      console.error('Error creating dealer:', error);
      res.status(500).json({ error: 'Failed to create dealer' });
    }
  });

  // ===== AI CHAT-BASED REPORT GENERATION =====
  app.post('/api/ai/generate-dvr', async (req: Request, res: Response) => {
    try {
      const { userInput, location, dealerName } = req.body;

      const dvrData = await aiService.generateDVRFromChat(userInput, location, dealerName);

      // Add required fields for database insertion
      const completeDVR = {
        ...dvrData,
        userId: req.body.userId || 1,
        latitude: location.lat.toString(),
        longitude: location.lng.toString(),
        reportDate: new Date().toISOString().split('T')[0],
        checkInTime: new Date().toISOString(),
        checkOutTime: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      res.json({
        generatedDVR: completeDVR,
        message: 'DVR generated successfully! Review and submit.'
      });
    } catch (error) {
      console.error('Error generating DVR:', error);
      res.status(500).json({ error: 'Failed to generate DVR' });
    }
  });

  app.post('/api/ai/generate-tvr', async (req: Request, res: Response) => {
    try {
      const { userInput, location } = req.body;

      const tvrData = await aiService.generateTVRFromChat(userInput, location);

      const completeTVR = {
        ...tvrData,
        userId: req.body.userId || 1,
        latitude: location.lat.toString(),
        longitude: location.lng.toString(),
        reportDate: new Date().toISOString().split('T')[0],
        checkInTime: new Date().toISOString(),
        checkOutTime: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      res.json({
        generatedTVR: completeTVR,
        message: 'TVR generated successfully! Review and submit.'
      });
    } catch (error) {
      console.error('Error generating TVR:', error);
      res.status(500).json({ error: 'Failed to generate TVR' });
    }
  });

  app.post('/api/ai/chat-assist', async (req: Request, res: Response) => {
    try {
      const { userInput, context } = req.body;
      const assistance = await aiService.getChatAssistance(userInput, context);
      res.json({ response: assistance });
    } catch (error) {
      console.error('Error in chat assistance:', error);
      res.status(500).json({ error: 'Failed to get assistance' });
    }
  });

  app.get('/api/users/:userId/performance', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const startDateString = thirtyDaysAgo.toISOString().split('T')[0];

      const reports = await db.query.dailyVisitReports.findMany({
        where: and(
          eq(dailyVisitReports.userId, parseInt(userId)),
          gte(dailyVisitReports.reportDate, startDateString)
        )
      });

      const totalReports = reports.length;
      const totalOrders = reports.reduce((sum, report) =>
        sum + parseFloat(report.todayOrderMt.toString()), 0);
      const totalCollection = reports.reduce((sum, report) =>
        sum + parseFloat(report.todayCollectionRupees.toString()), 0);

      const performance = {
        totalReports,
        totalOrders: parseFloat(totalOrders.toFixed(2)),
        totalCollection: parseFloat(totalCollection.toFixed(2)),
        averageOrderPerVisit: totalReports > 0 ? parseFloat((totalOrders / totalReports).toFixed(2)) : 0,
        averageCollectionPerVisit: totalReports > 0 ? parseFloat((totalCollection / totalReports).toFixed(2)) : 0
      };

      res.json(performance);
    } catch (error) {
      console.error('Error fetching user performance:', error);
      res.status(500).json({ error: 'Failed to fetch performance data' });
    }
  });
}