const { httpClient } = require('../config/httpClient');
const { handleApiError } = require('../utils/errorHandler');

async function createDealerReportScoreTool(data) {
  try {
    const response = await httpClient.post('/api/dealer-reports-scores', data);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Create Dealer Report Score');
  }
}

module.exports = createDealerReportScoreTool;