const { httpClient } = require('../config/httpClient');
const { handleApiError } = require('../utils/errorHandler');

async function updateDvrTool(id, data) {
  try {
    const response = await httpClient.put(`/api/dvr/${id}`, data);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Update DVR');
  }
}

module.exports = updateDvrTool;