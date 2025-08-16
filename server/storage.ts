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
  type User, 
  type InsertUser,
  type Company,
  type InsertCompany,
  type DailyVisitReport,
  type InsertDailyVisitReport,
  type TechnicalVisitReport,
  type InsertTechnicalVisitReport,
  type PermanentJourneyPlan,
  type InsertPermanentJourneyPlan,
  type Dealer,
  type InsertDealer,
  type SalesmanAttendance,
  type InsertSalesmanAttendance,
  type SalesmanLeaveApplication,
  type InsertSalesmanLeaveApplication,
  type ClientReport,
  type InsertClientReport,
  type CompetitionReport,
  type InsertCompetitionReport,
  type GeoTracking,
  type InsertGeoTracking,
  type DailyTask,
  type InsertDailyTask,
  type DealerReportsAndScores,
  type InsertDealerReportsAndScores
} from "../shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, desc, asc, sql, isNull } from "drizzle-orm";

export interface IStorage {
  // Company operations
  getCompany(id: number): Promise<Company | undefined>;
  getCompanyByAdminUserId(adminUserId: string): Promise<Company | undefined>;
  getCompaniesByRegion(region: string): Promise<Company[]>;
  createCompany(insertCompany: InsertCompany): Promise<Company>;
  updateCompany(id: number, updates: Partial<InsertCompany>): Promise<Company>;

  // User operations
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

  // Daily Visit Report operations
  getDailyVisitReport(id: string): Promise<DailyVisitReport | undefined>;
  getDailyVisitReportsByUserId(userId: number): Promise<DailyVisitReport[]>;
  getDailyVisitReportsByDateRange(userId: number, startDate: Date, endDate: Date): Promise<DailyVisitReport[]>;
  getDailyVisitReportsByCompanyDateRange(companyId: number, startDate: Date, endDate: Date): Promise<DailyVisitReport[]>;
  createDailyVisitReport(insertReport: InsertDailyVisitReport): Promise<DailyVisitReport>;
  updateDailyVisitReport(id: string, updates: Partial<InsertDailyVisitReport>): Promise<DailyVisitReport>;

  // Technical Visit Report operations
  getTechnicalVisitReport(id: string): Promise<TechnicalVisitReport | undefined>;
  getTechnicalVisitReportsByUserId(userId: number): Promise<TechnicalVisitReport[]>;
  getTechnicalVisitReportsByDateRange(userId: number, startDate: Date, endDate: Date): Promise<TechnicalVisitReport[]>;
  createTechnicalVisitReport(insertReport: InsertTechnicalVisitReport): Promise<TechnicalVisitReport>;
  updateTechnicalVisitReport(id: string, updates: Partial<InsertTechnicalVisitReport>): Promise<TechnicalVisitReport>;

  // Permanent Journey Plan operations
  getPermanentJourneyPlan(id: string): Promise<PermanentJourneyPlan | undefined>;
  getPermanentJourneyPlansByUserId(userId: number): Promise<PermanentJourneyPlan[]>;
  createPermanentJourneyPlan(insertPlan: InsertPermanentJourneyPlan): Promise<PermanentJourneyPlan>;
  updatePermanentJourneyPlan(id: string, updates: Partial<InsertPermanentJourneyPlan>): Promise<PermanentJourneyPlan>;

  // Dealer operations
  getDealer(id: string): Promise<Dealer | undefined>;
  getDealersByUserId(userId: number): Promise<Dealer[]>;
  getDealersByRegion(region: string): Promise<Dealer[]>;
  getDealersByArea(area: string): Promise<Dealer[]>;
  getSubDealers(parentDealerId: string): Promise<Dealer[]>;
  createDealer(insertDealer: InsertDealer): Promise<Dealer>;
  updateDealer(id: string, updates: Partial<InsertDealer>): Promise<Dealer>;

