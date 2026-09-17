# WorkHub v2 — Piano di miglioramento/sviluppo (piazzale container in tempo reale)

## Context

WorkHub (`/mnt/c/Projects/GIT/BERLinkPlatform/WorkHub`) e' un'app React 18 + TypeScript + Vite + Three.js (@react-three/fiber) + zustand, ~4.4k righe, creata a gennaio 2026 come viewer/editor 3D del piazzale container. Parla con BERLink via `/api/workhub/*` e con Keycloak (password grant). Obiettivo: strumento del **piazzalista** su tablet per gestire in tempo "reale" i container presenti sui piazzali aziendali e condividere facilmente "quali container ci sono e dove sono".

Decisioni prese con l'utente (2026-09-16):
1. **WorkHub (`wrk_*`) diventa l'unica fonte di verita'** della posizione container nel sito. La vecchia gestione **"stive" RCS (`gb_site_bulks`) va rimossa** da BERLink (backend, frontend, DB); la colonna "Stiva" delle operazioni RCS viene sostituita dalla posizione WorkHub in sola lettura.
2. Convenzione operativa: **posizione 1 = cima della pila**; togliendo un container le posizioni si ricalcolano. Internamente si memorizza il tier da terra; "posizione dall'alto" e' derivata.
3. **Modifiche al backend BERLink in scope** (endpoint, tabelle, eventi Valkey → SSE).
4. Ruoli: **scrittura = `cd`, `logs`, `resources`**; altri ruoli in sola lettura; la UI applica il gating.

## Stato attuale — cosa ho trovato

