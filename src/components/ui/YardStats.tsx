import { useYardStore } from '../../store/yardStore'
import { useUIStore } from '../../store/uiStore'
import { usePortrait } from '../../hooks/useMediaQuery'
import { CONTAINER_TYPE_LABELS, CONTAINER_STATUS_LABELS, CONTAINER_STATUS_COLORS } from '../../constants/containerSizes'
import { Package, Layers, LogOut } from 'lucide-react'

export function YardStats() {
  const { getYardStats, selectedYardId, yards, blocks } = useYardStore()
  const showStats = useUIStore((s) => s.showStats)
  const portrait = usePortrait()

  const yard = yards.find((y) => y.id_yard === selectedYardId)
  const stats = getYardStats()

  if (!showStats || !yard || portrait) return null

  const usagePercent = stats.maxCapacity > 0 ? (stats.capacityUsed / stats.maxCapacity) * 100 : 0
  const maxTier = blocks.reduce((m, b) => Math.max(m, b.max_tier), 0)

  return (
    <div className="absolute bottom-4 left-4 bg-slate-800/95 backdrop-blur-sm rounded-xl border border-slate-700 shadow-xl overflow-hidden z-20 w-64">
      <div className="px-4 py-2 bg-slate-700/50 border-b border-slate-600">
        <h3 className="text-sm font-medium text-white">
          {yard.code ? <span className="font-mono text-primary-300 mr-2">{yard.code}</span> : null}
          {yard.name}
        </h3>
        <p className="text-xs text-slate-400">
          {yard.width}m × {yard.length}m · {blocks.filter((b) => b.is_active).length} blocchi
        </p>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-500/20 rounded-lg">
            <Package className="w-4 h-4 text-primary-400" />
          </div>
          <div>
            <p className="text-xs text-slate-400">Container</p>
            <p className="text-lg font-semibold text-white">
              {stats.totalContainers}
              {stats.unallocated > 0 && <span className="text-xs text-amber-400 ml-2">{stats.unallocated} da allocare</span>}
            </p>
          </div>
        </div>

        {stats.markedForExit > 0 && (
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <LogOut className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Da far uscire</p>
              <p className="text-lg font-semibold text-white">{stats.markedForExit}</p>
            </div>
          </div>
        )}

        {Object.keys(stats.containersByType).length > 0 && (
          <div>
            <p className="text-xs text-slate-400 mb-1">Per tipo</p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(stats.containersByType).map(([type, count]) => (
                <span key={type} className="px-2 py-0.5 bg-slate-700 rounded text-xs text-white">
                  {CONTAINER_TYPE_LABELS[type as keyof typeof CONTAINER_TYPE_LABELS] || type}: {count}
                </span>
              ))}
            </div>
          </div>
        )}

        {Object.keys(stats.containersByStatus).length > 0 && (
          <div>
            <p className="text-xs text-slate-400 mb-1">Per stato</p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(stats.containersByStatus).map(([status, count]) => (
                <span
                  key={status}
                  className="px-2 py-0.5 rounded text-xs text-white flex items-center gap-1"
                  style={{ backgroundColor: `${CONTAINER_STATUS_COLORS[status]}30` }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CONTAINER_STATUS_COLORS[status] }} />
                  {CONTAINER_STATUS_LABELS[status] || status}: {count}
                </span>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-400">Occupazione (TEU)</span>
            <span className="text-white">
              {stats.capacityUsed} / {stats.maxCapacity}
            </span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${usagePercent > 80 ? 'bg-red-500' : usagePercent > 60 ? 'bg-amber-500' : 'bg-green-500'}`}
              style={{ width: `${Math.min(usagePercent, 100)}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Layers className="w-3 h-3" />
          <span>Max impilamento: {maxTier || yard.max_stack_height} livelli</span>
        </div>
      </div>
    </div>
  )
}
