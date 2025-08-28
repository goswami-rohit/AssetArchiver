// schema.ts
import {
  pgTable, serial, integer, varchar, text, boolean, timestamp, date, numeric, uuid,
  uniqueIndex, index
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";

// ------------------------- companies -------------------------
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  officeAddress: text("office_address").notNull(),
  isHeadOffice: boolean("is_head_office").notNull().default(true),
  phoneNumber: varchar("phone_number", { length: 50 }).notNull(),
  region: text("region"),
  area: text("area"),
  adminUserId: varchar("admin_user_id", { length: 255 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 }).defaultNow(),
  workosOrganizationId: varchar("workos_organization_id", { length: 255 }).unique(),
}, (t) => [
  index("idx_admin_user_id").on(t.adminUserId),
]);

// ------------------------- users -------------------------
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  workosUserId: varchar("workos_user_id", { length: 255 }).unique(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "no action", onUpdate: "no action" }),
  email: text("email").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  role: text("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 }).defaultNow(),
  phoneNumber: varchar("phone_number", { length: 50 }),
  inviteToken: varchar("inviteToken", { length: 255 }).unique(),
  status: text("status").notNull().default("active"),
  region: text("region"),
  area: text("area"),
  salesmanLoginId: varchar("salesman_login_id", { length: 255 }).unique(),
  hashedPassword: text("hashed_password"),
  reportsToId: integer("reports_to_id").references(() => users.id, { onDelete: "set null" }),
}, (t) => [
  uniqueIndex("users_companyid_email_unique").on(t.companyId, t.email),
  index("idx_user_company_id").on(t.companyId),
  index("idx_workos_user_id").on(t.workosUserId),
]);

// ------------------------- daily_visit_reports -------------------------
export const dailyVisitReports = pgTable("daily_visit_reports", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reportDate: date("report_date").notNull(),
  dealerType: varchar("dealer_type", { length: 50 }).notNull(),
  dealerName: varchar("dealer_name", { length: 255 }),
  subDealerName: varchar("sub_dealer_name", { length: 255 }),
  location: varchar("location", { length: 500 }).notNull(),
  latitude: numeric("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: numeric("longitude", { precision: 10, scale: 7 }).notNull(),
  visitType: varchar("visit_type", { length: 50 }).notNull(),
  dealerTotalPotential: numeric("dealer_total_potential", { precision: 10, scale: 2 }).notNull(),
  dealerBestPotential: numeric("dealer_best_potential", { precision: 10, scale: 2 }).notNull(),
  brandSelling: text("brand_selling").array().notNull(),
  contactPerson: varchar("contact_person", { length: 255 }),
  contactPersonPhoneNo: varchar("contact_person_phone_no", { length: 20 }),
  todayOrderMt: numeric("today_order_mt", { precision: 10, scale: 2 }).notNull(),
  todayCollectionRupees: numeric("today_collection_rupees", { precision: 10, scale: 2 }).notNull(),
  overdueAmount: numeric("overdue_amount", { precision: 12, scale: 2 }),
  feedbacks: varchar("feedbacks", { length: 500 }).notNull(),
  solutionBySalesperson: varchar("solution_by_salesperson", { length: 500 }),
  anyRemarks: varchar("any_remarks", { length: 500 }),
  checkInTime: timestamp("check_in_time", { withTimezone: true, precision: 6 }).notNull(),
  checkOutTime: timestamp("check_out_time", { withTimezone: true, precision: 6 }),
  inTimeImageUrl: varchar("in_time_image_url", { length: 500 }),
  outTimeImageUrl: varchar("out_time_image_url", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 }).defaultNow().notNull(),
}, (t) => [
  index("idx_daily_visit_reports_user_id").on(t.userId),
]);

// ------------------------- technical_visit_reports -------------------------
export const technicalVisitReports = pgTable("technical_visit_reports", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reportDate: date("report_date").notNull(),
  visitType: varchar("visit_type", { length: 50 }).notNull(),
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
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  siteVisitBrandInUse: text("site_visit_brand_in_use"),
  siteVisitStage: text("site_visit_stage"),
  conversionFromBrand: text("conversion_from_brand"),
  conversionQuantityValue: numeric("conversion_quantity_value", { precision: 10, scale: 2 }),
  conversionQuantityUnit: varchar("conversion_quantity_unit", { length: 20 }),
  associatedPartyName: text("associated_party_name"),
  influencerType: text("influencer_type"),
  serviceType: text("service_type"),
  qualityComplaint: text("quality_complaint"),
  promotionalActivity: text("promotional_activity"),
  channelPartnerVisit: text("channel_partner_visit"),
}, (t) => [
  index("idx_technical_visit_reports_user_id").on(t.userId),
]);

