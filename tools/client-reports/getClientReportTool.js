const { httpClient } = require('../config/httpClient');
const { handleApiError } = require('../utils/errorHandler');

async function getClientReportTool(id) {
  try {
    const response = await httpClient.get(`/api/client-reports/${id}`);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Get Client Report');
  }
}

module.exports = getClientReportTool;