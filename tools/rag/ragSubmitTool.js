const { httpClient } = require('../config/httpClient');
const { handleApiError } = require('../utils/errorHandler');

/**
 * Submit conversation to create DVR or TVR using AI
 * @param {Object} params - Submit parameters
 * @param {Array} params.messages - Array of chat messages
 * @param {number} params.userId - User ID (required)
 * @returns {Promise<Object>} Submission response with created record
 */
async function ragSubmitTool(params) {
  try {
    const response = await httpClient.post('/api/rag/submit', params);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'RAG Submit');
  }
}

module.exports = { ragSubmitTool };