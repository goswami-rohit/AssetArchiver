const { httpClient } = require('../config/httpClient');
const { handleApiError } = require('../utils/errorHandler');

async function deleteDealerTool(id) {
  try {
    const response = await httpClient.delete(`/api/dealers/${id}`);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Delete Dealer');
  }
}

module.exports = deleteDealerTool;