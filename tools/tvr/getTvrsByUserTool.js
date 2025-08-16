const { httpClient } = require('../config/httpClient');
const { handleApiError } = require('../utils/errorHandler');

async function getTvrsByUserTool(userId, params = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.visitType) queryParams.append('visitType', params.visitType);
    
    const queryString = queryParams.toString();
    const url = `/api/tvr/user/${userId}${queryString ? `?${queryString}` : ''}`;
    
    const response = await httpClient.get(url);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Get TVRs');
  }
}

module.exports = getTvrsByUserTool;