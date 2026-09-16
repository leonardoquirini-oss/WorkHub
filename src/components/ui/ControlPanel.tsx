import { useUIStore } from '../../store/uiStore'
import { useYardStore } from '../../store/yardStore'
import { useAuthStore } from '../../store/authStore'
import { usePortrait } from '../../hooks/useMediaQuery'
import { Maximize, Info } from 'lucide-react'

export function ControlPanel() {
  const setCameraPreset = useUIStore((s) => s.setCameraPreset)
  const { yards, selectedYardId } = useYardStore()
  const canWrite = useAuthStore((s) => s.canWrite)
  const portrait = usePortrait()

  const yard = yards.find((y) => y.id_yard === selectedYardId)
  if (!yard || portrait) return null

  return (
    <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-20">
      <div className="bg-slate-800/95 backdrop-blur-sm rounded-lg border border-slate-700 shadow-lg p-2 flex gap-2">
        <button
          onClick={() => setCameraPreset('perspective')}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg"
          title="Reimposta vista"
        >
          <Maximize className="w-5 h-5" />
        </button>
      </div>

      <div className="bg-slate-800/95 backdrop-blur-sm rounded-lg border border-slate-700 shadow-lg p-3">
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
          <Info className="w-3 h-3" />
          <span>Comandi</span>
        </div>
        <div className="space-y-1 text-xs text-slate-500">
          <p><span className="text-slate-300">Tocco:</span> seleziona container</p>
          {canWrite && <p><span className="text-slate-300">Tieni premuto:</span> solleva e trascina su uno slot</p>}
          <p><span className="text-slate-300">Un dito / trascina:</span> ruota vista</p>
          <p><span className="text-slate-300">Due dita / rotella:</span> zoom e pan</p>
        </div>
      </div>
    </div>
  )
}
