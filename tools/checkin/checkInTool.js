const { httpClient } = require('../config/httpClient');
const { handleApiError } = require('../utils/errorHandler');

/**
 * Check in at a location with GPS coordinates
 * @param {Object} params - Check in parameters
 * @param {number} params.userId - User ID
 * @param {number} params.latitude - Latitude coordinate
 * @param {number} params.longitude - Longitude coordinate
 * @param {string} params.siteName - Location/site name
 * @param {string} [params.activityType='site_visit'] - Type of activity (defaults to 'site_visit')
 * @returns {Promise<Object>} Check in response with tracking ID
 */
async function checkInTool(params) {
  try {
    const response = await httpClient.post('/api/geo-tracking/checkin', {
      userId: params.userId,
      latitude: params.latitude,
      longitude: params.longitude,
      siteName: params.siteName,
      activityType: params.activityType || 'site_visit'
    });
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Check In');
  }
}

module.exports = checkInTool;