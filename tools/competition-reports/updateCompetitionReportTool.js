const { httpClient } = require('../config/httpClient');
const { handleApiError } = require('../utils/errorHandler');

async function updateCompetitionReportTool(id, data) {
  try {
    const response = await httpClient.put(`/api/competition-reports/${id}`, data);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Update Competition Report');
  }
}

module.exports = updateCompetitionReportTool;