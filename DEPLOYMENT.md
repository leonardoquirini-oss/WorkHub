# WorkHub - Guida al Deployment

## Requisiti

- Docker 20.10+
- Docker Compose v2+
- Network Docker `berlink-network` esistente (stesso network del backend BERLink)

## Sviluppo locale (senza Docker)

```bash
cp .env.example .env      # adattare VITE_KEYCLOAK_URL e VITE_DEV_PROXY_TARGET
npm install
npm run dev               # http://localhost:5173, raggiungibile anche dai tablet in LAN
npm run lint
npm test
npm run build             # tsc + vite build → dist/
```

`vite` inoltra `/api` al backend indicato da `VITE_DEV_PROXY_TARGET` (default `http://localhost:8090`).

## Build e Run con Docker

### Produzione

Richiede `.env` compilato (`cp .env.example .env`): i build args sono obbligatori, la build
fallisce se mancano.

```bash
docker compose build
docker compose up -d
docker compose logs -f workhub
```

## Configurazione

La configurazione ha tre livelli, dal piu' prioritario al meno:

1. **Runtime** — `docker-entrypoint.sh` scrive `/config.js` (`window.__WORKHUB_CONFIG__`) ad ogni avvio del container leggendo le variabili d'ambiente sotto. Permette di cambiare Keycloak/API **senza rebuild** dell'immagine.
2. **Build-time** — le stesse variabili passate come build args (`docker-compose.yml` → `build.args`, letti da `.env`) vengono compilate nel bundle come fallback e sono **obbligatorie**: la build fallisce se mancano (vedi `.env.example`).
3. **Default** — in `src/api/config.ts` (`http://localhost:8080`, `gb-realm`, `berlink-client`, `/api`, sito `1`), usati solo da `npm run dev` senza `.env`.

Una variabile vuota a runtime significa "usa il valore di build".

| Variabile | Default | Descrizione |
|-----------|---------|-------------|
| `VITE_KEYCLOAK_URL` | `http://localhost:8080` | URL Keycloak **raggiungibile dal browser del tablet** (login diretto, non passa dal proxy) |
| `VITE_KEYCLOAK_REALM` | `gb-realm` | Realm Keycloak |
| `VITE_KEYCLOAK_CLIENT_ID` | `berlink-client` | Client pubblico con Direct Access Grants abilitato |
| `VITE_API_URL` | `/api` | Base URL API; lasciare `/api` per usare il proxy nginx (same-origin, niente CORS) |
| `VITE_DEFAULT_SITE_ID` | `1` | Sito selezionato al primo accesso |

Solo runtime (nginx):

| Variabile | Default | Descrizione |
|-----------|---------|-------------|
| `BACKEND_URL` | `http://backend:8080` | Upstream del proxy `/api` (nome del servizio backend sul network Docker) |
| `WORKHUB_PORT` | `5173` | Porta esposta sull'host |

### Keycloak

Nel client `berlink-client` aggiungere l'origin di WorkHub (es. `http://<host>:5173`) in **Web Origins**: il login avviene con `grant_type=password` direttamente dal browser.

## Deploy su Portainer

### Metodo 1: Stack da docker-compose

1. **Stacks** > **Add stack** > **Upload** `docker-compose.yml`
2. **Environment variables**:
   ```
   VITE_KEYCLOAK_URL=http://keycloak.azienda.local:8080
   BACKEND_URL=http://backend:8080
   WORKHUB_PORT=5173
   ```
3. **Deploy the stack**

### Metodo 2: Build locale + push registry

```bash
docker build -t your-registry.com/workhub:2.0.0 .
docker push your-registry.com/workhub:2.0.0
```

Poi in Portainer: **Containers** > **Add container**, image `your-registry.com/workhub:2.0.0`, port `5173:80`, network `berlink-network`, env `VITE_KEYCLOAK_URL` e `BACKEND_URL`.

### Metodo 3: Git repository

Stack da repository con webhook: ad ogni push Portainer rebuilda.

## Network

```bash
docker network create berlink-network
```

## Health check

```bash
curl http://localhost:5173/health      # OK
curl http://localhost:5173/config.js   # window.__WORKHUB_CONFIG__ = {...}
```

## nginx

`nginx.conf` gestisce:
- `/api/` → proxy verso `BACKEND_URL` (timeout 30 s)
- `/api/workhub/yards/{id}/stream` → proxy **senza buffering**, timeout 1 h (Server-Sent Events del piazzale)
- `/config.js` e `/index.html` mai in cache; asset con hash in cache 1 anno
- `/health` → `200 OK`

## Struttura file Docker

```
WorkHub/
├── Dockerfile             # Multi-stage (node:22-alpine → nginx:alpine)
├── docker-compose.yml     # Produzione
├── nginx.conf             # Proxy /api, SSE, SPA fallback
├── docker-entrypoint.sh   # envsubst BACKEND_URL + generazione /config.js
└── .dockerignore
```

Sviluppo locale: `npm run dev` diretto (nessun container hot-reload), come nel frontend BERLink.

## Troubleshooting

**Container non si avvia**: `docker logs workhub`; `docker exec workhub cat /etc/nginx/nginx.conf`.

**502 Bad Gateway**: backend non raggiungibile. Verificare `docker ps | grep backend`, `docker network inspect berlink-network`, `BACKEND_URL`.

**Login fallisce / CORS su Keycloak**: `VITE_KEYCLOAK_URL` deve essere raggiungibile dal tablet e l'origin di WorkHub deve essere tra i Web Origins del client Keycloak. Controllare `curl http://localhost:5173/config.js`.

**Config non aggiornata dopo cambio env**: `docker compose up -d --force-recreate` (il file `/config.js` viene rigenerato all'avvio; il browser non lo mette in cache).

**Eventi realtime non arrivano**: verificare che la richiesta a `/api/workhub/yards/{id}/stream` resti aperta (`docker logs workhub`, nessun timeout) e che il backend BERLink esponga lo stream.

## Aggiornamento

```bash
git pull
docker compose build --no-cache
docker compose up -d
```

In Portainer: stack WorkHub > **Pull and redeploy**.
