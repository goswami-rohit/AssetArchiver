import { 
  users,
  companies,
  dailyVisitReports,
  technicalVisitReports,
  permanentJourneyPlans,
  dealers,
  salesmanAttendance,
  salesmanLeaveApplications,
  clientReports,
  competitionReports,
  geoTracking,
  dailyTasks,
  dealerReportsAndScores,
  salesReport,
  collectionReports,
  ddp,
  ratings,
  brands,
  dealerBrandMapping,
  masterConnectedTable
} from "../shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, desc, asc, sql, isNull } from "drizzle-orm";

// Local Drizzle type aliases inferred from schema (to avoid importing types)
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;
export type DailyVisitReport = typeof dailyVisitReports.$inferSelect;
export type InsertDailyVisitReport = typeof dailyVisitReports.$inferInsert;
export type TechnicalVisitReport = typeof technicalVisitReports.$inferSelect;
export type InsertTechnicalVisitReport = typeof technicalVisitReports.$inferInsert;
export type PermanentJourneyPlan = typeof permanentJourneyPlans.$inferSelect;
export type InsertPermanentJourneyPlan = typeof permanentJourneyPlans.$inferInsert;
export type Dealer = typeof dealers.$inferSelect;
export type InsertDealer = typeof dealers.$inferInsert;
export type SalesmanAttendance = typeof salesmanAttendance.$inferSelect;
export type InsertSalesmanAttendance = typeof salesmanAttendance.$inferInsert;
export type SalesmanLeaveApplication = typeof salesmanLeaveApplications.$inferSelect;
export type InsertSalesmanLeaveApplication = typeof salesmanLeaveApplications.$inferInsert;
export type ClientReport = typeof clientReports.$inferSelect;
export type InsertClientReport = typeof clientReports.$inferInsert;
export type CompetitionReport = typeof competitionReports.$inferSelect;
export type InsertCompetitionReport = typeof competitionReports.$inferInsert;
export type GeoTracking = typeof geoTracking.$inferSelect;
export type InsertGeoTracking = typeof geoTracking.$inferInsert;
export type DailyTask = typeof dailyTasks.$inferSelect;
export type InsertDailyTask = typeof dailyTasks.$inferInsert;
export type DealerReportsAndScores = typeof dealerReportsAndScores.$inferSelect;
export type InsertDealerReportsAndScores = typeof dealerReportsAndScores.$inferInsert;

export type SalesReport = typeof salesReport.$inferSelect;
export type InsertSalesReport = typeof salesReport.$inferInsert;
export type CollectionReport = typeof collectionReports.$inferSelect;
export type InsertCollectionReport = typeof collectionReports.$inferInsert;
export type Ddp = typeof ddp.$inferSelect;
export type InsertDdp = typeof ddp.$inferInsert;
export type Rating = typeof ratings.$inferSelect;
export type InsertRating = typeof ratings.$inferInsert;
export type Brand = typeof brands.$inferSelect;
export type InsertBrand = typeof brands.$inferInsert;
export type DealerBrandMap = typeof dealerBrandMapping.$inferSelect;
export type InsertDealerBrandMap = typeof dealerBrandMapping.$inferInsert;
export type MasterConnected = typeof masterConnectedTable.$inferSelect;
export type InsertMasterConnected = typeof masterConnectedTable.$inferInsert;

export interface IStorage {
  getCompany(id: number): Promise<Company | undefined>;
  getCompanyByAdminUserId(adminUserId: string): Promise<Company | undefined>;
  getCompaniesByRegion(region: string): Promise<Company[]>;
  createCompany(insertCompany: InsertCompany): Promise<Company>;
  updateCompany(id: number, updates: Partial<InsertCompany>): Promise<Company>;

