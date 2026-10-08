// Production builds call the deployed backend on Render (cross-origin; the backend's FRONTEND_ORIGIN
// must allow the deployed frontend). Replaces api.config.ts through angular.json fileReplacements.
export const API_BASE_URL = 'https://taxflow-api-gjna.onrender.com/api';
