// routes.ts - COMPLETE IMPLEMENTATION WITH AUTO-CRUD
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
  dealerReportsAndScores,
  insertDailyVisitReportSchema,
  insertTechnicalVisitReportSchema,
  insertPermanentJourneyPlanSchema,
  insertSalesmanAttendanceSchema,
  insertSalesmanLeaveApplicationSchema,
  insertClientReportSchema,
  insertCompetitionReportSchema,
  insertGeoTrackingSchema,
  insertDailyTaskSchema,
  insertDealerSchema,
  insertDealerReportsAndScoresSchema
} from 'shared/schema';
import { eq, desc, asc, and, gte, lte, isNull, inArray, notInArray, like, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import multer from 'multer';
import * as turf from '@turf/turf';
import { ChatMessage } from 'server/bot/aiService';
import EnhancedRAGService from 'server/bot/aiService';

// ========================= Radar.com SINGLE FUNCTION WRAPPER =========================
// Supports: track, context, geocode (forward/reverse/ip), search (autocomplete/users/geofences/places),
// address validate, route (distance/matrix/match/directions/optimize).
// Uses env: RADAR_PUBLISHABLE_KEY, RADAR_SECRET_KEY
// ------------------------------------------------------------------------------------

type LatLng = { lat: number; lng: number };
type AnyDict = Record<string, any>;

export type RadarAction =
  // Tracking & Context
  | "track"
  | "context"
  // Geocoding
  | "geocode.forward" | "geocode.reverse" | "geocode.ip"
  // Search
  | "search.autocomplete" | "search.users" | "search.geofences" | "search.places"
  // Address validate
  | "address.validate"
  // Routing
  | "route.distance" | "route.matrix" | "route.match" | "route.directions" | "route.optimize";

const RADAR_BASE = "https://api.radar.io/v1";
const RADAR_PUBLISHABLE_KEY = process.env.RADAR_PUBLISHABLE_KEY || "";
const RADAR_SECRET_KEY = process.env.RADAR_SECRET_KEY || "";

/** Build query string from object, skipping empty values */
function qs(params: AnyDict): string {
  const clean: AnyDict = {};
  Object.keys(params || {}).forEach((k) => {
    const v = params[k];
    if (v !== undefined && v !== null && v !== "") clean[k] = v;
  });
  const s = new URLSearchParams(clean).toString();
  return s ? `?${s}` : "";
}

/** Turn [{lat,lng}] into "lat,lng|lat,lng|..." */
function coordsList(points: LatLng[] = []): string {
  return points.map((p) => `${p.lat},${p.lng}`).join("|");
}

/** Pick publishable vs secret key */
function pickAuthKey(action: RadarAction): string {
  return action === "search.users" ? RADAR_SECRET_KEY : RADAR_PUBLISHABLE_KEY;
}

/**
 * Unified Radar API function
 */
export async function radar(action: RadarAction, payload: AnyDict = {}): Promise<any> {
  if (!RADAR_PUBLISHABLE_KEY) {
    throw new Error("Missing RADAR_PUBLISHABLE_KEY in environment");
  }
  if (action === "search.users" && !RADAR_SECRET_KEY) {
    throw new Error("Missing RADAR_SECRET_KEY in environment (required for search.users)");
  }

  let endpoint = "";
  let method: "GET" | "POST" = "GET";
  let body: any = null;

  switch (action) {
    // -------------------- Tracking & Context --------------------
    case "track": {
      method = "POST";
      endpoint = "track";
      const {
        deviceId, userId, latitude, longitude, accuracy,
        foreground, stopped, description, metadata, deviceType,
      } = payload;

      if (!deviceId && !userId) {
        throw new Error("Radar.track requires either deviceId or userId");
      }

      body = {
        deviceId, userId, latitude, longitude, accuracy,
        foreground, stopped, description, metadata, deviceType,
      };
      break;
    }
    case "context": {
      const { lat, lng, userId } = payload;
      endpoint = `context${qs({ coordinates: `${lat},${lng}`, userId })}`;
      break;
    }

    // -------------------- Geocoding --------------------
    case "geocode.forward": {
      const { query, layers, country, lang } = payload;
      endpoint = `geocode/forward${qs({ query, layers, country, lang })}`;
      break;
    }
    case "geocode.reverse": {
      const { lat, lng, layers } = payload;
      endpoint = `geocode/reverse${qs({ coordinates: `${lat},${lng}`, layers })}`;
      break;
    }
    case "geocode.ip": {
      endpoint = "geocode/ip";
      break;
    }

    // -------------------- Search --------------------
    case "search.autocomplete": {
      const { query, near, layers, limit, countryCode, lang } = payload;
      endpoint = `search/autocomplete${qs({
        query,
        near: near ? `${near.lat},${near.lng}` : undefined,
        layers, limit, countryCode, lang,
      })}`;
      break;
    }
    case "search.users": {
      const { near, radius, mode, limit, metadata = {} } = payload;
      const base = {
        near: near ? `${near.lat},${near.lng}` : undefined,
        radius, mode, limit,
      };
      const metaEntries: AnyDict = {};
      Object.keys(metadata).forEach((k) => {
        metaEntries[`metadata[${k}]`] = metadata[k];
      });
      endpoint = `search/users${qs({ ...base, ...metaEntries })}`;
      break;
    }
    case "search.geofences": {
      const { near, limit, radius, tags, includeGeometry, metadata = {} } = payload;
      const base = {
        near: near ? `${near.lat},${near.lng}` : undefined,
        limit, radius, tags, includeGeometry,
      };
      const metaEntries: AnyDict = {};
      Object.keys(metadata).forEach((k) => {
        metaEntries[`metadata[${k}]`] = metadata[k];
      });
      endpoint = `search/geofences${qs({ ...base, ...metaEntries })}`;
      break;
    }
    case "search.places": {
      const { chains, categories, iataCode, near, radius, limit, chainMetadata = {} } = payload;
      const base = {
        chains, categories, iataCode,
        near: near ? `${near.lat},${near.lng}` : undefined,
        radius, limit,
      };
      const cm: AnyDict = {};
      Object.keys(chainMetadata).forEach((k) => {
        cm[`chainMetadata[${k}]`] = chainMetadata[k];
      });
      endpoint = `search/places${qs({ ...base, ...cm })}`;
      break;
    }

    // -------------------- Address validate --------------------
    case "address.validate": {
      const { city, stateCode, postalCode, countryCode, number, street, unit, addressLabel } = payload;
      endpoint = `addresses/validate${qs({
        city, stateCode, postalCode, countryCode, number, street, unit, addressLabel,
      })}`;
      break;
    }

    // -------------------- Routing --------------------
    case "route.distance": {
      const { origin, destination, modes, units, avoid, geometry } = payload;
      endpoint = `route/distance${qs({
        origin: `${origin.lat},${origin.lng}`,
        destination: `${destination.lat},${destination.lng}`,
        modes, units, avoid, geometry,
      })}`;
      break;
    }
    case "route.matrix": {
      const { origins = [], destinations = [], mode, units, avoid } = payload;
      endpoint = `route/matrix${qs({
        origins: coordsList(origins),
        destinations: coordsList(destinations),
        mode, units, avoid,
      })}`;
      break;
    }
    case "route.match": {
      method = "POST";
      endpoint = "route/match";
      const { path, mode, roadAttributes, units, geometry } = payload;
      body = { path, mode, roadAttributes, units, geometry };
      break;
    }
    case "route.directions": {
      const { locations = [], mode, units, avoid, geometry, alternatives, lang } = payload;
      endpoint = `route/directions${qs({
        locations: coordsList(locations),
        mode, units, avoid, geometry, alternatives, lang,
      })}`;
      break;
    }
    case "route.optimize": {
      const { locations = [], mode, units, geometry } = payload;
      endpoint = `route/optimize${qs({
        locations: coordsList(locations),
        mode, units, geometry,
      })}`;
      break;
    }

    default:
      const _never: never = action;
      throw new Error(`Unsupported Radar action: ${String(_never)}`);
  }

  const authKey = pickAuthKey(action);
  if (!authKey) throw new Error(`Missing API key for action ${action}`);

  const res = await fetch(`${RADAR_BASE}/${endpoint}`, {
    method,
    headers: {
      Authorization: authKey,
      "Content-Type": method === "POST" ? "application/json" : "text/plain",
    },
    body: method === "POST" && body ? JSON.stringify(body) : null,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Radar ${action} failed: ${res.status} ${text}`);
  }
  return res.json();
}


// Fix multer typing
interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

// Configure multer for image uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Office location coordinates with geo-fencing polygons
const OFFICE_LOCATIONS = [
  {
    name: "Head Office",
    lat: 26.1200853,
    lng: 91.7955807,
    radius: 100,
    polygon: turf.circle([91.7955807, 26.1200853], 0.1, { units: 'kilometers' })
  }
];

// ============================================
// SCHEMA-PERFECT AUTO-CRUD GENERATOR
// ============================================
function createAutoCRUD(app: Express, config: {
  endpoint: string,
  table: any,
  schema: z.ZodSchema,
  tableName: string,
  autoFields?: { [key: string]: () => any },
  dateField?: string // For date range filtering
}) {
  const { endpoint, table, schema, tableName, autoFields = {}, dateField } = config;

  // CREATE - with perfect schema validation
  app.post(`/api/${endpoint}`, async (req: Request, res: Response) => {
    try {
      // Parse and validate against exact schema
      const parseResult = schema.safeParse(req.body);

      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          error: `Validation failed for ${tableName}`,
          details: parseResult.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            received: err.received
          }))
        });
      }

      const validatedData = parseResult.data;

      // Apply auto-generated fields (only if not provided)
      const finalData = { ...validatedData };
      Object.entries(autoFields).forEach(([field, generator]) => {
        if (finalData[field] === undefined || finalData[field] === null) {
          finalData[field] = generator();
        }
      });

      // Schema handles createdAt/updatedAt with defaultNow(), but ensure they're set
      if (table.createdAt && !finalData.createdAt) {
        finalData.createdAt = new Date();
      }
      if (table.updatedAt && !finalData.updatedAt) {
        finalData.updatedAt = new Date();
      }

      const newRecord = await db.insert(table).values(finalData).returning();
      res.json({
        success: true,
        data: newRecord[0],
        message: `${tableName} created successfully`
      });
    } catch (error) {
      console.error(`Create ${tableName} error:`, error);
      res.status(500).json({
        success: false,
        error: `Failed to create ${tableName}`,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET ALL by User ID - with proper date field handling
  app.get(`/api/${endpoint}/user/:userId`, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { startDate, endDate, limit = '50', completed, ...filters } = req.query;

      // Base condition - userId is integer in schema
      let whereCondition = eq(table.userId, parseInt(userId));

      // Date range filtering using the correct date field for each table
      if (startDate && endDate && dateField && table[dateField]) {
        whereCondition = and(
          whereCondition,
          gte(table[dateField], startDate as string),
          lte(table[dateField], endDate as string)
        );
      }

      // Handle completed filter for PJPs
      if (completed === 'true' && table.status) {
        whereCondition = and(whereCondition, eq(table.status, 'completed'));
      }

      // Additional filters from query params
      Object.entries(filters).forEach(([key, value]) => {
        if (value && table[key]) {
          whereCondition = and(whereCondition, eq(table[key], value));
        }
      });

      // Order by most relevant date field or createdAt
      const orderField = table[dateField] || table.createdAt || table.updatedAt;

      const records = await db.select().from(table)
        .where(whereCondition)
        .orderBy(desc(orderField))
        .limit(parseInt(limit as string));

      res.json({ success: true, data: records });
    } catch (error) {
      console.error(`Get ${tableName}s error:`, error);
      res.status(500).json({
        success: false,
        error: `Failed to fetch ${tableName}s`,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET BY ID - with proper UUID/varchar handling
  app.get(`/api/${endpoint}/:id`, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const [record] = await db.select().from(table).where(eq(table.id, id)).limit(1);

      if (!record) {
        return res.status(404).json({
          success: false,
          error: `${tableName} not found`
        });
      }

      res.json({ success: true, data: record });
    } catch (error) {
      console.error(`Get ${tableName} error:`, error);
      res.status(500).json({
        success: false,
        error: `Failed to fetch ${tableName}`,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // UPDATE - with partial schema validation
  app.put(`/api/${endpoint}/:id`, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Create partial schema for updates
      const partialSchema = schema.partial();
      const parseResult = partialSchema.safeParse(req.body);

      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          error: `Validation failed for ${tableName} update`,
          details: parseResult.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            received: err.received
          }))
        });
      }

      const validatedData = parseResult.data;

      // Always update the updatedAt field
      const updateData = {
        ...validatedData,
        updatedAt: new Date()
      };

      const updatedRecord = await db.update(table)
        .set(updateData)
        .where(eq(table.id, id))
        .returning();

      if (!updatedRecord || updatedRecord.length === 0) {
        return res.status(404).json({
          success: false,
          error: `${tableName} not found`
        });
      }

      res.json({
        success: true,
        data: updatedRecord[0],
        message: `${tableName} updated successfully`
      });
    } catch (error) {
      console.error(`Update ${tableName} error:`, error);
      res.status(500).json({
        success: false,
        error: `Failed to update ${tableName}`,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // DELETE
  app.delete(`/api/${endpoint}/:id`, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const deletedRecord = await db.delete(table).where(eq(table.id, id)).returning();

      if (!deletedRecord || deletedRecord.length === 0) {
        return res.status(404).json({
          success: false,
          error: `${tableName} not found`
        });
      }

      res.json({
        success: true,
        message: `${tableName} deleted successfully`,
        data: deletedRecord[0]
      });
    } catch (error) {
      console.error(`Delete ${tableName} error:`, error);
      res.status(500).json({
        success: false,
        error: `Failed to delete ${tableName}`,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}

// ========================= Radar-aware AUTO CRUD =========================
// Adds Radar steps (track/context/geofence check) during CREATE,
// still gives you GET/PUT/DELETE like your generic builder.
// ========================================================================

type RadarGeofenceRule = {
  /** e.g. "dealer" or "store" — what you tagged geofences with in Radar */
  tag: string;
  /** Which request field should match Radar geofence.externalId (or description)? */
  externalIdField?: string; // e.g. "siteName" or "dealerExternalId"
  /** If you want to accept by description match instead of externalId */
  matchBy?: "externalId" | "description";
  /** Radius soft-fail: if provided, also allow within X meters of geometryCenter (if geometry included) */
  softRadiusMeters?: number;
  /** Custom error if geofence not satisfied */
  errorMessage?: string;
};

type RadarCreateOptions = {
  /** Use radar.track with incoming lat/lng/accuracy and write to columns on the row */
  track?: {
    latField?: string;        // default "latitude"
    lngField?: string;        // default "longitude"
    accField?: string;        // default "accuracy"
    deviceIdField?: string;   // in req.body (or headers), optional
    userIdField?: string;     // in req.body (or headers), optional
  };
  /** Use radar.context to enrich address/place into columns on the row */
  enrich?: {
    /** map { tableField: "context.path" } e.g. { locationName: "place.name" } */
    mappings?: Record<string, string>;
  };
  /** Require user to be inside a Radar geofence (by tag + externalId/description) */
  requireGeofence?: RadarGeofenceRule;
  /** If true, return nearby geofences (and we won't block if not inside) */
  nearbyGeofences?: {
    limit?: number;    // default 5
    radius?: number;   // meters, default 1000
    includeGeometry?: boolean; // default false
    tags?: string;     // optional tag filter, comma-separated
  };
};

function readFrom(obj: any, dotted: string): any {
  // "place.name" -> obj.place?.name
  return dotted.split(".").reduce((o, k) => (o ? o[k] : undefined), obj);
}

function coerceNum(x: any) {
  if (typeof x === "number") return x;
  if (typeof x === "string") return parseFloat(x);
  return undefined;
}

function valueOr<T>(v: T | undefined, fallback: T): T {
  return v === undefined || v === null ? fallback : v;
}

function http400(res: Response, msg: string, details?: any) {
  return res.status(400).json({ success: false, error: msg, details });
}

function http500(res: Response, msg: string, err: any) {
  return res.status(500).json({
    success: false,
    error: msg,
    details: err instanceof Error ? err.message : "Unknown error",
  });
}

function buildWhereByUserId(table: any, userId: string | number) {
  return eq(table.userId, typeof userId === "string" ? parseInt(userId, 10) : userId);
}

function createRadarCRUD(app: Express, config: {
  endpoint: string;
  table: any;
  schema: z.ZodSchema;
  tableName: string;
  dateField?: string;
  autoFields?: { [key: string]: () => any };
  radar?: RadarCreateOptions;
}) {
  const { endpoint, table, schema, tableName, dateField, autoFields = {}, radar: radarOpts } = config;

  // ---------------- CREATE (POST) with Radar steps ----------------
  app.post(`/api/${endpoint}`, async (req: Request, res: Response) => {
    try {
      // 1) Validate body against schema (exact, like your generic builder)
      const parse = schema.safeParse(req.body);
      if (!parse.success) {
        return res.status(400).json({
          success: false,
          error: `Validation failed for ${tableName}`,
          details: parse.error.errors.map(e => ({
            field: e.path.join("."),
            message: e.message,
            received: (e as any).received
          }))
        });
      }

      // 2) Prepare data and apply auto fields
      const validated = parse.data as Record<string, any>;
      const finalData: Record<string, any> = { ...validated };
      for (const [k, g] of Object.entries(autoFields)) {
        if (finalData[k] === undefined || finalData[k] === null) finalData[k] = g();
      }
      if (table.createdAt && !finalData.createdAt) finalData.createdAt = new Date();
      if (table.updatedAt && !finalData.updatedAt) finalData.updatedAt = new Date();

      // 3) Radar: track + enrich + geofence checks (if configured)
      let lat = undefined as number | undefined;
      let lng = undefined as number | undefined;
      let accuracy = undefined as number | undefined;

      if (radarOpts?.track) {
        const latField = radarOpts.track.latField ?? "latitude";
        const lngField = radarOpts.track.lngField ?? "longitude";
        const accField = radarOpts.track.accField ?? "accuracy";
        const deviceId = radarOpts.track.deviceIdField ? finalData[radarOpts.track.deviceIdField] : finalData.deviceId || req.headers["x-device-id"];
        const userId = radarOpts.track.userIdField ? finalData[radarOpts.track.userIdField] : finalData.userId || req.headers["x-user-id"];

        lat = coerceNum(finalData[latField]);
        lng = coerceNum(finalData[lngField]);
        accuracy = coerceNum(finalData[accField]);

        if (lat === undefined || lng === undefined || accuracy === undefined) {
          return http400(res, `Missing ${latField}/${lngField}/${accField} for ${tableName} track`);
        }

        // Radar.track
        await radar("track", {
          deviceId, userId,
          latitude: lat, longitude: lng, accuracy,
          metadata: { endpoint, tableName }
        });
      }

      // Radar.context enrichment
      let contextResp: any | undefined;
      if (radarOpts?.enrich && lat !== undefined && lng !== undefined) {
        contextResp = await radar("context", { lat, lng, userId: finalData.userId });
        const ctx = contextResp?.context || {};
        for (const [field, ctxPath] of Object.entries(radarOpts.enrich.mappings || {})) {
          const v = readFrom(ctx, ctxPath);
          if (v !== undefined && v !== null) finalData[field] = v;
        }
      }

      // Require inside geofence (dealer or site) before allowing CREATE
      if (radarOpts?.requireGeofence && lat !== undefined && lng !== undefined) {
        const rule = radarOpts.requireGeofence;
        const limit = 50;
        const r = await radar("search.geofences", {
          near: { lat, lng },
          limit,
          radius: 1000,
          includeGeometry: false,
          tags: rule.tag
        });

        const target = (rule.externalIdField && finalData[rule.externalIdField]) || finalData.siteName || finalData.dealerExternalId;
        const mode = rule.matchBy ?? "externalId";

        const found = (r?.geofences || []).some((g: any) => {
          if (mode === "externalId") return g.externalId == target;
          return (g.description || "").toLowerCase() === String(target || "").toLowerCase();
        });

        if (!found) {
          return http400(
            res,
            rule.errorMessage || `You are not inside the required ${rule.tag} geofence for ${String(target || "")}.`
          );
        }
      }

      // Optionally: attach nearby geofences info to response
      let nearby: any[] | undefined;
      if (radarOpts?.nearbyGeofences && lat !== undefined && lng !== undefined) {
        const { limit = 5, radius = 1000, includeGeometry = false, tags } = radarOpts.nearbyGeofences;
        const r = await radar("search.geofences", {
          near: { lat, lng }, limit, radius, includeGeometry, tags
        });
        nearby = r?.geofences || [];
      }

      // 4) Create row
      const created = await db.insert(table).values(finalData).returning();

      return res.json({
        success: true,
        data: created[0],
        message: `${tableName} created successfully`,
        ...(nearby ? { nearbyGeofences: nearby } : {})
      });
    } catch (err) {
      console.error(`Create ${tableName} error:`, err);
      return http500(res, `Failed to create ${tableName}`, err);
    }
  });

  // ---------------- LIST by user ----------------
  app.get(`/api/${endpoint}/user/:userId`, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { startDate, endDate, limit = "50", ...filters } = req.query;
      let whereCond = buildWhereByUserId(table, userId);

      if (startDate && endDate && dateField && table[dateField]) {
        whereCond = and(whereCond,
          gte(table[dateField], startDate as string),
          lte(table[dateField], endDate as string)
        );
      }

      for (const [k, v] of Object.entries(filters)) {
        if (v && table[k]) whereCond = and(whereCond, eq(table[k], v));
      }

      const orderField = table[dateField] || table.createdAt || table.updatedAt;
      const rows = await db.select().from(table)
        .where(whereCond)
        .orderBy(desc(orderField))
        .limit(parseInt(limit as string, 10));

      res.json({ success: true, data: rows });
    } catch (err) {
      console.error(`Get ${tableName}s error:`, err);
      return http500(res, `Failed to fetch ${tableName}s`, err);
    }
  });

  // ---------------- GET by id ----------------
  app.get(`/api/${endpoint}/:id`, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const [row] = await db.select().from(table).where(eq(table.id, id)).limit(1);
      if (!row) return res.status(404).json({ success: false, error: `${tableName} not found` });
      res.json({ success: true, data: row });
    } catch (err) {
      console.error(`Get ${tableName} error:`, err);
      return http500(res, `Failed to fetch ${tableName}`, err);
    }
  });

  // ---------------- UPDATE ----------------
  app.put(`/api/${endpoint}/:id`, async (req: Request, res: Response) => {
    try {
      const partial = config.schema.partial();
      const parsed = partial.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: `Validation failed for ${tableName} update`,
          details: parsed.error.errors.map(e => ({
            field: e.path.join("."), message: e.message, received: (e as any).received
          }))
        });
      }
      const updateData = { ...parsed.data, updatedAt: new Date() };
      const updated = await db.update(table).set(updateData).where(eq(table.id, req.params.id)).returning();
      if (!updated?.length) return res.status(404).json({ success: false, error: `${tableName} not found` });
      res.json({ success: true, data: updated[0], message: `${tableName} updated successfully` });
    } catch (err) {
      console.error(`Update ${tableName} error:`, err);
      return http500(res, `Failed to update ${tableName}`, err);
    }
  });

  // ---------------- DELETE ----------------
  app.delete(`/api/${endpoint}/:id`, async (req: Request, res: Response) => {
    try {
      const deleted = await db.delete(table).where(eq(table.id, req.params.id)).returning();
      if (!deleted?.length) return res.status(404).json({ success: false, error: `${tableName} not found` });
      res.json({ success: true, message: `${tableName} deleted successfully`, data: deleted[0] });
    } catch (err) {
      console.error(`Delete ${tableName} error:`, err);
      return http500(res, `Failed to delete ${tableName}`, err);
    }
  });
}


export function setupWebRoutes(app: Express) {
  // PWA route
  app.get('/pwa', (req: Request, res: Response) => {
    res.redirect('/login');
  });

  // ==================== AUTH ====================
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

  // ==================== ENHANCED AI/RAG ROUTES ====================

  // 🚀 ENHANCED RAG CHAT with Vector Search
  app.post('/api/rag/chat', async (req: Request, res: Response) => {
    try {
      const { messages, userId }: { messages: ChatMessage[], userId?: number } = req.body;

      // Enhanced validation
      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Messages must be a non-empty array'
        });
      }

      // Validate message format
      for (const msg of messages) {
        if (!msg.role || !msg.content || !['user', 'assistant', 'system'].includes(msg.role)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid message format. Each message must have role (user/assistant/system) and content.'
          });
        }
      }

      // Process with enhanced RAG service (vector search enabled)
      const aiResponse = await EnhancedRAGService.chat(messages, userId);

      res.json({
        success: true,
        message: aiResponse,
        timestamp: new Date().toISOString(),
        userId: userId,
        messageCount: messages.length,
        enhanced: true // Flag to indicate vector search was used
      });
    } catch (error) {
      console.error('Enhanced RAG Chat error:', error);
      res.status(500).json({
        success: false,
        error: 'Enhanced RAG chat processing failed. Please try again.',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 🤖 INTELLIGENT RAG CHAT (Complete Vector Flow)
  app.post('/api/rag/vector-chat', async (req: Request, res: Response) => {
    try {
      const { message, userId }: { message: string, userId?: number } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Message is required and must be a string'
        });
      }

      console.log(`🤖 Vector RAG request from user ${userId}: "${message.substring(0, 50)}..."`);

      // Use intelligent RAG with vector search + direct execution
      const result = await EnhancedRAGService.ragChat(message, userId);

      res.json({
        success: result.success,
        message: result.message,
        endpoint: result.endpoint,
        similarity: result.similarity,
        data: result.data,
        guidance: result.guidance,
        error: result.error,
        suggestion: result.suggestion,
        timestamp: new Date().toISOString(),
        vectorSearch: true
      });
    } catch (error) {
      console.error('Vector RAG Chat error:', error);
      res.status(500).json({
        success: false,
        error: 'Vector RAG processing failed. Please try again.',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 🔍 VECTOR-POWERED ENDPOINT DISCOVERY
  app.post('/api/rag/find-endpoint', async (req: Request, res: Response) => {
    try {
      const { query }: { query: string } = req.body;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Query is required and must be a string'
        });
      }

      console.log(`🔍 Vector endpoint search: "${query}"`);

      const bestEndpoint = await EnhancedRAGService.findBestEndpoint(query);

      if (!bestEndpoint) {
        return res.status(404).json({
          success: false,
          error: 'No relevant endpoint found via vector search',
          suggestion: 'Try a more specific query about visits, reports, dealers, or attendance'
        });
      }

      res.json({
        success: true,
        endpoint: bestEndpoint,
        message: `✅ Found relevant endpoint: ${bestEndpoint.name}`,
        similarity: bestEndpoint.similarity,
        description: bestEndpoint.description,
        requiredFields: bestEndpoint.requiredFields
      });
    } catch (error) {
      console.error('Vector endpoint discovery error:', error);
      res.status(500).json({
        success: false,
        error: 'Vector endpoint discovery failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ⚡ DIRECT API EXECUTION
  app.post('/api/rag/execute', async (req: Request, res: Response) => {
    try {
      const { endpoint, data, userId }: { endpoint: string, data: any, userId?: number } = req.body;

      if (!endpoint || !data) {
        return res.status(400).json({
          success: false,
          error: 'Endpoint and data are required for direct execution'
        });
      }

      console.log(`⚡ Direct execution: ${endpoint} for user ${userId}`);

      const result = await EnhancedRAGService.executeEndpoint(endpoint, data, userId);

      res.json({
        success: result.success,
        data: result.data,
        endpoint: result.endpoint,
        error: result.error,
        details: result.details,
        timestamp: new Date().toISOString(),
        directExecution: true
      });
    } catch (error) {
      console.error('Direct API execution error:', error);
      res.status(500).json({
        success: false,
        error: 'Direct API execution failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 📋 ENHANCED DATA EXTRACTION & SUBMISSION
  app.post('/api/rag/submit', async (req: Request, res: Response) => {
    try {
      const { messages, userId }: { messages: ChatMessage[], userId: number } = req.body;

      // Enhanced validation
      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Messages must be a non-empty array for data extraction'
        });
      }

      if (!userId || typeof userId !== 'number') {
        return res.status(400).json({
          success: false,
          error: 'Valid numeric userId is required for submission'
        });
      }

      // Validate message format
      for (const msg of messages) {
        if (!msg.role || !msg.content || !['user', 'assistant', 'system'].includes(msg.role)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid message format in conversation history'
          });
        }
      }

      console.log(`📋 Enhanced data extraction for user ${userId}`);

      // Enhanced structured data extraction with vector context
      const extracted = await EnhancedRAGService.extractStructuredData(messages, userId);

      if (!extracted || extracted.error) {
        return res.status(400).json({
          success: false,
          error: extracted?.error || 'Unable to extract sufficient data from conversation.',
          suggestion: 'Try providing specific information like dealer name, location, visit type, etc.',
          vectorSearch: true
        });
      }

      // Direct execution using enhanced service
      const executionResult = await EnhancedRAGService.executeEndpoint(
        extracted.endpoint,
        extracted.data,
        userId
      );

      if (!executionResult.success) {
        return res.status(400).json({
          success: false,
          error: `Submission failed: ${executionResult.error}`,
          details: executionResult.details,
          endpoint: extracted.endpoint,
          validationErrors: executionResult.details
        });
      }

      // Enhanced success response
      const endpointName = extracted.endpoint.replace('/api/', '').toUpperCase();

      res.json({
        success: true,
        endpoint: extracted.endpoint,
        recordId: executionResult.data?.id,
        data: executionResult.data,
        message: `✅ Successfully submitted ${endpointName} via enhanced RAG!`,
        submissionDetails: {
          endpointName,
          recordId: executionResult.data?.id,
          submittedAt: new Date().toISOString(),
          userId: userId,
          fieldsSubmitted: Object.keys(extracted.data || {}).length,
          vectorSearch: true,
          directExecution: true
        }
      });
    } catch (error) {
      console.error('Enhanced RAG Submit error:', error);
      res.status(500).json({
        success: false,
        error: 'Enhanced RAG submission processing failed. Please try again.',
        details: error instanceof Error ? error.message : 'Unknown error',
        suggestion: 'Check your data format and try submitting again'
      });
    }
  });

  // 📊 SMART DATA FETCHING
  app.get('/api/rag/fetch/:endpoint/user/:userId', async (req: Request, res: Response) => {
    try {
      const { endpoint, userId } = req.params;
      const { limit = '10', ...filters } = req.query;

      if (!endpoint || !userId) {
        return res.status(400).json({
          success: false,
          error: 'Endpoint and userId are required'
        });
      }

      console.log(`📊 Smart data fetch: ${endpoint} for user ${userId}`);

      const data = await EnhancedRAGService.fetchData(
        `/api/${endpoint}`,
        parseInt(userId),
        { limit, ...filters }
      );

      res.json({
        success: true,
        endpoint: `/api/${endpoint}`,
        data: data,
        count: data.length,
        userId: parseInt(userId),
        filters: filters,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Smart data fetch error:', error);
      res.status(500).json({
        success: false,
        error: 'Smart data fetching failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 🎯 RAG HEALTH CHECK with Vector Status
  app.get('/api/rag/health', async (req: Request, res: Response) => {
    try {
      // Test Qdrant connection
      const qdrantStatus = await qdrantClient.getCollections();

      res.json({
        success: true,
        status: 'Enhanced RAG System Online',
        features: {
          vectorSearch: true,
          directExecution: true,
          autoCrudIntegration: true,
          uiAwareness: true
        },
        qdrant: {
          connected: true,
          collections: qdrantStatus.collections.length
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        status: 'RAG System Degraded',
        error: error instanceof Error ? error.message : 'Unknown error',
        qdrant: {
          connected: false,
          error: 'Connection failed'
        }
      });
    }
  });
  // ============================================
  // SCHEMA-PERFECT AUTO-GENERATED CRUD ROUTES
  // ============================================

  // 1. Daily Visit Reports - date field, auto reportDate
  createAutoCRUD(app, {
    endpoint: 'dvr',
    table: dailyVisitReports,
    schema: insertDailyVisitReportSchema,
    tableName: 'Daily Visit Report',
    dateField: 'reportDate',
    autoFields: {
      reportDate: () => new Date().toISOString().split('T')[0], // date type
      checkInTime: () => new Date() // timestamp type
    }
  });

  // 2. Technical Visit Reports - date field, auto reportDate
  createAutoCRUD(app, {
    endpoint: 'tvr',
    table: technicalVisitReports,
    schema: insertTechnicalVisitReportSchema,
    tableName: 'Technical Visit Report',
    dateField: 'reportDate',
    autoFields: {
      reportDate: () => new Date().toISOString().split('T')[0],
      checkInTime: () => new Date()
    }
  });

  // 3. Permanent Journey Plans - date field, auto planDate and status
  createAutoCRUD(app, {
    endpoint: 'pjp',
    table: permanentJourneyPlans,
    schema: insertPermanentJourneyPlanSchema,
    tableName: 'Permanent Journey Plan',
    dateField: 'planDate',
    autoFields: {
      planDate: () => new Date().toISOString().split('T')[0],
      status: () => 'planned' // varchar type with default
    }
  });

  // 4. Dealers - no date field for filtering
  createAutoCRUD(app, {
    endpoint: 'dealers',
    table: dealers,
    schema: insertDealerSchema,
    tableName: 'Dealer'
    // No auto fields needed - all required fields should be provided
  });

  // 5. Daily Tasks - date field, auto taskDate and status
  createAutoCRUD(app, {
    endpoint: 'daily-tasks',
    table: dailyTasks,
    schema: insertDailyTaskSchema,
    tableName: 'Daily Task',
    dateField: 'taskDate',
    autoFields: {
      taskDate: () => new Date().toISOString().split('T')[0],
      status: () => 'Assigned' // matches schema default
    }
  });

  // 6. Leave Applications - date field, auto status
  createAutoCRUD(app, {
    endpoint: 'leave-applications',
    table: salesmanLeaveApplications,
    schema: insertSalesmanLeaveApplicationSchema,
    tableName: 'Leave Application',
    dateField: 'startDate',
    autoFields: {
      status: () => 'Pending' // varchar type
    }
  });

  // 7. Client Reports - no specific date field for range filtering
  createAutoCRUD(app, {
    endpoint: 'client-reports',
    table: clientReports,
    schema: insertClientReportSchema,
    tableName: 'Client Report'
    // checkOutTime is timestamp but not used for filtering
  });

  // 8. Competition Reports - date field, auto reportDate
  createAutoCRUD(app, {
    endpoint: 'competition-reports',
    table: competitionReports,
    schema: insertCompetitionReportSchema,
    tableName: 'Competition Report',
    dateField: 'reportDate',
    autoFields: {
      reportDate: () => new Date().toISOString().split('T')[0]
    }
  });

  // 9. Dealer Reports and Scores - no date field for filtering
  createAutoCRUD(app, {
    endpoint: 'dealer-reports-scores',
    table: dealerReportsAndScores,
    schema: insertDealerReportsAndScoresSchema,
    tableName: 'Dealer Report and Score',
    autoFields: {
      lastUpdatedDate: () => new Date() // timestamp type
    }
  });

  createRadarCRUD(app, {
    endpoint: "attendance",
    table: salesmanAttendance,
    schema: insertSalesmanAttendanceSchema, // must match Drizzle
    tableName: "Attendance",

    // use the real schema column
    dateField: "attendanceDate",

    autoFields: {
      attendanceDate: () => new Date(),
      inTimeTimestamp: () => new Date(),
      inTimeImageCaptured: () => false,   // default until actual photo is taken
      outTimeImageCaptured: () => false,  // default until checkout
      createdAt: () => new Date(),
      updatedAt: () => new Date(),
    },

    radar: {
      track: {
        latField: "inTimeLatitude",
        lngField: "inTimeLongitude",
        accField: "inTimeAccuracy",
        userIdField: "userId",
      },
      enrich: {
        mappings: {
          locationName: "place.name",
        },
      },
      requireGeofence: {
        tag: "dealer",
        externalIdField: "locationName",
        matchBy: "externalId",
        errorMessage: "You must be inside the selected dealer geofence to check in.",
      },
      nearbyGeofences: { limit: 5, radius: 800, includeGeometry: false, tags: "dealer" },
    },
  });


  createRadarCRUD(app, {
    endpoint: "geo-tracking",
    table: geoTracking,
    schema: insertGeoTrackingSchema,
    tableName: "Geo Tracking",
    dateField: "recordedAt",
    autoFields: {
      recordedAt: () => new Date(),
    },
    radar: {
      track: {
        latField: "latitude",
        lngField: "longitude",
        accField: "accuracy",
        userIdField: "userId",
      },
      enrich: {
        mappings: {
          locationType: "place.categories.0", // e.g. first category of place
          siteName: "place.name",
        }
      },
      nearbyGeofences: { limit: 5, radius: 1000, tags: "dealer" }
    }
  });

  // C) DEALER CHECK-IN (using geoTracking as the record) ---------------
  // If you don't have a dedicated schema yet, reuse geoTracking rows for check-ins.
  // We enforce geofence presence by 'siteName' (or change to "dealerExternalId" if you add it).
  createRadarCRUD(app, {
    endpoint: "dealer-checkins",
    table: geoTracking,                  // reuse until you add a dedicated table
    schema: insertGeoTrackingSchema,
    tableName: "Dealer Check-in",
    dateField: "recordedAt",
    autoFields: {
      checkInTime: () => new Date(),
    },
    radar: {
      track: {
        latField: "latitude",
        lngField: "longitude",
        accField: "accuracy",
        userIdField: "userId",
      },
      enrich: {
        mappings: {
          siteName: "place.name",
        }
      },
      requireGeofence: {
        tag: "dealer",
        externalIdField: "siteName",     // change later to "dealerExternalId" if you add that column
        matchBy: "externalId",
        errorMessage: "Not inside the selected dealer geofence."
      }
    }
  });

  // D) Dealer Reports & Scores (no Radar needed) ------------------------
  // Keep this on your original generic AUTO-CRUD (already in your file):
  createAutoCRUD(app, {
    endpoint: 'dealer-reports-scores',
    table: dealerReportsAndScores,
    schema: insertDealerReportsAndScoresSchema,
    tableName: 'Dealer Report and Score',
    autoFields: {
      lastUpdatedDate: () => new Date()
    }
  });

  // ============================================
  // DASHBOARD STATS (with proper type handling)
  // ============================================
  app.get('/api/dashboard/stats/:userId', async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid userId - must be a number'
        });
      }

      const today = new Date().toISOString().split('T')[0]; // yyyy-mm-dd
      const now = new Date();

      // Calculate first + last day of current month
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const [
        todayAttendance,
        monthlyReports,
        pendingTasks,
        totalDealers,
        pendingLeaves
      ] = await Promise.all([
        db.select().from(salesmanAttendance)
          .where(and(
            eq(salesmanAttendance.userId, userId),
            eq(salesmanAttendance.attendanceDate, today)
          ))
          .limit(1),

        db.select({ count: sql<number>`cast(count(*) as int)` })
          .from(dailyVisitReports)
          .where(and(
            eq(dailyVisitReports.userId, userId),
            gte(dailyVisitReports.reportDate, monthStart),
            lte(dailyVisitReports.reportDate, monthEnd)
          )),

        db.select({ count: sql<number>`cast(count(*) as int)` })
          .from(dailyTasks)
          .where(and(
            eq(dailyTasks.userId, userId),
            eq(dailyTasks.status, 'Assigned')
          )),

        db.select({ count: sql<number>`cast(count(*) as int)` })
          .from(dealers)
          .where(eq(dealers.userId, userId)),

        db.select({ count: sql<number>`cast(count(*) as int)` })
          .from(salesmanLeaveApplications)
          .where(and(
            eq(salesmanLeaveApplications.userId, userId),
            eq(salesmanLeaveApplications.status, 'Pending')
          ))
      ]);

      res.json({
        success: true,
        data: {
          attendance: {
            isPresent: todayAttendance?.length > 0,
            punchInTime: todayAttendance?.[0]?.inTimeTimestamp,
            punchOutTime: todayAttendance?.[0]?.outTimeTimestamp
          },
          stats: {
            monthlyReports: monthlyReports[0]?.count || 0,
            pendingTasks: pendingTasks[0]?.count || 0,
            totalDealers: totalDealers[0]?.count || 0,
            pendingLeaves: pendingLeaves[0]?.count || 0
          }
        }
      });
    } catch (error) {
      console.error('Dashboard stats error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch dashboard stats' });
    }
  });


}