# WorkHub - 3D Application

## Panoramica del Progetto

Applicazione web 3D per la gestione e visualizzazione di un piazzale container (container yard). L'applicazione permetterà di organizzare, visualizzare e gestire lo stacking di container in un ambiente 3D interattivo, ottimizzato per tablet.
L'applicazione consentira' anche di gestire i danni rilevati dagli operatori sui container e sui mezzi da lavoro che operano nei piazzali.

## Obiettivi Principali

1. **Visualizzazione 3D del piazzale**: Rappresentazione tridimensionale del yard con container impilabili
2. **Interazione touch-friendly**: Ottimizzata per utilizzo su tablet
3. **Drag & Drop 3D**: Trascinamento e posizionamento container nello spazio 3D
4. **Gestione stacking**: Sistema intelligente per impilare container con vincoli fisici
5. **Rotazione e orientamento**: Possibilità di ruotare container (0°, 90°, 180°, 270°)
6. **Persistenza dati**: Salvataggio della configurazione del piazzale
7. **Selezione aree di lavoro**: l'utente potra' selezionare piu' di un'area di lavoro (piazzale), ciascuna con la sua configurazione.


## Stack Tecnologico

### Core
- **React 18+** - Framework UI
- **TypeScript** - Type safety
- **Vite** - Build tool e dev server veloce

### 3D Engine
- **Three.js** - Libreria 3D WebGL
- **@react-three/fiber** - React renderer per Three.js
- **@react-three/drei** - Helper e componenti utili per R3F

### Gestione Stato e Interazioni
- **@react-three/drei** - Per controlli camera, gizmos, etc.
- **zustand** o **Redux Toolkit** - State management
- **@use-gesture/react** - Gestione gesture avanzate

### UI/UX
- **Tailwind CSS** - Styling
- **React DnD** o gestione custom - Drag and drop
- **Lucide React** - Icone

### Persistenza
- **LocalStorage** - Salvataggio configurazione locale
- **IndexedDB** (opzionale) - Per configurazioni più complesse

## Struttura dell'Applicazione

```
src/
├── components/
│   ├── 3d/
│   │   ├── Container3D.tsx          # Componente singolo container 3D
│   │   ├── Yard3D.tsx               # Scena principale del piazzale
│   │   ├── Grid3D.tsx               # Griglia di riferimento del piazzale
│   │   ├── Controls.tsx             # Controlli camera (orbit, zoom)
│   │   └── StackingHelper.tsx       # Visual helper per stacking
│   ├── ui/
│   │   ├── Toolbar.tsx              # Barra strumenti principale
│   │   ├── ContainerPanel.tsx       # Pannello info container selezionato
│   │   ├── YardStats.tsx            # Statistiche piazzale
│   │   └── ControlPanel.tsx         # Pannello controlli vista
│   └── layout/
│       ├── AppLayout.tsx            # Layout principale
│       └── Header.tsx               # Header con titolo e azioni
├── store/
│   ├── yardStore.ts                 # Store configurazione piazzale
│   └── uiStore.ts                   # Store stato UI
├── types/
│   ├── container.ts                 # Types per container
│   ├── yard.ts                      # Types per piazzale
│   └── index.ts                     # Export centralizato
├── utils/
│   ├── stackingLogic.ts             # Logica validazione stacking
│   ├── positionHelpers.ts           # Helper posizionamento 3D
│   ├── collisionDetection.ts        # Rilevamento collisioni
│   └── persistence.ts               # Save/load configurazione
├── hooks/
│   ├── useContainerDrag.ts          # Hook per drag container
│   ├── useStackValidation.ts        # Hook validazione stack
│   └── useYardPersistence.ts        # Hook salvataggio/caricamento
├── constants/
│   ├── containerSizes.ts            # Dimensioni standard container
│   └── yardConfig.ts                # Configurazione piazzale
├── App.tsx
└── main.tsx
```

## Specifiche Funzionali

### 1. Tipi di Container
L'applicazione deve supportare container standard ISO:
- **20' Standard**: 6.1m × 2.4m × 2.6m
- **40' Standard**: 12.2m × 2.4m × 2.6m
- **40' High Cube**: 12.2m × 2.4m × 2.9m
- **45' High Cube**: 13.7m × 2.4m × 2.9m

### 2. Configurazione Piazzale
- **Dimensioni configurabili**: es. 100m × 50m
- **Sistema a griglia**: Celle/bay per organizzazione
- **Blocchi/Zone**: Possibilità di definire aree diverse
- **Numero massimo livelli**: Configurabile (default 5-6)

