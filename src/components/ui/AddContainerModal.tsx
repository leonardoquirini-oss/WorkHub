import { useState, useCallback, useRef, useEffect } from 'react'
import { workHubAPI } from '../../api/WorkHubAPI'
import { useUIStore } from '../../store/uiStore'
import { useYardStore } from '../../store/yardStore'
import { notify } from '../../store/notificationStore'
import { CONTAINER_TYPE_LABELS, DEFAULT_CONTAINER_COLORS } from '../../constants/containerSizes'
import { logger } from '../../utils/logger'
import { typeFromRegistry } from '../../utils/registry'
import { X, Search, Loader2, Package } from 'lucide-react'
import type { ContainerType, UnitSearchResult } from '../../types'

interface AddContainerModalProps {
  onClose: () => void
}

/**
 * Collects the data of a container entering the yard. The slot is chosen afterwards by
 * tapping a free slot in the 3D scene or the 2D map (see `usePlacePending`).
 */
export function AddContainerModal({ onClose }: AddContainerModalProps) {
  const setPendingEnter = useUIStore((s) => s.setPendingEnter)
  const containers = useYardStore((s) => s.containers)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<UnitSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [fromRegistry, setFromRegistry] = useState(false)

  const [containerNumber, setContainerNumber] = useState('')
  const [containerType, setContainerType] = useState<ContainerType>('40')
  const [color, setColor] = useState(DEFAULT_CONTAINER_COLORS[0])
  const [content, setContent] = useState('')
  const [notes, setNotes] = useState('')

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
  }, [])

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    if (value.trim().length < 2) {
      setSearchResults([])
      return
    }
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const response = await workHubAPI.searchUnits(value.trim())
        const results = Array.isArray(response) ? response : response.data
        if (!Array.isArray(results)) {
          logger.warn('Risposta inattesa da /units/search', response)
          setSearchResults([])
          return
        }
        setSearchResults(results.filter((u) => u.unitType === 'c'))
      } catch (err) {
        logger.error("Ricerca unita' fallita", err)
        notify.error('Errore ricerca container')
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300)
  }, [])

  const handleSelectUnit = (unit: UnitSearchResult) => {
    setContainerNumber(unit.cassa)
    const type = typeFromRegistry(unit.tipo)
    if (type) setContainerType(type)
    setFromRegistry(true)
    setSearchResults([])
    setSearchQuery('')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const number = containerNumber.trim().toUpperCase()
    if (!number) return
    if (containers.some((c) => c.container_number.toUpperCase() === number)) {
      notify.warning(`${number} e' gia' in questo piazzale`)
      return
    }
    setPendingEnter({
      container_number: number,
      container_type: containerType,
      color,
      content_description: content.trim() || null,
      notes: notes.trim() || null,
      status: 'active',
    })
    notify.info(`Tocca uno slot libero per posizionare ${number}`, 8000)
    onClose()
  }

  const inputClass =
    'w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-2xl w-full max-w-md max-h-full overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-700/50 border-b border-slate-600 sticky top-0">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary-400" />
            <span className="font-medium text-white">Ingresso container</span>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white hover:bg-slate-600 rounded" aria-label="Chiudi">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Cerca nel registro</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Digita almeno 2 caratteri..."
                className={`${inputClass} pl-10`}
                autoFocus
              />
              {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />}
            </div>
            {searchResults.length > 0 && (
              <div className="mt-2 bg-slate-900/50 border border-slate-600 rounded-lg max-h-40 overflow-y-auto">
                {searchResults.map((unit) => (
                  <button
                    key={unit.id}
                    type="button"
                    onClick={() => handleSelectUnit(unit)}
                    className="w-full px-3 py-2 text-left hover:bg-slate-700 border-b border-slate-700 last:border-b-0"
                  >
                    <p className="text-sm text-white font-mono">{unit.cassa}</p>
                    <p className="text-xs text-slate-400">{unit.tipo}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-slate-700 pt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Numero container *</label>
              <input
                type="text"
                value={containerNumber}
                onChange={(e) => {
                  setContainerNumber(e.target.value)
                  setFromRegistry(false)
                }}
                placeholder="es. GBTU 028123.5"
                required
                maxLength={50}
                className={`${inputClass} font-mono uppercase`}
              />
              {containerNumber && !fromRegistry && (
                <p className="mt-1 text-xs text-amber-300">Numero inserito a mano: verra' segnalato se assente dal registro.</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Tipo</label>
              <select value={containerType} onChange={(e) => setContainerType(e.target.value as ContainerType)} className={inputClass}>
                {Object.entries(CONTAINER_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Contenuto</label>
              <input type="text" value={content} onChange={(e) => setContent(e.target.value)} maxLength={200} className={inputClass} />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Note</label>
              <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} className={inputClass} />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Colore</label>
              <div className="flex flex-wrap gap-2">
                {DEFAULT_CONTAINER_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={`Colore ${c}`}
                    className={`w-8 h-8 rounded-lg border-2 transition-all ${color === c ? 'border-white scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg">
              Annulla
            </button>
            <button
              type="submit"
              disabled={!containerNumber.trim()}
              className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg"
            >
              Scegli slot
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
