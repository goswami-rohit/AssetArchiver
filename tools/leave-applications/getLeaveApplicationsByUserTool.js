const { httpClient } = require('../config/httpClient');
const { handleApiError } = require('../utils/errorHandler');

async function getLeaveApplicationsByUserTool(userId, params = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (params.status) queryParams.append('status', params.status);
    if (params.year) queryParams.append('year', params.year);
    
    const queryString = queryParams.toString();
    const url = `/api/leave-applications/user/${userId}${queryString ? `?${queryString}` : ''}`;
    
    const response = await httpClient.get(url);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Get Leave Applications');
  }
}

module.exports = getLeaveApplicationsByUserTool;