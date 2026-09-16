import { create } from 'zustand'
import { STORAGE_KEYS } from '../api/config'
import { logger } from '../utils/logger'
import type { CameraPreset, ContainerStatus, ContainerType, RealtimeStatus, SlotRef, ViewMode } from '../types'

interface UIPreferences {
  showGrid: boolean
  showAreas: boolean
  showStats: boolean
  viewMode: ViewMode
  toolbarPos: ToolbarPos | null
}

/** Position (px, relative to the view area) of the floating toolbar; null = default corner. */
export interface ToolbarPos {
  x: number
  y: number
}

/** Slot under the pointer while dragging, with the outcome of the client-side validation. */
export interface DragTarget extends SlotRef {
  tier: number
  valid: boolean
  reason?: string
}

/** Camera fly-to request; `nonce` forces the effect to re-run for the same point. */
export interface FlyToRequest {
  x: number
  y: number
  z: number
  nonce: number
}

/** Container data collected by the "Aggiungi" modal, waiting for the operator to tap a free slot. */
export interface PendingEnter {
  container_number: string
  container_type: ContainerType
  color?: string | null
  content_description?: string | null
  notes?: string | null
  status?: ContainerStatus
}

interface UIStore {
  showGrid: boolean
  showAreas: boolean
  showStats: boolean
  showPanel: boolean
  viewMode: ViewMode

  selectedContainerNumber: string | null

  isDragging: boolean
  dragTarget: DragTarget | null

  toolbarPos: ToolbarPos | null

  cameraPreset: CameraPreset
  flyTo: FlyToRequest | null
  /** Container highlighted after a search ("Trova"). */
  pulseNumber: string | null

  pendingEnter: PendingEnter | null
  realtime: RealtimeStatus

  toggleGrid: () => void
  toggleAreas: () => void
  toggleStats: () => void
  togglePanel: () => void
  setViewMode: (mode: ViewMode) => void
  setToolbarPos: (pos: ToolbarPos | null) => void
  selectContainer: (containerNumber: string | null) => void
  toggleSelect: (containerNumber: string) => void
  setDragging: (isDragging: boolean) => void
  setDragTarget: (target: DragTarget | null) => void
  setCameraPreset: (preset: CameraPreset) => void
  requestFlyTo: (x: number, y: number, z: number) => void
  setPulse: (containerNumber: string | null) => void
  setPendingEnter: (pending: PendingEnter | null) => void
  setRealtime: (status: RealtimeStatus) => void
  loadPreferences: () => void
}

function savePreferences(prefs: UIPreferences) {
  try {
    localStorage.setItem(STORAGE_KEYS.uiPreferences, JSON.stringify(prefs))
  } catch (err) {
    logger.warn('Preferenze UI non salvate', err)
  }
}

function loadStoredPreferences(): Partial<UIPreferences> | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.uiPreferences)
    return stored ? (JSON.parse(stored) as Partial<UIPreferences>) : null
  } catch (err) {
    logger.warn('Preferenze UI non leggibili, uso i default', err)
    return null
  }
}

function sameTarget(a: DragTarget | null, b: DragTarget | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return (
    a.id_block === b.id_block &&
    a.bay === b.bay &&
    a.row_no === b.row_no &&
    a.tier === b.tier &&
    a.valid === b.valid &&
    a.reason === b.reason
  )
}

export const useUIStore = create<UIStore>((set, get) => {
  const persist = () => {
    const { showGrid, showAreas, showStats, viewMode, toolbarPos } = get()
    savePreferences({ showGrid, showAreas, showStats, viewMode, toolbarPos })
  }

  return {
    showGrid: true,
    showAreas: true,
    showStats: true,
    showPanel: true,
    viewMode: '3d',
    toolbarPos: null,
    selectedContainerNumber: null,
    isDragging: false,
    dragTarget: null,
    cameraPreset: 'perspective',
    flyTo: null,
    pulseNumber: null,
    pendingEnter: null,
    realtime: 'offline',

    toggleGrid: () => {
      set((s) => ({ showGrid: !s.showGrid }))
      persist()
    },
    toggleAreas: () => {
      set((s) => ({ showAreas: !s.showAreas }))
      persist()
    },
    toggleStats: () => {
      set((s) => ({ showStats: !s.showStats }))
      persist()
    },
    togglePanel: () => set((s) => ({ showPanel: !s.showPanel })),
    setViewMode: (viewMode) => {
      set({ viewMode })
      persist()
    },
    setToolbarPos: (toolbarPos) => {
      set({ toolbarPos })
      persist()
    },

    selectContainer: (containerNumber) => set({ selectedContainerNumber: containerNumber, showPanel: true }),
    toggleSelect: (containerNumber) =>
      set((s) => ({
        selectedContainerNumber: s.selectedContainerNumber === containerNumber ? null : containerNumber,
        showPanel: true,
      })),

    setDragging: (isDragging) => set({ isDragging }),
    setDragTarget: (target) => {
      if (!sameTarget(get().dragTarget, target)) set({ dragTarget: target })
    },

    setCameraPreset: (preset) => set({ cameraPreset: preset }),
    requestFlyTo: (x, y, z) => set({ flyTo: { x, y, z, nonce: Date.now() } }),
    setPulse: (containerNumber) => set({ pulseNumber: containerNumber }),

    setPendingEnter: (pending) => set({ pendingEnter: pending }),
    setRealtime: (status) => {
      if (get().realtime !== status) set({ realtime: status })
    },

    loadPreferences: () => {
      const prefs = loadStoredPreferences()
      if (!prefs) return
      set({
        showGrid: prefs.showGrid ?? true,
        showAreas: prefs.showAreas ?? true,
        showStats: prefs.showStats ?? true,
        viewMode: prefs.viewMode ?? '3d',
        toolbarPos: prefs.toolbarPos ?? null,
      })
    },
  }
})
