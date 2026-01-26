import { useState, useCallback, useRef, useEffect } from 'react'
import { useYardStore } from '../../store/yardStore'
import { workHubAPI } from '../../api/WorkHubAPI'
import { notify } from '../../store/notificationStore'
import {
  CONTAINER_TYPE_LABELS,
  DEFAULT_CONTAINER_COLORS,
} from '../../constants/containerSizes'
import { findValidStackPosition, snapToGrid } from '../../utils/stackingLogic'
import { isWithinYardBounds, checkCollision } from '../../utils/collisionDetection'
import { X, Search, Loader2, Package } from 'lucide-react'
import type { ContainerType, UnitSearchResult } from '../../types'

interface AddContainerModalProps {
  onClose: () => void
}

export function AddContainerModal({ onClose }: AddContainerModalProps) {
  const { yards, selectedYardId, containers, addContainer } = useYardStore()
  const yard = yards.find((y) => y.id_yard === selectedYardId)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<UnitSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedUnit, setSelectedUnit] = useState<UnitSearchResult | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state for manual entry
  const [containerNumber, setContainerNumber] = useState('')
  const [containerType, setContainerType] = useState<ContainerType>('40')
  const [color, setColor] = useState(DEFAULT_CONTAINER_COLORS[0])

  // Ref for debounce timer
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [])

  // Dynamic search with debounce (300ms)
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Clear results if query too short
    if (value.length < 2) {
      setSearchResults([])
      return
    }

    // Debounce: wait 300ms before searching
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const response = await workHubAPI.searchUnits(value.trim())
        console.log('searchUnits response:', response)

        // Handle different response structures
        // API might return { success, data: [...] } or directly [...]
        const results = Array.isArray(response) ? response : response.data

        if (!Array.isArray(results)) {
          console.warn('Unexpected response structure:', response)
          setSearchResults([])
          return
        }

        // Filter to only containers
        const containerResults = results.filter((u) => u.unitType === 'c')
        setSearchResults(containerResults)
      } catch (err) {
        console.error('Search error:', err)
        notify.error('Errore ricerca container')
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300)
  }, [])

  const handleSelectUnit = (unit: UnitSearchResult) => {
    setSelectedUnit(unit)
    setContainerNumber(unit.cassa)
    // Try to parse container type from search result
    if (unit.tipo) {
      if (unit.tipo.includes('45')) {
        setContainerType('45HC')
      } else if (unit.tipo.includes('40HC') || unit.tipo.includes('High')) {
        setContainerType('40HC')
      } else if (unit.tipo.includes('40')) {
        setContainerType('40')
      } else if (unit.tipo.includes('20')) {
        setContainerType('20')
      }
    }
    setSearchResults([])
    setSearchQuery('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!yard || !containerNumber.trim()) return

    setIsSubmitting(true)
    try {
      // Find a valid position for the new container
      const gridSize = yard.grid_cell_size

      // Try to find an empty spot
      let foundPosition = false
      let posX = 0
      let posY = 0
      let posZ = 0

      for (let x = 0; x <= yard.width - 12; x += gridSize) {
        for (let y = 0; y <= yard.length - 3; y += gridSize) {
          const validZ = findValidStackPosition(x, y, containerType, 0, containers, yard.max_stack_height)

          if (validZ >= 0 && validZ === 0) {
            // Check if within bounds
            if (!isWithinYardBounds(x, y, containerType, 0, yard.width, yard.length)) {
              continue
            }

            // Check collision
            const hasCollision = checkCollision(
              { posX: x, posY: y, posZ: validZ, type: containerType, rotation: 0 },
              containers
            )

            if (!hasCollision) {
              posX = x
              posY = y
              posZ = validZ
              foundPosition = true
              break
            }
          }
        }
        if (foundPosition) break
      }

      if (!foundPosition) {
        notify.error('Nessuna posizione disponibile nel piazzale')
        setIsSubmitting(false)
        return
      }

      await addContainer({
        container_number: containerNumber.trim().toUpperCase(),
        id_yard: yard.id_yard,
        container_type: containerType,
        position_x: posX,
        position_y: posY,
        position_z: posZ,
        rotation: 0,
        color,
        status: 'active',
      })

      notify.success('Container aggiunto')
      onClose()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Errore aggiunta container')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-700/50 border-b border-slate-600">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary-400" />
            <span className="font-medium text-white">Aggiungi Container</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-600 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Cerca nel sistema
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Digita per cercare..."
                className="w-full pl-10 pr-10 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                </div>
              )}
            </div>

            {/* Search results */}
            {searchResults.length > 0 && (
              <div className="mt-2 bg-slate-900/50 border border-slate-600 rounded-lg max-h-40 overflow-y-auto">
                {searchResults.map((unit) => (
                  <button
                    key={unit.id}
                    type="button"
                    onClick={() => handleSelectUnit(unit)}
                    className="w-full px-3 py-2 text-left hover:bg-slate-700 transition-colors border-b border-slate-700 last:border-b-0"
                  >
                    <p className="text-sm text-white font-mono">{unit.cassa}</p>
                    <p className="text-xs text-slate-400">{unit.tipo}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-slate-700 pt-4">
            <p className="text-xs text-slate-400 mb-4">
              Oppure inserisci manualmente i dati del container:
            </p>

            {/* Container number */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Numero Container *
              </label>
              <input
                type="text"
                value={containerNumber}
                onChange={(e) => setContainerNumber(e.target.value)}
                placeholder="es. MSKU1234567"
                required
                maxLength={20}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono uppercase"
              />
            </div>

            {/* Container type */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Tipo Container
              </label>
              <select
                value={containerType}
                onChange={(e) => setContainerType(e.target.value as ContainerType)}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {Object.entries(CONTAINER_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Color */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Colore
              </label>
              <div className="flex gap-2">
                {DEFAULT_CONTAINER_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-lg border-2 transition-all ${
                      color === c ? 'border-white scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !containerNumber.trim()}
              className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Aggiunta...</span>
                </>
              ) : (
                <span>Aggiungi</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
