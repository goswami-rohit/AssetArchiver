// src/integrations/radar.ts
import axios from "axios";

const RADAR_SECRET_KEY = process.env.RADAR_SECRET_KEY!;
if (!RADAR_SECRET_KEY) {
  throw new Error("RADAR_SECRET_KEY is missing in environment variables");
}

/**
 * BACKEND API FUNCTIONS (REST, using secret key)
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
    headers: { Authorization: `Bearer ${RADAR_SECRET_KEY}` },
  });
  return res.data;
}

async function getTrip(idOrExternalId: string, includeLocations = true) {
  const res = await axios.get(`https://api.radar.io/v1/trips/${idOrExternalId}`, {
    headers: { Authorization: `Bearer ${RADAR_SECRET_KEY}` },
    params: { includeLocations },
  });
  return res.data;
}

async function deleteTrip(idOrExternalId: string) {
  const res = await axios.delete(`https://api.radar.io/v1/trips/${idOrExternalId}`, {
    headers: { Authorization: `Bearer ${RADAR_SECRET_KEY}` },
  });
  return res.data;
}

async function updateTrip(
  idOrExternalId: string,
  data: {
    status?:
      | "pending"
      | "started"
      | "approaching"
      | "arrived"
      | "completed"
      | "canceled"
      | string; // allow custom appState strings
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
      headers: { Authorization: `Bearer ${RADAR_SECRET_KEY}` },
    }
  );
  return res.data;
}

async function listTrips(params: { status?: string; includeLocations?: boolean }) {
  const res = await axios.get("https://api.radar.io/v1/trips", {
    headers: { Authorization: `Bearer ${RADAR_SECRET_KEY}` },
    params,
  });
  return res.data;
}

async function getTripRoute(idOrExternalId: string) {
  const res = await axios.get(`https://api.radar.io/v1/trips/${idOrExternalId}/route`, {
    headers: { Authorization: `Bearer ${RADAR_SECRET_KEY}` },
  });
  return res.data;
}

async function getGeofence(tag: string, externalId: string) {
  const res = await axios.get(`https://api.radar.io/v1/geofences/${tag}/${externalId}`, {
    headers: { Authorization: `Bearer ${RADAR_SECRET_KEY}` },
  });
  return res.data;
}

/**
 * EXPORT (backend-only)
 */
export const radar = {
  trips: {
    createTrip,
    getTrip,
    deleteTrip,
    updateTrip,
    listTrips,
    getTripRoute,
  },
  geofences: {
    getGeofence,
  },
};
