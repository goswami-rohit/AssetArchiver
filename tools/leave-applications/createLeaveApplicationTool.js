const { httpClient } = require('../config/httpClient');
const { handleApiError } = require('../utils/errorHandler');

async function createLeaveApplicationTool(data) {
  try {
    const response = await httpClient.post('/api/leave-applications', data);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Create Leave Application');
  }
}

module.exports = createLeaveApplicationTool;