# Vista piazzali read-only in BERLink — piano di integrazione

Data: 2026-09-18 · aggiornato 2026-09-21 con le decisioni chiuse sui dati reali.
Repo coinvolti: **BERLink** (backend + frontend). WorkHub resta invariato: da qui si copiano solo
funzioni pure e asset.

---

## 1. Contesto

La posizione dei container e' gestita solo da WorkHub (app tablet React/three.js), pensata per il
piazzalista che legge **e muove** le casse. Chi lavora in BERLink non ha modo di vedere come e'
impilata una stiva: la vecchia "Dashboard Stive" RCS e' stata rimossa il 2026-09-16 quando WorkHub v2
e' diventato l'unica fonte di verita' (`GET /api/operations/sites/{id}/bulks` oggi risponde **410**,
`backend/.../controller/OperationController.java:243-264`).

Serve in BERLink una vista **di sola consultazione**: scelta sito + piazzale, stiva in 3D come in
WorkHub, toggle 3D/lista e — informazione che WorkHub non ha — il **prodotto contenuto** in ogni
container, preso dal registro carico/scarico.

Requisiti dalla richiesta:

- sola lettura: nessun movimento, nessuna chiamata di mutazione;
- toggle **3D / lista**;
- sotto il numero container il **prodotto**: ultima riga di registro ancora aperta; nessuna riga →
  vuoto; **due o piu'** → riga rossa `[entry multiple]`;
- riusare il codice esistente delle giacenze invece di scrivere metodi nuovi (→ vedi §2.2: sul
  predicato la misura ha portato a una deviazione deliberata).

---

## 2. Decisioni

| Tema | Scelta | Perche' |
|---|---|---|
| Renderer 3D | `three` **pinnato a `^0.158.0`** (stessa di WorkHub) + `troika-three-text`, con **import dinamico** dentro `onMount` | BERLink non ha librerie 3D e l'adapter e' `adapter-node` (SSR attivo): un import statico finirebbe nel bundle server. Stessa versione di WorkHub per non far divergere le due geometrie |
| Etichette | dipinte sulla cassa con `troika-three-text`: numero + prodotto sotto, `[entry multiple]` in rosso | stessa libreria che WorkHub usa via drei: resa identica |
| **Predicato prodotto** | **solo `off_date`, `off_date_2`, `off_date_3` tutte NULL** (+ `delete_date IS NULL`) | §2.2: misurato sui dati reali. **Non** si riusa `buildInStockCondition` |
| Container senza riga aperta | **riga vuota** | una cassa vuota in deposito non ha righe aperte per definizione: l'ultimo prodotto noto si leggerebbe come contenuto attuale |
| Ruoli | nuovo `WorkhubRoles.READ_PRODUCT = "hasAnyRole('cd','logs')"`; menu con `requirePermission: 'canAccessRCS'` | il prodotto e' dato commerciale: `/api/operations` e' oggi cd/logs (`controller/OperationController.java:27`), `WorkhubRoles.READ` invece copre 10 ruoli. Gate FE e BE devono coincidere: `canAccessRCS` in `permissions.js` e' vero solo per cd e logs |
| Nome voce e rotta | **"Piazzali"**, `/rcs/piazzali` | "Stive" e' il termine **ritirato il 2026-09-16**: `gb_site_bulks` droppata (`database/migration/2.6.1_drop_gb_site_bulks.sql`), endpoint a 410, colonna RCS rinominata in "Posizione piazzale" con migrazione `bulk_name → yard_position` (`frontend/src/lib/stores/rcsColumnPrefs.js:33-34`), nota 45 in `prompt/IMPLEMENTATION_NOTES.md:891-909`. Riusarlo con un significato diverso rende ambigui doc, ticket e ricerche |
| Contratto | `POST /api/workhub/containers/lookup-products` (lista numeri → mappa) | gemello di `lookup-positions` (`WorkhubController.java:106`); riusabile domani anche nella tabella RCS. Variante `GET /yards/{id}/products` solo se il body diventa grosso |

### 2.1 Misure sul DB dev (2026-09-21, solo SELECT)

`ctr_availability`: 4507 righe attive, `loading_date` dal 2021-12-27 a oggi.

| | predicato giacenze | solo senza data di uscita |
|---|---|---|
| righe aperte | 108 | 98 |
| container distinti | 106 | 98 |
| container con 2+ righe aperte | 2 (1,9%) | **0** |
| copertura sui 12 container in piazzale | 2 | 2 |

