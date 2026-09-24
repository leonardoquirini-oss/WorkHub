# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --silent

# Copy source code
COPY . .

# Riceve le variabili come build arguments da docker-compose (letti da .env, vedi .env.example)
# Da settare obbligatoriamente al momento del build: docker-entrypoint.sh puo' comunque
# sovrascriverle a runtime senza rebuild tramite /config.js, quindi qui non c'e' un host
# hardcoded, solo l'obbligo di passare un valore esplicito.
ARG VITE_KEYCLOAK_URL
ARG VITE_KEYCLOAK_REALM
ARG VITE_KEYCLOAK_CLIENT_ID
ARG VITE_API_URL
ARG VITE_DEFAULT_SITE_ID

# Controllo e interrompo la build se non sono definite le variabili
RUN test -n "$VITE_KEYCLOAK_URL" || (echo "ERRORE: devi passare --build-arg VITE_KEYCLOAK_URL=<valore>" && exit 1)
RUN test -n "$VITE_KEYCLOAK_REALM" || (echo "ERRORE: devi passare --build-arg VITE_KEYCLOAK_REALM=<valore>" && exit 1)
RUN test -n "$VITE_KEYCLOAK_CLIENT_ID" || (echo "ERRORE: devi passare --build-arg VITE_KEYCLOAK_CLIENT_ID=<valore>" && exit 1)
RUN test -n "$VITE_API_URL" || (echo "ERRORE: devi passare --build-arg VITE_API_URL=<valore>" && exit 1)
RUN test -n "$VITE_DEFAULT_SITE_ID" || (echo "ERRORE: devi passare --build-arg VITE_DEFAULT_SITE_ID=<valore>" && exit 1)

ENV VITE_KEYCLOAK_URL=$VITE_KEYCLOAK_URL
ENV VITE_KEYCLOAK_REALM=$VITE_KEYCLOAK_REALM
ENV VITE_KEYCLOAK_CLIENT_ID=$VITE_KEYCLOAK_CLIENT_ID
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_DEFAULT_SITE_ID=$VITE_DEFAULT_SITE_ID

# Build the application
RUN npm run build

# Stage 2: Production
FROM nginx:alpine AS production

# bash + envsubst for the entrypoint
RUN apk add --no-cache bash

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Entrypoint: substitutes BACKEND_URL in nginx.conf and generates /config.js
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/health || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
