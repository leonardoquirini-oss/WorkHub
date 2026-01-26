# WorkHub - Guida al Deployment

## Requisiti

- Docker 20.10+
- Docker Compose v2+
- Network Docker `berlink-network` esistente

## Build e Run Locale

### Produzione

```bash
# Build dell'immagine
docker-compose build

# Avvio del container
docker-compose up -d

# Verifica logs
docker-compose logs -f workhub
```

### Sviluppo (con hot reload)

```bash
# Avvio in modalità sviluppo
docker-compose -f docker-compose.dev.yml up -d
```

## Variabili d'Ambiente

### Build-time (configurabili in docker-compose.yml)

| Variabile | Default | Descrizione |
|-----------|---------|-------------|
| `VITE_KEYCLOAK_URL` | `http://192.168.0.12:8080` | URL Keycloak |
| `VITE_KEYCLOAK_REALM` | `gb-realm` | Realm Keycloak |
| `VITE_KEYCLOAK_CLIENT_ID` | `berlink-client` | Client ID |
| `VITE_API_URL` | `/api` | Base URL API (usa proxy nginx) |
| `VITE_DEFAULT_SITE_ID` | `1` | ID sito default |

### Runtime (configurabili senza rebuild)

| Variabile | Default | Descrizione |
|-----------|---------|-------------|
| `BACKEND_URL` | `http://backend:8080` | URL backend per proxy nginx |
| `WORKHUB_PORT` | `5173` | Porta esposta |
| `RUNTIME_CONFIG` | `false` | Genera config.js runtime |

## Deploy su Portainer

### Metodo 1: Stack da docker-compose

1. In Portainer, vai a **Stacks** > **Add stack**
2. Seleziona **Upload** e carica `docker-compose.yml`
3. Configura le variabili d'ambiente nella sezione **Environment variables**:
   ```
   VITE_KEYCLOAK_URL=http://your-keycloak:8080
   BACKEND_URL=http://your-backend:8080
   WORKHUB_PORT=5173
   ```
4. Clicca **Deploy the stack**

### Metodo 2: Build locale + push registry

```bash
# Build con tag per registry
docker build -t your-registry.com/workhub:1.0.0 \
  --build-arg VITE_KEYCLOAK_URL=http://keycloak.prod:8080 \
  --build-arg VITE_API_URL=/api \
  .

# Push al registry
docker push your-registry.com/workhub:1.0.0
```

Poi in Portainer:
1. **Containers** > **Add container**
2. Image: `your-registry.com/workhub:1.0.0`
3. Port mapping: `5173:80`
4. Network: `berlink-network`

### Metodo 3: Git repository

1. Configura webhook Git in Portainer
2. Crea stack con repository URL
3. Ad ogni push, Portainer rebuilda automaticamente

## Configurazione Network

Assicurarsi che il network `berlink-network` esista:

```bash
docker network create berlink-network
```

Oppure in Portainer: **Networks** > **Add network** > Name: `berlink-network`

## Health Check

L'applicazione espone un endpoint di health check:

```bash
curl http://localhost:5173/health
# Output: OK
```

Portainer monitorerà automaticamente lo stato del container.

## Struttura File Docker

```
WorkHub/
├── Dockerfile           # Multi-stage production build
├── Dockerfile.dev       # Development con hot reload
├── docker-compose.yml   # Production compose
├── docker-compose.dev.yml # Development compose
├── nginx.conf           # Nginx configuration
├── docker-entrypoint.sh # Entrypoint script
└── .dockerignore        # Files esclusi dal build
```

## Troubleshooting

### Container non si avvia

```bash
# Controlla i logs
docker logs workhub

# Verifica la configurazione nginx
docker exec workhub cat /etc/nginx/nginx.conf
```

### Errore 502 Bad Gateway

Il backend non è raggiungibile. Verifica:
1. Backend in esecuzione: `docker ps | grep backend`
2. Network corretto: `docker network inspect berlink-network`
3. `BACKEND_URL` configurato correttamente

### Errore CORS

Le API devono permettere richieste dal dominio WorkHub. Il proxy nginx dovrebbe gestire il CORS ma verificare la configurazione backend se persistono problemi.

### Cache del browser

Dopo un redeploy, svuotare la cache del browser o fare hard refresh (Ctrl+Shift+R).

## Aggiornamento

```bash
# Pull nuova versione
git pull

# Rebuild e restart
docker-compose build --no-cache
docker-compose up -d
```

In Portainer:
1. Vai allo stack WorkHub
2. Clicca **Pull and redeploy**
