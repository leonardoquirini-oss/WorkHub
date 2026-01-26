import { useUIStore } from '../../store/uiStore'
import { useYardStore } from '../../store/yardStore'
import { Maximize, Move3D, Info } from 'lucide-react'
import type { CameraPreset } from '../../types'

export function ControlPanel() {
  const { setCameraPreset } = useUIStore()
  const { yards, selectedYardId, containers } = useYardStore()

  const yard = yards.find((y) => y.id_yard === selectedYardId)

  if (!yard) return null

  const handleFitToContainers = () => {
    // Reset to default perspective view
    setCameraPreset('perspective')
  }

  return (
    <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-20">
      {/* Quick actions */}
      <div className="bg-slate-800/95 backdrop-blur-sm rounded-lg border border-slate-700 shadow-lg p-2 flex gap-2">
        <button
          onClick={handleFitToContainers}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          title="Reimposta vista"
        >
          <Maximize className="w-5 h-5" />
        </button>
      </div>

      {/* Help tooltip */}
      <div className="bg-slate-800/95 backdrop-blur-sm rounded-lg border border-slate-700 shadow-lg p-3">
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
          <Info className="w-3 h-3" />
          <span>Controlli</span>
        </div>
        <div className="space-y-1 text-xs text-slate-500">
          <p><span className="text-slate-300">Click:</span> Seleziona container</p>
          <p><span className="text-slate-300">Drag:</span> Sposta container</p>
          <p><span className="text-slate-300">Scroll:</span> Zoom</p>
          <p><span className="text-slate-300">Click + Drag:</span> Ruota vista</p>
        </div>
      </div>
    </div>
  )
}