  // Salesman Attendance operations
  getSalesmanAttendance(id: string): Promise<SalesmanAttendance | undefined>;
  getSalesmanAttendanceByUserId(userId: number): Promise<SalesmanAttendance[]>;
  getSalesmanAttendanceByDate(userId: number, date: Date): Promise<SalesmanAttendance | undefined>;
  createSalesmanAttendance(insertAttendance: InsertSalesmanAttendance): Promise<SalesmanAttendance>;
  updateSalesmanAttendance(id: string, updates: Partial<InsertSalesmanAttendance>): Promise<SalesmanAttendance>;

  // Salesman Leave Application operations
  getSalesmanLeaveApplication(id: string): Promise<SalesmanLeaveApplication | undefined>;
  getSalesmanLeaveApplicationsByUserId(userId: number): Promise<SalesmanLeaveApplication[]>;
  getSalesmanLeaveApplicationsByStatus(status: string): Promise<SalesmanLeaveApplication[]>;
  createSalesmanLeaveApplication(insertApplication: InsertSalesmanLeaveApplication): Promise<SalesmanLeaveApplication>;
  updateSalesmanLeaveApplication(id: string, updates: Partial<InsertSalesmanLeaveApplication>): Promise<SalesmanLeaveApplication>;

  // Client Report operations
  getClientReport(id: string): Promise<ClientReport | undefined>;
  getClientReportsByUserId(userId: number): Promise<ClientReport[]>;
  createClientReport(insertReport: InsertClientReport): Promise<ClientReport>;
  updateClientReport(id: string, updates: Partial<InsertClientReport>): Promise<ClientReport>;

  // Competition Report operations
  getCompetitionReport(id: string): Promise<CompetitionReport | undefined>;
  getCompetitionReportsByUserId(userId: number): Promise<CompetitionReport[]>;
  getCompetitionReportsByDateRange(userId: number, startDate: Date, endDate: Date): Promise<CompetitionReport[]>;
  createCompetitionReport(insertReport: InsertCompetitionReport): Promise<CompetitionReport>;
  updateCompetitionReport(id: string, updates: Partial<InsertCompetitionReport>): Promise<CompetitionReport>;

  // Geo Tracking operations
  getGeoTrackingRecords(userId: number, limit?: number): Promise<GeoTracking[]>;
  getGeoTrackingByDateRange(userId: number, startDate: Date, endDate: Date): Promise<GeoTracking[]>;
  createGeoTrackingRecord(insertRecord: InsertGeoTracking): Promise<GeoTracking>;

  // Daily Task operations
  getDailyTask(id: string): Promise<DailyTask | undefined>;
  getDailyTasksByAssignedUserId(userId: number): Promise<DailyTask[]>;
  getDailyTasksByCreatedUserId(userId: number): Promise<DailyTask[]>;
  getDailyTasksByStatus(status: string, companyId: number): Promise<DailyTask[]>;
  createDailyTask(insertTask: InsertDailyTask): Promise<DailyTask>;
  updateDailyTask(id: string, updates: Partial<InsertDailyTask>): Promise<DailyTask>;
  updateTaskStatus(taskId: string, status: string): Promise<DailyTask>;

  // Dealer Reports and Scores operations
  getDealerReportsAndScores(id: string): Promise<DealerReportsAndScores | undefined>;
  getDealerReportsAndScoresByDealerId(dealerId: string): Promise<DealerReportsAndScores | undefined>;
  createDealerReportsAndScores(insertScores: InsertDealerReportsAndScores): Promise<DealerReportsAndScores>;
  updateDealerReportsAndScores(id: string, updates: Partial<InsertDealerReportsAndScores>): Promise<DealerReportsAndScores>;

  // Enhanced business methods
  authenticateUser(salesmanLoginId: string, password: string): Promise<User | null>;
  trackLocation(userId: number, latitude: number, longitude: number): Promise<GeoTracking>;
  getLocationAnalytics(userId: number, period: string): Promise<any>;
  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number;
  punchIn(userId: number, latitude: number, longitude: number, photoUrl?: string): Promise<SalesmanAttendance>;
  punchOut(userId: number, latitude: number, longitude: number, photoUrl?: string): Promise<SalesmanAttendance>;
  getBusinessMetrics(companyId: number): Promise<any>;
  assignTaskToUser(taskData: InsertDailyTask): Promise<DailyTask>;
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
    // Get all users who report to this user (recursively)
    const hierarchy = await db
      .select()
      .from(users)
      .where(eq(users.reportsToId, userId));
    return hierarchy;
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
  // DAILY VISIT REPORT OPERATIONS
  // ========================================

