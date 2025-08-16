const { httpClient } = require('../config/httpClient');
const { handleApiError } = require('../utils/errorHandler');

async function deleteDvrTool(id) {
  try {
    const response = await httpClient.delete(`/api/dvr/${id}`);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Delete DVR');
  }
}

module.exports = deleteDvrTool;