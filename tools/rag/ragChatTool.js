const { httpClient } = require('../config/httpClient');
const { handleApiError } = require('../utils/errorHandler');

/**
 * Chat with AI using RAG system
 * @param {Object} params - Chat parameters
 * @param {Array} params.messages - Array of chat messages with role and content
 * @param {number} params.userId - User ID (optional)
 * @returns {Promise<Object>} AI chat response
 */
async function ragChatTool(params) {
  try {
    const response = await httpClient.post('/api/rag/chat', params);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'RAG Chat');
  }
}

module.exports = { ragChatTool };