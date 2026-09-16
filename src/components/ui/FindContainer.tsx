import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useYardStore } from '../../store/yardStore'
import { useUIStore } from '../../store/uiStore'
import { workHubAPI } from '../../api/WorkHubAPI'
import { notify } from '../../store/notificationStore'
import { logger } from '../../utils/logger'
import { columnBaseHeight, containerHeight, isPlaced, slotBox } from '../../utils/slotLayout'
import type { PositionInfo } from '../../types'

const PULSE_MS = 6000

/** Header search: finds a container in the current yard (fly-to + pulse) or elsewhere (offer to switch yard). */
export function FindContainer() {
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [elsewhere, setElsewhere] = useState<{ number: string; info: PositionInfo } | null>(null)
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { containers, blocks, yards, selectYard } = useYardStore()
  const { requestFlyTo, setPulse, selectContainer, setViewMode } = useUIStore()

  useEffect(() => () => {
    if (pulseTimer.current) clearTimeout(pulseTimer.current)
  }, [])

  const highlight = (number: string) => {
    const c = containers.find((x) => x.container_number === number)
    if (!c) return false
    selectContainer(c.container_number)
    setPulse(c.container_number)
    if (pulseTimer.current) clearTimeout(pulseTimer.current)
    pulseTimer.current = setTimeout(() => setPulse(null), PULSE_MS)
    const block = isPlaced(c) ? blocks.find((b) => b.id_block === c.id_block) : undefined
    if (block && isPlaced(c)) {
      const box = slotBox(block, c.bay, c.row_no, c.bay_span, columnBaseHeight(containers, c), containerHeight(c.container_type))
      setViewMode('3d')
      requestFlyTo(box.center[0], box.center[1], box.center[2])
    } else {
      notify.info(`${c.container_number} e' nel piazzale ma non ancora allocato`)
    }
    return true
  }

  const search = async (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    setElsewhere(null)

    const norm = (s: string) => s.replace(/[\s.\-*]/g, '').toUpperCase()
    const local = containers.find((c) => norm(c.container_number) === norm(q)) ??
      containers.find((c) => norm(c.container_number).includes(norm(q)))
    if (local && highlight(local.container_number)) return

    setBusy(true)
    try {
      const { data } = await workHubAPI.lookupPositions([q])
      const hit = Object.entries(data)[0]
      if (!hit) {
        notify.warning(`${q} non e' in nessun piazzale`)
      } else {
        setElsewhere({ number: hit[0], info: hit[1] })
      }
    } catch (err) {
      logger.error('Ricerca posizione fallita', err)
      notify.error(err instanceof Error ? err.message : 'Ricerca fallita')
    } finally {
      setBusy(false)
    }
  }

  const goThere = async () => {
    if (!elsewhere) return
    const target = yards.find((y) => y.id_yard === elsewhere.info.id_yard)
    if (!target) {
      notify.info(`${elsewhere.number} e' nel piazzale ${elsewhere.info.yard_name} (altro sito): ${elsewhere.info.label}`)
      setElsewhere(null)
      return
    }
    const number = elsewhere.number
    setElsewhere(null)
    await selectYard(target.id_yard)
    // containers are refreshed by selectYard; highlight on the next tick
    setTimeout(() => {
      const c = useYardStore.getState().containers.find((x) => x.container_number === number)
      if (c) highlight(c.container_number)
    }, 0)
  }

  return (
    <div className="relative">
      <form onSubmit={search} className="flex items-center gap-1">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Trova container..."
            aria-label="Trova container"
            className="w-40 sm:w-56 pl-8 pr-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <button type="submit" disabled={busy || !query.trim()} className="px-3 py-1.5 text-sm rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white">
          Trova
        </button>
      </form>

      {elsewhere && (
        <div className="absolute right-0 mt-2 z-30 w-72 bg-slate-800 border border-slate-600 rounded-lg shadow-xl p-3 text-sm">
          <div className="flex items-start justify-between gap-2">
            <p className="text-slate-200">
              <span className="font-mono text-white">{elsewhere.number}</span> si trova in{' '}
              <span className="font-mono text-primary-300">{elsewhere.info.label}</span> ({elsewhere.info.yard_name}),{' '}
              {elsewhere.info.pos_from_top}° dall'alto.
            </p>
            <button onClick={() => setElsewhere(null)} className="text-slate-400 hover:text-white" aria-label="Chiudi">
              <X className="w-4 h-4" />
            </button>
          </div>
          <button onClick={goThere} className="mt-2 w-full px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white">
            Vai al piazzale
          </button>
        </div>
      )}
    </div>
  )
}
