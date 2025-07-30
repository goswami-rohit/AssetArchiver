import { pgTable, text, serial, varchar, integer, boolean, date, real, timestamp, decimal, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Companies table
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  officeAddress: text("office_address").notNull(),
  isHeadOffice: boolean("is_head_office").default(true).notNull(),
  phoneNumber: varchar("phone_number", { length: 50 }).notNull(),
  adminUserId: text("admin_user_id").unique().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 }).defaultNow().$onUpdate(() => new Date()),
  workosOrganizationId: text("workos_organization_id").unique(),
});

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  workosUserId: text("workos_user_id").unique().notNull(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "no action", onUpdate: "no action" }),
  email: text("email").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  role: text("role").notNull(), // "admin", "manager", "staff" (for salesmen)
  createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 }).defaultNow().$onUpdate(() => new Date()),
  phoneNumber: varchar("phone_number", { length: 50 }),
  inviteToken: text("invite_token").unique(),
  status: text("status").default("active").notNull(), // "pending", "active", "inactive"
  salesmanLoginId: text("salesman_login_id").unique(),
  hashedPassword: text("hashed_password"),
});

// Daily Visit Reports table
export const dailyVisitReports = pgTable("daily_visit_reports", {
  id: varchar("id", { length: 255 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reportDate: date("report_date").notNull(),
  dealerType: varchar("dealer_type", { length: 50 }).notNull(), // "Dealer", "Sub Dealer"
  dealerName: varchar("dealer_name", { length: 255 }),
  subDealerName: varchar("sub_dealer_name", { length: 255 }),
  location: varchar("location", { length: 500 }).notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
  visitType: varchar("visit_type", { length: 50 }).notNull(), // "Best", "Non Best"
  dealerTotalPotential: decimal("dealer_total_potential", { precision: 10, scale: 2 }).notNull(),
  dealerBestPotential: decimal("dealer_best_potential", { precision: 10, scale: 2 }).notNull(),
  brandSelling: text("brand_selling").array().notNull(),
  contactPerson: varchar("contact_person", { length: 255 }),
  contactPersonPhoneNo: varchar("contact_person_phone_no", { length: 20 }),
  todayOrderMt: decimal("today_order_mt", { precision: 10, scale: 2 }).notNull(),
  todayCollectionRupees: decimal("today_collection_rupees", { precision: 10, scale: 2 }).notNull(),
  feedbacks: varchar("feedbacks", { length: 500 }).notNull(),
  solutionBySalesperson: varchar("solution_by_salesperson", { length: 500 }),
  anyRemarks: varchar("any_remarks", { length: 500 }),
  checkInTime: timestamp("check_in_time", { withTimezone: true, precision: 6 }).notNull(),
  checkOutTime: timestamp("check_out_time", { withTimezone: true, precision: 6 }),
  inTimeImageUrl: varchar("in_time_image_url", { length: 500 }),
  outTimeImageUrl: varchar("out_time_image_url", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

// Technical Visit Reports table
export const technicalVisitReports = pgTable("technical_visit_reports", {
  id: varchar("id", { length: 255 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reportDate: date("report_date").notNull(),
  visitType: varchar("visit_type", { length: 50 }).notNull(), // "Installation", "Repair", "Maintenance"
  siteNameConcernedPerson: varchar("site_name_concerned_person", { length: 255 }).notNull(),
  phoneNo: varchar("phone_no", { length: 20 }).notNull(),
  emailId: varchar("email_id", { length: 255 }),
  clientsRemarks: varchar("clients_remarks", { length: 500 }).notNull(),
  salespersonRemarks: varchar("salesperson_remarks", { length: 500 }).notNull(),
  checkInTime: timestamp("check_in_time", { withTimezone: true, precision: 6 }).notNull(),
  checkOutTime: timestamp("check_out_time", { withTimezone: true, precision: 6 }),
  inTimeImageUrl: varchar("in_time_image_url", { length: 500 }),
  outTimeImageUrl: varchar("out_time_image_url", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

// Permanent Journey Plans table
export const permanentJourneyPlans = pgTable("permanent_journey_plans", {
  id: varchar("id", { length: 255 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  planDate: date("plan_date").notNull(),
  areaToBeVisited: varchar("area_to_be_visited", { length: 500 }).notNull(),
  description: varchar("description", { length: 500 }),
  status: varchar("status", { length: 50 }).notNull(), // "Planned", "Visited", "Not Visited", etc.
  createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

// Dealers table (Consolidated for Dealers and Sub-Dealers)
export const dealers = pgTable("dealers", {
  id: varchar("id", { length: 255 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull(), // "Dealer", "Sub Dealer"
  parentDealerId: varchar("parent_dealer_id", { length: 255 }).references(() => dealers.id, { onDelete: "set null" }),
  name: varchar("name", { length: 255 }).notNull(),
  region: varchar("region", { length: 100 }).notNull(),
  area: varchar("area", { length: 255 }).notNull(),
  phoneNo: varchar("phone_no", { length: 20 }).notNull(),
  address: varchar("address", { length: 500 }).notNull(),
  totalPotential: decimal("total_potential", { precision: 10, scale: 2 }).notNull(),
  bestPotential: decimal("best_potential", { precision: 10, scale: 2 }).notNull(),
  brandSelling: text("brand_selling").array().notNull(),
  feedbacks: varchar("feedbacks", { length: 500 }).notNull(),
  remarks: varchar("remarks", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

// Salesman Attendance table
export const salesmanAttendance = pgTable("salesman_attendance", {
  id: varchar("id", { length: 255 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  attendanceDate: date("attendance_date").notNull(),
  locationName: varchar("location_name", { length: 500 }).notNull(),
  inTimeTimestamp: timestamp("in_time_timestamp", { withTimezone: true, precision: 6 }).notNull(),
  outTimeTimestamp: timestamp("out_time_timestamp", { withTimezone: true, precision: 6 }),
  inTimeImageCaptured: boolean("in_time_image_captured").notNull(),
  outTimeImageCaptured: boolean("out_time_image_captured").notNull(),
  inTimeImageUrl: varchar("in_time_image_url", { length: 500 }),
  outTimeImageUrl: varchar("out_time_image_url", { length: 500 }),
  inTimeLatitude: decimal("in_time_latitude", { precision: 10, scale: 7 }).notNull(),
  inTimeLongitude: decimal("in_time_longitude", { precision: 10, scale: 7 }).notNull(),
  inTimeAccuracy: decimal("in_time_accuracy", { precision: 10, scale: 2 }),
  inTimeSpeed: decimal("in_time_speed", { precision: 10, scale: 2 }),
  inTimeHeading: decimal("in_time_heading", { precision: 10, scale: 2 }),
  inTimeAltitude: decimal("in_time_altitude", { precision: 10, scale: 2 }),
  outTimeLatitude: decimal("out_time_latitude", { precision: 10, scale: 7 }),
  outTimeLongitude: decimal("out_time_longitude", { precision: 10, scale: 7 }),
  outTimeAccuracy: decimal("out_time_accuracy", { precision: 10, scale: 2 }),
  outTimeSpeed: decimal("out_time_speed", { precision: 10, scale: 2 }),
  outTimeHeading: decimal("out_time_heading", { precision: 10, scale: 2 }),
  outTimeAltitude: decimal("out_time_altitude", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

// Salesman Leave Applications table
export const salesmanLeaveApplications = pgTable("salesman_leave_applications", {
  id: varchar("id", { length: 255 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  leaveType: varchar("leave_type", { length: 100 }).notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  reason: varchar("reason", { length: 500 }).notNull(),
  status: varchar("status", { length: 50 }).notNull(), // "Pending", "Approved", "Rejected"
  adminRemarks: varchar("admin_remarks", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

// Client Report table
export const clientReports = pgTable("client_reports", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  dealerType: text("dealer_type").notNull(),
  dealerSubDealerName: text("dealer_sub_dealer_name").notNull(),
  location: text("location").notNull(),
  typeBestNonBest: text("type_best_non_best").notNull(),
  dealerTotalPotential: decimal("dealer_total_potential", { precision: 10, scale: 2 }).notNull(),
  dealerBestPotential: decimal("dealer_best_potential", { precision: 10, scale: 2 }).notNull(),
  brandSelling: text("brand_selling").array().notNull(),
  contactPerson: text("contact_person").notNull(),
  contactPersonPhoneNo: text("contact_person_phone_no").notNull(),
  todayOrderMT: decimal("today_order_mt", { precision: 10, scale: 2 }).notNull(),
  todayCollection: decimal("today_collection_rupees", { precision: 10, scale: 2 }).notNull(),
  feedbacks: text("feedbacks").notNull(),
  solutionsAsPerSalesperson: text("solutions_as_per_salesperson").notNull(),
  anyRemarks: text("any_remarks").notNull(),
  checkOutTime: timestamp("check_out_time", { withTimezone: true, precision: 6 }).notNull(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

// Competition Report table
export const competitionReports = pgTable("competition_reports", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reportDate: date("report_date").notNull(),
  brandName: varchar("brand_name", { length: 255 }).notNull(),
  billing: varchar("billing", { length: 100 }).notNull(),
  nod: varchar("nod", { length: 100 }).notNull(),
  retail: varchar("retail", { length: 100 }).notNull(),
  schemesYesNo: varchar("schemes_yes_no", { length: 10 }).notNull(), // "Yes" or "No"
  avgSchemeCost: decimal("avg_scheme_cost", { precision: 10, scale: 2 }).notNull(),
  remarks: varchar("remarks", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

// Geo Tracking table
export const geoTracking = pgTable("geo_tracking", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  accuracy: decimal("accuracy", { precision: 10, scale: 2 }),
  speed: decimal("speed", { precision: 10, scale: 2 }),
  heading: decimal("heading", { precision: 10, scale: 2 }),
  altitude: decimal("altitude", { precision: 10, scale: 2 }),
  locationType: varchar("location_type", { length: 50 }),
  activityType: varchar("activity_type", { length: 50 }),
  appState: varchar("app_state", { length: 50 }),
  batteryLevel: decimal("battery_level", { precision: 5, scale: 2 }),
  isCharging: boolean("is_charging"),
  networkStatus: varchar("network_status", { length: 50 }),
  ipAddress: varchar("ip_address", { length: 45 }),
  siteName: varchar("site_name", { length: 255 }),
  checkInTime: timestamp("check_in_time", { withTimezone: true, precision: 6 }),
  checkOutTime: timestamp("check_out_time", { withTimezone: true, precision: 6 }),
  totalDistanceTravelled: decimal("total_distance_travelled", { precision: 10, scale: 3 }),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

// Daily Tasks table
export const dailyTasks = pgTable("daily_tasks", {
  id: varchar("id", { length: 255 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  assignedByUserId: integer("assigned_by_user_id").notNull().references(() => users.id, { onDelete: "no action" }),
  taskDate: date("task_date").notNull(),
  visitType: varchar("visit_type", { length: 50 }).notNull(), // "Client Visit", "Technical Visit"
  relatedDealerId: varchar("related_dealer_id", { length: 255 }).references(() => dealers.id, { onDelete: "set null" }),
  siteName: varchar("site_name", { length: 255 }),
  description: varchar("description", { length: 500 }),
  status: varchar("status", { length: 50 }).default("Assigned").notNull(), // "Assigned", "Accepted", "Completed", "Rejected", "In Progress"
  createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 }).defaultNow().$onUpdate(() => new Date()).notNull(),
  pjpId: varchar("pjp_id", { length: 255 }).references(() => permanentJourneyPlans.id, { onDelete: "set null" }),
});

// Relations
export const companiesRelations = relations(companies, ({ many }) => ({
  users: many(users),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  company: one(companies, {
    fields: [users.companyId],
    references: [companies.id],
  }),
  dailyVisitReports: many(dailyVisitReports),
  technicalVisitReports: many(technicalVisitReports),
  permanentJourneyPlans: many(permanentJourneyPlans),
  dealers: many(dealers),
  salesmanAttendance: many(salesmanAttendance),
  salesmanLeaveApplications: many(salesmanLeaveApplications),
  clientReports: many(clientReports),
  competitionReports: many(competitionReports),
  geoTrackingRecords: many(geoTracking),
  assignedTasks: many(dailyTasks, { relationName: "AssignedTasks" }),
  createdTasks: many(dailyTasks, { relationName: "CreatedTasks" }),
}));

export const dailyVisitReportsRelations = relations(dailyVisitReports, ({ one }) => ({
  user: one(users, {
    fields: [dailyVisitReports.userId],
    references: [users.id],
  }),
}));

export const technicalVisitReportsRelations = relations(technicalVisitReports, ({ one }) => ({
  user: one(users, {
    fields: [technicalVisitReports.userId],
    references: [users.id],
  }),
}));

export const permanentJourneyPlansRelations = relations(permanentJourneyPlans, ({ one, many }) => ({
  user: one(users, {
    fields: [permanentJourneyPlans.userId],
    references: [users.id],
  }),
  dailyTasks: many(dailyTasks, { relationName: "PJPTasks" }),
}));

export const dealersRelations = relations(dealers, ({ one, many }) => ({
  user: one(users, {
    fields: [dealers.userId],
    references: [users.id],
  }),
  parentDealer: one(dealers, {
    fields: [dealers.parentDealerId],
    references: [dealers.id],
    relationName: "SubDealers",
  }),
  subDealers: many(dealers, { relationName: "SubDealers" }),
  dailyTasks: many(dailyTasks, { relationName: "DealerDailyTasks" }),
}));

export const salesmanAttendanceRelations = relations(salesmanAttendance, ({ one }) => ({
  user: one(users, {
    fields: [salesmanAttendance.userId],
    references: [users.id],
  }),
}));

export const salesmanLeaveApplicationsRelations = relations(salesmanLeaveApplications, ({ one }) => ({
  user: one(users, {
    fields: [salesmanLeaveApplications.userId],
    references: [users.id],
  }),
}));

export const clientReportsRelations = relations(clientReports, ({ one }) => ({
  user: one(users, {
    fields: [clientReports.userId],
    references: [users.id],
  }),
}));

export const competitionReportsRelations = relations(competitionReports, ({ one }) => ({
  user: one(users, {
    fields: [competitionReports.userId],
    references: [users.id],
  }),
}));

export const geoTrackingRelations = relations(geoTracking, ({ one }) => ({
  user: one(users, {
    fields: [geoTracking.userId],
    references: [users.id],
  }),
}));

export const dailyTasksRelations = relations(dailyTasks, ({ one }) => ({
  user: one(users, {
    fields: [dailyTasks.userId],
    references: [users.id],
    relationName: "AssignedTasks",
  }),
  assignedBy: one(users, {
    fields: [dailyTasks.assignedByUserId],
    references: [users.id],
    relationName: "CreatedTasks",
  }),
  relatedDealer: one(dealers, {
    fields: [dailyTasks.relatedDealerId],
    references: [dealers.id],
    relationName: "DealerDailyTasks",
  }),
  permanentJourneyPlan: one(permanentJourneyPlans, {
    fields: [dailyTasks.pjpId],
    references: [permanentJourneyPlans.id],
    relationName: "PJPTasks",
  }),
}));

// Insert schemas for type safety
export const insertCompanySchema = createInsertSchema(companies);
export const insertUserSchema = createInsertSchema(users);
export const insertDailyVisitReportSchema = createInsertSchema(dailyVisitReports);
export const insertTechnicalVisitReportSchema = createInsertSchema(technicalVisitReports);
export const insertPermanentJourneyPlanSchema = createInsertSchema(permanentJourneyPlans);
export const insertDealerSchema = createInsertSchema(dealers);
export const insertSalesmanAttendanceSchema = createInsertSchema(salesmanAttendance);
export const insertSalesmanLeaveApplicationSchema = createInsertSchema(salesmanLeaveApplications);
export const insertClientReportSchema = createInsertSchema(clientReports);
export const insertCompetitionReportSchema = createInsertSchema(competitionReports);
export const insertGeoTrackingSchema = createInsertSchema(geoTracking);
export const insertDailyTaskSchema = createInsertSchema(dailyTasks);

// Export types
export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
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