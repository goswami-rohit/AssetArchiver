const { httpClient } = require('../config/httpClient');
const { handleApiError } = require('../utils/errorHandler');

async function deleteTvrTool(id) {
  try {
    const response = await httpClient.delete(`/api/tvr/${id}`);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Delete TVR');
  }
}

module.exports = deleteTvrTool;