// ------------------------- permanent_journey_plans -------------------------
export const permanentJourneyPlans = pgTable("permanent_journey_plans", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: integer("user_id").notNull().references(() => users.id),
  createdById: integer("created_by_id").notNull().references(() => users.id),
  planDate: date("plan_date").notNull(),
  areaToBeVisited: varchar("area_to_be_visited", { length: 500 }).notNull(),
  description: varchar("description", { length: 500 }),
  status: varchar("status", { length: 50 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 }).defaultNow().notNull(),
}, (t) => [
  index("idx_permanent_journey_plans_user_id").on(t.userId),
  index("idx_permanent_journey_plans_created_by_id").on(t.createdById),
]);

// ------------------------- dealers -------------------------
export const dealers = pgTable("dealers", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull(),
  parentDealerId: varchar("parent_dealer_id", { length: 255 }).references(() => dealers.id, { onDelete: "set null" }),
  name: varchar("name", { length: 255 }).notNull(),
  region: varchar("region", { length: 100 }).notNull(),
  area: varchar("area", { length: 255 }).notNull(),
  phoneNo: varchar("phone_no", { length: 20 }).notNull(),
  address: varchar("address", { length: 500 }).notNull(),
  totalPotential: numeric("total_potential", { precision: 10, scale: 2 }).notNull(),
  bestPotential: numeric("best_potential", { precision: 10, scale: 2 }).notNull(),
  brandSelling: text("brand_selling").array().notNull(),
  feedbacks: varchar("feedbacks", { length: 500 }).notNull(),
  remarks: varchar("remarks", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 }).defaultNow().notNull(),
}, (t) => [
  index("idx_dealers_user_id").on(t.userId),
  index("idx_dealers_parent_dealer_id").on(t.parentDealerId),
]);

// ------------------------- salesman_attendance -------------------------
export const salesmanAttendance = pgTable("salesman_attendance", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  attendanceDate: date("attendance_date").notNull(),
  locationName: varchar("location_name", { length: 500 }).notNull(),
  inTimeTimestamp: timestamp("in_time_timestamp", { withTimezone: true, precision: 6 }).notNull(),
  outTimeTimestamp: timestamp("out_time_timestamp", { withTimezone: true, precision: 6 }),
  inTimeImageCaptured: boolean("in_time_image_captured").notNull(),
  outTimeImageCaptured: boolean("out_time_image_captured").notNull(),
  inTimeImageUrl: varchar("in_time_image_url", { length: 500 }),
  outTimeImageUrl: varchar("out_time_image_url", { length: 500 }),
  inTimeLatitude: numeric("in_time_latitude", { precision: 10, scale: 7 }).notNull(),
  inTimeLongitude: numeric("in_time_longitude", { precision: 10, scale: 7 }).notNull(),
  inTimeAccuracy: numeric("in_time_accuracy", { precision: 10, scale: 2 }),
  inTimeSpeed: numeric("in_time_speed", { precision: 10, scale: 2 }),
  inTimeHeading: numeric("in_time_heading", { precision: 10, scale: 2 }),
  inTimeAltitude: numeric("in_time_altitude", { precision: 10, scale: 2 }),
  outTimeLatitude: numeric("out_time_latitude", { precision: 10, scale: 7 }),
  outTimeLongitude: numeric("out_time_longitude", { precision: 10, scale: 7 }),
  outTimeAccuracy: numeric("out_time_accuracy", { precision: 10, scale: 2 }),
  outTimeSpeed: numeric("out_time_speed", { precision: 10, scale: 2 }),
  outTimeHeading: numeric("out_time_heading", { precision: 10, scale: 2 }),
  outTimeAltitude: numeric("out_time_altitude", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 }).defaultNow().notNull(),
}, (t) => [
  index("idx_salesman_attendance_user_id").on(t.userId),
]);

