// server/routes.ts
import express, { Request, Response } from 'express';
import { eq, desc, and, gte, lte, like, count } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db';
import * as schema from '../shared/schema';
import { radarService } from './services/RadarService';

const app = express.Router();

// =================== LOCATION CONFIG INTERFACE ===================
interface LocationConfig {
  enabled: boolean;
  latField?: string;
  lngField?: string;
  locationField?: string;
  createGeofence?: boolean;
  validateLocation?: boolean;
  trackLocation?: boolean;
  requireLocationValidation?: boolean;
  dealerIdField?: string;
  reverseLookup?: boolean;
}

// =================== AUTO CRUD FUNCTION WITH RADAR INTEGRATION ===================
function createAutoCRUD<T extends { id?: string | number }>(
  app: express.Router,
  config: {
    endpoint: string;
    table: any;
    schema: z.ZodSchema<any>;
    updateSchema?: z.ZodSchema<any>;
    locationConfig?: LocationConfig;
  }
) {
  const { endpoint, table, schema: insertSchema, updateSchema, locationConfig } = config;

  // Helper function to process location data with Radar
  async function processLocationData(
    validatedData: any,
    userId?: string,
    isUpdate: boolean = false
  ) {
    if (!locationConfig?.enabled) return validatedData;

    const latField = locationConfig.latField || 'latitude';
    const lngField = locationConfig.lngField || 'longitude';
    const locationField = locationConfig.locationField || 'location';
    const dealerIdField = locationConfig.dealerIdField;

    const latitude = validatedData[latField];
    const longitude = validatedData[lngField];

    if (latitude && longitude) {
      // Location validation using validateDealerAttendance
      if (locationConfig.validateLocation && dealerIdField && userId) {
        const dealerId = validatedData[dealerIdField];
        if (dealerId) {
          console.log(`Validating location for user ${userId} at dealer ${dealerId}`);
          
          const validation = await radarService.validateDealerAttendance(
            userId,
            parseFloat(latitude.toString()),
            parseFloat(longitude.toString()),
            dealerId.toString()
          );

          if (!validation.isValid && locationConfig.requireLocationValidation) {
            throw new Error('Location validation failed - not within dealer geofence');
          }

          // Add validation metadata
          validatedData.locationValidation = {
            isValid: validation.isValid,
            confidence: validation.confidence,
            fraudDetected: validation.fraudDetected,
            timestamp: validation.timestamp
          };
        }
      }

      // Reverse geocoding to get address
      if (locationConfig.reverseLookup && locationField) {
        try {
          const geocodeResult = await radarService.geocodeReverse(
            parseFloat(latitude.toString()),
            parseFloat(longitude.toString())
          );
          
          if (geocodeResult.addresses && geocodeResult.addresses.length > 0) {
            validatedData[locationField] = geocodeResult.addresses[0].formattedAddress;
          }
        } catch (error) {
          console.error('Reverse geocoding failed:', error);
        }
      }

      // Track location with comprehensive data
      if (locationConfig.trackLocation && userId) {
        try {
          await radarService.trackLocationComplete({
            userId: userId,
            latitude: parseFloat(latitude.toString()),
            longitude: parseFloat(longitude.toString()),
            accuracy: 10,
            locationType: isUpdate ? 'update' : 'create',
            activityType: endpoint,
            metadata: {
              endpoint,
              action: isUpdate ? 'update' : 'create',
              timestamp: new Date().toISOString(),
              dealerId: dealerIdField ? validatedData[dealerIdField] : undefined
            }
          });
        } catch (error) {
          console.error('Location tracking failed:', error);
        }
      }
    }

    return validatedData;
  }

  // LIST - GET /api/{endpoint}
  app.get(`/api/${endpoint}`, async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = (page - 1) * limit;
      
      const search = req.query.search as string;
      const sortBy = req.query.sortBy as string || 'id';
      const sortOrder = req.query.sortOrder as string || 'desc';

      let query = db.select().from(table);
      
      if (search) {
        // Add search functionality (assumes name field exists)
        const nameField = table.name || table.dealerName || table.locationName || table.description || table.id;
        if (nameField) {
          query = query.where(like(nameField, `%${search}%`));
        }
      }

      // Add sorting
      if (sortOrder === 'desc') {
        query = query.orderBy(desc(table[sortBy] || table.id));
      } else {
        query = query.orderBy(table[sortBy] || table.id);
      }

      const records = await query.limit(limit).offset(offset);
      
      // Get total count
      const [totalResult] = await db.select({ count: count() }).from(table);
      const total = totalResult.count;

      res.json({
        data: records,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error(`Error fetching ${endpoint}:`, error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET BY ID - GET /api/{endpoint}/:id
  app.get(`/api/${endpoint}/:id`, async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      // Handle both numeric and UUID primary keys
      const whereClause = typeof table.id.dataType === 'number' 
        ? eq(table.id, parseInt(id))
        : eq(table.id, id);
      
      const record = await db.select().from(table).where(whereClause).limit(1);
      
      if (record.length === 0) {
        return res.status(404).json({ error: `${endpoint} not found` });
      }

      res.json(record[0]);
    } catch (error) {
      console.error(`Error fetching ${endpoint}:`, error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // CREATE - POST /api/{endpoint}
  app.post(`/api/${endpoint}`, async (req: Request, res: Response) => {
    try {
      const validatedData = insertSchema.parse(req.body);
      
      // Process location data with Radar integration
      const processedData = await processLocationData(
        validatedData,
        validatedData.userId?.toString(),
        false
      );

      const [newRecord] = await db.insert(table).values(processedData).returning();

      // Post-creation Radar operations
      if (locationConfig?.enabled && locationConfig.createGeofence) {
        const latField = locationConfig.latField || 'latitude';
        const lngField = locationConfig.lngField || 'longitude';
        
        const latitude = newRecord[latField];
        const longitude = newRecord[lngField];
        
        if (latitude && longitude) {
          try {
            console.log(`Creating geofence for ${endpoint} ${newRecord.id}`);
            
            await radarService.createDealerGeofence({
              dealerId: newRecord.id.toString(),
              name: newRecord.name || newRecord.dealerName || newRecord.locationName || `${endpoint}_${newRecord.id}`,
              latitude: parseFloat(latitude.toString()),
              longitude: parseFloat(longitude.toString()),
              radius: 100,
              dealerType: endpoint,
              metadata: {
                endpoint,
                createdAt: new Date().toISOString(),
                source: 'auto_crud'
              }
            });
          } catch (error) {
            console.error('Geofence creation failed:', error);
          }
        }
      }

      res.status(201).json(newRecord);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Validation error', 
          details: error.errors 
        });
      }
      
      if (error.message?.includes('Location validation failed')) {
        return res.status(400).json({ error: error.message });
      }
      
      console.error(`Error creating ${endpoint}:`, error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // UPDATE - PUT /api/{endpoint}/:id
  app.put(`/api/${endpoint}/:id`, async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const validationSchema = updateSchema || insertSchema;
      const validatedData = validationSchema.parse(req.body);

      // Process location data with Radar integration
      const processedData = await processLocationData(
        validatedData,
        validatedData.userId?.toString(),
        true
      );

      // Handle both numeric and UUID primary keys
      const whereClause = typeof table.id.dataType === 'number' 
        ? eq(table.id, parseInt(id))
        : eq(table.id, id);

      const [updatedRecord] = await db
        .update(table)
        .set(processedData)
        .where(whereClause)
        .returning();

      if (!updatedRecord) {
        return res.status(404).json({ error: `${endpoint} not found` });
      }

      // Update geofence if location changed
      if (locationConfig?.enabled && locationConfig.createGeofence) {
        const latField = locationConfig.latField || 'latitude';
        const lngField = locationConfig.lngField || 'longitude';
        
        const latitude = updatedRecord[latField];
        const longitude = updatedRecord[lngField];
        
        if (latitude && longitude) {
          try {
            await radarService.updateGeofence(updatedRecord.id.toString(), {
              coordinates: [parseFloat(longitude.toString()), parseFloat(latitude.toString())],
              description: updatedRecord.name || updatedRecord.dealerName || updatedRecord.locationName || `${endpoint}_${updatedRecord.id}`,
              metadata: {
                endpoint,
                updatedAt: new Date().toISOString(),
                source: 'auto_crud'
              }
            });
          } catch (error) {
            console.error('Geofence update failed:', error);
          }
        }
      }

      res.json(updatedRecord);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Validation error', 
          details: error.errors 
        });
      }
      
      if (error.message?.includes('Location validation failed')) {
        return res.status(400).json({ error: error.message });
      }
      
      console.error(`Error updating ${endpoint}:`, error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // DELETE - DELETE /api/{endpoint}/:id
  app.delete(`/api/${endpoint}/:id`, async (req: Request, res: Response) => {
    try {
      const id = req.params.id;

      // Delete geofence if it exists
      if (locationConfig?.enabled && locationConfig.createGeofence) {
        try {
          await radarService.deleteGeofence(id);
        } catch (error) {
          console.error('Geofence deletion failed:', error);
        }
      }

      // Handle both numeric and UUID primary keys
      const whereClause = typeof table.id.dataType === 'number' 
        ? eq(table.id, parseInt(id))
        : eq(table.id, id);

      const [deletedRecord] = await db
        .delete(table)
        .where(whereClause)
        .returning();

      if (!deletedRecord) {
        return res.status(404).json({ error: `${endpoint} not found` });
      }

      res.json({ message: `${endpoint} deleted successfully`, data: deletedRecord });
    } catch (error) {
      console.error(`Error deleting ${endpoint}:`, error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}

// =================== AUTO CRUD ENDPOINTS WITH RADAR INTEGRATION ===================

// DEALERS - Full Radar integration
createAutoCRUD(app, {
  endpoint: 'dealers',
  table: schema.dealers,
  schema: schema.insertDealerSchema,
  locationConfig: {
    enabled: false, // ❌ DEALERS DON'T HAVE LATITUDE/LONGITUDE FIELDS!
    createGeofence: false,
    trackLocation: false,
    reverseLookup: false
  }
});

// DAILY VISIT REPORTS - Location validation for dealer visits
createAutoCRUD(app, {
  endpoint: 'daily-visit-reports',
  table: schema.dailyVisitReports,
  schema: schema.insertDailyVisitReportSchema,
  locationConfig: {
    enabled: true,
    latField: 'latitude',
    lngField: 'longitude', 
    locationField: 'location',
    validateLocation: true,
    trackLocation: true,
    dealerIdField: 'dealerName',
    reverseLookup: true
  }
});

// SALESMAN ATTENDANCE - Strict location validation
createAutoCRUD(app, {
  endpoint: 'salesman-attendance',
  table: schema.salesmanAttendance,
  schema: schema.insertSalesmanAttendanceSchema,
  locationConfig: {
    enabled: true,
    latField: 'inTimeLatitude',
    lngField: 'inTimeLongitude',
    locationField: 'locationName',
    validateLocation: true,
    requireLocationValidation: true,
    trackLocation: true,
    dealerIdField: 'userId' // ❌ NO DEALER FIELD IN ATTENDANCE!
  }
});

// GEO TRACKING - Pure tracking data
createAutoCRUD(app, {
  endpoint: 'geo-tracking',
  table: schema.geoTracking,
  schema: schema.insertGeoTrackingSchema,
  locationConfig: {
    enabled: true,
    latField: 'latitude',
    lngField: 'longitude',
    locationField: 'siteName',
    trackLocation: true,
    reverseLookup: true
  }
});

// COMPANIES - No location data
createAutoCRUD(app, {
  endpoint: 'companies',
  table: schema.companies,
  schema: schema.insertCompanySchema,
  locationConfig: { enabled: false }
});

// USERS - No location data  
createAutoCRUD(app, {
  endpoint: 'users',
  table: schema.users,
  schema: schema.insertUserSchema,
  locationConfig: { enabled: false }
});

// TECHNICAL VISIT REPORTS - No location data
createAutoCRUD(app, {
  endpoint: 'technical-visit-reports',
  table: schema.technicalVisitReports,
  schema: schema.insertTechnicalVisitReportSchema,
  locationConfig: { enabled: false }
});

// PERMANENT JOURNEY PLANS - No location data
createAutoCRUD(app, {
  endpoint: 'permanent-journey-plans', 
  table: schema.permanentJourneyPlans,
  schema: schema.insertPermanentJourneyPlanSchema,
  locationConfig: { enabled: false }
});

// SALESMAN LEAVE APPLICATIONS - No location data
createAutoCRUD(app, {
  endpoint: 'salesman-leave-applications',
  table: schema.salesmanLeaveApplications,
  schema: schema.insertSalesmanLeaveApplicationSchema,
  locationConfig: { enabled: false }
});

// CLIENT REPORTS - No location data
createAutoCRUD(app, {
  endpoint: 'client-reports',
  table: schema.clientReports,
  schema: schema.insertClientReportSchema,
  locationConfig: { enabled: false }
});

// COMPETITION REPORTS - No location data
createAutoCRUD(app, {
  endpoint: 'competition-reports',
  table: schema.competitionReports,
  schema: schema.insertCompetitionReportSchema,
  locationConfig: { enabled: false }
});

// DAILY TASKS - No location data
createAutoCRUD(app, {
  endpoint: 'daily-tasks',
  table: schema.dailyTasks,
  schema: schema.insertDailyTaskSchema,
  locationConfig: { enabled: false }
});

// DEALER REPORTS AND SCORES - No location data
createAutoCRUD(app, {
  endpoint: 'dealer-reports-and-scores',
  table: schema.dealerReportsAndScores,
  schema: schema.insertDealerReportsAndScoresSchema,
  locationConfig: { enabled: false }
});

// =================== SPECIALIZED RADAR ENDPOINTS ===================

// Journey Management
app.post('/api/radar/journey/start', async (req: Request, res: Response) => {
  try {
    const { userId, dealerId, mode = 'car', metadata } = req.body;

    const journeyId = `journey_${userId}_${dealerId}_${Date.now()}`;
    
    const trip = await radarService.startDealerJourney({
      userId,
      journeyId,
      dealerId,
      mode,
      metadata
    });

    res.json({ 
      success: true, 
      trip,
      journeyId 
    });
  } catch (error) {
    console.error('Error starting journey:', error);
    res.status(500).json({ error: 'Failed to start journey' });
  }
});

app.put('/api/radar/journey/:journeyId/complete', async (req: Request, res: Response) => {
  try {
    const { journeyId } = req.params;
    
    const result = await radarService.completeTrip(journeyId);
    
    res.json({ 
      success: true, 
      result 
    });
  } catch (error) {
    console.error('Error completing journey:', error);
    res.status(500).json({ error: 'Failed to complete journey' });
  }
});

app.put('/api/radar/journey/:journeyId/cancel', async (req: Request, res: Response) => {
  try {
    const { journeyId } = req.params;
    
    const result = await radarService.cancelTrip(journeyId);
    
    res.json({ 
      success: true, 
      result 
    });
  } catch (error) {
    console.error('Error canceling journey:', error);
    res.status(500).json({ error: 'Failed to cancel journey' });
  }
});

app.get('/api/radar/journey/:journeyId', async (req: Request, res: Response) => {
  try {
    const { journeyId } = req.params;
    
    const trip = await radarService.getTrip(journeyId);
    
    res.json(trip);
  } catch (error) {
    console.error('Error fetching journey:', error);
    res.status(500).json({ error: 'Failed to fetch journey' });
  }
});

// Location Tracking with proper database storage
app.post('/api/radar/track', async (req: Request, res: Response) => {
  try {
    const trackingData = req.body;
    
    const result = await radarService.trackLocationComplete(trackingData);
    
    // Store in geo_tracking table with CORRECT field names
    await db.insert(schema.geoTracking).values({
      userId: trackingData.userId,
      recordedAt: new Date(), // ✅ CORRECT FIELD NAME
      latitude: trackingData.latitude.toString(),
      longitude: trackingData.longitude.toString(),
      accuracy: trackingData.accuracy?.toString(),
      speed: trackingData.speed?.toString(),
      heading: trackingData.heading?.toString(),
      altitude: trackingData.altitude?.toString(),
      batteryLevel: trackingData.batteryLevel,
      isCharging: trackingData.isCharging,
      networkStatus: trackingData.networkStatus,
      appState: trackingData.appState,
      siteName: trackingData.siteName,
      activityType: trackingData.activityType,
      locationType: trackingData.locationType,
      ipAddress: trackingData.ipAddress
    });
    
    res.json({ 
      success: true, 
      result 
    });
  } catch (error) {
    console.error('Error tracking location:', error);
    res.status(500).json({ error: 'Failed to track location' });
  }
});

// Analytics
app.get('/api/radar/analytics/region/:region', async (req: Request, res: Response) => {
  try {
    const { region } = req.params;
    const { startDate, endDate } = req.query;
    
    const dateRange = startDate && endDate ? {
      start: startDate as string,
      end: endDate as string
    } : undefined;
    
    const analytics = await radarService.getRegionAnalytics(region, dateRange);
    
    res.json(analytics);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Geofence Management
app.get('/api/radar/geofences', async (req: Request, res: Response) => {
  try {
    const { tag, limit } = req.query;
    
    const geofences = await radarService.listGeofences({
      tag: tag as string,
      limit: limit ? parseInt(limit as string) : undefined
    });
    
    res.json(geofences);
  } catch (error) {
    console.error('Error fetching geofences:', error);
    res.status(500).json({ error: 'Failed to fetch geofences' });
  }
});

// User Management
app.get('/api/radar/users', async (req: Request, res: Response) => {
  try {
    const { limit } = req.query;
    
    const users = await radarService.listUsers({
      limit: limit ? parseInt(limit as string) : undefined
    });
    
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.get('/api/radar/users/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    const user = await radarService.getUser(userId);
    
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Events
app.get('/api/radar/events', async (req: Request, res: Response) => {
  try {
    const { userId, deviceId, types, limit } = req.query;
    
    const events = await radarService.listEvents({
      userId: userId as string,
      deviceId: deviceId as string,
      types: types as string,
      limit: limit ? parseInt(limit as string) : undefined
    });
    
    res.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Webhook Processing
app.post('/api/radar/webhook', async (req: Request, res: Response) => {
  try {
    const eventData = req.body;
    
    const processedEvent = await radarService.processWebhookEvent(eventData);
    
    // Store processed webhook event in geo_tracking table with CORRECT field names
    if (processedEvent.userId && processedEvent.location) {
      await db.insert(schema.geoTracking).values({
        userId: processedEvent.userId,
        recordedAt: new Date(processedEvent.timestamp), // ✅ CORRECT FIELD NAME
        latitude: processedEvent.location.coordinates?.[1]?.toString(),
        longitude: processedEvent.location.coordinates?.[0]?.toString(),
        siteName: processedEvent.dealerName || processedEvent.placeName,
        activityType: processedEvent.eventType,
        locationType: 'webhook_event'
      });
    }
    
    res.json({ 
      success: true, 
      processedEvent 
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// Geocoding Services
app.post('/api/radar/geocode/forward', async (req: Request, res: Response) => {
  try {
    const { query, options } = req.body;
    
    const result = await radarService.geocodeForward(query, options);
    
    res.json(result);
  } catch (error) {
    console.error('Error with forward geocoding:', error);
    res.status(500).json({ error: 'Failed to geocode address' });
  }
});

app.post('/api/radar/geocode/reverse', async (req: Request, res: Response) => {
  try {
    const { latitude, longitude, options } = req.body;
    
    const result = await radarService.geocodeReverse(latitude, longitude, options);
    
    res.json(result);
  } catch (error) {
    console.error('Error with reverse geocoding:', error);
    res.status(500).json({ error: 'Failed to reverse geocode coordinates' });
  }
});

// Context and Search
app.get('/api/radar/context', async (req: Request, res: Response) => {
  try {
    const { latitude, longitude, userId } = req.query;
    
    const context = await radarService.getContext(
      parseFloat(latitude as string),
      parseFloat(longitude as string),
      userId as string
    );
    
    res.json(context);
  } catch (error) {
    console.error('Error fetching context:', error);
    res.status(500).json({ error: 'Failed to fetch context' });
  }
});

app.get('/api/radar/search/places', async (req: Request, res: Response) => {
  try {
    const options = req.query as any;
    
    const places = await radarService.searchPlaces(options);
    
    res.json(places);
  } catch (error) {
    console.error('Error searching places:', error);
    res.status(500).json({ error: 'Failed to search places' });
  }
});

app.get('/api/radar/publishable-key', (req: Request, res: Response) => {
  res.json({ 
    publishableKey: radarService.getPublishableKey() 
  });
});

// =================== UTILITY ENDPOINTS ===================

app.post('/api/radar/distance', (req: Request, res: Response) => {
  try {
    const { lat1, lon1, lat2, lon2 } = req.body;
    
    const distance = radarService.calculateDistance(lat1, lon1, lat2, lon2);
    
    res.json({ 
      distance,
      unit: 'meters'
    });
  } catch (error) {
    console.error('Error calculating distance:', error);
    res.status(500).json({ error: 'Failed to calculate distance' });
  }
});

export default app;