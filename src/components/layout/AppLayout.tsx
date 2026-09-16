import { useEffect } from 'react'
import { Header } from './Header'
import { Yard3D } from '../3d/Yard3D'
import { MapView2D } from '../2d/MapView2D'
import { ContainerList } from '../ui/ContainerList'
import { Toolbar } from '../ui/Toolbar'
import { ContainerPanel } from '../ui/ContainerPanel'
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
  useYardEvents()

  useEffect(() => {
    loadPreferences()
    void initializeFromStorage()
  }, [initializeFromStorage, loadPreferences])

  return (
    <div className="h-full w-full flex flex-col bg-slate-900">
      <Header />
      <div className="flex-1 relative overflow-hidden">
        {viewMode === '3d' && <Yard3D />}
        {viewMode === '2d' && <MapView2D />}
        {viewMode === 'list' && <ContainerList />}
        <Toolbar />
        <StatusBanners />
        <ContainerPanel />
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
