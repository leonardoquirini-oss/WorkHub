import { Eye, X } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { usePlacePending } from '../../hooks/usePlacePending'

/** Top-centre chips: read-only mode and the "tap a free slot" prompt of an ongoing entry. */
export function StatusBanners() {
  const canWrite = useAuthStore((s) => s.canWrite)
  const { pendingEnter, cancel } = usePlacePending()

  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 pointer-events-none">
      {!canWrite && (
        <span className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/90 border border-slate-600 text-xs text-slate-300">
          <Eye className="w-3.5 h-3.5" /> Sola lettura
        </span>
      )}
      {pendingEnter && (
        <span className="pointer-events-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary-600/90 border border-primary-400 text-sm text-white shadow-lg animate-slide-in">
          Tocca uno slot libero per posizionare <span className="font-mono font-semibold">{pendingEnter.container_number}</span>
          <button onClick={cancel} className="p-0.5 rounded hover:bg-primary-500" aria-label="Annulla ingresso">
            <X className="w-4 h-4" />
          </button>
        </span>
      )}
    </div>
  )
}
