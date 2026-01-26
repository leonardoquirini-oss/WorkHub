import { useState } from 'react'
import { useUIStore } from '../../store/uiStore'
import { useYardStore } from '../../store/yardStore'
import { AddContainerModal } from './AddContainerModal'
import {
  Plus,
  Grid3X3,
  Layers,
  BarChart3,
  Camera,
  Box,
  Eye,
  EyeOff,
} from 'lucide-react'
import type { CameraPreset } from '../../types'

export function Toolbar() {
  const [showAddModal, setShowAddModal] = useState(false)
  const { selectedYardId } = useYardStore()
  const {
    showGrid,
    showAreas,
    showStats,
    toggleGrid,
    toggleAreas,
    toggleStats,
    cameraPreset,
    setCameraPreset,
  } = useUIStore()

  const cameraPresets: { preset: CameraPreset; label: string; icon: string }[] = [
    { preset: 'perspective', label: '3D', icon: '3D' },
    { preset: 'top', label: 'Alto', icon: 'T' },
    { preset: 'front', label: 'Fronte', icon: 'F' },
    { preset: 'side', label: 'Lato', icon: 'S' },
  ]

  return (
    <>
      <div className="absolute top-16 left-4 flex flex-col gap-2 z-20">
        {/* Add container button */}
        <button
          onClick={() => setShowAddModal(true)}
          disabled={!selectedYardId}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg shadow-lg transition-colors"
          title="Aggiungi container"
        >
          <Plus className="w-5 h-5" />
          <span className="text-sm font-medium">Aggiungi</span>
        </button>

        {/* View toggles */}
        <div className="bg-slate-800/95 backdrop-blur-sm rounded-lg border border-slate-700 shadow-lg overflow-hidden">
          <ToolbarButton
            active={showGrid}
            onClick={toggleGrid}
            icon={<Grid3X3 className="w-4 h-4" />}
            label="Griglia"
          />
          <ToolbarButton
            active={showAreas}
            onClick={toggleAreas}
            icon={<Layers className="w-4 h-4" />}
            label="Aree"
          />
          <ToolbarButton
            active={showStats}
            onClick={toggleStats}
            icon={<BarChart3 className="w-4 h-4" />}
            label="Stats"
          />
        </div>

        {/* Camera presets */}
        <div className="bg-slate-800/95 backdrop-blur-sm rounded-lg border border-slate-700 shadow-lg overflow-hidden">
          <div className="px-3 py-1.5 text-xs text-slate-400 border-b border-slate-700">
            <Camera className="w-3 h-3 inline mr-1" />
            Camera
          </div>
          {cameraPresets.map(({ preset, label }) => (
            <button
              key={preset}
              onClick={() => setCameraPreset(preset)}
              className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                cameraPreset === preset
                  ? 'bg-primary-600/30 text-primary-400'
                  : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Add container modal */}
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
      className={`flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors ${
        active ? 'bg-primary-600/30 text-primary-400' : 'text-slate-300 hover:bg-slate-700'
      }`}
    >
      {active ? icon : icon}
      <span>{label}</span>
      {active ? (
        <Eye className="w-3 h-3 ml-auto" />
      ) : (
        <EyeOff className="w-3 h-3 ml-auto opacity-50" />
      )}
    </button>
  )
}
