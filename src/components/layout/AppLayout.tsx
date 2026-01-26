import { useEffect } from 'react'
import { Header } from './Header'
import { Yard3D } from '../3d/Yard3D'
import { Toolbar } from '../ui/Toolbar'
import { ContainerPanel } from '../ui/ContainerPanel'
import { YardStats } from '../ui/YardStats'
import { ControlPanel } from '../ui/ControlPanel'
import { useYardStore } from '../../store/yardStore'
import { useUIStore } from '../../store/uiStore'

export function AppLayout() {
  const { initializeFromStorage } = useYardStore()
  const { loadPreferences } = useUIStore()

  useEffect(() => {
    loadPreferences()
    initializeFromStorage()
  }, [initializeFromStorage, loadPreferences])

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-900">
      <Header />
      <div className="flex-1 relative overflow-hidden">
        <Yard3D />
        <Toolbar />
        <ContainerPanel />
        <YardStats />
        <ControlPanel />
      </div>
    </div>
  )
}
