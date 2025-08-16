const { httpClient } = require('../config/httpClient');
const { handleApiError } = require('../utils/errorHandler');

async function createDealerTool(data) {
  try {
    const response = await httpClient.post('/api/dealers', data);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Create Dealer');
  }
}

module.exports = createDealerTool;