  getUser(id: number): Promise<User | undefined>;
  getUserByWorkosUserId(workosUserId: string): Promise<User | undefined>;
  getUserBySalesmanLoginId(salesmanLoginId: string): Promise<User | undefined>;
  getUsersByCompanyId(companyId: number): Promise<User[]>;
  getUsersByRegion(region: string): Promise<User[]>;
  getUsersByArea(area: string): Promise<User[]>;
  getUserHierarchy(userId: number): Promise<User[]>;
  getDirectReports(managerId: number): Promise<User[]>;
  createUser(insertUser: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User>;

  getDailyVisitReport(id: string): Promise<DailyVisitReport | undefined>;
  getDailyVisitReportsByUserId(userId: number): Promise<DailyVisitReport[]>;
  getDailyVisitReportsByDateRange(userId: number, startDate: Date, endDate: Date): Promise<DailyVisitReport[]>;
  getDailyVisitReportsByCompanyDateRange(companyId: number, startDate: Date, endDate: Date): Promise<DailyVisitReport[]>;
  createDailyVisitReport(insertReport: InsertDailyVisitReport): Promise<DailyVisitReport>;
  updateDailyVisitReport(id: string, updates: Partial<InsertDailyVisitReport>): Promise<DailyVisitReport>;

  getTechnicalVisitReport(id: string): Promise<TechnicalVisitReport | undefined>;
  getTechnicalVisitReportsByUserId(userId: number): Promise<TechnicalVisitReport[]>;
  getTechnicalVisitReportsByDateRange(userId: number, startDate: Date, endDate: Date): Promise<TechnicalVisitReport[]>;
  createTechnicalVisitReport(insertReport: InsertTechnicalVisitReport): Promise<TechnicalVisitReport>;
  updateTechnicalVisitReport(id: string, updates: Partial<InsertTechnicalVisitReport>): Promise<TechnicalVisitReport>;

  getPermanentJourneyPlan(id: string): Promise<PermanentJourneyPlan | undefined>;
  getPermanentJourneyPlansByUserId(userId: number): Promise<PermanentJourneyPlan[]>;
  getPermanentJourneyPlansAssignedToUser(userId: number): Promise<PermanentJourneyPlan[]>;
  createPermanentJourneyPlan(insertPlan: InsertPermanentJourneyPlan): Promise<PermanentJourneyPlan>;
  updatePermanentJourneyPlan(id: string, updates: Partial<InsertPermanentJourneyPlan>): Promise<PermanentJourneyPlan>;

  getDealer(id: string): Promise<Dealer | undefined>;
  getDealersByUserId(userId: number): Promise<Dealer[]>;
  getDealersByRegion(region: string): Promise<Dealer[]>;
  getDealersByArea(area: string): Promise<Dealer[]>;
  createDealer(insertDealer: InsertDealer): Promise<Dealer>;
  updateDealer(id: string, updates: Partial<InsertDealer>): Promise<Dealer>;

  getSalesmanAttendance(id: string): Promise<SalesmanAttendance | undefined>;
  getSalesmanAttendanceByUserId(userId: number): Promise<SalesmanAttendance[]>;
  getSalesmanAttendanceByDate(userId: number, date: string): Promise<SalesmanAttendance | undefined>;
  createSalesmanAttendance(insertAttendance: InsertSalesmanAttendance): Promise<SalesmanAttendance>;
  updateSalesmanAttendance(id: string, updates: Partial<InsertSalesmanAttendance>): Promise<SalesmanAttendance>;

  getSalesmanLeaveApplication(id: string): Promise<SalesmanLeaveApplication | undefined>;
  getSalesmanLeaveApplicationsByUserId(userId: number): Promise<SalesmanLeaveApplication[]>;
  getSalesmanLeaveApplicationsByStatus(status: string): Promise<SalesmanLeaveApplication[]>;
  createSalesmanLeaveApplication(insertLeave: InsertSalesmanLeaveApplication): Promise<SalesmanLeaveApplication>;
  updateSalesmanLeaveApplication(id: string, updates: Partial<InsertSalesmanLeaveApplication>): Promise<SalesmanLeaveApplication>;

  getClientReport(id: string): Promise<ClientReport | undefined>;
  getClientReportsByUserId(userId: number): Promise<ClientReport[]>;
  createClientReport(insertReport: InsertClientReport): Promise<ClientReport>;
  updateClientReport(id: string, updates: Partial<InsertClientReport>): Promise<ClientReport>;

  getCompetitionReport(id: string): Promise<CompetitionReport | undefined>;
  getCompetitionReportsByUserId(userId: number): Promise<CompetitionReport[]>;
  createCompetitionReport(insertReport: InsertCompetitionReport): Promise<CompetitionReport>;
  updateCompetitionReport(id: string, updates: Partial<InsertCompetitionReport>): Promise<CompetitionReport>;

  getGeoTracking(id: string): Promise<GeoTracking | undefined>;
  getGeoTrackingByUserId(userId: number): Promise<GeoTracking[]>;
  createGeoTracking(insertGeo: InsertGeoTracking): Promise<GeoTracking>;
  updateGeoTracking(id: string, updates: Partial<InsertGeoTracking>): Promise<GeoTracking>;

  getDailyTask(id: string): Promise<DailyTask | undefined>;
  getDailyTasksByUserId(userId: number): Promise<DailyTask[]>;
  getDailyTasksAssignedByUserId(assignedByUserId: number): Promise<DailyTask[]>;
  createDailyTask(insertTask: InsertDailyTask): Promise<DailyTask>;
  updateDailyTask(id: string, updates: Partial<InsertDailyTask>): Promise<DailyTask>;

  getDealerReportsAndScores(id: string): Promise<DealerReportsAndScores | undefined>;
  getDealerReportsAndScoresByDealerId(dealerId: string): Promise<DealerReportsAndScores | undefined>;
  upsertDealerReportsAndScores(data: InsertDealerReportsAndScores): Promise<DealerReportsAndScores>;

  getBusinessMetrics(companyId: number): Promise<any>;
  assignTaskToUser(taskData: InsertDailyTask): Promise<DailyTask>;

  // SALES REPORT
  getSalesReport(id: number): Promise<SalesReport | undefined>;
  getSalesReportsByUserId(userId: number): Promise<SalesReport[]>;
  getSalesReportsByDealerId(dealerId: string): Promise<SalesReport[]>;
  createSalesReport(data: InsertSalesReport): Promise<SalesReport>;
  updateSalesReport(id: number, updates: Partial<InsertSalesReport>): Promise<SalesReport>;

  // COLLECTION REPORTS
  getCollectionReport(id: string): Promise<CollectionReport | undefined>;
  getCollectionReportsByDealerId(dealerId: string): Promise<CollectionReport[]>;
  createCollectionReport(data: InsertCollectionReport): Promise<CollectionReport>;
  updateCollectionReport(id: string, updates: Partial<InsertCollectionReport>): Promise<CollectionReport>;

  // DDP
  getDdp(id: number): Promise<Ddp | undefined>;
  getDdpByUserId(userId: number): Promise<Ddp[]>;
  getDdpByDealerId(dealerId: string): Promise<Ddp[]>;
  createDdp(data: InsertDdp): Promise<Ddp>;
  updateDdp(id: number, updates: Partial<InsertDdp>): Promise<Ddp>;

  // RATINGS
  getRating(id: number): Promise<Rating | undefined>;
  getRatingsByUserId(userId: number): Promise<Rating[]>;
  createRating(data: InsertRating): Promise<Rating>;
  updateRating(id: number, updates: Partial<InsertRating>): Promise<Rating>;

  // BRANDS
  getBrand(id: number): Promise<Brand | undefined>;
  getBrandByName(name: string): Promise<Brand | undefined>;
  listBrands(): Promise<Brand[]>;
  createBrand(data: InsertBrand): Promise<Brand>;
  updateBrand(id: number, updates: Partial<InsertBrand>): Promise<Brand>;

  // DEALER BRAND MAPPING
  getDealerBrandMap(id: string): Promise<DealerBrandMap | undefined>;
  getDealerBrandMapsByDealerId(dealerId: string): Promise<DealerBrandMap[]>;
  getDealerBrandMapsByBrandId(brandId: number): Promise<DealerBrandMap[]>;
  upsertDealerBrandMap(data: InsertDealerBrandMap): Promise<DealerBrandMap>;

  // MASTER CONNECTED TABLE
  getMasterConnected(id: string): Promise<MasterConnected | undefined>;
  createMasterConnected(data: InsertMasterConnected): Promise<MasterConnected>;
  updateMasterConnected(id: string, updates: Partial<InsertMasterConnected>): Promise<MasterConnected>;
}

export class DatabaseStorage implements IStorage {
  // ========================================
  // COMPANY OPERATIONS
  // ========================================
  
