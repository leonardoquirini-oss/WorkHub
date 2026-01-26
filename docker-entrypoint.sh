#!/bin/bash
set -e

# Default values
BACKEND_URL=${BACKEND_URL:-http://backend:8080}

# Replace environment variables in nginx config
envsubst '${BACKEND_URL}' < /etc/nginx/nginx.conf > /etc/nginx/nginx.conf.tmp
mv /etc/nginx/nginx.conf.tmp /etc/nginx/nginx.conf

# Optional: Generate runtime config for frontend
# This allows changing API URLs without rebuilding the image
if [ -n "$RUNTIME_CONFIG" ] && [ "$RUNTIME_CONFIG" = "true" ]; then
    cat > /usr/share/nginx/html/config.js << EOF
window.__WORKHUB_CONFIG__ = {
    KEYCLOAK_URL: '${VITE_KEYCLOAK_URL:-http://192.168.0.12:8080}',
    KEYCLOAK_REALM: '${VITE_KEYCLOAK_REALM:-gb-realm}',
    KEYCLOAK_CLIENT_ID: '${VITE_KEYCLOAK_CLIENT_ID:-berlink-client}',
    API_URL: '${VITE_API_URL:-/api}',
    DEFAULT_SITE_ID: '${VITE_DEFAULT_SITE_ID:-1}'
};
EOF
    echo "Runtime config generated at /usr/share/nginx/html/config.js"
fi

echo "Starting nginx with BACKEND_URL=$BACKEND_URL"

# Execute the main command
exec "$@"
