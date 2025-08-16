const { httpClient } = require('../config/httpClient');
const { handleApiError } = require('../utils/errorHandler');

async function updateDealerReportScoreTool(id, data) {
  try {
    const response = await httpClient.put(`/api/dealer-reports-scores/${id}`, data);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Update Dealer Report Score');
  }
}

module.exports = updateDealerReportScoreTool;