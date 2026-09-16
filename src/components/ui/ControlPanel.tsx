import { useUIStore } from '../../store/uiStore'
import { useYardStore } from '../../store/yardStore'
import { usePortrait } from '../../hooks/useMediaQuery'
import { Maximize } from 'lucide-react'

/** Bottom-right quick action: bring the camera back to the default view of the yard. */
export function ControlPanel() {
  const setCameraPreset = useUIStore((s) => s.setCameraPreset)
  const { yards, selectedYardId } = useYardStore()
  const portrait = usePortrait()

  const yard = yards.find((y) => y.id_yard === selectedYardId)
  if (!yard || portrait) return null

  return (
    <div className="absolute bottom-4 right-4 z-20">
      <div className="bg-slate-800/95 backdrop-blur-sm rounded-lg border border-slate-700 shadow-lg p-2">
        <button
          onClick={() => setCameraPreset('perspective')}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg"
          title="Reimposta vista"
          aria-label="Reimposta vista"
        >
          <Maximize className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
