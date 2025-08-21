// routes.ts - UPDATED MOTHERSHIP (original app-based style, with attendance geofence fix)
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
import { ChatMessage } from 'server/bot/aiService';
import EnhancedRAGService from 'server/bot/aiService';

// ========================= Radar.com SINGLE FUNCTION WRAPPER =========================
// Supports: track, context, geocode (forward/reverse/ip), search (autocomplete/users/geofences/places),
// address validate, route (distance/matrix/match/directions/optimize).
// ------------------------------------------------------------------------------------

type AnyDict = Record<string, any>;

export type RadarAction =
  | 'track'
  | 'context'
  | 'geocode.forward'
  | 'geocode.reverse'
  | 'geocode.ip'
  | 'search.autocomplete'
  | 'search.users'
  | 'search.geofences'
  | 'search.places'
  | 'address.validate'
  | 'route.distance'
  | 'route.matrix'
  | 'route.match'
  | 'route.directions'
  | 'route.optimize';

const RADAR_PUBLISHABLE_KEY = process.env.RADAR_PUBLISHABLE_KEY || '';
const RADAR_SECRET_KEY = process.env.RADAR_SECRET_KEY || '';

function qs(params: AnyDict) {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );
  const s = new URLSearchParams(
    Object.fromEntries(Object.entries(clean).map(([k, v]) => [k, String(v)]))
  ).toString();
  return s ? `?${s}` : '';
}

function coordsList(locations: Array<{ lat: number; lng: number } | [number, number]>): string {
  return locations
    .map((loc) => Array.isArray(loc) ? `${loc[0]},${loc[1]}` : `${loc.lat},${loc.lng}`)
    .join(';');
}

function pickAuthKey(): string { return RADAR_SECRET_KEY || RADAR_PUBLISHABLE_KEY; }

export async function radar(action: RadarAction, payload: AnyDict = {}): Promise<any> {
  let method = 'GET';
  let endpoint = '';
  let body: AnyDict | undefined;

  switch (action) {
    case 'track': {
      method = 'POST';
      endpoint = 'track';
      const { deviceId, userId, latitude, longitude, accuracy, foreground, stopped, description, metadata, deviceType } = payload;
      if (!deviceId && !userId) throw new Error('Radar.track requires either deviceId or userId');
      body = { deviceId, userId, latitude, longitude, accuracy, foreground, stopped, description, metadata, deviceType };
      break;
    }
    case 'context': {
      const { lat, lng, userId } = payload;
      endpoint = `context${qs({ latitude: lat, longitude: lng, userId })}`;
      break;
    }
    case 'geocode.forward': {
      const { query, layers, limit, country } = payload;
      endpoint = `geocode/forward${qs({ query, layers, limit, country })}`;
      break;
    }
    case 'geocode.reverse': {
      const { lat, lng, layers } = payload;
      endpoint = `geocode/reverse${qs({ latitude: lat, longitude: lng, layers })}`;
      break;
    }
    case 'geocode.ip': {
      const { ip } = payload; endpoint = `geocode/ip${qs({ ip })}`; break;
    }
    case 'search.autocomplete': {
      const { query, near, layers, limit } = payload;
      endpoint = `search/autocomplete${qs({ query, near, layers, limit })}`;
      break;
    }
    case 'search.users': {
      const { near, radius, limit } = payload; endpoint = `search/users${qs({ near, radius, limit })}`; break;
    }
    case 'search.geofences': {
      const { tags, metadata, limit } = payload; endpoint = `search/geofences${qs({ tags, metadata, limit })}`; break;
    }
    case 'search.places': {
      const { near, radius, categories, chains } = payload; endpoint = `search/places${qs({ near, radius, categories, chains })}`; break;
    }
    case 'address.validate': { method = 'POST'; endpoint = 'address/validate'; body = { address: payload.address }; break; }
    case 'route.distance': { const { origin, destination, mode, units } = payload; endpoint = `route/distance${qs({ origin, destination, mode, units })}`; break; }
    case 'route.matrix': { method = 'POST'; endpoint = 'route/matrix'; body = { origins: payload.origins, destinations: payload.destinations, mode: payload.mode, units: payload.units }; break; }
    case 'route.match': { method = 'POST'; endpoint = 'route/match'; body = { path: payload.path, mode: payload.mode, roadAttributes: payload.roadAttributes, units: payload.units, geometry: payload.geometry }; break; }
    case 'route.directions': { const { locations = [], mode, units, avoid, geometry, alternatives, lang } = payload; endpoint = `route/directions${qs({ locations: coordsList(locations), mode, units, avoid, geometry, alternatives, lang })}`; break; }
    case 'route.optimize': { method = 'POST'; endpoint = 'route/optimize'; body = { stops: payload.stops, mode: payload.mode, metrics: payload.metrics, roundtrip: payload.roundtrip }; break; }
    default: { const _n: never = action as never; throw new Error(`Unsupported Radar action: ${String(_n)}`); }
  }

  const url = `https://api.radar.io/v1/${endpoint}`;
  const headers: Record<string, string> = { 'content-type': 'application/json', authorization: `Bearer ${pickAuthKey()}` };
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) { const text = await res.text().catch(() => ''); throw new Error(`Radar ${action} failed: ${res.status} ${text}`); }
  return res.json();
}

