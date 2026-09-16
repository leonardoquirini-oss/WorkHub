import { useState } from 'react'
import { useUIStore } from '../../store/uiStore'
import { useYardStore } from '../../store/yardStore'
import { useAuthStore } from '../../store/authStore'
import { AddContainerModal } from './AddContainerModal'
import { Plus, Grid3X3, Layers, BarChart3, Camera, Eye, EyeOff, Box, Map, List } from 'lucide-react'
import type { CameraPreset, ViewMode } from '../../types'

const VIEW_MODES: { mode: ViewMode; label: string; icon: React.ReactNode }[] = [
  { mode: '3d', label: '3D', icon: <Box className="w-4 h-4" /> },
  { mode: '2d', label: 'Mappa', icon: <Map className="w-4 h-4" /> },
  { mode: 'list', label: 'Lista', icon: <List className="w-4 h-4" /> },
]

const CAMERA_PRESETS: { preset: CameraPreset; label: string }[] = [
  { preset: 'perspective', label: '3D' },
  { preset: 'top', label: 'Alto' },
  { preset: 'front', label: 'Fronte' },
  { preset: 'side', label: 'Lato' },
]

export function Toolbar() {
  const [showAddModal, setShowAddModal] = useState(false)
  const { selectedYardId, blocks } = useYardStore()
  const canWrite = useAuthStore((s) => s.canWrite)
  const { showGrid, showAreas, showStats, toggleGrid, toggleAreas, toggleStats, cameraPreset, setCameraPreset, viewMode, setViewMode, pendingEnter } =
    useUIStore()

  return (
    <>
      <div className="absolute top-2 left-2 sm:top-4 sm:left-4 flex flex-col gap-2 z-20 max-h-[calc(100%-1rem)] overflow-y-auto">
        {canWrite && (
          <button
            onClick={() => setShowAddModal(true)}
            disabled={!selectedYardId || blocks.length === 0 || pendingEnter !== null}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg shadow-lg"
            title="Ingresso container"
          >
            <Plus className="w-5 h-5" />
            <span className="text-sm font-medium">Aggiungi</span>
          </button>
        )}

        <div className="bg-slate-800/95 backdrop-blur-sm rounded-lg border border-slate-700 shadow-lg overflow-hidden flex sm:flex-col">
          {VIEW_MODES.map(({ mode, label, icon }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`flex items-center gap-2 px-3 py-2 text-sm ${
                viewMode === mode ? 'bg-primary-600/30 text-primary-300' : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              {icon}
              <span>{label}</span>
            </button>
          ))}
        </div>

        {viewMode !== 'list' && (
          <div className="bg-slate-800/95 backdrop-blur-sm rounded-lg border border-slate-700 shadow-lg overflow-hidden">
            {viewMode === '3d' && <ToolbarButton active={showGrid} onClick={toggleGrid} icon={<Grid3X3 className="w-4 h-4" />} label="Griglia" />}
            <ToolbarButton active={showAreas} onClick={toggleAreas} icon={<Layers className="w-4 h-4" />} label="Aree" />
            {viewMode === '3d' && <ToolbarButton active={showStats} onClick={toggleStats} icon={<BarChart3 className="w-4 h-4" />} label="Stats" />}
          </div>
        )}

        {viewMode === '3d' && (
          <div className="bg-slate-800/95 backdrop-blur-sm rounded-lg border border-slate-700 shadow-lg overflow-hidden">
            <div className="px-3 py-1.5 text-xs text-slate-400 border-b border-slate-700">
              <Camera className="w-3 h-3 inline mr-1" />
              Camera
            </div>
            {CAMERA_PRESETS.map(({ preset, label }) => (
              <button
                key={preset}
                onClick={() => setCameraPreset(preset)}
                className={`w-full px-3 py-2 text-left text-sm ${
                  cameraPreset === preset ? 'bg-primary-600/30 text-primary-400' : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {showAddModal && <AddContainerModal onClose={() => setShowAddModal(false)} />}
    </>
  )
}

interface ToolbarButtonProps {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}

function ToolbarButton({ active, onClick, icon, label }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 w-full px-3 py-2 text-sm ${active ? 'bg-primary-600/30 text-primary-400' : 'text-slate-300 hover:bg-slate-700'}`}
    >
      {icon}
      <span>{label}</span>
      {active ? <Eye className="w-3 h-3 ml-auto" /> : <EyeOff className="w-3 h-3 ml-auto opacity-50" />}
    </button>
  )
}
