const { httpClient } = require('../config/httpClient');
const { handleApiError } = require('../utils/errorHandler');

async function getDvrTool(id) {
  try {
    const response = await httpClient.get(`/api/dvr/${id}`);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Get DVR');
  }
}

module.exports = getDvrTool;