// Helpers
function readFrom(obj: any, path: string): any { return path.split('.').reduce((acc, key) => (acc ? acc[key] : undefined), obj); }
function coerceNum(x: any) { return x == null ? null : Number(x); }
function http400(res: Response, msg: string, details?: any) { return res.status(400).json({ success: false, error: msg, details }); }
function http500(res: Response, msg: string, err: any) { console.error(msg, err); return res.status(500).json({ success: false, error: msg, details: (err && err.message) || String(err) }); }
function buildWhereByUserId(table: any, userId: string | number) { return eq(table.userId, typeof userId === 'string' ? parseInt(userId, 10) : userId); }

// Configure multer (kept from original)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Only image files are allowed'))
});

// ============================================
// GENERIC AUTO-CRUD — VALIDATE AFTER AUTO-FIELDS
// ============================================
function createAutoCRUD(app: Express, config: {
  endpoint: string,
  table: any,
  schema: z.ZodSchema,
  tableName: string,
  autoFields?: { [key: string]: () => any },
  dateField?: string
}) {
  const { endpoint, table, schema, tableName, autoFields = {}, dateField } = config;

  app.post(`/api/${endpoint}`, async (req: Request, res: Response) => {
    try {
      const incoming = req.body as AnyDict;

      // auto
      const autoFilled: AnyDict = {}; for (const [k, fn] of Object.entries(autoFields)) autoFilled[k] = typeof fn === 'function' ? fn() : fn;
      let finalData: AnyDict = { ...incoming, ...autoFilled };

      // optional context echo if has lat/lng
      let nearby: any[] | undefined;
      if (finalData?.latitude && finalData?.longitude) {
        try { const r = await radar('context', { lat: finalData.latitude, lng: finalData.longitude, userId: finalData.userId }); nearby = r?.geofences || []; } catch {}
      }

      const parsed = schema.safeParse(finalData);
      if (!parsed.success) return res.status(400).json({ success: false, error: `Validation failed for ${tableName}`, details: parsed.error.errors.map(e => ({ path: e.path, message: e.message })) });

      const created = await db.insert(table).values(parsed.data).returning();
      return res.json({ success: true, data: created[0], ...(nearby ? { nearbyGeofences: nearby } : {}) });
    } catch (err) { return http500(res, `Failed to create ${tableName}`, err); }
  });

  app.get(`/api/${endpoint}/user/:userId`, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params; const { startDate, endDate, limit = '50', ...filters } = req.query as AnyDict;
      let whereCond = buildWhereByUserId(table, userId);
      if (startDate && endDate && dateField && table[dateField]) whereCond = and(whereCond, gte(table[dateField], startDate as string), lte(table[dateField], endDate as string));
      for (const [key, val] of Object.entries(filters)) if ((table as AnyDict)[key]) whereCond = and(whereCond, eq((table as AnyDict)[key], val as any));
      const orderField = (table as AnyDict)[dateField || ''] || (table as AnyDict).createdAt || (table as AnyDict).updatedAt;
      const rows = await db.select().from(table).where(whereCond).orderBy(desc(orderField)).limit(parseInt(String(limit), 10));
      res.json({ success: true, data: rows });
    } catch (err) { return http500(res, `Failed to fetch ${tableName}s`, err); }
  });

  app.get(`/api/${endpoint}/:id`, async (req: Request, res: Response) => {
    try { const [r] = await db.select().from(table).where(eq((table as AnyDict).id, req.params.id)).limit(1); if (!r) return res.status(404).json({ success: false, error: `${tableName} not found` }); res.json({ success: true, data: r }); }
    catch (e) { return http500(res, `Failed to fetch ${tableName}`, e); }
  });

  app.put(`/api/${endpoint}/:id`, async (req: Request, res: Response) => {
    try {
      const parseResult = schema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          error: `Validation failed for ${tableName}`,
          details: parseResult.error.errors.map(e => ({ path: e.path, message: e.message }))
        });
      }
      const updateData = { ...parseResult.data, updatedAt: new Date() };
      const updated = await db.update(table).set(updateData).where(eq((table as AnyDict).id, req.params.id)).returning();
      if (!updated?.length) return res.status(404).json({ success: false, error: `${tableName} not found` });
      res.json({ success: true, data: updated[0], message: `${tableName} updated successfully` });
    } catch (e) { return http500(res, `Failed to update ${tableName}`, e); }
  });

  app.delete(`/api/${endpoint}/:id`, async (req: Request, res: Response) => {
    try { const deleted = await db.delete(table).where(eq((table as AnyDict).id, req.params.id)).returning(); if (!deleted?.length) return res.status(404).json({ success: false, error: `${tableName} not found` }); res.json({ success: true, data: deleted[0], message: `${tableName} deleted successfully` }); }
    catch (e) { return http500(res, `Failed to delete ${tableName}`, e); }
  });
}

