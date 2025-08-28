// seed.ts
// Purge-only seed compatible with current schema.ts and storage.ts.
// Deletes child tables -> parent tables in FK-safe order.
// No data is inserted. This is for dev/staging reset only.

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
  dealerReportsAndScores,
  salesReport,
  collectionReports,
  ddp,
  ratings,
  brands,
  dealerBrandMapping,
  masterConnectedTable,
} from "../shared/schema";

async function seedDatabase() {
  console.log("Initializing database reset...");

  // Delete children first, then parents. Self-refs are handled by deleting the table itself (no inserts anyway).
  await db.delete(competitionReports);
  await db.delete(dealerBrandMapping);
  await db.delete(dealerReportsAndScores);
  await db.delete(ratings);
  await db.delete(salesReport);
  await db.delete(collectionReports);
  await db.delete(salesmanLeaveApplications);
  await db.delete(salesmanAttendance);
  await db.delete(geoTracking);
  await db.delete(clientReports);
  await db.delete(dailyTasks);
  await db.delete(technicalVisitReports);
  await db.delete(masterConnectedTable);
  await db.delete(ddp);
  await db.delete(brands);
  await db.delete(dailyVisitReports);
  await db.delete(permanentJourneyPlans);
  await db.delete(dealers);
  await db.delete(users);
  await db.delete(companies);

  console.log("Database cleared successfully (no demo data inserted).");
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase().catch((err) => {
    console.error("Seed reset failed:", err);
    process.exit(1);
  });
}

export { seedDatabase };
