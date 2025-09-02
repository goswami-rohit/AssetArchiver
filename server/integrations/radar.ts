// src/integrations/radar.ts
import axios from "axios";

// Backend key (safe to use in server-side context)
const RADAR_SECRET_KEY = process.env.RADAR_SECRET_KEY!;

// Publishable key (browser only)
const RADAR_PUBLISHABLE_KEY = process.env.RADAR_PUBLISHABLE_KEY!;

// Lazy-loaded Radar SDK (so Node won’t crash)
let Radar: any = null;
if (typeof window !== "undefined") {
  import("radar-sdk-js")
    .then((mod) => {
      Radar = mod.default || mod;
      if (RADAR_PUBLISHABLE_KEY) {
        Radar.initialize(RADAR_PUBLISHABLE_KEY);
      }
    })
    .catch((err) => {
      console.error("Failed to load radar-sdk-js in browser:", err);
    });
}

/**
 * BACKEND API FUNCTIONS (axios + secret key)
 */
async function createTrip(data: any) {
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

async function updateTrip(idOrExternalId: string, data: any) {
  const res = await axios.patch(
    `https://api.radar.io/v1/trips/${idOrExternalId}/update`,
    data,
    { headers: { Authorization: `Bearer ${RADAR_SECRET_KEY}` } }
  );
  return res.data;
}

/**
 * FRONTEND WEB SDK FUNCTIONS (wrapped in runtime checks)
 */
export const initializeRadar = () => {
  if (Radar) Radar.initialize(RADAR_PUBLISHABLE_KEY);
};

export const setUserId = (userId: string) => {
  if (Radar) Radar.setUserId(userId);
};

export const trackLocationOnce = async () => {
  if (!Radar) throw new Error("Radar SDK not available (Node env?)");
  const result = await Radar.trackOnce();
  return {
    latitude: result.location.coordinates[1],
    longitude: result.location.coordinates[0],
    location: result.location,
    user: result.user,
    events: result.events,
  };
};

export const startLocationTracking = (
  onLocationUpdate: (coords: { latitude: number; longitude: number }) => void
) => {
  const trackingInterval = setInterval(async () => {
    try {
      const { latitude, longitude } = await trackLocationOnce();
      onLocationUpdate({ latitude, longitude });
    } catch (error) {
      console.error("Tracking error:", error);
    }
  }, 30000);
  return trackingInterval;
};

export const stopLocationTracking = (intervalId: NodeJS.Timeout) => {
  clearInterval(intervalId);
};

/**
 * COMPLETE EXPORT
 */
export const radar = {
  initialize: initializeRadar,
  trips: {
    createTrip,
    getTrip,
    deleteTrip,
    updateTrip,
  },
  location: {
    setUserId,
    trackOnce: trackLocationOnce,
    startTracking: startLocationTracking,
    stopTracking: stopLocationTracking,
  },
};