  async getCompany(id: number): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company || undefined;
  }

  async getCompanyByAdminUserId(adminUserId: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.adminUserId, adminUserId));
    return company || undefined;
  }

  async getCompaniesByRegion(region: string): Promise<Company[]> {
    return await db.select().from(companies).where(eq(companies.region, region));
  }

  async createCompany(insertCompany: InsertCompany): Promise<Company> {
    const [company] = await db.insert(companies).values(insertCompany).returning();
    return company;
  }

  async updateCompany(id: number, updates: Partial<InsertCompany>): Promise<Company> {
    const [company] = await db.update(companies).set({
      ...updates,
      updatedAt: new Date()
    }).where(eq(companies.id, id)).returning();
    return company;
  }

  // ========================================
  // USER OPERATIONS
  // ========================================

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByWorkosUserId(workosUserId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.workosUserId, workosUserId));
    return user || undefined;
  }

  async getUserBySalesmanLoginId(salesmanLoginId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.salesmanLoginId, salesmanLoginId));
    return user || undefined;
  }

  async getUsersByCompanyId(companyId: number): Promise<User[]> {
    return await db.select().from(users).where(eq(users.companyId, companyId));
  }

  async getUsersByRegion(region: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.region, region));
  }

  async getUsersByArea(area: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.area, area));
  }

  async getUserHierarchy(userId: number): Promise<User[]> {
    const results = await db.execute(sql`
      WITH RECURSIVE hierarchy AS (
        SELECT * FROM users WHERE id = ${userId}
        UNION ALL
        SELECT u.* FROM users u
        JOIN hierarchy h ON u.reports_to_id = h.id
      )
      SELECT * FROM hierarchy;
    `);
    // @ts-ignore drizzle execute returns rows
    return results.rows as User[];
  }

  async getDirectReports(managerId: number): Promise<User[]> {
    return await db.select().from(users).where(eq(users.reportsToId, managerId));
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User> {
    const [user] = await db.update(users).set({
      ...updates,
      updatedAt: new Date()
    }).where(eq(users.id, id)).returning();
    return user;
  }

  // ========================================
  // DAILY VISIT REPORTS
  // ========================================

  async getDailyVisitReport(id: string): Promise<DailyVisitReport | undefined> {
    const [report] = await db.select().from(dailyVisitReports).where(eq(dailyVisitReports.id, id));
    return report || undefined;
  }

  async getDailyVisitReportsByUserId(userId: number): Promise<DailyVisitReport[]> {
    return await db.select().from(dailyVisitReports).where(eq(dailyVisitReports.userId, userId)).orderBy(desc(dailyVisitReports.createdAt));
  }

  async getDailyVisitReportsByDateRange(userId: number, startDate: Date, endDate: Date): Promise<DailyVisitReport[]> {
    return await db.select().from(dailyVisitReports).where(
      and(
        eq(dailyVisitReports.userId, userId),
        gte(dailyVisitReports.createdAt, startDate),
        lte(dailyVisitReports.createdAt, endDate)
      )
    ).orderBy(desc(dailyVisitReports.createdAt));
  }

  async getDailyVisitReportsByCompanyDateRange(companyId: number, startDate: Date, endDate: Date): Promise<DailyVisitReport[]> {
    return await db.execute(sql`
      SELECT dvr.*
      FROM daily_visit_reports dvr
      JOIN users u ON u.id = dvr.user_id
      WHERE u.company_id = ${companyId}
        AND dvr.created_at >= ${startDate}
        AND dvr.created_at <= ${endDate}
      ORDER BY dvr.created_at DESC
    `).then(res => (res as any).rows as DailyVisitReport[]);
  }

  async createDailyVisitReport(insertReport: InsertDailyVisitReport): Promise<DailyVisitReport> {
    const [report] = await db.insert(dailyVisitReports).values(insertReport).returning();
    return report;
  }

  async updateDailyVisitReport(id: string, updates: Partial<InsertDailyVisitReport>): Promise<DailyVisitReport> {
    const [report] = await db.update(dailyVisitReports).set({
      ...updates,
      updatedAt: new Date()
    }).where(eq(dailyVisitReports.id, id)).returning();
    return report;
  }

  // ========================================
  // TECHNICAL VISIT REPORTS
  // ========================================

  async getTechnicalVisitReport(id: string): Promise<TechnicalVisitReport | undefined> {
    const [report] = await db.select().from(technicalVisitReports).where(eq(technicalVisitReports.id, id));
    return report || undefined;
  }

  async getTechnicalVisitReportsByUserId(userId: number): Promise<TechnicalVisitReport[]> {
    return await db.select().from(technicalVisitReports).where(eq(technicalVisitReports.userId, userId)).orderBy(desc(technicalVisitReports.createdAt));
  }

  async getTechnicalVisitReportsByDateRange(userId: number, startDate: Date, endDate: Date): Promise<TechnicalVisitReport[]> {
    return await db.select().from(technicalVisitReports).where(
      and(
        eq(technicalVisitReports.userId, userId),
        gte(technicalVisitReports.createdAt, startDate),
        lte(technicalVisitReports.createdAt, endDate)
      )
    ).orderBy(desc(technicalVisitReports.createdAt));
  }

  async createTechnicalVisitReport(insertReport: InsertTechnicalVisitReport): Promise<TechnicalVisitReport> {
    const [report] = await db.insert(technicalVisitReports).values(insertReport).returning();
    return report;
  }

  async updateTechnicalVisitReport(id: string, updates: Partial<InsertTechnicalVisitReport>): Promise<TechnicalVisitReport> {
    const [report] = await db.update(technicalVisitReports).set({
      ...updates,
      updatedAt: new Date()
    }).where(eq(technicalVisitReports.id, id)).returning();
    return report;
  }

  // ========================================
  // PERMANENT JOURNEY PLANS
  // ========================================

  async getPermanentJourneyPlan(id: string): Promise<PermanentJourneyPlan | undefined> {
    const [plan] = await db.select().from(permanentJourneyPlans).where(eq(permanentJourneyPlans.id, id));
    return plan || undefined;
  }

  async getPermanentJourneyPlansByUserId(userId: number): Promise<PermanentJourneyPlan[]> {
    return await db.select().from(permanentJourneyPlans).where(eq(permanentJourneyPlans.createdById, userId)).orderBy(desc(permanentJourneyPlans.createdAt));
  }

  async getPermanentJourneyPlansAssignedToUser(userId: number): Promise<PermanentJourneyPlan[]> {
    return await db.select().from(permanentJourneyPlans).where(eq(permanentJourneyPlans.userId, userId)).orderBy(desc(permanentJourneyPlans.createdAt));
  }

  async createPermanentJourneyPlan(insertPlan: InsertPermanentJourneyPlan): Promise<PermanentJourneyPlan> {
    const [plan] = await db.insert(permanentJourneyPlans).values(insertPlan).returning();
    return plan;
  }

  async updatePermanentJourneyPlan(id: string, updates: Partial<InsertPermanentJourneyPlan>): Promise<PermanentJourneyPlan> {
    const [plan] = await db.update(permanentJourneyPlans).set({
      ...updates,
      updatedAt: new Date()
    }).where(eq(permanentJourneyPlans.id, id)).returning();
    return plan;
  }

  // ========================================
  // DEALERS
  // ========================================

  async getDealer(id: string): Promise<Dealer | undefined> {
    const [dealer] = await db.select().from(dealers).where(eq(dealers.id, id));
    return dealer || undefined;
  }

  async getDealersByUserId(userId: number): Promise<Dealer[]> {
    return await db.select().from(dealers).where(eq(dealers.userId, userId));
  }

  async getDealersByRegion(region: string): Promise<Dealer[]> {
    return await db.select().from(dealers).where(eq(dealers.region, region));
  }

  async getDealersByArea(area: string): Promise<Dealer[]> {
    return await db.select().from(dealers).where(eq(dealers.area, area));
  }

  async createDealer(insertDealer: InsertDealer): Promise<Dealer> {
    const [dealer] = await db.insert(dealers).values(insertDealer).returning();
    return dealer;
  }

  async updateDealer(id: string, updates: Partial<InsertDealer>): Promise<Dealer> {
    const [dealer] = await db.update(dealers).set({
      ...updates,
      updatedAt: new Date()
    }).where(eq(dealers.id, id)).returning();
    return dealer;
  }

  // ========================================
  // SALESMAN ATTENDANCE
  // ========================================

  async getSalesmanAttendance(id: string): Promise<SalesmanAttendance | undefined> {
    const [attendance] = await db.select().from(salesmanAttendance).where(eq(salesmanAttendance.id, id));
    return attendance || undefined;
  }

  async getSalesmanAttendanceByUserId(userId: number): Promise<SalesmanAttendance[]> {
    return await db.select().from(salesmanAttendance).where(eq(salesmanAttendance.userId, userId)).orderBy(desc(salesmanAttendance.createdAt));
  }

  async getSalesmanAttendanceByDate(userId: number, date: string): Promise<SalesmanAttendance | undefined> {
    const [attendance] = await db.select().from(salesmanAttendance).where(
      and(eq(salesmanAttendance.userId, userId), eq(salesmanAttendance.attendanceDate, date))
    );
    return attendance || undefined;
  }

  async createSalesmanAttendance(insertAttendance: InsertSalesmanAttendance): Promise<SalesmanAttendance> {
    const [attendance] = await db.insert(salesmanAttendance).values(insertAttendance).returning();
    return attendance;
  }

  async updateSalesmanAttendance(id: string, updates: Partial<InsertSalesmanAttendance>): Promise<SalesmanAttendance> {
    const [attendance] = await db.update(salesmanAttendance).set({
      ...updates,
      updatedAt: new Date()
    }).where(eq(salesmanAttendance.id, id)).returning();
    return attendance;
  }

  // ========================================
  // LEAVE APPLICATIONS
  // ========================================

  async getSalesmanLeaveApplication(id: string): Promise<SalesmanLeaveApplication | undefined> {
    const [leave] = await db.select().from(salesmanLeaveApplications).where(eq(salesmanLeaveApplications.id, id));
    return leave || undefined;
  }

  async getSalesmanLeaveApplicationsByUserId(userId: number): Promise<SalesmanLeaveApplication[]> {
    return await db.select().from(salesmanLeaveApplications).where(eq(salesmanLeaveApplications.userId, userId)).orderBy(desc(salesmanLeaveApplications.createdAt));
  }

  async getSalesmanLeaveApplicationsByStatus(status: string): Promise<SalesmanLeaveApplication[]> {
    return await db.select().from(salesmanLeaveApplications).where(eq(salesmanLeaveApplications.status, status)).orderBy(desc(salesmanLeaveApplications.createdAt));
  }

  async createSalesmanLeaveApplication(insertLeave: InsertSalesmanLeaveApplication): Promise<SalesmanLeaveApplication> {
    const [leave] = await db.insert(salesmanLeaveApplications).values(insertLeave).returning();
    return leave;
  }

  async updateSalesmanLeaveApplication(id: string, updates: Partial<InsertSalesmanLeaveApplication>): Promise<SalesmanLeaveApplication> {
    const [leave] = await db.update(salesmanLeaveApplications).set({
      ...updates,
      updatedAt: new Date()
    }).where(eq(salesmanLeaveApplications.id, id)).returning();
    return leave;
  }

  // ========================================
  // CLIENT REPORTS
  // ========================================

  async getClientReport(id: string): Promise<ClientReport | undefined> {
    const [report] = await db.select().from(clientReports).where(eq(clientReports.id, id));
    return report || undefined;
  }

  async getClientReportsByUserId(userId: number): Promise<ClientReport[]> {
    return await db.select().from(clientReports).where(eq(clientReports.userId, userId)).orderBy(desc(clientReports.createdAt));
  }

  async createClientReport(insertReport: InsertClientReport): Promise<ClientReport> {
    const [report] = await db.insert(clientReports).values(insertReport).returning();
    return report;
  }

  async updateClientReport(id: string, updates: Partial<InsertClientReport>): Promise<ClientReport> {
    const [report] = await db.update(clientReports).set({
      ...updates,
      updatedAt: new Date()
    }).where(eq(clientReports.id, id)).returning();
    return report;
  }

  // ========================================
  // COMPETITION REPORTS
  // ========================================

  async getCompetitionReport(id: string): Promise<CompetitionReport | undefined> {
    const [report] = await db.select().from(competitionReports).where(eq(competitionReports.id, id));
    return report || undefined;
  }

  async getCompetitionReportsByUserId(userId: number): Promise<CompetitionReport[]> {
    return await db.select().from(competitionReports).where(eq(competitionReports.userId, userId)).orderBy(desc(competitionReports.createdAt));
  }

  async createCompetitionReport(insertReport: InsertCompetitionReport): Promise<CompetitionReport> {
    const [report] = await db.insert(competitionReports).values(insertReport).returning();
    return report;
  }

  async updateCompetitionReport(id: string, updates: Partial<InsertCompetitionReport>): Promise<CompetitionReport> {
    const [report] = await db.update(competitionReports).set({
      ...updates,
      updatedAt: new Date()
    }).where(eq(competitionReports.id, id)).returning();
    return report;
  }

  // ========================================
  // GEO TRACKING
  // ========================================

  async getGeoTracking(id: string): Promise<GeoTracking | undefined> {
    const [geo] = await db.select().from(geoTracking).where(eq(geoTracking.id, id));
    return geo || undefined;
  }

  async getGeoTrackingByUserId(userId: number): Promise<GeoTracking[]> {
    return await db.select().from(geoTracking).where(eq(geoTracking.userId, userId)).orderBy(desc(geoTracking.createdAt));
  }

  async createGeoTracking(insertGeo: InsertGeoTracking): Promise<GeoTracking> {
    const [geo] = await db.insert(geoTracking).values(insertGeo).returning();
    return geo;
  }

  async updateGeoTracking(id: string, updates: Partial<InsertGeoTracking>): Promise<GeoTracking> {
    const [geo] = await db.update(geoTracking).set({
      ...updates,
      updatedAt: new Date()
    }).where(eq(geoTracking.id, id)).returning();
    return geo;
  }

  // ========================================
  // DAILY TASKS
  // ========================================

  async getDailyTask(id: string): Promise<DailyTask | undefined> {
    const [task] = await db.select().from(dailyTasks).where(eq(dailyTasks.id, id));
    return task || undefined;
  }

  async getDailyTasksByUserId(userId: number): Promise<DailyTask[]> {
    return await db.select().from(dailyTasks).where(eq(dailyTasks.userId, userId)).orderBy(desc(dailyTasks.createdAt));
  }

  async getDailyTasksAssignedByUserId(assignedByUserId: number): Promise<DailyTask[]> {
    return await db.select().from(dailyTasks).where(eq(dailyTasks.assignedByUserId, assignedByUserId)).orderBy(desc(dailyTasks.createdAt));
  }

  async createDailyTask(insertTask: InsertDailyTask): Promise<DailyTask> {
    const [task] = await db.insert(dailyTasks).values(insertTask).returning();
    return task;
  }

  async updateDailyTask(id: string, updates: Partial<InsertDailyTask>): Promise<DailyTask> {
    const [task] = await db.update(dailyTasks).set({
      ...updates,
      updatedAt: new Date()
    }).where(eq(dailyTasks.id, id)).returning();
    return task;
  }

  // ========================================
  // DEALER REPORTS AND SCORES
  // ========================================

  async getDealerReportsAndScores(id: string): Promise<DealerReportsAndScores | undefined> {
    const [row] = await db.select().from(dealerReportsAndScores).where(eq(dealerReportsAndScores.id, id));
    return row || undefined;
  }

  async getDealerReportsAndScoresByDealerId(dealerId: string): Promise<DealerReportsAndScores | undefined> {
    const [row] = await db.select().from(dealerReportsAndScores).where(eq(dealerReportsAndScores.dealerId, dealerId));
    return row || undefined;
  }

  async upsertDealerReportsAndScores(data: InsertDealerReportsAndScores): Promise<DealerReportsAndScores> {
    // try insert; on conflict update
    try {
      const [row] = await db.insert(dealerReportsAndScores).values(data).returning();
      return row;
    } catch {
      const [row] = await db.update(dealerReportsAndScores)
        .set({
          dealerScore: (data as any).dealerScore,
          trustWorthinessScore: (data as any).trustWorthinessScore,
          creditWorthinessScore: (data as any).creditWorthinessScore,
          orderHistoryScore: (data as any).orderHistoryScore,
          visitFrequencyScore: (data as any).visitFrequencyScore,
          lastUpdatedDate: (data as any).lastUpdatedDate,
          updatedAt: new Date()
        })
        .where(eq(dealerReportsAndScores.dealerId, (data as any).dealerId))
        .returning();
      return row;
    }
  }

  // ========================================
  // BUSINESS METRICS (example aggregate)
  // ========================================

  async getBusinessMetrics(companyId: number): Promise<any> {
    try {
      const totalUsers = await db.execute(sql`SELECT COUNT(*) FROM users WHERE company_id = ${companyId}`);
      const totalReports = await db.execute(sql`
        SELECT COUNT(*) FROM (
          SELECT id FROM daily_visit_reports dvr
          JOIN users u ON u.id = dvr.user_id
          WHERE u.company_id = ${companyId}
          UNION ALL
          SELECT id FROM technical_visit_reports tvr
          JOIN users u ON u.id = tvr.user_id
          WHERE u.company_id = ${companyId}
        ) q
      `);
      const activeDealers = await db.execute(sql`
        SELECT COUNT(DISTINCT d.id) 
        FROM dealers d
        WHERE d.user_id IN (
          SELECT id FROM users WHERE company_id = ${companyId}
        )
      `);
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthlyAttendance = await db.select({ count: sql<number>`COUNT(*)` })
        .from(salesmanAttendance)
        .innerJoin(users, eq(salesmanAttendance.userId, users.id))
        .where(
          and(
            eq(users.companyId, companyId),
            gte(salesmanAttendance.attendanceDate, firstDayOfMonth.toISOString().split('T')[0])
          )
        );

      return {
        totalUsers: Number(totalUsers[0]?.count || 0),
        totalReports: Number(totalReports[0]?.count || 0),
        activeDealers: Number(activeDealers[0]?.count || 0),
        monthlyAttendance: Number(monthlyAttendance[0]?.count || 0),
      };
    } catch (error) {
      console.error('Error getting business metrics:', error);
      throw error;
    }
  }

  // ========================================
  // TASK ASSIGNMENT (helper)
  // ========================================

  async assignTaskToUser(taskData: InsertDailyTask): Promise<DailyTask> {
    try {
      const task = await this.createDailyTask(taskData);
      console.log(`Task assigned to user ${taskData.userId} by user ${taskData.assignedByUserId}`);
      return task;
    } catch (error) {
      console.error('Error assigning task to user:', error);
      throw error;
    }
  }

  // ========================================
  // SALES REPORT (NEW)
  // ========================================
  async getSalesReport(id: number): Promise<SalesReport | undefined> {
    const [row] = await db.select().from(salesReport).where(eq(salesReport.id, id));
    return row || undefined;
  }
  async getSalesReportsByUserId(userId: number): Promise<SalesReport[]> {
    return await db.select().from(salesReport).where(eq(salesReport.salesPersonId, userId));
  }
  async getSalesReportsByDealerId(dealerId: string): Promise<SalesReport[]> {
    return await db.select().from(salesReport).where(eq(salesReport.dealerId, dealerId));
  }
  async createSalesReport(data: InsertSalesReport): Promise<SalesReport> {
    const [row] = await db.insert(salesReport).values(data).returning();
    return row;
  }
  async updateSalesReport(id: number, updates: Partial<InsertSalesReport>): Promise<SalesReport> {
    const [row] = await db.update(salesReport).set({ ...updates }).where(eq(salesReport.id, id)).returning();
    return row;
  }

  // ========================================
  // COLLECTION REPORTS (NEW)
  // ========================================
  async getCollectionReport(id: string): Promise<CollectionReport | undefined> {
    const [row] = await db.select().from(collectionReports).where(eq(collectionReports.id, id));
    return row || undefined;
  }
  async getCollectionReportsByDealerId(dealerId: string): Promise<CollectionReport[]> {
    return await db.select().from(collectionReports).where(eq(collectionReports.dealerId, dealerId));
  }
  async createCollectionReport(data: InsertCollectionReport): Promise<CollectionReport> {
    const [row] = await db.insert(collectionReports).values(data).returning();
    return row;
  }
  async updateCollectionReport(id: string, updates: Partial<InsertCollectionReport>): Promise<CollectionReport> {
    const [row] = await db.update(collectionReports).set({ ...updates }).where(eq(collectionReports.id, id)).returning();
    return row;
  }

  // ========================================
  // DEALER DEVELOPMENT PROCESS (DDP) (NEW)
  // ========================================
  async getDdp(id: number): Promise<Ddp | undefined> {
    const [row] = await db.select().from(ddp).where(eq(ddp.id, id));
    return row || undefined;
  }
  async getDdpByUserId(userId: number): Promise<Ddp[]> {
    return await db.select().from(ddp).where(eq(ddp.userId, userId));
  }
  async getDdpByDealerId(dealerId: string): Promise<Ddp[]> {
    return await db.select().from(ddp).where(eq(ddp.dealerId, dealerId));
  }
  async createDdp(data: InsertDdp): Promise<Ddp> {
    const [row] = await db.insert(ddp).values(data).returning();
    return row;
  }
  async updateDdp(id: number, updates: Partial<InsertDdp>): Promise<Ddp> {
    const [row] = await db.update(ddp).set({ ...updates }).where(eq(ddp.id, id)).returning();
    return row;
  }

  // ========================================
  // RATINGS (NEW)
  // ========================================
  async getRating(id: number): Promise<Rating | undefined> {
    const [row] = await db.select().from(ratings).where(eq(ratings.id, id));
    return row || undefined;
  }
  async getRatingsByUserId(userId: number): Promise<Rating[]> {
    return await db.select().from(ratings).where(eq(ratings.userId, userId));
  }
  async createRating(data: InsertRating): Promise<Rating> {
    const [row] = await db.insert(ratings).values(data).returning();
    return row;
  }
  async updateRating(id: number, updates: Partial<InsertRating>): Promise<Rating> {
    const [row] = await db.update(ratings).set({ ...updates }).where(eq(ratings.id, id)).returning();
    return row;
  }

  // ========================================
  // BRANDS (NEW)
  // ========================================
  async getBrand(id: number): Promise<Brand | undefined> {
    const [row] = await db.select().from(brands).where(eq(brands.id, id));
    return row || undefined;
  }
  async getBrandByName(name: string): Promise<Brand | undefined> {
    const [row] = await db.select().from(brands).where(eq(brands.name, name));
    return row || undefined;
  }
  async listBrands(): Promise<Brand[]> {
    return await db.select().from(brands).orderBy(asc(brands.name));
  }
  async createBrand(data: InsertBrand): Promise<Brand> {
    const [row] = await db.insert(brands).values(data).returning();
    return row;
  }
  async updateBrand(id: number, updates: Partial<InsertBrand>): Promise<Brand> {
    const [row] = await db.update(brands).set({ ...updates }).where(eq(brands.id, id)).returning();
    return row;
  }

  // ========================================
  // DEALER BRAND MAPPING (NEW)
  // ========================================
  async getDealerBrandMap(id: string): Promise<DealerBrandMap | undefined> {
    const [row] = await db.select().from(dealerBrandMapping).where(eq(dealerBrandMapping.id, id));
    return row || undefined;
  }
  async getDealerBrandMapsByDealerId(dealerId: string): Promise<DealerBrandMap[]> {
    return await db.select().from(dealerBrandMapping).where(eq(dealerBrandMapping.dealerId, dealerId));
  }
  async getDealerBrandMapsByBrandId(brandId: number): Promise<DealerBrandMap[]> {
    return await db.select().from(dealerBrandMapping).where(eq(dealerBrandMapping.brandId, brandId));
  }
  async upsertDealerBrandMap(data: InsertDealerBrandMap): Promise<DealerBrandMap> {
    try {
      const [row] = await db.insert(dealerBrandMapping).values(data).returning();
      return row;
    } catch (e) {
      const [row] = await db.update(dealerBrandMapping)
        .set({ capacityMT: (data as any).capacityMT })
        .where(and(eq(dealerBrandMapping.dealerId, (data as any).dealerId), eq(dealerBrandMapping.brandId, (data as any).brandId)))
        .returning();
      return row;
    }
  }

  // ========================================
  // MASTER CONNECTED TABLE (NEW)
  // ========================================
  async getMasterConnected(id: string): Promise<MasterConnected | undefined> {
    const [row] = await db.select().from(masterConnectedTable).where(eq(masterConnectedTable.id, id));
    return row || undefined;
  }
  async createMasterConnected(data: InsertMasterConnected): Promise<MasterConnected> {
    const [row] = await db.insert(masterConnectedTable).values(data).returning();
    return row;
  }
  async updateMasterConnected(id: string, updates: Partial<InsertMasterConnected>): Promise<MasterConnected> {
    const [row] = await db.update(masterConnectedTable).set({ ...updates }).where(eq(masterConnectedTable.id, id)).returning();
    return row;
  }
}

export const storage = new DatabaseStorage();