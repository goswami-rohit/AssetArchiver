const { httpClient } = require('../config/httpClient');
const { handleApiError } = require('../utils/errorHandler');

async function updateTvrTool(id, data) {
  try {
    const response = await httpClient.put(`/api/tvr/${id}`, data);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Update TVR');
  }
}

module.exports = updateTvrTool;