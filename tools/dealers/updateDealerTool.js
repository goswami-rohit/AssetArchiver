const { httpClient } = require('../config/httpClient');
const { handleApiError } = require('../utils/errorHandler');

async function updateDealerTool(id, data) {
  try {
    const response = await httpClient.put(`/api/dealers/${id}`, data);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Update Dealer');
  }
}

module.exports = updateDealerTool;