### 3. Funzionalità Drag & Drop 3D

#### Comportamento Base
- Click su container → Solleva container con animazione smooth
- Drag → Container segue il cursore/touch con feedback visivo
- Hover su posizione valida → Indicatore verde
- Hover su posizione non valida → Indicatore rosso
- Drop → Posizionamento con snap alla griglia

#### Validazioni Stacking
- **Supporto sottostante**: Container deve poggiare su terra O su altro container
- **Allineamento**: Container superiori devono essere allineati con quelli sotto
- **Peso**: Regole peso (es. container pesanti solo sotto)
- **Stabilità**: Check stabilità stack (max container su singola base)

#### Feedback Visivo
- Outline/highlight container selezionato
- Ghost/preview position durante drag
- Griglia snap visibile
- Indicatori rosso/verde validità posizione
- Ombre per depth perception

### 4. Controlli Camera 3D
- **Orbit**: Ruota attorno al piazzale
- **Zoom**: In/Out con mouse wheel o pinch
- **Pan**: Sposta vista lateralmente
- **Reset View**: Pulsante per tornare a vista default
- **Preset Views**: Top, Front, Side, Isometric

### 5. Gestione Container

#### Azioni Disponibili
- **Aggiungi**: Nuovo container da catalogo
- **Rimuovi**: Elimina container selezionato
- **Ruota**: 90° steps (0°, 90°, 180°, 270°)
- **Duplica**: Crea copia container selezionato
- **Modifica Info**: ID, tipo, peso, contenuto, note

#### Informazioni Container
```typescript
interface Container {
  id: string;
  type: '20' | '40' | '40HC' | '45HC';
  position: { x: number; y: number; z: number };
  rotation: 0 | 90 | 180 | 270;
  color?: string; // Codifica visiva (es. per destinazione)
  weight?: number;
  content?: string;
  ownerId?: string;
  notes?: string;
}
```

### 6. UI/UX Requirements

#### Toolbar (Superiore)
- Aggiungi container (dropdown tipi)
- Salva layout
- Carica layout
- Reset piazzale
- Esporta configurazione
- Statistiche (num container, capacità utilizzata %)

#### Pannello Laterale (Opzionale)
- Filtri: per tipo, colore, proprietario
- Lista container con ricerca
- Info container selezionato
- Azioni rapide

#### Controlli Touch (Tablet)
- **Singolo touch**: Selezione
- **Long press**: Apre menu contestuale
- **Pinch**: Zoom camera
- **Two-finger pan**: Sposta camera
- **Drag**: Sposta container

### 7. Persistenza e Stato

#### LocalStorage
Salvare automaticamente:
- Ultima configurazione piazzale
- Preferenze UI (vista camera, filtri)
- Template configurazioni salvate

#### Export/Import
- **JSON export**: Configurazione completa
- **Import JSON**: Carica configurazione salvata
- **Backup automatico**: Ogni 5 minuti (optional)

### 8. Ottimizzazioni Performance

#### Rendering 3D
- **Instancing**: Per container dello stesso tipo
- **LOD**: Level of Detail per vista distante
- **Frustum culling**: Non renderizzare fuori vista
- **Batching**: Materiali e geometrie

#### Mobile/Tablet
- **Texture compression**
- **Geometry semplificata** su device più lenti
- **Adaptive quality**: Riduce qualità se FPS < 30
- **Lazy loading**: Carica solo container visibili

## Fasi di Sviluppo

### Phase 1: Setup & Basic 3D Scene (MVP)
- [ ] Setup Vite + React + TypeScript
- [ ] Installazione Three.js + R3F + Drei
- [ ] Scena 3D base con illuminazione
- [ ] Grid/pavimento piazzale
- [ ] Camera controls (OrbitControls)
- [ ] Singolo container 3D renderizzato

### Phase 2: Container Management
- [ ] Componente Container3D parametrico (dimensioni diverse)
- [ ] Store per gestione container
- [ ] Aggiungi/rimuovi container
- [ ] Selezione container (raycast)
- [ ] Pannello info container selezionato
- [ ] Colori/materiali diversi

### Phase 3: Drag & Drop
- [ ] Hook useContainerDrag
- [ ] Drag 3D con raycasting piano
- [ ] Snap to grid
- [ ] Visual feedback durante drag
- [ ] Validazione posizione
- [ ] Animazioni smooth

### Phase 4: Stacking Logic
- [ ] Sistema coordinate stack
- [ ] Validazione supporto sottostante
- [ ] Check collisioni
- [ ] Max height enforcement
- [ ] Visual helper stacking
- [ ] Auto-align su container sotto

