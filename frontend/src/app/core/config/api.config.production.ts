// Production builds call the API on the same origin; the web server proxies /api to the backend
// (see frontend/nginx.conf). Replaces api.config.ts through angular.json fileReplacements.
export const API_BASE_URL = '/api';
