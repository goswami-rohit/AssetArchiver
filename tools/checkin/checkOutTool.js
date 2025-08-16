const { httpClient } = require('../config/httpClient');
const { handleApiError } = require('../utils/errorHandler');

/**
 * Check out from a location with distance calculation
 * @param {Object} params - Check out parameters
 * @param {string} params.trackingId - The tracking ID from check-in response
 * @param {number} [params.latitude] - Current latitude (optional for distance calculation)
 * @param {number} [params.longitude] - Current longitude (optional for distance calculation)
 * @param {number} [params.userId] - User ID (optional)
 * @returns {Promise<Object>} Check out response with distance traveled
 */
async function checkOutTool(params) {
  try {
    const response = await httpClient.post('/api/geo-tracking/checkout', {
      trackingId: params.trackingId,
      userId: params.userId,
      latitude: params.latitude,
      longitude: params.longitude
    });
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Check Out');
  }
}

module.exports = checkOutTool;