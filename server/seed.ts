import { db } from "./db";
import { 
  companies, 
  users, 
  dealers, 
  dailyVisitReports, 
  technicalVisitReports, 
  permanentJourneyPlans,
  salesmanAttendance,
  salesmanLeaveApplications,
  clientReports,
  competitionReports,
  geoTracking,
  dailyTasks,
  dealerReportsAndScores
} from "../shared/schema";

async function seedDatabase() {
  console.log("Initializing database...");

  // Clear existing data in correct order (respecting foreign key constraints)
  await db.delete(dealerReportsAndScores);
  await db.delete(dailyTasks);
  await db.delete(geoTracking);
  await db.delete(competitionReports);
  await db.delete(clientReports);
  await db.delete(salesmanLeaveApplications);
  await db.delete(salesmanAttendance);
  await db.delete(technicalVisitReports);
  await db.delete(dailyVisitReports);
  await db.delete(permanentJourneyPlans);
  await db.delete(dealers);
  await db.delete(users);
  await db.delete(companies);

  console.log("Database cleared successfully!");
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase().catch(console.error);
}

export { seedDatabase };