// ------------------------- salesman_leave_applications -------------------------
export const salesmanLeaveApplications = pgTable("salesman_leave_applications", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  leaveType: varchar("leave_type", { length: 100 }).notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  reason: varchar("reason", { length: 500 }).notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  adminRemarks: varchar("admin_remarks", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 }).defaultNow().notNull(),
}, (t) => [
  index("idx_salesman_leave_applications_user_id").on(t.userId),
]);

// ------------------------- client_reports -------------------------
export const clientReports = pgTable("client_reports", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`substr(replace(cast(gen_random_uuid() as text),'-',''),1,25)`),
  dealerType: text("dealerType").notNull(),
  dealerSubDealerName: text("dealer_sub_dealer_name").notNull(),
  location: text("location").notNull(),
  typeBestNonBest: text("type_best_non_best").notNull(),
  dealerTotalPotential: numeric("dealer_total_potential", { precision: 10, scale: 2 }).notNull(),
  dealerBestPotential: numeric("dealer_best_potential", { precision: 10, scale: 2 }).notNull(),
  brandSelling: text("brandSelling").array().notNull(),
  contactPerson: text("contactPerson").notNull(),
  contactPersonPhoneNo: text("contact_person_phone_no").notNull(),
  todayOrderMT: numeric("today_order_mt", { precision: 10, scale: 2 }).notNull(),
  todayCollection: numeric("today_collection_rupees", { precision: 10, scale: 2 }).notNull(),
  feedbacks: text("feedbacks").notNull(),
  solutionsAsPerSalesperson: text("solutions_as_per_salesperson").notNull(),
  anyRemarks: text("anyRemarks").notNull(),
  checkOutTime: timestamp("check_out_time", { withTimezone: true, precision: 6 }).notNull(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

// ------------------------- competition_reports -------------------------
export const competitionReports = pgTable("competition_reports", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`substr(replace(cast(gen_random_uuid() as text),'-',''),1,25)`),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reportDate: date("report_date").notNull(),
  brandName: varchar("brand_name", { length: 255 }).notNull(),
  billing: varchar("billing", { length: 100 }).notNull(),
  nod: varchar("nod", { length: 100 }).notNull(),
  retail: varchar("retail", { length: 100 }).notNull(),
  schemesYesNo: varchar("schemes_yes_no", { length: 10 }).notNull(),
  avgSchemeCost: numeric("avg_scheme_cost", { precision: 10, scale: 2 }).notNull(),
  remarks: varchar("remarks", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 }).defaultNow().notNull(),
}, (t) => [
  index("competition_reports_user_idx").on(t.userId),
]);

// ------------------------- geo_tracking -------------------------
export const geoTracking = pgTable("geo_tracking", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  latitude: numeric("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: numeric("longitude", { precision: 10, scale: 7 }).notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  accuracy: numeric("accuracy", { precision: 10, scale: 2 }),
  speed: numeric("speed", { precision: 10, scale: 2 }),
  heading: numeric("heading", { precision: 10, scale: 2 }),
  altitude: numeric("altitude", { precision: 10, scale: 2 }),
  locationType: varchar("location_type", { length: 50 }),
  activityType: varchar("activity_type", { length: 50 }),
  appState: varchar("app_state", { length: 50 }),
  batteryLevel: numeric("battery_level", { precision: 5, scale: 2 }),
  isCharging: boolean("is_charging"),
  networkStatus: varchar("network_status", { length: 50 }),
  ipAddress: varchar("ip_address", { length: 45 }),
  siteName: varchar("site_name", { length: 255 }),
  checkInTime: timestamp("check_in_time", { withTimezone: true, precision: 6 }),
  checkOutTime: timestamp("check_out_time", { withTimezone: true, precision: 6 }),
  totalDistanceTravelled: numeric("total_distance_travelled", { precision: 10, scale: 3 }),
  journeyId: varchar("journey_id", { length: 255 }),
  isActive: boolean("is_active").notNull().default(true),
  destLat: numeric("dest_lat", { precision: 10, scale: 7 }),
  destLng: numeric("dest_lng", { precision: 10, scale: 7 }),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 }).defaultNow().notNull(),
}, (t) => [
  index("idx_geo_user_time").on(t.userId, t.recordedAt),
  index("idx_geo_journey_time").on(t.journeyId, t.recordedAt),
  index("idx_geo_active").on(t.isActive),
  index("idx_geo_tracking_user_id").on(t.userId),
  index("idx_geo_tracking_recorded_at").on(t.recordedAt),
]);

