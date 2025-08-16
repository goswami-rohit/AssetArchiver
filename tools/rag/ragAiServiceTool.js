const { handleApiError } = require('../utils/errorHandler');

// Import your AI service functions directly from aiServices.ts
let aiServices;
try {
  // Try the most common path first
  aiServices = require('../../server/bot/aiServices');
} catch (error) {
  try {
    // Fallback path
    aiServices = require('../../server/aiServices');
  } catch (fallbackError) {
    console.warn('⚠️ Could not import aiServices - check path in ragAiServiceTool.js');
    aiServices = null;
  }
}

/**
 * Chat with AI using direct aiServices (bypasses HTTP)
 * @param {Array} messages - Array of chat messages
 * @param {number} userId - User ID
 * @returns {Promise<Object>} AI chat response
 */
async function ragChatViaService(messages, userId) {
  try {
    if (!aiServices || !aiServices.chat) {
      throw new Error('AI Services chat function not available');
    }
    
    console.log('🤖 Direct AI Service: chat');
    const result = await aiServices.chat(messages, userId);
    return result;
  } catch (error) {
    throw handleApiError(error, 'RAG Chat Via Service');
  }
}

/**
 * Extract structured data using direct aiServices
 * @param {Array} messages - Array of chat messages  
 * @param {number} userId - User ID
 * @returns {Promise<Object>} Extracted structured data
 */
async function ragExtractViaService(messages, userId) {
  try {
    if (!aiServices || !aiServices.extractStructuredData) {
      throw new Error('AI Services extractStructuredData function not available');
    }
    
    console.log('🤖 Direct AI Service: extractStructuredData');
    const result = await aiServices.extractStructuredData(messages, userId);
    return result;
  } catch (error) {
    throw handleApiError(error, 'RAG Extract Via Service');
  }
}

module.exports = { ragChatViaService, ragExtractViaService };