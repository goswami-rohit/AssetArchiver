const { httpClient } = require('../config/httpClient');
const { handleApiError } = require('../utils/errorHandler');

async function updatePjpTool(id, data) {
  try {
    const response = await httpClient.put(`/api/pjp/${id}`, data);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Update PJP');
  }
}

module.exports = updatePjpTool;