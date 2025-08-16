const { httpClient } = require('../config/httpClient');
const { handleApiError } = require('../utils/errorHandler');

/**
 * Create a general geo-tracking record
 * @param {Object} data - Geo tracking data
 * @returns {Promise<Object>} Created tracking record
 */
async function createGeoTrackingTool(data) {
  try {
    const response = await httpClient.post('/api/geo-tracking', data);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Create Geo Tracking');
  }
}

module.exports = createGeoTrackingTool;