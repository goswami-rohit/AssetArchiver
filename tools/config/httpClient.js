const axios = require('axios');
require('dotenv').config();

const httpClient = axios.create({
  baseURL: process.env.BACKEND_BASE_URL || 'https://telesalesside.onrender.com',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Log requests for debugging
httpClient.interceptors.request.use(
  (config) => {
    console.log(`🔧 Tool Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => Promise.reject(error)
);

// Log responses for debugging
httpClient.interceptors.response.use(
  (response) => {
    console.log(`✅ Tool Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error(`❌ Tool Error: ${error.response?.status} ${error.config?.url}`);
    return Promise.reject(error);
  }
);

module.exports = { httpClient };