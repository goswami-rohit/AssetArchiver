const { httpClient } = require('../config/httpClient');
const { handleApiError } = require('../utils/errorHandler');

async function createCompetitionReportTool(data) {
  try {
    const response = await httpClient.post('/api/competition-reports', data);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Create Competition Report');
  }
}

module.exports = createCompetitionReportTool;