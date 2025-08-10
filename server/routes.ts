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
import { eq, desc, asc, and, gte, lte, isNull, inArray, notInArray, like, ilike, or } from 'drizzle-orm';
import { z } from 'zod';
import { ChatMessage } from 'server/bot/aiService';
import PureRAGService from 'server/bot/aiService';
import { telegramBot } from './bot/telegram';


export function setupWebRoutes(app: Express) {
  // PWA route
  app.get('/pwa', (req: Request, res: Response) => {
    res.redirect('/login');
  });

  app.post('/api/rag/chat', async (req: Request, res: Response) => {
    try {
      const { messages, userId }: { messages: ChatMessage[], userId?: number } = req.body;

      // Validate message structure
      if (!Array.isArray(messages)) {
        return res.status(400).json({
          success: false,
          error: 'Messages must be an array'
        });
      }

      // Validate each message has required fields
      for (const msg of messages) {
        if (!msg.role || !msg.content || !['user', 'assistant', 'system'].includes(msg.role)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid message format. Each message needs role and content.'
          });
        }
      }
      // ✅ PASS userId FOR PROACTIVENESS
      const aiResponse = await PureRAGService.chat(messages, userId);

      res.json({
        success: true,
        message: aiResponse
      });
    } catch (error) {
      console.error('RAG Chat error:', error);
      res.status(500).json({
        success: false,
        error: 'Chat failed. Try again.'
      });
    }
  });

  // 2. EXTRACT & SUBMIT ROUTE - When ready to submit with proper typing
  app.post('/api/rag/submit', async (req: Request, res: Response) => {
    try {
      const { messages, userId }: { messages: ChatMessage[], userId: number } = req.body;
      // Validate input
      if (!Array.isArray(messages)) {
        return res.status(400).json({
          success: false,
          error: 'Messages must be an array'
        });
      }
      if (!userId || typeof userId !== 'number') {
        return res.status(400).json({
          success: false,
          error: 'Valid userId is required'
        });
      }
      // Validate message structure
      for (const msg of messages) {
        if (!msg.role || !msg.content || !['user', 'assistant', 'system'].includes(msg.role)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid message format. Each message needs role and content.'
          });
        }
      }
      // Extract data from conversation with user context
      const extracted = await PureRAGService.extractStructuredData(messages, userId);
      if (!extracted || extracted.error) {
        return res.status(400).json({
          success: false,
          error: 'Not enough data collected. Continue chatting to provide more details.'
        });
      }
      // Call YOUR ORIGINAL ENDPOINT based on AI decision
      let submitResult;
      if (extracted.endpoint === '/api/dvr-manual') {
        console.log('🎯 Submitting to DVR endpoint with data:', extracted.data);

        const response = await fetch(`${process.env.BASE_URL || 'https://telesalesside.onrender.com'}/api/dvr-manual`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userId,
            ...extracted.data
          })
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
          body: JSON.stringify({
            userId: userId,
            ...extracted.data
          })
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
        return res.status(400).json({
          success: false,
          error: `Unknown endpoint: ${extracted.endpoint}`
        });
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
      res.status(500).json({
        success: false,
        error: 'Submission failed. Please try again.',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  // ===== TECHNICAL VISIT REPORTS WITH AI (FIXED WITH SCHEMA VALIDATION) =====
  app.get('/api/tvr/recent', async (req: Request, res: Response) => {
    try {
      const { limit = 10, userId, visitType } = req.query;

      let whereClause = undefined;

      if (userId) {
        whereClause = eq(technicalVisitReports.userId, parseInt(userId as string));
      }
      if (visitType) {
        whereClause = whereClause
          ? and(whereClause, eq(technicalVisitReports.visitType, visitType as string))
          : eq(technicalVisitReports.visitType, visitType as string);
      }

      const reports = await db.query.technicalVisitReports.findMany({
        where: whereClause,
        orderBy: [desc(technicalVisitReports.reportDate), desc(technicalVisitReports.createdAt)],
        limit: parseInt(limit as string),
        with: {
          user: {
            columns: { firstName: true, lastName: true, salesmanLoginId: true }
          }
        }
      });

      res.json({
        success: true,
        data: reports,
        total: reports.length
      });
    } catch (error) {
      console.error('Error fetching technical reports:', error);
      res.status(500).json({ error: 'Failed to fetch technical reports' });
    }
  });

  app.post('/api/tvr', async (req: Request, res: Response) => {
    try {
      const { useAI, userInput, location, ...manualData } = req.body;

      let tvrData;

      if (useAI && userInput) {
        // 🤖 AI MAGIC BUTTON - Generate TVR from chat
        console.log('🔧 Using AI to generate TVR from input:', userInput);

        const aiGeneratedData = await aiService.generateTVRFromInput({ //does not exist yet-make in aiServices
          siteName: req.body.siteName || "Customer Site",
          technicalIssue: userInput,
          serviceProvided: req.body.serviceProvided || "Technical support provided",
          customerFeedback: req.body.customerFeedback || userInput,
          visitType: req.body.visitType
        });

        // ✅ SCHEMA-COMPLIANT DATA MAPPING
        tvrData = {
          userId: parseInt(req.body.userId),
          reportDate: new Date().toISOString().split('T')[0], // ✅ Convert to YYYY-MM-DD string for date type
          visitType: aiGeneratedData.visitType || "Maintenance",
          siteNameConcernedPerson: aiGeneratedData.siteNameConcernedPerson || "Customer",
          phoneNo: aiGeneratedData.phoneNo || req.body.phoneNo || "0000000000",
          emailId: aiGeneratedData.emailId || req.body.emailId || null,
          clientsRemarks: aiGeneratedData.clientsRemarks || userInput,
          salespersonRemarks: aiGeneratedData.salespersonRemarks || "Technical support provided",
          checkInTime: new Date(), // ✅ timestamp type accepts Date object
          checkOutTime: null,
          inTimeImageUrl: req.body.inTimeImageUrl || null,
          outTimeImageUrl: req.body.outTimeImageUrl || null
        };
      } else {
        // ✅ MANUAL TVR CREATION WITH PROPER VALIDATION
        tvrData = {
          userId: parseInt(manualData.userId || req.body.userId),
          reportDate: manualData.reportDate
            ? new Date(manualData.reportDate).toISOString().split('T')[0] // ✅ Convert to YYYY-MM-DD string
            : new Date().toISOString().split('T')[0], // ✅ Convert to YYYY-MM-DD string
          visitType: manualData.visitType || "Maintenance",
          siteNameConcernedPerson: manualData.siteNameConcernedPerson,
          phoneNo: manualData.phoneNo,
          emailId: manualData.emailId || null,
          clientsRemarks: manualData.clientsRemarks,
          salespersonRemarks: manualData.salespersonRemarks,
          checkInTime: manualData.checkInTime ? new Date(manualData.checkInTime) : new Date(), // ✅ Date object
          checkOutTime: manualData.checkOutTime ? new Date(manualData.checkOutTime) : null, // ✅ Date object or null
          inTimeImageUrl: manualData.inTimeImageUrl || null,
          outTimeImageUrl: manualData.outTimeImageUrl || null
        };
      }

      // ✅ USE SCHEMA VALIDATION INSTEAD OF MANUAL VALIDATION
      const validatedData = insertTechnicalVisitReportSchema.parse(tvrData);

      // ✅ INSERT INTO DATABASE WITH VALIDATED DATA
      const result = await db.insert(technicalVisitReports).values(validatedData).returning();

      res.status(201).json({
        success: true,
        data: result[0],
        aiGenerated: useAI && userInput ? true : false,
        message: useAI ? '🔧 TVR created with AI assistance!' : 'TVR created successfully!'
      });

    } catch (error: any) {
      console.error('Error creating technical report:', error);

      // ✅ HANDLE SCHEMA VALIDATION ERRORS
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            received: err.input
          }))
        });
      }

      // ✅ DATABASE ERROR HANDLING
      if (error?.code === '23502') { // NOT NULL violation
        return res.status(400).json({
          error: 'Missing required field',
          details: error.detail || error.message
        });
      }
      if (error?.code === '23505') { // Unique violation
        return res.status(400).json({
          error: 'Duplicate entry',
          details: error.detail || error.message
        });
      }
      if (error?.code === '23503') { // Foreign key violation
        return res.status(400).json({
          error: 'Invalid user references',
          details: 'User does not exist'
        });
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      res.status(500).json({
        error: 'Failed to create technical report',
        details: errorMessage
      });
    }
  });

  // GET /api/tvr/:id
  app.get("/api/tvr/recent", async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId;
      const limit = parseInt(req.query.limit as string) || 10;

      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

      const recentTvrs = await db.query.technicalVisitReports.findMany({
        where: eq(technicalVisitReports.userId, parseInt(userId as string)), // ✅ This maps to user_id column
        orderBy: desc(technicalVisitReports.createdAt),
        limit: limit
      });

      return res.status(200).json({ data: recentTvrs });
    } catch (error) {
      console.error("Error fetching recent TVRs:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // ✅ CHECKOUT ENDPOINT WITH SCHEMA VALIDATION
  app.patch('/api/tvr/:id/checkout', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { outTimeImageUrl } = req.body;

      // ✅ BASIC VALIDATION
      if (!id) {
        return res.status(400).json({ error: 'TVR ID is required' });
      }

      // ✅ PREPARE UPDATE DATA
      const updateData = {
        checkOutTime: new Date(), // ✅ timestamp type accepts Date object
        outTimeImageUrl: outTimeImageUrl || null,
        updatedAt: new Date() // ✅ This is handled automatically by schema but explicit is fine
      };

      // ✅ VALIDATE UPDATE DATA (create a partial schema or validate manually)
      if (outTimeImageUrl && outTimeImageUrl.length > 500) {
        return res.status(400).json({ error: 'Image URL exceeds 500 characters' });
      }

      const result = await db
        .update(technicalVisitReports)
        .set(updateData)
        .where(eq(technicalVisitReports.id, id))
        .returning();

      if (result.length === 0) {
        return res.status(404).json({ error: 'Technical visit report not found' });
      }

      res.json({
        success: true,
        data: result[0],
        message: 'Successfully checked out from visit'
      });

    } catch (error: any) {
      console.error('Error updating checkout time:', error);
      res.status(500).json({
        error: 'Failed to update checkout time',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ===== SALESMAN ATTENDANCE ENDPOINTS (FIXED WITH SCHEMA VALIDATION) =====
  // Get recent attendance records
  app.get('/api/attendance/recent', async (req: Request, res: Response) => {
    try {
      const { limit = 10, userId } = req.query;

      let whereClause = undefined;
      if (userId) {
        whereClause = eq(salesmanAttendance.userId, parseInt(userId as string));
      }

      const attendance = await db.query.salesmanAttendance.findMany({
        where: whereClause,
        orderBy: [desc(salesmanAttendance.attendanceDate), desc(salesmanAttendance.createdAt)],
        limit: parseInt(limit as string),
        with: {
          user: {
            columns: { firstName: true, lastName: true, salesmanLoginId: true }
          }
        }
      });

      res.json({
        success: true,
        data: attendance,
        total: attendance.length
      });
    } catch (error) {
      console.error('Error fetching attendance:', error);
      res.status(500).json({ error: 'Failed to fetch attendance' });
    }
  });

  // Punch IN endpoint
  app.post('/api/attendance/punch-in', async (req: Request, res: Response) => {
    try {
      const {
        userId,
        locationName,
        latitude,
        longitude,
        accuracy,
        speed,
        heading,
        altitude,
        imageUrl,
        imageCaptured = false
      } = req.body;

      // Get today's date as YYYY-MM-DD string for date type
      const today = new Date();
      const todayDateString = today.toISOString().split('T')[0]; // ✅ Convert to YYYY-MM-DD string

      // 🔥 ONLY CHANGE: Check if user has an ACTIVE punch-in (not punched out) today
      const existingAttendance = await db.query.salesmanAttendance.findFirst({
        where: and(
          eq(salesmanAttendance.userId, parseInt(userId)),
          eq(salesmanAttendance.attendanceDate, todayDateString),
          isNull(salesmanAttendance.outTimeTimestamp) // 🔑 ONLY ADDITION: Check for active session
        )
      });

      if (existingAttendance) {
        return res.status(400).json({
          error: 'Already punched in today',
          data: existingAttendance
        });
      }

      // ✅ PREPARE DATA FOR SCHEMA VALIDATION - UNCHANGED
      const attendanceData = {
        userId: parseInt(userId),
        attendanceDate: todayDateString, // ✅ String for date type
        locationName: locationName || "Unknown Location",
        inTimeTimestamp: new Date(), // ✅ Date object for timestamp
        outTimeTimestamp: null,
        inTimeImageCaptured: Boolean(imageCaptured), // ✅ Ensure boolean
        outTimeImageCaptured: false, // ✅ Boolean default
        inTimeImageUrl: imageUrl || null,
        outTimeImageUrl: null,
        inTimeLatitude: latitude ? latitude.toString() : "0", // ✅ Convert to string for decimal
        inTimeLongitude: longitude ? longitude.toString() : "0", // ✅ Convert to string for decimal
        inTimeAccuracy: accuracy ? accuracy.toString() : null, // ✅ Convert to string for decimal
        inTimeSpeed: speed ? speed.toString() : null, // ✅ Convert to string for decimal
        inTimeHeading: heading ? heading.toString() : null, // ✅ Convert to string for decimal
        inTimeAltitude: altitude ? altitude.toString() : null, // ✅ Convert to string for decimal
        outTimeLatitude: null,
        outTimeLongitude: null,
        outTimeAccuracy: null,
        outTimeSpeed: null,
        outTimeHeading: null,
        outTimeAltitude: null
      };

      // ✅ USE SCHEMA VALIDATION - UNCHANGED
      const validatedData = insertSalesmanAttendanceSchema.parse(attendanceData);

      // ✅ INSERT WITH VALIDATED DATA - UNCHANGED
      const result = await db.insert(salesmanAttendance).values(validatedData).returning();

      res.status(201).json({
        success: true,
        data: result[0],
        message: 'Punched in successfully!'
      });

    } catch (error: any) {
      console.error('Error creating punch-in:', error);

      // ✅ HANDLE SCHEMA VALIDATION ERRORS - UNCHANGED
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Attendance validation error',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            received: err.input
          }))
        });
      }

      // ✅ DATABASE ERROR HANDLING - UNCHANGED
      if (error?.code === '23502') {
        return res.status(400).json({
          error: 'Missing required field',
          details: error.detail || error.message
        });
      }
      if (error?.code === '23505') {
        return res.status(400).json({
          error: 'Duplicate attendance entry',
          details: error.detail || error.message
        });
      }
      if (error?.code === '23503') {
        return res.status(400).json({
          error: 'Invalid user reference',
          details: 'User does not exist'
        });
      }

      res.status(500).json({
        error: 'Failed to punch in',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Punch OUT endpoint
  app.patch('/api/attendance/punch-out', async (req: Request, res: Response) => {
    try {
      const {
        userId,
        latitude,
        longitude,
        accuracy,
        speed,
        heading,
        altitude,
        imageUrl,
        imageCaptured = false
      } = req.body;

      // Get today's date as YYYY-MM-DD string
      const today = new Date();
      const todayDateString = today.toISOString().split('T')[0];

      // 🔥 ONLY CHANGE: Find today's ACTIVE attendance record (not punched out yet)
      const existingAttendance = await db.query.salesmanAttendance.findFirst({
        where: and(
          eq(salesmanAttendance.userId, parseInt(userId)),
          eq(salesmanAttendance.attendanceDate, todayDateString),
          isNull(salesmanAttendance.outTimeTimestamp) // 🔑 ONLY ADDITION: Find active session
        ),
        orderBy: [desc(salesmanAttendance.inTimeTimestamp)] // 🔑 SAFETY: Get latest active session
      });

      if (!existingAttendance) {
        return res.status(400).json({
          error: 'No punch-in record found for today. Please punch in first.'
        });
      }

      // 🔥 REMOVED: This check is now redundant since we already filter for null outTimeTimestamp
      // if (existingAttendance.outTimeTimestamp) {
      //   return res.status(400).json({
      //     error: 'Already punched out today',
      //     data: existingAttendance
      //   });
      // }

      // ✅ PREPARE UPDATE DATA WITH PROPER TYPES - UNCHANGED
      const updateData = {
        outTimeTimestamp: new Date(), // ✅ Date object for timestamp
        outTimeImageCaptured: Boolean(imageCaptured), // ✅ Ensure boolean
        outTimeImageUrl: imageUrl || null,
        outTimeLatitude: latitude ? latitude.toString() : null, // ✅ Convert to string for decimal
        outTimeLongitude: longitude ? longitude.toString() : null, // ✅ Convert to string for decimal
        outTimeAccuracy: accuracy ? accuracy.toString() : null, // ✅ Convert to string for decimal
        outTimeSpeed: speed ? speed.toString() : null, // ✅ Convert to string for decimal
        outTimeHeading: heading ? heading.toString() : null, // ✅ Convert to string for decimal
        outTimeAltitude: altitude ? altitude.toString() : null, // ✅ Convert to string for decimal
        updatedAt: new Date() // ✅ Date object
      };

      // ✅ VALIDATE IMAGE URL LENGTH - UNCHANGED
      if (imageUrl && imageUrl.length > 500) {
        return res.status(400).json({ error: 'Image URL exceeds 500 characters' });
      }

      // Update attendance record - UNCHANGED
      const result = await db.update(salesmanAttendance)
        .set(updateData)
        .where(eq(salesmanAttendance.id, existingAttendance.id))
        .returning();

      res.json({
        success: true,
        data: result[0],
        message: 'Punched out successfully!'
      });

    } catch (error: any) {
      console.error('Error updating punch-out:', error);

      // ✅ ERROR HANDLING - UNCHANGED
      if (error?.code === '23502') {
        return res.status(400).json({
          error: 'Missing required field for punch-out',
          details: error.detail || error.message
        });
      }

      res.status(500).json({
        error: 'Failed to punch out',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get today's attendance status
  app.get('/api/attendance/today/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      // ✅ VALIDATE USER ID - UNCHANGED
      const userIdInt = parseInt(userId);
      if (isNaN(userIdInt)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      // Get today's date as YYYY-MM-DD string
      const today = new Date();
      const todayDateString = today.toISOString().split('T')[0];

      // 🔥 NEW: Get ALL today's attendance records (multiple cycles)
      const todayAttendanceRecords = await db.query.salesmanAttendance.findMany({
        where: and(
          eq(salesmanAttendance.userId, userIdInt),
          eq(salesmanAttendance.attendanceDate, todayDateString)
        ),
        orderBy: [desc(salesmanAttendance.inTimeTimestamp)] // Latest first
      });

      // 🔥 NEW: Find the current ACTIVE session (if any)
      const activeSession = todayAttendanceRecords.find(record => !record.outTimeTimestamp);

      // 🔥 NEW: Calculate useful statistics
      const completedSessions = todayAttendanceRecords.filter(record => record.outTimeTimestamp);
      const hasAnyAttendance = todayAttendanceRecords.length > 0;
      const isCurrentlyPunchedIn = !!activeSession;

      res.json({
        success: true,
        hasAttendance: hasAnyAttendance,
        punchedIn: isCurrentlyPunchedIn, // 🔥 UPDATED: Current status, not just "any attendance"
        punchedOut: !isCurrentlyPunchedIn && hasAnyAttendance, // 🔥 NEW: True if has sessions but none active
        activeSession: activeSession || null, // 🔥 NEW: Current active session
        totalSessions: todayAttendanceRecords.length, // 🔥 NEW: Total cycles today
        completedSessions: completedSessions.length, // 🔥 NEW: Completed cycles
        data: todayAttendanceRecords, // 🔥 UPDATED: All sessions instead of just first one
        latestSession: todayAttendanceRecords[0] || null // 🔥 NEW: Most recent session
      });

    } catch (error) {
      console.error('Error fetching today attendance:', error);
      res.status(500).json({
        error: 'Failed to fetch today attendance',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ===== SALESMAN LEAVE APPLICATIONS ENDPOINTS (COMPLETE SET) =====
  // Get recent leave applications (Admin view)
  app.get('/api/leave/recent', async (req: Request, res: Response) => {
    try {
      const { limit = 10, status, userId } = req.query;

      let whereClause = undefined;

      if (status) {
        whereClause = eq(salesmanLeaveApplications.status, status as string);
      }

      if (userId) {
        const userClause = eq(salesmanLeaveApplications.userId, parseInt(userId as string));
        whereClause = whereClause ? and(whereClause, userClause) : userClause;
      }

      const leaves = await db.query.salesmanLeaveApplications.findMany({
        where: whereClause,
        orderBy: [desc(salesmanLeaveApplications.createdAt)],
        limit: parseInt(limit as string),
        with: {
          user: {
            columns: { firstName: true, lastName: true, salesmanLoginId: true, email: true }
          }
        }
      });

      res.json({
        success: true,
        data: leaves,
        total: leaves.length
      });
    } catch (error) {
      console.error('Error fetching leave applications:', error);
      res.status(500).json({
        error: 'Failed to fetch leave applications',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get leave applications for specific user
  app.get('/api/leave/user/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { status, limit = 20 } = req.query;

      // ✅ VALIDATE USER ID
      const userIdInt = parseInt(userId);
      if (isNaN(userIdInt)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      let whereClause = eq(salesmanLeaveApplications.userId, userIdInt);

      if (status) {
        whereClause = and(whereClause, eq(salesmanLeaveApplications.status, status as string));
      }

      const leaves = await db.query.salesmanLeaveApplications.findMany({
        where: whereClause,
        orderBy: [desc(salesmanLeaveApplications.createdAt)],
        limit: parseInt(limit as string),
        with: {
          user: {
            columns: { firstName: true, lastName: true, salesmanLoginId: true }
          }
        }
      });

      res.json({
        success: true,
        data: leaves,
        total: leaves.length
      });
    } catch (error) {
      console.error('Error fetching user leave applications:', error);
      res.status(500).json({
        error: 'Failed to fetch user leave applications',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Submit new leave application
  app.post('/api/leave', async (req: Request, res: Response) => {
    try {
      const {
        userId,
        leaveType,
        startDate,
        endDate,
        reason
      } = req.body;

      // ✅ PREPARE DATA FOR SCHEMA VALIDATION
      const leaveData = {
        userId: parseInt(userId),
        leaveType: leaveType,
        startDate: new Date(startDate).toISOString().split('T')[0], // ✅ Convert to YYYY-MM-DD string for date type
        endDate: new Date(endDate).toISOString().split('T')[0], // ✅ Convert to YYYY-MM-DD string for date type
        reason: reason,
        status: 'Pending', // ✅ Default status
        adminRemarks: null
      };

      // ✅ ADDITIONAL BUSINESS LOGIC VALIDATION
      const parsedStartDate = new Date(startDate);
      const parsedEndDate = new Date(endDate);

      if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
        return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
      }

      if (parsedStartDate > parsedEndDate) {
        return res.status(400).json({ error: 'Start date cannot be after end date' });
      }

      // ✅ Check for overlapping leave applications
      const overlappingLeaves = await db.query.salesmanLeaveApplications.findMany({
        where: and(
          eq(salesmanLeaveApplications.userId, parseInt(userId)),
          eq(salesmanLeaveApplications.status, 'Approved'),
          or(
            and(
              lte(salesmanLeaveApplications.startDate, leaveData.startDate),
              gte(salesmanLeaveApplications.endDate, leaveData.startDate)
            ),
            and(
              lte(salesmanLeaveApplications.startDate, leaveData.endDate),
              gte(salesmanLeaveApplications.endDate, leaveData.endDate)
            )
          )
        )
      });

      if (overlappingLeaves.length > 0) {
        return res.status(400).json({
          error: 'Leave dates overlap with existing approved leave',
          conflictingLeaves: overlappingLeaves
        });
      }

      // ✅ USE SCHEMA VALIDATION
      const validatedData = insertSalesmanLeaveApplicationSchema.parse(leaveData);

      // ✅ INSERT WITH VALIDATED DATA
      const result = await db.insert(salesmanLeaveApplications).values(validatedData).returning();

      res.status(201).json({
        success: true,
        data: result[0],
        message: 'Leave application submitted successfully!'
      });

    } catch (error: any) {
      console.error('Error creating leave application:', error);

      // ✅ HANDLE SCHEMA VALIDATION ERRORS
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Leave application validation error',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            received: err.input
          }))
        });
      }

      // ✅ DATABASE ERROR HANDLING
      if (error?.code === '23502') {
        return res.status(400).json({
          error: 'Missing required field',
          details: error.detail || error.message
        });
      }
      if (error?.code === '23505') {
        return res.status(400).json({
          error: 'Duplicate leave application',
          details: error.detail || error.message
        });
      }
      if (error?.code === '23503') {
        return res.status(400).json({
          error: 'Invalid user reference',
          details: 'User does not exist'
        });
      }

      res.status(500).json({
        error: 'Failed to create leave application',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Admin endpoint to approve/reject leave
  app.patch('/api/leave/:id/status', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status, adminRemarks } = req.body;

      // ✅ VALIDATE ID
      if (!id) {
        return res.status(400).json({ error: 'Leave application ID is required' });
      }

      // ✅ VALIDATE STATUS ENUM
      const validStatuses = ['Pending', 'Approved', 'Rejected'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          error: 'Invalid status',
          validStatuses: validStatuses,
          provided: status
        });
      }

      // ✅ VALIDATE ADMIN REMARKS LENGTH
      if (adminRemarks && adminRemarks.length > 500) {
        return res.status(400).json({ error: 'Admin remarks exceed 500 characters' });
      }

      // Check if leave application exists
      const existingLeave = await db.query.salesmanLeaveApplications.findFirst({
        where: eq(salesmanLeaveApplications.id, id)
      });

      if (!existingLeave) {
        return res.status(404).json({ error: 'Leave application not found' });
      }

      // ✅ PREPARE UPDATE DATA
      const updateData = {
        status: status,
        adminRemarks: adminRemarks || null,
        updatedAt: new Date() // ✅ Date object for timestamp
      };

      // Update leave status
      const result = await db.update(salesmanLeaveApplications)
        .set(updateData)
        .where(eq(salesmanLeaveApplications.id, id))
        .returning();

      res.json({
        success: true,
        data: result[0],
        message: `Leave application ${status.toLowerCase()} successfully`
      });

    } catch (error: any) {
      console.error('Error updating leave status:', error);

      // ✅ ERROR HANDLING
      if (error?.code === '23502') {
        return res.status(400).json({
          error: 'Missing required field for status update',
          details: error.detail || error.message
        });
      }

      res.status(500).json({
        error: 'Failed to update leave status',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get leave application by ID
  app.get('/api/leave/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // ✅ VALIDATE ID
      if (!id) {
        return res.status(400).json({ error: 'Leave application ID is required' });
      }

      const leave = await db.query.salesmanLeaveApplications.findFirst({
        where: eq(salesmanLeaveApplications.id, id),
        with: {
          user: {
            columns: { firstName: true, lastName: true, email: true, salesmanLoginId: true }
          }
        }
      });

      if (!leave) {
        return res.status(404).json({ error: 'Leave application not found' });
      }

      res.json({
        success: true,
        data: leave
      });
    } catch (error) {
      console.error('Error fetching leave application:', error);
      res.status(500).json({
        error: 'Failed to fetch leave application',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Cancel/Delete leave application (only if pending)
  app.delete('/api/leave/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { userId } = req.body;

      // ✅ VALIDATE INPUTS
      if (!id) {
        return res.status(400).json({ error: 'Leave application ID is required' });
      }

      if (!userId || isNaN(parseInt(userId))) {
        return res.status(400).json({ error: 'Valid user ID is required' });
      }

      // Check if leave exists
      const existingLeave = await db.query.salesmanLeaveApplications.findFirst({
        where: eq(salesmanLeaveApplications.id, id)
      });

      if (!existingLeave) {
        return res.status(404).json({ error: 'Leave application not found' });
      }

      // ✅ AUTHORIZATION CHECK
      if (existingLeave.userId !== parseInt(userId)) {
        return res.status(403).json({ error: 'You can only cancel your own leave applications' });
      }

      // ✅ BUSINESS LOGIC CHECK
      if (existingLeave.status !== 'Pending') {
        return res.status(400).json({
          error: `Cannot cancel ${existingLeave.status.toLowerCase()} leave application`
        });
      }

      // Delete the leave application
      await db.delete(salesmanLeaveApplications)
        .where(eq(salesmanLeaveApplications.id, id));

      res.json({
        success: true,
        message: 'Leave application cancelled successfully'
      });

    } catch (error) {
      console.error('Error cancelling leave application:', error);
      res.status(500).json({
        error: 'Failed to cancel leave application',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Bulk approve/reject multiple leave applications (Admin only)
  app.patch('/api/leave/bulk/status', async (req: Request, res: Response) => {
    try {
      const { leaveIds, status, adminRemarks } = req.body;

      // ✅ VALIDATE INPUTS
      if (!Array.isArray(leaveIds) || leaveIds.length === 0) {
        return res.status(400).json({ error: 'Leave IDs array is required' });
      }

      const validStatuses = ['Approved', 'Rejected'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          error: 'Invalid status for bulk operation',
          validStatuses: validStatuses
        });
      }

      if (adminRemarks && adminRemarks.length > 500) {
        return res.status(400).json({ error: 'Admin remarks exceed 500 characters' });
      }

      // ✅ PREPARE UPDATE DATA
      const updateData = {
        status: status,
        adminRemarks: adminRemarks || null,
        updatedAt: new Date()
      };

      // Update multiple leave applications
      const result = await db.update(salesmanLeaveApplications)
        .set(updateData)
        .where(and(
          inArray(salesmanLeaveApplications.id, leaveIds),
          eq(salesmanLeaveApplications.status, 'Pending') // Only update pending leaves
        ))
        .returning();

      res.json({
        success: true,
        updated: result.length,
        data: result,
        message: `${result.length} leave applications ${status.toLowerCase()} successfully`
      });

    } catch (error: any) {
      console.error('Error bulk updating leave status:', error);
      res.status(500).json({
        error: 'Failed to bulk update leave status',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get leave statistics for user
  app.get('/api/leave/stats/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { year = new Date().getFullYear() } = req.query;

      // ✅ VALIDATE USER ID
      const userIdInt = parseInt(userId);
      if (isNaN(userIdInt)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      // Get leave statistics for the year
      const startOfYear = `${year}-01-01`;
      const endOfYear = `${year}-12-31`;

      const leaves = await db.query.salesmanLeaveApplications.findMany({
        where: and(
          eq(salesmanLeaveApplications.userId, userIdInt),
          gte(salesmanLeaveApplications.startDate, startOfYear),
          lte(salesmanLeaveApplications.endDate, endOfYear)
        )
      });

      // Calculate statistics
      const stats = {
        total: leaves.length,
        pending: leaves.filter(l => l.status === 'Pending').length,
        approved: leaves.filter(l => l.status === 'Approved').length,
        rejected: leaves.filter(l => l.status === 'Rejected').length,
        totalDays: 0,
        approvedDays: 0
      };

      // Calculate total days
      leaves.forEach(leave => {
        const start = new Date(leave.startDate);
        const end = new Date(leave.endDate);
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        stats.totalDays += days;
        if (leave.status === 'Approved') {
          stats.approvedDays += days;
        }
      });

      res.json({
        success: true,
        year: parseInt(year as string),
        userId: userIdInt,
        stats: stats
      });

    } catch (error) {
      console.error('Error fetching leave statistics:', error);
      res.status(500).json({
        error: 'Failed to fetch leave statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ===== DAILY VISIT REPORTS (FIXED WITH SCHEMA VALIDATION) =====
  // Get recent DVR records
  // POST /api/dvr/create - Create DVR using AI generation
  // Helper functions for geofence validation
  const findDealerByLocation = async (userLat: number, userLng: number) => {
    const dealers = await db.query.dealers.findMany();

    for (const dealer of dealers) {
      if (dealer.area && dealer.area.startsWith('{')) {
        try {
          const coords = JSON.parse(dealer.area);
          const distance = calculateDistance(userLat, userLng, coords.lat, coords.lng);

          if (distance <= (coords.radius || 100)) {
            return dealer;
          }
        } catch (e) {
          continue;
        }
      }
    }
    return null;
  };

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c * 1000; // Distance in meters
  };

  app.post('/api/dvr/create', async (req: Request, res: Response) => {
    try {
      const { action, lat, lng, userId, conversationState, guidedResponses, prompt } = req.body;

      console.log('🔥 DVR REQUEST:', { action, lat, lng, userId, guidedResponsesKeys: Object.keys(guidedResponses || {}) });

      const latNum = parseFloat(lat);
      const lngNum = parseFloat(lng);

      if (isNaN(latNum) || isNaN(lngNum)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid GPS coordinates',
          agentMessage: 'Unable to get your location. Please enable GPS and try again.'
        });
      }

      // ✅ GEOFENCE VALIDATION - Check if user is within dealer location
      console.log(`🎯 Checking geofence for location: ${latNum}, ${lngNum}`);
      const nearbyDealer = await findDealerByLocation(latNum, lngNum);

      if (!nearbyDealer) {
        console.log('❌ GEOFENCE FAILED: No dealer found within 100m radius');
        return res.status(400).json({
          success: false,
          error: 'Not within dealer location',
          agentMessage: 'You must be within 100 meters of a dealer location to create a DVR. Please move closer to your dealer location and try again.',
          geofenceValidation: 'Failed',
          location: { lat: latNum, lng: lngNum }
        });
      }

      console.log(`✅ GEOFENCE PASSED: Found nearby dealer: ${nearbyDealer.name}`);

      // ✅ FIXED: Dynamic axios import
      const { default: axios } = await import('axios');
      const baseUrl = 'https://telesalesside.onrender.com';

      if (action === 'punch-in') {
        console.log('🔍 PUNCH-IN: Geofence passed, dealer auto-detected');

        // Since geofence validation passed, we already know the dealer
        return res.json({
          success: true,
          dealerFound: true,
          dealer: {
            id: nearbyDealer.id,
            name: nearbyDealer.name,
            type: nearbyDealer.type,
            region: nearbyDealer.region,
            area: nearbyDealer.area,
            latitude: latNum.toString(),
            longitude: lngNum.toString()
          },
          nextAction: 'dvr-questions',
          agentMessage: `Great! You're at ${nearbyDealer.name}. Let's create your DVR. What was the main purpose of your visit today?`,
          geofenceValidation: 'Passed'
        });
      }

      if (action === 'dealer-questions') {
        console.log('🔍 DEALER-QUESTIONS: Processing guided responses');

        // ✅ Since geofence passed, we already have a dealer at this location
        return res.json({
          success: true,
          dealerFound: true,
          dealer: {
            id: nearbyDealer.id,
            name: nearbyDealer.name,
            type: nearbyDealer.type,
            region: nearbyDealer.region
          },
          nextAction: 'dvr-questions',
          agentMessage: `You're already at an existing dealer: ${nearbyDealer.name}. Let's create your DVR instead. What was the main purpose of your visit today?`,
          geofenceValidation: 'Passed - Existing dealer found'
        });
      }

      if (action === 'dvr-questions') {
        console.log('🔍 DVR-QUESTIONS: Starting DVR creation process with geofence validation');

        // ✅ FIXED: Only require 1 response minimum
        if (!guidedResponses || Object.keys(guidedResponses).length < 1) {
          return res.json({
            success: true,
            nextQuestion: 'Please describe your visit: visit type (Best/Non Best), today\'s order amount (MT), collection amount (Rupees), brands discussed, contact person details, and any feedback.',
            questionNumber: 1,
            dealerInfo: {
              name: nearbyDealer.name,
              type: nearbyDealer.type
            }
          });
        }

        try {
          console.log('🔍 DVR-QUESTIONS: Using geofence-validated dealer:', nearbyDealer.name);

          // Use the geofence-validated dealer info
          const dealerInfo = {
            id: nearbyDealer.id,
            name: nearbyDealer.name,
            type: nearbyDealer.type,
            region: nearbyDealer.region,
            phoneNo: nearbyDealer.phoneNo,
            address: nearbyDealer.address,
            totalPotential: nearbyDealer.totalPotential,
            bestPotential: nearbyDealer.bestPotential,
            brandSelling: nearbyDealer.brandSelling || []
          };

          const dvrData = await aiService.generateDVRFromPromptWithContext(
            Object.values(guidedResponses).join(' '),
            dealerInfo,
            { latitude: latNum.toFixed(7), longitude: lngNum.toFixed(7), timestamp: new Date() }
          );

          console.log('🔥 AI GENERATED DVR DATA:', JSON.stringify(dvrData, null, 2));

          const safeInsertData = {
            userId: userId || 0,
            reportDate: dvrData.reportDate || new Date().toISOString().split('T')[0],
            dealerType: dvrData.dealerType || nearbyDealer.type || 'Dealer',
            dealerName: nearbyDealer.name,
            subDealerName: dvrData.subDealerName || null,
            location: nearbyDealer.address || `${nearbyDealer.name} Location`,
            latitude: latNum.toFixed(7),
            longitude: lngNum.toFixed(7),
            visitType: dvrData.visitType || 'Non Best',
            dealerTotalPotential: (Number(dvrData.dealerTotalPotential) || Number(nearbyDealer.totalPotential) || 0).toFixed(2),
            dealerBestPotential: (Number(dvrData.dealerBestPotential) || Number(nearbyDealer.bestPotential) || 0).toFixed(2),
            todayOrderMt: (Number(dvrData.todayOrderMt) || 0).toFixed(2),
            todayCollectionRupees: (Number(dvrData.todayCollectionRupees) || 0).toFixed(2),
            brandSelling: Array.isArray(dvrData.brandSelling) && dvrData.brandSelling.length > 0
              ? dvrData.brandSelling.map(String).filter(Boolean)
              : (Array.isArray(nearbyDealer.brandSelling) ? nearbyDealer.brandSelling : ['Unknown']),
            contactPerson: dvrData.contactPerson || null,
            contactPersonPhoneNo: dvrData.contactPersonPhoneNo || nearbyDealer.phoneNo || null,
            feedbacks: dvrData.feedbacks || 'Visit completed successfully with geofence validation',
            solutionBySalesperson: dvrData.solutionBySalesperson || null,
            anyRemarks: dvrData.anyRemarks || 'Created with geofence validation',
            checkInTime: new Date(),
            checkOutTime: null,
            inTimeImageUrl: dvrData.inTimeImageUrl || null,
            outTimeImageUrl: dvrData.outTimeImageUrl || null
          };

          console.log('🔍 DVR-QUESTIONS: Executing database insert...');

          const dvrRecord = await db.insert(dailyVisitReports).values(safeInsertData).returning();

          console.log('✅ DVR-QUESTIONS: Database insert successful!', dvrRecord[0]?.id);

          return res.json({
            success: true,
            dvrCreated: true,
            dvr: dvrRecord[0],
            dealerInfo: {
              name: nearbyDealer.name,
              type: nearbyDealer.type,
              region: nearbyDealer.region
            },
            agentMessage: `Perfect! Your Daily Visit Report for ${nearbyDealer.name} has been created successfully. Visit recorded with geofence validation and workflow complete!`,
            workflowComplete: true,
            geofenceValidation: 'Passed'
          });

        } catch (error) {
          console.error('🚨 DVR CREATION ERROR:', error);
          return res.status(400).json({
            error: 'Failed to create DVR',
            details: error.message,
            agentMessage: 'I couldn\'t create the DVR. Please provide more details about your visit including order amounts and visit purpose.'
          });
        }
      }

      // ✅ ADDED: Handle unknown actions
      return res.status(400).json({
        success: false,
        error: 'Invalid action',
        agentMessage: 'Please specify a valid action: punch-in, dealer-questions, or dvr-questions.'
      });

    } catch (error) {
      console.error('🚨 DVR WORKFLOW ERROR:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process DVR workflow',
        details: error.message
      });
    }
  });
  app.get('/api/dvr/recent', async (req: Request, res: Response) => {
    try {
      const { limit = 10, userId, dealerType } = req.query;

      // ✅ SAFE: Validate limit parameter
      const limitInt = parseInt(limit as string);
      if (isNaN(limitInt) || limitInt < 1 || limitInt > 1000) {
        return res.status(400).json({
          error: 'Invalid limit. Must be between 1 and 1000'
        });
      }

      // ✅ SAFE: Build where clause with proper validation
      let whereClause = undefined;

      if (userId) {
        const userIdInt = parseInt(userId as string);
        if (isNaN(userIdInt)) {
          return res.status(400).json({ error: 'Invalid user ID' });
        }
        whereClause = eq(dailyVisitReports.userId, userIdInt);
      }

      if (dealerType) {
        // ✅ SAFE: Validate dealerType enum
        const validDealerTypes = ['Dealer', 'Sub Dealer'];
        if (!validDealerTypes.includes(dealerType as string)) {
          return res.status(400).json({
            error: 'Invalid dealer type. Must be "Dealer" or "Sub Dealer"'
          });
        }

        whereClause = whereClause
          ? and(whereClause, eq(dailyVisitReports.dealerType, dealerType as string))
          : eq(dailyVisitReports.dealerType, dealerType as string);
      }

      // ✅ SAFE: Fetch with schema-compliant fields
      const reports = await db.query.dailyVisitReports.findMany({
        where: whereClause,
        orderBy: [desc(dailyVisitReports.reportDate), desc(dailyVisitReports.createdAt)],
        limit: limitInt,
        columns: {
          id: true,
          userId: true,
          reportDate: true,
          dealerType: true,
          dealerName: true,
          subDealerName: true,
          location: true,
          latitude: true,
          longitude: true,
          visitType: true,
          dealerTotalPotential: true,
          dealerBestPotential: true,
          brandSelling: true,
          contactPerson: true,
          contactPersonPhoneNo: true,
          todayOrderMt: true,
          todayCollectionRupees: true,
          feedbacks: true,
          solutionBySalesperson: true,
          anyRemarks: true,
          checkInTime: true,
          checkOutTime: true,
          inTimeImageUrl: true,
          outTimeImageUrl: true,
          createdAt: true,
          updatedAt: true
        },
        with: {
          user: {
            columns: { firstName: true, lastName: true, salesmanLoginId: true }
          }
        }
      });

      // ✅ SAFE: Enhanced response with metadata
      res.json({
        success: true,
        data: reports,
        total: reports.length,
        filters: {
          userId: userId ? parseInt(userId as string) : null,
          dealerType: dealerType || null,
          limit: limitInt
        },
        message: `Found ${reports.length} DVR reports`
      });

    } catch (error: any) {
      console.error('Error fetching DVR reports:', error);

      // ✅ SAFE: Enhanced error handling
      if (error?.code === '42P01') {
        return res.status(500).json({
          error: 'Database table not found',
          details: 'daily_visit_reports table may not exist'
        });
      }

      if (error?.code === '42703') {
        return res.status(500).json({
          error: 'Database column error',
          details: 'One or more columns may not exist in daily_visit_reports table'
        });
      }

      if (error?.code === '23503') {
        return res.status(400).json({
          error: 'Invalid reference',
          details: 'Referenced user may not exist'
        });
      }

      res.status(500).json({
        error: 'Failed to fetch DVR reports',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/api/dvr/:reportId', async (req: Request, res: Response) => {
    try {
      // 🎨 DIAGNOSTIC: Log the incoming parameters to see if the ID is present.
      //console.log('Fetching DVR report. Request parameters:', req.params);

      const { reportId } = req.params;

      // 🎨 FIX: The database ID is a string (UUID), so we should not use parseInt().
      // We will use the string ID directly from the URL.
      if (!reportId) {
        return res.status(400).json({
          error: 'Invalid report ID',
          // Return the parameters to help debug the issue.
          receivedParams: req.params
        });
      }

      // ✅ Fetch the report from the database using the string ID
      const report = await db.query.dailyVisitReports.findFirst({
        where: eq(dailyVisitReports.id, reportId)
      });

      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }

      // ✅ Return the full report data, including remarks
      res.json({ success: true, data: report });
    } catch (error) {
      console.error('Error fetching DVR report:', error);
      res.status(500).json({ error: 'Failed to get DVR report' });
    }
  });

  //manul DVR form submission route 
  app.post('/api/dvr-manual', async (req: Request, res: Response) => {
    try {
      console.log('1. Raw request body:', req.body);
      const manualData = req.body;
      const alsoCreateClientReport = true; // Hardcoding this for the test

      // ✅ MANUAL DVR CREATION WITH PROPER TYPES
      const dvrData = {
        userId: parseInt(manualData.userId || 1),
        reportDate: manualData.reportDate
          ? new Date(manualData.reportDate).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0], // ✅ Date string
        dealerType: manualData.dealerType || "Dealer",
        dealerName: manualData.dealerName || null,
        subDealerName: manualData.subDealerName || null,
        location: manualData.location || "",
        latitude: (manualData.latitude || 0).toString(), // ✅ Decimal as string
        longitude: (manualData.longitude || 0).toString(), // ✅ Decimal as string
        visitType: manualData.visitType || "Best",
        dealerTotalPotential: (manualData.dealerTotalPotential || 0).toString(), // ✅ Decimal as string
        dealerBestPotential: (manualData.dealerBestPotential || 0).toString(), // ✅ Decimal as string
        brandSelling: Array.isArray(manualData.brandSelling) ? manualData.brandSelling : [], // ✅ Array
        contactPerson: manualData.contactPerson || null,
        contactPersonPhoneNo: manualData.contactPersonPhoneNo || null,
        todayOrderMt: (manualData.todayOrderMt || 0).toString(), // ✅ Decimal as string
        todayCollectionRupees: (manualData.todayCollectionRupees || 0).toString(), // ✅ Decimal as string
        feedbacks: manualData.feedbacks || "",
        solutionBySalesperson: manualData.solutionBySalesperson || null,
        anyRemarks: manualData.anyRemarks || null,
        checkInTime: manualData.checkInTime ? new Date(manualData.checkInTime) : new Date(), // ✅ Timestamp
        checkOutTime: manualData.checkOutTime ? new Date(manualData.checkOutTime) : null, // ✅ Timestamp or null
        inTimeImageUrl: manualData.inTimeImageUrl || null,
        outTimeImageUrl: manualData.outTimeImageUrl || null
      };

      console.log('2. dvrData object before validation:', dvrData);

      // ✅ USE SCHEMA VALIDATION INSTEAD OF MANUAL VALIDATION
      const validatedData = insertDailyVisitReportSchema.parse(dvrData);
      console.log('3. Validated data for DVR insertion:', validatedData);

      // ✅ CREATE PRIMARY DVR WITH VALIDATED DATA
      const dvrResult = await db.insert(dailyVisitReports).values(validatedData).returning();

      // 🔄 HYBRID: Auto-create client report if requested
      let clientReportResult = null;
      if (alsoCreateClientReport) {
        try {
          const clientReportData = {
            dealerType: validatedData.dealerType,
            dealerSubDealerName: validatedData.dealerName + (validatedData.subDealerName ? ` / ${validatedData.subDealerName}` : ''),
            location: validatedData.location,
            typeBestNonBest: validatedData.visitType,
            dealerTotalPotential: validatedData.dealerTotalPotential,
            dealerBestPotential: validatedData.dealerBestPotential,
            brandSelling: validatedData.brandSelling,
            contactPerson: validatedData.contactPerson,
            contactPersonPhoneNo: validatedData.contactPersonPhoneNo,
            todayOrderMT: validatedData.todayOrderMt, // Note: MT vs Mt conversion
            todayCollection: validatedData.todayCollectionRupees,
            feedbacks: validatedData.feedbacks,
            solutionsAsPerSalesperson: validatedData.solutionBySalesperson,
            anyRemarks: validatedData.anyRemarks,
            checkOutTime: validatedData.checkOutTime || new Date(),
            userId: validatedData.userId
          };

          // Note: You would need insertClientReportSchema for this too
          clientReportResult = await db.insert(clientReports).values(clientReportData).returning();
        } catch (clientError) {
          console.warn('Failed to create client report:', clientError);
          // Don't fail the whole operation if client report fails
        }
      }

      res.status(201).json({
        success: true,
        primaryDVR: dvrResult[0],
        clientReport: clientReportResult?.[0] || null,
        message: 'DVR created successfully!',
        hybrid: alsoCreateClientReport ? 'Client report also created' : 'DVR only'
      });

    } catch (error: any) {
      console.error('Error in DVR manual-v2 submission route:', error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'DVR validation error',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }

      res.status(500).json({
        error: 'Failed to create DVR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });


  // ✅ CHECKOUT ENDPOINT WITH VALIDATION
  app.patch('/api/dvr/:id/checkout', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { outTimeImageUrl } = req.body;

      // ✅ VALIDATE ID
      if (!id) {
        return res.status(400).json({ error: 'DVR ID is required' });
      }

      // ✅ VALIDATE IMAGE URL LENGTH
      if (outTimeImageUrl && outTimeImageUrl.length > 500) {
        return res.status(400).json({ error: 'Image URL exceeds 500 characters' });
      }

      // ✅ PREPARE UPDATE DATA
      const updateData = {
        checkOutTime: new Date(), // ✅ Timestamp
        outTimeImageUrl: outTimeImageUrl || null,
        updatedAt: new Date() // ✅ Timestamp
      };

      const result = await db
        .update(dailyVisitReports)
        .set(updateData)
        .where(eq(dailyVisitReports.id, id))
        .returning();

      if (result.length === 0) {
        return res.status(404).json({ error: 'Daily visit report not found' });
      }

      res.json({
        success: true,
        data: result[0],
        message: 'Successfully checked out from visit'
      });

    } catch (error: any) {
      console.error('Error updating checkout time:', error);
      res.status(500).json({
        error: 'Failed to update checkout time',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ===== CLIENT REPORTS ENDPOINTS (COMPLETE SET WITH SCHEMA VALIDATION) =====
  // Get recent client reports
  app.get('/api/client-reports/recent', async (req: Request, res: Response) => {
    try {
      const { limit = 10, userId, dealerType } = req.query;

      let whereClause = undefined;

      if (userId) {
        whereClause = eq(clientReports.userId, parseInt(userId as string));
      }

      if (dealerType) {
        const dealerClause = eq(clientReports.dealerType, dealerType as string);
        whereClause = whereClause ? and(whereClause, dealerClause) : dealerClause;
      }

      const reports = await db.query.clientReports.findMany({
        where: whereClause,
        orderBy: [desc(clientReports.createdAt)],
        limit: parseInt(limit as string),
        with: {
          user: {
            columns: { firstName: true, lastName: true, salesmanLoginId: true }
          }
        }
      });

      res.json({
        success: true,
        data: reports,
        total: reports.length
      });
    } catch (error) {
      console.error('Error fetching client reports:', error);
      res.status(500).json({
        error: 'Failed to fetch client reports',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get client reports for specific user
  app.get('/api/client-reports/user/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { limit = 20 } = req.query;

      // ✅ VALIDATE USER ID
      const userIdInt = parseInt(userId);
      if (isNaN(userIdInt)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      const reports = await db.query.clientReports.findMany({
        where: eq(clientReports.userId, userIdInt),
        orderBy: [desc(clientReports.createdAt)],
        limit: parseInt(limit as string),
        with: {
          user: {
            columns: { firstName: true, lastName: true, salesmanLoginId: true }
          }
        }
      });

      res.json({
        success: true,
        data: reports,
        total: reports.length
      });
    } catch (error) {
      console.error('Error fetching user client reports:', error);
      res.status(500).json({
        error: 'Failed to fetch user client reports',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Create new client report (FIXED WITH SCHEMA VALIDATION)
  app.post('/api/client-reports', async (req: Request, res: Response) => {
    try {
      const { linkToDVR, dvrId, ...clientData } = req.body;

      let finalClientData = clientData;

      // 🔗 HYBRID: If linking to existing DVR, pull data from it
      if (linkToDVR && dvrId) {
        const existingDVR = await db.query.dailyVisitReports.findFirst({
          where: eq(dailyVisitReports.id, dvrId)
        });

        if (existingDVR) {
          finalClientData = {
            dealerType: existingDVR.dealerType,
            dealerSubDealerName: existingDVR.dealerName + (existingDVR.subDealerName ? ` / ${existingDVR.subDealerName}` : ''),
            location: existingDVR.location,
            typeBestNonBest: existingDVR.visitType,
            dealerTotalPotential: existingDVR.dealerTotalPotential, // Already string from DVR
            dealerBestPotential: existingDVR.dealerBestPotential, // Already string from DVR
            brandSelling: existingDVR.brandSelling,
            contactPerson: existingDVR.contactPerson || "Not specified", // NOT NULL in schema
            contactPersonPhoneNo: existingDVR.contactPersonPhoneNo || "0000000000", // NOT NULL in schema
            todayOrderMT: existingDVR.todayOrderMt, // Already string from DVR
            todayCollection: existingDVR.todayCollectionRupees, // Already string from DVR
            feedbacks: existingDVR.feedbacks,
            solutionsAsPerSalesperson: existingDVR.solutionBySalesperson || "No solutions provided", // NOT NULL in schema
            anyRemarks: existingDVR.anyRemarks || "No remarks", // NOT NULL in schema
            userId: existingDVR.userId,
            ...clientData // Allow overrides
          };
        }
      }

      // ✅ PREPARE DATA FOR SCHEMA VALIDATION
      const insertData = {
        dealerType: finalClientData.dealerType,
        dealerSubDealerName: finalClientData.dealerSubDealerName,
        location: finalClientData.location,
        typeBestNonBest: finalClientData.typeBestNonBest,
        dealerTotalPotential: (finalClientData.dealerTotalPotential || 0).toString(), // ✅ Decimal as string
        dealerBestPotential: (finalClientData.dealerBestPotential || 0).toString(), // ✅ Decimal as string
        brandSelling: Array.isArray(finalClientData.brandSelling) ? finalClientData.brandSelling : [], // ✅ Array
        contactPerson: finalClientData.contactPerson,
        contactPersonPhoneNo: finalClientData.contactPersonPhoneNo,
        todayOrderMT: (finalClientData.todayOrderMT || 0).toString(), // ✅ Decimal as string
        todayCollection: (finalClientData.todayCollection || 0).toString(), // ✅ Decimal as string
        feedbacks: finalClientData.feedbacks,
        solutionsAsPerSalesperson: finalClientData.solutionsAsPerSalesperson,
        anyRemarks: finalClientData.anyRemarks,
        checkOutTime: finalClientData.checkOutTime ? new Date(finalClientData.checkOutTime) : new Date(), // ✅ Timestamp
        userId: parseInt(finalClientData.userId || 1)
      };

      // ✅ USE SCHEMA VALIDATION INSTEAD OF MANUAL VALIDATION
      const validatedData = insertClientReportSchema.parse(insertData);

      // ✅ INSERT WITH VALIDATED DATA
      const result = await db.insert(clientReports).values(validatedData).returning();

      res.status(201).json({
        success: true,
        data: result[0],
        linkedToDVR: linkToDVR && dvrId ? dvrId : null,
        message: 'Client report created successfully!'
      });

    } catch (error: any) {
      console.error('Error creating client report:', error);

      // ✅ HANDLE SCHEMA VALIDATION ERRORS
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Client report validation error',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            received: err.input
          }))
        });
      }

      // ✅ DATABASE ERROR HANDLING
      if (error?.code === '23502') { // NOT NULL violation
        return res.status(400).json({
          error: 'Missing required field',
          details: error.detail || error.message
        });
      }
      if (error?.code === '23505') { // Unique violation
        return res.status(400).json({
          error: 'Duplicate client report entry',
          details: error.detail || error.message
        });
      }
      if (error?.code === '23503') { // Foreign key violation
        return res.status(400).json({
          error: 'Invalid user reference',
          details: 'User does not exist'
        });
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      res.status(500).json({
        error: 'Failed to create client report',
        details: errorMessage
      });
    }
  });

  // Get client report by ID
  app.get('/api/client-reports/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // ✅ VALIDATE ID
      if (!id) {
        return res.status(400).json({ error: 'Client report ID is required' });
      }

      const report = await db.query.clientReports.findFirst({
        where: eq(clientReports.id, id),
        with: {
          user: {
            columns: { firstName: true, lastName: true, email: true, salesmanLoginId: true }
          }
        }
      });

      if (!report) {
        return res.status(404).json({ error: 'Client report not found' });
      }

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      console.error('Error fetching client report:', error);
      res.status(500).json({
        error: 'Failed to fetch client report',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Update client report
  app.put('/api/client-reports/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // ✅ VALIDATE ID
      if (!id) {
        return res.status(400).json({ error: 'Client report ID is required' });
      }

      // Check if report exists
      const existingReport = await db.query.clientReports.findFirst({
        where: eq(clientReports.id, id)
      });

      if (!existingReport) {
        return res.status(404).json({ error: 'Client report not found' });
      }

      // ✅ PREPARE UPDATE DATA WITH PROPER TYPES
      const finalUpdateData = {
        dealerType: updateData.dealerType || existingReport.dealerType,
        dealerSubDealerName: updateData.dealerSubDealerName || existingReport.dealerSubDealerName,
        location: updateData.location || existingReport.location,
        typeBestNonBest: updateData.typeBestNonBest || existingReport.typeBestNonBest,
        dealerTotalPotential: updateData.dealerTotalPotential ? updateData.dealerTotalPotential.toString() : existingReport.dealerTotalPotential,
        dealerBestPotential: updateData.dealerBestPotential ? updateData.dealerBestPotential.toString() : existingReport.dealerBestPotential,
        brandSelling: Array.isArray(updateData.brandSelling) ? updateData.brandSelling : existingReport.brandSelling,
        contactPerson: updateData.contactPerson || existingReport.contactPerson,
        contactPersonPhoneNo: updateData.contactPersonPhoneNo || existingReport.contactPersonPhoneNo,
        todayOrderMT: updateData.todayOrderMT ? updateData.todayOrderMT.toString() : existingReport.todayOrderMT,
        todayCollection: updateData.todayCollection ? updateData.todayCollection.toString() : existingReport.todayCollection,
        feedbacks: updateData.feedbacks || existingReport.feedbacks,
        solutionsAsPerSalesperson: updateData.solutionsAsPerSalesperson || existingReport.solutionsAsPerSalesperson,
        anyRemarks: updateData.anyRemarks || existingReport.anyRemarks,
        checkOutTime: updateData.checkOutTime ? new Date(updateData.checkOutTime) : existingReport.checkOutTime,
        updatedAt: new Date() // ✅ Update timestamp
      };

      // Update the report
      const result = await db.update(clientReports)
        .set(finalUpdateData)
        .where(eq(clientReports.id, id))
        .returning();

      res.json({
        success: true,
        data: result[0],
        message: 'Client report updated successfully!'
      });

    } catch (error: any) {
      console.error('Error updating client report:', error);

      // ✅ ERROR HANDLING
      if (error?.code === '23502') {
        return res.status(400).json({
          error: 'Missing required field for update',
          details: error.detail || error.message
        });
      }

      res.status(500).json({
        error: 'Failed to update client report',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Delete client report
  app.delete('/api/client-reports/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { userId } = req.body;

      // ✅ VALIDATE INPUTS
      if (!id) {
        return res.status(400).json({ error: 'Client report ID is required' });
      }

      // Check if report exists
      const existingReport = await db.query.clientReports.findFirst({
        where: eq(clientReports.id, id)
      });

      if (!existingReport) {
        return res.status(404).json({ error: 'Client report not found' });
      }

      // ✅ AUTHORIZATION CHECK (if userId provided)
      if (userId && existingReport.userId !== parseInt(userId)) {
        return res.status(403).json({ error: 'You can only delete your own client reports' });
      }

      // Delete the report
      await db.delete(clientReports)
        .where(eq(clientReports.id, id));

      res.json({
        success: true,
        message: 'Client report deleted successfully'
      });

    } catch (error) {
      console.error('Error deleting client report:', error);
      res.status(500).json({
        error: 'Failed to delete client report',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get client report statistics
  app.get('/api/client-reports/stats/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { startDate, endDate } = req.query;

      // ✅ VALIDATE USER ID
      const userIdInt = parseInt(userId);
      if (isNaN(userIdInt)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      let whereClause = eq(clientReports.userId, userIdInt);

      // Add date range filter if provided
      if (startDate && endDate) {
        whereClause = and(
          whereClause,
          gte(clientReports.createdAt, new Date(startDate as string)),
          lte(clientReports.createdAt, new Date(endDate as string))
        );
      }

      const reports = await db.query.clientReports.findMany({
        where: whereClause
      });

      // Calculate statistics
      const stats = {
        totalReports: reports.length,
        dealerTypes: {
          dealer: reports.filter(r => r.dealerType === 'Dealer').length,
          subDealer: reports.filter(r => r.dealerType === 'Sub Dealer').length
        },
        visitTypes: {
          best: reports.filter(r => r.typeBestNonBest === 'Best').length,
          nonBest: reports.filter(r => r.typeBestNonBest === 'Non Best').length
        },
        totalOrderValue: reports.reduce((sum, r) => sum + parseFloat(r.todayOrderMT || '0'), 0),
        totalCollection: reports.reduce((sum, r) => sum + parseFloat(r.todayCollection || '0'), 0),
        totalPotential: reports.reduce((sum, r) => sum + parseFloat(r.dealerTotalPotential || '0'), 0)
      };

      res.json({
        success: true,
        userId: userIdInt,
        dateRange: { startDate, endDate },
        stats: stats
      });

    } catch (error) {
      console.error('Error fetching client report statistics:', error);
      res.status(500).json({
        error: 'Failed to fetch client report statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Create client report from DVR (dedicated endpoint)
  app.post('/api/client-reports/from-dvr/:dvrId', async (req: Request, res: Response) => {
    try {
      const { dvrId } = req.params;
      const overrides = req.body; // Allow field overrides

      // ✅ VALIDATE DVR ID
      if (!dvrId) {
        return res.status(400).json({ error: 'DVR ID is required' });
      }

      // Get DVR data
      const existingDVR = await db.query.dailyVisitReports.findFirst({
        where: eq(dailyVisitReports.id, dvrId)
      });

      if (!existingDVR) {
        return res.status(404).json({ error: 'DVR not found' });
      }

      // ✅ MAP DVR DATA TO CLIENT REPORT FORMAT
      const clientReportData = {
        dealerType: existingDVR.dealerType,
        dealerSubDealerName: existingDVR.dealerName + (existingDVR.subDealerName ? ` / ${existingDVR.subDealerName}` : ''),
        location: existingDVR.location,
        typeBestNonBest: existingDVR.visitType,
        dealerTotalPotential: existingDVR.dealerTotalPotential, // Already string
        dealerBestPotential: existingDVR.dealerBestPotential, // Already string
        brandSelling: existingDVR.brandSelling,
        contactPerson: existingDVR.contactPerson || "Not specified",
        contactPersonPhoneNo: existingDVR.contactPersonPhoneNo || "0000000000",
        todayOrderMT: existingDVR.todayOrderMt, // Already string
        todayCollection: existingDVR.todayCollectionRupees, // Already string
        feedbacks: existingDVR.feedbacks,
        solutionsAsPerSalesperson: existingDVR.solutionBySalesperson || "No solutions provided",
        anyRemarks: existingDVR.anyRemarks || "Auto-generated from DVR",
        checkOutTime: existingDVR.checkOutTime || new Date(),
        userId: existingDVR.userId,
        ...overrides // Allow field overrides
      };

      // ✅ USE SCHEMA VALIDATION
      const validatedData = insertClientReportSchema.parse(clientReportData);

      // ✅ INSERT WITH VALIDATED DATA
      const result = await db.insert(clientReports).values(validatedData).returning();

      res.status(201).json({
        success: true,
        data: result[0],
        sourceDVR: dvrId,
        message: 'Client report created from DVR successfully!'
      });

    } catch (error: any) {
      console.error('Error creating client report from DVR:', error);

      // ✅ HANDLE SCHEMA VALIDATION ERRORS
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Client report validation error',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            received: err.input
          }))
        });
      }

      res.status(500).json({
        error: 'Failed to create client report from DVR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ===== COMPETITION REPORTS ENDPOINTS (COMPLETE SET WITH SCHEMA VALIDATION) =====
  // Get recent competition reports
  app.get('/api/competition/recent', async (req: Request, res: Response) => {
    try {
      const { limit = 10, userId, brandName } = req.query;

      let whereClause = undefined;

      if (userId) {
        whereClause = eq(competitionReports.userId, parseInt(userId as string));
      }

      if (brandName) {
        const brandClause = ilike(competitionReports.brandName, `%${brandName}%`);
        whereClause = whereClause ? and(whereClause, brandClause) : brandClause;
      }

      const reports = await db.query.competitionReports.findMany({
        where: whereClause,
        orderBy: [desc(competitionReports.reportDate), desc(competitionReports.createdAt)],
        limit: parseInt(limit as string),
        with: {
          user: {
            columns: { firstName: true, lastName: true, salesmanLoginId: true }
          }
        }
      });

      res.json({
        success: true,
        data: reports,
        total: reports.length
      });
    } catch (error) {
      console.error('Error fetching competition reports:', error);
      res.status(500).json({
        error: 'Failed to fetch competition reports',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get competition reports for specific user
  app.get('/api/competition/user/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { limit = 20, brandName } = req.query;

      // ✅ VALIDATE USER ID
      const userIdInt = parseInt(userId);
      if (isNaN(userIdInt)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      let whereClause = eq(competitionReports.userId, userIdInt);

      if (brandName) {
        whereClause = and(whereClause, ilike(competitionReports.brandName, `%${brandName}%`));
      }

      const reports = await db.query.competitionReports.findMany({
        where: whereClause,
        orderBy: [desc(competitionReports.reportDate), desc(competitionReports.createdAt)],
        limit: parseInt(limit as string),
        with: {
          user: {
            columns: { firstName: true, lastName: true, salesmanLoginId: true }
          }
        }
      });

      res.json({
        success: true,
        data: reports,
        total: reports.length
      });
    } catch (error) {
      console.error('Error fetching user competition reports:', error);
      res.status(500).json({
        error: 'Failed to fetch user competition reports',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Create new competition report (FIXED WITH SCHEMA VALIDATION)
  app.post('/api/competition', async (req: Request, res: Response) => {
    try {
      const { useAI, userInput, ...manualData } = req.body;

      let competitionData;

      if (useAI && userInput) {
        // 🤖 AI MAGIC BUTTON - Generate Competition Report from input
        console.log('🏢 Using AI to generate Competition Report from input:', userInput);

        const aiGeneratedData = await aiService.generateCompetitionAnalysis({
          brandName: req.body.brandName || "Competitor Brand",
          competitorInfo: userInput,
          marketObservation: userInput,
          reportDate: new Date().toISOString().split('T')[0]
        });

        // ✅ SCHEMA-COMPLIANT DATA MAPPING
        competitionData = {
          userId: parseInt(req.body.userId || 1),
          reportDate: new Date().toISOString().split('T')[0], // ✅ Date string for schema
          brandName: req.body.brandName || aiGeneratedData.brandName || "Competitor Brand",
          billing: aiGeneratedData.billing || "Not specified",
          nod: aiGeneratedData.nod || "Not specified",
          retail: aiGeneratedData.retail || "Not specified",
          schemesYesNo: aiGeneratedData.hasSchemes === true ? "Yes" : "No", // ✅ Map boolean to string
          avgSchemeCost: (aiGeneratedData.avgSchemeCost || 0).toString(), // ✅ Decimal as string
          remarks: aiGeneratedData.remarks || userInput || null
        };
      } else {
        // ✅ MANUAL COMPETITION REPORT CREATION WITH PROPER TYPES
        competitionData = {
          userId: parseInt(manualData.userId || req.body.userId || 1),
          reportDate: manualData.reportDate
            ? new Date(manualData.reportDate).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0], // ✅ Date string
          brandName: manualData.brandName,
          billing: manualData.billing,
          nod: manualData.nod,
          retail: manualData.retail,
          schemesYesNo: manualData.schemesYesNo,
          avgSchemeCost: (manualData.avgSchemeCost || 0).toString(), // ✅ Decimal as string
          remarks: manualData.remarks || null
        };
      }

      // ✅ USE SCHEMA VALIDATION INSTEAD OF MANUAL VALIDATION
      const validatedData = insertCompetitionReportSchema.parse(competitionData);

      // ✅ INSERT WITH VALIDATED DATA
      const result = await db.insert(competitionReports).values(validatedData).returning();

      res.status(201).json({
        success: true,
        data: result[0],
        aiGenerated: useAI && userInput ? true : false,
        message: useAI ? '🏢 Competition report created with AI assistance!' : 'Competition report created successfully!'
      });

    } catch (error: any) {
      console.error('Error creating competition report:', error);

      // ✅ HANDLE SCHEMA VALIDATION ERRORS
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Competition report validation error',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            received: err.input
          }))
        });
      }

      // ✅ DATABASE ERROR HANDLING
      if (error?.code === '23502') { // NOT NULL violation
        return res.status(400).json({
          error: 'Missing required field',
          details: error.detail || error.message
        });
      }
      if (error?.code === '23505') { // Unique violation
        return res.status(400).json({
          error: 'Duplicate competition report entry',
          details: error.detail || error.message
        });
      }
      if (error?.code === '23503') { // Foreign key violation
        return res.status(400).json({
          error: 'Invalid user reference',
          details: 'User does not exist'
        });
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      res.status(500).json({
        error: 'Failed to create competition report',
        details: errorMessage
      });
    }
  });

  // Get competition report by ID
  app.get('/api/competition/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // ✅ VALIDATE ID
      if (!id) {
        return res.status(400).json({ error: 'Competition report ID is required' });
      }

      const report = await db.query.competitionReports.findFirst({
        where: eq(competitionReports.id, id),
        with: {
          user: {
            columns: { firstName: true, lastName: true, email: true, salesmanLoginId: true }
          }
        }
      });

      if (!report) {
        return res.status(404).json({ error: 'Competition report not found' });
      }

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      console.error('Error fetching competition report:', error);
      res.status(500).json({
        error: 'Failed to fetch competition report',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Update competition report
  app.put('/api/competition/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // ✅ VALIDATE ID
      if (!id) {
        return res.status(400).json({ error: 'Competition report ID is required' });
      }

      // Check if report exists
      const existingReport = await db.query.competitionReports.findFirst({
        where: eq(competitionReports.id, id)
      });

      if (!existingReport) {
        return res.status(404).json({ error: 'Competition report not found' });
      }

      // ✅ PREPARE UPDATE DATA WITH PROPER TYPES
      const finalUpdateData = {
        reportDate: updateData.reportDate
          ? new Date(updateData.reportDate).toISOString().split('T')[0]
          : existingReport.reportDate,
        brandName: updateData.brandName || existingReport.brandName,
        billing: updateData.billing || existingReport.billing,
        nod: updateData.nod || existingReport.nod,
        retail: updateData.retail || existingReport.retail,
        schemesYesNo: updateData.schemesYesNo || existingReport.schemesYesNo,
        avgSchemeCost: updateData.avgSchemeCost
          ? updateData.avgSchemeCost.toString()
          : existingReport.avgSchemeCost,
        remarks: updateData.remarks !== undefined ? updateData.remarks : existingReport.remarks,
        updatedAt: new Date() // ✅ Update timestamp
      };

      // ✅ VALIDATE SCHEMES ENUM IF PROVIDED
      if (updateData.schemesYesNo) {
        const validSchemes = ['Yes', 'No'];
        if (!validSchemes.includes(updateData.schemesYesNo)) {
          return res.status(400).json({
            error: 'Invalid schemes value',
            validValues: validSchemes,
            provided: updateData.schemesYesNo
          });
        }
      }

      // Update the report
      const result = await db.update(competitionReports)
        .set(finalUpdateData)
        .where(eq(competitionReports.id, id))
        .returning();

      res.json({
        success: true,
        data: result[0],
        message: 'Competition report updated successfully!'
      });

    } catch (error: any) {
      console.error('Error updating competition report:', error);

      // ✅ ERROR HANDLING
      if (error?.code === '23502') {
        return res.status(400).json({
          error: 'Missing required field for update',
          details: error.detail || error.message
        });
      }

      res.status(500).json({
        error: 'Failed to update competition report',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Delete competition report
  app.delete('/api/competition/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { userId } = req.body;

      // ✅ VALIDATE INPUTS
      if (!id) {
        return res.status(400).json({ error: 'Competition report ID is required' });
      }

      // Check if report exists
      const existingReport = await db.query.competitionReports.findFirst({
        where: eq(competitionReports.id, id)
      });

      if (!existingReport) {
        return res.status(404).json({ error: 'Competition report not found' });
      }

      // ✅ AUTHORIZATION CHECK (if userId provided)
      if (userId && existingReport.userId !== parseInt(userId)) {
        return res.status(403).json({ error: 'You can only delete your own competition reports' });
      }

      // Delete the report
      await db.delete(competitionReports)
        .where(eq(competitionReports.id, id));

      res.json({
        success: true,
        message: 'Competition report deleted successfully'
      });

    } catch (error) {
      console.error('Error deleting competition report:', error);
      res.status(500).json({
        error: 'Failed to delete competition report',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get competition analysis/statistics
  app.get('/api/competition/analysis/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { startDate, endDate, brandName } = req.query;

      // ✅ VALIDATE USER ID
      const userIdInt = parseInt(userId);
      if (isNaN(userIdInt)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      let whereClause = eq(competitionReports.userId, userIdInt);

      // Add filters
      if (startDate && endDate) {
        whereClause = and(
          whereClause,
          gte(competitionReports.reportDate, startDate as string),
          lte(competitionReports.reportDate, endDate as string)
        );
      }

      if (brandName) {
        whereClause = and(whereClause, ilike(competitionReports.brandName, `%${brandName}%`));
      }

      const reports = await db.query.competitionReports.findMany({
        where: whereClause,
        orderBy: [desc(competitionReports.reportDate)]
      });

      // Calculate analytics
      const analysis = {
        totalReports: reports.length,
        uniqueBrands: [...new Set(reports.map(r => r.brandName))].length,
        schemesAnalysis: {
          withSchemes: reports.filter(r => r.schemesYesNo === 'Yes').length,
          withoutSchemes: reports.filter(r => r.schemesYesNo === 'No').length
        },
        avgSchemeCost: {
          overall: reports.reduce((sum, r) => sum + parseFloat(r.avgSchemeCost || '0'), 0) / reports.length || 0,
          withSchemes: (() => {
            const withSchemes = reports.filter(r => r.schemesYesNo === 'Yes');
            return withSchemes.length > 0
              ? withSchemes.reduce((sum, r) => sum + parseFloat(r.avgSchemeCost || '0'), 0) / withSchemes.length
              : 0;
          })()
        },
        brandBreakdown: reports.reduce((acc, report) => {
          const brand = report.brandName;
          if (!acc[brand]) {
            acc[brand] = {
              count: 0,
              withSchemes: 0,
              avgSchemeCost: 0
            };
          }
          acc[brand].count++;
          if (report.schemesYesNo === 'Yes') {
            acc[brand].withSchemes++;
          }
          acc[brand].avgSchemeCost += parseFloat(report.avgSchemeCost || '0');
          return acc;
        }, {} as Record<string, any>),
        recentTrends: reports.slice(0, 5).map(r => ({
          date: r.reportDate,
          brand: r.brandName,
          hasSchemes: r.schemesYesNo === 'Yes',
          schemeCost: parseFloat(r.avgSchemeCost || '0')
        }))
      };

      // Calculate average scheme cost per brand
      Object.keys(analysis.brandBreakdown).forEach(brand => {
        const data = analysis.brandBreakdown[brand];
        data.avgSchemeCost = data.count > 0 ? data.avgSchemeCost / data.count : 0;
      });

      res.json({
        success: true,
        userId: userIdInt,
        dateRange: { startDate, endDate },
        brandFilter: brandName,
        analysis: analysis
      });

    } catch (error) {
      console.error('Error fetching competition analysis:', error);
      res.status(500).json({
        error: 'Failed to fetch competition analysis',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get competition trends (brand performance over time)
  app.get('/api/competition/trends', async (req: Request, res: Response) => {
    try {
      const { userId, days = 30 } = req.query;

      let whereClause = undefined;

      if (userId) {
        whereClause = eq(competitionReports.userId, parseInt(userId as string));
      }

      // Get reports from last N days
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - parseInt(days as string));
      const pastDateString = pastDate.toISOString().split('T')[0];

      const dateClause = gte(competitionReports.reportDate, pastDateString);
      whereClause = whereClause ? and(whereClause, dateClause) : dateClause;

      const reports = await db.query.competitionReports.findMany({
        where: whereClause,
        orderBy: [asc(competitionReports.reportDate)],
        with: {
          user: {
            columns: { firstName: true, lastName: true, salesmanLoginId: true }
          }
        }
      });

      // Group by date and analyze trends
      const trendsByDate = reports.reduce((acc, report) => {
        const date = report.reportDate;
        if (!acc[date]) {
          acc[date] = {
            date,
            totalReports: 0,
            brandsTracked: new Set(),
            schemesCount: 0,
            totalSchemeCost: 0,
            reports: []
          };
        }

        acc[date].totalReports++;
        acc[date].brandsTracked.add(report.brandName);
        if (report.schemesYesNo === 'Yes') {
          acc[date].schemesCount++;
          acc[date].totalSchemeCost += parseFloat(report.avgSchemeCost || '0');
        }
        acc[date].reports.push(report);

        return acc;
      }, {} as Record<string, any>);

      // Convert to array and calculate averages
      const trends = Object.values(trendsByDate).map((dayData: any) => ({
        date: dayData.date,
        totalReports: dayData.totalReports,
        uniqueBrands: dayData.brandsTracked.size,
        schemesPercentage: dayData.totalReports > 0 ? (dayData.schemesCount / dayData.totalReports) * 100 : 0,
        avgSchemeCost: dayData.schemesCount > 0 ? dayData.totalSchemeCost / dayData.schemesCount : 0,
        reports: dayData.reports
      }));

      res.json({
        success: true,
        period: `Last ${days} days`,
        totalDays: trends.length,
        trends: trends
      });

    } catch (error) {
      console.error('Error fetching competition trends:', error);
      res.status(500).json({
        error: 'Failed to fetch competition trends',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ===== GEO TRACKING ENDPOINTS (COMPLETE SET WITH SCHEMA VALIDATION) =====
  // Helper function for precise distance calculation
  function calculatePreciseDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in meters
  }

  // 1. Start Journey (FIXED WITH SCHEMA VALIDATION)
  app.post('/api/journey/start', async (req: Request, res: Response) => {
    try {
      const {
        userId,
        latitude,
        longitude,
        journeyType = 'simple',
        plannedDealers = [],
        siteName,
        accuracy,
        batteryLevel,
        isCharging,
        networkStatus,
        ipAddress,
        description,
        estimatedDuration,
        priority = 'medium'
      } = req.body;

      // Check for existing active journey
      const activeJourney = await db.query.geoTracking.findFirst({
        where: and(
          eq(geoTracking.userId, parseInt(userId)),
          eq(geoTracking.locationType, 'journey_start'),
          isNull(geoTracking.checkOutTime)
        )
      });

      if (activeJourney) {
        return res.status(400).json({
          error: 'Active journey already exists',
          activeJourneyId: activeJourney.id,
          startedAt: activeJourney.checkInTime
        });
      }

      // Get dealer info if dealer visit journey
      let dealersToVisit = [];
      if (journeyType === 'dealer_visit' && plannedDealers && plannedDealers.length > 0) {
        dealersToVisit = await db.query.dealers.findMany({
          where: inArray(dealers.id, plannedDealers),
          columns: { id: true, name: true }
        });
      }

      // ✅ PREPARE DATA FOR SCHEMA VALIDATION
      const journeyData = {
        id: crypto.randomUUID(),
        userId: parseInt(userId),
        latitude: parseFloat(latitude).toFixed(7), // ✅ Decimal as string with 7 decimal places
        longitude: parseFloat(longitude).toFixed(7), // ✅ Decimal as string with 7 decimal places
        recordedAt: new Date(),
        accuracy: accuracy ? parseFloat(accuracy).toFixed(2) : null, // ✅ Decimal as string
        speed: null,
        heading: null,
        altitude: null,
        locationType: 'journey_start',
        activityType: journeyType,
        appState: 'foreground',
        batteryLevel: batteryLevel ? parseFloat(batteryLevel).toFixed(2) : null, // ✅ Decimal as string
        isCharging: isCharging || false,
        networkStatus: networkStatus || null,
        ipAddress: ipAddress || null,
        siteName: siteName || (dealersToVisit.length > 0 ? `Visiting ${dealersToVisit.map(d => d.name).join(', ')}` : 'Simple Journey'),
        checkInTime: new Date(),
        checkOutTime: null,
        totalDistanceTravelled: "0.000",// ✅ Decimal as string with 3 decimal places 
        updatedAt: new Date()
      };

      // ✅ USE SCHEMA VALIDATION
      const validatedData = insertGeoTrackingSchema.parse(journeyData);

      // ✅ INSERT WITH VALIDATED DATA
      const result = await db.insert(geoTracking).values(validatedData).returning();

      res.status(201).json({
        success: true,
        data: result[0],
        message: 'Journey started successfully!',
        plannedDealers: dealersToVisit
      });

    } catch (error: any) {
      console.error('Error starting journey:', error);

      // ✅ HANDLE SCHEMA VALIDATION ERRORS
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Journey start validation error',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            received: err.input
          }))
        });
      }

      // ✅ DATABASE ERROR HANDLING
      if (error?.code === '23502') {
        return res.status(400).json({
          error: 'Missing required field',
          details: error.detail || error.message
        });
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      res.status(500).json({
        error: 'Failed to start journey',
        details: errorMessage
      });
    }
  });

  // 2. Track Location During Journey (FIXED WITH SCHEMA VALIDATION)
  app.post('/api/journey/track', async (req: Request, res: Response) => {
    try {
      const {
        userId,
        latitude,
        longitude,
        accuracy,
        speed,
        heading,
        altitude,
        batteryLevel,
        networkStatus,
        appState = 'active'
      } = req.body;

      // Find active journey to get reference point
      const activeJourney = await db.query.geoTracking.findFirst({
        where: and(
          eq(geoTracking.userId, parseInt(userId)),
          eq(geoTracking.locationType, 'journey_start'),
          isNull(geoTracking.checkOutTime)
        )
      });

      if (!activeJourney) {
        return res.status(400).json({ error: 'No active journey found. Start a journey first.' });
      }

      // Get previous tracking point to calculate distance
      const lastTrackingPoint = await db.query.geoTracking.findFirst({
        where: and(
          eq(geoTracking.userId, parseInt(userId)),
          or(
            eq(geoTracking.locationType, 'journey_tracking'),
            eq(geoTracking.locationType, 'journey_start')
          )
        ),
        orderBy: [desc(geoTracking.recordedAt)]
      });

      let totalDistance = 0;
      if (lastTrackingPoint) {
        const distance = calculatePreciseDistance(
          parseFloat(lastTrackingPoint.latitude),
          parseFloat(lastTrackingPoint.longitude),
          parseFloat(latitude),
          parseFloat(longitude)
        );
        totalDistance = parseFloat(lastTrackingPoint.totalDistanceTravelled || '0') + (distance / 1000);
      }

      // ✅ PREPARE DATA FOR SCHEMA VALIDATION
      const trackingData = {
        userId: parseInt(userId),
        latitude: parseFloat(latitude).toFixed(7),
        longitude: parseFloat(longitude).toFixed(7),
        recordedAt: new Date(),
        accuracy: accuracy ? parseFloat(accuracy).toFixed(2) : null,
        speed: speed ? parseFloat(speed).toFixed(2) : "0.00",
        heading: heading ? parseFloat(heading).toFixed(2) : null,
        altitude: altitude ? parseFloat(altitude).toFixed(2) : null,
        locationType: 'journey_tracking',
        activityType: 'in_transit',
        appState: appState,
        batteryLevel: batteryLevel ? parseFloat(batteryLevel).toFixed(2) : null,
        isCharging: null,
        networkStatus: networkStatus || null,
        ipAddress: null,
        siteName: 'Journey in progress',
        checkInTime: new Date(),
        checkOutTime: null,
        totalDistanceTravelled: totalDistance.toFixed(3),
        updatedAt: new Date() // ✅ ONLY CHANGE: Added this line
      };

      // ✅ USE SCHEMA VALIDATION
      const validatedData = insertGeoTrackingSchema.parse(trackingData);

      // ✅ INSERT WITH VALIDATED DATA
      const result = await db.insert(geoTracking).values(validatedData).returning();

      res.json({
        success: true,
        data: result[0],
        progress: {
          totalDistance: `${totalDistance.toFixed(3)} km`,
          currentSpeed: `${speed || 0} km/h`,
          activeJourneyId: activeJourney.id
        }
      });

    } catch (error: any) {
      console.error('Error tracking location:', error);

      // ✅ HANDLE SCHEMA VALIDATION ERRORS
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Location tracking validation error',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            received: err.input
          }))
        });
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      res.status(500).json({
        error: 'Failed to track location',
        details: errorMessage
      });
    }
  });
  // 3. Check-in at Dealer Location (FIXED WITH SCHEMA VALIDATION)
  app.post('/api/journey/dealer-checkin', async (req: Request, res: Response) => {
    try {
      const {
        userId,
        dealerId,
        latitude,
        longitude,
        accuracy,
        visitPurpose = 'sales_visit',
        expectedDuration,
        notes,
        batteryLevel,
        networkStatus
      } = req.body;

      // Find active journey
      const activeJourney = await db.query.geoTracking.findFirst({
        where: and(
          eq(geoTracking.userId, parseInt(userId)),
          eq(geoTracking.locationType, 'journey_start'),
          isNull(geoTracking.checkOutTime)
        )
      });

      if (!activeJourney) {
        return res.status(400).json({
          error: 'No active journey found. Start a journey first.'
        });
      }

      // Get dealer info
      const dealer = await db.query.dealers.findFirst({
        where: and(
          eq(dealers.id, dealerId),
          eq(dealers.userId, parseInt(userId))
        )
      });

      if (!dealer) {
        return res.status(404).json({
          error: 'Dealer not found or does not belong to user'
        });
      }

      // Calculate distance from start
      const distanceFromStart = calculatePreciseDistance(
        parseFloat(activeJourney.latitude),
        parseFloat(activeJourney.longitude),
        parseFloat(latitude),
        parseFloat(longitude)
      );

      // ✅ PREPARE DATA FOR SCHEMA VALIDATION
      const dealerCheckinData = {
        userId: parseInt(userId),
        latitude: parseFloat(latitude).toFixed(7),
        longitude: parseFloat(longitude).toFixed(7),
        recordedAt: new Date(),
        accuracy: accuracy ? parseFloat(accuracy).toFixed(2) : null,
        speed: "0.00",
        heading: null,
        altitude: null,
        locationType: 'dealer_checkin',
        activityType: visitPurpose,
        appState: 'active',
        batteryLevel: batteryLevel ? parseFloat(batteryLevel).toFixed(2) : null,
        isCharging: null,
        networkStatus: networkStatus || null,
        ipAddress: null,
        siteName: `${dealer.name} - ${dealer.type} (${dealer.region})`,
        checkInTime: new Date(),
        checkOutTime: null,
        totalDistanceTravelled: (parseFloat(activeJourney.totalDistanceTravelled || '0') + (distanceFromStart / 1000)).toFixed(3),
        updatedAt: new Date() // ✅ ONLY CHANGE: Added this line
      };

      // ✅ USE SCHEMA VALIDATION
      const validatedData = insertGeoTrackingSchema.parse(dealerCheckinData);

      // ✅ INSERT WITH VALIDATED DATA
      const result = await db.insert(geoTracking).values(validatedData).returning();

      res.status(201).json({
        success: true,
        message: `Checked in at ${dealer.name}`,
        data: result[0],
        dealerVisit: {
          visitId: result[0].id,
          dealer: {
            id: dealer.id,
            name: dealer.name,
            type: dealer.type,
            region: dealer.region,
            area: dealer.area,
            phoneNo: dealer.phoneNo,
            totalPotential: dealer.totalPotential,
            brandSelling: dealer.brandSelling
          },
          visit: {
            checkinTime: result[0].checkInTime,
            purpose: visitPurpose,
            expectedDuration: expectedDuration || 'Not specified',
            notes: notes || 'No notes',
            distanceFromJourneyStart: `${(distanceFromStart / 1000).toFixed(3)} km`
          },
          journeyProgress: {
            activeJourneyId: activeJourney.id,
            totalJourneyDistance: result[0].totalDistanceTravelled,
            journeyStartTime: activeJourney.checkInTime,
            elapsedTime: activeJourney.checkInTime ?
              `${Math.round((new Date().getTime() - new Date(activeJourney.checkInTime).getTime()) / 60000)} minutes` :
              'Unknown'
          }
        }
      });

    } catch (error: any) {
      console.error('Error checking in at dealer:', error);

      // ✅ HANDLE SCHEMA VALIDATION ERRORS
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Dealer check-in validation error',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            received: err.input
          }))
        });
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      res.status(500).json({
        error: 'Failed to check in at dealer',
        details: errorMessage
      });
    }
  });

  // 4. Check-out from Dealer Location (FIXED WITH SCHEMA VALIDATION)
  app.post('/api/journey/dealer-checkout', async (req: Request, res: Response) => {
    try {
      const {
        userId,
        dealerId,
        visitOutcome = 'completed',
        orderValue,
        nextFollowUp,
        visitNotes,
        dealerFeedback,
        issuesEncountered,
        latitude,
        longitude
      } = req.body;

      // Find active dealer check-in
      const activeCheckin = await db.query.geoTracking.findFirst({
        where: and(
          eq(geoTracking.userId, parseInt(userId)),
          eq(geoTracking.locationType, 'dealer_checkin'),
          isNull(geoTracking.checkOutTime)
        ),
        orderBy: [desc(geoTracking.recordedAt)]
      });

      if (!activeCheckin) {
        return res.status(400).json({
          error: 'No active dealer check-in found'
        });
      }

      // Get dealer info
      const dealer = await db.query.dealers.findFirst({
        where: eq(dealers.id, dealerId)
      });

      // Calculate visit duration
      const visitDuration = activeCheckin.checkInTime ?
        new Date().getTime() - new Date(activeCheckin.checkInTime).getTime() : 0;

      // Update check-in record with checkout time
      await db.update(geoTracking)
        .set({
          checkOutTime: new Date(),
          updatedAt: new Date()
        })
        .where(eq(geoTracking.id, activeCheckin.id));

      // ✅ PREPARE CHECKOUT DATA FOR SCHEMA VALIDATION
      const checkoutData = {
        userId: parseInt(userId),
        latitude: parseFloat(latitude || activeCheckin.latitude).toFixed(7), // ✅ Decimal as string
        longitude: parseFloat(longitude || activeCheckin.longitude).toFixed(7), // ✅ Decimal as string
        recordedAt: new Date(),
        accuracy: null,
        speed: "0.00", // ✅ Decimal as string
        heading: null,
        altitude: null,
        locationType: 'dealer_checkout',
        activityType: visitOutcome,
        appState: 'active',
        batteryLevel: null,
        isCharging: null,
        networkStatus: null,
        ipAddress: null,
        siteName: `${dealer?.name || 'Unknown Dealer'} - Visit Complete`,
        checkInTime: activeCheckin.checkInTime,
        checkOutTime: new Date(),
        totalDistanceTravelled: activeCheckin.totalDistanceTravelled || "0.000" // ✅ Keep same distance
      };

      // ✅ USE SCHEMA VALIDATION
      const validatedData = insertGeoTrackingSchema.parse(checkoutData);

      // ✅ INSERT WITH VALIDATED DATA
      const result = await db.insert(geoTracking).values(validatedData).returning();

      res.json({
        success: true,
        message: `Checked out from ${dealer?.name || 'dealer'}`,
        data: result[0],
        visitSummary: {
          dealer: dealer?.name || 'Unknown',
          checkinTime: activeCheckin.checkInTime,
          checkoutTime: result[0].checkOutTime,
          visitDuration: `${Math.round(visitDuration / 60000)} minutes`,
          outcome: visitOutcome,
          orderValue: orderValue || 'Not specified',
          nextFollowUp: nextFollowUp || 'Not scheduled',
          notes: visitNotes || 'No notes',
          feedback: dealerFeedback || 'No feedback',
          issues: issuesEncountered || 'None reported'
        }
      });

    } catch (error: any) {
      console.error('Error checking out from dealer:', error);

      // ✅ HANDLE SCHEMA VALIDATION ERRORS
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Dealer check-out validation error',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            received: err.input
          }))
        });
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      res.status(500).json({
        error: 'Failed to check out from dealer',
        details: errorMessage
      });
    }
  });


  // 6. Pause Journey
  app.post('/api/journey/pause', async (req: Request, res: Response) => {
    try {
      const { userId, journeyId, location } = req.body;

      // Find active journey
      const activeJourney = await db.query.geoTracking.findFirst({
        where: and(
          eq(geoTracking.userId, parseInt(userId)),
          eq(geoTracking.locationType, 'journey_start'),
          isNull(geoTracking.checkOutTime)
        )
      });

      if (!activeJourney) {
        return res.status(400).json({
          error: 'No active journey found to pause'
        });
      }

      // Create pause record
      const pauseData = {
        userId: parseInt(userId),
        latitude: location?.lat ? parseFloat(location.lat).toFixed(7) : activeJourney.latitude,
        longitude: location?.lng ? parseFloat(location.lng).toFixed(7) : activeJourney.longitude,
        recordedAt: new Date(),
        accuracy: location?.accuracy ? parseFloat(location.accuracy).toFixed(2) : null,
        speed: "0.00",
        heading: null,
        altitude: null,
        locationType: 'journey_pause',
        activityType: 'paused',
        appState: 'background',
        batteryLevel: null,
        isCharging: null,
        networkStatus: null,
        ipAddress: null,
        siteName: 'Journey Paused',
        checkInTime: new Date(),
        checkOutTime: null,
        totalDistanceTravelled: activeJourney.totalDistanceTravelled,
        updatedAt: new Date()
      };

      const validatedData = insertGeoTrackingSchema.parse(pauseData);
      const result = await db.insert(geoTracking).values(validatedData).returning();

      res.json({
        success: true,
        message: 'Journey paused successfully',
        data: result[0]
      });

    } catch (error: any) {
      console.error('Error pausing journey:', error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Journey pause validation error',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            received: err.input
          }))
        });
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      res.status(500).json({
        error: 'Failed to pause journey',
        details: errorMessage
      });
    }
  });

  // 7. Resume Journey
  app.post('/api/journey/resume', async (req: Request, res: Response) => {
    try {
      const { userId, journeyId, location } = req.body;

      // Find active journey
      const activeJourney = await db.query.geoTracking.findFirst({
        where: and(
          eq(geoTracking.userId, parseInt(userId)),
          eq(geoTracking.locationType, 'journey_start'),
          isNull(geoTracking.checkOutTime)
        )
      });

      if (!activeJourney) {
        return res.status(400).json({
          error: 'No active journey found to resume'
        });
      }

      // Create resume record
      const resumeData = {
        userId: parseInt(userId),
        latitude: location?.lat ? parseFloat(location.lat).toFixed(7) : activeJourney.latitude,
        longitude: location?.lng ? parseFloat(location.lng).toFixed(7) : activeJourney.longitude,
        recordedAt: new Date(),
        accuracy: location?.accuracy ? parseFloat(location.accuracy).toFixed(2) : null,
        speed: "0.00",
        heading: null,
        altitude: null,
        locationType: 'journey_resume',
        activityType: 'resumed',
        appState: 'foreground',
        batteryLevel: null,
        isCharging: null,
        networkStatus: null,
        ipAddress: null,
        siteName: 'Journey Resumed',
        checkInTime: new Date(),
        checkOutTime: null,
        totalDistanceTravelled: activeJourney.totalDistanceTravelled,
        updatedAt: new Date()
      };

      const validatedData = insertGeoTrackingSchema.parse(resumeData);
      const result = await db.insert(geoTracking).values(validatedData).returning();

      res.json({
        success: true,
        message: 'Journey resumed successfully',
        data: result[0]
      });

    } catch (error: any) {
      console.error('Error resuming journey:', error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Journey resume validation error',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            received: err.input
          }))
        });
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      res.status(500).json({
        error: 'Failed to resume journey',
        details: errorMessage
      });
    }
  });

  // 5. End Journey (FIXED WITH SCHEMA VALIDATION)
  app.post('/api/journey/end', async (req: Request, res: Response) => {
    try {
      const {
        userId,
        latitude,
        longitude,
        journeyNotes,
        totalStops,
        fuelUsed,
        expensesClaimed
      } = req.body;

      // Find active journey
      const activeJourney = await db.query.geoTracking.findFirst({
        where: and(
          eq(geoTracking.userId, parseInt(userId)),
          eq(geoTracking.locationType, 'journey_start'),
          isNull(geoTracking.checkOutTime)
        )
      });

      if (!activeJourney) {
        return res.status(400).json({
          error: 'No active journey found to end'
        });
      }

      // Calculate final distance
      const finalDistance = calculatePreciseDistance(
        parseFloat(activeJourney.latitude),
        parseFloat(activeJourney.longitude),
        parseFloat(latitude),
        parseFloat(longitude)
      );

      const totalJourneyDistance = parseFloat(activeJourney.totalDistanceTravelled || '0') + (finalDistance / 1000);

      // Update the journey start record with end time
      await db.update(geoTracking)
        .set({
          checkOutTime: new Date(),
          totalDistanceTravelled: totalJourneyDistance.toFixed(3),
          updatedAt: new Date()
        })
        .where(eq(geoTracking.id, activeJourney.id));

      // ✅ PREPARE JOURNEY END DATA FOR SCHEMA VALIDATION
      const journeyEndData = {
        userId: parseInt(userId),
        latitude: parseFloat(latitude).toFixed(7), // ✅ Decimal as string
        longitude: parseFloat(longitude).toFixed(7), // ✅ Decimal as string
        recordedAt: new Date(),
        accuracy: null,
        speed: "0.00", // ✅ Decimal as string
        heading: null,
        altitude: null,
        locationType: 'journey_end',
        activityType: 'completed',
        appState: 'active',
        batteryLevel: null,
        isCharging: null,
        networkStatus: null,
        ipAddress: null,
        siteName: 'Journey Completed',
        checkInTime: activeJourney.checkInTime,
        checkOutTime: new Date(),
        totalDistanceTravelled: totalJourneyDistance.toFixed(3), // ✅ Decimal as string
        updatedAt: new Date()
      };

      // ✅ USE SCHEMA VALIDATION
      const validatedData = insertGeoTrackingSchema.parse(journeyEndData);

      // ✅ INSERT WITH VALIDATED DATA
      const result = await db.insert(geoTracking).values(validatedData).returning();

      // Calculate journey statistics
      const journeyDuration = activeJourney.checkInTime ?
        new Date().getTime() - new Date(activeJourney.checkInTime).getTime() : 0;

      res.json({
        success: true,
        message: 'Journey ended successfully',
        data: result[0],
        journeyStats: {
          journeyId: activeJourney.id,
          startTime: activeJourney.checkInTime,
          endTime: result[0].checkOutTime,
          duration: `${Math.round(journeyDuration / 60000)} minutes`,
          totalDistance: `${totalJourneyDistance.toFixed(3)} km`,
          averageSpeed: journeyDuration > 0 ?
            `${((totalJourneyDistance / (journeyDuration / 3600000)).toFixed(2))} km/h` : '0 km/h',
          notes: journeyNotes || 'No notes',
          stops: totalStops || 'Not specified',
          fuelUsed: fuelUsed || 'Not specified',
          expenses: expensesClaimed || 'Not specified'
        }
      });

    } catch (error: any) {
      console.error('Error ending journey:', error);

      // ✅ HANDLE SCHEMA VALIDATION ERRORS
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Journey end validation error',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            received: err.input
          }))
        });
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      res.status(500).json({
        error: 'Failed to end journey',
        details: errorMessage
      });
    }
  });

  // 6. Get Active Journey Status
  app.get('/api/journey/active/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      // ✅ VALIDATE USER ID
      const userIdInt = parseInt(userId);
      if (isNaN(userIdInt)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      const activeJourney = await db.query.geoTracking.findFirst({
        where: and(
          eq(geoTracking.userId, userIdInt),
          eq(geoTracking.locationType, 'journey_start'),
          isNull(geoTracking.checkOutTime)
        ),
        with: {
          user: {
            columns: { firstName: true, lastName: true, salesmanLoginId: true }
          }
        }
      });

      if (!activeJourney) {
        return res.json({
          success: true,
          hasActiveJourney: false,
          data: null
        });
      }

      // Get all tracking points for this journey
      const trackingPoints = await db.query.geoTracking.findMany({
        where: and(
          eq(geoTracking.userId, userIdInt),
          gte(geoTracking.recordedAt, activeJourney.checkInTime || new Date())
        ),
        orderBy: [asc(geoTracking.recordedAt)]
      });

      // Get active dealer check-ins
      const activeCheckins = await db.query.geoTracking.findMany({
        where: and(
          eq(geoTracking.userId, userIdInt),
          eq(geoTracking.locationType, 'dealer_checkin'),
          isNull(geoTracking.checkOutTime)
        )
      });

      const journeyDuration = activeJourney.checkInTime ?
        new Date().getTime() - new Date(activeJourney.checkInTime).getTime() : 0;

      res.json({
        success: true,
        hasActiveJourney: true,
        data: {
          journey: activeJourney,
          status: {
            startTime: activeJourney.checkInTime,
            duration: `${Math.round(journeyDuration / 60000)} minutes`,
            totalDistance: activeJourney.totalDistanceTravelled,
            trackingPoints: trackingPoints.length,
            activeCheckins: activeCheckins.length
          },
          trackingHistory: trackingPoints,
          activeCheckins: activeCheckins
        }
      });

    } catch (error) {
      console.error('Error fetching active journey:', error);
      res.status(500).json({
        error: 'Failed to fetch active journey',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 7. Get Journey History
  app.get('/api/journey/history/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { limit = 20, startDate, endDate } = req.query;

      // ✅ VALIDATE USER ID
      const userIdInt = parseInt(userId);
      if (isNaN(userIdInt)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      let whereClause = and(
        eq(geoTracking.userId, userIdInt),
        eq(geoTracking.locationType, 'journey_start')
      );

      // Add date filters
      if (startDate && endDate) {
        whereClause = and(
          whereClause,
          gte(geoTracking.checkInTime, new Date(startDate as string)),
          lte(geoTracking.checkInTime, new Date(endDate as string))
        );
      }

      const journeys = await db.query.geoTracking.findMany({
        where: whereClause,
        orderBy: [desc(geoTracking.checkInTime)],
        limit: parseInt(limit as string),
        with: {
          user: {
            columns: { firstName: true, lastName: true, salesmanLoginId: true }
          }
        }
      });

      // Get statistics for each journey
      const journeysWithStats = await Promise.all(journeys.map(async (journey) => {
        const trackingPoints = await db.query.geoTracking.findMany({
          where: and(
            eq(geoTracking.userId, userIdInt),
            gte(geoTracking.recordedAt, journey.checkInTime || new Date()),
            journey.checkOutTime ? lte(geoTracking.recordedAt, journey.checkOutTime) : undefined
          )
        });

        const dealerVisits = trackingPoints.filter(p => p.locationType === 'dealer_checkin').length;
        const duration = journey.checkInTime && journey.checkOutTime ?
          new Date(journey.checkOutTime).getTime() - new Date(journey.checkInTime).getTime() : 0;

        return {
          ...journey,
          stats: {
            duration: `${Math.round(duration / 60000)} minutes`,
            trackingPoints: trackingPoints.length,
            dealerVisits: dealerVisits,
            isCompleted: !!journey.checkOutTime
          }
        };
      }));

      res.json({
        success: true,
        data: journeysWithStats,
        total: journeysWithStats.length
      });

    } catch (error) {
      console.error('Error fetching journey history:', error);
      res.status(500).json({
        error: 'Failed to fetch journey history',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 8. Get Journey Analytics
  app.get('/api/journey/analytics/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { days = 30 } = req.query;

      // ✅ VALIDATE USER ID
      const userIdInt = parseInt(userId);
      if (isNaN(userIdInt)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      // Get journeys from last N days
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - parseInt(days as string));

      const journeys = await db.query.geoTracking.findMany({
        where: and(
          eq(geoTracking.userId, userIdInt),
          eq(geoTracking.locationType, 'journey_start'),
          gte(geoTracking.checkInTime, pastDate)
        )
      });

      const dealerVisits = await db.query.geoTracking.findMany({
        where: and(
          eq(geoTracking.userId, userIdInt),
          eq(geoTracking.locationType, 'dealer_checkin'),
          gte(geoTracking.checkInTime, pastDate)
        )
      });

      // Calculate analytics
      const totalDistance = journeys.reduce((sum, j) => sum + parseFloat(j.totalDistanceTravelled || '0'), 0);
      const completedJourneys = journeys.filter(j => j.checkOutTime).length;
      const totalDuration = journeys.reduce((sum, j) => {
        if (j.checkInTime && j.checkOutTime) {
          return sum + (new Date(j.checkOutTime).getTime() - new Date(j.checkInTime).getTime());
        }
        return sum;
      }, 0);

      const analytics = {
        period: `Last ${days} days`,
        totalJourneys: journeys.length,
        completedJourneys: completedJourneys,
        activeJourneys: journeys.length - completedJourneys,
        totalDistance: `${totalDistance.toFixed(3)} km`,
        averageDistance: journeys.length > 0 ? `${(totalDistance / journeys.length).toFixed(3)} km` : '0 km',
        totalDuration: `${Math.round(totalDuration / 60000)} minutes`,
        averageDuration: completedJourneys > 0 ? `${Math.round(totalDuration / completedJourneys / 60000)} minutes` : '0 minutes',
        dealerVisits: {
          total: dealerVisits.length,
          completed: dealerVisits.filter(v => v.checkOutTime).length,
          ongoing: dealerVisits.filter(v => !v.checkOutTime).length
        },
        dailyBreakdown: {} // Could add daily breakdown here
      };

      res.json({
        success: true,
        userId: userIdInt,
        analytics: analytics
      });

    } catch (error) {
      console.error('Error fetching journey analytics:', error);
      res.status(500).json({
        error: 'Failed to fetch journey analytics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ===== DAILY TASKS ENDPOINTS =====

  app.get('/api/tasks/recent', async (req: Request, res: Response) => {
    try {
      const {
        userId,
        assignedByUserId,
        status,
        visitType,
        taskDate,
        limit = 10
      } = req.query;

      let whereClause = undefined;

      // Build dynamic filters
      if (userId) {
        whereClause = eq(dailyTasks.userId, parseInt(userId as string));
      }
      if (assignedByUserId) {
        whereClause = whereClause
          ? and(whereClause, eq(dailyTasks.assignedByUserId, parseInt(assignedByUserId as string)))
          : eq(dailyTasks.assignedByUserId, parseInt(assignedByUserId as string));
      }
      if (status) {
        whereClause = whereClause
          ? and(whereClause, eq(dailyTasks.status, status as string))
          : eq(dailyTasks.status, status as string);
      }
      if (visitType) {
        whereClause = whereClause
          ? and(whereClause, eq(dailyTasks.visitType, visitType as string))
          : eq(dailyTasks.visitType, visitType as string);
      }
      if (taskDate) {
        whereClause = whereClause
          ? and(whereClause, eq(dailyTasks.taskDate, taskDate as string))
          : eq(dailyTasks.taskDate, taskDate as string);
      }

      // Fetch with ALL relations from schema
      const tasks = await db.query.dailyTasks.findMany({
        where: whereClause,
        orderBy: [desc(dailyTasks.taskDate), desc(dailyTasks.createdAt)],
        limit: parseInt(limit as string),
        with: {
          // User who will execute the task
          user: {
            columns: {
              firstName: true,
              lastName: true,
              salesmanLoginId: true,
              role: true,
              phoneNumber: true
            }
          },
          // User who assigned the task
          assignedBy: {
            columns: {
              firstName: true,
              lastName: true,
              salesmanLoginId: true,
              role: true
            }
          },
          // Related dealer (if any)
          relatedDealer: {
            columns: {
              name: true,
              type: true,
              location: true,
              contactPerson: true,
              contactNumber: true
            }
          },
          // Permanent Journey Plan (if linked)
          permanentJourneyPlan: {
            columns: {
              areaToBeVisited: true,
              status: true,
              startDate: true,
              endDate: true,
              description: true
            }
          }
        }
      });

      // Calculate task statistics with proper typing
      const taskStats: TaskStats = {
        total: tasks.length,
        byStatus: {
          assigned: tasks.filter(t => t.status === 'Assigned').length,
          accepted: tasks.filter(t => t.status === 'Accepted').length,
          inProgress: tasks.filter(t => t.status === 'In Progress').length,
          completed: tasks.filter(t => t.status === 'Completed').length,
          rejected: tasks.filter(t => t.status === 'Rejected').length
        },
        byVisitType: {
          clientVisit: tasks.filter(t => t.visitType === 'Client Visit').length,
          technicalVisit: tasks.filter(t => t.visitType === 'Technical Visit').length
        },
        byDate: {}
      };

      // Group by dates - now properly typed
      tasks.forEach(task => {
        const date = task.taskDate;
        if (!taskStats.byDate[date]) {
          taskStats.byDate[date] = 0;
        }
        taskStats.byDate[date]++;
      });

      res.json({
        success: true,
        data: tasks,
        statistics: taskStats,
        filters: {
          userId: userId || null,
          assignedByUserId: assignedByUserId || null,
          status: status || null,
          visitType: visitType || null,
          taskDate: taskDate || null
        }
      });

    } catch (error) {
      console.error('Error fetching tasks:', error);
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  });

  app.post('/api/tasks', async (req: Request, res: Response) => {
    try {
      const {
        userId,
        assignedByUserId,
        taskDate,
        visitType,
        relatedDealerId,
        siteName,
        description,
        pjpId,
        autoAssignFromPJP = false,
        autoAssignFromDealer = false
      } = req.body;

      // Validate required fields
      if (!userId || !assignedByUserId || !taskDate || !visitType) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['userId', 'assignedByUserId', 'taskDate', 'visitType']
        });
      }

      // Validate visitType against schema
      const validVisitTypes = ['Client Visit', 'Technical Visit'];
      if (!validVisitTypes.includes(visitType)) {
        return res.status(400).json({
          error: 'Invalid visitType',
          validTypes: validVisitTypes
        });
      }

      let taskData = {
        userId,
        assignedByUserId,
        taskDate,
        visitType,
        relatedDealerId: relatedDealerId || null,
        siteName: siteName || null,
        description: description || null,
        status: 'Assigned', // Default status from schema
        pjpId: pjpId || null,
        createdAt: new Date(), // ✅ Date object
        updatedAt: new Date()  // ✅ Date object
      };

      // 🤖 SMART AUTO-ASSIGNMENT from PJP
      if (autoAssignFromPJP && pjpId) {
        const pjp = await db.query.permanentJourneyPlans.findFirst({
          where: eq(permanentJourneyPlans.id, pjpId),
          with: { user: true }
        });

        if (pjp) {
          taskData = {
            ...taskData,
            userId: pjp.userId, // Auto-assign to PJP owner
            siteName: taskData.siteName || pjp.areaToBeVisited,
            description: taskData.description || `Auto-assigned from PJP: ${pjp.areaToBeVisited}. ${pjp.description || ''}`.trim()
          };
        }
      }

      // 🏢 SMART AUTO-ASSIGNMENT from Dealer
      if (autoAssignFromDealer && relatedDealerId) {
        const dealer = await db.query.dealers.findFirst({
          where: eq(dealers.id, relatedDealerId),
          with: {
            user: true, // Dealer's assigned salesperson
            parentDealer: true
          }
        });

        if (dealer) {
          taskData = {
            ...taskData,
            siteName: taskData.siteName || `${dealer.name} - ${dealer.location}`,
            description: taskData.description || `${visitType} at ${dealer.name} (${dealer.type}). Contact: ${dealer.contactPerson || 'N/A'}`
          };
        }
      }

      // Validate the final data against schema
      const validatedData = insertDailyTaskSchema.parse(taskData);

      const result = await db.insert(dailyTasks).values(validatedData).returning();

      // Fetch the created task with all relations for response
      const createdTask = await db.query.dailyTasks.findFirst({
        where: eq(dailyTasks.id, result[0].id),
        with: {
          user: {
            columns: { firstName: true, lastName: true, salesmanLoginId: true }
          },
          assignedBy: {
            columns: { firstName: true, lastName: true, role: true }
          },
          relatedDealer: {
            columns: { name: true, type: true, location: true }
          },
          permanentJourneyPlan: {
            columns: { areaToBeVisited: true, status: true }
          }
        }
      });

      res.status(201).json({
        success: true,
        data: createdTask,
        autoAssignments: {
          fromPJP: autoAssignFromPJP && pjpId,
          fromDealer: autoAssignFromDealer && relatedDealerId
        },
        message: 'Task created successfully!',
        nextSteps: [
          'Task assigned and awaiting acceptance',
          'User will receive notification',
          'Track progress via status updates'
        ]
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.errors,
          hint: 'Check required fields and data types'
        });
      }
      console.error('Error creating task:', error);
      res.status(500).json({ error: 'Failed to create task' });
    }
  });

  // Update task status with proper validation
  app.patch('/api/tasks/:id/status', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status, updatedByUserId } = req.body;

      // Validate status against schema
      const validStatuses = ['Assigned', 'Accepted', 'Completed', 'Rejected', 'In Progress'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          error: 'Invalid status',
          validStatuses,
          provided: status
        });
      }

      // Get current task to check permissions
      const currentTask = await db.query.dailyTasks.findFirst({
        where: eq(dailyTasks.id, id),
        with: {
          user: true,
          assignedBy: true
        }
      });

      if (!currentTask) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Update with proper Date object
      const result = await db.update(dailyTasks)
        .set({
          status,
          updatedAt: new Date() // ✅ Date object
        })
        .where(eq(dailyTasks.id, id))
        .returning();

      // Fetch updated task with relations
      const updatedTask = await db.query.dailyTasks.findFirst({
        where: eq(dailyTasks.id, id),
        with: {
          user: {
            columns: { firstName: true, lastName: true }
          },
          assignedBy: {
            columns: { firstName: true, lastName: true }
          }
        }
      });

      res.json({
        success: true,
        data: updatedTask,
        previousStatus: currentTask.status,
        newStatus: status,
        message: `Task status updated from "${currentTask.status}" to "${status}"`
      });

    } catch (error) {
      console.error('Error updating task status:', error);
      res.status(500).json({ error: 'Failed to update task status' });
    }
  });

  // Bulk task assignment for efficiency
  app.post('/api/tasks/bulk-assign', async (req: Request, res: Response) => {
    try {
      const {
        userIds,
        assignedByUserId,
        taskDate,
        visitType,
        baseDescription,
        pjpId
      } = req.body;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: 'userIds must be a non-empty array' });
      }

      // Validate visitType
      const validVisitTypes = ['Client Visit', 'Technical Visit'];
      if (!validVisitTypes.includes(visitType)) {
        return res.status(400).json({
          error: 'Invalid visitType',
          validTypes: validVisitTypes
        });
      }

      const tasksToCreate = userIds.map(userId => ({
        userId,
        assignedByUserId,
        taskDate,
        visitType,
        description: `${baseDescription} - Assigned to ${userId}`,
        status: 'Assigned',
        pjpId: pjpId || null,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      const results = await db.insert(dailyTasks).values(tasksToCreate).returning();

      res.status(201).json({
        success: true,
        created: results.length,
        tasks: results,
        message: `${results.length} tasks created successfully`
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.errors
        });
      }
      console.error('Error bulk creating tasks:', error);
      res.status(500).json({ error: 'Failed to create bulk tasks' });
    }
  });

  // Get tasks by user with comprehensive filtering
  app.get('/api/tasks/user/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { status, visitType, dateFrom, dateTo } = req.query;

      let whereClause = eq(dailyTasks.userId, parseInt(userId));

      if (status) {
        whereClause = and(whereClause, eq(dailyTasks.status, status as string));
      }
      if (visitType) {
        whereClause = and(whereClause, eq(dailyTasks.visitType, visitType as string));
      }
      if (dateFrom) {
        whereClause = and(whereClause, gte(dailyTasks.taskDate, dateFrom as string));
      }
      if (dateTo) {
        whereClause = and(whereClause, lte(dailyTasks.taskDate, dateTo as string));
      }

      const tasks = await db.query.dailyTasks.findMany({
        where: whereClause,
        orderBy: [desc(dailyTasks.taskDate)],
        with: {
          assignedBy: {
            columns: { firstName: true, lastName: true, role: true }
          },
          relatedDealer: {
            columns: { name: true, type: true, location: true }
          },
          permanentJourneyPlan: {
            columns: { areaToBeVisited: true, status: true }
          }
        }
      });

      // Calculate user-specific statistics
      const userStats: TaskStats = {
        total: tasks.length,
        byStatus: {
          assigned: tasks.filter(t => t.status === 'Assigned').length,
          accepted: tasks.filter(t => t.status === 'Accepted').length,
          inProgress: tasks.filter(t => t.status === 'In Progress').length,
          completed: tasks.filter(t => t.status === 'Completed').length,
          rejected: tasks.filter(t => t.status === 'Rejected').length
        },
        byVisitType: {
          clientVisit: tasks.filter(t => t.visitType === 'Client Visit').length,
          technicalVisit: tasks.filter(t => t.visitType === 'Technical Visit').length
        },
        byDate: {}
      };

      tasks.forEach(task => {
        const date = task.taskDate;
        if (!userStats.byDate[date]) {
          userStats.byDate[date] = 0;
        }
        userStats.byDate[date]++;
      });

      res.json({
        success: true,
        userId: parseInt(userId),
        data: tasks,
        statistics: userStats,
        filters: {
          status: status || null,
          visitType: visitType || null,
          dateRange: dateFrom && dateTo ? `${dateFrom} to ${dateTo}` : null
        }
      });

    } catch (error) {
      console.error('Error fetching user tasks:', error);
      res.status(500).json({ error: 'Failed to fetch user tasks' });
    }
  });

  // ===== DEALER MANAGEMENT ENDPOINTS (EXACT SCHEMA MATCH) =====
  app.post('/api/dealers', async (req: Request, res: Response) => {
    try {
      // Schema field mapping - EXACT MATCH
      const dealerData = {
        userId: req.body.userId,
        type: req.body.type,
        parentDealerId: req.body.parentDealerId || null,
        name: req.body.name,
        region: req.body.region,
        area: req.body.area, // Can now be text OR JSON coordinates
        phoneNo: req.body.phoneNo,
        address: req.body.address, // Stays clean text address
        totalPotential: req.body.totalPotential,
        bestPotential: req.body.bestPotential,
        brandSelling: req.body.brandSelling || [],
        feedbacks: req.body.feedbacks,
        remarks: req.body.remarks || null,
      };

      // EXACT schema validation - ALL notNull() fields required
      if (!dealerData.userId || !dealerData.type || !dealerData.name ||
        !dealerData.region || !dealerData.area || !dealerData.phoneNo ||
        !dealerData.address || !dealerData.totalPotential || !dealerData.bestPotential ||
        !dealerData.feedbacks || !Array.isArray(dealerData.brandSelling)) {
        return res.status(400).json({
          error: 'Missing required fields per schema',
          required: [
            'userId (integer)', 'type (varchar 50)', 'name (varchar 255)',
            'region (varchar 100)', 'area (varchar 255)', 'phoneNo (varchar 20)',
            'address (varchar 500)', 'totalPotential (decimal 10,2)',
            'bestPotential (decimal 10,2)', 'feedbacks (varchar 500)',
            'brandSelling (text array)'
          ],
          provided: {
            userId: !!dealerData.userId, type: !!dealerData.type, name: !!dealerData.name,
            region: !!dealerData.region, area: !!dealerData.area, phoneNo: !!dealerData.phoneNo,
            address: !!dealerData.address, totalPotential: !!dealerData.totalPotential,
            bestPotential: !!dealerData.bestPotential, feedbacks: !!dealerData.feedbacks,
            brandSelling: Array.isArray(dealerData.brandSelling)
          }
        });
      }

      // Validate type enum exactly per schema
      if (!['Dealer', 'Sub Dealer'].includes(dealerData.type)) {
        return res.status(400).json({
          error: 'Invalid type. Schema allows only: "Dealer" or "Sub Dealer"',
          provided: dealerData.type
        });
      }

      // Validate length constraints per schema
      if (dealerData.name.length > 255) {
        return res.status(400).json({ error: 'name exceeds 255 characters' });
      }
      if (dealerData.region.length > 100) {
        return res.status(400).json({ error: 'region exceeds 100 characters' });
      }
      if (dealerData.area.length > 255) {
        return res.status(400).json({ error: 'area exceeds 255 characters' });
      }

      // NEW: Validate coordinates if area contains JSON
      if (dealerData.area.trim().startsWith('{')) {
        try {
          const coordinates = JSON.parse(dealerData.area);

          // Validate required coordinate fields
          if (typeof coordinates.lat !== 'number' || typeof coordinates.lng !== 'number') {
            return res.status(400).json({ error: 'Invalid coordinates: lat and lng must be numbers' });
          }

          // Validate coordinate ranges
          if (coordinates.lat < -90 || coordinates.lat > 90) {
            return res.status(400).json({ error: 'Invalid latitude: must be between -90 and 90' });
          }
          if (coordinates.lng < -180 || coordinates.lng > 180) {
            return res.status(400).json({ error: 'Invalid longitude: must be between -180 and 180' });
          }

          // Validate radius if provided
          if (coordinates.radius && (typeof coordinates.radius !== 'number' || coordinates.radius <= 0)) {
            return res.status(400).json({ error: 'Invalid radius: must be positive number' });
          }
        } catch (e) {
          return res.status(400).json({ error: 'Invalid JSON format in area field' });
        }
      }

      if (dealerData.phoneNo.length > 20) {
        return res.status(400).json({ error: 'phoneNo exceeds 20 characters' });
      }
      if (dealerData.address.length > 500) {
        return res.status(400).json({ error: 'address exceeds 500 characters' });
      }
      if (dealerData.feedbacks.length > 500) {
        return res.status(400).json({ error: 'feedbacks exceeds 500 characters' });
      }
      if (dealerData.remarks && dealerData.remarks.length > 500) {
        return res.status(400).json({ error: 'remarks exceeds 500 characters' });
      }

      // Validate decimal precision (10,2) per schema
      const totalPotentialNum = parseFloat(dealerData.totalPotential);
      const bestPotentialNum = parseFloat(dealerData.bestPotential);

      if (isNaN(totalPotentialNum) || totalPotentialNum < 0 || totalPotentialNum >= 100000000) {
        return res.status(400).json({ error: 'totalPotential must be valid decimal(10,2)' });
      }
      if (isNaN(bestPotentialNum) || bestPotentialNum < 0 || bestPotentialNum >= 100000000) {
        return res.status(400).json({ error: 'bestPotential must be valid decimal(10,2)' });
      }

      // Convert decimals to proper format
      dealerData.totalPotential = totalPotentialNum.toFixed(2);
      dealerData.bestPotential = bestPotentialNum.toFixed(2);

      // Validate parentDealerId if provided
      if (dealerData.parentDealerId) {
        const parentExists = await db.query.dealers.findFirst({
          where: eq(dealers.id, dealerData.parentDealerId)
        });
        if (!parentExists) {
          return res.status(400).json({ error: 'parentDealerId references non-existent dealer' });
        }
      }

      // Validate userId references existing user
      const userExists = await db.query.users.findFirst({
        where: eq(users.id, dealerData.userId)
      });
      if (!userExists) {
        return res.status(400).json({ error: 'userId references non-existent user' });
      }

      const result = await db.insert(dealers).values(dealerData).returning();

      res.status(201).json({
        success: true,
        data: result[0],
        message: 'Dealer created successfully (schema compliant)!',
        schemaValidation: {
          allRequiredFieldsProvided: true,
          lengthConstraintsValid: true,
          decimalPrecisionValid: true,
          foreignKeysValid: true,
          enumsValid: true,
          coordinatesValid: dealerData.area.trim().startsWith('{') ? 'JSON coordinates validated' : 'Text area field'
        }
      });
    } catch (error) {
      console.error('Error creating dealer:', error);
      res.status(500).json({
        error: 'Failed to create dealer',
        details: error.message
      });
    }
  });
  // GET /api/dealers/recent - List all available dealers
  app.get('/api/dealers/recent', async (req: Request, res: Response) => {
    try {
      const { limit = 1000, userId } = req.query;

      // ✅ SAFE: Build where clause conditionally
      let whereClause = undefined;
      if (userId) {
        const userIdInt = parseInt(userId as string);
        if (isNaN(userIdInt)) {
          return res.status(400).json({ error: 'Invalid user ID' });
        }
        whereClause = eq(dealers.userId, userIdInt);
      }

      // ✅ SAFE: Parse limit with validation
      const limitInt = parseInt(limit as string);
      if (isNaN(limitInt) || limitInt < 1 || limitInt > 10000) {
        return res.status(400).json({ error: 'Invalid limit. Must be between 1 and 10000' });
      }

      // ✅ SAFE: Fetch dealers with proper ordering
      const dealersList = await db.query.dealers.findMany({
        where: whereClause,
        orderBy: [desc(dealers.createdAt), asc(dealers.name)], // Latest first, then alphabetical
        limit: limitInt,
        columns: {
          id: true,
          userId: true,
          type: true,
          parentDealerId: true,
          name: true,
          region: true,
          area: true,
          phoneNo: true,
          address: true,
          totalPotential: true,
          bestPotential: true,
          brandSelling: true,
          feedbacks: true,
          remarks: true,
          createdAt: true,
          updatedAt: true
        }
      });

      // ✅ SAFE: Response with proper structure
      res.json({
        success: true,
        data: dealersList,
        total: dealersList.length,
        message: `Found ${dealersList.length} dealers`
      });

    } catch (error: any) {
      console.error('Error fetching dealers:', error);

      // ✅ SAFE: Handle database errors properly
      if (error?.code === '42P01') {
        return res.status(500).json({
          error: 'Database table not found',
          details: 'Dealers table may not exist'
        });
      }

      if (error?.code === '42703') {
        return res.status(500).json({
          error: 'Database column error',
          details: 'One or more columns may not exist'
        });
      }

      res.status(500).json({
        error: 'Failed to fetch dealers',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/api/dealers/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Validate id format (schema uses varchar(255))
      if (!id || id.length > 255) {
        return res.status(400).json({ error: 'Invalid dealer id format' });
      }

      const dealer = await db.query.dealers.findFirst({
        where: eq(dealers.id, id),
        with: {
          user: {
            columns: { firstName: true, lastName: true, email: true }
          },
          parentDealer: {
            columns: { name: true, type: true, region: true }
          }
        }
      });

      if (!dealer) {
        return res.status(404).json({ error: 'Dealer not found' });
      }

      res.json({
        success: true,
        data: dealer,
        schemaInfo: {
          id: 'varchar(255) primary key',
          createdAt: dealer.createdAt,
          updatedAt: dealer.updatedAt,
          hasParentDealer: !!dealer.parentDealer,
          brandCount: dealer.brandSelling?.length || 0
        }
      });
    } catch (error) {
      console.error('Error fetching dealer:', error);
      res.status(500).json({ error: 'Failed to fetch dealer' });
    }
  });

  app.patch('/api/dealers/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Validate id format
      if (!id || id.length > 255) {
        return res.status(400).json({ error: 'Invalid dealer id format' });
      }

      // Check if dealer exists
      const existingDealer = await db.query.dealers.findFirst({
        where: eq(dealers.id, id)
      });

      if (!existingDealer) {
        return res.status(404).json({ error: 'Dealer not found' });
      }

      const updateData = { ...req.body };

      // Remove fields that shouldn't be updated
      delete updateData.id;
      delete updateData.createdAt;

      // Schema will handle updatedAt automatically with .$onUpdate(() => new Date())

      // Validate any provided fields against schema constraints
      if (updateData.name && updateData.name.length > 255) {
        return res.status(400).json({ error: 'name exceeds 255 characters' });
      }
      if (updateData.region && updateData.region.length > 100) {
        return res.status(400).json({ error: 'region exceeds 100 characters' });
      }
      if (updateData.area && updateData.area.length > 255) {
        return res.status(400).json({ error: 'area exceeds 255 characters' });
      }
      if (updateData.phoneNo && updateData.phoneNo.length > 20) {
        return res.status(400).json({ error: 'phoneNo exceeds 20 characters' });
      }
      if (updateData.address && updateData.address.length > 500) {
        return res.status(400).json({ error: 'address exceeds 500 characters' });
      }
      if (updateData.feedbacks && updateData.feedbacks.length > 500) {
        return res.status(400).json({ error: 'feedbacks exceeds 500 characters' });
      }
      if (updateData.remarks && updateData.remarks.length > 500) {
        return res.status(400).json({ error: 'remarks exceeds 500 characters' });
      }

      // Validate type if provided
      if (updateData.type && !['Dealer', 'Sub Dealer'].includes(updateData.type)) {
        return res.status(400).json({ error: 'Invalid type. Must be "Dealer" or "Sub Dealer"' });
      }

      // Validate and format decimals if provided
      if (updateData.totalPotential !== undefined) {
        const num = parseFloat(updateData.totalPotential);
        if (isNaN(num) || num < 0 || num >= 100000000) {
          return res.status(400).json({ error: 'totalPotential must be valid decimal(10,2)' });
        }
        updateData.totalPotential = num.toFixed(2);
      }

      if (updateData.bestPotential !== undefined) {
        const num = parseFloat(updateData.bestPotential);
        if (isNaN(num) || num < 0 || num >= 100000000) {
          return res.status(400).json({ error: 'bestPotential must be valid decimal(10,2)' });
        }
        updateData.bestPotential = num.toFixed(2);
      }

      // Validate brandSelling array if provided
      if (updateData.brandSelling !== undefined && !Array.isArray(updateData.brandSelling)) {
        return res.status(400).json({ error: 'brandSelling must be an array' });
      }

      const result = await db.update(dealers)
        .set(updateData)
        .where(eq(dealers.id, id))
        .returning();

      res.json({
        success: true,
        data: result[0],
        message: 'Dealer updated successfully (schema compliant)!',
        updatedFields: Object.keys(updateData)
      });
    } catch (error) {
      console.error('Error updating dealer:', error);
      res.status(500).json({
        error: 'Failed to update dealer',
        details: error.message
      });
    }
  });

  // Additional endpoint: Delete dealer (with cascade handling)
  app.delete('/api/dealers/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id || id.length > 255) {
        return res.status(400).json({ error: 'Invalid dealer id format' });
      }

      // Check for sub-dealers that reference this as parent
      const subDealers = await db.query.dealers.findMany({
        where: eq(dealers.parentDealerId, id)
      });

      const result = await db.delete(dealers)
        .where(eq(dealers.id, id))
        .returning();

      if (result.length === 0) {
        return res.status(404).json({ error: 'Dealer not found' });
      }

      res.json({
        success: true,
        message: 'Dealer deleted successfully',
        deletedDealer: result[0],
        subDealersAffected: subDealers.length,
        note: subDealers.length > 0 ? 'Sub-dealers had their parentDealerId set to null (onDelete: "set null")' : 'No sub-dealers affected'
      });
    } catch (error) {
      console.error('Error deleting dealer:', error);
      res.status(500).json({ error: 'Failed to delete dealer' });
    }
  });

  // Additional endpoint: Get dealer hierarchy
  app.get('/api/dealers/hierarchy/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      const allDealers = await db.query.dealers.findMany({
        where: eq(dealers.userId, parseInt(userId)),
        with: {
          parentDealer: {
            columns: { name: true, type: true }
          }
        }
      });

      // Build hierarchy
      const mainDealers = allDealers.filter(d => d.type === 'Dealer' && !d.parentDealerId);
      const subDealers = allDealers.filter(d => d.type === 'Sub Dealer' && d.parentDealerId);

      const hierarchy = mainDealers.map(dealer => ({
        ...dealer,
        subDealers: subDealers.filter(sub => sub.parentDealerId === dealer.id)
      }));

      res.json({
        success: true,
        data: hierarchy,
        summary: {
          totalDealers: mainDealers.length,
          totalSubDealers: subDealers.length,
          orphanedSubDealers: subDealers.filter(sub => !mainDealers.find(main => main.id === sub.parentDealerId)).length
        }
      });
    } catch (error) {
      console.error('Error fetching dealer hierarchy:', error);
      res.status(500).json({ error: 'Failed to fetch dealer hierarchy' });
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