import { useCallback, useEffect, useRef, useState } from 'react'
import { useUIStore } from '../../store/uiStore'
import { useYardStore } from '../../store/yardStore'
import { useAuthStore } from '../../store/authStore'
import { AddContainerModal } from './AddContainerModal'
import { Plus, Grid3X3, Layers, BarChart3, Camera, Eye, EyeOff, Box, Map, List, GripHorizontal } from 'lucide-react'
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

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)

/**
 * Floating toolbar (add container, view mode, layers, camera). It can be dragged by its
 * handle so it never covers the content underneath — the position is persisted; a double
 * click (or double tap) on the handle puts it back in the default corner.
 */
export function Toolbar() {
  const [showAddModal, setShowAddModal] = useState(false)
  const { selectedYardId, blocks } = useYardStore()
  const canWrite = useAuthStore((s) => s.canWrite)
  const {
    showGrid, showAreas, showStats, toggleGrid, toggleAreas, toggleStats,
    cameraPreset, setCameraPreset, viewMode, setViewMode, pendingEnter,
    toolbarPos, setToolbarPos,
  } = useUIStore()

  const rootRef = useRef<HTMLDivElement>(null)
  const grabRef = useRef<{ dx: number; dy: number } | null>(null)

  /** Area the toolbar can be moved in (the view container it is positioned against). */
  const area = useCallback(() => {
    const el = rootRef.current
    const parent = el?.offsetParent as HTMLElement | null
    if (!el || !parent) return null
    return { rect: parent.getBoundingClientRect(), w: el.offsetWidth, h: el.offsetHeight }
  }, [])

  const onHandleDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = rootRef.current
    if (!el || e.button !== 0) return
    const box = el.getBoundingClientRect()
    grabRef.current = { dx: e.clientX - box.left, dy: e.clientY - box.top }
    e.currentTarget.setPointerCapture(e.pointerId)
    e.preventDefault()
  }, [])

  const onHandleMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const grab = grabRef.current
      const a = area()
      if (!grab || !a) return
      setToolbarPos({
        x: clamp(e.clientX - a.rect.left - grab.dx, 0, Math.max(a.rect.width - a.w, 0)),
        y: clamp(e.clientY - a.rect.top - grab.dy, 0, Math.max(a.rect.height - a.h, 0)),
      })
    },
    [area, setToolbarPos]
  )

  const onHandleUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    grabRef.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }, [])

  // Keep the toolbar inside the view when it is resized (rotation, window resize).
  useEffect(() => {
    if (!toolbarPos) return
    const onResize = () => {
      const a = area()
      if (!a) return
      const x = clamp(toolbarPos.x, 0, Math.max(a.rect.width - a.w, 0))
      const y = clamp(toolbarPos.y, 0, Math.max(a.rect.height - a.h, 0))
      if (x !== toolbarPos.x || y !== toolbarPos.y) setToolbarPos({ x, y })
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [toolbarPos, area, setToolbarPos])

  return (
    <>
      <div
        ref={rootRef}
        style={toolbarPos ? { left: toolbarPos.x, top: toolbarPos.y } : undefined}
        className={`absolute z-30 flex flex-col gap-2 max-h-[calc(100%-1rem)] overflow-y-auto ${
          toolbarPos ? '' : 'top-2 left-2 sm:top-4 sm:left-4'
        }`}
      >
        <div
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
          onDoubleClick={() => setToolbarPos(null)}
          title="Trascina per spostare il menu · doppio click per rimetterlo nell'angolo"
          className="flex items-center justify-center gap-1 h-6 rounded-lg bg-slate-800/95 backdrop-blur-sm border border-slate-700 shadow-lg text-slate-400 hover:text-white cursor-grab active:cursor-grabbing touch-none select-none"
        >
          <GripHorizontal className="w-4 h-4" />
        </div>

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
