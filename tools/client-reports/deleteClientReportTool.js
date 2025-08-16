const { httpClient } = require('../config/httpClient');
const { handleApiError } = require('../utils/errorHandler');

async function deleteClientReportTool(id) {
  try {
    const response = await httpClient.delete(`/api/client-reports/${id}`);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Delete Client Report');
  }
}

module.exports = deleteClientReportTool;