### WorkHub client (repo WorkHub)
- **Build rotta**: `npx tsc --noEmit` → 15 errori (import inutilizzati; `NodeJS.Timeout` in `src/components/ui/AddContainerModal.tsx:34`; `e.nativeEvent.target.clientWidth` in `src/hooks/useContainerDrag.ts:41-42`; `id_yard: selectedYardId` null vs undefined in `:147`). `npm run lint` rotto: nessun config ESLint. Nessun test. `.env` tracciato in git. IP `192.168.0.12` hardcoded in `vite.config.ts`, `Dockerfile`, `docker-entrypoint.sh`, `src/api/config.ts`. Il runtime-config (`window.__WORKHUB_CONFIG__` generato da `docker-entrypoint.sh`) non e' letto da nessuno.
- **50 `console.log`** di debug; il peggiore in `src/utils/stackingLogic.ts:29-47` logga tutti i container ad ogni chiamata nel loop di drag/gravita' (O(n²) durante il drag).
- **Modello posizioni**: metri liberi (angolo min AABB), `position_z` = altezza in metri, snap su `grid_cell_size` 2.4 m che non e' multiplo delle lunghezze container (6.1/12.2/13.7) → mai allineati; drag senza grab-offset.
- **Rotazione bypassa ogni validazione** (`src/components/ui/ContainerPanel.tsx:35-50`).
- **Gravita' duplicata** (`src/utils/gravityLogic.ts:15-94` vs `:163-238`); `src/store/yardStore.ts:134-190` fa 1+N PUT sequenziali e **inghiotte gli errori**. Nessun update ottimistico ne' rollback.
- **Nessun tempo reale**: container caricati una volta; niente polling/SSE; due tablet si sovrascrivono in silenzio.
- **Auth**: due path di refresh indipendenti (`src/store/authStore.ts:29-53`, `src/api/WorkHubAPI.ts:22-46`); logout non pulisce localStorage; ruoli letti da `realm_access.roles` (`src/api/authApi.ts:20-29`) ma BERLink li mette in `resource_access.berlink-client.roles` → gating ruoli oggi impossibile; **tutti scrivono**.
- **Codice morto**: `hooks/useTouchGestures.ts`, `utils/performance.ts` (qualita' adattiva tablet, mai usato), `utils/rotation.ts`, `utils/cameraPresets.ts`, `utils/persistence.ts`, `ui/ConfirmDialog.tsx`, `ui/LoadingSpinner.tsx`, `ui/ErrorBoundary.tsx` (mai montato → white screen su errore Canvas), dep `@use-gesture/react`.
- **Tablet**: nessun `touch-action`, nessun breakpoint (pannelli assoluti a larghezza fissa), `confirm()` nativo. **Performance**: mesh + 4 label troika per container, geometrie per render, `setState` per frame, niente instancing/dpr.
- Funziona: login, sito/piazzale, scena 3D con aree, selezione, drag con anteprima, stacking ≥50% supporto, gravita', preset camera, statistiche, ricerca registro (`/api/units/search`) nella modale "Aggiungi" (solo auto-posizionamento).

### BERLink backend — modulo WorkHub (`backend/src/main/java/com/containermgmt/`)
- `controller/WorkhubController.java`: `/api/workhub`, `@PreAuthorize("hasAnyRole('cd','logs','resources')")` di classe (nessuna distinzione R/W). 7 endpoint. **Nessun DTO** (`Map<String,Object>`), validazione a mano in `service/WorkhubService.java:188-296`.
- DDL `database/sql/002_DB_DDL.sql:3128-3175`: `wrk_yards`, `wrk_yard_areas`, `wrk_containers` (PK `container_number`). Mancano `updated_at`/`version`, indice `id_yard`, unicita' posizione, storico. **Nessuna API CRUD piazzali/aree**, **nessun evento** su spostamento. Infrastruttura riusabile: Valkey pub/sub → SSE (`NotificationService.java:79`, `SseEmitterManager`, `config/NotificationPubSubConfig.java`), `GET /api/notifications/stream` con `?access_token=` ammesso da `config/SecurityConfig.java:79-92`; `exception/OptimisticLockException` → 409 con `currentData` (`GlobalExceptionHandler.java:83-91`); transazioni con `Base.openTransaction()` (pattern `DevSyncService.java:169-190`); `ContainerRegistryService.resolveByCode/resolveByCodes` (:188/:205) per la forma canonica del numero container.
- **Nessun legame** con registro container, `evt_unit_last_position`, note, danni, operazioni RCS (`ctr_availability`, condizione "in giacenza" in `util/OperationQueryUtil.buildInStockCondition`). Il frontend SvelteKit **non consuma** `/api/workhub`.
- CORS `cors.allowed-origins` literal in `application.yml:86-87`; irrilevante se WorkHub usa il proxy nginx same-origin (da verificare in deploy). `nginx.conf` WorkHub: `proxy_read_timeout 30s` + buffering → SSE morirebbe dopo 30 s.

### BERLink — feature "stive" legacy da rimuovere
- DB: `gb_site_bulks` + `s_gb_site_bulks` (`002_DB_DDL.sql:57,1848-1860,2388`), seed `005_DB_DML.sql:413-452`, `008_DB_INDEX.sql:1`, `010_OPTIMISTIC_LOCKING.sql` (intero file).
- Backend: `model/SiteBulk.java`, `service/SiteManagementService.java`, `controller/OperationController.java:245-279`, `service/OperationService.java` (:15, :243, :323, :551-553, :625, :676-750, :848-891), `controller/ExportController.java:208-240`, `service/ExportService.java:81-89`, `service/export/DashboardExcelExporter.java:104-215`. Test: `OperationControllerTest.java:645-700`, `ExportControllerTest.java:188-210`, `ExportServiceTest.java:135-145`, `OperationServiceIntegrationTest.java` (:73-75, :100-110, :188-200, :590-607).
- Frontend: `routes/rcs/dashboard/+page.svelte` (tab stive), `components/OperationForm.svelte` (:3, :42, :133-215, :505-535, :686-750), `components/OperationsTable.svelte` (:16, :420-422), `lib/api/modules/operations.js` (:243, :271, :290), `lib/stores/rcsColumnPrefs.js:22`.
- Docs: `prompt/API.md` §9 (:562) e §13, `etc/stuff/README.md:284-301`, `etc/stuff/API_DOCUMENTATION.md`, `IMPLEMENTATION_NOTES.md`.
- **Non toccare** (falsi positivi): "Soste Ctr **Bulk**" (`rcs/+page.svelte:764,801`, `exportSosteCtrBulkToExcel`) = merce sfusa; "bulk" in Planning/Km = batch; `bookingForm.js` "Bulker".
- Bug latente che sparisce: `SiteManagementService.updateContainerBulkId` scrive `bulk_id` su `ctr_availability` che **non ha** quella colonna.

## Architettura target

```
Tablet piazzalista (WorkHub React)          Ufficio (BERLink SvelteKit)
   │ REST + SSE /api/workhub/…                   │ REST lookup-positions
   ▼                                             ▼
BERLink backend — WorkhubController (DTO + @Valid, ruoli READ/WRITE/ADMIN)
   │  YardSlotService: validazione slot, cascata, lock ottimistico, storico (1 transazione)
   │  YardEventPublisher → Valkey pub/sub workhub:yard:{id} → SSE per piazzale
   ▼
PostgreSQL: wrk_yards(+code,revision) · wrk_yard_areas · wrk_yard_blocks (griglia bay×row×tier)
            wrk_containers(+slot, version) · wrk_container_movements
```

Principio: la posizione e' uno **slot nominato** `Piazzale-Blocco-Bay-Row` + tier (mostrato come "N° dall'alto"), non coordinate libere. `position_x/y/z` restano come **cache calcolata dal server** per il renderer 3D.

### Scelte di design (verificate sul codice)

| Tema | Scelta | Perche' |
|---|---|---|
| Blocchi | Nuova tabella `wrk_yard_blocks` (non estendere `wrk_yard_areas`) | Le aree sono overlay visivi; un blocco ha griglia, origine, orientamento. FK opzionale area→colore. |
| Footprint 40'/45' | `bay_span=2`, registrato sul bay **dispari** (b, b+1) | Convenzione ISO; unicita' slot con `EXCLUDE USING gist` su `int4range(bay, bay+bay_span)` (`btree_gist`; estensioni gia' ammesse, c'e' PostGIS) + `pg_advisory_xact_lock(id_block)` come cintura. |
| Stack misti 20' su 40' | **Vietati**: tier N+1 deve avere stesso `bay`/`bay_span` di tier N | Regola semplice e verificabile. |
| Concorrenza | `version` su `wrk_containers`; move/patch/exit richiedono `version` → 409 con `currentData` | Handler gia' esistente. |
| Cascata | **Server-side**, una transazione: chi sta sopra scende di 1 tier, riga `CASCADE` nello storico | Elimina 1+N PUT dal client e gli errori inghiottiti. |
| Batch move | No | Sul tablet si sposta un container alla volta. |
| Uscita | Hard delete + riga `EXIT` nello storico | Uno status "uscito" romperebbe l'esclusivita' dello slot. |
| Numero container | `ContainerRegistryService.resolveByCode` → `cassa` canonico + `registry_match=true`; altrimenti uppercase/trim + `registry_match=false` + warning | `ContainerNumberFormatter.formatForSearch` produce un pattern, non una forma canonica. |
| Tipo container | Se omesso, dal `tipo` del registro | Evita errori di input. |
| Ruoli | WRITE `cd,logs,resources` · READ `cd,logs,resources,po,hr,hr_resources,amst,coin,ro_rm,read` · ADMIN (yard/blocchi) `cd` | READ = unione ruoli di `ContainerInfoLookupController:27` e `UnitController:92`, esclusi `ml`,`po_approval`,`write`. |
| Posizione dall'alto | Derivata in SQL: `MAX(tier) OVER (PARTITION BY id_block,row_no,bay) - tier + 1` | Non persistere. |
| Cross-sito | Move solo tra yard dello **stesso sito**; cambio sito = exit + enter | Traccia coerente nello storico. |
| Label | `{yard.code}-{block.code}-{bay:02}-{row:02}` + "T{tier} (N° dall'alto)"; UI abbrevia il piazzale se il sito ne ha uno solo | Comunicabile a voce/telefono. |

---

## Stato avanzamento