- I 2 `[entry multiple]` che spuntano solo col predicato giacenze sono **falsi allarmi**: riga
  corrente + riga vecchia **gia' uscita** con scarico contabilizzato male (`GBTU 028032.6`: uscita
  2024-12-03, 8040 kg su 24000, tenuta viva dal ramo "scarico < 95%"; `GBTU 854.0`: uscita
  2026-03-18, scarico a zero). Le 10 righe che solo quel predicato tiene hanno **tutte** la data di
  uscita valorizzata: 6 per "scarico < 95%", 4 per "scarico a zero".
- La **normalizzazione dei numeri funziona**: 12 container in piazzale su 12 trovano righe nel
  registro (da 2 a 9 ciascuno). Il rischio principale del piano non si materializza su questi dati.
- Solo 2 dei 12 container in piazzale hanno una riga aperta: gli altri 10 mostrerebbero il prodotto
  vuoto. Su dev sono posizionamenti di test, ma il caso e' reale (cassa vuota).

### 2.2 Perche' il predicato delle giacenze non si riusa

`OperationQueryUtil.buildInStockCondition` (`util/OperationQueryUtil.java:26`) e' l'unica definizione
di "in giacenza" del sistema, ma risponde a una domanda diversa: *questa merce e' ancora nostra dal
punto di vista contabile?* Qui serve sapere *cosa c'e' fisicamente dentro la cassa adesso*. E' un OR
di 4 rami dove i rami 3 e 4 (scarico a zero, scarico < 95%) tengono aperte righe **con la data di
uscita valorizzata**: merce fisicamente uscita, contabilizzata male.

Sui dati reali quel predicato **non aggiunge copertura** (2 container su 12 in entrambi i casi) e
aggiunge 2 falsi `[entry multiple]`. Quindi: predicato letterale, con il motivo scritto nel commento
della query perche' la scelta contraddice la regola "riusa il possibile". Il riuso resta su tutto il
resto: forma del batch lookup, join prodotto, contratto REST.

Conseguenza: `[entry multiple]` torna a essere **un'anomalia vera** (zero casi su dev), quindi niente
degrado ad ambra e niente campo `multi_product`: basta `open_count >= 2`.

⚠️ Effetto collaterale accettato: la vista non concorda con la Dashboard Giacenze (98 container
invece di 106). Non e' un report contabile, e la differenza e' spiegabile con le 10 righe di cui
sopra.

---

## 3. Backend (BERLink)

Oggi **non esiste** nessun metodo, ne' singolo ne' batch, che dia "l'ultima riga di registro aperta
per un container": `OperationStockService` ha solo aggregati e `OperationService.getAllOperations`
filtra per LIKE con `ORDER BY ca.loading_date DESC` senza deduplica.

### 3.1 La chiave di confronto dei numeri

`wrk_containers.container_number` e' il `cassa` canonico del registro Valkey (es. `GBTU 028123.5`,
con spazio e punto prima del check digit — `service/workhub/YardSlotService.java:564-578`).
`ctr_availability` ha `container_prefix` **piu'** `container_number` come testo della form RCS,
spesso copiato dal `cassa` (`frontend/src/components/OperationForm.svelte:85`) ma a volte digitato a
mano. Nessun codice esistente fa questo join.

`container_prefix` **non e' scritto da nessun punto del codice Java**: in pratica vale sempre il
DEFAULT `'GBTU'`. Usarlo solo come *fallback* quando il numero non porta il prefisso.

Chiave canonica = `prefisso (4 lettere)` + `cifre senza zeri iniziali`:

```
GBTU 028123.5           -> GBTU281235
gbtu-028123-5           -> GBTU281235
0281235   (+prefix GBTU)-> GBTU281235
028123.5  (+prefix GBTU)-> GBTU281235
BRND 42                 -> BRND42
```

