import { useMemo, useState } from 'react'
import { useYardStore } from '../../store/yardStore'
import { useUIStore } from '../../store/uiStore'
import { CONTAINER_STATUS_COLORS, CONTAINER_STATUS_LABELS, CONTAINER_TYPE_LABELS } from '../../constants/containerSizes'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { formatDate } from '../../utils/format'
import type { Container } from '../../types'

type SortKey = 'label' | 'container_number' | 'container_type' | 'status' | 'pos_from_top' | 'updated_at'

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'label', label: 'Posizione' },
  { key: 'pos_from_top', label: "Dall'alto" },
  { key: 'container_number', label: 'Container' },
  { key: 'container_type', label: 'Tipo' },
  { key: 'status', label: 'Stato' },
  { key: 'updated_at', label: 'Aggiornato' },
]

function compare(a: Container, b: Container, key: SortKey): number {
  const va = a[key] ?? ''
  const vb = b[key] ?? ''
  if (typeof va === 'number' && typeof vb === 'number') return va - vb
  return String(va).localeCompare(String(vb), 'it')
}

/** Sortable table of all containers of the yard (placed and to-be-allocated). */
export function ContainerList() {
  const { containers } = useYardStore()
  const { selectedContainerNumber, selectContainer, setViewMode, setPulse } = useUIStore()
  const [sortKey, setSortKey] = useState<SortKey>('label')
  const [asc, setAsc] = useState(true)

  const sorted = useMemo(() => {
    const list = [...containers].sort((a, b) => compare(a, b, sortKey))
    return asc ? list : list.reverse()
  }, [containers, sortKey, asc])

  const onSort = (key: SortKey) => {
    if (key === sortKey) setAsc(!asc)
    else {
      setSortKey(key)
      setAsc(true)
    }
  }

  const locate = (c: Container) => {
    selectContainer(c.container_number)
    setPulse(c.container_number)
    setViewMode('3d')
  }

  return (
    <div className="w-full h-full overflow-auto bg-slate-900 p-2 sm:p-4">
      <table className="w-full text-sm text-left text-slate-300">
        <thead className="text-xs uppercase text-slate-400 bg-slate-800 sticky top-0">
          <tr>
            {COLUMNS.map((col) => (
              <th key={col.key} className="px-3 py-2 cursor-pointer select-none whitespace-nowrap" onClick={() => onSort(col.key)}>
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {sortKey === col.key && (asc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                </span>
              </th>
            ))}
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => (
            <tr
              key={c.container_number}
              onClick={() => selectContainer(c.container_number)}
              className={`border-b border-slate-800 cursor-pointer hover:bg-slate-800/70 ${
                c.container_number === selectedContainerNumber ? 'bg-primary-600/20' : ''
              }`}
            >
              <td className="px-3 py-2 font-mono">{c.label ?? <span className="text-amber-400">da allocare</span>}</td>
              <td className="px-3 py-2">{c.pos_from_top ?? '-'}</td>
              <td className="px-3 py-2 font-mono text-white">{c.container_number}</td>
              <td className="px-3 py-2">{CONTAINER_TYPE_LABELS[c.container_type] ?? c.container_type}</td>
              <td className="px-3 py-2">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CONTAINER_STATUS_COLORS[c.status] }} />
                  {CONTAINER_STATUS_LABELS[c.status] ?? c.status}
                </span>
              </td>
              <td className="px-3 py-2 text-xs text-slate-400 whitespace-nowrap">{formatDate(c.updated_at ?? c.created_at)}</td>
              <td className="px-3 py-2 text-right">
                {c.label && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      locate(c)
                    }}
                    className="px-2 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600 text-white"
                  >
                    Mostra in 3D
                  </button>
                )}
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length + 1} className="px-3 py-6 text-center text-slate-500">
                Nessun container nel piazzale
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
