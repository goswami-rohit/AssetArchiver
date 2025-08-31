// src/integrations/radar.ts
import axios from "axios";

// load both keys from env
const RADAR_SECRET_KEY = process.env.RADAR_SECRET_KEY!;
const RADAR_PUBLISHABLE_KEY = process.env.RADAR_PUBLISHABLE_KEY!;

/**
 * 1. GET /v1/geocode/forward
 */
async function forwardGeocode(query: string) {
  const res = await axios.get("https://api.radar.io/v1/geocode/forward", {
    headers: { Authorization: `Bearer ${RADAR_SECRET_KEY}` },
    params: { query },
  });
  return res.data;
}

/**
 * 2. POST /v1/trips
 */
async function createTrip(data: {
  externalId: string;
  destinationGeofenceTag?: string;
  destinationGeofenceExternalId?: string;
  userId?: string;
  mode?: "foot" | "bike" | "car";
  approachingThreshold?: number;
  scheduledArrivalAt?: string;
  metadata?: Record<string, any>;
}) {
  const res = await axios.post("https://api.radar.io/v1/trips", data, {
    headers: { Authorization: `Bearer ${process.env.RADAR_SECRET_KEY}` },
  });
  return res.data;
}

/**
 * 3. GET /v1/trips/:id
 */
async function getTrip(idOrExternalId: string, includeLocations = true) {
  const res = await axios.get(`https://api.radar.io/v1/trips/${idOrExternalId}`, {
    headers: { Authorization: `Bearer ${RADAR_SECRET_KEY}` },
    params: { includeLocations },
  });
  return res.data;
}

/**
 * 4. GET /v1/trips
 */
async function listTrips(filters?: {
  status?: string;
  userId?: string;
  destinationGeofenceTag?: string;
  destinationGeofenceExternalId?: string;
  externalId?: string;
  includeLocations?: boolean;
  createdAfter?: string;
  createdBefore?: string;
  sortBy?: "createdAt" | "updatedAt";
  delayed?: boolean;
  limit?: number;
}) {
  const res = await axios.get("https://api.radar.io/v1/trips", {
    headers: { Authorization: `Bearer ${RADAR_SECRET_KEY}` },
    params: filters,
  });
  return res.data;
}

/**
 * 5. DELETE /v1/trips/:id
 */
async function deleteTrip(idOrExternalId: string) {
  const res = await axios.delete(`https://api.radar.io/v1/trips/${idOrExternalId}`, {
    headers: { Authorization: `Bearer ${RADAR_SECRET_KEY}` },
  });
  return res.data;
}

/**
 * 6. GET /v1/trips/:id/route
 */
async function getTripRoute(idOrExternalId: string) {
  const res = await axios.get(`https://api.radar.io/v1/trips/${idOrExternalId}/route`, {
    headers: { Authorization: `Bearer ${RADAR_SECRET_KEY}` },
  });
  return res.data;
}

/**
 * 7. PATCH /v1/trips/:id/update
 */
async function updateTrip(
  idOrExternalId: string,
  data: {
    status:
      | "pending"
      | "started"
      | "approaching"
      | "arrived"
      | "completed"
      | "canceled";
    mode?: "foot" | "bike" | "car";
    destinationGeofenceTag?: string;
    destinationGeofenceExternalId?: string;
    approachingThreshold?: number;
    scheduledArrivalAt?: string;
    metadata?: Record<string, any>;
  }
) {
  const res = await axios.patch(
    `https://api.radar.io/v1/trips/${idOrExternalId}/update`,
    data,
    {
      headers: { Authorization: `Bearer ${RADAR_PUBLISHABLE_KEY}` },
    }
  );
  return res.data;
}

/**
 * 8. GET /v1/geofences/:id OR /v1/geofences/:tag/:externalId
 */
async function getGeofence(idOrTag: string, externalId?: string) {
  const url = externalId
    ? `https://api.radar.io/v1/geofences/${idOrTag}/${externalId}`
    : `https://api.radar.io/v1/geofences/${idOrTag}`;

  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${RADAR_SECRET_KEY}` },
  });
  return res.data;
}

/**
 * Wrapper export: group all functions
 */
export const radar = {
  geo: { forwardGeocode },
  trips: {
    createTrip,
    getTrip,
    listTrips,
    deleteTrip,
    getTripRoute,
    updateTrip,
  },
  geofences: {
    getGeofence,
  },
};
