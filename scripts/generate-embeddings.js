import { pipeline } from '@xenova/transformers';
import fs from "fs";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const endpoints = [
  // ==================== NEW AUTO-GENERATED CRUD ENDPOINTS ====================
  // // 1. Daily Visit Reports CRUD
  {
    id: 4,
    name: "Create Daily Visit Report",
    endpoint: "/api/dvr",
    method: "POST",
    description: "Create new daily visit reports with schema validation",
    fields: [
      "userId", "reportDate", "dealerType", "dealerName", "subDealerName", "location",
      "latitude", "longitude", "visitType", "dealerTotalPotential", "dealerBestPotential",
      "brandSelling", "contactPerson", "contactPersonPhoneNo", "todayOrderMt",
      "todayCollectionRupees", "feedbacks", "solutionBySalesperson", "anyRemarks",
      "checkInTime", "checkOutTime", "inTimeImageUrl", "outTimeImageUrl"
    ],
    requiredFields: ["userId", "dealerType", "location", "latitude", "longitude", "visitType"],
    searchTerms: "create daily visit report new dvr add visit report dealer visit form"
  },
  {
    id: 5,
    name: "Get Daily Visit Reports by User",
    endpoint: "/api/dvr/user/:userId",
    method: "GET",
    description: "Fetch daily visit reports for a specific user with date filtering",
    fields: ["userId", "startDate", "endDate", "limit"],
    requiredFields: ["userId"],
    searchTerms: "get daily visit reports user dvr list fetch my reports visit history"
  },
  {
    id: 6,
    name: "Get Daily Visit Report by ID",
    endpoint: "/api/dvr/:id",
    method: "GET",
    description: "Get specific daily visit report by ID",
    fields: ["id"],
    requiredFields: ["id"],
    searchTerms: "get daily visit report by id fetch specific dvr report details"
  },
  {
    id: 7,
    name: "Update Daily Visit Report",
    endpoint: "/api/dvr/:id",
    method: "PUT",
    description: "Update existing daily visit report",
    fields: ["id", "dealerName", "location", "feedbacks", "todayOrderMt", "todayCollectionRupees"],
    requiredFields: ["id"],
    searchTerms: "update daily visit report edit dvr modify visit report change"
  },
  {
    id: 8,
    name: "Delete Daily Visit Report",
    endpoint: "/api/dvr/:id",
    method: "DELETE",
    description: "Delete daily visit report by ID",
    fields: ["id"],
    requiredFields: ["id"],
    searchTerms: "delete daily visit report remove dvr cancel visit report"
  },

  // 2. Technical Visit Reports CRUD
  {
    id: 9,
    name: "Get Technical Visit Reports by User",
    endpoint: "/api/tvr/user/:userId",
    method: "GET",
    description: "Fetch technical visit reports for a specific user",
    fields: ["userId", "startDate", "endDate", "limit"],
    requiredFields: ["userId"],
    searchTerms: "get technical visit reports user tvr technical reports history"
  },
  {
    id: 10,
    name: "Update Technical Visit Report",
    endpoint: "/api/tvr/:id",
    method: "PUT",
    description: "Update existing technical visit report",
    fields: ["id", "siteNameConcernedPerson", "clientsRemarks", "salespersonRemarks"],
    requiredFields: ["id"],
    searchTerms: "update technical visit report edit tvr modify technical report"
  },
  {
    id: 11,
    name: "Delete Technical Visit Report",
    endpoint: "/api/tvr/:id",
    method: "DELETE",
    description: "Delete technical visit report by ID",
    fields: ["id"],
    requiredFields: ["id"],
    searchTerms: "delete technical visit report remove tvr cancel technical report"
  },

  // 3. Permanent Journey Plans CRUD
  {
    id: 12,
    name: "Create Permanent Journey Plan",
    endpoint: "/api/pjp",
    method: "POST",
    description: "Create new permanent journey plan for route planning",
    fields: ["userId", "planDate", "areaToBeVisited", "description", "status"],
    requiredFields: ["userId", "planDate", "areaToBeVisited", "status"],
    searchTerms: "create journey plan new pjp route plan area visit planning"
  },
  {
    id: 13,
    name: "Get Journey Plans by User",
    endpoint: "/api/pjp/user/:userId",
    method: "GET",
    description: "Fetch permanent journey plans for a specific user",
    fields: ["userId", "startDate", "endDate", "limit", "completed"],
    requiredFields: ["userId"],
    searchTerms: "get journey plans user pjp route plans my plans travel plans"
  },
  {
    id: 14,
    name: "Update Journey Plan",
    endpoint: "/api/pjp/:id",
    method: "PUT",
    description: "Update existing permanent journey plan",
    fields: ["id", "areaToBeVisited", "description", "status"],
    requiredFields: ["id"],
    searchTerms: "update journey plan edit pjp modify route plan change plan"
  },
  {
    id: 15,
    name: "Delete Journey Plan",
    endpoint: "/api/pjp/:id",
    method: "DELETE",
    description: "Delete permanent journey plan by ID",
    fields: ["id"],
    requiredFields: ["id"],
    searchTerms: "delete journey plan remove pjp cancel route plan"
  },

  // 4. Dealers CRUD
  {
    id: 16,
    name: "Create Dealer",
    endpoint: "/api/dealers",
    method: "POST",
    description: "Add new dealer to the system",
    fields: [
      "userId", "type", "parentDealerId", "name", "region", "area", "phoneNo",
      "address", "totalPotential", "bestPotential", "brandSelling", "feedbacks", "remarks"
    ],
    requiredFields: ["userId", "type", "name", "region", "area", "phoneNo", "address"],
    searchTerms: "create dealer add new dealer register dealer dealer management"
  },
  {
    id: 17,
    name: "Get Dealers by User",
    endpoint: "/api/dealers/user/:userId",
    method: "GET",
    description: "Fetch dealers for a specific user",
    fields: ["userId", "limit", "type", "region", "area"],
    requiredFields: ["userId"],
    searchTerms: "get dealers user my dealers fetch dealer list dealer management"
  },
  {
    id: 18,
    name: "Update Dealer",
    endpoint: "/api/dealers/:id",
    method: "PUT",
    description: "Update existing dealer information",
    fields: ["id", "name", "phoneNo", "address", "totalPotential", "bestPotential", "feedbacks"],
    requiredFields: ["id"],
    searchTerms: "update dealer edit dealer modify dealer information change dealer"
  },
  {
    id: 19,
    name: "Delete Dealer",
    endpoint: "/api/dealers/:id",
    method: "DELETE",
    description: "Delete dealer from system",
    fields: ["id"],
    requiredFields: ["id"],
    searchTerms: "delete dealer remove dealer cancel dealer registration"
  },

  // 5. Daily Tasks CRUD
  {
    id: 20,
    name: "Create Daily Task",
    endpoint: "/api/daily-tasks",
    method: "POST",
    description: "Create new daily task assignment",
    fields: [
      "userId", "assignedByUserId", "taskDate", "visitType", "relatedDealerId",
      "siteName", "description", "status", "pjpId"
    ],
    requiredFields: ["userId", "assignedByUserId", "taskDate", "visitType"],
    searchTerms: "create daily task assign task new task task management"
  },
  {
    id: 21,
    name: "Get Daily Tasks by User",
    endpoint: "/api/daily-tasks/user/:userId",
    method: "GET",
    description: "Fetch daily tasks for a specific user",
    fields: ["userId", "startDate", "endDate", "limit", "status"],
    requiredFields: ["userId"],
    searchTerms: "get daily tasks user my tasks fetch task list task management"
  },
  {
    id: 22,
    name: "Update Daily Task",
    endpoint: "/api/daily-tasks/:id",
    method: "PUT",
    description: "Update existing daily task",
    fields: ["id", "status", "description", "siteName"],
    requiredFields: ["id"],
    searchTerms: "update daily task edit task modify task change task status"
  },
  {
    id: 23,
    name: "Delete Daily Task",
    endpoint: "/api/daily-tasks/:id",
    method: "DELETE",
    description: "Delete daily task",
    fields: ["id"],
    requiredFields: ["id"],
    searchTerms: "delete daily task remove task cancel task"
  },

  // 6. Leave Applications CRUD
  {
    id: 24,
    name: "Create Leave Application",
    endpoint: "/api/leave-applications",
    method: "POST",
    description: "Submit new leave application",
    fields: ["userId", "leaveType", "startDate", "endDate", "reason", "status", "adminRemarks"],
    requiredFields: ["userId", "leaveType", "startDate", "endDate", "reason"],
    searchTerms: "create leave application apply leave new leave request leave management"
  },
  {
    id: 25,
    name: "Get Leave Applications by User",
    endpoint: "/api/leave-applications/user/:userId",
    method: "GET",
    description: "Fetch leave applications for a specific user",
    fields: ["userId", "startDate", "endDate", "limit", "status"],
    requiredFields: ["userId"],
    searchTerms: "get leave applications user my leaves fetch leave history leave status"
  },
  {
    id: 26,
    name: "Update Leave Application",
    endpoint: "/api/leave-applications/:id",
    method: "PUT",
    description: "Update existing leave application",
    fields: ["id", "status", "adminRemarks", "reason"],
    requiredFields: ["id"],
    searchTerms: "update leave application edit leave approve reject leave"
  },
  {
    id: 27,
    name: "Delete Leave Application",
    endpoint: "/api/leave-applications/:id",
    method: "DELETE",
    description: "Delete leave application",
    fields: ["id"],
    requiredFields: ["id"],
    searchTerms: "delete leave application cancel leave withdraw leave request"
  },

  // 7. Client Reports CRUD
  {
    id: 28,
    name: "Create Client Report",
    endpoint: "/api/client-reports",
    method: "POST",
    description: "Create new client report",
    fields: [
      "userId", "dealerType", "dealerSubDealerName", "location", "typeBestNonBest",
      "dealerTotalPotential", "dealerBestPotential", "brandSelling", "contactPerson",
      "contactPersonPhoneNo", "todayOrderMT", "todayCollection", "feedbacks",
      "solutionsAsPerSalesperson", "anyRemarks", "checkOutTime"
    ],
    requiredFields: ["userId", "dealerType", "dealerSubDealerName", "location"],
    searchTerms: "create client report new client report customer report"
  },
  {
    id: 29,
    name: "Get Client Reports by User",
    endpoint: "/api/client-reports/user/:userId",
    method: "GET",
    description: "Fetch client reports for a specific user",
    fields: ["userId", "limit"],
    requiredFields: ["userId"],
    searchTerms: "get client reports user my client reports fetch customer reports"
  },
  {
    id: 30,
    name: "Update Client Report",
    endpoint: "/api/client-reports/:id",
    method: "PUT",
    description: "Update existing client report",
    fields: ["id", "feedbacks", "solutionsAsPerSalesperson", "anyRemarks"],
    requiredFields: ["id"],
    searchTerms: "update client report edit customer report modify client report"
  },

  // 8. Competition Reports CRUD
  {
    id: 31,
    name: "Create Competition Report",
    endpoint: "/api/competition-reports",
    method: "POST",
    description: "Create new competition analysis report",
    fields: [
      "userId", "reportDate", "brandName", "billing", "nod", "retail",
      "schemesYesNo", "avgSchemeCost", "remarks"
    ],
    requiredFields: ["userId", "reportDate", "brandName", "billing"],
    searchTerms: "create competition report competitor analysis market research"
  },
  {
    id: 32,
    name: "Get Competition Reports by User",
    endpoint: "/api/competition-reports/user/:userId",
    method: "GET",
    description: "Fetch competition reports for a specific user",
    fields: ["userId", "startDate", "endDate", "limit"],
    requiredFields: ["userId"],
    searchTerms: "get competition reports user competitor reports market analysis"
  },

  // 9. Dealer Reports and Scores CRUD
  {
    id: 33,
    name: "Create Dealer Score Report",
    endpoint: "/api/dealer-reports-scores",
    method: "POST",
    description: "Create dealer performance and scoring report",
    fields: [
      "dealerId", "dealerScore", "trustWorthinessScore", "creditWorthinessScore",
      "orderHistoryScore", "visitFrequencyScore", "lastUpdatedDate"
    ],
    requiredFields: ["dealerId", "dealerScore", "trustWorthinessScore"],
    searchTerms: "create dealer score report dealer performance scoring dealer rating"
  },
  {
    id: 34,
    name: "Get Dealer Score Reports",
    endpoint: "/api/dealer-reports-scores/user/:userId",
    method: "GET",
    description: "Fetch dealer scoring reports",
    fields: ["userId", "limit"],
    requiredFields: ["userId"],
    searchTerms: "get dealer scores dealer performance reports dealer ratings"
  },

  // ==================== SPECIAL ENDPOINTS ====================
  
  // Attendance Management
  {
    id: 35,
    name: "Punch In Attendance",
    endpoint: "/api/attendance/punch-in",
    method: "POST",
    description: "Record attendance punch-in with geo-location verification",
    fields: ["userId", "latitude", "longitude", "locationName", "accuracy", "selfieUrl"],
    requiredFields: ["userId", "latitude", "longitude"],
    searchTerms: "punch in attendance check in clock in attendance marking geo location"
  },
  {
    id: 36,
    name: "Punch Out Attendance",
    endpoint: "/api/attendance/punch-out",
    method: "POST",
    description: "Record attendance punch-out",
    fields: ["userId", "latitude", "longitude", "selfieUrl"],
    requiredFields: ["userId"],
    searchTerms: "punch out attendance check out clock out end attendance"
  },
  {
    id: 37,
    name: "Get User Attendance",
    endpoint: "/api/attendance/user/:userId",
    method: "GET",
    description: "Fetch attendance records for a specific user",
    fields: ["userId", "startDate", "endDate", "limit"],
    requiredFields: ["userId"],
    searchTerms: "get attendance user attendance history my attendance records"
  },

  // Dashboard and Analytics
  {
    id: 38,
    name: "Dashboard Stats",
    endpoint: "/api/dashboard/stats/:userId",
    method: "GET",
    description: "Get comprehensive dashboard statistics and metrics",
    fields: ["userId"],
    requiredFields: ["userId"],
    searchTerms: "dashboard stats analytics metrics overview summary statistics"
  },

  // Authentication
  {
    id: 39,
    name: "User Login",
    endpoint: "/api/auth/login",
    method: "POST",
    description: "Authenticate user login with credentials",
    fields: ["loginId", "password"],
    requiredFields: ["loginId", "password"],
    searchTerms: "login authenticate sign in user login credentials"
  },

  // AI/RAG Endpoints
  {
    id: 40,
    name: "AI Chat",
    endpoint: "/api/ai/chat",
    method: "POST",
    description: "AI-powered chat with orchestration and data extraction",
    fields: ["message", "userId", "context"],
    requiredFields: ["message", "userId"],
    searchTerms: "ai chat artificial intelligence assistant bot help"
  },
  {
    id: 41,
    name: "RAG Chat",
    endpoint: "/api/rag/chat",
    method: "POST",
    description: "RAG-based chat for guided data collection",
    fields: ["messages", "userId"],
    requiredFields: ["messages"],
    searchTerms: "rag chat guided conversation data collection assistant"
  },
  {
    id: 42,
    name: "RAG Submit",
    endpoint: "/api/rag/submit",
    method: "POST",
    description: "Submit collected data through RAG conversation",
    fields: ["messages", "userId"],
    requiredFields: ["messages", "userId"],
    searchTerms: "rag submit conversation submit data collection finalize"
  }
];

