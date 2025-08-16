const { httpClient } = require('../config/httpClient');
const { handleApiError } = require('../utils/errorHandler');

async function deleteCompetitionReportTool(id) {
  try {
    const response = await httpClient.delete(`/api/competition-reports/${id}`);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Delete Competition Report');
  }
}

module.exports = deleteCompetitionReportTool;