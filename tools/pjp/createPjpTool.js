const { httpClient } = require('../config/httpClient');
const { handleApiError } = require('../utils/errorHandler');

async function createPjpTool(data) {
  try {
    const response = await httpClient.post('/api/pjp', data);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Create PJP');
  }
}

module.exports = createPjpTool;