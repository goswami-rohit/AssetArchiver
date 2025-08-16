const { httpClient } = require('../config/httpClient');
const { handleApiError } = require('../utils/errorHandler');

async function createClientReportTool(data) {
  try {
    const response = await httpClient.post('/api/client-reports', data);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Create Client Report');
  }
}

module.exports = createClientReportTool;