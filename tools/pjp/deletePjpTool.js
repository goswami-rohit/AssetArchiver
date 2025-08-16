const { httpClient } = require('../config/httpClient');
const { handleApiError } = require('../utils/errorHandler');

async function deletePjpTool(id) {
  try {
    const response = await httpClient.delete(`/api/pjp/${id}`);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Delete PJP');
  }
}

module.exports = deletePjpTool;