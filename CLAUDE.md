# WorkHub - Claude Code Reference

App tablet per il **piazzalista**: gestione in tempo reale dei container sui piazzali (slot bay/row/tier), condivisa tra piu' dispositivi. Client separato di BERLink: parla con il backend BERLink (`/api/workhub/*`) e con Keycloak.

## Stack

| Layer | Tecnologia |
|-------|------------|
| UI | React 18 + TypeScript strict, Vite 5, Tailwind 3 |
| 3D | three.js + @react-three/fiber + drei (InstancedMesh per tipo container, `frameloop="demand"`) |
| State | zustand (`yardStore` dati + mutazioni ottimistiche, `uiStore` UI, `authStore` sessione/ruoli) |
| Realtime | SSE `GET /api/workhub/yards/{id}/stream` (`services/yardEvents.ts`) + polling di fallback 15 s |
| Auth | Keycloak password grant (`api/authApi.ts`), refresh unico in `api/WorkHubAPI.ts` |
| Test/lint | vitest (`npm test`), ESLint 9 flat (`npm run lint`), `tsc` in `npm run build` |
| Deploy | Docker multi-stage → nginx (`nginx.conf`: proxy `/api`, SSE senza buffering, `/config.js` runtime) |

## Struttura `src/`

```
api/        config.ts (runtime > VITE_* > default), authApi.ts, WorkHubAPI.ts (ApiError con status/body/currentData)
constants/  roles.ts (WRITE = cd,logs,resources; ADMIN = cd), containerSizes.ts, yardConfig.ts
services/   yardEvents.ts (SSE, backoff, polling, pausa tab nascosto)
store/      yardStore.ts, uiStore.ts, authStore.ts, notificationStore.ts
utils/      slotLayout.ts (regole slot: span 2 sul bay dispari, colonna omogenea, tier=top+1, cascadePreview), logger.ts, registry.ts, format.ts
hooks/      useSlotDrag.ts (tap = seleziona, long-press 300 ms = presa, doppio tap/destro = menu colonna), useYardEvents.ts, usePlacePending.ts, useMediaQuery.ts
components/ 3d/ (Yard3D, Block3D, ContainersInstanced, SlotHighlight, ContainerLabels, PulseMarker, Controls, Grid3D, YardAreas3D)
            2d/MapView2D.tsx · ui/ (Toolbar, ContainerPanel, ContainerEditForm, ContainerHistory, ContainerList, ContainerContextMenu, FindContainer, AddContainerModal, StatusBanners, ConfirmDialog, ErrorBoundary, Toast) · layout/
types/      container.ts, yard.ts (Block, YardSnapshot, YardEvent), auth.ts
```

## Regole di dominio (specchio del backend `YardSlotService`)

- Posizione = slot `id_block, bay, row_no, tier` (1 = terra). Label `PIAZZALE-BLOCCO-BAY-ROW`; "N° dall'alto" = `pos_from_top` (derivato dal server).
- `20'/30'` occupano 1 bay (convenzione TEU); `40/40HC/45HC` occupano 2 bay a partire da un bay **dispari**. Una colonna e' omogenea per ingombro.
- Il client valida in locale (`slotLayout.canPlace`) solo per l'anteprima: la verita' e' il server. Ogni mutazione manda `version`; **409** → rollback + `loadSnapshot()`.
- Riordino dentro la colonna (`POST /containers/{n}/restack`, `slotLayout.restackPreview`): scambio con il container sotto/sopra e risalita in cima; chi sta in mezzo scala di un livello. Fuori colonna si usa `/move`.
- Spostamenti solo nello stesso sito; cambio sito = uscita + nuovo ingresso. La cascata (chi sta sopra scende) e' server-side: il client la applica dalla risposta/evento.
- `position_x/y/z` del server sono cache: il rendering usa `slotLayout.slotToWorld`.
- **Da far uscire**: se `id_exit_availability` e' valorizzato, in RCS l'ultima riga di registro di
  quella cassa risulta scaricata (>= 95%): la merce non c'e' piu' ma la cassa e' in piazzale. Il
  marchio e' **derivato dal backend** (mai scritto dall'app) e si mostra con la cassa a scacchi
  bianco/rosso in 3D e in mappa (`utils/exitMark.ts`, `utils/checkerTexture.ts`); vince sul colore
  di stato, che resta nel pannello e in lista.

## Contratto API

Riferimento: `../BERLink/prompt/API.md` §26 e `WORKHUB_DEV_PLAN_20260916.md` (sezione "Contratto API v2"). Risposte `ApiResponse<T>` snake_case; 409 di lock ottimistico con `currentData` alla radice.

## Comandi

```bash
npm run dev      # http://localhost:5173, /api → VITE_DEV_PROXY_TARGET (default http://localhost:8090)
npm run build    # tsc + vite build (+ PWA)
npm run lint
npm test
docker compose build && docker compose up -d   # vedi DEPLOYMENT.md
```

## Convenzioni per Claude Code

1. Niente `console.*`: usare `utils/logger.ts` (debug solo in dev).
2. Funzioni ≤ 100 righe, DRY: regole di slot solo in `utils/slotLayout.ts`, chiamate HTTP solo in `api/WorkHubAPI.ts`.
3. Mutazioni sempre ottimistiche con rollback (pattern in `yardStore.ts`); mai fidarsi dello stato locale per la validazione finale.
4. UI in italiano; gating con `useAuthStore().canWrite`/`isAdmin`; in sola lettura nascondere le azioni, non solo disabilitarle.
5. Nessuna configurazione hardcoded: `api/config.ts` legge `window.__WORKHUB_CONFIG__` (generato da `docker-entrypoint.sh`), poi `VITE_*`.
6. Nuove regole di dominio: prima nel backend BERLink (`YardSlotService` + test), poi specchiate in `slotLayout.ts` con test vitest.
7. Cambi di contratto API: aggiornare `types/`, `WorkHubAPI.ts`, `../BERLink/prompt/API.md` §26.

## Quando chiedere all'utente

- Nuove regole operative di piazzale (es. pesi, tipi non ISO), nuovi ruoli Keycloak, requisiti di performance su tablet specifici.
