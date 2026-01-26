import { useContainerSelection } from '../../hooks/useContainerSelection'
import { useYardStore } from '../../store/yardStore'
import { useUIStore } from '../../store/uiStore'
import { notify } from '../../store/notificationStore'
import {
  CONTAINER_TYPE_LABELS,
  CONTAINER_STATUS_LABELS,
  CONTAINER_STATUS_COLORS,
} from '../../constants/containerSizes'
import { calculateTier } from '../../utils/stackingLogic'
import {
  X,
  Package,
  MapPin,
  Weight,
  RotateCw,
  Trash2,
  Layers,
  FileText,
} from 'lucide-react'
import type { Rotation } from '../../types'

export function ContainerPanel() {
  const { selectedContainer, clearSelection } = useContainerSelection()
  const { updateContainer, removeContainer } = useYardStore()
  const { showPanel } = useUIStore()

  if (!selectedContainer || !showPanel) {
    return null
  }

  const tier = calculateTier(selectedContainer.position_z, selectedContainer.container_type)

  const handleRotate = async (direction: 'cw' | 'ccw') => {
    const rotations: Rotation[] = [0, 90, 180, 270]
    const currentIndex = rotations.indexOf(selectedContainer.rotation)
    const newIndex =
      direction === 'cw'
        ? (currentIndex + 1) % 4
        : (currentIndex - 1 + 4) % 4
    const newRotation = rotations[newIndex]

    try {
      await updateContainer(selectedContainer.container_number, { rotation: newRotation })
      notify.success('Container ruotato')
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Errore rotazione')
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Eliminare il container ${selectedContainer.container_number}?`)) {
      return
    }

    try {
      await removeContainer(selectedContainer.container_number)
      clearSelection()
      notify.success('Container rimosso')
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Errore rimozione container')
    }
  }

  return (
    <div className="absolute top-16 right-4 w-80 bg-slate-800/95 backdrop-blur-sm rounded-xl border border-slate-700 shadow-xl overflow-hidden z-20">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-700/50 border-b border-slate-600">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-primary-400" />
          <span className="font-medium text-white">Dettagli Container</span>
        </div>
        <button
          onClick={clearSelection}
          className="p-1 text-slate-400 hover:text-white hover:bg-slate-600 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Container number */}
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Numero</p>
          <p className="text-lg font-mono text-white">{selectedContainer.container_number}</p>
        </div>

        {/* Type and status */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Tipo</p>
            <p className="text-sm text-white">
              {CONTAINER_TYPE_LABELS[selectedContainer.container_type]}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Stato</p>
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: CONTAINER_STATUS_COLORS[selectedContainer.status] }}
              />
              <span className="text-sm text-white">
                {CONTAINER_STATUS_LABELS[selectedContainer.status]}
              </span>
            </div>
          </div>
        </div>

        {/* Position */}
        <div>
          <div className="flex items-center gap-1 text-xs text-slate-400 uppercase tracking-wider mb-1">
            <MapPin className="w-3 h-3" />
            <span>Posizione</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="bg-slate-700/50 rounded px-2 py-1">
              <span className="text-slate-400">X:</span>{' '}
              <span className="text-white">{selectedContainer.position_x.toFixed(1)}m</span>
            </div>
            <div className="bg-slate-700/50 rounded px-2 py-1">
              <span className="text-slate-400">Y:</span>{' '}
              <span className="text-white">{selectedContainer.position_y.toFixed(1)}m</span>
            </div>
            <div className="bg-slate-700/50 rounded px-2 py-1">
              <span className="text-slate-400">Tier:</span>{' '}
              <span className="text-white">{tier}</span>
            </div>
          </div>
        </div>

        {/* Weight */}
        {selectedContainer.weight && (
          <div>
            <div className="flex items-center gap-1 text-xs text-slate-400 uppercase tracking-wider mb-1">
              <Weight className="w-3 h-3" />
              <span>Peso</span>
            </div>
            <p className="text-sm text-white">
              {selectedContainer.weight.toLocaleString('it-IT')} kg
            </p>
          </div>
        )}

        {/* Content description */}
        {selectedContainer.content_description && (
          <div>
            <div className="flex items-center gap-1 text-xs text-slate-400 uppercase tracking-wider mb-1">
              <FileText className="w-3 h-3" />
              <span>Contenuto</span>
            </div>
            <p className="text-sm text-white">{selectedContainer.content_description}</p>
          </div>
        )}

        {/* Notes */}
        {selectedContainer.notes && (
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Note</p>
            <p className="text-sm text-slate-300 italic">{selectedContainer.notes}</p>
          </div>
        )}

        {/* Color preview */}
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Colore</p>
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded border border-slate-600"
              style={{ backgroundColor: selectedContainer.color }}
            />
            <span className="text-sm text-slate-300">{selectedContainer.color}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-3 bg-slate-700/30 border-t border-slate-600 flex gap-2">
        <button
          onClick={() => handleRotate('ccw')}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
          title="Ruota antiorario"
        >
          <RotateCw className="w-4 h-4 scale-x-[-1]" />
          <span>-90°</span>
        </button>
        <button
          onClick={() => handleRotate('cw')}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
          title="Ruota orario"
        >
          <RotateCw className="w-4 h-4" />
          <span>+90°</span>
        </button>
        <button
          onClick={handleDelete}
          className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors"
          title="Elimina container"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
