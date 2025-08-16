const { httpClient } = require('../config/httpClient');
const { handleApiError } = require('../utils/errorHandler');

async function getTvrTool(id) {
  try {
    const response = await httpClient.get(`/api/tvr/${id}`);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Get TVR');
  }
}

module.exports = getTvrTool;