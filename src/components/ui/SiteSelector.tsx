import { useYardStore } from '../../store/yardStore'
import { Building2 } from 'lucide-react'

export function SiteSelector() {
  const { sites, selectedSiteId, selectSite, isLoadingYards } = useYardStore()

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const siteId = parseInt(e.target.value, 10)
    if (!isNaN(siteId)) {
      selectSite(siteId)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Building2 className="w-4 h-4 text-slate-400" />
      <select
        value={selectedSiteId ?? ''}
        onChange={handleChange}
        disabled={isLoadingYards}
        className="bg-slate-700 text-white text-sm rounded-lg px-3 py-1.5 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
      >
        <option value="" disabled>
          Seleziona sito
        </option>
        {sites.map((site) => (
          <option key={site.id_site} value={site.id_site}>
            {site.name}
          </option>
        ))}
      </select>
    </div>
  )
}