// ------------------------- daily_tasks -------------------------
export const dailyTasks = pgTable("daily_tasks", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  assignedByUserId: integer("assigned_by_user_id").notNull().references(() => users.id, { onDelete: "no action" }),
  taskDate: date("task_date").notNull(),
  visitType: varchar("visit_type", { length: 50 }).notNull(),
  relatedDealerId: varchar("related_dealer_id", { length: 255 }).references(() => dealers.id, { onDelete: "set null" }),
  siteName: varchar("site_name", { length: 255 }),
  description: varchar("description", { length: 500 }),
  status: varchar("status", { length: 50 }).notNull().default("Assigned"),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  pjpId: varchar("pjp_id", { length: 255 }).references(() => permanentJourneyPlans.id, { onDelete: "set null" }),
}, (t) => [
  index("idx_daily_tasks_user_id").on(t.userId),
  index("idx_daily_tasks_assigned_by_user_id").on(t.assignedByUserId),
  index("idx_daily_tasks_task_date").on(t.taskDate),
  index("idx_daily_tasks_pjp_id").on(t.pjpId),
  index("idx_daily_tasks_related_dealer_id").on(t.relatedDealerId),
  index("idx_daily_tasks_date_user").on(t.taskDate, t.userId),
  index("idx_daily_tasks_status").on(t.status),
]);

// ------------------------- dealer_reports_and_scores -------------------------
export const dealerReportsAndScores = pgTable("dealer_reports_and_scores", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`substr(replace(cast(gen_random_uuid() as text),'-',''),1,25)`),
  dealerId: varchar("dealer_id", { length: 255 }).notNull().unique().references(() => dealers.id),
  dealerScore: numeric("dealer_score", { precision: 10, scale: 2 }).notNull(),
  trustWorthinessScore: numeric("trust_worthiness_score", { precision: 10, scale: 2 }).notNull(),
  creditWorthinessScore: numeric("credit_worthiness_score", { precision: 10, scale: 2 }).notNull(),
  orderHistoryScore: numeric("order_history_score", { precision: 10, scale: 2 }).notNull(),
  visitFrequencyScore: numeric("visit_frequency_score", { precision: 10, scale: 2 }).notNull(),
  lastUpdatedDate: timestamp("last_updated_date", { withTimezone: true, precision: 6 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 }).defaultNow().notNull(),
});

// ------------------------- sales_report -------------------------
export const salesReport = pgTable("sales_report", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  monthlyTarget: numeric("monthly_target", { precision: 12, scale: 2 }).notNull(),
  tillDateAchievement: numeric("till_date_achievement", { precision: 12, scale: 2 }).notNull(),
  yesterdayTarget: numeric("yesterday_target", { precision: 12, scale: 2 }),
  yesterdayAchievement: numeric("yesterday_achievement", { precision: 12, scale: 2 }),
  salesPersonId: integer("sales_person_id").notNull().references(() => users.id),
  dealerId: varchar("dealer_id", { length: 255 }).notNull().references(() => dealers.id),
});

// ------------------------- collection_reports -------------------------
export const collectionReports = pgTable("collection_reports", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  dvrId: varchar("dvr_id", { length: 255 }).notNull().unique().references(() => dailyVisitReports.id, { onDelete: "cascade" }),
  dealerId: varchar("dealer_id", { length: 255 }).notNull().references(() => dealers.id, { onDelete: "cascade" }),
  collectedAmount: numeric("collected_amount", { precision: 12, scale: 2 }).notNull(),
  collectedOnDate: date("collected_on_date").notNull(),
  weeklyTarget: numeric("weekly_target", { precision: 12, scale: 2 }),
  tillDateAchievement: numeric("till_date_achievement", { precision: 12, scale: 2 }),
  yesterdayTarget: numeric("yesterday_target", { precision: 12, scale: 2 }),
  yesterdayAchievement: numeric("yesterday_achievement", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 }).defaultNow(),
}, (t) => [
  index("idx_collection_reports_dealer_id").on(t.dealerId),
]);

// ------------------------- dealer_development_process -------------------------
export const ddp = pgTable("dealer_development_process", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  dealerId: varchar("dealer_id", { length: 255 }).notNull().references(() => dealers.id),
  creationDate: date("creation_date").notNull(),
  status: text("status").notNull(),
  obstacle: text("obstacle"),
});

// ------------------------- ratings -------------------------
export const ratings = pgTable("ratings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  area: text("area").notNull(),
  region: text("region").notNull(),
  rating: integer("rating").notNull(),
});

