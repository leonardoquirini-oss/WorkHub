import { useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { Header } from './Header'
import { Yard3D } from '../3d/Yard3D'
import { MapView2D } from '../2d/MapView2D'
import { ContainerList } from '../ui/ContainerList'
import { Toolbar } from '../ui/Toolbar'
import { ContainerPanel } from '../ui/ContainerPanel'
import { ContainerContextMenu } from '../ui/ContainerContextMenu'
import { YardStats } from '../ui/YardStats'
import { ControlPanel } from '../ui/ControlPanel'
import { StatusBanners } from '../ui/StatusBanners'
import { useYardStore } from '../../store/yardStore'
import { useUIStore } from '../../store/uiStore'
import { useYardEvents } from '../../hooks/useYardEvents'

export function AppLayout() {
  const initializeFromStorage = useYardStore((s) => s.initializeFromStorage)
  const loadPreferences = useUIStore((s) => s.loadPreferences)
  const viewMode = useUIStore((s) => s.viewMode)
  const showHeader = useUIStore((s) => s.showHeader)
  const toggleHeader = useUIStore((s) => s.toggleHeader)
  useYardEvents()

  useEffect(() => {
    loadPreferences()
    void initializeFromStorage()
  }, [initializeFromStorage, loadPreferences])

  return (
    <div className="relative h-full w-full flex flex-col bg-slate-900">
      <Header />
      {!showHeader && (
        <button
          onClick={toggleHeader}
          className="absolute top-0 left-1/2 -translate-x-1/2 z-40 px-3 py-1 bg-slate-800/95 hover:bg-slate-700 border border-t-0 border-slate-700 rounded-b-lg text-slate-400 hover:text-white shadow-lg"
          title="Mostra barra"
          aria-label="Mostra barra"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      )}
      <div className="flex-1 relative overflow-hidden">
        {viewMode === '3d' && <Yard3D />}
        {viewMode === '2d' && <MapView2D />}
        {viewMode === 'list' && <ContainerList />}
        <Toolbar />
        <StatusBanners />
        <ContainerPanel />
        <ContainerContextMenu />
        {viewMode === '3d' && (
          <>
            <YardStats />
            <ControlPanel />
          </>
        )}
      </div>
    </div>
  )
}
