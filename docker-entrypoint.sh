#!/bin/bash
set -e

# --- nginx: backend upstream for the /api proxy -------------------------------------------
BACKEND_URL=${BACKEND_URL:-http://backend:8080}

# Only ${BACKEND_URL} is substituted; nginx's own $variables are left untouched.
# Idempotent: on a container restart the placeholder is already gone.
envsubst '${BACKEND_URL}' < /etc/nginx/nginx.conf > /etc/nginx/nginx.conf.tmp
mv /etc/nginx/nginx.conf.tmp /etc/nginx/nginx.conf

# --- runtime config for the SPA -------------------------------------------------------------
# Always generated. Values are read by src/api/config.ts before the build-time VITE_* ones;
# an empty value means "keep the build-time default", so no host is hardcoded here.
cat > /usr/share/nginx/html/config.js << EOF
window.__WORKHUB_CONFIG__ = {
  KEYCLOAK_URL: '${VITE_KEYCLOAK_URL:-}',
  KEYCLOAK_REALM: '${VITE_KEYCLOAK_REALM:-}',
  KEYCLOAK_CLIENT_ID: '${VITE_KEYCLOAK_CLIENT_ID:-}',
  API_URL: '${VITE_API_URL:-}',
  DEFAULT_SITE_ID: '${VITE_DEFAULT_SITE_ID:-}'
};
EOF

echo "WorkHub: BACKEND_URL=${BACKEND_URL}, KEYCLOAK_URL=${VITE_KEYCLOAK_URL:-<build default>}"

exec "$@"