// ------------------------- brands -------------------------
export const brands = pgTable("brands", {
  id: serial("id").primaryKey(),
  name: varchar("brand_name", { length: 255 }).notNull().unique(),
});

// ------------------------- dealer_brand_mapping -------------------------
export const dealerBrandMapping = pgTable("dealer_brand_mapping", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`substr(replace(cast(gen_random_uuid() as text),'-',''),1,25)`),
  dealerId: varchar("dealer_id", { length: 255 }).notNull().references(() => dealers.id),
  brandId: integer("brand_id").notNull().references(() => brands.id),
  capacityMT: numeric("capacity_mt", { precision: 12, scale: 2 }).notNull(),
}, (t) => [
  uniqueIndex("dealer_brand_mapping_dealer_id_brand_id_unique").on(t.dealerId, t.brandId),
]);

// ------------------------- master_connected_table -------------------------
export const masterConnectedTable = pgTable("master_connected_table", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: integer("companyId"),
  userId: integer("userId"),
  dealerId: varchar("dealerId", { length: 255 }),
  dvrId: varchar("dvrId", { length: 255 }),
  tvrId: varchar("tvrId", { length: 255 }),
  permanentJourneyPlanId: varchar("permanentJourneyPlanId", { length: 255 }),
  permanentJourneyPlanCreatedById: integer("permanentJourneyPlanCreatedById"),
  dailyTaskId: varchar("dailyTaskId", { length: 255 }),
  attendanceId: varchar("attendanceId", { length: 255 }),
  leaveApplicationId: varchar("leaveApplicationId", { length: 255 }),
  clientReportId: varchar("clientReportId", { length: 255 }),
  competitionReportId: varchar("competitionReportId", { length: 255 }),
  geoTrackingId: varchar("geoTrackingId", { length: 255 }),
  dealerReportsAndScoresId: varchar("dealerReportsAndScoresId", { length: 255 }),
  salesReportId: integer("salesReportId"),
  collectionReportId: varchar("collectionReportId", { length: 255 }),
  ddpId: integer("ddpId"),
  ratingId: integer("ratingId"),
  brandId: integer("brandId"),
  dealerBrandMappingId: varchar("dealerBrandMappingId", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 }).defaultNow().notNull(),
}, (t) => [
  index("idx_mct_company_id").on(t.companyId),
  index("idx_mct_user_id").on(t.userId),
  index("idx_mct_dealer_id").on(t.dealerId),
  index("idx_mct_pjp_id").on(t.permanentJourneyPlanId),
  index("idx_mct_pjp_created_by_id").on(t.permanentJourneyPlanCreatedById),
  index("idx_mct_dailytask_id").on(t.dailyTaskId),
  index("idx_mct_dvr_id").on(t.dvrId),
  index("idx_mct_tvr_id").on(t.tvrId),
  index("idx_mct_attendance_id").on(t.attendanceId),
  index("idx_mct_leave_id").on(t.leaveApplicationId),
  index("idx_mct_client_report_id").on(t.clientReportId),
  index("idx_mct_comp_report_id").on(t.competitionReportId),
  index("idx_mct_geotracking_id").on(t.geoTrackingId),
  index("idx_mct_dealer_scores_id").on(t.dealerReportsAndScoresId),
  index("idx_mct_sales_report_id").on(t.salesReportId),
  index("idx_mct_collection_report_id").on(t.collectionReportId),
  index("idx_mct_ddp_id").on(t.ddpId),
  index("idx_mct_rating_id").on(t.ratingId),
  index("idx_mct_brand_id").on(t.brandId),
  index("idx_mct_dealer_brand_map_id").on(t.dealerBrandMappingId),
]);

// Generate and export insert schemas
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
export const insertDealerReportsAndScoresSchema = createInsertSchema(dealerReportsAndScores);
export const insertSalesReportSchema = createInsertSchema(salesReport);
export const insertCollectionReportSchema = createInsertSchema(collectionReports);
export const insertDdpSchema = createInsertSchema(ddp);
export const insertRatingSchema = createInsertSchema(ratings);
export const insertBrandSchema = createInsertSchema(brands);
export const insertDealerBrandMappingSchema = createInsertSchema(dealerBrandMapping);
export const insertMasterConnectedTableSchema = createInsertSchema(masterConnectedTable);