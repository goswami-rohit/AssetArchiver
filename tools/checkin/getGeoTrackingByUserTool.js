const { httpClient } = require('../config/httpClient');
const { handleApiError } = require('../utils/errorHandler');

/**
 * Get geo-tracking history for a user with route analysis
 * @param {string} userId - User ID
 * @param {Object} [params] - Query parameters
 * @param {string} [params.date] - Filter by specific date
 * @param {string} [params.activityType] - Filter by activity type
 * @returns {Promise<Object>} Tracking history with analytics
 */
async function getGeoTrackingByUserTool(userId, params = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (params.date) queryParams.append('date', params.date);
    if (params.activityType) queryParams.append('activityType', params.activityType);
    
    const queryString = queryParams.toString();
    const url = `/api/geo-tracking/user/${userId}${queryString ? `?${queryString}` : ''}`;
    
    const response = await httpClient.get(url);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Get Geo Tracking');
  }
}

module.exports = getGeoTrackingByUserTool;