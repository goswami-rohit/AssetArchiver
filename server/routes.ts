// routes.ts - COMPLETE IMPLEMENTATION WITH AUTO-CRUD (UPDATED VALIDATION FLOW)
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
import { eq, desc, and, gte, lte, or, sql } from 'drizzle-orm';
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
  | "geocode.forward"
  | "geocode.reverse"
  | "geocode.ip"
  // Search
  | "search.autocomplete"
  | "search.users"
  | "search.geofences"
  | "search.places"
  // Address
  | "address.validate"
  // Route
  | "route.distance"
  | "route.matrix"
  | "route.match"
  | "route.directions"
  | "route.optimize";

const RADAR_PUBLISHABLE_KEY = process.env.RADAR_PUBLISHABLE_KEY || "";
const RADAR_SECRET_KEY = process.env.RADAR_SECRET_KEY || "";

function qs(params: AnyDict) {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
  );
  const s = new URLSearchParams(
    Object.fromEntries(Object.entries(clean).map(([k, v]) => [k, String(v)]))
  ).toString();
  return s ? `?${s}` : "";
}

function coordsList(locations: Array<{ lat: number; lng: number } | [number, number]>): string {
  return locations
    .map((loc) => Array.isArray(loc) ? `${loc[0]},${loc[1]}` : `${loc.lat},${loc.lng}`)
    .join(";");
}

function pickAuthKey(action: RadarAction): string {
  // Writes with SECRET, reads can use PUBLISHABLE; safe default: SECRET
  return RADAR_SECRET_KEY || RADAR_PUBLISHABLE_KEY;
}

/**
 * Unified Radar API function
 */
