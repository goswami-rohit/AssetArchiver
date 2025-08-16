const { httpClient } = require('../config/httpClient');
const { handleApiError } = require('../utils/errorHandler');

async function punchInTool(params) {
  try {
    const formData = new FormData();
    formData.append('userId', params.userId);
    formData.append('latitude', params.latitude);
    formData.append('longitude', params.longitude);
    if (params.locationName) formData.append('locationName', params.locationName);
    if (params.accuracy) formData.append('accuracy', params.accuracy);
    if (params.selfie) formData.append('selfie', params.selfie);
    
    const response = await httpClient.post('/api/attendance/punch-in', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Punch In');
  }
}

module.exports = punchInTool;