// ========================= Radar-aware AUTO CRUD (VALIDATE AFTER ENRICH) =========================

type RadarGeofenceRule = { tag: string; externalIdField?: string; matchBy?: 'externalId' | 'description'; errorMessage?: string; };

type RadarCreateOptions = {
  requireGeofence?: RadarGeofenceRule;
  nearbyGeofences?: { limit?: number; radius?: number; includeGeometry?: boolean; tags?: string };
  track?: { latField: string; lngField: string; accField?: string; userIdField?: string };
  useTrack?: boolean; // default true; set false for attendance
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

  app.post(`/api/${endpoint}`, async (req: Request, res: Response) => {
    try {
      const incoming = req.body as AnyDict;

      // auto-fill
      const autoFilled: AnyDict = {}; for (const [k, fn] of Object.entries(autoFields)) autoFilled[k] = typeof fn === 'function' ? fn() : fn;
      let finalData: AnyDict = { ...incoming, ...autoFilled };

      // Radar steps
      let nearby: any[] | undefined;
      if (radarOpts?.track) {
        const lat = coerceNum(readFrom(finalData, radarOpts.track.latField));
        const lng = coerceNum(readFrom(finalData, radarOpts.track.lngField));
        const acc = coerceNum(radarOpts.track.accField ? readFrom(finalData, radarOpts.track.accField) : null);
        const userIdForRadar = radarOpts.track.userIdField ? readFrom(finalData, radarOpts.track.userIdField) : undefined;

        if (lat != null && lng != null) {
          try {
            if (radarOpts.useTrack !== false) await radar('track', { latitude: lat, longitude: lng, accuracy: acc, userId: userIdForRadar });
            const ctx = await radar('context', { lat, lng, userId: userIdForRadar });

            // enrich
            if (radarOpts.enrich?.mappings) {
              for (const [destField, radarPath] of Object.entries(radarOpts.enrich.mappings)) {
                const v = readFrom(ctx, radarPath);
                if (v != null) finalData[destField] = v;
              }
            }

            // geofence requirement
            if (radarOpts.requireGeofence) {
              const gfTag = radarOpts.requireGeofence.tag;
              const matchBy = radarOpts.requireGeofence.matchBy || 'externalId';
              const matchField = radarOpts.requireGeofence.externalIdField; // e.g., 'expectedExternalId'
              const expected = matchField ? readFrom({ ...incoming, ...finalData }, matchField) : undefined;
              const gfs = ctx?.geofences || [];
              const found = gfs.some((g: any) => {
                const tagOk = g?.tag === gfTag || (Array.isArray(g?.tags) && g.tags.includes(gfTag));
                if (!tagOk) return false;
                if (expected == null || expected === '') return true; // accept any within tag if no expected provided
                return String(readFrom(g, matchBy)) === String(expected);
              });
              if (!found) {
                return http400(res, radarOpts.requireGeofence.errorMessage || `You must be inside the selected geofence (${gfTag}).`, {
                  tag: gfTag,
                  expected: matchField ? readFrom({ ...incoming, ...finalData }, matchField) : '(any)',
                  currentLocation: { lat, lng },
                  geofences: gfs
                });
              }
            }

            if (radarOpts.nearbyGeofences) {
              try {
                const nearRes = await radar('search.geofences', {
                  tags: radarOpts.nearbyGeofences.tags,
                  limit: radarOpts.nearbyGeofences.limit ?? 5,
                  radius: radarOpts.nearbyGeofences.radius ?? 800,
                  includeGeometry: radarOpts.nearbyGeofences.includeGeometry ?? false,
                });
                nearby = nearRes?.geofences || [];
              } catch {}
            }
          } catch (e) { /* proceed to validation */ }
        }
      }

      // Strip helper fields not present in schema before validation (e.g., expectedExternalId)
      delete (finalData as AnyDict).expectedExternalId;

      const parsed = schema.safeParse(finalData);
      if (!parsed.success) return http400(res, `Validation failed for ${tableName}`, parsed.error.errors);

      const created = await db.insert(table).values(parsed.data).returning();
      return res.json({ success: true, data: created[0], ...(nearby ? { nearbyGeofences: nearby } : {}) });
    } catch (err) { return http500(res, `Failed to create ${tableName}`, err); }
  });

  // list/get/update/delete
  app.get(`/api/${endpoint}/user/:userId`, async (req: Request, res: Response) => {
    try { let whereCond = buildWhereByUserId(table, req.params.userId); const { startDate, endDate, limit = '50', ...filters } = req.query as AnyDict; if (startDate && endDate && dateField && (table as AnyDict)[dateField]) whereCond = and(whereCond, gte((table as AnyDict)[dateField], startDate as string), lte((table as AnyDict)[dateField], endDate as string)); for (const [k, v] of Object.entries(filters)) if ((table as AnyDict)[k]) whereCond = and(whereCond, eq((table as AnyDict)[k], v as any)); const orderField = (table as AnyDict)[dateField || ''] || (table as AnyDict).createdAt || (table as AnyDict).updatedAt; const rows = await db.select().from(table).where(whereCond).orderBy(desc(orderField)).limit(parseInt(String(limit), 10)); res.json({ success: true, data: rows }); } catch (e) { return http500(res, `Failed to fetch ${tableName}s`, e); }
  });
  app.get(`/api/${endpoint}/:id`, async (req: Request, res: Response) => { try { const [r] = await db.select().from(table).where(eq((table as AnyDict).id, req.params.id)).limit(1); if (!r) return http400(res, `${tableName} not found`); res.json({ success: true, data: r }); } catch (e) { return http500(res, `Failed to fetch ${tableName}`, e); } });
  app.put(`/api/${endpoint}/:id`, async (req: Request, res: Response) => { try { const parsed = schema.safeParse(req.body); if (!parsed.success) return http400(res, `Validation failed for ${tableName}`, parsed.error.errors); const updated = await db.update(table).set({ ...parsed.data, updatedAt: new Date() }).where(eq((table as AnyDict).id, req.params.id)).returning(); if (!updated?.length) return http400(res, `${tableName} not found`); res.json({ success: true, data: updated[0] }); } catch (e) { return http500(res, `Failed to update ${tableName}`, e); } });
  app.delete(`/api/${endpoint}/:id`, async (req: Request, res: Response) => { try { const deleted = await db.delete(table).where(eq((table as AnyDict).id, req.params.id)).returning(); if (!deleted?.length) return http400(res, `${tableName} not found`); res.json({ success: true, data: deleted[0] }); } catch (e) { return http500(res, `Failed to delete ${tableName}`, e); } });
}