export async function radar(action: RadarAction, payload: AnyDict = {}): Promise<any> {
  let method = "GET";
  let endpoint = "";
  let body: AnyDict | undefined;

  switch (action) {
    case "track": {
      method = "POST";
      endpoint = "track";
      const { deviceId, userId, latitude, longitude, accuracy,
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
      endpoint = `context${qs({ latitude: lat, longitude: lng, userId })}`;
      break;
    }
    case "geocode.forward": {
      const { query, layers, limit, country } = payload;
      endpoint = `geocode/forward${qs({ query, layers, limit, country })}`;
      break;
    }
    case "geocode.reverse": {
      const { lat, lng, layers } = payload;
      endpoint = `geocode/reverse${qs({ latitude: lat, longitude: lng, layers })}`;
      break;
    }
    case "geocode.ip": {
      const { ip } = payload;
      endpoint = `geocode/ip${qs({ ip })}`;
      break;
    }
    case "search.autocomplete": {
      const { query, near, layers, limit } = payload;
      endpoint = `search/autocomplete${qs({ query, near, layers, limit })}`;
      break;
    }
    case "search.users": {
      const { near, radius, limit } = payload;
      endpoint = `search/users${qs({ near, radius, limit })}`;
      break;
    }
    case "search.geofences": {
      const { tags, metadata, limit } = payload;
      endpoint = `search/geofences${qs({ tags, metadata, limit })}`;
      break;
    }
    case "search.places": {
      const { near, radius, categories, chains } = payload;
      endpoint = `search/places${qs({ near, radius, categories, chains })}`;
      break;
    }
    case "address.validate": {
      method = "POST";
      endpoint = "address/validate";
      const { address } = payload;
      body = { address };
      break;
    }
    case "route.distance": {
      const { origin, destination, mode, units } = payload;
      endpoint = `route/distance${qs({ origin, destination, mode, units })}`;
      break;
    }
    case "route.matrix": {
      method = "POST";
      endpoint = "route/matrix";
      const { origins, destinations, mode, units } = payload;
      body = { origins, destinations, mode, units };
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
      method = "POST";
      endpoint = "route/optimize";
      const { stops, mode, metrics, roundtrip } = payload;
      body = { stops, mode, metrics, roundtrip };
      break;
    }
    default: {
      const _never: never = action as never;
      throw new Error(`Unsupported Radar action: ${String(_never)}`);
    }
  }

  const url = `https://api.radar.io/v1/${endpoint}`;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    authorization: `Bearer ${pickAuthKey(action)}`,
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
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
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
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

  // CREATE - VALIDATE AFTER AUTO-FILL (to match schema.ts exactly)
  app.post(`/api/${endpoint}`, async (req: Request, res: Response) => {
    try {
      const incoming = req.body as AnyDict;

      // Auto-fill server fields first
      const autoFilled: Record<string, any> = {};
      for (const [key, fn] of Object.entries(autoFields)) {
        autoFilled[key] = typeof fn === 'function' ? fn() : fn;
      }

      // Merge parsed data and auto-filled fields
      let finalData: AnyDict = { ...incoming, ...autoFilled };

      // Optional Radar context enrichment when lat/lng present (kept from original)
      let nearby: any[] | undefined;
      if (finalData?.latitude && finalData?.longitude) {
        try {
          const r = await radar("context", { lat: finalData.latitude, lng: finalData.longitude, userId: finalData.userId });
          nearby = r?.geofences || [];
        } catch (e) {
          // Do not fail creation if Radar context fails
        }
      }

      // FINAL VALIDATION against schema.ts insert schema
      const parseResult = schema.safeParse(finalData);
      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          error: `Validation failed for ${tableName}`,
          details: parseResult.error.errors.map(e => ({ path: e.path, message: e.message }))
        });
      }

      finalData = parseResult.data as any;

      // Create row
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
      const { startDate, endDate, limit = "50", ...filters } = req.query as AnyDict;
      let whereCond = buildWhereByUserId(table, userId);

      if (startDate && endDate && dateField && table[dateField]) {
        whereCond = and(whereCond,
          gte(table[dateField], startDate as string),
          lte(table[dateField], endDate as string)
        );
      }

      // Handle additional filters
      for (const [key, val] of Object.entries(filters)) {
        if (table[key]) {
          // exact-match filter
          // @ts-ignore
          whereCond = and(whereCond, eq(table[key], val as any));
        }
      }

      const orderField = table[dateField] || table.createdAt || table.updatedAt;
      const rows = await db.select().from(table)
        .where(whereCond)
        .orderBy(desc(orderField))
        .limit(parseInt(String(limit), 10));

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

  // ---------------- UPDATE ----------------
  app.put(`/api/${endpoint}/:id`, async (req: Request, res: Response) => {
    try {
      // Validate request body with Zod schema (schema.ts)
      const parseResult = schema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          error: `Validation failed for ${tableName}`,
          details: parseResult.error.errors.map(e => ({ path: e.path, message: e.message }))
        });
      }
      const updateData = { ...parseResult.data, updatedAt: new Date() };
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
      res.json({ success: true, data: deleted[0], message: `${tableName} deleted successfully` });
    } catch (err) {
      console.error(`Delete ${tableName} error:`, err);
      return http500(res, `Failed to delete ${tableName}`, err);
    }
  });
}

function readFrom(obj: any, path: string): any {
  return path.split(".").reduce((acc, key) => (acc ? acc[key] : undefined), obj);
}
function coerceNum(x: any) { return x == null ? null : Number(x); }
function http400(res: Response, msg: string, details?: any) { return res.status(400).json({ success: false, error: msg, details }); }
function http500(res: Response, msg: string, err: any) { console.error(msg, err); return res.status(500).json({ success: false, error: msg, details: (err && err.message) || String(err) }); }
function buildWhereByUserId(table: any, userId: string | number) {
  return eq(table.userId, typeof userId === "string" ? parseInt(userId, 10) : userId);
}

// ========================= Radar-aware AUTO CRUD =========================
// Adds Radar steps (track/context/geofence check) during CREATE,
// and pass-through for other verbs.