async function generateAndStore() {
  console.log("🚀 Generating embeddings with FREE Transformers.js...");
  console.log(`📊 Processing ${endpoints.length} endpoints...`);
  console.log("📦 Loading model: Xenova/all-MiniLM-L6-v2 (this may take a moment on first run)");

  // Load the embedding model (downloads once, then cached)
  const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

  const embeddedEndpoints = [];

  for (const endpoint of endpoints) {
    const searchableText = `${endpoint.name} ${endpoint.description} ${endpoint.searchTerms}`;

    console.log(`⏳ [${endpoint.id}/${endpoints.length}] Generating embedding for: ${endpoint.name}`);
    console.log(`📝 Text: "${searchableText.substring(0, 60)}..."`);

    try {
      // Generate embedding using Transformers.js
      const output = await embedder(searchableText, { pooling: 'mean', normalize: true });

      // Convert to regular array
      const embedding = Array.from(output.data);

      embeddedEndpoints.push({
        ...endpoint,
        embedding: embedding
      });

      console.log(`✅ Generated ${embedding.length}-dimensional embedding for ${endpoint.name}`);
    } catch (error) {
      console.error(`❌ Failed to generate embedding for ${endpoint.name}:`, error.message);
      return;
    }
  }

  const dataPath = join(__dirname, '..', 'data', 'endpoint-embeddings.json');
  fs.writeFileSync(dataPath, JSON.stringify(embeddedEndpoints, null, 2));
  console.log(`✅ Saved embeddings to ./data/endpoint-embeddings.json`);
  console.log(`📈 Total endpoints processed: ${embeddedEndpoints.length}`);
  console.log(`💰 Total cost: $0.00 (100% FREE!)`);
  
  // Summary by category
  const categories = {
    'DVR': embeddedEndpoints.filter(e => e.searchTerms.includes('daily visit')).length,
    'TVR': embeddedEndpoints.filter(e => e.searchTerms.includes('technical visit')).length,
    'PJP': embeddedEndpoints.filter(e => e.searchTerms.includes('journey plan')).length,
    'Dealers': embeddedEndpoints.filter(e => e.searchTerms.includes('dealer')).length,
    'Tasks': embeddedEndpoints.filter(e => e.searchTerms.includes('daily task')).length,
    'Leave': embeddedEndpoints.filter(e => e.searchTerms.includes('leave')).length,
    'Attendance': embeddedEndpoints.filter(e => e.searchTerms.includes('attendance')).length,
    'AI/RAG': embeddedEndpoints.filter(e => e.searchTerms.includes('ai chat') || e.searchTerms.includes('rag')).length
  };
  
  console.log('\n📊 ENDPOINT SUMMARY:');
  Object.entries(categories).forEach(([category, count]) => {
    console.log(`   ${category}: ${count} endpoints`);
  });
}

generateAndStore().catch(console.error);