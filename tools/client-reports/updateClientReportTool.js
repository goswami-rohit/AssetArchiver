const { httpClient } = require('../config/httpClient');
const { handleApiError } = require('../utils/errorHandler');

async function updateClientReportTool(id, data) {
  try {
    const response = await httpClient.put(`/api/client-reports/${id}`, data);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Update Client Report');
  }
}

module.exports = updateClientReportTool;