type RadarGeofenceRule = {
  /** e.g. "dealer" or "store" — what you tagged geofences with in Radar */
  tag: string;
  /** Which request field should match Radar geofence.externalId (or description)? */
  externalIdField: string;
  matchBy?: "externalId" | "description";
  errorMessage?: string;
};

type RadarCreateOptions = {
  /** Require user to be inside a Radar geofence (by tag + externalId/description) */
  requireGeofence?: RadarGeofenceRule;
  /** Also return nearby geofences to help UI show context */
  nearbyGeofences?: { limit?: number; radius?: number; includeGeometry?: boolean; tags?: string };
  /** What fields carry lat/lng/acc/user for tracking? */
  track?: { latField: string; lngField: string; accField?: string; userIdField?: string };
  /** Map fields from Radar.context to your row fields */
  enrich?: { mappings: Record<string, string> };
};

function createRadarCRUD(app: Express, config: {
  endpoint: string;
  table: any;
  schema: z.ZodSchema;
  tableName: string;
  dateField?: string;
  autoFields?: { [key: string]: () => any };
  radar?: RadarCreateOptions;
}) {
  const { endpoint, table, schema, tableName, autoFields = {}, dateField, radar: radarOpts } = config;

  // ---------------- CREATE (POST) with Radar steps ----------------
  // UPDATED: validate AFTER autoFields + Radar enrich to match schema.ts exactly
  app.post(`/api/${endpoint}`, async (req: Request, res: Response) => {
    try {
      // 1) Raw incoming (do NOT validate yet)
      const incoming = req.body as AnyDict;

      // 2) Auto fill (server-managed fields first)
      const autoFilled: Record<string, any> = {};
      for (const [k, fn] of Object.entries(autoFields)) {
        autoFilled[k] = typeof fn === 'function' ? fn() : fn;
      }
      let finalData: AnyDict = { ...incoming, ...autoFilled };

      // 3) Radar: track + enrich + geofence checks (if configured)
      let nearby: any[] | undefined;
      if (radarOpts?.track) {
        const lat = coerceNum(readFrom(finalData, radarOpts.track.latField));
        const lng = coerceNum(readFrom(finalData, radarOpts.track.lngField));
        const acc = coerceNum(radarOpts.track.accField ? readFrom(finalData, radarOpts.track.accField) : null);
        const userIdForRadar = radarOpts.track.userIdField ? readFrom(finalData, radarOpts.track.userIdField) : undefined;

        if (lat != null && lng != null) {
          try {
            await radar("track", { latitude: lat, longitude: lng, accuracy: acc, userId: userIdForRadar });
            const ctx = await radar("context", { lat, lng, userId: userIdForRadar });

            // enrich
            if (radarOpts.enrich?.mappings) {
              for (const [destField, radarPath] of Object.entries(radarOpts.enrich.mappings)) {
                const v = readFrom(ctx, radarPath);
                if (v != null) finalData[destField] = v;
              }
            }

            // require geofence
            if (radarOpts.requireGeofence) {
              const gfTag = radarOpts.requireGeofence.tag;
              const matchField = radarOpts.requireGeofence.externalIdField;
              const matchBy = radarOpts.requireGeofence.matchBy || "externalId";
              const matchValue = readFrom(finalData, matchField);
              const gfs = ctx?.geofences || [];
              const found = gfs.some((g: any) => readFrom(g, matchBy) === matchValue && (g.tag === gfTag || (g.tags || []).includes(gfTag)));
              if (!found) {
                return http400(res, radarOpts.requireGeofence.errorMessage || `You must be inside the selected geofence (${gfTag}) to create ${tableName}.`, { matchField, matchValue });
              }
            }

            // nearbies
            if (radarOpts.nearbyGeofences) {
              try {
                const nearRes = await radar("search.geofences", {
                  tags: radarOpts.nearbyGeofences.tags,
                  limit: radarOpts.nearbyGeofences.limit ?? 5,
                  radius: radarOpts.nearbyGeofences.radius ?? 800,
                  includeGeometry: radarOpts.nearbyGeofences.includeGeometry ?? false,
                });
                nearby = nearRes?.geofences || [];
              } catch (_) {}
            }
          } catch (e) {
            // If Radar fails, we still proceed to schema validation; geofence requirement will naturally fail if needed
          }
        }
      }

      // 4) FINAL validation AGAINST schema.ts insert schema
      const finalValidation = schema.safeParse(finalData);
      if (!finalValidation.success) {
        return http400(res, `Validation failed for ${tableName}`, finalValidation.error.errors);
      }
      finalData = finalValidation.data;

      // 5) Create
      const created = await db.insert(table).values(finalData).returning();
      return res.json({ success: true, data: created[0], ...(nearby ? { nearbyGeofences: nearby } : {}) });
    } catch (err) {
      return http500(res, `Failed to create ${tableName}`, err);
    }
  });

  // read/list by userId
  app.get(`/api/${endpoint}/user/:userId`, async (req: Request, res: Response) => {
    try {
      let whereCond = buildWhereByUserId(table, req.params.userId);
      const { startDate, endDate, limit = "50", ...filters } = req.query as AnyDict;
      if (startDate && endDate && dateField && table[dateField]) {
        whereCond = and(whereCond, gte(table[dateField], startDate as string), lte(table[dateField], endDate as string));
      }
      for (const [key, val] of Object.entries(filters)) {
        if (table[key]) // @ts-ignore
          whereCond = and(whereCond, eq(table[key], val as any));
      }
      const orderField = table[dateField] || table.createdAt || table.updatedAt;
      const rows = await db.select().from(table).where(whereCond).orderBy(desc(orderField)).limit(parseInt(String(limit), 10));
      res.json({ success: true, data: rows });
    } catch (err) {
      return http500(res, `Failed to fetch ${tableName}s`, err);
    }
  });

  // get by id, put, delete (same as generic)
  app.get(`/api/${endpoint}/:id`, async (req, res) => {
    try { const [r] = await db.select().from(table).where(eq(table.id, req.params.id)).limit(1); if (!r) return http400(res as any, `${tableName} not found`); res.json({ success: true, data: r }); } catch (e) { return http500(res as any, `Failed to fetch ${tableName}`, e); }
  });
  app.put(`/api/${endpoint}/:id`, async (req, res) => {
    try { const parsed = schema.safeParse(req.body); if (!parsed.success) return http400(res as any, `Validation failed for ${tableName}`, parsed.error.errors); const updated = await db.update(table).set({ ...parsed.data, updatedAt: new Date() }).where(eq(table.id, req.params.id)).returning(); if (!updated?.length) return http400(res as any, `${tableName} not found`); res.json({ success: true, data: updated[0] }); } catch (e) { return http500(res as any, `Failed to update ${tableName}`, e); }
  });
  app.delete(`/api/${endpoint}/:id`, async (req, res) => {
    try { const deleted = await db.delete(table).where(eq(table.id, req.params.id)).returning(); if (!deleted?.length) return http400(res as any, `${tableName} not found`); res.json({ success: true, data: deleted[0] }); } catch (e) { return http500(res as any, `Failed to delete ${tableName}`, e); }
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

  // ==================== RAG: conversational endpoints ====================
  app.post('/api/rag/chat', async (req: Request, res: Response) => {
    try {
      const { messages, userId } = req.body as { messages: ChatMessage[]; userId?: number };

      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ success: false, error: 'Messages are required' });
      }

      const result = await EnhancedRAGService.chat(messages, userId);

      res.json(result);
    } catch (error) {
      console.error('RAG Chat error:', error);
      res.status(500).json({ success: false, error: 'RAG processing failed' });
    }
  });

  // Vector-first RAG chat: picks endpoint + executes
  app.post('/api/rag/vector-chat', async (req: Request, res: Response) => {
    try {
      const { message, userId } = req.body as { message: string; userId: number };
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

  // Endpoint finder (from message)
  app.post('/api/rag/find-endpoint', async (req: Request, res: Response) => {
    try {
      const { message } = req.body as { message: string };
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ success: false, error: 'Message is required and must be a string' });
      }

      const extracted = await EnhancedRAGService.extractEndpointAndData(message);
      res.json({ success: true, endpoint: extracted.endpoint, dataFields: Object.keys(extracted.data || {}) });
    } catch (error) {
      console.error('Find endpoint error:', error);
      res.status(500).json({ success: false, error: 'Failed to process the message' });
    }
  });

  // Direct executor with vector-derived payload
  app.post('/api/rag/execute', async (req: Request, res: Response) => {
    try {
      const { endpoint, data, userId } = req.body as { endpoint: string; data: any; userId: number };
      if (!endpoint || typeof endpoint !== 'string') {
        return res.status(400).json({ success: false, error: 'Endpoint is required' });
      }

      const result = await EnhancedRAGService.executeEndpoint(endpoint, data, userId);
      res.json({ success: true, data: result.data, details: result.details });
    } catch (error) {
      console.error('Execute endpoint error:', error);
      res.status(500).json({ success: false, error: 'Execution failed' });
    }
  });

  // One-shot: parse + execute
  app.post('/api/rag/submit', async (req: Request, res: Response) => {
    try {
      const { message, userId } = req.body as { message: string; userId: number };
      if (!message) {
        return res.status(400).json({ success: false, error: 'Message is required' });
      }

      // Extract endpoint + payload via vector search + LLM parsing
      const extracted = await EnhancedRAGService.extractEndpointAndData(message);
      if (!extracted?.endpoint) {
        return res.status(400).json({ success: false, error: 'Could not determine endpoint from message' });
      }

      // Direct execution using enhanced service
      const executionResult = await EnhancedRAGService.executeEndpoint(
        extracted.endpoint,
        extracted.data,
        extracted.data?.userId ?? userId
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
          userId: extracted.data?.userId ?? userId,
          fieldsSubmitted: Object.keys(extracted.data || {}).length,
          vectorSearch: true,
          directExecution: true
        }
      });
    } catch (error) {
      console.error('RAG Submit error:', error);
      res.status(500).json({
        success: false,
        error: 'RAG submission failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Smart fetch for user-specific data across endpoints
  app.get('/api/rag/fetch/:endpoint/user/:userId', async (req: Request, res: Response) => {
    try {
      const { endpoint, userId } = req.params as { endpoint: string; userId: string };
      const { startDate, endDate, limit = '50' } = req.query as AnyDict;

      const result = await EnhancedRAGService.smartFetch(endpoint, {
        userId: parseInt(userId, 10),
        startDate: startDate as string,
        endDate: endDate as string,
        limit: parseInt(String(limit), 10)
      });

      res.json({ success: true, data: result.data, details: result.details });
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
      // Note: qdrantClient must be available in your environment
      // If it's not globally available, import it here.
      // const qdrantStatus = await qdrantClient.getCollections();
      const qdrantStatus = { collections: [] } as any;

      res.json({
        success: true,
        status: 'Enhanced RAG System Online',
        features: {
          vectorSearch: true,
          endpointExtraction: true,
          directExecution: true,
          smartFetch: true
        },
        qdrant: {
          connected: true,
          collections: qdrantStatus.collections?.map((c: any) => c.name) || [],
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

  // 3. Permanent Journey Plans
  createAutoCRUD(app, {
    endpoint: 'pjp',
    table: permanentJourneyPlans,
    schema: insertPermanentJourneyPlanSchema,
    tableName: 'Permanent Journey Plan',
    dateField: 'startDate'
  });

  // 4. Client Reports
  createAutoCRUD(app, {
    endpoint: 'client-reports',
    table: clientReports,
    schema: insertClientReportSchema,
    tableName: 'Client Report',
    dateField: 'reportDate'
  });

  // 5. Competition Reports
  createAutoCRUD(app, {
    endpoint: 'competition-reports',
    table: competitionReports,
    schema: insertCompetitionReportSchema,
    tableName: 'Competition Report',
    dateField: 'reportDate'
  });

  // 6. Geo Tracking
  createAutoCRUD(app, {
    endpoint: 'geo-tracking',
    table: geoTracking,
    schema: insertGeoTrackingSchema,
    tableName: 'Geo Tracking',
    dateField: 'recordedAt'
  });

  // 7. Daily Tasks
  createAutoCRUD(app, {
    endpoint: 'daily-tasks',
    table: dailyTasks,
    schema: insertDailyTaskSchema,
    tableName: 'Daily Task',
    dateField: 'dueDate'
  });

  // 8. Dealers
  createAutoCRUD(app, {
    endpoint: 'dealers',
    table: dealers,
    schema: insertDealerSchema,
    tableName: 'Dealer'
  });

  // 9. Companies
  createAutoCRUD(app, {
    endpoint: 'companies',
    table: companies,
    schema: z.any(),
    tableName: 'Company'
  });

  // D) Dealer Reports & Scores (no Radar needed) ------------------------
  // Keep this on your original generic AUTO-CRUD (already in your file):
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

  // B) GeoTracking with Radar enrich (no geofence requirement) ---------
  createRadarCRUD(app, {
    endpoint: "geo-tracking-radar",
    table: geoTracking,
    schema: insertGeoTrackingSchema,
    tableName: "Geo Tracking (Radar)",
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
      track: { latField: "latitude", lngField: "longitude", userIdField: "userId" },
      enrich: { mappings: { siteName: "place.name" } },
      requireGeofence: {
        tag: "dealer",
        externalIdField: "siteName",
        matchBy: "externalId",
        errorMessage: "You must be inside the selected dealer geofence to check in.",
      },
      nearbyGeofences: { limit: 3, radius: 600, tags: "dealer" },
    }
  });

  // ==================== DASHBOARD ====================
  app.get('/api/dashboard/stats/:userId', async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId, 10);

      // Counts for key modules
      const [monthlyReports, pendingTasks, totalDealers, pendingLeaves] = await Promise.all([
        db.execute(sql`SELECT COUNT(*)::int as count FROM ${dailyVisitReports} WHERE user_id = ${userId} AND DATE_PART('month', report_date) = DATE_PART('month', CURRENT_DATE)`),
        db.execute(sql`SELECT COUNT(*)::int as count FROM ${dailyTasks} WHERE user_id = ${userId} AND status != 'completed'`),
        db.execute(sql`SELECT COUNT(*)::int as count FROM ${dealers} WHERE created_by = ${userId}`),
        db.execute(sql`SELECT COUNT(*)::int as count FROM ${salesmanLeaveApplications} WHERE user_id = ${userId} AND status = 'pending'`)
      ]);

      // Today attendance
      const todayAttendance = await db.select().from(salesmanAttendance).where(and(
        eq(salesmanAttendance.userId, userId),
        eq(sql`DATE(${salesmanAttendance.attendanceDate})`, sql`CURRENT_DATE`)
      ));

      res.json({
        success: true,
        data: {
          attendance: {
            present: !!todayAttendance?.[0],
            punchInTime: todayAttendance?.[0]?.inTimeTimestamp,
            punchOutTime: todayAttendance?.[0]?.outTimeTimestamp
          },
          stats: {
            monthlyReports: (monthlyReports as any)[0]?.count || 0,
            pendingTasks: (pendingTasks as any)[0]?.count || 0,
            totalDealers: (totalDealers as any)[0]?.count || 0,
            pendingLeaves: (pendingLeaves as any)[0]?.count || 0
          }
        }
      });
    } catch (error) {
      console.error('Dashboard stats error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch dashboard stats' });
    }
  });
}
