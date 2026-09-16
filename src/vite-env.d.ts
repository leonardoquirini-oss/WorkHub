/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_KEYCLOAK_URL?: string
  readonly VITE_KEYCLOAK_REALM?: string
  readonly VITE_KEYCLOAK_CLIENT_ID?: string
  readonly VITE_API_URL?: string
  readonly VITE_DEFAULT_SITE_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Runtime configuration injected by `/config.js` (see docker-entrypoint.sh). */
interface WorkHubRuntimeConfig {
  KEYCLOAK_URL?: string
  KEYCLOAK_REALM?: string
  KEYCLOAK_CLIENT_ID?: string
  API_URL?: string
  DEFAULT_SITE_ID?: string
}

interface Window {
  __WORKHUB_CONFIG__?: WorkHubRuntimeConfig
}
