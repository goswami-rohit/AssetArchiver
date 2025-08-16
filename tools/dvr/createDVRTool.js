const { httpClient } = require('../config/httpClient');
const { handleApiError } = require('../utils/errorHandler');

async function createDvrTool(data) {
  try {
    const response = await httpClient.post('/api/dvr', data);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Create DVR');
  }
}

module.exports = createDvrTool;