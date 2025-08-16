// Import all tool categories
const { createDvrTool } = require('./dvr/createDvrTool');
const { getDvrsByUserTool } = require('./dvr/getDvrsByUserTool');
const { getDvrTool } = require('./dvr/getDvrTool');
const { updateDvrTool } = require('./dvr/updateDvrTool');
const { deleteDvrTool } = require('./dvr/deleteDvrTool');

const { createTvrTool } = require('./tvr/createTvrTool');
const { getTvrsByUserTool } = require('./tvr/getTvrsByUserTool');
const { getTvrTool } = require('./tvr/getTvrTool');
const { updateTvrTool } = require('./tvr/updateTvrTool');
const { deleteTvrTool } = require('./tvr/deleteTvrTool');

const { createPjpTool } = require('./pjp/createPjpTool');
const { getPjpsByUserTool } = require('./pjp/getPjpsByUserTool');
const { getPjpTool } = require('./pjp/getPjpTool');
const { updatePjpTool } = require('./pjp/updatePjpTool');
const { deletePjpTool } = require('./pjp/deletePjpTool');

const { createDealerTool } = require('./dealers/createDealerTool');
const { getDealersByUserTool } = require('./dealers/getDealersByUserTool');
const { getDealerTool } = require('./dealers/getDealerTool');
const { updateDealerTool } = require('./dealers/updateDealerTool');
const { deleteDealerTool } = require('./dealers/deleteDealerTool');

const { createDealerReportScoreTool } = require('./dealer-reports-scores/createDealerReportScoreTool');
const { getDealerReportScoresByDealerTool } = require('./dealer-reports-scores/getDealerReportScoresByDealerTool');
const { updateDealerReportScoreTool } = require('./dealer-reports-scores/updateDealerReportScoreTool');

const { createClientReportTool } = require('./client-reports/createClientReportTool');
const { getClientReportTool } = require('./client-reports/getClientReportTool');
const { getClientReportsByUserTool } = require('./client-reports/getClientReportsByUserTool');
const { updateClientReportTool } = require('./client-reports/updateClientReportTool');
const { deleteClientReportTool } = require('./client-reports/deleteClientReportTool');

const { createCompetitionReportTool } = require('./competition-reports/createCompetitionReportTool');
const { getCompetitionReportTool } = require('./competition-reports/getCompetitionReportTool');
const { getCompetitionReportsByUserTool } = require('./competition-reports/getCompetitionReportsByUserTool');
const { updateCompetitionReportTool } = require('./competition-reports/updateCompetitionReportTool');
const { deleteCompetitionReportTool } = require('./competition-reports/deleteCompetitionReportTool');

const { punchInTool } = require('./attendance/punchInTool');
const { checkInTool } = require('./checkin/checkInTool');
const { checkOutTool } = require('./checkin/checkOutTool');
const { createGeoTrackingTool } = require('./checkin/createGeoTrackingTool');
const { getGeoTrackingByUserTool } = require('./checkin/getGeoTrackingByUserTool');
const { ragChatTool } = require('./rag/ragChatTool');
const { ragSubmitTool } = require('./rag/ragSubmitTool');
const { ragChatViaService, ragExtractViaService } = require('./rag/ragAiServiceTool');

// Organize all tools by category for AI orchestrator
const tools = {
  // Daily Visit Reports
  dvr: {
    create: createDvrTool,
    get: getDvrTool,
    getByUser: getDvrsByUserTool,
    update: updateDvrTool,
    delete: deleteDvrTool
  },
  
  // Technical Visit Reports
  tvr: {
    create: createTvrTool,
    get: getTvrTool,
    getByUser: getTvrsByUserTool,
    update: updateTvrTool,
    delete: deleteTvrTool
  },
  
  // Permanent Journey Plans
  pjp: {
    create: createPjpTool,
    get: getPjpTool,
    getByUser: getPjpsByUserTool,
    update: updatePjpTool,
    delete: deletePjpTool
  },
  
  // Dealers Management
  dealers: {
    create: createDealerTool,
    get: getDealerTool,
    getByUser: getDealersByUserTool,
    update: updateDealerTool,
    delete: deleteDealerTool
  },
  
  // Dealer Reports & Scores
  dealerReportsScores: {
    create: createDealerReportScoreTool,
    getByDealer: getDealerReportScoresByDealerTool,
    update: updateDealerReportScoreTool
  },
  
  // Client Reports
  clientReports: {
    create: createClientReportTool,
    get: getClientReportTool,
    getByUser: getClientReportsByUserTool,
    update: updateClientReportTool,
    delete: deleteClientReportTool
  },
  
  // Competition Reports
  competitionReports: {
    create: createCompetitionReportTool,
    get: getCompetitionReportTool,
    getByUser: getCompetitionReportsByUserTool,
    update: updateCompetitionReportTool,
    delete: deleteCompetitionReportTool
  },

  // Attendance Management
  attendance: {
    punchIn: punchInTool
  },

  // Check-in/Check-out with Location & Photos
  checkin: {
    checkIn: checkInTool,
    checkOut: checkOutTool,
    createTracking: createGeoTrackingTool,
    getByUser: getGeoTrackingByUserTool
  },

  // AI/RAG System (HTTP routes)
  rag: {
    chat: ragChatTool,
    submit: ragSubmitTool
  },

  // AI/RAG System (Direct service calls - faster for orchestrator)
  ragService: {
    chat: ragChatViaService,
    extract: ragExtractViaService
  }
};

// Export tools for AI orchestrator
module.exports = { tools };