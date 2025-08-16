const { httpClient } = require('../config/httpClient');
const { handleApiError } = require('../utils/errorHandler');

async function createDailyTaskTool(data) {
  try {
    const response = await httpClient.post('/api/daily-tasks', data);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Create Daily Task');
  }
}

module.exports = createDailyTaskTool;