import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { workHubAPI } from '../../api/WorkHubAPI'
import { logger } from '../../utils/logger'
import { formatDate } from '../../utils/format'
import type { Movement, MovementAction } from '../../types'

const ACTION_LABELS: Record<MovementAction, string> = {
  ENTER: 'Ingresso',
  MOVE: 'Spostamento',
  CASCADE: 'Discesa (cascata)',
  EXIT: 'Uscita',
  UPDATE: 'Modifica',
}

interface ContainerHistoryProps {
  containerNumber: string
}

/** Movement history of a container (`GET /containers/{n}/history`). */
export function ContainerHistory({ containerNumber }: ContainerHistoryProps) {
  const [rows, setRows] = useState<Movement[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setRows(null)
    setError(null)
    workHubAPI
      .getHistory(containerNumber)
      .then((res) => {
        if (!cancelled) setRows(res.data ?? [])
      })
      .catch((err) => {
        logger.error('Storico container non disponibile', err)
        if (!cancelled) setError(err instanceof Error ? err.message : 'Storico non disponibile')
      })
    return () => {
      cancelled = true
    }
  }, [containerNumber])

  if (error) return <p className="p-4 text-sm text-red-400">{error}</p>
  if (!rows) {
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    )
  }
  if (rows.length === 0) return <p className="p-4 text-sm text-slate-400">Nessun movimento registrato.</p>

  return (
    <ol className="divide-y divide-slate-700">
      {rows.map((m) => (
        <li key={m.id_movement} className="px-4 py-2.5 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-white font-medium">{ACTION_LABELS[m.action] ?? m.action}</span>
            <span className="text-xs text-slate-400 whitespace-nowrap">{formatDate(m.created_at)}</span>
          </div>
          <p className="text-slate-300 font-mono text-xs mt-0.5">
            {m.label_from ?? '—'}
            {m.tier_from ? ` (T${m.tier_from})` : ''} → {m.label_to ?? '—'}
            {m.tier_to ? ` (T${m.tier_to})` : ''}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {m.username}
            {m.note ? ` · ${m.note}` : ''}
          </p>
        </li>
      ))}
    </ol>
  )
}
