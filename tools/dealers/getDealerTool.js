const { httpClient } = require('../config/httpClient');
const { handleApiError } = require('../utils/errorHandler');

async function getDealerTool(id) {
  try {
    const response = await httpClient.get(`/api/dealers/${id}`);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Get Dealer');
  }
}

module.exports = getDealerTool;