### Phase 5: UI & Controls
- [ ] Toolbar principale
- [ ] Controlli camera avanzati
- [ ] Pannello statistiche
- [ ] Filtri e ricerca
- [ ] Menu contestuale
- [ ] Responsive layout tablet

### Phase 6: Persistence
- [ ] LocalStorage save/load
- [ ] Export/Import JSON
- [ ] Template configurazioni
- [ ] Auto-save
- [ ] Undo/Redo (optional)

### Phase 7: Polish & Optimization
- [ ] Performance optimization
- [ ] Touch gesture refinement
- [ ] Animazioni polish
- [ ] Error handling
- [ ] Loading states
- [ ] Help/Tutorial overlay

## Comandi Principali

```bash
# Setup iniziale
npm create vite@latest container-yard -- --template react-ts
cd container-yard
npm install

# Dipendenze 3D
npm install three @react-three/fiber @react-three/drei

# State & Utils
npm install zustand @use-gesture/react

# UI
npm install tailwindcss postcss autoprefixer
npm install lucide-react

# Dev
npm run dev

# Build
npm run build
npm run preview
```

## Configurazione Iniziale

### tsconfig.json
Assicurarsi di avere:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### vite.config.ts
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Per accesso da tablet in rete locale
    port: 3000
  }
})
```

## Note di Implementazione

### Three.js / R3F Best Practices
1. Usa `useFrame` per animazioni smooth
2. Memoizza geometrie e materiali con `useMemo`
3. Usa `<InstancedMesh>` per container ripetuti
4. Disponi correttamente delle risorse con `dispose()`

### Touch Optimization
1. Usa `touch-action: none` per controllo completo gesture
2. Debounce eventi troppo frequenti
3. Feedback visivo immediato (< 100ms)
4. Testa su device reali (iPad, Android tablet)

### Performance Targets
- **FPS**: Minimo 30fps, target 60fps
- **Load time**: < 3 secondi initial load
- **Interaction lag**: < 100ms response time
- **Max containers**: Supportare almeno 500 container

## Testing

### Test Scenarios
1. Aggiungi 50+ container e verifica performance
2. Stacking multi-livello (6 container in altezza)
3. Drag & drop con gesture touch
4. Save/load configurazione grande
5. Ruota container in tutti gli orientamenti
6. Zoom estremo (molto vicino / molto lontano)

### Browser/Device Target
- **Desktop**: Chrome, Firefox, Safari (latest)
- **Tablet**: iPad (Safari), Android tablet (Chrome)
- **Screen sizes**: 10" - 13" tablet screens

## Estensioni Future (Post-MVP)

- **Multi-utente**: Sync real-time con WebSocket
- **Scanner barcode**: Integrazione camera per scan container ID
- **AI optimization**: Suggerimenti posizionamento ottimale
- **Reporting**: Export PDF layout piazzale
- **Planning**: Timeline arrivo/partenza container
- **3D Import**: Import modelli 3D custom container
- **VR/AR**: Visualizzazione in realtà aumentata

## Risorse di Riferimento

- [Three.js Documentation](https://threejs.org/docs/)
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber/)
- [Drei Components](https://github.com/pmndrs/drei)
- [Container ISO Standards](https://www.iso.org/standard/76912.html)

## Glossario Terminologia Container Yard

- **Bay**: Fila longitudinale container
- **Row**: Fila trasversale container
- **Tier**: Livello verticale (1st tier = terra)
- **Stack**: Pila verticale container
- **Slot**: Posizione singola container (bay-row-tier)
- **TEU**: Twenty-foot Equivalent Unit (misura standard)
- **Block**: Gruppo di bay raggruppate

---

## Per Claude Code

**Quando inizi a sviluppare:**

1. Inizia con Phase 1 (MVP) - crea prima una scena 3D base funzionante
2. Usa componenti modulari e riutilizzabili
3. Commenta codice complesso (logica stacking, collisioni)
4. Segui TypeScript strict mode - type tutto
5. Testa frequentemente su tablet/touch se possibile
6. Performance first - monitora FPS durante sviluppo

**Domande da fare durante lo sviluppo:**
- Quali dimensioni del piazzale vogliamo (default)?
- Quanti container dobbiamo supportare contemporaneamente?
- Serve multi-utente o è single-user?
- Quali info aggiuntive servono per container?
- Sistema metrico o imperiale per UI?

Buon sviluppo! 🚢📦
