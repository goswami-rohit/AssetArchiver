const { httpClient } = require('../config/httpClient');
const { handleApiError } = require('../utils/errorHandler');

async function getPjpTool(id) {
  try {
    const response = await httpClient.get(`/api/pjp/${id}`);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Get PJP');
  }
}

module.exports = getPjpTool;