import { useYardStore } from '../../store/yardStore'
import { LayoutGrid } from 'lucide-react'

export function YardSelector() {
  const { yards, selectedYardId, selectYard, isLoadingYards, isLoadingContainers } = useYardStore()

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const yardId = parseInt(e.target.value, 10)
    if (!isNaN(yardId)) {
      selectYard(yardId)
    }
  }

  if (yards.length === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      <LayoutGrid className="w-4 h-4 text-slate-400" />
      <select
        value={selectedYardId ?? ''}
        onChange={handleChange}
        disabled={isLoadingYards || isLoadingContainers}
        className="bg-slate-700 text-white text-sm rounded-lg px-3 py-1.5 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
      >
        <option value="" disabled>
          Seleziona piazzale
        </option>
        {yards.map((yard) => (
          <option key={yard.id_yard} value={yard.id_yard}>
            {yard.name}
          </option>
        ))}
      </select>
    </div>
  )
}
