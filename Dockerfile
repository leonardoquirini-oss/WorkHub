# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --silent

# Copy source code
COPY . .

# Build arguments for environment variables at build time
ARG VITE_KEYCLOAK_URL=http://192.168.0.12:8080
ARG VITE_KEYCLOAK_REALM=gb-realm
ARG VITE_KEYCLOAK_CLIENT_ID=berlink-client
ARG VITE_API_URL=/api
ARG VITE_DEFAULT_SITE_ID=1

# Set environment variables for build
ENV VITE_KEYCLOAK_URL=$VITE_KEYCLOAK_URL
ENV VITE_KEYCLOAK_REALM=$VITE_KEYCLOAK_REALM
ENV VITE_KEYCLOAK_CLIENT_ID=$VITE_KEYCLOAK_CLIENT_ID
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_DEFAULT_SITE_ID=$VITE_DEFAULT_SITE_ID

# Build the application
RUN npm run build

# Stage 2: Production
FROM nginx:alpine AS production

# Install envsubst for runtime environment variable substitution
RUN apk add --no-cache bash

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy entrypoint script for runtime config
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/health || exit 1

# Start nginx
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