  async getDailyVisitReport(id: string): Promise<DailyVisitReport | undefined> {
    const [report] = await db.select().from(dailyVisitReports).where(eq(dailyVisitReports.id, id));
    return report || undefined;
  }

  async getDailyVisitReportsByUserId(userId: number): Promise<DailyVisitReport[]> {
    return await db.select().from(dailyVisitReports)
      .where(eq(dailyVisitReports.userId, userId))
      .orderBy(desc(dailyVisitReports.reportDate));
  }

  async getDailyVisitReportsByDateRange(userId: number, startDate: Date, endDate: Date): Promise<DailyVisitReport[]> {
    return await db.select().from(dailyVisitReports)
      .where(and(
        eq(dailyVisitReports.userId, userId),
        gte(dailyVisitReports.reportDate, startDate.toISOString().split('T')[0]),
        lte(dailyVisitReports.reportDate, endDate.toISOString().split('T')[0])
      ))
      .orderBy(desc(dailyVisitReports.reportDate));
  }

  async getDailyVisitReportsByCompanyDateRange(companyId: number, startDate: Date, endDate: Date): Promise<DailyVisitReport[]> {
    return await db.select().from(dailyVisitReports)
      .innerJoin(users, eq(dailyVisitReports.userId, users.id))
      .where(and(
        eq(users.companyId, companyId),
        gte(dailyVisitReports.reportDate, startDate.toISOString().split('T')[0]),
        lte(dailyVisitReports.reportDate, endDate.toISOString().split('T')[0])
      ))
      .orderBy(desc(dailyVisitReports.reportDate));
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
  // TECHNICAL VISIT REPORT OPERATIONS
  // ========================================

  async getTechnicalVisitReport(id: string): Promise<TechnicalVisitReport | undefined> {
    const [report] = await db.select().from(technicalVisitReports).where(eq(technicalVisitReports.id, id));
    return report || undefined;
  }

  async getTechnicalVisitReportsByUserId(userId: number): Promise<TechnicalVisitReport[]> {
    return await db.select().from(technicalVisitReports)
      .where(eq(technicalVisitReports.userId, userId))
      .orderBy(desc(technicalVisitReports.reportDate));
  }

  async getTechnicalVisitReportsByDateRange(userId: number, startDate: Date, endDate: Date): Promise<TechnicalVisitReport[]> {
    return await db.select().from(technicalVisitReports)
      .where(and(
        eq(technicalVisitReports.userId, userId),
        gte(technicalVisitReports.reportDate, startDate.toISOString().split('T')[0]),
        lte(technicalVisitReports.reportDate, endDate.toISOString().split('T')[0])
      ))
      .orderBy(desc(technicalVisitReports.reportDate));
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
  // PERMANENT JOURNEY PLAN OPERATIONS
  // ========================================

  async getPermanentJourneyPlan(id: string): Promise<PermanentJourneyPlan | undefined> {
    const [plan] = await db.select().from(permanentJourneyPlans).where(eq(permanentJourneyPlans.id, id));
    return plan || undefined;
  }

  async getPermanentJourneyPlansByUserId(userId: number): Promise<PermanentJourneyPlan[]> {
    return await db.select().from(permanentJourneyPlans)
      .where(eq(permanentJourneyPlans.userId, userId))
      .orderBy(desc(permanentJourneyPlans.planDate));
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
  // DEALER OPERATIONS
  // ========================================

  async getDealer(id: string): Promise<Dealer | undefined> {
    const [dealer] = await db.select().from(dealers).where(eq(dealers.id, id));
    return dealer || undefined;
  }

  async getDealersByUserId(userId: number): Promise<Dealer[]> {
    return await db.select().from(dealers)
      .where(eq(dealers.userId, userId))
      .orderBy(asc(dealers.name));
  }

  async getDealersByRegion(region: string): Promise<Dealer[]> {
    return await db.select().from(dealers)
      .where(eq(dealers.region, region))
      .orderBy(asc(dealers.name));
  }

  async getDealersByArea(area: string): Promise<Dealer[]> {
    return await db.select().from(dealers)
      .where(eq(dealers.area, area))
      .orderBy(asc(dealers.name));
  }

  async getSubDealers(parentDealerId: string): Promise<Dealer[]> {
    return await db.select().from(dealers)
      .where(eq(dealers.parentDealerId, parentDealerId))
      .orderBy(asc(dealers.name));
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
  // SALESMAN ATTENDANCE OPERATIONS
  // ========================================

  async getSalesmanAttendance(id: string): Promise<SalesmanAttendance | undefined> {
    const [attendance] = await db.select().from(salesmanAttendance).where(eq(salesmanAttendance.id, id));
    return attendance || undefined;
  }

  async getSalesmanAttendanceByUserId(userId: number): Promise<SalesmanAttendance[]> {
    return await db.select().from(salesmanAttendance)
      .where(eq(salesmanAttendance.userId, userId))
      .orderBy(desc(salesmanAttendance.attendanceDate));
  }

  async getSalesmanAttendanceByDate(userId: number, date: Date): Promise<SalesmanAttendance | undefined> {
    const [attendance] = await db.select().from(salesmanAttendance)
      .where(and(
        eq(salesmanAttendance.userId, userId),
        eq(salesmanAttendance.attendanceDate, date.toISOString().split('T')[0])
      ));
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
  // SALESMAN LEAVE APPLICATION OPERATIONS
  // ========================================

  async getSalesmanLeaveApplication(id: string): Promise<SalesmanLeaveApplication | undefined> {
    const [application] = await db.select().from(salesmanLeaveApplications).where(eq(salesmanLeaveApplications.id, id));
    return application || undefined;
  }

  async getSalesmanLeaveApplicationsByUserId(userId: number): Promise<SalesmanLeaveApplication[]> {
    return await db.select().from(salesmanLeaveApplications)
      .where(eq(salesmanLeaveApplications.userId, userId))
      .orderBy(desc(salesmanLeaveApplications.createdAt));
  }

  async getSalesmanLeaveApplicationsByStatus(status: string): Promise<SalesmanLeaveApplication[]> {
    return await db.select().from(salesmanLeaveApplications)
      .where(eq(salesmanLeaveApplications.status, status))
      .orderBy(desc(salesmanLeaveApplications.createdAt));
  }

  async createSalesmanLeaveApplication(insertApplication: InsertSalesmanLeaveApplication): Promise<SalesmanLeaveApplication> {
    const [application] = await db.insert(salesmanLeaveApplications).values(insertApplication).returning();
    return application;
  }

  async updateSalesmanLeaveApplication(id: string, updates: Partial<InsertSalesmanLeaveApplication>): Promise<SalesmanLeaveApplication> {
    const [application] = await db.update(salesmanLeaveApplications).set({
      ...updates,
      updatedAt: new Date()
    }).where(eq(salesmanLeaveApplications.id, id)).returning();
    return application;
  }

  // ========================================
  // CLIENT REPORT OPERATIONS
  // ========================================

  async getClientReport(id: string): Promise<ClientReport | undefined> {
    const [report] = await db.select().from(clientReports).where(eq(clientReports.id, id));
    return report || undefined;
  }

  async getClientReportsByUserId(userId: number): Promise<ClientReport[]> {
    return await db.select().from(clientReports)
      .where(eq(clientReports.userId, userId))
      .orderBy(desc(clientReports.createdAt));
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
  // COMPETITION REPORT OPERATIONS
  // ========================================

  async getCompetitionReport(id: string): Promise<CompetitionReport | undefined> {
    const [report] = await db.select().from(competitionReports).where(eq(competitionReports.id, id));
    return report || undefined;
  }

  async getCompetitionReportsByUserId(userId: number): Promise<CompetitionReport[]> {
    return await db.select().from(competitionReports)
      .where(eq(competitionReports.userId, userId))
      .orderBy(desc(competitionReports.reportDate));
  }

  async getCompetitionReportsByDateRange(userId: number, startDate: Date, endDate: Date): Promise<CompetitionReport[]> {
    return await db.select().from(competitionReports)
      .where(and(
        eq(competitionReports.userId, userId),
        gte(competitionReports.reportDate, startDate.toISOString().split('T')[0]),
        lte(competitionReports.reportDate, endDate.toISOString().split('T')[0])
      ))
      .orderBy(desc(competitionReports.reportDate));
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
  // GEO TRACKING OPERATIONS
  // ========================================

  async getGeoTrackingRecords(userId: number, limit: number = 100): Promise<GeoTracking[]> {
    return await db.select().from(geoTracking)
      .where(eq(geoTracking.userId, userId))
      .orderBy(desc(geoTracking.recordedAt))
      .limit(limit);
  }

  async getGeoTrackingByDateRange(userId: number, startDate: Date, endDate: Date): Promise<GeoTracking[]> {
    return await db.select().from(geoTracking)
      .where(and(
        eq(geoTracking.userId, userId),
        gte(geoTracking.recordedAt, startDate),
        lte(geoTracking.recordedAt, endDate)
      ))
      .orderBy(desc(geoTracking.recordedAt));
  }

  async createGeoTrackingRecord(insertRecord: InsertGeoTracking): Promise<GeoTracking> {
    const [record] = await db.insert(geoTracking).values(insertRecord).returning();
    return record;
  }

  // ========================================
  // DAILY TASK OPERATIONS
  // ========================================

  async getDailyTask(id: string): Promise<DailyTask | undefined> {
    const [task] = await db.select().from(dailyTasks).where(eq(dailyTasks.id, id));
    return task || undefined;
  }

  async getDailyTasksByAssignedUserId(userId: number): Promise<DailyTask[]> {
    return await db.select().from(dailyTasks)
      .where(eq(dailyTasks.userId, userId))
      .orderBy(desc(dailyTasks.taskDate));
  }

  async getDailyTasksByCreatedUserId(userId: number): Promise<DailyTask[]> {
    return await db.select().from(dailyTasks)
      .where(eq(dailyTasks.assignedByUserId, userId))
      .orderBy(desc(dailyTasks.taskDate));
  }

  async getDailyTasksByStatus(status: string, companyId: number): Promise<DailyTask[]> {
    try {
      const results = await db
        .select({
          id: dailyTasks.id,
          createdAt: dailyTasks.createdAt,
          updatedAt: dailyTasks.updatedAt,
          status: dailyTasks.status,
          userId: dailyTasks.userId,
          visitType: dailyTasks.visitType,
          description: dailyTasks.description,
          siteName: dailyTasks.siteName,
          assignedByUserId: dailyTasks.assignedByUserId,
          taskDate: dailyTasks.taskDate,
          relatedDealerId: dailyTasks.relatedDealerId,
          pjpId: dailyTasks.pjpId
        })
        .from(dailyTasks)
        .innerJoin(users, eq(dailyTasks.userId, users.id))
        .where(
          and(
            eq(dailyTasks.status, status),
            eq(users.companyId, companyId)
          )
        )
        .orderBy(desc(dailyTasks.taskDate));

      return results;
    } catch (error) {
      console.error('Error getting tasks by status:', error);
      throw error;
    }
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

  async updateTaskStatus(taskId: string, status: string): Promise<DailyTask> {
    try {
      const [task] = await db
        .update(dailyTasks)
        .set({ 
          status,
          updatedAt: new Date()
        })
        .where(eq(dailyTasks.id, taskId))
        .returning();
      
      return task;
    } catch (error) {
      console.error('Error updating task status:', error);
      throw error;
    }
  }

  // ========================================
  // DEALER REPORTS AND SCORES OPERATIONS
  // ========================================

  async getDealerReportsAndScores(id: string): Promise<DealerReportsAndScores | undefined> {
    const [scores] = await db.select().from(dealerReportsAndScores).where(eq(dealerReportsAndScores.id, id));
    return scores || undefined;
  }

  async getDealerReportsAndScoresByDealerId(dealerId: string): Promise<DealerReportsAndScores | undefined> {
    const [scores] = await db.select().from(dealerReportsAndScores).where(eq(dealerReportsAndScores.dealerId, dealerId));
    return scores || undefined;
  }

  async createDealerReportsAndScores(insertScores: InsertDealerReportsAndScores): Promise<DealerReportsAndScores> {
    const [scores] = await db.insert(dealerReportsAndScores).values(insertScores).returning();
    return scores;
  }

  async updateDealerReportsAndScores(id: string, updates: Partial<InsertDealerReportsAndScores>): Promise<DealerReportsAndScores> {
    const [scores] = await db.update(dealerReportsAndScores).set({
      ...updates,
      updatedAt: new Date()
    }).where(eq(dealerReportsAndScores.id, id)).returning();
    return scores;
  }

  // ========================================
  // ENHANCED BUSINESS MANAGEMENT METHODS
  // ========================================

  // User Authentication for Salesman App
  async authenticateUser(salesmanLoginId: string, password: string): Promise<User | null> {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.salesmanLoginId, salesmanLoginId),
            eq(users.hashedPassword, password), // In production, use proper password hashing
            eq(users.status, "active")
          )
        )
        .limit(1);
      return user || null;
    } catch (error) {
      console.error('Error authenticating user:', error);
      throw error;
    }
  }

  // ========================================
  // ATTENDANCE ENHANCEMENT METHODS
  // ========================================

  async punchIn(userId: number, latitude: number, longitude: number, photoUrl?: string): Promise<SalesmanAttendance> {
    try {
      // Check if already punched in today
      const today = new Date().toISOString().split('T')[0];
      const [existingAttendance] = await db
        .select()
        .from(salesmanAttendance)
        .where(
          and(
            eq(salesmanAttendance.userId, userId),
            eq(salesmanAttendance.attendanceDate, today)
          )
        )
        .limit(1);

      if (existingAttendance && existingAttendance.inTimeTimestamp) {
        throw new Error('Already punched in today');
      }

      const attendanceRecord = await this.createSalesmanAttendance({
        userId,
        attendanceDate: today,
        locationName: "Field Location", // Can be enhanced with reverse geocoding
        inTimeTimestamp: new Date(),
        outTimeTimestamp: null,
        inTimeImageCaptured: !!photoUrl,
        outTimeImageCaptured: false,
        inTimeImageUrl: photoUrl,
        outTimeImageUrl: null,
        inTimeLatitude: latitude.toString(),
        inTimeLongitude: longitude.toString(),
        inTimeAccuracy: null,
        inTimeSpeed: null,
        inTimeHeading: null,
        inTimeAltitude: null,
        outTimeLatitude: null,
        outTimeLongitude: null,
        outTimeAccuracy: null,
        outTimeSpeed: null,
        outTimeHeading: null,
        outTimeAltitude: null,
      });

      return attendanceRecord;
    } catch (error) {
      console.error('Error punching in:', error);
      throw error;
    }
  }

  async punchOut(userId: number, latitude: number, longitude: number, photoUrl?: string): Promise<SalesmanAttendance> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const [attendanceRecord] = await db
        .select()
        .from(salesmanAttendance)
        .where(
          and(
            eq(salesmanAttendance.userId, userId),
            eq(salesmanAttendance.attendanceDate, today)
          )
        )
        .limit(1);

      if (!attendanceRecord || !attendanceRecord.inTimeTimestamp) {
        throw new Error('No punch in record found for today');
      }

      const [updatedRecord] = await db
        .update(salesmanAttendance)
        .set({
          outTimeTimestamp: new Date(),
          outTimeLatitude: latitude.toString(),
          outTimeLongitude: longitude.toString(),
          outTimeImageCaptured: !!photoUrl,
          outTimeImageUrl: photoUrl,
          updatedAt: new Date()
        })
        .where(eq(salesmanAttendance.id, attendanceRecord.id))
        .returning();

      return updatedRecord;
    } catch (error) {
      console.error('Error punching out:', error);
      throw error;
    }
  }

  // ========================================
  // LOCATION TRACKING METHODS
  // ========================================

  async trackLocation(userId: number, latitude: number, longitude: number): Promise<GeoTracking> {
    try {
      const locationRecord = await this.createGeoTrackingRecord({
        userId,
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        recordedAt: new Date(),
        accuracy: null,
        speed: null,
        heading: null,
        altitude: null,
        locationType: "GPS",
        activityType: null,
        appState: "foreground",
        batteryLevel: null,
        isCharging: null,
        networkStatus: null,
        ipAddress: null,
        siteName: null,
        checkInTime: null,
        checkOutTime: null,
        totalDistanceTravelled: null,
      });

      return locationRecord;
    } catch (error) {
      console.error('Error tracking location:', error);
      throw error;
    }
  }

  async getLocationAnalytics(userId: number, period: string): Promise<any> {
    try {
      let dateFilter;
      const now = new Date();

      switch (period) {
        case 'today':
          dateFilter = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          dateFilter = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        default:
          dateFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }

      const locations = await db
        .select()
        .from(geoTracking)
        .where(
          and(
            eq(geoTracking.userId, userId),
            gte(geoTracking.recordedAt, dateFilter)
          )
        )
        .orderBy(desc(geoTracking.recordedAt));

      // Calculate analytics
      const totalDistance = locations.reduce((sum, loc, index) => {
        if (index === 0) return sum;
        const prev = locations[index - 1];
        return sum + this.calculateDistance(
          parseFloat(prev.latitude), 
          parseFloat(prev.longitude), 
          parseFloat(loc.latitude), 
          parseFloat(loc.longitude)
        );
      }, 0);

      return {
        period,
        totalLocations: locations.length,
        totalDistance,
        locations: locations.slice(0, 50), // Return latest 50 for performance
        averageAccuracy: locations.reduce((sum, loc) => sum + (parseFloat(loc.accuracy || "0")), 0) / locations.length
      };
    } catch (error) {
      console.error('Error getting location analytics:', error);
      throw error;
    }
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  // ========================================
  // ENHANCED REPORTING METHODS
  // ========================================

  async getBusinessMetrics(companyId: number): Promise<any> {
    try {
      // Get total users
      const totalUsers = await db
        .select({ count: sql`count(*)` })
        .from(users)
        .where(eq(users.companyId, companyId));

      // Get total daily visit reports
      const totalReports = await db
        .select({ count: sql`count(*)` })
        .from(dailyVisitReports)
        .innerJoin(users, eq(dailyVisitReports.userId, users.id))
        .where(eq(users.companyId, companyId));

      // Get active dealers
      const activeDealers = await db
        .select({ count: sql`count(*)` })
        .from(dealers)
        .innerJoin(users, eq(dealers.userId, users.id))
        .where(eq(users.companyId, companyId));

      // Get attendance records for current month
      const currentMonth = new Date();
      const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      
      const monthlyAttendance = await db
        .select({ count: sql`count(*)` })
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
  // TASK MANAGEMENT ENHANCEMENTS
  // ========================================

  async assignTaskToUser(taskData: InsertDailyTask): Promise<DailyTask> {
    try {
      const task = await this.createDailyTask(taskData);
      
      // You could add notification logic here
      console.log(`Task assigned to user ${taskData.userId} by user ${taskData.assignedByUserId}`);
      
      return task;
    } catch (error) {
      console.error('Error assigning task to user:', error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();