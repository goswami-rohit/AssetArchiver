const { httpClient } = require('../config/httpClient');
const { handleApiError } = require('../utils/errorHandler');

async function getCompetitionReportTool(id) {
  try {
    const response = await httpClient.get(`/api/competition-reports/${id}`);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Get Competition Report');
  }
}

module.exports = getCompetitionReportTool;