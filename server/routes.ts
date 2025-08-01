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
import { AIService } from 'server/bot/aiService';
import { telegramBot } from './bot/telegram';

const aiService = new AIService(process.env.OPENROUTER_API_KEY || '');

export function setupWebRoutes(app: Express) {
  // PWA route
  app.get('/pwa', (req: Request, res: Response) => {
    res.redirect('/login');
  });

  // ===== TECHNICAL VISIT REPORTS WITH AI =====
  app.get('/api/tvr/recent', async (req: Request, res: Response) => {
    try {
      const reports = await db.query.technicalVisitReports.findMany({
        orderBy: [desc(technicalVisitReports.reportDate)],
        limit: 10,
        with: {
          user: {
            columns: { firstName: true, lastName: true }
          }
        }
      });
      res.json(reports);
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

        // Call the correct AI method with proper parameters
        const aiGeneratedData = await aiService.generateTVRFromInput({
          siteName: req.body.siteName || "Customer Site",
          technicalIssue: userInput,
          serviceProvided: req.body.serviceProvided || "Technical support provided",
          customerFeedback: req.body.customerFeedback || userInput,
          visitType: req.body.visitType
        });

        // Map AI generated data to schema-compliant format
        tvrData = {
          userId: req.body.userId || 1,
          reportDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD format for date field
          visitType: aiGeneratedData.visitType || "Maintenance",
          siteNameConcernedPerson: aiGeneratedData.siteNameConcernedPerson || "Customer",
          phoneNo: aiGeneratedData.phoneNo || req.body.phoneNo || "0000000000",
          emailId: aiGeneratedData.emailId || req.body.emailId || null,
          clientsRemarks: aiGeneratedData.clientsRemarks || userInput,
          salespersonRemarks: aiGeneratedData.salespersonRemarks || "Technical support provided",
          checkInTime: new Date(), // timestamp with timezone
          checkOutTime: null, // will be set when checking out
          inTimeImageUrl: req.body.inTimeImageUrl || null,
          outTimeImageUrl: req.body.outTimeImageUrl || null
        };
      } else {
        // Manual TVR creation
        tvrData = {
          userId: manualData.userId || 1,
          reportDate: manualData.reportDate || new Date().toISOString().split('T')[0],
          visitType: manualData.visitType || "Maintenance",
          siteNameConcernedPerson: manualData.siteNameConcernedPerson,
          phoneNo: manualData.phoneNo,
          emailId: manualData.emailId || null,
          clientsRemarks: manualData.clientsRemarks,
          salespersonRemarks: manualData.salespersonRemarks,
          checkInTime: manualData.checkInTime ? new Date(manualData.checkInTime) : new Date(),
          checkOutTime: manualData.checkOutTime ? new Date(manualData.checkOutTime) : null,
          inTimeImageUrl: manualData.inTimeImageUrl || null,
          outTimeImageUrl: manualData.outTimeImageUrl || null
        };
      }

      // Validate required fields before database insertion
      if (!tvrData.siteNameConcernedPerson) {
        return res.status(400).json({ error: 'Site name and concerned person is required' });
      }
      if (!tvrData.phoneNo) {
        return res.status(400).json({ error: 'Phone number is required' });
      }
      if (!tvrData.clientsRemarks) {
        return res.status(400).json({ error: 'Client remarks are required' });
      }
      if (!tvrData.salespersonRemarks) {
        return res.status(400).json({ error: 'Salesperson remarks are required' });
      }

      // Validate visit type enum
      const validVisitTypes = ["Installation", "Repair", "Maintenance"];
      if (!validVisitTypes.includes(tvrData.visitType)) {
        return res.status(400).json({ error: 'Invalid visit type. Must be Installation, Repair, or Maintenance' });
      }

      // Insert into database
      const result = await db.insert(technicalVisitReports).values(tvrData).returning();

      res.status(201).json({
        success: true,
        data: result[0],
        aiGenerated: useAI && userInput ? true : false,
        message: useAI ? '🔧 TVR created with AI assistance!' : 'TVR created successfully!'
      });

    } catch (error) {
      console.error('Error creating technical report:', error);

      // Handle specific database errors
      if (error.code === '23502') { // NOT NULL violation
        return res.status(400).json({ error: 'Missing required field', details: error.message });
      }
      if (error.code === '23505') { // Unique violation
        return res.status(400).json({ error: 'Duplicate entry', details: error.message });
      }

      res.status(500).json({ error: 'Failed to create technical report', details: error.message });
    }
  });

  // Additional endpoint for checking out from a visit
  app.patch('/api/tvr/:id/checkout', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { outTimeImageUrl } = req.body;

      const result = await db
        .update(technicalVisitReports)
        .set({
          checkOutTime: new Date(),
          outTimeImageUrl: outTimeImageUrl || null,
          updatedAt: new Date()
        })
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

    } catch (error) {
      console.error('Error updating checkout time:', error);
      res.status(500).json({ error: 'Failed to update checkout time' });
    }
  });
  // ===== SALESMAN ATTENDANCE =====
  app.get('/api/attendance/recent', async (req: Request, res: Response) => {
    try {
      const attendance = await db.query.salesmanAttendance.findMany({
        orderBy: [desc(salesmanAttendance.attendanceDate)],
        limit: 10,
        with: {
          user: {
            columns: { firstName: true, lastName: true, salesmanLoginId: true }
          }
        }
      });
      res.json(attendance);
    } catch (error) {
      console.error('Error fetching attendance:', error);
      res.status(500).json({ error: 'Failed to fetch attendance' });
    }
  });

  // Punch IN endpoint - FIXED
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

      // Check if user already punched in today
      const today = new Date().toISOString().split('T')[0];
      const existingAttendance = await db.query.salesmanAttendance.findFirst({
        where: and(
          eq(salesmanAttendance.userId, userId),
          eq(salesmanAttendance.attendanceDate, today)
        )
      });

      if (existingAttendance) {
        return res.status(400).json({
          error: 'Already punched in today',
          data: existingAttendance
        });
      }

      const validatedData = insertSalesmanAttendanceSchema.parse({
        userId,
        attendanceDate: today,
        locationName: locationName || "Unknown Location",
        inTimeTimestamp: new Date(), // ✅ Date object
        outTimeTimestamp: null,
        inTimeImageCaptured: imageCaptured,
        outTimeImageCaptured: false,
        inTimeImageUrl: imageUrl || null,
        outTimeImageUrl: null,
        inTimeLatitude: latitude?.toString() || "0",
        inTimeLongitude: longitude?.toString() || "0",
        inTimeAccuracy: accuracy?.toString() || null,
        inTimeSpeed: speed?.toString() || null,
        inTimeHeading: heading?.toString() || null,
        inTimeAltitude: altitude?.toString() || null,
        outTimeLatitude: null,
        outTimeLongitude: null,
        outTimeAccuracy: null,
        outTimeSpeed: null,
        outTimeHeading: null,
        outTimeAltitude: null,
        createdAt: new Date(), // ✅ Date object
        updatedAt: new Date()  // ✅ Date object
      });

      const result = await db.insert(salesmanAttendance).values(validatedData).returning();

      res.status(201).json({
        success: true,
        data: result[0],
        message: '✅ Punched in successfully!'
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      console.error('Error creating punch-in:', error);
      res.status(500).json({ error: 'Failed to punch in' });
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

      const today = new Date().toISOString().split('T')[0];

      // Find today's attendance record
      const existingAttendance = await db.query.salesmanAttendance.findFirst({
        where: and(
          eq(salesmanAttendance.userId, userId),
          eq(salesmanAttendance.attendanceDate, today)
        )
      });

      if (!existingAttendance) {
        return res.status(400).json({
          error: 'No punch-in record found for today. Please punch in first.'
        });
      }

      if (existingAttendance.outTimeTimestamp) {
        return res.status(400).json({
          error: 'Already punched out today',
          data: existingAttendance
        });
      }

      const result = await db.update(salesmanAttendance)
        .set({
          outTimeTimestamp: new Date(), // ✅ Date object, not string
          outTimeImageCaptured: imageCaptured,
          outTimeImageUrl: imageUrl || null,
          outTimeLatitude: latitude?.toString() || null,
          outTimeLongitude: longitude?.toString() || null,
          outTimeAccuracy: accuracy?.toString() || null,
          outTimeSpeed: speed?.toString() || null,
          outTimeHeading: heading?.toString() || null,
          outTimeAltitude: altitude?.toString() || null,
          updatedAt: new Date() // ✅ Date object, not string
        })
        .where(eq(salesmanAttendance.id, existingAttendance.id))
        .returning();

      res.json({
        success: true,
        data: result[0],
        message: '✅ Punched out successfully!'
      });

    } catch (error) {
      console.error('Error updating punch-out:', error);
      res.status(500).json({ error: 'Failed to punch out' });
    }
  });
  // Get today's attendance status
  app.get('/api/attendance/today/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const today = new Date().toISOString().split('T')[0];

      const todayAttendance = await db.query.salesmanAttendance.findFirst({
        where: and(
          eq(salesmanAttendance.userId, parseInt(userId)),
          eq(salesmanAttendance.attendanceDate, today)
        )
      });

      res.json({
        hasAttendance: !!todayAttendance,
        punchedIn: !!todayAttendance,
        punchedOut: !!todayAttendance?.outTimeTimestamp,
        data: todayAttendance || null
      });

    } catch (error) {
      console.error('Error fetching today attendance:', error);
      res.status(500).json({ error: 'Failed to fetch today attendance' });
    }
  });

  // ===== LEAVE APPLICATIONS =====
  app.get('/api/leave/recent', async (req: Request, res: Response) => {
    try {
      const leaves = await db.query.salesmanLeaveApplications.findMany({
        orderBy: [desc(salesmanLeaveApplications.createdAt)],
        limit: 10,
        with: {
          user: {
            columns: { firstName: true, lastName: true, salesmanLoginId: true }
          }
        }
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
        userId: req.body.userId,
        leaveType: req.body.leaveType,
        startDate: req.body.startDate,
        endDate: req.body.endDate,
        reason: req.body.reason,
        status: 'Pending',
        adminRemarks: null,
        createdAt: new Date(), // ✅ Date object
        updatedAt: new Date()  // ✅ Date object
      });

      const result = await db.insert(salesmanLeaveApplications).values(validatedData).returning();
      res.status(201).json({
        success: true,
        data: result[0],
        message: 'Leave application submitted successfully!'
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      console.error('Error creating leave application:', error);
      res.status(500).json({ error: 'Failed to create leave application' });
    }
  });

  // Admin endpoint to approve/reject leave
  app.patch('/api/leave/:id/status', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status, adminRemarks } = req.body;

      if (!['Approved', 'Rejected'].includes(status)) {
        return res.status(400).json({ error: 'Status must be Approved or Rejected' });
      }

      const result = await db.update(salesmanLeaveApplications)
        .set({
          status,
          adminRemarks: adminRemarks || null,
          updatedAt: new Date()
        })
        .where(eq(salesmanLeaveApplications.id, id))
        .returning();

      if (result.length === 0) {
        return res.status(404).json({ error: 'Leave application not found' });
      }

      res.json({
        success: true,
        data: result[0],
        message: `Leave application ${status.toLowerCase()}`
      });
    } catch (error) {
      console.error('Error updating leave status:', error);
      res.status(500).json({ error: 'Failed to update leave status' });
    }
  });

  // ===== DAILY VISIT REPORTS (Primary DVR) =====
  // ===== UNIFIED DVR ENDPOINT (AI + Manual + Hybrid) =====
  app.post('/api/dvr', async (req: Request, res: Response) => {
    try {
      const {
        useAI,
        userInput,
        location,
        dealerName,
        alsoCreateClientReport = true,
        ...manualData
      } = req.body;

      let dvrData;

      if (useAI && userInput) {
        // 🤖 AI MAGIC BUTTON - Generate DVR from chat
        console.log('🎯 Using AI to generate DVR from input:', userInput);

        // Call the correct AI method with proper parameters
        const aiGeneratedData = await aiService.generateDVRFromInput({
          dealerName: dealerName || "Customer",
          visitContext: userInput,
          customerInteraction: userInput,
          location: location || { lat: 0, lng: 0 },
          dealerType: req.body.dealerType
        });

        dvrData = {
          userId: req.body.userId || 1,
          reportDate: new Date().toISOString().split('T')[0], // date format for schema
          dealerType: aiGeneratedData.dealerType || "Dealer",
          dealerName: dealerName || aiGeneratedData.dealerName || "",
          subDealerName: aiGeneratedData.subDealerName || null,
          location: aiGeneratedData.location || `${location?.lat || 0}, ${location?.lng || 0}`,
          latitude: (location?.lat || 0).toString(), // decimal as string
          longitude: (location?.lng || 0).toString(), // decimal as string
          visitType: aiGeneratedData.visitType || "Best", // "Best" or "Non Best"
          dealerTotalPotential: (aiGeneratedData.dealerTotalPotential || 0).toString(), // decimal as string
          dealerBestPotential: (aiGeneratedData.dealerBestPotential || 0).toString(), // decimal as string
          brandSelling: Array.isArray(aiGeneratedData.brandSelling) ? aiGeneratedData.brandSelling : [],
          contactPerson: aiGeneratedData.contactPerson || "",
          contactPersonPhoneNo: aiGeneratedData.contactPersonPhoneNo || "",
          todayOrderMt: (aiGeneratedData.todayOrderMt || 0).toString(), // decimal as string
          todayCollectionRupees: (aiGeneratedData.todayCollectionRupees || 0).toString(), // decimal as string
          feedbacks: aiGeneratedData.feedbacks || userInput,
          solutionBySalesperson: aiGeneratedData.solutionBySalesperson || "",
          anyRemarks: aiGeneratedData.anyRemarks || "Generated via AI",
          checkInTime: new Date(), // timestamp with timezone
          checkOutTime: null,
          inTimeImageUrl: req.body.inTimeImageUrl || null,
          outTimeImageUrl: req.body.outTimeImageUrl || null
        };
      } else {
        // Manual DVR creation
        dvrData = {
          userId: manualData.userId || 1,
          reportDate: manualData.reportDate || new Date().toISOString().split('T')[0],
          dealerType: manualData.dealerType || "Dealer",
          dealerName: manualData.dealerName || "",
          subDealerName: manualData.subDealerName || null,
          location: manualData.location || "",
          latitude: (manualData.latitude || 0).toString(),
          longitude: (manualData.longitude || 0).toString(),
          visitType: manualData.visitType || "Best",
          dealerTotalPotential: (manualData.dealerTotalPotential || 0).toString(),
          dealerBestPotential: (manualData.dealerBestPotential || 0).toString(),
          brandSelling: Array.isArray(manualData.brandSelling) ? manualData.brandSelling : [],
          contactPerson: manualData.contactPerson || "",
          contactPersonPhoneNo: manualData.contactPersonPhoneNo || "",
          todayOrderMt: (manualData.todayOrderMt || 0).toString(),
          todayCollectionRupees: (manualData.todayCollectionRupees || 0).toString(),
          feedbacks: manualData.feedbacks || "",
          solutionBySalesperson: manualData.solutionBySalesperson || "",
          anyRemarks: manualData.anyRemarks || "",
          checkInTime: manualData.checkInTime ? new Date(manualData.checkInTime) : new Date(),
          checkOutTime: manualData.checkOutTime ? new Date(manualData.checkOutTime) : null,
          inTimeImageUrl: manualData.inTimeImageUrl || null,
          outTimeImageUrl: manualData.outTimeImageUrl || null
        };
      }

      // Validate required fields before database insertion
      if (!dvrData.dealerType) {
        return res.status(400).json({ error: 'Dealer type is required' });
      }
      if (!dvrData.location) {
        return res.status(400).json({ error: 'Location is required' });
      }
      if (!dvrData.feedbacks) {
        return res.status(400).json({ error: 'Feedbacks are required' });
      }

      // Validate dealer type enum
      const validDealerTypes = ["Dealer", "Sub Dealer"];
      if (!validDealerTypes.includes(dvrData.dealerType)) {
        return res.status(400).json({ error: 'Invalid dealer type. Must be Dealer or Sub Dealer' });
      }

      // Validate visit type enum
      const validVisitTypes = ["Best", "Non Best"];
      if (!validVisitTypes.includes(dvrData.visitType)) {
        return res.status(400).json({ error: 'Invalid visit type. Must be Best or Non Best' });
      }

      // Create primary DVR
      const dvrResult = await db.insert(dailyVisitReports).values(dvrData).returning();

      // 🔄 HYBRID: Auto-create client report if requested
      let clientReportResult = null;
      if (alsoCreateClientReport) {
        try {
          const clientReportData = {
            dealerType: dvrData.dealerType,
            dealerSubDealerName: dvrData.dealerName + (dvrData.subDealerName ? ` / ${dvrData.subDealerName}` : ''),
            location: dvrData.location,
            typeBestNonBest: dvrData.visitType,
            dealerTotalPotential: dvrData.dealerTotalPotential,
            dealerBestPotential: dvrData.dealerBestPotential,
            brandSelling: dvrData.brandSelling,
            contactPerson: dvrData.contactPerson,
            contactPersonPhoneNo: dvrData.contactPersonPhoneNo,
            todayOrderMT: dvrData.todayOrderMt, // Note: MT vs Mt conversion
            todayCollection: dvrData.todayCollectionRupees,
            feedbacks: dvrData.feedbacks,
            solutionsAsPerSalesperson: dvrData.solutionBySalesperson,
            anyRemarks: dvrData.anyRemarks,
            checkOutTime: dvrData.checkOutTime || new Date(),
            userId: dvrData.userId
          };

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
        aiGenerated: useAI && userInput ? true : false,
        message: useAI ? '🤖 DVR created with AI assistance!' : 'DVR created successfully!',
        hybrid: alsoCreateClientReport ? 'Client report also created' : 'DVR only'
      });

    } catch (error) {
      console.error('Error creating DVR:', error);

      // Handle specific database errors
      if (error.code === '23502') { // NOT NULL violation
        return res.status(400).json({ error: 'Missing required field', details: error.message });
      }
      if (error.code === '23505') { // Unique violation
        return res.status(400).json({ error: 'Duplicate entry', details: error.message });
      }

      res.status(500).json({ error: 'Failed to create DVR', details: error.message });
    }
  });

  // Additional endpoint for DVR checkout
  app.patch('/api/dvr/:id/checkout', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { outTimeImageUrl } = req.body;

      const result = await db
        .update(dailyVisitReports)
        .set({
          checkOutTime: new Date(),
          outTimeImageUrl: outTimeImageUrl || null,
          updatedAt: new Date()
        })
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

    } catch (error) {
      console.error('Error updating checkout time:', error);
      res.status(500).json({ error: 'Failed to update checkout time' });
    }
  });
  // ===== CLIENT REPORTS (Secondary/Simplified DVR) =====
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

      // Validate required fields
      if (!finalClientData.dealerType) {
        return res.status(400).json({ error: 'Dealer type is required' });
      }
      if (!finalClientData.dealerSubDealerName) {
        return res.status(400).json({ error: 'Dealer/Sub dealer name is required' });
      }
      if (!finalClientData.location) {
        return res.status(400).json({ error: 'Location is required' });
      }
      if (!finalClientData.typeBestNonBest) {
        return res.status(400).json({ error: 'Type (Best/Non Best) is required' });
      }
      if (!finalClientData.contactPerson) {
        return res.status(400).json({ error: 'Contact person is required' });
      }
      if (!finalClientData.contactPersonPhoneNo) {
        return res.status(400).json({ error: 'Contact person phone number is required' });
      }
      if (!finalClientData.feedbacks) {
        return res.status(400).json({ error: 'Feedbacks are required' });
      }
      if (!finalClientData.solutionsAsPerSalesperson) {
        return res.status(400).json({ error: 'Solutions as per salesperson is required' });
      }
      if (!finalClientData.anyRemarks) {
        return res.status(400).json({ error: 'Remarks are required' });
      }

      // Prepare data for insertion
      const insertData = {
        dealerType: finalClientData.dealerType,
        dealerSubDealerName: finalClientData.dealerSubDealerName,
        location: finalClientData.location,
        typeBestNonBest: finalClientData.typeBestNonBest,
        dealerTotalPotential: (finalClientData.dealerTotalPotential || 0).toString(),
        dealerBestPotential: (finalClientData.dealerBestPotential || 0).toString(),
        brandSelling: Array.isArray(finalClientData.brandSelling) ? finalClientData.brandSelling : [],
        contactPerson: finalClientData.contactPerson,
        contactPersonPhoneNo: finalClientData.contactPersonPhoneNo,
        todayOrderMT: (finalClientData.todayOrderMT || 0).toString(),
        todayCollection: (finalClientData.todayCollection || 0).toString(),
        feedbacks: finalClientData.feedbacks,
        solutionsAsPerSalesperson: finalClientData.solutionsAsPerSalesperson,
        anyRemarks: finalClientData.anyRemarks,
        checkOutTime: finalClientData.checkOutTime ? new Date(finalClientData.checkOutTime) : new Date(),
        userId: finalClientData.userId || 1
      };

      const result = await db.insert(clientReports).values(insertData).returning();

      res.status(201).json({
        success: true,
        data: result[0],
        linkedToDVR: linkToDVR && dvrId ? dvrId : null,
        message: 'Client report created successfully!'
      });

    } catch (error: unknown) {
      console.error('Error creating client report:', error);

      // Type-safe error handling
      if (error && typeof error === 'object' && 'code' in error) {
        const dbError = error as { code: string; message: string };

        if (dbError.code === '23502') { // NOT NULL violation
          return res.status(400).json({ error: 'Missing required field', details: dbError.message });
        }
        if (dbError.code === '23505') { // Unique violation
          return res.status(400).json({ error: 'Duplicate entry', details: dbError.message });
        }
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      res.status(500).json({ error: 'Failed to create client report', details: errorMessage });
    }
  });
  // ===== UNIFIED DVR VIEW =====

  app.get('/api/dvr/unified/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      const [dvrs, clientReportsData] = await Promise.all([
        db.query.dailyVisitReports.findMany({
          where: eq(dailyVisitReports.userId, parseInt(userId)),
          orderBy: [desc(dailyVisitReports.reportDate)],
          limit: 20
        }),
        db.query.clientReports.findMany({
          where: eq(clientReports.userId, parseInt(userId)),
          orderBy: [desc(clientReports.createdAt)],
          limit: 20
        })
      ]);

      // Combine and sort by date
      const unified = [
        ...dvrs.map(dvr => ({ ...dvr, type: 'DVR', date: dvr.reportDate })),
        ...clientReportsData.map(cr => ({ ...cr, type: 'CLIENT_REPORT', date: cr.createdAt }))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      res.json(unified);
    } catch (error: unknown) {
      console.error('Error fetching unified DVR:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      res.status(500).json({ error: 'Failed to fetch unified DVR data', details: errorMessage });
    }
  });
  // ===== COMPETITION REPORTS =====
  app.get('/api/competition/recent', async (req: Request, res: Response) => {
    try {
      const reports = await db.query.competitionReports.findMany({
        orderBy: [desc(competitionReports.reportDate)],
        limit: 10,
        with: {
          user: {
            columns: { firstName: true, lastName: true }
          }
        }
      });
      res.json(reports);
    } catch (error: unknown) {
      console.error('Error fetching competition reports:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      res.status(500).json({ error: 'Failed to fetch competition reports', details: errorMessage });
    }
  });

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

        competitionData = {
          userId: req.body.userId || 1,
          reportDate: new Date().toISOString().split('T')[0],
          brandName: req.body.brandName || "Competitor Brand",
          billing: aiGeneratedData.billing || "Not specified",
          nod: aiGeneratedData.nod || "Not specified",
          retail: aiGeneratedData.retail || "Not specified",
          schemesYesNo: aiGeneratedData.hasSchemes || "No", // Map hasSchemes to schemesYesNo
          avgSchemeCost: (aiGeneratedData.avgSchemeCost || 0).toString(),
          remarks: aiGeneratedData.remarks || userInput
        };
      } else {
        // Manual Competition Report creation
        competitionData = {
          userId: manualData.userId || 1,
          reportDate: manualData.reportDate || new Date().toISOString().split('T')[0],
          brandName: manualData.brandName,
          billing: manualData.billing,
          nod: manualData.nod,
          retail: manualData.retail,
          schemesYesNo: manualData.schemesYesNo,
          avgSchemeCost: (manualData.avgSchemeCost || 0).toString(),
          remarks: manualData.remarks || null
        };
      }

      // Validate required fields
      if (!competitionData.brandName) {
        return res.status(400).json({ error: 'Brand name is required' });
      }
      if (!competitionData.billing) {
        return res.status(400).json({ error: 'Billing information is required' });
      }
      if (!competitionData.nod) {
        return res.status(400).json({ error: 'NOD (Number of Dealers) is required' });
      }
      if (!competitionData.retail) {
        return res.status(400).json({ error: 'Retail information is required' });
      }
      if (!competitionData.schemesYesNo) {
        return res.status(400).json({ error: 'Schemes Yes/No is required' });
      }

      // Validate schemes enum
      const validSchemes = ["Yes", "No"];
      if (!validSchemes.includes(competitionData.schemesYesNo)) {
        return res.status(400).json({ error: 'Invalid schemes value. Must be Yes or No' });
      }

      const result = await db.insert(competitionReports).values(competitionData).returning();

      res.status(201).json({
        success: true,
        data: result[0],
        aiGenerated: useAI && userInput ? true : false,
        message: useAI ? '🏢 Competition report created with AI assistance!' : 'Competition report created successfully!'
      });

    } catch (error: unknown) {
      console.error('Error creating competition report:', error);

      // Type-safe error handling
      if (error && typeof error === 'object' && 'code' in error) {
        const dbError = error as { code: string; message: string };

        if (dbError.code === '23502') { // NOT NULL violation
          return res.status(400).json({ error: 'Missing required field', details: dbError.message });
        }
        if (dbError.code === '23505') { // Unique violation
          return res.status(400).json({ error: 'Duplicate entry', details: dbError.message });
        }
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      res.status(500).json({ error: 'Failed to create competition report', details: errorMessage });
    }
  });
  // ===== UNIFIED JOURNEY TRACKING SYSTEM =====

  // 1. Start Journey (Simple or Dealer Visit)

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

  // 1. Start Journey - NO SESSION ID
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

      // Validate required fields
      if (!userId || !latitude || !longitude) {
        return res.status(400).json({ error: 'Missing required fields: userId, latitude, longitude' });
      }

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

      // Generate unique ID for journey
      const journeyId = crypto.randomUUID();

      // Get dealer info if dealer visit journey
      let dealersToVisit = [];
      if (journeyType === 'dealer_visit' && plannedDealers && plannedDealers.length > 0) {
        dealersToVisit = await db.query.dealers.findMany({
          where: inArray(dealers.id, plannedDealers),
          columns: { id: true, name: true }
        });
      }

      // Create the new journey record
      const newJourney = await db.insert(geoTracking).values({
        id: journeyId,
        userId: parseInt(userId),
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        locationType: 'journey_start',
        recordedAt: new Date(),
        accuracy: accuracy?.toString() || null,
        speed: null,
        heading: null,
        altitude: null,
        appState: 'foreground',
        batteryLevel: batteryLevel?.toString() || null,
        isCharging: isCharging || false,
        networkStatus: networkStatus || null,
        ipAddress: ipAddress || null,
        siteName: siteName || (dealersToVisit.length > 0 ? `Visiting ${dealersToVisit.map(d => d.name).join(', ')}` : 'Simple Journey'),
        checkInTime: new Date(),
        checkOutTime: null,
        totalDistanceTravelled: "0.000",
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();

      res.status(201).json({
        success: true,
        data: newJourney[0],
        message: 'Journey started successfully!',
        plannedDealers: dealersToVisit
      });

    } catch (error: unknown) {
      console.error('Error starting journey:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      res.status(500).json({ error: 'Failed to start journey', details: errorMessage });
    }
  });

  // 2. Track Location During Journey - NO SESSION ID
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

      const trackingData = {
        userId: parseInt(userId),
        latitude: parseFloat(latitude).toFixed(7),
        longitude: parseFloat(longitude).toFixed(7),
        recordedAt: new Date(),
        accuracy: accuracy?.toString() || null,
        speed: speed?.toString() || "0.00",
        heading: heading?.toString() || null,
        altitude: altitude?.toString() || null,
        locationType: 'journey_tracking',
        activityType: 'in_transit',
        appState: appState,
        batteryLevel: batteryLevel?.toString() || null,
        isCharging: null,
        networkStatus: networkStatus || null,
        ipAddress: null,
        siteName: 'Journey in progress',
        checkInTime: new Date(),
        checkOutTime: null,
        totalDistanceTravelled: totalDistance.toFixed(3)
      };

      const result = await db.insert(geoTracking).values(trackingData).returning();

      res.json({
        success: true,
        data: result[0],
        progress: {
          totalDistance: `${totalDistance.toFixed(3)} km`,
          currentSpeed: `${speed || 0} km/h`,
          activeJourneyId: activeJourney.id
        }
      });

    } catch (error: unknown) {
      console.error('Error tracking location:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      res.status(500).json({ error: 'Failed to track location', details: errorMessage });
    }
  });

  // 3. Check-in at Dealer Location - NO SESSION ID
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

      // Create dealer check-in record
      const dealerCheckinData = {
        userId: parseInt(userId),
        latitude: parseFloat(latitude).toFixed(7),
        longitude: parseFloat(longitude).toFixed(7),
        recordedAt: new Date(),
        accuracy: accuracy?.toString() || null,
        speed: "0.00",
        heading: null,
        altitude: null,
        locationType: 'dealer_checkin',
        activityType: visitPurpose,
        appState: 'active',
        batteryLevel: batteryLevel?.toString() || null,
        isCharging: null,
        networkStatus: networkStatus || null,
        ipAddress: null,
        siteName: `${dealer.name} - ${dealer.type} (${dealer.region})`,
        checkInTime: new Date(),
        checkOutTime: null,
        totalDistanceTravelled: (parseFloat(activeJourney.totalDistanceTravelled || '0') + (distanceFromStart / 1000)).toFixed(3)
      };

      const result = await db.insert(geoTracking).values(dealerCheckinData).returning();

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

    } catch (error: unknown) {
      console.error('Error checking in at dealer:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      res.status(500).json({ error: 'Failed to check in at dealer', details: errorMessage });
    }
  });

  // 4. Check-out from Dealer Location - NO SESSION ID
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

      // Create checkout record with visit summary
      const checkoutData = {
        userId: parseInt(userId),
        latitude: parseFloat(latitude || activeCheckin.latitude).toFixed(7),
        longitude: parseFloat(longitude || activeCheckin.longitude).toFixed(7),
        recordedAt: new Date(),
        accuracy: null,
        speed: "0.00",
        heading: null,
        altitude: null,
        locationType: 'dealer_checkout',
        activityType: visitOutcome,
        appState: 'active',
        batteryLevel: null,
        isCharging: null,
        networkStatus: null,
        ipAddress: null,
        siteName: `${dealer?.name || 'Dealer'} - Visit completed`,
        checkInTime: new Date(),
        checkOutTime: new Date(),
        totalDistanceTravelled: activeCheckin.totalDistanceTravelled
      };

      const result = await db.insert(geoTracking).values(checkoutData).returning();

      res.json({
        success: true,
        message: `Checked out from ${dealer?.name || 'dealer'}`,
        data: result[0],
        visitSummary: {
          dealer: dealer?.name || 'Unknown',
          visitDuration: `${Math.round(visitDuration / 60000)} minutes`,
          outcome: visitOutcome,
          orderValue: orderValue || null,
          notes: visitNotes || 'No notes',
          nextFollowUp: nextFollowUp || null
        }
      });

    } catch (error: unknown) {
      console.error('Error checking out from dealer:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      res.status(500).json({ error: 'Failed to check out from dealer', details: errorMessage });
    }
  });

  // 5. End Journey - NO SESSION ID
  app.post('/api/journey/end', async (req: Request, res: Response) => {
    try {
      const {
        userId,
        latitude,
        longitude,
        accuracy,
        batteryLevel,
        networkStatus,
        journeyNotes
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
          error: 'No active journey found'
        });
      }

      // Check if checkInTime exists
      if (!activeJourney.checkInTime) {
        return res.status(400).json({
          error: 'Invalid journey data - no check-in time found'
        });
      }

      // Calculate total journey time
      const journeyDuration = new Date().getTime() - new Date(activeJourney.checkInTime).getTime();
      const durationMinutes = Math.round(journeyDuration / 60000);

      // Calculate final distance if coordinates provided
      let finalDistance = parseFloat(activeJourney.totalDistanceTravelled || '0');
      if (latitude && longitude) {
        const distanceFromStart = calculatePreciseDistance(
          parseFloat(activeJourney.latitude),
          parseFloat(activeJourney.longitude),
          parseFloat(latitude),
          parseFloat(longitude)
        );
        finalDistance += (distanceFromStart / 1000);
      }

      // Update the journey start record with end time
      const updatedJourney = await db.update(geoTracking)
        .set({
          checkOutTime: new Date(),
          totalDistanceTravelled: finalDistance.toFixed(3),
          updatedAt: new Date()
        })
        .where(eq(geoTracking.id, activeJourney.id))
        .returning();

      // Create journey end record
      const journeyEndData = {
        userId: parseInt(userId),
        latitude: latitude?.toString() || activeJourney.latitude,
        longitude: longitude?.toString() || activeJourney.longitude,
        recordedAt: new Date(),
        accuracy: accuracy?.toString() || null,
        speed: "0.00",
        heading: null,
        altitude: null,
        locationType: 'journey_end',
        activityType: 'completed',
        appState: 'active',
        batteryLevel: batteryLevel?.toString() || null,
        isCharging: null,
        networkStatus: networkStatus || null,
        ipAddress: null,
        siteName: journeyNotes || 'Journey completed',
        checkInTime: new Date(),
        checkOutTime: new Date(),
        totalDistanceTravelled: finalDistance.toFixed(3)
      };

      const endRecord = await db.insert(geoTracking).values(journeyEndData).returning();

      res.json({
        success: true,
        message: 'Journey ended successfully!',
        data: {
          journeyStart: updatedJourney[0],
          journeyEnd: endRecord[0],
          summary: {
            duration: `${durationMinutes} minutes`,
            totalDistance: `${finalDistance.toFixed(3)} km`,
            startTime: activeJourney.checkInTime,
            endTime: new Date(),
            journeyId: activeJourney.id
          }
        }
      });

    } catch (error: unknown) {
      console.error('Error ending journey:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      res.status(500).json({ error: 'Failed to end journey', details: errorMessage });
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
  app.get('/api/dealers', async (req: Request, res: Response) => {
    try {
      const { userId, type, region, search, limit = 50 } = req.query;

      let whereClause = undefined;

      if (userId) {
        whereClause = eq(dealers.userId, parseInt(userId as string));
      }

      if (type) {
        whereClause = whereClause
          ? and(whereClause, eq(dealers.type, type as string))
          : eq(dealers.type, type as string);
      }

      if (region) {
        whereClause = whereClause
          ? and(whereClause, eq(dealers.region, region as string))
          : eq(dealers.region, region as string);
      }

      if (search) {
        whereClause = whereClause
          ? and(whereClause, ilike(dealers.name, `%${search}%`))
          : ilike(dealers.name, `%${search}%`);
      }

      const dealerList = await db.query.dealers.findMany({
        where: whereClause,
        orderBy: [dealers.name],
        limit: parseInt(limit as string),
        with: {
          user: {
            columns: { firstName: true, lastName: true }
          },
          parentDealer: {
            columns: { name: true, type: true }
          }
        }
      });

      res.json({
        success: true,
        data: dealerList,
        total: dealerList.length
      });
    } catch (error) {
      console.error('Error fetching dealers:', error);
      res.status(500).json({ error: 'Failed to fetch dealers' });
    }
  });

  app.post('/api/dealers', async (req: Request, res: Response) => {
    try {
      // Schema field mapping - EXACT MATCH
      const dealerData = {
        // id: auto-generated by schema .$defaultFn(() => crypto.randomUUID())
        userId: req.body.userId, // integer("user_id").notNull()
        type: req.body.type, // varchar("type", { length: 50 }).notNull()
        parentDealerId: req.body.parentDealerId || null, // varchar("parent_dealer_id", { length: 255 })
        name: req.body.name, // varchar("name", { length: 255 }).notNull()
        region: req.body.region, // varchar("region", { length: 100 }).notNull()
        area: req.body.area, // varchar("area", { length: 255 }).notNull()
        phoneNo: req.body.phoneNo, // varchar("phone_no", { length: 20 }).notNull()
        address: req.body.address, // varchar("address", { length: 500 }).notNull()
        totalPotential: req.body.totalPotential, // decimal("total_potential", { precision: 10, scale: 2 }).notNull()
        bestPotential: req.body.bestPotential, // decimal("best_potential", { precision: 10, scale: 2 }).notNull()
        brandSelling: req.body.brandSelling || [], // text("brand_selling").array().notNull()
        feedbacks: req.body.feedbacks, // varchar("feedbacks", { length: 500 }).notNull()
        remarks: req.body.remarks || null, // varchar("remarks", { length: 500 }) - optional
        // createdAt: defaultNow() - handled by schema
        // updatedAt: defaultNow().$onUpdate(() => new Date()) - handled by schema
      };

      // EXACT schema validation - ALL notNull() fields required
      if (!dealerData.userId || !dealerData.type || !dealerData.name ||
        !dealerData.region || !dealerData.area || !dealerData.phoneNo ||
        !dealerData.address || !dealerData.totalPotential || !dealerData.bestPotential ||
        !dealerData.feedbacks || !Array.isArray(dealerData.brandSelling)) {
        return res.status(400).json({
          error: 'Missing required fields per schema',
          required: [
            'userId (integer)',
            'type (varchar 50)',
            'name (varchar 255)',
            'region (varchar 100)',
            'area (varchar 255)',
            'phoneNo (varchar 20)',
            'address (varchar 500)',
            'totalPotential (decimal 10,2)',
            'bestPotential (decimal 10,2)',
            'feedbacks (varchar 500)',
            'brandSelling (text array)'
          ],
          provided: {
            userId: !!dealerData.userId,
            type: !!dealerData.type,
            name: !!dealerData.name,
            region: !!dealerData.region,
            area: !!dealerData.area,
            phoneNo: !!dealerData.phoneNo,
            address: !!dealerData.address,
            totalPotential: !!dealerData.totalPotential,
            bestPotential: !!dealerData.bestPotential,
            feedbacks: !!dealerData.feedbacks,
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

      // Validate parentDealerId if provided (must reference existing dealer)
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
          enumsValid: true
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