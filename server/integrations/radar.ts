// src/integrations/radar.ts
import dotenv from "dotenv";
dotenv.config();
import axios from "axios";


const RADAR_SECRET_KEY = process.env.RADAR_SECRET_KEY;
if (!RADAR_SECRET_KEY) {
  throw new Error("RADAR_SECRET_KEY is missing in environment variables");
}

function auth() {
  return { Authorization: RADAR_SECRET_KEY };
}

/* ===== Server-only (secret) ===== */
async function getTrip(idOrExternalId: string, includeLocations = true) {
  const res = await axios.get(`https://api.radar.io/v1/trips/${idOrExternalId}`, {
    headers: auth(),
    params: { includeLocations },
  });
  return res.data;
}

async function getTripEta(idOrExternalId: string) {
  const res = await axios.get(`https://api.radar.io/v1/trips/${idOrExternalId}/eta`, {
    headers: auth(),
  });
  return res.data;
}

async function getTripRoute(idOrExternalId: string) {
  const res = await axios.get(`https://api.radar.io/v1/trips/${idOrExternalId}/route`, {
    headers: auth(),
  });
  return res.data;
}

async function listTrips(params: { status?: string; includeLocations?: boolean }) {
  const res = await axios.get("https://api.radar.io/v1/trips", {
    headers: auth(),
    params,
  });
  return res.data;
}

// Add this to radar.ts inside the Server-only section
async function updateTrip(idOrExternalId: string, status: string) {
  const res = await axios.patch(`https://api.radar.io/v1/trips/${idOrExternalId}`,
    { status },
    { headers: auth() }
  );
  return res.data;
}

async function deleteTrip(idOrExternalId: string) {
  const res = await axios.delete(`https://api.radar.io/v1/trips/${idOrExternalId}`, {
    headers: auth(),
  });
  return res.data;
}

async function searchGeofences(params: {
  near?: { latitude: number; longitude: number };
  radius?: number;
  tags?: string[];
  limit?: number;
}) {
  const res = await axios.get("https://api.radar.io/v1/geofences/search", {
    headers: auth(),
    params,
  });
  return res.data;
}

async function getGeofence(tag: string, externalId: string) {
  const res = await axios.get(`https://api.radar.io/v1/geofences/${tag}/${externalId}`, {
    headers: auth(),
  });
  return res.data;
}

/* ===== Export (no client section) ===== */
export const radar = {
  server: {
    getTrip,
    getTripEta,
    getTripRoute,
    listTrips,
    deleteTrip,
    updateTrip,
  },
  geofences: {
    searchGeofences,
    getGeofence,
  },
};
