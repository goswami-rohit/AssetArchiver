const { httpClient } = require('../config/httpClient');
const { handleApiError } = require('../utils/errorHandler');

async function punchOutTool(params) {
  try {
    const formData = new FormData();
    formData.append('userId', params.userId);
    if (params.latitude) formData.append('latitude', params.latitude);
    if (params.longitude) formData.append('longitude', params.longitude);
    if (params.selfie) formData.append('selfie', params.selfie);
    
    const response = await httpClient.post('/api/attendance/punch-out', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Punch Out');
  }
}

module.exports = punchOutTool;