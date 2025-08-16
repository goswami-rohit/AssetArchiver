const { httpClient } = require('../config/httpClient');
const { handleApiError } = require('../utils/errorHandler');

async function getDvrsByUserTool(userId, params = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.dealerType) queryParams.append('dealerType', params.dealerType);
    if (params.limit) queryParams.append('limit', params.limit);
    
    const queryString = queryParams.toString();
    const url = `/api/dvr/user/${userId}${queryString ? `?${queryString}` : ''}`;
    
    const response = await httpClient.get(url);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Get DVRs');
  }
}

module.exports = getDvrsByUserTool;