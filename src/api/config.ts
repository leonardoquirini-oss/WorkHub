export const API_CONFIG = {
  keycloakUrl: import.meta.env.VITE_KEYCLOAK_URL || 'http://192.168.0.12:8080',
  realm: import.meta.env.VITE_KEYCLOAK_REALM || 'gb-realm',
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'berlink-client',
  apiUrl: import.meta.env.VITE_API_URL || '/api',
  defaultSiteId: parseInt(import.meta.env.VITE_DEFAULT_SITE_ID || '1', 10),
  tokenRefreshBuffer: 60000, // Refresh token 60 seconds before expiry
}

export const STORAGE_KEYS = {
  accessToken: 'workhub_access_token',
  refreshToken: 'workhub_refresh_token',
  tokenExpiry: 'workhub_token_expiry',
  user: 'workhub_user',
  lastSite: 'workhub_last_site',
  lastYard: 'workhub_last_yard',
  uiPreferences: 'workhub_ui_preferences',
}
