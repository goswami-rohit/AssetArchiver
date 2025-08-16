const { httpClient } = require('../config/httpClient');
const { handleApiError } = require('../utils/errorHandler');

async function getDealersByUserTool(userId, params = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (params.includeSubDealers !== undefined) queryParams.append('includeSubDealers', params.includeSubDealers);
    if (params.type) queryParams.append('type', params.type);
    if (params.region) queryParams.append('region', params.region);
    if (params.area) queryParams.append('area', params.area);
    
    const queryString = queryParams.toString();
    const url = `/api/dealers/user/${userId}${queryString ? `?${queryString}` : ''}`;
    
    const response = await httpClient.get(url);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Get Dealers');
  }
}

module.exports = getDealersByUserTool;