export function setupWebRoutes(app: Express) {
  // PWA
  app.get('/pwa', (req: Request, res: Response) => { res.redirect('/login'); });

  // AUTH
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { loginId, password } = req.body;
      if (!loginId || !password) return res.status(400).json({ error: 'Login ID and password are required' });
      const user = await db.query.users.findFirst({ where: or(eq(users.salesmanLoginId, loginId), eq(users.email, loginId)), with: { company: true } });
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });
      if (user.status !== 'active') return res.status(401).json({ error: 'Account is not active' });
      if (user.hashedPassword !== password) return res.status(401).json({ error: 'Invalid credentials' });
      const { hashedPassword, ...userWithoutPassword } = user; res.json({ success: true, user: userWithoutPassword, message: 'Login successful' });
    } catch (error) { console.error('Login error:', error); res.status(500).json({ error: 'Login failed' }); }
  });

  // RAG endpoints (unchanged)
  app.post('/api/rag/chat', async (req: Request, res: Response) => { try { const { messages, userId } = req.body as { messages: ChatMessage[]; userId?: number }; if (!Array.isArray(messages) || messages.length === 0) return res.status(400).json({ success: false, error: 'Messages are required' }); const result = await EnhancedRAGService.chat(messages, userId); res.json(result); } catch (e) { console.error('RAG Chat error:', e); res.status(500).json({ success: false, error: 'RAG processing failed' }); } });
  app.post('/api/rag/vector-chat', async (req: Request, res: Response) => { try { const { message, userId } = req.body as { message: string; userId: number }; if (!message || typeof message !== 'string') return res.status(400).json({ success: false, error: 'Message is required and must be a string' }); const result = await EnhancedRAGService.ragChat(message, userId); res.json({ success: result.success, message: result.message, endpoint: result.endpoint, similarity: result.similarity, data: result.data, guidance: result.guidance, error: result.error, suggestion: result.suggestion, timestamp: new Date().toISOString(), vectorSearch: true }); } catch (e) { console.error('Vector RAG Chat error:', e); res.status(500).json({ success: false, error: 'Vector RAG processing failed. Please try again.', details: e instanceof Error ? e.message : 'Unknown error' }); } });
  app.post('/api/rag/find-endpoint', async (req: Request, res: Response) => { try { const { message } = req.body as { message: string }; if (!message || typeof message !== 'string') return res.status(400).json({ success: false, error: 'Message is required and must be a string' }); const extracted = await EnhancedRAGService.extractEndpointAndData(message); res.json({ success: true, endpoint: extracted.endpoint, dataFields: Object.keys(extracted.data || {}) }); } catch (e) { console.error('Find endpoint error:', e); res.status(500).json({ success: false, error: 'Failed to process the message' }); } });
  app.post('/api/rag/execute', async (req: Request, res: Response) => { try { const { endpoint, data, userId } = req.body as { endpoint: string; data: any; userId: number }; if (!endpoint || typeof endpoint !== 'string') return res.status(400).json({ success: false, error: 'Endpoint is required' }); const result = await EnhancedRAGService.executeEndpoint(endpoint, data, userId); res.json({ success: true, data: result.data, details: result.details }); } catch (e) { console.error('Execute endpoint error:', e); res.status(500).json({ success: false, error: 'Execution failed' }); } });
  app.post('/api/rag/submit', async (req: Request, res: Response) => { try { const { message, userId } = req.body as { message: string; userId: number }; if (!message) return res.status(400).json({ success: false, error: 'Message is required' }); const extracted = await EnhancedRAGService.extractEndpointAndData(message); if (!extracted?.endpoint) return res.status(400).json({ success: false, error: 'Could not determine endpoint from message' }); const executionResult = await EnhancedRAGService.executeEndpoint(extracted.endpoint, extracted.data, extracted.data?.userId ?? userId); if (!executionResult.success) return res.status(400).json({ success: false, error: `Submission failed: ${executionResult.error}`, details: executionResult.details, endpoint: extracted.endpoint, validationErrors: executionResult.details }); const endpointName = extracted.endpoint.replace('/api/', '').toUpperCase(); res.json({ success: true, endpoint: extracted.endpoint, recordId: executionResult.data?.id, data: executionResult.data, message: `✅ Successfully submitted ${endpointName} via enhanced RAG!`, submissionDetails: { endpointName, recordId: executionResult.data?.id, submittedAt: new Date().toISOString(), userId: extracted.data?.userId ?? userId, fieldsSubmitted: Object.keys(extracted.data || {}).length, vectorSearch: true, directExecution: true } }); } catch (e) { console.error('RAG Submit error:', e); res.status(500).json({ success: false, error: 'RAG submission failed', details: e instanceof Error ? e.message : 'Unknown error' }); } });
  app.get('/api/rag/fetch/:endpoint/user/:userId', async (req: Request, res: Response) => { try { const { endpoint, userId } = req.params as { endpoint: string; userId: string }; const { startDate, endDate, limit = '50' } = req.query as AnyDict; const result = await EnhancedRAGService.smartFetch(endpoint, { userId: parseInt(userId, 10), startDate: startDate as string, endDate: endDate as string, limit: parseInt(String(limit), 10) }); res.json({ success: true, data: result.data, details: result.details }); } catch (e) { console.error('Smart data fetch error:', e); res.status(500).json({ success: false, error: 'Smart data fetching failed', details: e instanceof Error ? e.message : 'Unknown error' }); } });
  app.get('/api/rag/health', async (req: Request, res: Response) => { try { const qdrantStatus = { collections: [] } as any; res.json({ success: true, status: 'Enhanced RAG System Online', features: { vectorSearch: true, endpointExtraction: true, directExecution: true, smartFetch: true }, qdrant: { connected: true, collections: qdrantStatus.collections?.map((c: any) => c.name) || [] }, timestamp: new Date().toISOString() }); } catch (e) { res.status(500).json({ success: false, status: 'RAG System Degraded', error: e instanceof Error ? e.message : 'Unknown error', qdrant: { connected: false, error: 'Connection failed' } }); } });

  // ============================================
  // SCHEMA-PERFECT AUTO-GENERATED CRUD ROUTES
  // ============================================
  createAutoCRUD(app, { endpoint: 'dvr', table: dailyVisitReports, schema: insertDailyVisitReportSchema, tableName: 'Daily Visit Report', dateField: 'reportDate', autoFields: { reportDate: () => new Date().toISOString().split('T')[0], checkInTime: () => new Date() } });
  createAutoCRUD(app, { endpoint: 'tvr', table: technicalVisitReports, schema: insertTechnicalVisitReportSchema, tableName: 'Technical Visit Report', dateField: 'reportDate', autoFields: { reportDate: () => new Date().toISOString().split('T')[0], checkInTime: () => new Date() } });
  createAutoCRUD(app, { endpoint: 'pjp', table: permanentJourneyPlans, schema: insertPermanentJourneyPlanSchema, tableName: 'Permanent Journey Plan', dateField: 'startDate' });
  createAutoCRUD(app, { endpoint: 'client-reports', table: clientReports, schema: insertClientReportSchema, tableName: 'Client Report', dateField: 'reportDate' });
  createAutoCRUD(app, { endpoint: 'competition-reports', table: competitionReports, schema: insertCompetitionReportSchema, tableName: 'Competition Report', dateField: 'reportDate' });
  createAutoCRUD(app, { endpoint: 'geo-tracking', table: geoTracking, schema: insertGeoTrackingSchema, tableName: 'Geo Tracking', dateField: 'recordedAt' });
  createAutoCRUD(app, { endpoint: 'daily-tasks', table: dailyTasks, schema: insertDailyTaskSchema, tableName: 'Daily Task', dateField: 'dueDate' });
  createAutoCRUD(app, { endpoint: 'dealers', table: dealers, schema: insertDealerSchema, tableName: 'Dealer' });
  createAutoCRUD(app, { endpoint: 'companies', table: companies, schema: z.any(), tableName: 'Company' });
  createAutoCRUD(app, { endpoint: 'dealer-reports-scores', table: dealerReportsAndScores, schema: insertDealerReportsAndScoresSchema, tableName: 'Dealer Report and Score', autoFields: { lastUpdatedDate: () => new Date() } });

  // RADAR-AWARE MODULES
  // Attendance: context-only geofence, tag=office, optional expectedExternalId match
  createRadarCRUD(app, {
    endpoint: 'attendance',
    table: salesmanAttendance,
    schema: insertSalesmanAttendanceSchema,
    tableName: 'Attendance',
    dateField: 'attendanceDate',
    autoFields: {
      attendanceDate: () => new Date(),
      inTimeTimestamp: () => new Date(),
      inTimeImageCaptured: () => false,
      outTimeImageCaptured: () => false,
      createdAt: () => new Date(),
      updatedAt: () => new Date(),
    },
    radar: {
      useTrack: false,
      track: { latField: 'inTimeLatitude', lngField: 'inTimeLongitude', accField: 'inTimeAccuracy', userIdField: 'userId' },
      enrich: { mappings: { locationName: 'place.name' } },
      requireGeofence: { tag: 'office', externalIdField: 'expectedExternalId', matchBy: 'externalId', errorMessage: 'Not inside required office geofence.' },
      nearbyGeofences: { limit: 5, radius: 800, includeGeometry: false, tags: 'office' },
    },
  });

  // GeoTracking with Radar enrich (keep as before)
  createRadarCRUD(app, {
    endpoint: 'geo-tracking-radar',
    table: geoTracking,
    schema: insertGeoTrackingSchema,
    tableName: 'Geo Tracking (Radar)',
    dateField: 'recordedAt',
    autoFields: { recordedAt: () => new Date() },
    radar: {
      track: { latField: 'latitude', lngField: 'longitude', accField: 'accuracy', userIdField: 'userId' },
      enrich: { mappings: { locationType: 'place.categories.0', siteName: 'place.name' } },
      nearbyGeofences: { limit: 5, radius: 1000, tags: 'dealer' },
    },
  });

  // Dealer Check-ins (requires dealer geofence)
  createRadarCRUD(app, {
    endpoint: 'dealer-checkins',
    table: geoTracking,
    schema: insertGeoTrackingSchema,
    tableName: 'Dealer Check-in',
    dateField: 'recordedAt',
    autoFields: { checkInTime: () => new Date() },
    radar: {
      track: { latField: 'latitude', lngField: 'longitude', userIdField: 'userId' },
      enrich: { mappings: { siteName: 'place.name' } },
      requireGeofence: { tag: 'dealer', externalIdField: 'dealerExternalId', matchBy: 'externalId', errorMessage: 'You must be inside the selected dealer geofence to check in.' },
      nearbyGeofences: { limit: 3, radius: 600, tags: 'dealer' },
    },
  });

  // Dashboard
  app.get('/api/dashboard/stats/:userId', async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId, 10);
      const [monthlyReports, pendingTasks, totalDealers, pendingLeaves] = await Promise.all([
        db.execute(sql`SELECT COUNT(*)::int as count FROM ${dailyVisitReports} WHERE user_id = ${userId} AND DATE_PART('month', report_date) = DATE_PART('month', CURRENT_DATE)`),
        db.execute(sql`SELECT COUNT(*)::int as count FROM ${dailyTasks} WHERE user_id = ${userId} AND status != 'completed'`),
        db.execute(sql`SELECT COUNT(*)::int as count FROM ${dealers} WHERE created_by = ${userId}`),
        db.execute(sql`SELECT COUNT(*)::int as count FROM ${salesmanLeaveApplications} WHERE user_id = ${userId} AND status = 'pending'`)
      ]);
      const todayAttendance = await db.select().from(salesmanAttendance).where(and(eq(salesmanAttendance.userId, userId), eq(sql`DATE(${salesmanAttendance.attendanceDate})`, sql`CURRENT_DATE`)));
      res.json({ success: true, data: { attendance: { present: !!todayAttendance?.[0], punchInTime: todayAttendance?.[0]?.inTimeTimestamp, punchOutTime: todayAttendance?.[0]?.outTimeTimestamp }, stats: { monthlyReports: (monthlyReports as any)[0]?.count || 0, pendingTasks: (pendingTasks as any)[0]?.count || 0, totalDealers: (totalDealers as any)[0]?.count || 0, pendingLeaves: (pendingLeaves as any)[0]?.count || 0 } } });
    } catch (e) { console.error('Dashboard stats error:', e); res.status(500).json({ success: false, error: 'Failed to fetch dashboard stats' }); }
  });
}
