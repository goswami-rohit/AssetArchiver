const { httpClient } = require('../config/httpClient');
const { handleApiError } = require('../utils/errorHandler');

async function getDealerReportScoresByDealerTool(dealerId) {
  try {
    const response = await httpClient.get(`/api/dealer-reports-scores/dealer/${dealerId}`);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Get Dealer Report Scores');
  }
}

module.exports = getDealerReportScoresByDealerTool;