const { httpClient } = require('../config/httpClient');
const { handleApiError } = require('../utils/errorHandler');

async function createTvrTool(data) {
  try {
    const response = await httpClient.post('/api/tvr', data);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Create TVR');
  }
}

module.exports = createTvrTool;