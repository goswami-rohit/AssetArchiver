const { httpClient } = require('../config/httpClient');
const { handleApiError } = require('../utils/errorHandler');

async function getDailyTasksByUserTool(userId, params = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (params.status) queryParams.append('status', params.status);
    if (params.date) queryParams.append('date', params.date);
    if (params.assignedBy) queryParams.append('assignedBy', params.assignedBy);
    
    const queryString = queryParams.toString();
    const url = `/api/daily-tasks/user/${userId}${queryString ? `?${queryString}` : ''}`;
    
    const response = await httpClient.get(url);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Get Daily Tasks');
  }
}

module.exports = getDailyTasksByUserTool;