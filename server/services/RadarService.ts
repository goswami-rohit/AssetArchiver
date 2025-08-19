// server/services/RadarService.ts
export class RadarService {
  private baseURL = 'https://api.radar.io/v1';
  private secretKey = process.env.RADAR_SECRET_KEY;
  private publishableKey = process.env.RADAR_PUBLISHABLE_KEY;

  private async makeRequest(endpoint: string, options: RequestInit = {}, usePublishableKey = false) {
    const apiKey = usePublishableKey ? this.publishableKey : this.secretKey;
    
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': apiKey!,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Radar API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  // =================== CORE TRACKING (Building Blocks) ===================
  
  /**
   * Track user location - Core Radar API
   * Returns user data and generated events based on project settings
   */
  async track(data: {
    deviceId: string;
    userId?: string;
    latitude: number;
    longitude: number;
    accuracy: number;
    foreground?: boolean;
    stopped?: boolean;
    description?: string;
    metadata?: Record<string, any>;
    deviceType?: 'iOS' | 'Android' | 'Web';
    updatedAt?: string;
    replayed?: boolean;
    deviceOS?: string;
    deviceMake?: string;
    deviceModel?: string;
  }) {
    return this.makeRequest('/track', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: data.deviceId,
        userId: data.userId,
        latitude: data.latitude,
        longitude: data.longitude,
        accuracy: data.accuracy,
        foreground: data.foreground,
        stopped: data.stopped,
        description: data.description,
        metadata: data.metadata,
        deviceType: data.deviceType,
        updatedAt: data.updatedAt,
        replayed: data.replayed,
        deviceOS: data.deviceOS,
        deviceMake: data.deviceMake,
        deviceModel: data.deviceModel
      })
    }, true); // Use publishable key
  }

  /**
   * Get context for a location (stateless)
   * Anonymous and stateless by default
   */
  async getContext(latitude: number, longitude: number, userId?: string) {
    const params = new URLSearchParams({
      coordinates: `${latitude},${longitude}`
    });
    
    if (userId) {
      params.append('userId', userId);
    }

    return this.makeRequest(`/context?${params}`, {}, true); // Use publishable key
  }

  // =================== GEOCODING SERVICES ===================

  /**
   * Forward geocoding - Convert address to coordinates
   * Best for complete addresses
   */
  async geocodeForward(query: string, options?: {
    layers?: string; // place,address,postalCode,locality,county,state,country,coarse,fine
    country?: string; // 2-letter country codes, comma-separated
    lang?: 'ar' | 'de' | 'en' | 'es' | 'fr' | 'ja' | 'ko' | 'pt' | 'ru' | 'zh';
  }) {
    const params = new URLSearchParams({ query });
    
    if (options?.layers) params.append('layers', options.layers);
    if (options?.country) params.append('country', options.country);
    if (options?.lang) params.append('lang', options.lang);

    return this.makeRequest(`/geocode/forward?${params}`, {}, true); // Use publishable key
  }

  /**
   * Reverse geocoding - Convert coordinates to address
   */
  async geocodeReverse(latitude: number, longitude: number, options?: {
    layers?: string;
    lang?: 'ar' | 'de' | 'en' | 'es' | 'fr' | 'ja' | 'ko' | 'pt' | 'ru' | 'zh';
  }) {
    const params = new URLSearchParams({
      coordinates: `${latitude},${longitude}`
    });
    
    if (options?.layers) params.append('layers', options.layers);
    if (options?.lang) params.append('lang', options.lang);

    return this.makeRequest(`/geocode/reverse?${params}`, {}, true); // Use publishable key
  }

  // =================== AUTOCOMPLETE & SEARCH ===================

  /**
   * Autocomplete addresses and place names
   * For partial addresses or place names
   */
  async autocomplete(query: string, options?: {
    near?: string; // "latitude,longitude"
    layers?: string; // address,venue,locality
    country?: string;
    limit?: number;
    lang?: string;
  }) {
    const params = new URLSearchParams({ query });
    
    if (options?.near) params.append('near', options.near);
    if (options?.layers) params.append('layers', options.layers);
    if (options?.country) params.append('country', options.country);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.lang) params.append('lang', options.lang);

    return this.makeRequest(`/search/autocomplete?${params}`, {}, true); // Use publishable key
  }

  /**
   * Search for places
   */
  async searchPlaces(options: {
    near?: string; // "latitude,longitude"
    query?: string;
    categories?: string; // comma-separated
    chains?: string; // comma-separated
    limit?: number;
    radius?: number;
    lang?: string;
  }) {
    const params = new URLSearchParams();
    
    if (options.near) params.append('near', options.near);
    if (options.query) params.append('query', options.query);
    if (options.categories) params.append('categories', options.categories);
    if (options.chains) params.append('chains', options.chains);
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.radius) params.append('radius', options.radius.toString());
    if (options.lang) params.append('lang', options.lang);

    return this.makeRequest(`/search/places?${params}`, {}, true); // Use publishable key
  }

  // =================== USER MANAGEMENT ===================

  /**
   * List users with pagination
   */
  async listUsers(options?: {
    limit?: number; // 1-1000, default 100
    updatedBefore?: string; // ISO date string
    updatedAfter?: string; // ISO date string
  }) {
    const params = new URLSearchParams();
    
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.updatedBefore) params.append('updatedBefore', options.updatedBefore);
    if (options?.updatedAfter) params.append('updatedAfter', options.updatedAfter);

    const queryString = params.toString();
    return this.makeRequest(`/users${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Get user by Radar _id, userId, or deviceId
   */
  async getUser(identifier: string) {
    return this.makeRequest(`/users/${identifier}`);
  }

  /**
   * Delete user by Radar _id, userId, or deviceId
   */
  async deleteUser(identifier: string) {
    return this.makeRequest(`/users/${identifier}`, { method: 'DELETE' });
  }

  // =================== TRIP MANAGEMENT ===================

  /**
   * Start a trip
   */
  async startTrip(data: {
    userId: string;
    externalId: string;
    destinationGeofenceTag?: string;
    destinationGeofenceExternalId?: string;
    destinationLocation?: {
      type: 'Point';
      coordinates: [number, number]; // [lng, lat]
    };
    mode?: 'foot' | 'bike' | 'car';
    metadata?: Record<string, any>;
    approachingThreshold?: number; // minutes
    scheduledArrivalAt?: string; // ISO date string
  }) {
    return this.makeRequest('/trips', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  /**
   * Update a trip
   */
  async updateTrip(tripIdOrExternalId: string, data: {
    destinationGeofenceTag?: string;
    destinationGeofenceExternalId?: string;
    destinationLocation?: {
      type: 'Point';
      coordinates: [number, number]; // [lng, lat]
    };
    mode?: 'foot' | 'bike' | 'car';
    metadata?: Record<string, any>;
    approachingThreshold?: number;
    scheduledArrivalAt?: string;
  }) {
    return this.makeRequest(`/trips/${tripIdOrExternalId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  /**
   * Complete a trip
   */
  async completeTrip(tripIdOrExternalId: string) {
    return this.makeRequest(`/trips/${tripIdOrExternalId}/complete`, {
      method: 'POST'
    });
  }

  /**
   * Cancel a trip
   */
  async cancelTrip(tripIdOrExternalId: string) {
    return this.makeRequest(`/trips/${tripIdOrExternalId}/cancel`, {
      method: 'POST'
    });
  }

  /**
   * Get trip details
   */
  async getTrip(tripIdOrExternalId: string) {
    return this.makeRequest(`/trips/${tripIdOrExternalId}`);
  }

  /**
   * Get trip route (requires special access)
   */
  async getTripRoute(tripIdOrExternalId: string) {
    return this.makeRequest(`/trips/${tripIdOrExternalId}/route`);
  }

  /**
   * List trips with filtering
   */
  async listTrips(options?: {
    status?: string; // pending,started,approaching,arrived,completed,canceled,expired
    userId?: string;
    externalId?: string;
    limit?: number;
    createdBefore?: string;
    createdAfter?: string;
    updatedBefore?: string;
    updatedAfter?: string;
  }) {
    const params = new URLSearchParams();
    
    if (options?.status) params.append('status', options.status);
    if (options?.userId) params.append('userId', options.userId);
    if (options?.externalId) params.append('externalId', options.externalId);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.createdBefore) params.append('createdBefore', options.createdBefore);
    if (options?.createdAfter) params.append('createdAfter', options.createdAfter);
    if (options?.updatedBefore) params.append('updatedBefore', options.updatedBefore);
    if (options?.updatedAfter) params.append('updatedAfter', options.updatedAfter);

    const queryString = params.toString();
    return this.makeRequest(`/trips${queryString ? `?${queryString}` : ''}`);
  }

  // =================== GEOFENCE MANAGEMENT ===================

  /**
   * Create a geofence
   */
  async createGeofence(data: {
    type: 'circle' | 'polygon' | 'isochrone';
    coordinates: number[] | number[][]; // [lng, lat] for circle, [[lng,lat],...] for polygon
    radius?: number; // meters, for circle type
    tag: string;
    externalId: string;
    description: string;
    metadata?: Record<string, any>;
    enabled?: boolean;
  }) {
    return this.makeRequest('/geofences', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  /**
   * Update a geofence
   */
  async updateGeofence(geofenceIdOrTagExternalId: string, data: {
    type?: 'circle' | 'polygon' | 'isochrone';
    coordinates?: number[] | number[][];
    radius?: number;
    tag?: string;
    externalId?: string;
    description?: string;
    metadata?: Record<string, any>;
    enabled?: boolean;
  }) {
    return this.makeRequest(`/geofences/${geofenceIdOrTagExternalId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  /**
   * Delete a geofence
   */
  async deleteGeofence(geofenceIdOrTagExternalId: string) {
    return this.makeRequest(`/geofences/${geofenceIdOrTagExternalId}`, {
      method: 'DELETE'
    });
  }

  /**
   * List geofences
   */
  async listGeofences(options?: {
    tag?: string;
    limit?: number;
    createdBefore?: string;
    createdAfter?: string;
  }) {
    const params = new URLSearchParams();
    
    if (options?.tag) params.append('tag', options.tag);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.createdBefore) params.append('createdBefore', options.createdBefore);
    if (options?.createdAfter) params.append('createdAfter', options.createdAfter);

    const queryString = params.toString();
    return this.makeRequest(`/geofences${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Get a geofence
   */
  async getGeofence(geofenceIdOrTagExternalId: string) {
    return this.makeRequest(`/geofences/${geofenceIdOrTagExternalId}`);
  }

  // =================== EVENTS ===================

  /**
   * List events
   */
  async listEvents(options?: {
    userId?: string;
    deviceId?: string;
    types?: string; // comma-separated event types
    createdBefore?: string;
    createdAfter?: string;
    limit?: number;
    cursor?: string;
  }) {
    const params = new URLSearchParams();
    
    if (options?.userId) params.append('userId', options.userId);
    if (options?.deviceId) params.append('deviceId', options.deviceId);
    if (options?.types) params.append('types', options.types);
    if (options?.createdBefore) params.append('createdBefore', options.createdBefore);
    if (options?.createdAfter) params.append('createdAfter', options.createdAfter);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.cursor) params.append('cursor', options.cursor);

    const queryString = params.toString();
    return this.makeRequest(`/events${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Get an event
   */
  async getEvent(eventId: string) {
    return this.makeRequest(`/events/${eventId}`);
  }

  /**
   * Verify an event
   */
  async verifyEvent(eventId: string, data: { verification: 'accept' | 'reject' }) {
    return this.makeRequest(`/events/${eventId}/verification`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // =================== PLACES SETTINGS ===================

  /**
   * Get Places settings
   */
  async getPlacesSettings() {
    return this.makeRequest('/settings');
  }

  /**
   * Update Places settings
   */
  async updatePlacesSettings(data: {
    chainMetadata?: Record<string, Record<string, any>>;
    chainMappings?: Record<string, string>;
    placeFilters?: {
      chain?: string[];
      category?: string[];
    };
  }) {
    return this.makeRequest('/settings', {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  // =================== DEALER-SPECIFIC HELPER METHODS ===================

  /**
   * Create geofence for a dealer location
   */
  async createDealerGeofence(data: {
    dealerId: string;
    name: string;
    latitude: number;
    longitude: number;
    radius?: number;
    region?: string;
    area?: string;
    dealerType?: string;
    metadata?: Record<string, any>;
  }) {
    return this.createGeofence({
      type: 'circle',
      coordinates: [data.longitude, data.latitude], // Radar uses [lng, lat]
      radius: data.radius || 100,
      tag: 'dealer',
      externalId: data.dealerId,
      description: data.name,
      metadata: {
        region: data.region,
        area: data.area,
        dealerType: data.dealerType,
        createdAt: new Date().toISOString(),
        ...data.metadata
      },
      enabled: true
    });
  }

  /**
   * Start journey to dealer
   */
  async startDealerJourney(data: {
    userId: string;
    journeyId: string;
    dealerId: string;
    mode?: 'foot' | 'bike' | 'car';
    metadata?: Record<string, any>;
  }) {
    return this.startTrip({
      userId: data.userId,
      externalId: data.journeyId,
      destinationGeofenceTag: 'dealer',
      destinationGeofenceExternalId: data.dealerId,
      mode: data.mode || 'car',
      metadata: {
        purpose: 'dealer_visit',
        dealerId: data.dealerId,
        startTime: new Date().toISOString(),
        ...data.metadata
      }
    });
  }

  /**
   * Track user with comprehensive location data for geo_tracking schema
   */
  async trackLocationComplete(data: {
    userId: string;
    deviceId?: string;
    latitude: number;
    longitude: number;
    accuracy?: number;
    speed?: number;
    heading?: number;
    altitude?: number;
    batteryLevel?: number;
    isCharging?: boolean;
    networkStatus?: string;
    appState?: string;
    foreground?: boolean;
    stopped?: boolean;
    siteName?: string;
    activityType?: string;
    locationType?: string;
    deviceType?: 'iOS' | 'Android' | 'Web';
    deviceOS?: string;
    deviceMake?: string;
    deviceModel?: string;
    ipAddress?: string;
    metadata?: Record<string, any>;
  }) {
    return this.track({
      deviceId: data.deviceId || `device_${data.userId}`,
      userId: data.userId,
      latitude: data.latitude,
      longitude: data.longitude,
      accuracy: data.accuracy || 10,
      foreground: data.foreground,
      stopped: data.stopped,
      deviceType: data.deviceType,
      deviceOS: data.deviceOS,
      deviceMake: data.deviceMake,
      deviceModel: data.deviceModel,
      metadata: {
        timestamp: new Date().toISOString(),
        speed: data.speed,
        heading: data.heading,
        altitude: data.altitude,
        batteryLevel: data.batteryLevel,
        isCharging: data.isCharging,
        networkStatus: data.networkStatus,
        appState: data.appState,
        siteName: data.siteName,
        activityType: data.activityType,
        locationType: data.locationType,
        ipAddress: data.ipAddress,
        source: 'web_app',
        ...data.metadata
      }
    });
  }

  /**
   * Validate dealer attendance using geofence entry
   */
  async validateDealerAttendance(
    userId: string,
    latitude: number,
    longitude: number,
    dealerId: string
  ) {
    const trackingResult = await this.trackLocationComplete({
      userId,
      latitude,
      longitude,
      accuracy: 5,
      locationType: 'attendance_check',
      metadata: {
        action: 'attendance_validation',
        dealerId,
        timestamp: new Date().toISOString()
      }
    });

    // Check for geofence entry event
    const geofenceEntry = trackingResult.events?.find((event: any) =>
      event.type === 'user.entered_geofence' &&
      event.geofence?.externalId === dealerId
    );

    return {
      isValid: !!geofenceEntry,
      canCheckIn: !!geofenceEntry && trackingResult.user?.fraud?.passed !== false,
      confidence: geofenceEntry?.confidence || 0,
      fraudDetected: trackingResult.user?.fraud?.passed === false,
      fraudDetails: trackingResult.user?.fraud,
      locationAccuracy: trackingResult.user?.locationAccuracy,
      dealerInfo: geofenceEntry?.geofence,
      events: trackingResult.events,
      user: trackingResult.user,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get region analytics using trips and events
   */
  async getRegionAnalytics(region: string, dateRange?: { start: string; end: string }) {
    // Get all dealer geofences in region
    const geofences = await this.listGeofences({ tag: 'dealer' });
    const regionDealers = geofences.geofences?.filter((gf: any) =>
      gf.metadata?.region === region
    ) || [];

    const dealerIds = regionDealers.map((dealer: any) => dealer.externalId);

    // Get trips to dealers in this region
    const trips = await this.listTrips({
      status: 'completed,canceled,expired',
      createdAfter: dateRange?.start,
      createdBefore: dateRange?.end
    });

    const regionTrips = trips.trips?.filter((trip: any) =>
      dealerIds.includes(trip.destinationGeofenceExternalId)
    ) || [];

    return {
      region,
      totalDealers: dealerIds.length,
      totalVisits: regionTrips.length,
      uniqueVisitors: [...new Set(regionTrips.map((t: any) => t.userId))].length,
      totalDistance: regionTrips.reduce((sum: number, trip: any) => sum + (trip.distance || 0), 0),
      averageVisitsPerDealer: regionTrips.length / Math.max(dealerIds.length, 1),
      trips: regionTrips
    };
  }

  // =================== WEBHOOK PROCESSING ===================

  /**
   * Process webhook events for real-time notifications
   */
  async processWebhookEvent(eventData: any) {
    const { type, user, geofence, trip, location } = eventData;

    const processedEvent = {
      type,
      userId: user?.userId,
      deviceId: user?.deviceId,
      timestamp: new Date().toISOString(),
      location
    };

    switch (type) {
      case 'user.entered_geofence':
        return {
          ...processedEvent,
          eventType: 'geofence_entry',
          dealerId: geofence?.externalId,
          dealerName: geofence?.description,
          geofence,
          message: `User entered ${geofence?.description}`
        };

      case 'user.exited_geofence':
        return {
          ...processedEvent,
          eventType: 'geofence_exit',
          dealerId: geofence?.externalId,
          dealerName: geofence?.description,
          geofence,
          message: `User left ${geofence?.description}`
        };

      case 'trip.approaching':
        return {
          ...processedEvent,
          eventType: 'approaching_destination',
          tripId: trip?.externalId,
          dealerId: trip?.destinationGeofenceExternalId,
          eta: trip?.eta,
          trip,
          message: `Approaching destination, ETA: ${trip?.eta?.duration} minutes`
        };

      case 'trip.arrived':
        return {
          ...processedEvent,
          eventType: 'arrived_at_destination',
          tripId: trip?.externalId,
          dealerId: trip?.destinationGeofenceExternalId,
          trip,
          message: 'Arrived at destination'
        };

      case 'trip.completed':
        return {
          ...processedEvent,
          eventType: 'trip_completed',
          tripId: trip?.externalId,
          totalDistance: trip?.distance,
          duration: trip?.duration,
          trip,
          message: `Trip completed - ${trip?.distance}m in ${trip?.duration} seconds`
        };

      case 'user.entered_place':
        return {
          ...processedEvent,
          eventType: 'place_entry',
          placeName: eventData.place?.name,
          placeChain: eventData.place?.chain?.name,
          categories: eventData.place?.categories,
          place: eventData.place,
          message: `User entered ${eventData.place?.name}`
        };

      default:
        console.log('Unhandled webhook event type:', type);
        return processedEvent;
    }
  }

  // =================== UTILITY METHODS ===================

  /**
   * Get publishable key for frontend use
   */
  getPublishableKey() {
    return this.publishableKey;
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  /**
   * Retry request with exponential backoff
   */
  async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Don't retry on client errors (4xx)
        if (error.message && error.message.includes(' 4')) {
          throw error;
        }
        
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }
}

// Export singleton instance
export const radarService = new RadarService();