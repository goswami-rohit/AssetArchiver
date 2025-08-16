const { httpClient } = require('../config/httpClient');
const { handleApiError } = require('../utils/errorHandler');

async function getCompetitionReportsByUserTool(userId, params = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.brandName) queryParams.append('brandName', params.brandName);
    
    const queryString = queryParams.toString();
    const url = `/api/competition-reports/user/${userId}${queryString ? `?${queryString}` : ''}`;
    
    const response = await httpClient.get(url);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Get Competition Reports');
  }
}

module.exports = getCompetitionReportsByUserTool;