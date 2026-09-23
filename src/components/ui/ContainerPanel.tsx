import { useEffect, useState } from 'react'
import { useContainerSelection } from '../../hooks/useContainerSelection'
import { usePortrait } from '../../hooks/useMediaQuery'
import { useYardStore } from '../../store/yardStore'
import { useUIStore } from '../../store/uiStore'
import { useAuthStore } from '../../store/authStore'
import { notify } from '../../store/notificationStore'
import { CONTAINER_TYPE_LABELS, CONTAINER_STATUS_LABELS, CONTAINER_STATUS_COLORS } from '../../constants/containerSizes'
import { columnBaseHeight, columnOf, containerHeight, isPlaced, slotBox } from '../../utils/slotLayout'
import { daysWaiting, exitReference, isMarkedForExit } from '../../utils/exitMark'
import { isMultiGiacenza, materialLabel } from '../../utils/containerMaterial'
import { ConfirmDialog } from './ConfirmDialog'
import { ContainerEditForm } from './ContainerEditForm'
import { ContainerHistory } from './ContainerHistory'
import { formatDate } from '../../utils/format'
import { X, Package, MapPin, LogOut, Crosshair, AlertTriangle } from 'lucide-react'
import type { Container } from '../../types'

type Tab = 'info' | 'history'

