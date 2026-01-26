import { create } from 'zustand'
import { STORAGE_KEYS } from '../api/config'
import type { CameraPreset } from '../types'

interface UIPreferences {
  showGrid: boolean
  showAreas: boolean
  showStats: boolean
}

interface UIStore {
  // Display preferences
  showGrid: boolean
  showAreas: boolean
  showStats: boolean
  showPanel: boolean

  // Selection state
  selectedContainerNumber: string | null

  // Drag state
  isDragging: boolean
  dragPreviewPosition: { x: number; y: number; z: number } | null
  dragValid: boolean

  // Camera state
  cameraPreset: CameraPreset

  // Actions
  toggleGrid: () => void
  toggleAreas: () => void
  toggleStats: () => void
  togglePanel: () => void
  selectContainer: (containerNumber: string | null) => void
  setDragging: (isDragging: boolean) => void
  setDragPreview: (position: { x: number; y: number; z: number } | null, valid: boolean) => void
  setCameraPreset: (preset: CameraPreset) => void
  loadPreferences: () => void
}

function savePreferences(prefs: UIPreferences) {
  localStorage.setItem(STORAGE_KEYS.uiPreferences, JSON.stringify(prefs))
}

function loadStoredPreferences(): UIPreferences | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.uiPreferences)
    if (stored) {
      return JSON.parse(stored) as UIPreferences
    }
  } catch {
    // Ignore parse errors
  }
  return null
}

export const useUIStore = create<UIStore>((set, get) => ({
  // Default values
  showGrid: true,
  showAreas: true,
  showStats: true,
  showPanel: true,
  selectedContainerNumber: null,
  isDragging: false,
  dragPreviewPosition: null,
  dragValid: false,
  cameraPreset: 'perspective',

  toggleGrid: () => {
    const newValue = !get().showGrid
    set({ showGrid: newValue })
    savePreferences({
      showGrid: newValue,
      showAreas: get().showAreas,
      showStats: get().showStats,
    })
  },

  toggleAreas: () => {
    const newValue = !get().showAreas
    set({ showAreas: newValue })
    savePreferences({
      showGrid: get().showGrid,
      showAreas: newValue,
      showStats: get().showStats,
    })
  },

  toggleStats: () => {
    const newValue = !get().showStats
    set({ showStats: newValue })
    savePreferences({
      showGrid: get().showGrid,
      showAreas: get().showAreas,
      showStats: newValue,
    })
  },

  togglePanel: () => set((state) => ({ showPanel: !state.showPanel })),

  selectContainer: (containerNumber) => set({ selectedContainerNumber: containerNumber }),

  setDragging: (isDragging) => set({ isDragging }),

  setDragPreview: (position, valid) =>
    set({
      dragPreviewPosition: position,
      dragValid: valid,
    }),

  setCameraPreset: (preset) => set({ cameraPreset: preset }),

  loadPreferences: () => {
    const prefs = loadStoredPreferences()
    if (prefs) {
      set({
        showGrid: prefs.showGrid,
        showAreas: prefs.showAreas,
        showStats: prefs.showStats,
      })
    }
  },
}))
