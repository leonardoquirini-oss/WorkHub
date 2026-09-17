import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronsUp } from 'lucide-react'
import { useYardStore } from '../../store/yardStore'
import { useUIStore } from '../../store/uiStore'
import { useAuthStore } from '../../store/authStore'
import { notify } from '../../store/notificationStore'
import { columnNeighbor, isPlaced, topTier } from '../../utils/slotLayout'
import type { Container, PlacedContainer } from '../../types'

/** Margine (px) fra il menu e il bordo della finestra. */
const EDGE_MARGIN = 8

interface MenuAction {
  key: string
  label: string
  hint: string
  icon: typeof ArrowDown
  /** Livello di destinazione nella colonna. */
  tier: number
}

/** Azioni di riordino disponibili per il container, dalla sua posizione nella pila. */
function actionsFor(containers: Container[], c: PlacedContainer): MenuAction[] {
  const below = columnNeighbor(containers, c, -1)
  const above = columnNeighbor(containers, c, 1)
  const top = topTier(containers, c.id_block, c.row_no, c.bay)
  const actions: MenuAction[] = []

  if (below) {
    actions.push({ key: 'down', label: 'Switch', hint: below.container_number, icon: ArrowDown, tier: c.tier - 1 })
  }
  if (above) {
    actions.push({ key: 'up', label: 'Switch', hint: above.container_number, icon: ArrowUp, tier: c.tier + 1 })
  }
  if (top - c.tier >= 2) {
    actions.push({ key: 'top', label: 'Porta in alto', hint: `1° dall'alto`, icon: ChevronsUp, tier: top })
  }
  return actions
}

/**
 * Menu contestuale del container (click destro o doppio tap): scambio con il container
 * sottostante/sovrastante e risalita in cima alla pila. Ogni voce chiama `restackContainer`,
 * che applica la mutazione ottimistica e la conferma col server.
 */
export function ContainerContextMenu() {
  const { contextMenu, closeContextMenu } = useUIStore()
  const { containers, restackContainer } = useYardStore()
  const canWrite = useAuthStore((s) => s.canWrite)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: 0, top: 0 })
  const [busy, setBusy] = useState(false)

  const container = contextMenu ? containers.find((c) => c.container_number === contextMenu.containerNumber) : undefined

  // Rientra nella finestra (il menu si apre sul punto toccato, che puo' essere a filo bordo)
  useLayoutEffect(() => {
    if (!contextMenu) return
    const box = menuRef.current?.getBoundingClientRect()
    const width = box?.width ?? 0
    const height = box?.height ?? 0
    setPos({
      left: Math.max(EDGE_MARGIN, Math.min(contextMenu.x, window.innerWidth - width - EDGE_MARGIN)),
      top: Math.max(EDGE_MARGIN, Math.min(contextMenu.y, window.innerHeight - height - EDGE_MARGIN)),
    })
  }, [contextMenu])

  useEffect(() => {
    if (!contextMenu) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeContextMenu()
    }
    const onPointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) closeContextMenu()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }, [contextMenu, closeContextMenu])

  const run = useCallback(
    async (action: MenuAction, c: PlacedContainer) => {
      setBusy(true)
      const ok = await restackContainer(c.container_number, action.tier)
      setBusy(false)
      closeContextMenu()
      if (ok) notify.success(`${c.container_number}: ${action.label.toLowerCase()} eseguito`)
    },
    [closeContextMenu, restackContainer]
  )

  if (!contextMenu || !canWrite || !container || !isPlaced(container)) return null
  const actions = actionsFor(containers, container)

  return (
    <div
      ref={menuRef}
      role="menu"
      style={{ left: pos.left, top: pos.top }}
      className="fixed z-40 min-w-56 py-1 rounded-xl bg-slate-800/95 backdrop-blur-sm border border-slate-700 shadow-2xl overflow-hidden"
    >
      <div className="px-3 py-2 border-b border-slate-700">
        <p className="font-mono text-sm text-white truncate">{container.container_number}</p>
        <p className="text-xs text-slate-400">
          {container.label ?? ''} · {container.pos_from_top ?? 1}° dall'alto
        </p>
      </div>
      {actions.length === 0 ? (
        <p className="px-3 py-2 text-xs text-slate-400">Nessun container sopra o sotto</p>
      ) : (
        actions.map((action) => (
          <button
            key={action.key}
            role="menuitem"
            disabled={busy}
            onClick={() => void run(action, container)}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm text-white hover:bg-slate-700 disabled:opacity-40"
          >
            <action.icon className="w-4 h-4 text-primary-400 shrink-0" />
            <span className="flex-1">{action.label}</span>
            <span className="font-mono text-xs text-slate-400 truncate max-w-28">{action.hint}</span>
          </button>
        ))
      )}
    </div>
  )
}
