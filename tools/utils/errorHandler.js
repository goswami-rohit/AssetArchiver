/**
 * Handles API errors and converts them to meaningful error messages
 * @param {Error} error - The error from axios
 * @param {string} context - What operation failed (e.g., "Create DVR")
 * @returns {Error} A new error with a clear message
 */
function handleApiError(error, context = 'API call') {
  if (error.response) {
    // Server responded with an error status (400, 500, etc.)
    const { status, data } = error.response;
    const errorMessage = data.error || data.message || 'Unknown error';
    
    return new Error(`${context} failed (${status}): ${errorMessage}`);
  } else if (error.request) {
    // Network error - couldn't reach the server
    return new Error(`${context} failed: Could not reach backend server`);
  } else {
    // Other error
    return new Error(`${context} failed: ${error.message}`);
  }
}

/**
 * Formats error for AI orchestrator consumption
 * @param {Error} error - The error to format
 * @returns {Object} Formatted error object
 */
function getErrorForAI(error) {
  return {
    success: false,
    error: error.message,
    timestamp: new Date().toISOString()
  };
}

module.exports = { handleApiError, getErrorForAI };