| Fase | Stato | Note |
|---|---|---|
| 0 | **Completata** 2026-09-16 | `tsc` 0 errori, `eslint .` 0 problemi, `vitest` 10/10, `npm run build` OK, `dist/config.js` generato. `.env` non era tracciato (nessun `git rm` necessario). |
| 1 | **Completata** 2026-09-16 (test: `WorkhubControllerTest` 20/20, `YardSlotServiceIntegrationTest` 9/9 su Testcontainers) | Backend BERLink: migrazione `2.6.0` + mirror DDL/indici, model `YardBlock`/`ContainerMovement` (+`@IdGenerator` su `Yard`/`YardArea`), DTO `@Valid`, `SlotGeometry`/`SlotLabel`, `YardSlotRepository`/`YardAdminRepository`, `YardSlotService` (enter/move/patch/exit/history/lookup, tx + lock + cascata), `YardAdminService`, `YardEventPublisher` + `YardSseEmitterManager` + `WorkhubPubSubConfig`, `WorkhubRoles`, `SecurityConfig` (token in query su stream), controller `Workhub`/`WorkhubAdmin`/`WorkhubStream`, API.md §26 riscritto. Test: `SlotGeometryTest` 5/5, `SlotLabelTest` 3/3, `WorkhubAdminControllerTest` 5/5. |
| 2 | **Completata** 2026-09-16 (`npm run build && lint && test`: tsc 0, eslint 0, vitest 29/29; PWA; chunk three/r3f/app separati) | Client WorkHub a slot: `utils/slotLayout.ts` (+15 test), `services/yardEvents.ts` (SSE + backoff + polling 15 s), `hooks/useSlotDrag.ts` (long-press), `3d/{Block3D,ContainersInstanced,SlotHighlight,ContainerLabels,PulseMarker}`, `2d/MapView2D`, `ui/{ContainerList,FindContainer,ContainerEditForm,ContainerHistory,StatusBanners}`, store ottimistico con rollback su 409, gating ruoli, drawer portrait. Decisioni: `tier` inviato esplicito (= top+1 locale; 409 se cambia), altezze 3D dalle altezze reali dei tipi, ingresso = modale + tap su slot libero. Eliminati gravity/stacking/collision/useContainerDrag/Container3D. **Da verificare dal vivo** col backend: 409 `currentData`, evento SSE `yard`, `label`/`pos_from_top`. |
| 3 | In corso | Sostituto pronto: colonna "Posizione piazzale" in `OperationsTable` (lookup batch via `lib/api/modules/workhub.js`), `rcsColumnPrefs` con migrazione chiave `bulk_name→yard_position`. Rimossi: tab "Dashboard Stive", modale stiva in `OperationForm`, funzioni stive in `operations.js`, `SiteManagementService`, `SiteBulk`, allocazione stive in `OperationService`, export stive; endpoint `/sites/{id}/bulks`, `/bulks/move`, `/export/bulks` → **410**; `010_OPTIMISTIC_LOCKING.sql` eliminato; DDL/DML/indici ripuliti; migrazione `2.6.1_drop_gb_site_bulks.sql` (backup `zz_bak_gb_site_bulks`); API.md §9/§13 + README aggiornati. **Completata** 2026-09-16: `OperationControllerTest` 41/41, `ExportControllerTest` 16/16, `ExportServiceTest` 13/13, `OperationServiceIntegrationTest` 24/24, frontend BERLink `npm run build` OK. |
| 4 | **Completata (parte in scope)** 2026-09-16 | Admin BERLink: pagina `/admin/workhub` (voce "Piazzali WorkHub" nel menu Sistema, ruolo `cd`) con selettore sito, card per piazzale, anteprima SVG in scala (aree + blocchi), tabella blocchi, modali `WorkhubYardModal`/`WorkhubBlockModal` (validazione, avviso "blocco fuori piazzale", nota bay dispari); API in `lib/api/modules/workhub.js`. Health `GET /api/health/ready` espone `workhubSse{activeYards, activeConnections}`. Docs: `IMPLEMENTATION_NOTES.md` #45, `DEPLOYMENT.md` WorkHub (config runtime, Keycloak Web Origins, nginx SSE), nuovo `CLAUDE.md` specifico WorkHub. **Non fatto (opzionali, da confermare)**: import stive legacy (non richiesto), inbox RCS "da posizionare", pulizia differita degli stub 410 e di `PUT/DELETE /containers/{n}`. |

### Verifiche eseguite (2026-09-16)

| Cosa | Esito |
|---|---|
| WorkHub `npm run build` / `lint` / `test` | OK / 0 problemi / 29/29 (6 file) |
| BERLink backend `mvn -Ptest test` (suite completa) | 2015 test, 0 failure, 4 error solo in `GoogleMapsClientIntegrationTest`/`OpenRouteServiceClientIntegrationTest` (chiavi API esterne assenti, pre-esistenti) |
| BERLink WorkHub test | `SlotGeometryTest` 5, `SlotLabelTest` 3, `WorkhubControllerTest` 20, `WorkhubAdminControllerTest` 5, `YardSlotServiceIntegrationTest` 9 (Testcontainers PostGIS), `MetadataControllerTest` 10 |
| BERLink RCS dopo rimozione stive | `OperationControllerTest` 41, `ExportControllerTest` 16, `ExportServiceTest` 13, `OperationServiceIntegrationTest` 24 |
| BERLink frontend `npm run build` | OK |

### Da fare dal vivo (non eseguibile in questa sessione: stack Keycloak/Valkey/DB non avviato)
1. Applicare `database/migration/2.6.0_wrk_blocks_slots.sql` (richiede `CREATE EXTENSION btree_gist`: utente con privilegi) e poi `2.6.1_drop_gb_site_bulks.sql` (crea prima `zz_bak_gb_site_bulks`).
2. Keycloak: aggiungere l'origin di WorkHub ai **Web Origins** di `berlink-client`; verificare che gli utenti piazzalisti abbiano `resources` o `logs` come **client role**.
3. Creare piazzali e blocchi da `/admin/workhub` (ruolo `cd`); i container `wrk_containers` pre-esistenti senza `id_block` restano "da allocare".
4. Smoke test a due tablet (scenario nella sezione "Verifica end-to-end finale"): 409 con `currentData`, evento SSE `yard`, `label`/`pos_from_top`, cascata.
5. Nessun commit eseguito: revisionare `git status` nei due repo e committare (WorkHub: master; BERLink: branch corrente).