Espressione SQL (`<KEY>`, generata da un util Java per avere una sola fonte di verita'):

```sql
-- <ALNUM> = upper(regexp_replace(ca.container_number, '[^A-Za-z0-9]', '', 'g'))
( COALESCE( substring(<ALNUM> from '^[A-Z]{4}'), upper(ca.container_prefix) )
  || regexp_replace( regexp_replace(<ALNUM>, '^[A-Z]+', ''), '^0+', '') )
```

Verificata sui 12 container in piazzale del DB dev: 12 abbinamenti su 12 (§2.1). Da riverificare in
produzione con §6.2.

### 3.2 Query batch

`ROW_NUMBER()` + `COUNT() OVER` sulla **stessa partizione**: ultima riga e conteggio in una sola
scansione. (`DISTINCT ON` non porta il conteggio; `GROUP BY` + join ne richiede due.)

```sql
SELECT t.ctr_key, t.id_material_type, t.product, t.id_site, t.loading_date, t.open_count
FROM (
  SELECT <KEY>                                            AS ctr_key,
         ca.id_material_type,
         COALESCE(NULLIF(btrim(mt.description), ''), ca.id_material_type) AS product,
         ca.id_site, ca.loading_date,
         COUNT(*)     OVER w  AS open_count,
         ROW_NUMBER() OVER wo AS rn
  FROM ctr_availability ca
  LEFT JOIN c_material_types mt ON mt.id_material_type = ca.id_material_type
  WHERE ca.delete_date IS NULL
    -- Contenuto FISICO della cassa: solo righe senza nessuna data di uscita. Deliberatamente NON
    -- si usa OperationQueryUtil.buildInStockCondition (giacenza contabile): i suoi rami "scarico a
    -- zero" e "scarico < 95%" tengono aperte righe gia' uscite. Vedi §2.2 del piano.
    AND ca.off_date IS NULL AND ca.off_date_2 IS NULL AND ca.off_date_3 IS NULL
    AND <KEY> IN (?, ?, ...)
  WINDOW w  AS (PARTITION BY <KEY>),
         wo AS (w ORDER BY ca.loading_date DESC, ca.registration_date DESC, ca.id_availability DESC)
) t
WHERE t.rn = 1
```

Punti non negoziabili:

- **Tie-break** `loading_date DESC, registration_date DESC, id_availability DESC` (PK univoca =
  determinismo). **Non** usare `date_last_update` (ordina per ultima modifica, non ultima riga) ne'
  `off_date` (nulla per costruzione su queste righe).
- `open_count >= 2` → `[entry multiple]`. Niente altro: con questo predicato il caso e' un'anomalia
  di inserimento, non rumore.
- `LEFT JOIN c_material_types`, non JOIN: `description` e' nullable e la tabella ha soft-delete
  (`database/migration/2.5.22_c_material_types_soft_delete.sql`); fallback sul codice
  `id_material_type`.
- **Nessun filtro `ca.id_site`** nella prima versione: filtrarlo nasconderebbe il prodotto quando
  l'`id_site` RCS e' stale. Si restituisce `id_site` nel payload e si decide con §6.2.
- Solo placeholder `?` per i numeri (pattern `YardSlotRepository.java:161-163`), mai concatenazione.
- **Attenzione per chi tocchera' `buildInStockCondition` altrove**: quel metodo restituisce una
  catena `OR` **non parentesizzata** e due chiamanti esistenti hanno per questo un bug di precedenza
  (`service/operation/OperationStockService.java:46-48` e `:69` contano anche righe con
  `delete_date` valorizzata). Fuori scope qui, ma vale un ticket a parte.

### 3.3 File

| File | Tipo | Contenuto |
|---|---|---|
| `util/ContainerKeyUtil.java` | **nuovo** | gemello di `OperationQueryUtil`: `sqlKey(String tablePrefix)` (l'espressione `<KEY>`) + `normalize(String)` (stessa regola in Java, per i numeri WorkHub). Classe `final`, ctor privato. Unica fonte di verita' della chiave. La logica di strip degli zeri esiste gia' in `util/ContainerNumberFormatter.java:49-56` |
| `repository/ContainerProductRepository.java` | **nuovo** | `List<Map<String,Object>> findOpenProductsByKeys(Collection<String> keys)` — query §3.2 con `Base.findAll` + placeholder da `Collections.nCopies`, stile `YardSlotRepository.lookupPositions:150`. **Non** dentro `YardSlotRepository`: quello incapsula il modello `wrk_*`, il prodotto e' dominio `ctr_*` |
| `service/workhub/ContainerProductService.java` | **nuovo** | `Map<String, Map<String,Object>> lookupProducts(List<String> numbers)`: dedup+trim, mappa **`Map<String, List<String>>` chiave → numeri** (vedi rischio fan-out §5.3), chiamata al repository, output `{product, id_material_type, open_count, id_site, loading_date}`, log INFO richiesti/trovati come `ContainerTerminalInfoService.java:145` |
| `security/WorkhubRoles.java` | modifica | `READ_PRODUCT = "hasAnyRole('cd', 'logs')"` |
| `controller/WorkhubController.java` | modifica | `POST /containers/lookup-products`, `@PreAuthorize(WorkhubRoles.READ_PRODUCT)`, body `List<String>`, risposta `ApiResponse<Map<String,Map<String,Object>>>`; accanto a `lookup-positions` (riga 106) |
| `prompt/API.md` §26 + `prompt/IMPLEMENTATION_NOTES.md` | modifica | tabella letture + esempio + nota numerata (prassi del repo) |

⚠️ `config/SecurityConfig.java:56` e' `/api/** → authenticated()` e `WorkhubController` **non ha**
`@PreAuthorize` di classe: un metodo senza annotazione resta aperto a qualunque utente autenticato.

⚠️ **Non** aggiungere il prodotto dentro `getSnapshot` (`service/WorkhubService.java:52-63`): lo
snapshot e' consumato dai tablet a ogni evento SSE, un join RCS li' peggiora un client che non ne ha
bisogno e aggira il confine cd/logs. Due chiamate separate.

### 3.4 Indice (opzionale, decidere con l'EXPLAIN)

Con la normalizzazione a sinistra del confronto, `idx_availability_cntnnum`
(`database/sql/008_DB_INDEX.sql:10`) **e' inutilizzabile** (predicato non sargable) e nessun altro
indice copre il caso. Con 4507 righe in tabella il seq scan e' irrilevante: l'indice serve solo se
la tabella cresce di un ordine di grandezza. Se §6.7 mostra tempi alti, migrazione
`2.6.3_ctr_availability_container_key_index.sql`:

```sql
CREATE INDEX IF NOT EXISTS idx_ctr_avail_container_key
  ON ctr_availability ((
    COALESCE(substring(upper(regexp_replace(container_number,'[^A-Za-z0-9]','','g')) from '^[A-Z]{4}'),
             upper(container_prefix))
    || regexp_replace(regexp_replace(upper(regexp_replace(container_number,'[^A-Za-z0-9]','','g')),'^[A-Z]+',''),'^0+','')
  ))
  WHERE delete_date IS NULL;
```

Espressione **identica** a quella della query (il planner confronta l'albero, l'alias `ca.` e'
irrilevante); replicare la riga anche in `database/sql/008_DB_INDEX.sql` (lista riconciliata con
produzione). `upper`/`regexp_replace`/`substring` sono IMMUTABLE → indice ammesso (conferma in §6.6).
`CREATE INDEX CONCURRENTLY` non sta in una transazione: nel file lasciare la forma semplice e
documentare che in produzione si puo' lanciare a mano la variante concorrente. Scartata la colonna
generata `STORED`: `ADD COLUMN GENERATED` riscrive la tabella con lock esclusivo.

---

## 4. Frontend (BERLink, SvelteKit 2 + Svelte 4)

| File | Tipo | Responsabilita' |
|---|---|---|
| `frontend/package.json` | modifica | `three@^0.158.0` + `troika-three-text` |
| `frontend/src/routes/+layout.svelte` | modifica | voce nella sezione Deposito (righe **184-202**): `{ label: 'Piazzali', path: '/rcs/piazzali', icon: 'cube', requirePermission: 'canAccessRCS' }`; `cube` esiste nella mappa `icons` (`:575`) |
| `frontend/src/routes/rcs/piazzali/+page.svelte` | **nuovo** | orchestrazione: dropdown sito/piazzale, caricamento in `onMount` (in tutto il progetto non esiste un solo `+page.js`), toggle 3D/lista, banner errore/loading, contatore "container senza slot", `revision` + pulsante Aggiorna |
| `frontend/src/lib/api/modules/workhub.js` | modifica | `getYardSnapshot(yardId)` → `GET /workhub/yards/{id}/snapshot` (endpoint **gia' esistente**, mai wrappato); `lookupContainerProducts(numbers)` → `POST /workhub/containers/lookup-products` (dedup + skip lista vuota, `result.data \|\| {}`, come `lookupContainerPositions:19`). Il barrel `lib/api/index.js:152` e' `export *`: niente da toccare |
| `frontend/src/lib/api/modules/workhub.test.js` | **nuovo** | oggi e' l'unico modulo API senza test gemello |
| `frontend/src/lib/utils/slotLayout.js` + `.test.js` | **nuovo** | port JS da `WorkHub/src/utils/slotLayout.ts` di: `baySpanOf`, `containerHeight`, `isPlaced`, `footprintLength`, `slotOrigin`, `slotBox`, `blockBounds`, `columnOf`, `columnBaseHeight`. **Non** portare `worldToSlot`, `findSlotAt`, `canPlace`, `cascadePreview`, `restackPreview`, `columnNeighbor`, `overlappingInRow`, `topTier` (servono a piazzare/muovere), ne' `posFromTop` e `labelOf`: il server li fornisce gia' (`YardSlotRepository.java:26-29`, `WorkhubMapper.java:19-26`) |
| `frontend/src/lib/constants/containerSizes.js` | **nuovo** | port di `CONTAINER_DIMENSIONS` e `CONTAINER_TYPE_LABELS` (serve l'altezza 2,9 m dei 40HC/45HC) |
| `frontend/src/lib/utils/yardProducts.js` + `.test.js` | **nuovo** | logica pura (pattern `src/lib/utils/containerInfoTable.js:40`): da `containers[] + productsMap` a view-model `{container_number, label, tier, pos_from_top, type, product, multiple, hasSlot}` + filtro/ordinamento lista |
| `frontend/src/components/YardViewer3D.svelte` | **nuovo** | solo canvas three.js; props `yard`, `containers`, `products`; nessuna logica di dominio |
| `frontend/src/components/YardContainerTable.svelte` | **nuovo** | lista ordinabile, pattern `src/components/VehicleTable.svelte:21-49` (`sortBy`, `$: sorted`, `localeCompare('it-IT')`, null in fondo). Colonne: Posizione, Dall'alto, Container, **Prodotto**, Tipo, Stato, Aggiornato |
| `frontend/src/lib/stores/yardViewMode.js` | **nuovo** | `'3d' \| 'list'` in localStorage, copia di `src/lib/stores/damageViewMode.js` |

### 4.1 Pagina

Modello da copiare: `src/routes/admin/workhub/+page.svelte:24-56,143-163` (dropdown + fetch +
loading/errore/empty). In BERLink **non esiste nessun `+page.js`**: tutti i dati si caricano in
`onMount`.

- `onMount`: `getWorkhubSites()` → primo sito (o l'ultimo usato, in localStorage) →
  `getWorkhubYards(siteId)` → primo piazzale.
- Al cambio piazzale: `Promise.all([getYardSnapshot(yardId), lookupContainerProducts(numeri)])`, poi
  merge del prodotto sui container per numero. Una sola chiamata per ciascuno, nessun N+1.
- Loading: spinner come `admin/workhub/+page.svelte:160`; errori: banner rosso `{#if error}`
  (`:155`), meglio del solo `alert()`; empty state se il piazzale non ha blocchi.
- Toggle 3D/lista: pattern presentational di `src/components/PlanningTabNav.svelte`.
- Nessuna funzione di mutazione importata nella pagina.

### 4.2 `YardViewer3D.svelte` — trappole Svelte/three da rispettare

- **`onMount` NON async**: se il callback e' `async`, Svelte vede una Promise e **ignora la funzione
  di cleanup restituita**. Quindi `onMount` sincrono che lancia un `init()` async, flag `disposed`
  controllato dopo ogni `await` (smontaggio durante il caricamento del chunk), cleanup in
  `onDestroy`.
- **Import dinamici** (obbligatori con SSR attivo): `await import('three')`,
  `three/examples/jsm/controls/OrbitControls.js` (path valido in r158; nelle versioni recenti e'
  `three/addons/...`), `troika-three-text`. Nessun import statico, piu' guardia `browser` da
  `$app/environment`. Cosi' Vite mette tutto in un chunk a parte (~170 kB gzip three + ~50-100 kB
  troika) fuori dal bundle iniziale.
- **Render on-demand** (equivalente del `frameloop="demand"` di WorkHub): `requestRender()` con flag
  `pending` + rAF, agganciato a `controls.addEventListener('change')`, cambio dati e resize.
  `controls.enableDamping = false`: con il damping il loop si spegne a metà inerzia (`update()` viene
  chiamato solo dal render, che parte solo da `change`). Se il feeling su tablet conta: damping on e
  loop attivo solo tra `pointerdown` e `pointerup + ~600 ms`. Stop anche su
  `document.visibilitychange` e `IntersectionObserver` sul contenitore.
- `renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))` (come `Yard3D.tsx:130`); **ombre off** di
  default (la `directionalLight` con shadow map 2048 su tutto il piazzale e' la voce di costo
  principale sui portatili), eventualmente come opzione.
- **Resize**: `ResizeObserver` sul div contenitore (non `window.onresize`: la sidebar e'
  collassabile), debounce ~100 ms → `setSize`, `camera.aspect`, `updateProjectionMatrix()`,
  `requestRender()`; `disconnect()` in dispose.
- **Dispose completo e in ordine**: cancella il rAF pendente, `observer.disconnect()`, rimuovi i
  listener, `controls.dispose()`, traversa la scena con `geometry/material/texture.dispose()`,
  `.dispose()` su ogni `Text` troika, `renderer.dispose()`, `renderer.forceContextLoss()`, rimuovi il
  canvas dal DOM. I contesti WebGL per tab sono ~8-16: uno perso a ogni navigazione uccide la pagina.
- **Geometria**: una `InstancedMesh` per tipo container (max 5) — pattern
  `WorkHub/src/components/3d/ContainersInstanced.tsx:57-115` (`setMatrixAt`, `setColorAt`,
  `mesh.count`, `instanceMatrix.needsUpdate`, `computeBoundingSphere`); celle del blocco a terra
  anch'esse instanziate (`Block3D.tsx:20-38`).
- **Mai usare `position_x/y/z` del server**: `util/SlotGeometry.java:23` li calcola con tier fisso di
  2,60 m, quindi una pila con un 40HC (2,9 m) risulta sbagliata. Usare
  `slotBox(block, bay, row, bay_span, columnBaseHeight(...), containerHeight(type))` come fa il
  tablet. `container_type` puo' essere NULL (registro non risolto) → fallback `'40'` per le dimensioni
  (`ContainersInstanced.tsx:126`) e 2,6 m di altezza.
- **Etichette**: numero, prodotto sotto, `[entry multiple]` in rosso, dipinte sulla faccia lunga
  rivolta alla camera. Portare la strategia di `ContainerLabels.tsx`: **solo le N piu' vicine**
  (`maxLabels = 48`), riclassificate quando la camera cambia (throttle ~3/s dentro `requestRender`).
  3 `Text` × 500 container = 1500 mesh SDF: insostenibile senza il cap. Se pesano ancora: texture
  canvas-2D su un `PlaneGeometry` (testo statico, read-only → nessun re-layout).
- Resa uguale a WorkHub: cassa crema `#FBF5E9` di default, numero nero in grassetto, costolatura
  verticale (port di `WorkHub/src/utils/ribTexture.ts`, ~50 righe pure, nessun asset), logo TB per i
  prefissi `GBTU`/`BRND` (copiare `WorkHub/src/assets/tb-logo.png` e la regola di
  `WorkHub/src/constants/branding.ts`).
- Interazione: solo orbit/zoom. Al massimo click su una cassa = evidenzia la riga nella lista.

### 4.3 Lista

Pattern `src/components/VehicleTable.svelte:21-46`. Includere anche i container senza slot
(`id_block` nullo), che nel 3D non sono rappresentabili. `[entry multiple]` in rosso nella cella
Prodotto.

---

## 5. Rischi noti

1. **Match dei numeri** — misurato: 12 su 12 abbinati sul DB dev (§2.1), quindi il rischio e'
   declassato ma non chiuso: righe digitate senza check digit (`GBTU 028123` → `GBTU28123` ≠
   `GBTU281235`), cifre trasposte, container WorkHub con `registry_match = false` il cui numero e'
   testo libero solo trim+upper (`YardSlotService.java:564-566`). Mitigazione: rilanciare §6.2 in
   produzione, log server-side richiesti/trovati, e in UI **prodotto vuoto**, mai "sconosciuto". Un
   secondo passaggio "chiave senza check digit" introduce falsi positivi: **sconsigliato**.
2. **Collisioni di chiave → prodotto SBAGLIATO** — `GBTU 2812.35` e `GBTU 028123.5` collassano sulla
   stessa chiave. Probabilita' bassa, conseguenza grave (dato commerciale sulla cassa sbagliata).
   Mitigazione: test unitari con input avversariali, prefisso di 4 lettere sempre nella chiave, query
   §6.3.
3. **Fan-out lato Java** — due container dello stesso piazzale che normalizzano alla stessa chiave:
   con una `Map<String,String>` chiave→numero se ne perde uno in silenzio. Usare
   `Map<String, List<String>>` e replicare il risultato su tutti i numeri della chiave.
4. **Container con `id_block IS NULL`** — il CHECK `ck_wrk_containers_slot_complete` ammette
   `id_yard` valorizzato e slot nullo: container in piazzale ma non posizionati. `isPlaced` li filtra
   dal 3D e **spariscono senza avviso**. Devono comparire nella lista **e** in un contatore accanto al
   toggle ("N container senza slot").
5. **Prodotto vuoto frequente** — sul DB dev 10 container in piazzale su 12 non hanno righe aperte.
   In parte sono posizionamenti di test, in parte e' fisiologico (casse vuote). Da misurare in
   produzione con §6.2: se la quota resta alta su dati veri, vale un giro con gli operatori per
   capire se il registro viene chiuso mentre la cassa e' ancora a terra.
6. **Bundle** — `three` ~650 kB + `troika-three-text` ~100 kB: accettabile solo con import dinamico;
   controllare il report di `npm run build`.
7. **Piazzali grandi** — instancing per tipo, cap sulle etichette, ombre off. Body del POST con 1000
   numeri ≈ 20 kB: ok; se cresce, variante `GET /yards/{id}/products`.
8. **Dati stantii** — il tablet muove i container in continuo. Minimo: mostrare `revision` +
   pulsante Aggiorna. Opzione economica: polling dello snapshot ogni 30 s. Completa: `EventSource` su
   `GET /api/workhub/yards/{id}/stream` (token in query gia' ammesso da `config/SecurityConfig.java:82`).
9. **Due "contenuti" diversi** — `wrk_containers.content_description` e' una nota libera scritta dal
   piazzalista in WorkHub; il prodotto di questa vista viene dal registro. Sotto il numero va **il
   prodotto del registro**; la nota libera al massimo come colonna in piu' nella lista.
10. **Versione three / path addon** — pinnare `^0.158.0` (come WorkHub) e verificare il peer range di
    `troika-three-text`.
11. **CSP** — `troika-three-text` genera gli SDF in un Web Worker via blob URL. Oggi non c'e' CSP
    configurata in `svelte.config.js` (e Leaflet arriva da CDN), quindi nessun blocco; se in futuro si
    aggiunge una CSP servono `worker-src blob:` e `script-src blob:`.

---

## 6. Piano di verifica

### 6.1 Colonne di allineamento — chiuso
`search_container_number`, `backup_container_number`, `backup_container_prefix` e
`final_container_number` non erano usate da nessuna parte del codice e sono state droppate con
`database/migration/2.6.2_drop_ctr_availability_align_columns.sql` (commit `b17d04cd`). Non esiste
quindi una colonna con il numero gia' normalizzato da riusare: serve la chiave di §3.1.

### 6.2 Copertura del match e `[entry multiple]`, per piazzale
Da rilanciare **in produzione**; i valori dev di §2.1 sono la baseline.
```sql
WITH wh AS (
  SELECT c.container_number,
         COALESCE(substring(upper(regexp_replace(c.container_number,'[^A-Za-z0-9]','','g')) from '^[A-Z]{4}'),'')
         || regexp_replace(regexp_replace(upper(regexp_replace(c.container_number,'[^A-Za-z0-9]','','g')),'^[A-Z]+',''),'^0+','') AS k
  FROM wrk_containers c WHERE c.id_yard = :yardId
), av AS (
  SELECT <KEY> AS k, count(*) AS open_rows, count(DISTINCT ca.id_material_type) AS prodotti
  FROM ctr_availability ca
  WHERE ca.delete_date IS NULL
    AND ca.off_date IS NULL AND ca.off_date_2 IS NULL AND ca.off_date_3 IS NULL
  GROUP BY 1
)
SELECT count(*) AS totale_piazzale,
       count(*) FILTER (WHERE av.k IS NULL)     AS senza_riga_aperta,
       count(*) FILTER (WHERE av.open_rows = 1) AS una_riga,
       count(*) FILTER (WHERE av.open_rows > 1) AS multiple,
       count(*) FILTER (WHERE av.open_rows > 1 AND av.prodotti > 1) AS multiple_prodotti_diversi
FROM wh LEFT JOIN av ON av.k = wh.k;
```
Ripetere con `AND ca.id_site = (SELECT id_site FROM wrk_yards WHERE id_yard = :yardId)` per decidere
il filtro sito (§3.2).

### 6.3 Collisioni di chiave
```sql
SELECT <KEY> AS k, count(DISTINCT container_number) AS n, array_agg(DISTINCT container_number) AS varianti
FROM ctr_availability WHERE delete_date IS NULL
GROUP BY 1 HAVING count(DISTINCT container_number) > 1 ORDER BY 2 DESC LIMIT 50;
```
`n > 1` e' atteso e benigno per varianti di scrittura dello stesso container: leggere a mano cercando
numeri **diversi** collassati.

### 6.4 Censimento dei formati
```sql
SELECT container_prefix, count(*) AS righe,
       count(*) FILTER (WHERE container_number ~ '[A-Za-z]') AS con_lettere,
       count(*) FILTER (WHERE container_number ~ '\.')       AS con_punto,
       count(*) FILTER (WHERE container_number ~ '\s')       AS con_spazio,
       count(*) FILTER (WHERE length(regexp_replace(container_number,'\D','','g')) = 7) AS sette_cifre
FROM ctr_availability GROUP BY 1 ORDER BY 2 DESC;
```

### 6.5 Dati per il 3D
```sql
SELECT container_type, count(*) FROM wrk_containers GROUP BY 1 ORDER BY 2 DESC;      -- quanti NULL
SELECT count(*) FROM wrk_containers WHERE id_yard IS NOT NULL AND id_block IS NULL;  -- rischio §5.4
SELECT id_yard, count(*) FROM wrk_containers GROUP BY 1 ORDER BY 2 DESC;             -- caso peggiore
```

### 6.6 Indicizzabilita'
```sql
SELECT proname, provolatile FROM pg_proc WHERE proname IN ('upper','regexp_replace','substring');
-- atteso 'i' (immutable)
```

### 6.7 Performance
`EXPLAIN (ANALYZE, BUFFERS)` della query §3.2 con ~200 chiavi reali. Con 4507 righe il seq scan e'
ininfluente: se sta sotto ~150 ms l'indice di §3.4 non serve.

### 6.8 Test backend — `mvn test -Ptest -Dgroups=unit,controller`
- `ContainerKeyUtilTest` (`@Tag("unit")`): `GBTU 028123.5` / `gbtu-028123-5` / `GBTU0281235` /
  `028123.5`+prefix → stessa chiave; `BRND 42` → `BRND42`; null/blank → null; solo-lettere → chiave
  senza cifre; caso di collisione documentato.
- `WorkhubControllerTest`: nuovo `@Nested` per `lookup-products` (200 + forma della mappa, lista
  vuota → `{}`) e un **403** con `@WithMockUser(roles = "hr")` che sovrascrive l'annotazione di
  classe — e' la prova che `READ_PRODUCT` non e' `READ`.
- Integrazione Testcontainers accanto a `YardSlotServiceIntegrationTest`: righe `ctr_availability`
  con 4 grafie diverse dello stesso container, una riga chiusa (con `off_date`), una cancellata
  logicamente e due righe aperte per lo stesso container → verificare ultima riga, `open_count = 2`,
  esclusione della riga chiusa e di quella cancellata.

### 6.9 Test frontend — `cd frontend && npm run test`
- `slotLayout.test.js`: port dei casi da `WorkHub/src/utils/__tests__/slotLayout.test.ts`, in
  particolare `slotBox` con `orientation` 0 e 90 e `columnBaseHeight` con un 40HC in pila.
- `yardProducts.test.js`: nessuna riga → prodotto `''`; una riga → prodotto; `open_count > 1` → flag
  multiple; `id_block` nullo → `hasSlot: false` ma presente in lista.
- `npm run build`: `three` in un chunk separato, non nel bundle iniziale.

### 6.10 Controlli manuali
1. Utente `logs`: voce "Piazzali" nel menu Deposito, piazzale in 3D, numeri e prodotti leggibili
   sulle casse.
2. Utente con un ruolo `WorkhubRoles.READ` non cd/logs (es. `hr`): voce **assente** e
   `POST /containers/lookup-products` → **403** (curl diretto).
3. Confronto a campione col tablet sullo stesso piazzale: stesse pile, stessi livelli; una pila con
   un 40HC senza casse compenetrate o sospese.
4. **Cassa vuota** in deposito: riga del prodotto vuota, non l'ultimo prodotto noto.
5. Container con due righe aperte nel registro: riga rossa `[entry multiple]`.
6. Toggle 3D/lista + reload → modalita' ricordata; cambio sito/piazzale → canvas ricostruito senza
   errori.
7. Avanti/indietro 10 volte sulla pagina → nessun accumulo di contesti WebGL ("Too many active WebGL
   contexts" assente).
8. A riposo con pagina in primo piano: CPU/GPU ~0% (prova del render on-demand); orbita fluida su
   laptop.
9. Network: un solo `snapshot` e un solo `lookup-products` per cambio piazzale; nessun
   POST/PATCH/DELETE di mutazione.
10. Piazzale senza blocchi e piazzale vuoto → messaggi, non canvas nero.

---

## 7. Riepilogo del riuso

| Serve | Si riusa | Non si riusa (e perche') |
|---|---|---|
| righe aperte del registro | — | `OperationQueryUtil.buildInStockCondition`: risponde alla domanda contabile, non al contenuto fisico (§2.2). Predicato letterale scritto nella query, con il motivo in commento |
| join prodotto | forma di `service/operation/OperationStockService.java:148` | `MaterialType.findById` per riga (N+1, `OperationService.java:723`) |
| batch per N container | schema di `service/ContainerTerminalInfoService.java:118-149` | — |
| contratto REST | `POST /workhub/containers/lookup-positions` (`WorkhubController.java:106`) | — |
| container del piazzale | `repository/YardSlotRepository.java:73` | — |
| snapshot piazzale | endpoint backend esistente: va solo wrappato nel client | nessun endpoint nuovo per il 3D |
| `label`, `pos_from_top` | calcolati dal server (`YardSlotRepository.java:26-29`, `WorkhubMapper.java:19-26`) | non ricalcolarli nel client |
| geometria slot→mondo | port delle funzioni pure di `WorkHub/src/utils/slotLayout.ts` | regole di piazzamento/cascata/riordino |
| grafica cassa | `WorkHub/src/utils/ribTexture.ts`, `constants/branding.ts`, `assets/tb-logo.png` | — |
| pattern UI | `routes/admin/workhub/+page.svelte`, `components/VehicleTable.svelte`, `lib/stores/damageViewMode.js`, `lib/utils/containerInfoTable.js` | nessun componente tabella generico (non esiste nel repo) |
