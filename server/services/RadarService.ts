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

  // =================== GEOFENCING FOR ATTENDANCE ===================
  
  // Create geofence for dealers/offices with enhanced options
  async createDealerGeofence(data: {
    externalId: string;
    description: string;
    tag: string;
    latitude: number;
    longitude: number;
    radius?: number;
    metadata?: any;
  }) {
    return this.makeRequest('/geofences', {
      method: 'POST',
      body: JSON.stringify({
        externalId: data.externalId,
        description: data.description,
        tag: data.tag,
        type: 'circle',
        coordinates: [data.longitude, data.latitude], // Radar uses [lng, lat]
        radius: data.radius || 100,
        metadata: {
          ...data.metadata,
          createdAt: new Date().toISOString(),
          purpose: 'attendance_validation'
        }
      })
    });
  }

  // Validate attendance location - fraud detection is automatic in response
  async validateAttendanceLocation(userId: string, latitude: number, longitude: number, dealerId: string) {
    const trackingResult = await this.makeRequest('/track', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: `device_${userId}`,
        userId,
        latitude,
        longitude,
        accuracy: 10,
        metadata: {
          action: 'attendance_check',
          dealerId,
          timestamp: new Date().toISOString()
        }
      })
    }, true); // Use publishable key for tracking

    return {
      isValid: trackingResult.events?.some((event: any) => 
        event.type === 'user.entered_geofence' && 
        event.geofence?.externalId === dealerId
      ),
      confidence: trackingResult.confidence,
      fraudDetected: trackingResult.user?.fraud?.passed === false,
      fraudDetails: trackingResult.user?.fraud,
      distance: trackingResult.user?.place?.distance,
      events: trackingResult.events
    };
  }

  // =================== LOCATION SERVICES FOR DEALER CREATION ===================

  // Search localities/addresses for dealer location selection
  async searchLocalities(query: string, near?: { latitude: number; longitude: number }) {
    const params = new URLSearchParams({
      query,
      limit: '10',
      layers: 'address,venue,locality'
    });

    if (near) {
      params.append('near', `${near.latitude},${near.longitude}`);
    }

    return this.makeRequest(`/search/autocomplete?${params}`, {}, true); // Use publishable key
  }

  // Convert address to coordinates
  async geocodeAddress(address: string) {
    const params = new URLSearchParams({
      query: address
    });

    return this.makeRequest(`/geocode/forward?${params}`, {}, true); // Use publishable key
  }

  // Convert coordinates to address
  async reverseGeocode(latitude: number, longitude: number) {
    const params = new URLSearchParams({
      coordinates: `${latitude},${longitude}`
    });

    return this.makeRequest(`/geocode/reverse?${params}`, {}, true); // Use publishable key
  }

  // =================== JOURNEY TRACKING WITH PAUSE/RESUME ===================

  // Start journey tracking to dealer
  async startJourney(data: {
    userId: string;
    externalId: string;
    destinationDealerId: string;
    mode?: 'car' | 'truck' | 'bike' | 'foot';
    metadata?: any;
  }) {
    return this.makeRequest('/trips', {
      method: 'POST',
      body: JSON.stringify({
        userId: data.userId,
        externalId: data.externalId,
        destinationGeofenceTag: 'dealer',
        destinationGeofenceExternalId: data.destinationDealerId,
        mode: data.mode || 'car',
        metadata: {
          ...data.metadata,
          startTime: new Date().toISOString(),
          purpose: 'dealer_visit'
        }
      })
    });
  }

  // Pause journey tracking - Radar manages trip status automatically through tracking
  async pauseJourney(tripId: string, userId: string, currentLocation: { latitude: number; longitude: number }) {
    // Just track location with pause metadata - Radar will handle trip state
    return this.makeRequest('/track', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: `device_${userId}`,
        userId,
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        accuracy: 10,
        stopped: true, // Indicate user is stopped
        metadata: {
          tripId,
          action: 'journey_paused',
          timestamp: new Date().toISOString()
        }
      })
    }, true); // Use publishable key
  }

  // Resume journey tracking
  async resumeJourney(tripId: string, userId: string, currentLocation: { latitude: number; longitude: number }) {
    // Track location with resume metadata
    return this.makeRequest('/track', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: `device_${userId}`,
        userId,
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        accuracy: 10,
        stopped: false, // Indicate user is moving
        metadata: {
          tripId,
          action: 'journey_resumed',
          timestamp: new Date().toISOString()
        }
      })
    }, true); // Use publishable key
  }

  // Complete journey - track final location, trip completion is managed by Radar
  async completeJourney(tripId: string, userId: string, finalLocation: { latitude: number; longitude: number }) {
    // Final location track with completion metadata
    return this.makeRequest('/track', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: `device_${userId}`,
        userId,
        latitude: finalLocation.latitude,
        longitude: finalLocation.longitude,
        accuracy: 10,
        metadata: {
          tripId,
          action: 'journey_completed',
          timestamp: new Date().toISOString()
        }
      })
    }, true); // Use publishable key
  }

  // Get comprehensive journey report
  async getJourneyReport(tripId: string) {
    const trip = await this.makeRequest(`/trips/${tripId}`);
    
    return {
      tripId,
      status: trip.status,
      totalDistance: trip.distance,
      duration: trip.duration,
      startTime: trip.createdAt,
      endTime: trip.completedAt,
      checkpoints: trip.events?.filter((event: any) => 
        event.type === 'user.entered_geofence' || event.type === 'user.exited_geofence'
      ),
      route: trip.route,
      summary: {
        dealersVisited: trip.events?.filter((event: any) => 
          event.type === 'user.entered_geofence' && event.geofence?.tag === 'dealer'
        ).length || 0,
        timeSpent: trip.duration,
        averageSpeed: trip.distance && trip.duration ? (trip.distance / trip.duration) * 3.6 : 0 // km/h
      }
    };
  }

  // =================== REAL-TIME TRACKING & NOTIFICATIONS ===================

  // Check if user is approaching dealer location
  async checkApproachingDealer(userId: string, latitude: number, longitude: number, dealerId?: string) {
    const trackingResult = await this.makeRequest('/track', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: `device_${userId}`,
        userId,
        latitude,
        longitude,
        accuracy: 10,
        metadata: {
          action: 'approach_check',
          dealerId,
          timestamp: new Date().toISOString()
        }
      })
    }, true); // Use publishable key

    // Check for approaching events
    const approachingEvent = trackingResult.events?.find((event: any) => 
      event.type === 'trip.approaching'
    );

    const arrivedEvent = trackingResult.events?.find((event: any) => 
      event.type === 'trip.arrived'
    );

    return {
      isApproaching: !!approachingEvent,
      hasArrived: !!arrivedEvent,
      eta: trackingResult.user?.trip?.eta,
      distance: trackingResult.user?.place?.distance,
      events: trackingResult.events,
      currentTrip: trackingResult.user?.trip
    };
  }

  // Track user location with comprehensive event handling
  async trackUserLocation(userId: string, latitude: number, longitude: number, options?: {
    tripId?: string;
    foreground?: boolean;
    stopped?: boolean;
    accuracy?: number;
    metadata?: any;
  }) {
    return this.makeRequest('/track', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: `device_${userId}`,
        userId,
        latitude,
        longitude,
        accuracy: options?.accuracy || 10,
        foreground: options?.foreground,
        stopped: options?.stopped,
        metadata: {
          timestamp: new Date().toISOString(),
          source: 'web_app',
          ...options?.metadata
        }
      })
    }, true); // Use publishable key
  }

  // =================== GEOFENCE MANAGEMENT ===================

  // Update geofence
  async updateGeofence(tag: string, externalId: string, data: any) {
    return this.makeRequest(`/geofences/${tag}/${externalId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  // Delete geofence
  async deleteGeofence(geofenceId: string) {
    return this.makeRequest(`/geofences/${geofenceId}`, {
      method: 'DELETE'
    });
  }

  // List geofences with filtering
  async listGeofences(tag?: string, limit?: number) {
    const params = new URLSearchParams();
    if (tag) params.append('tag', tag);
    if (limit) params.append('limit', limit.toString());
    
    const queryString = params.toString();
    return this.makeRequest(`/geofences${queryString ? `?${queryString}` : ''}`);
  }

  // =================== CONTEXT FOR FRONTEND ===================
  
  // Get context for a location (stateless, frontend-safe)
  async getLocationContext(latitude: number, longitude: number, userId?: string) {
    const params = new URLSearchParams({
      coordinates: `${latitude},${longitude}`
    });
    
    if (userId) {
      params.append('userId', userId);
    }

    return this.makeRequest(`/context?${params}`, {}, true); // Use publishable key
  }

  // =================== FRONTEND-READY METHODS ===================
  
  // Get publishable key for frontend use
  getPublishableKey() {
    return this.publishableKey;
  }

  // Create frontend-safe tracking method
  async trackLocationForFrontend(data: {
    deviceId: string;
    userId?: string;
    latitude: number;
    longitude: number;
    accuracy: number;
    foreground?: boolean;
    stopped?: boolean;
    metadata?: any;
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
        metadata: {
          timestamp: new Date().toISOString(),
          source: 'frontend',
          ...data.metadata
        }
      })
    }, true); // Use publishable key
  }

  // =================== WEBHOOK EVENT PROCESSING ===================

  // Process webhook events for real-time notifications
  async processWebhookEvent(eventData: any) {
    const { type, user, geofence, trip, location } = eventData;

    switch (type) {
      case 'user.entered_geofence':
        return this.handleGeofenceEntry(user, geofence, location);
      
      case 'user.exited_geofence':
        return this.handleGeofenceExit(user, geofence, location);
      
      case 'trip.approaching':
        return this.handleTripApproaching(user, trip, location);
      
      case 'trip.arrived':
        return this.handleTripArrived(user, trip, location);
      
      case 'trip.completed':
        return this.handleTripCompleted(user, trip);
      
      default:
        console.log('Unhandled webhook event:', type);
        return null;
    }
  }

  private async handleGeofenceEntry(user: any, geofence: any, location: any) {
    return {
      type: 'geofence_entry',
      userId: user.userId,
      dealerId: geofence.externalId,
      dealerName: geofence.description,
      timestamp: new Date().toISOString(),
      location,
      message: `User entered ${geofence.description}`
    };
  }

  private async handleGeofenceExit(user: any, geofence: any, location: any) {
    return {
      type: 'geofence_exit',
      userId: user.userId,
      dealerId: geofence.externalId,
      dealerName: geofence.description,
      timestamp: new Date().toISOString(),
      location,
      message: `User left ${geofence.description}`
    };
  }

  private async handleTripApproaching(user: any, trip: any, location: any) {
    return {
      type: 'approaching_dealer',
      userId: user.userId,
      tripId: trip.externalId,
      dealerId: trip.destinationGeofenceExternalId,
      eta: trip.eta,
      timestamp: new Date().toISOString(),
      location,
      message: `Approaching dealer, ETA: ${trip.eta?.duration} minutes`
    };
  }

  private async handleTripArrived(user: any, trip: any, location: any) {
    return {
      type: 'arrived_at_dealer',
      userId: user.userId,
      tripId: trip.externalId,
      dealerId: trip.destinationGeofenceExternalId,
      timestamp: new Date().toISOString(),
      location,
      message: `Arrived at dealer location`
    };
  }

  private async handleTripCompleted(user: any, trip: any) {
    return {
      type: 'trip_completed',
      userId: user.userId,
      tripId: trip.externalId,
      totalDistance: trip.distance,
      duration: trip.duration,
      timestamp: new Date().toISOString(),
      message: `Journey completed - ${trip.distance}m in ${trip.duration} seconds`
    };
  }
}

export const radarService = new RadarService();