## Contratto API v2 (riferimento per Fase 1 e Fase 2)

Tutte le risposte sono `ApiResponse<T>` = `{ success, data, message?, errors?, metadata }`. Chiavi JSON in **snake_case**.

```jsonc
// GET /api/workhub/yards/{id}/snapshot
{ "success": true, "data": {
  "revision": 42,
  "yard": { "id_yard": 1000, "id_site": 1, "code": "PZ1", "name": "Piazzale A", "width": 100, "length": 50,
            "max_stack_height": 5, "is_active": true,
            "areas": [ { "id_yard_area": 1000, "name": "Zona Import", "area_type": "import",
                         "start_x": 0, "start_y": 0, "end_x": 50, "end_y": 25, "color": "#3B82F6" } ],
            "blocks": [ { "id_block": 1000, "id_yard": 1000, "id_yard_area": 1000, "code": "A", "name": "Blocco A",
                          "origin_x": 2, "origin_y": 2, "orientation": 0, "n_bays": 10, "n_rows": 4, "max_tier": 5,
                          "bay_length": 6.1, "row_width": 2.4, "gap": 0.3, "color": "#3B82F6", "is_active": true } ] },
  "containers": [ { "container_number": "GBTU 028123.5", "id_yard": 1000, "id_block": 1000, "bay": 3, "bay_span": 2,
                    "row_no": 2, "tier": 1, "pos_from_top": 2, "label": "PZ1-A-03-02", "container_type": "40HC",
                    "position_x": 14.8, "position_y": 4.7, "position_z": 0, "rotation": 0, "weight": null,
                    "content_description": null, "color": "#EF4444", "notes": null, "status": "active",
                    "version": 3, "registry_match": true, "updated_at": "2026-09-16T10:00:00", "updated_by": "m.rossi" } ] } }

// POST /api/workhub/containers  (ENTER)
{ "container_number": "GBTU 028123.5", "id_block": 1000, "bay": 3, "row_no": 2, "tier": null,
  "container_type": "40HC", "weight": null, "content_description": null, "color": "#EF4444", "notes": null, "status": "active" }
// → 201 { data: <container>, message: "Container non presente nel registro: salvato come GBTU 028123.5" (solo se registry_match=false) }

// POST /api/workhub/containers/{n}/move
{ "id_block": 1000, "bay": 5, "row_no": 1, "tier": null, "version": 3, "note": null }
// → 200 { data: { "moved": <container>, "cascaded": [ <container>, ... ], "revision": 43 } }

// PATCH /api/workhub/containers/{n}
{ "status": "damaged", "notes": "porta ammaccata", "version": 4 }   // → 200 { data: <container> }

// POST /api/workhub/containers/{n}/exit
{ "version": 5, "note": "uscito con BG 26A00048" }                  // → 200 { data: { "cascaded": [...], "revision": 44 } }

// POST /api/workhub/containers/lookup-positions   body: ["GBTU 028123.5", "MSKU1234567"]
// → 200 { data: { "GBTU 028123.5": { "label": "PZ1-A-03-02", "id_yard": 1000, "yard_name": "Piazzale A",
//                  "block_code": "A", "bay": 3, "row_no": 2, "tier": 1, "pos_from_top": 2 } } }   // assenti = non in piazzale

// GET /api/workhub/containers/{n}/history?limit=50
// → 200 { data: [ { "id_movement": 1, "container_number": "...", "action": "MOVE", "label_from": "PZ1-A-03-02", "label_to": "PZ1-A-05-01",
//                   "id_yard_from": 1000, "id_yard_to": 1000, "tier_from": 1, "tier_to": 1, "username": "m.rossi", "note": null, "created_at": "..." } ] }

// 409 per version stale (OptimisticLockException → GlobalExceptionHandler): currentData al livello radice
{ "success": false, "message": "Container modificato da un altro utente", "currentData": <container aggiornato> }
// 409 per slot occupato / regola violata (IllegalStateException): { "success": false, "message": "Slot A-05-01 T1 occupato da MSKU1234567" }

// SSE GET /api/workhub/yards/{id}/stream?access_token=...   eventi: "connected" (data: ok), poi "yard":
{ "type": "MOVE", "id_yard": 1000, "revision": 43, "containers": [ <container>, ... ], "removed": [], "by": "m.rossi", "at": "2026-09-16T10:00:00" }
// type ∈ ENTER | MOVE | EXIT | UPDATE | LAYOUT (LAYOUT: ricaricare snapshot)
```

## Fase 0 — Stabilizzazione client WorkHub (repo WorkHub) — ~2-3 gg

Obiettivo: build verde, lint, test, config runtime funzionante, un solo refresh token.