/** Details of the selected container: position, editable fields, history, exit. */
export function ContainerPanel() {
  const { selectedContainer, selectedContainerMaterial, clearSelection } = useContainerSelection()
  const { containers, blocks, exitContainer } = useYardStore()
  const { showPanel, requestFlyTo, setPulse, setViewMode } = useUIStore()
  const canWrite = useAuthStore((s) => s.canWrite)
  const portrait = usePortrait()
  const [tab, setTab] = useState<Tab>('info')
  const [confirmExit, setConfirmExit] = useState(false)

  useEffect(() => setTab('info'), [selectedContainer?.container_number])

  if (!selectedContainer || !showPanel) return null
  const c = selectedContainer

  const locate = () => {
    if (!isPlaced(c)) return
    const block = blocks.find((b) => b.id_block === c.id_block)
    if (!block) return
    const box = slotBox(block, c.bay, c.row_no, c.bay_span, columnBaseHeight(containers, c), containerHeight(c.container_type))
    setViewMode('3d')
    setPulse(c.container_number)
    requestFlyTo(box.center[0], box.center[1], box.center[2])
  }

  const doExit = async () => {
    setConfirmExit(false)
    // La nota del movimento porta il riferimento RCS: nello storico resta scritto perche' e' uscito.
    const note = isMarkedForExit(c) ? `Uscita da registro RCS · ${exitReference(c)}` : undefined
    const ok = await exitContainer(c.container_number, note)
    if (ok) {
      notify.success(`Container ${c.container_number} uscito dal piazzale`)
      clearSelection()
    }
  }

  const frame = portrait
    ? 'absolute inset-x-0 bottom-0 max-h-[60%] rounded-t-2xl'
    : 'absolute top-16 right-4 w-[calc(100%-2rem)] sm:w-80 max-h-[calc(100%-5rem)] rounded-xl'

  return (
    <aside className={`${frame} bg-slate-800/95 backdrop-blur-sm border border-slate-700 shadow-xl z-20 flex flex-col overflow-hidden`}>
      <header className="flex items-center justify-between px-4 py-3 bg-slate-700/50 border-b border-slate-600">
        <div className="flex items-center gap-2 min-w-0">
          <Package className="w-5 h-5 text-primary-400 shrink-0" />
          <div className="min-w-0">
            <span className="font-mono font-medium text-white truncate block">{c.container_number}</span>
            {materialLabel(selectedContainerMaterial) && (
              <span
                className={`block text-xs truncate ${
                  isMultiGiacenza(selectedContainerMaterial) ? 'text-red-400 font-medium animate-pulse' : 'text-slate-400'
                }`}
              >
                {materialLabel(selectedContainerMaterial)}
              </span>
            )}
          </div>
        </div>
        <button onClick={clearSelection} className="p-1 text-slate-400 hover:text-white hover:bg-slate-600 rounded" aria-label="Chiudi">
          <X className="w-5 h-5" />
        </button>
      </header>

      <nav className="flex border-b border-slate-700 text-sm">
        {(['info', 'history'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 ${tab === t ? 'text-primary-300 border-b-2 border-primary-400' : 'text-slate-400 hover:text-white'}`}
          >
            {t === 'info' ? 'Dettagli' : 'Storico'}
          </button>
        ))}
      </nav>

      <div className="overflow-y-auto flex-1">
        {tab === 'info' ? (
          <div className="p-4 space-y-4">
            <PositionCard container={c} containers={containers} />
            {isMarkedForExit(c) && <ExitMarkCard container={c} onExit={canWrite ? () => setConfirmExit(true) : null} />}
            {c.registry_match === false && (
              <p className="flex items-start gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/40 rounded-lg p-2">
                <AlertTriangle className="w-4 h-4 shrink-0" /> Numero non presente nel registro container
              </p>
            )}
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <dt className="text-slate-400">Tipo</dt>
              <dd className="text-white">{CONTAINER_TYPE_LABELS[c.container_type] ?? c.container_type}</dd>
              <dt className="text-slate-400">Stato</dt>
              <dd className="text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CONTAINER_STATUS_COLORS[c.status] }} />
                {CONTAINER_STATUS_LABELS[c.status] ?? c.status}
              </dd>
              {c.weight != null && (
                <>
                  <dt className="text-slate-400">Peso</dt>
                  <dd className="text-white">{c.weight.toLocaleString('it-IT')} kg</dd>
                </>
              )}
              <dt className="text-slate-400">Aggiornato</dt>
              <dd className="text-white text-xs">
                {formatDate(c.updated_at ?? c.created_at)}
                {c.updated_by ? ` · ${c.updated_by}` : ''}
              </dd>
            </dl>
            {canWrite ? <ContainerEditForm container={c} /> : <ReadOnlyFields container={c} />}
          </div>
        ) : (
          <ContainerHistory containerNumber={c.container_number} />
        )}
      </div>

      <footer className="flex gap-2 px-4 py-3 border-t border-slate-700 bg-slate-800">
        <button
          onClick={locate}
          disabled={!isPlaced(c)}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-sm"
        >
          <Crosshair className="w-4 h-4" /> Mostra
        </button>
        {canWrite && (
          <button
            onClick={() => setConfirmExit(true)}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-600/80 hover:bg-red-600 text-white text-sm"
          >
            <LogOut className="w-4 h-4" /> Uscita
          </button>
        )}
      </footer>

      {confirmExit && (
        <ConfirmDialog
          title="Uscita container"
          message={exitMessage(c)}
          confirmLabel="Conferma uscita"
          variant="danger"
          onConfirm={doExit}
          onCancel={() => setConfirmExit(false)}
        />
      )}
    </aside>
  )
}

/**
 * Marchio "da far uscire": la merce e' stata scaricata in RCS, la cassa e' ancora in piazzale.
 * Il riferimento al registro e i giorni di attesa dicono all'operatore da quanto aspetta e perche'.
 */
function ExitMarkCard({ container: c, onExit }: { container: Container; onExit: (() => void) | null }) {
  const days = daysWaiting(c)
  const reference = exitReference(c)
  return (
    <div className="rounded-lg bg-red-500/10 border border-red-500/40 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-red-300">
        <LogOut className="w-4 h-4 shrink-0" /> Da far uscire
      </div>
      {reference && <p className="text-xs text-red-200/90">{reference}</p>}
      {days != null && (
        <p className="text-xs text-slate-300">
          In attesa da <span className="text-white font-medium">{days}</span> {days === 1 ? 'giorno' : 'giorni'}
        </p>
      )}
      {onExit && (
        <button
          onClick={onExit}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-600/80 hover:bg-red-600 text-white text-sm"
        >
          <LogOut className="w-4 h-4" /> Registra uscita
        </button>
      )}
    </div>
  )
}

function PositionCard({ container: c, containers }: { container: Container; containers: Container[] }) {
  if (!isPlaced(c)) {
    return (
      <div className="rounded-lg bg-amber-500/10 border border-amber-500/40 p-3 text-sm text-amber-200">
        Container da allocare: non ha ancora uno slot nel piazzale.
      </div>
    )
  }
  const above = c.pos_from_top ?? 1
  const stack = columnOf(containers, c.id_block, c.row_no, c.bay).length
  return (
    <div className="rounded-lg bg-slate-900/60 border border-slate-700 p-3">
      <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
        <MapPin className="w-3.5 h-3.5" /> Posizione
      </div>
      <p className="font-mono text-lg text-white">{c.label ?? `${c.id_block}-${c.bay}-${c.row_no}`}</p>
      <p className="text-sm text-slate-300 mt-1">
        <span className="text-white font-medium">{above}°</span> dall'alto · livello {c.tier} da terra · pila di {Math.max(stack, above)}
      </p>
    </div>
  )
}

function ReadOnlyFields({ container: c }: { container: Container }) {
  return (
    <dl className="text-sm space-y-2">
      <div>
        <dt className="text-slate-400">Contenuto</dt>
        <dd className="text-white">{c.content_description || '-'}</dd>
      </div>
      <div>
        <dt className="text-slate-400">Note</dt>
        <dd className="text-white whitespace-pre-wrap">{c.notes || '-'}</dd>
      </div>
    </dl>
  )
}

function exitMessage(c: Container): string {
  const base = `Registrare l'uscita di ${c.container_number} dal piazzale?`
  if (!isPlaced(c)) return base
  const above = (c.pos_from_top ?? 1) - 1
  return above > 0 ? `${base} ${above} container sopra di esso scenderanno di un livello.` : base
}