1. Fix TS: import inutilizzati; `AddContainerModal.tsx:34` → `ReturnType<typeof setTimeout>`; `useContainerDrag.ts:39-46` → usare `e.ray.intersectPlane(...)` di R3F (via il `Raycaster` manuale); `:147` → `selectedYardId ?? undefined`.
2. `eslint.config.js` flat (typescript-eslint v8, react-hooks, react-refresh); eslint 9; script `lint` senza `--ext`.
3. `vitest` (+ `@testing-library/react` solo se serve): test per `authApi.parseJwt/extractUserFromToken`, `collisionDetection`. Script `test`.
4. `src/utils/logger.ts` (`debug` solo con `import.meta.env.DEV`); sostituire i 50 `console.*`.
5. Eliminare: `hooks/useTouchGestures.ts`, `utils/rotation.ts`, `utils/cameraPresets.ts`, `utils/persistence.ts`, `ui/LoadingSpinner.tsx`; `npm uninstall @use-gesture/react`. Tenere `utils/performance.ts`, `ConfirmDialog.tsx`, `ErrorBoundary.tsx` (montati in Fase 2).
6. `git rm --cached .env`; aggiornare `.env.example`.
7. Config: `vite.config.ts` → `loadEnv` + `VITE_DEV_PROXY_TARGET` (default `http://localhost:8090`); `Dockerfile` ARG neutri; `docker-entrypoint.sh` genera **sempre** `config.js`; `index.html` carica `/config.js`; `src/api/config.ts` legge `window.__WORKHUB_CONFIG__` prima di `import.meta.env`; global in `vite-env.d.ts`.
8. Auth: un solo refresh in `WorkHubAPI.ensureValidToken` con callback verso `authStore` + localStorage; rimuovere il `setInterval` (`authStore.ts:29-53`); `logout` chiama `clearStoredAuth()`; 401 → logout; ruoli da `resource_access[clientId].roles` (fallback `realm_access`).
9. `nginx.conf`: location `~ ^/api/workhub/yards/[0-9]+/stream$` con `proxy_buffering off; proxy_cache off; proxy_read_timeout 3600s; proxy_set_header Connection ''; access_log off` (verificare che `envsubst` nell'entrypoint sostituisca solo `${BACKEND_URL}`).
10. Montare `ErrorBoundary` in `main.tsx`.

Verifica: `npm run build` 0 errori, `npm run lint`, `npm test`, `docker compose build && up` → `curl localhost:5173/config.js`.

---

## Fase 1 — Backend BERLink: modello a slot, API, storico, SSE — ~8-10 gg

### DDL — `database/migration/2.6.0_wrk_blocks_slots.sql` (idempotente; mirror in `002_DB_DDL.sql`, `008_DB_INDEX.sql`)

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE SEQUENCE IF NOT EXISTS s_wrk_yard_blocks START 1000;
CREATE SEQUENCE IF NOT EXISTS s_wrk_container_movements START 1000;

ALTER TABLE wrk_yards ADD COLUMN IF NOT EXISTS code varchar(10);
ALTER TABLE wrk_yards ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 0;
UPDATE wrk_yards SET code = 'PZ' || id_yard WHERE code IS NULL;
ALTER TABLE wrk_yards ALTER COLUMN code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_wrk_yards_site_code ON wrk_yards(id_site, code);

CREATE TABLE IF NOT EXISTS wrk_yard_blocks (
  id_block     integer NOT NULL,   -- id da @IdGenerator("nextval('s_wrk_yard_blocks')") sul model
  id_yard      integer NOT NULL,
  id_yard_area integer,
  code         varchar(10) NOT NULL,
  name         varchar(100),
  origin_x     numeric(10,2) NOT NULL DEFAULT 0,
  origin_y     numeric(10,2) NOT NULL DEFAULT 0,
  orientation  integer NOT NULL DEFAULT 0 CHECK (orientation IN (0,90)),
  n_bays       integer NOT NULL CHECK (n_bays > 0),
  n_rows       integer NOT NULL CHECK (n_rows > 0),
  max_tier     integer NOT NULL DEFAULT 5 CHECK (max_tier BETWEEN 1 AND 8),
  bay_length   numeric(10,2) NOT NULL DEFAULT 6.1,
  row_width    numeric(10,2) NOT NULL DEFAULT 2.4,
  gap          numeric(10,2) NOT NULL DEFAULT 0.3,
  color        varchar(7),
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamp DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_wrk_yard_blocks PRIMARY KEY (id_block),
  CONSTRAINT fk_wrk_yard_blocks_yard FOREIGN KEY (id_yard) REFERENCES wrk_yards(id_yard),
  CONSTRAINT fk_wrk_yard_blocks_area FOREIGN KEY (id_yard_area) REFERENCES wrk_yard_areas(id_yard_area),
  CONSTRAINT uq_wrk_yard_blocks_code UNIQUE (id_yard, code)
);

ALTER TABLE wrk_containers
  ADD COLUMN IF NOT EXISTS id_block integer,
  ADD COLUMN IF NOT EXISTS bay integer,
  ADD COLUMN IF NOT EXISTS bay_span integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS row_no integer,
  ADD COLUMN IF NOT EXISTS tier integer,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamp,
  ADD COLUMN IF NOT EXISTS updated_by varchar(100),
  ADD COLUMN IF NOT EXISTS registry_match boolean;
ALTER TABLE wrk_containers ADD CONSTRAINT fk_wrk_containers_block FOREIGN KEY (id_block) REFERENCES wrk_yard_blocks(id_block);
ALTER TABLE wrk_containers ADD CONSTRAINT ck_wrk_containers_span CHECK (bay_span IN (1,2));
ALTER TABLE wrk_containers ADD CONSTRAINT ck_wrk_containers_slot_complete
  CHECK (id_block IS NULL OR (bay IS NOT NULL AND row_no IS NOT NULL AND tier IS NOT NULL AND tier >= 1));
ALTER TABLE wrk_containers ADD CONSTRAINT ex_wrk_containers_slot
  EXCLUDE USING gist (id_block WITH =, row_no WITH =, tier WITH =, int4range(bay, bay + bay_span) WITH &&)
  WHERE (id_block IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_wrk_containers_yard  ON wrk_containers(id_yard);
CREATE INDEX IF NOT EXISTS idx_wrk_containers_block ON wrk_containers(id_block, row_no, bay, tier);

CREATE TABLE IF NOT EXISTS wrk_container_movements (
  id_movement      integer NOT NULL,   -- id da @IdGenerator("nextval('s_wrk_container_movements')") sul model
  container_number varchar(50) NOT NULL,
  action           varchar(10) NOT NULL CHECK (action IN ('ENTER','MOVE','CASCADE','EXIT','UPDATE')),
  id_yard_from integer, id_block_from integer, bay_from integer, row_from integer, tier_from integer,
  id_yard_to   integer, id_block_to   integer, bay_to   integer, row_to   integer, tier_to   integer,
  username         varchar(100) NOT NULL,
  note             text,
  created_at       timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_wrk_container_movements PRIMARY KEY (id_movement)
);
CREATE INDEX IF NOT EXISTS idx_wrk_movements_container ON wrk_container_movements(container_number, created_at DESC);
```
Container esistenti senza `id_block` = "da allocare" (visibili in lista, non in griglia).

### Regole di dominio (`service/YardSlotService.java`)
- `bay_span` 1 per `20`, 2 per `40/40HC/45HC`; span 2 ⇒ `bay` dispari e `bay+1 ≤ n_bays`.
- `tier` omesso ⇒ `top+1` della colonna; `tier ≤ max_tier`; supporto: `tier=1` o container a `tier-1` con stesso bay/bay_span.
- Slot libero: nessun overlap sulla colonna (anche DB: EXCLUDE → `PSQLException 23P01` → `IllegalStateException` 409).
- Move con container sopra ⇒ cascata (`tier > tier_from` scendono di 1, `version+1`, riga `CASCADE`). Sorgente = destinazione ⇒ 400.
- Geometria (`util/SlotGeometry.java`, pura): `x = origin_x + (bay-1)*(bay_length+gap)`, `y = origin_y + (row-1)*(row_width+gap)` (scambiati se `orientation=90`), `z = (tier-1)*2.6`, `rotation = orientation`. Label in `util/SlotLabel.java`.
- Tutto in `Base.openTransaction()`: `SELECT ... FOR UPDATE` sul container, `pg_advisory_xact_lock(id_block)` (blocchi ordinati per id), bump `wrk_yards.revision`, `updated_by = Authentication.getName()`, publish evento **dopo** commit.

### Endpoint (`/api/workhub`; DTO in `dto/request/workhub/*` con `@Valid`, snake_case come `DeadlineCreateRequest`)

| Metodo | Path | Ruoli | Request → Response |
|---|---|---|---|
| GET | `/sites`, `/containers?siteId\|yardId`, `/containers/{n:.+}` | READ | invariati + campi slot/label/version |
| GET | `/yards?siteId` | READ | + `code`, `revision`, `blocks[]`, `areas[]` |
| GET | `/yards/{id}/snapshot` | READ | `{revision, yard{blocks,areas}, containers[{…,id_block,bay,bay_span,row_no,tier,pos_from_top,label,version,registry_match}]}` |
| GET | `/yards/{id}/stream?access_token=` | READ | SSE: `connected`, poi eventi `yard` |
| GET | `/containers/{n:.+}/history?limit=50` | READ | `List<MovementDTO>` |
| POST | `/containers/lookup-positions` | READ | `List<String>` → `Map<numero, PositionInfoDTO{label,id_yard,yard_name,block_code,bay,row_no,tier,pos_from_top}>` |
| POST | `/containers` | WRITE | `ContainerEnterRequest{container_number, id_block, bay, row_no, tier?, container_type?, weight?, content_description?, color?, notes?, status?}` → 201 (+ warning se `registry_match=false`) |
| POST | `/containers/{n:.+}/move` | WRITE | `ContainerMoveRequest{id_block, bay, row_no, tier?, version, note?}` → `MoveResponseDTO{moved, cascaded[], revision}` |
| POST | `/containers/{n:.+}/restack` | WRITE | `ContainerRestackRequest{tier, version, note?}` → `MoveResponseDTO{moved, cascaded[], revision}` — riordino dentro la colonna (aggiunto 2026-09-17) |
| PATCH | `/containers/{n:.+}` | WRITE | `ContainerPatchRequest{status?, notes?, content_description?, color?, weight?, version}` |
| POST | `/containers/{n:.+}/exit` | WRITE | `{version, note?}` → `{cascaded[], revision}` |
| PUT `/containers/{n:.+}` · DELETE `/containers/{n:.+}` | WRITE | **@Deprecated**: PUT con `position_*`/`rotation`/`id_yard` → 400 "usare /move", altrimenti delega a PATCH; DELETE = alias exit |
| POST `/yards` · PUT/DELETE `/yards/{id}` | `cd` | `YardRequest{id_site, code, name, description?, width, length, max_stack_height?, is_active?}`; DELETE = `is_active=false`, 409 se container |
| POST `/yards/{id}/blocks` · PUT/DELETE `/blocks/{id}` | `cd` | `BlockRequest{code, name?, id_yard_area?, origin_x, origin_y, orientation, n_bays, n_rows, max_tier, bay_length?, row_width?, gap?, color?}`; riduzioni/DELETE → 409 se slot occupati |

Evento SSE/Valkey: canale `workhub:yard:{idYard}`, payload `{type: ENTER|MOVE|EXIT|UPDATE|LAYOUT, id_yard, revision, containers[], removed[], by, at}`. Client: `revision == local+1` → delta, altrimenti ricarica snapshot.

### File backend
Creare: `model/YardBlock.java` (`@Table("wrk_yard_blocks") @IdName("id_block") @IdGenerator("nextval('s_wrk_yard_blocks')")`), `model/ContainerMovement.java` (`@IdGenerator("nextval('s_wrk_container_movements')")`) — standard BERLink: PK senza DEFAULT in DDL, sequenza dichiarata sul model come `model/Site.java`; aggiungere lo stesso `@IdGenerator` a `model/Yard.java` (`s_wrk_yards`) e `model/YardArea.java` (`s_wrk_yard_areas`), oggi assente perche' non esisteva CRUD; `repository/YardBlockRepository.java`, `repository/ContainerMovementRepository.java`; `service/YardSlotService.java`, `service/YardAdminService.java`, `service/YardEventPublisher.java` (`StringRedisTemplate.convertAndSend`), `service/YardSseEmitterManager.java` (copia di `SseEmitterManager` con chiave `idYard`); `config/WorkhubPubSubConfig.java` (`PatternTopic("workhub:yard:*")`); `controller/WorkhubAdminController.java`, `controller/WorkhubStreamController.java` (SSE + `Base.close()` come `NotificationController.java:154-165`); DTO request/response; `util/SlotGeometry.java`, `util/SlotLabel.java`.
Modificare: `controller/WorkhubController.java` (togliere `@PreAuthorize` di classe :26 → costanti `READ_ROLES`/`WRITE_ROLES` per metodo; nuovi endpoint; `@Deprecated`); `service/WorkhubService.java` (arricchimento; rimuovere :188-296); `repository/WorkhubRepository.java` (snapshot con window function, `findColumn`, `lockForUpdate`, `bumpRevision`, `lookupPositions` sul pattern `ContainerTerminalInfoService.java:118-149`); `config/SecurityConfig.java:79-92` (`AntPathMatcher` su `/api/notifications/stream` e `/api/workhub/yards/*/stream`); `prompt/API.md` §26 riscritto; nota in `prompt/IMPLEMENTATION_NOTES.md`.
Test: `WorkhubControllerTest` esteso (400 DTO invalido, 403 ruolo `read` su POST, 409), `WorkhubAdminControllerTest`, `SlotGeometryTest`, `SlotLabelTest`, `YardSlotServiceIntegrationTest` (enter → stack → move con cascata → exit; EXCLUDE → 409; version stale → 409).

Verifica: `mvn test -Ptest`; migrazione su DB dev; `curl` su blocks/containers/move; `curl -N ".../yards/1000/stream?access_token=$T"` in un terminale + move nell'altro → evento ricevuto.

---

## Fase 2 — Client WorkHub: slot, realtime, UX tablet — ~10-12 gg

1. **Tipi/API** (`src/types`, `src/api/WorkHubAPI.ts`): `Block`, `Container` esteso; `getSnapshot`, `enterContainer`, `moveContainer`, `patchContainer`, `exitContainer`, `getHistory`, `lookupPositions`; `ApiError{status, body}` (409 → `body.currentData`).
2. **`src/utils/slotLayout.ts`** (puro, vitest): `slotToWorld`, `worldToSlot`, `topTier`, `canPlace` (specchio regole server), `labelOf`. Eliminare `gravityLogic.ts`, `stackingLogic.ts`, `collisionDetection.ts`, `useContainerDrag.ts`.
3. **Store** (`store/yardStore.ts`): `revision`, `blocks`, `unallocated[]`; `loadSnapshot`; `moveContainer` **ottimistico** (snapshot → applica localmente moved+cascata → API → sostituisci con risposta; 409/errore → rollback + toast + `loadSnapshot`). Stesso schema per enter/patch/exit. Eliminare `:134-190`.
4. **Realtime** (`src/services/yardEvents.ts`): `EventSource(.../stream?access_token=)`, `applyEvent`, backoff esponenziale (pattern `BERLink/frontend/src/lib/stores/notifications.js:29-70`), riapertura al refresh token, fallback polling `getSnapshot` ogni 15 s se nessun `connected` entro 5 s, pausa su `visibilitychange`.
5. **Rendering** (`components/3d/`): `Block3D.tsx` (griglia slot `InstancedMesh`, etichette bay/row ai bordi), `ContainersInstanced.tsx` (un `InstancedMesh` per tipo, `instanceColor`, raycast per `instanceId`), `SlotHighlight.tsx`, `ContainerLabels.tsx` (`<Text>` solo selezionato + N vicini); `frameloop="demand"` + `invalidate()`, `dpr` da `getQualitySettings()` (clamp 1–1.5), ombre solo in qualita' alta. Eliminare `Container3D.tsx`.
6. **Drag a slot** (`hooks/useSlotDrag.ts`): **tap = seleziona; long-press (~300 ms) = presa** (evita spostamenti accidentali su piazzale condiviso); move → `e.ray.intersectPlane` → `worldToSlot` → target con `tier=top+1` → `canPlace` → highlight; rilascio → `moveContainer`. Un dito su vuoto = orbit, due dita = zoom/pan (`OrbitControls enabled={!isDragging}`). Nessuna rotazione manuale (via `ContainerPanel.tsx:35-50`). **Click destro o doppio tap** = menu contestuale di colonna (`ContainerContextMenu.tsx`): Switch col container sotto/sopra e "Porta in alto" → `restackContainer` (aggiunto 2026-09-17).
7. **Trova container** (`components/ui/FindContainer.tsx`): match locale; se assente → `lookupPositions` e proposta cambio piazzale; `Controls.flyTo(target)` (riuso animazione `Controls.tsx:20-70`) + pulse.
8. **Vista 2D + lista**: `components/2d/MapView2D.tsx` (SVG top-down, badge tier) e `components/ui/ContainerList.tsx` (ordinabile per label/numero/tipo/stato). Toggle in `Toolbar`.
9. **ContainerPanel**: label + "N° dall'alto"; stato/note/contenuto editabili (PATCH con `version`); tab Storico; "Uscita" con `ConfirmDialog`. `AddContainerModal`: ricerca registro + **scelta slot toccando uno slot libero** (3D o 2D) invece dell'auto-place.
10. **Ruoli**: `authStore.canWrite`; in sola lettura nascondere Aggiungi/Uscita/edit, disabilitare drag, banner "Sola lettura".
11. **Touch/responsive**: `touch-action: none` sul wrapper Canvas; `useMediaQuery('(orientation: portrait)')` → pannelli come drawer inferiore; `w-80` → `w-full sm:w-80`; `100dvh`.
12. **PWA**: `vite-plugin-pwa` (manifest standalone/landscape), cache solo app-shell.

Verifica: `npm run build && npm test && npm run lint`; due tablet stesso piazzale → move su A visibile su B < 1 s; Valkey pub/sub spento → B aggiorna via polling ≤ 15 s; move concorrente → 409 con rollback e toast; portrait/landscape; utente `read` in sola lettura.

---

## Fase 3 — Rimozione stive BERLink + "Posizione piazzale" in RCS — ~3-4 gg

Ordine (prima il sostituto, poi la rimozione):
1. **Sostituto**: `frontend/src/lib/api/modules/workhub.js` (`lookupPositions`), export in `lib/api/index.js`; `OperationsTable.svelte:16` → colonna `yard_position` "Posizione piazzale" (batch lookup dedup su `operations`, cella `label · N° dall'alto` o `-`); `rcsColumnPrefs.js:22` → `yard_position` (migrare pref salvate `bulk_name`).
2. **Frontend rimozione**: `OperationForm.svelte` (:3, :42, :133-215, :505-535, :686-750), `routes/rcs/dashboard/+page.svelte` (tab stive), `operations.js` (:243, :271, :290).
3. **Backend deprecazione 410**: `OperationController.java:245-279`, `ExportController.java:208-240` → `@Deprecated`, `HttpStatus.GONE` + `ApiResponse.error("Funzionalita' Stive rimossa: usare /api/workhub/containers/lookup-positions")`. Aggiornare `OperationControllerTest:645-700`, `ExportControllerTest:188-210`.
4. **Backend rimozione**: `SiteManagementService.java`, `model/SiteBulk.java`; `OperationService.java` (:15, :243, :323, :551-553, :625, :676-750, :848-891); `ExportService.java:81-89`; `DashboardExcelExporter.java:104-215`; test `ExportServiceTest:135-145`, `OperationServiceIntegrationTest` (seed/cleanup/test).
5. **DB** `database/migration/2.6.1_drop_gb_site_bulks.sql`:
```sql
CREATE TABLE IF NOT EXISTS zz_bak_gb_site_bulks AS SELECT *, now() AS backup_at FROM gb_site_bulks;
DROP INDEX IF EXISTS idx_bulks_site;
DROP INDEX IF EXISTS idx_site_bulks_version;
DROP TABLE IF EXISTS gb_site_bulks;
DROP SEQUENCE IF EXISTS s_gb_site_bulks;
```
Rimuovere da `002_DB_DDL.sql` (:57, :1848-1860, :2388), `005_DB_DML.sql:413-452`, `008_DB_INDEX.sql:1`; eliminare `010_OPTIMISTIC_LOCKING.sql`.
6. **Docs**: `prompt/API.md` §9 (:562) e §13 (righe 410 come deprecate), `etc/stuff/README.md:284-301`, `etc/stuff/API_DOCUMENTATION.md`, `IMPLEMENTATION_NOTES.md`, `CHANGELOG_AI.md`.

Verifica: `grep -rn "SiteBulk\|gb_site_bulks\|bulk_id\|getSiteBulks" backend/src frontend/src` → 0 (esclusi "Soste Ctr Bulk"); `mvn test -Ptest`; `npm run build` frontend; RCS mostra la colonna coerente con WorkHub; `curl /api/operations/sites/1/bulks` → 410.

---

## Fase 4 — Configurazione, rollout, opzionali — ~3-5 gg

1. **Admin blocchi** (BERLink SvelteKit, `cd`): `routes/admin/workhub/+page.svelte` + `components/YardBlockForm.svelte` (CRUD yard/blocchi con anteprima SVG); permesso `canAccessAdmin` esistente.
2. **Import stive legacy: non richiesto** (confermato 2026-09-16). Resta solo il backup `zz_bak_gb_site_bulks` creato in Fase 3.5.
3. **Inbox "da posizionare" (opzionale, da confermare)**: `GET /api/workhub/yards/{id}/pending` = container "in giacenza" nel sito secondo RCS (`buildInStockCondition` su `ctr_availability.id_site`) non presenti in `wrk_containers` → lista nel client per l'ingresso rapido. Integrazione RCS in sola lettura, non con le stive.
4. **Deploy**: Keycloak `berlink-client` Web Origins per l'origin tablet (login diretto da WorkHub); `nginx.conf` SSE; `docker-compose.yml` `BACKEND_URL`; verificare che CORS non serva (proxy same-origin).
5. **Hardening**: health con `yardSse.activeConnections`; limite emitter per piazzale; log `updated_by`.
6. **Pulizia differita** (release successiva): rimuovere stub 410 e `PUT/DELETE /containers/{n}` deprecati; valutare rimozione `position_x/y/z`.

---

## Rischi
- `CREATE EXTENSION btree_gist` richiede privilegi: eseguire come utente amministrativo (gia' fatto per PostGIS). Fallback: advisory lock + check applicativo.
- Cascata server-side cambia semantica rispetto al client attuale: rilasciare Fase 1 e Fase 2 insieme (il vecchio client riceve 400 sui PUT posizionali).
- Token nella query string SSE: `access_log off` sulla location, TTL token 5 min (scelta gia' fatta per `/api/notifications/stream`).
- `EventSource` senza header: riaprire lo stream al refresh token.
- Bay dispari per 40': blocchi con `n_bays` dispari perdono l'ultimo bay per i 40' (documentare nel form admin).
- `wrk_yards.code` default `'PZ'||id_yard`: rinominare via admin.

## Decisioni confermate (2026-09-16)
- Move consentito solo tra piazzali dello stesso sito; cambio sito = **exit dal sito A + enter nel sito B** (storico: `EXIT` + `ENTER`, stesso numero container).
- Import delle stive legacy: **non serve**; solo backup tabella prima del DROP.
- Presa del container su tablet con **long-press** (tap = selezione).
- Fase 1 e 2 sviluppate in parallelo su branch separati e **rilasciate insieme**; Fase 0 parte subito; Fase 3 dopo che la colonna "Posizione piazzale" e' in produzione.

## Assunzioni ancora aperte
- READ esclude `ml`, `po_approval`, `write`.
- Inbox RCS "da posizionare" (Fase 4.3): opzionale, solo su conferma.

## Verifica end-to-end finale
1. `npm run build && npm run lint && npm test` (WorkHub); `mvn test -Ptest` e `npm run build` (BERLink).
2. Migrazioni 2.6.0 e 2.6.1 su copia DB; `task test-ddl`.
3. Scenario tablet: login `resources` → seleziona piazzale → ingresso container da registro su slot libero → impila secondo → sposta il primo (cascata visibile) → secondo tablet vede tutto < 1 s → uscita → storico completo → utente `read` vede ma non modifica.
4. RCS: operazione con container in piazzale mostra "Posizione piazzale"; endpoint stive → 410.
