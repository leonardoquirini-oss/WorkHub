import { STORAGE_KEYS } from '../api/config'
import type { CameraPreset } from '../types'

interface YardPreferences {
  lastSiteId: number | null
  lastYardId: number | null
  cameraPreset: CameraPreset
  showGrid: boolean
  showAreas: boolean
  showStats: boolean
}

const DEFAULT_PREFERENCES: YardPreferences = {
  lastSiteId: null,
  lastYardId: null,
  cameraPreset: 'perspective',
  showGrid: true,
  showAreas: true,
  showStats: true,
}

export function saveYardPreferences(prefs: Partial<YardPreferences>): void {
  const current = loadYardPreferences()
  const updated = { ...current, ...prefs }

  if (prefs.lastSiteId !== undefined) {
    localStorage.setItem(STORAGE_KEYS.lastSite, String(prefs.lastSiteId))
  }
  if (prefs.lastYardId !== undefined) {
    localStorage.setItem(STORAGE_KEYS.lastYard, String(prefs.lastYardId))
  }
  localStorage.setItem(
    STORAGE_KEYS.uiPreferences,
    JSON.stringify({
      cameraPreset: updated.cameraPreset,
      showGrid: updated.showGrid,
      showAreas: updated.showAreas,
      showStats: updated.showStats,
    })
  )
}

export function loadYardPreferences(): YardPreferences {
  try {
    const lastSite = localStorage.getItem(STORAGE_KEYS.lastSite)
    const lastYard = localStorage.getItem(STORAGE_KEYS.lastYard)
    const uiPrefsJson = localStorage.getItem(STORAGE_KEYS.uiPreferences)

    const uiPrefs = uiPrefsJson ? JSON.parse(uiPrefsJson) : {}

    return {
      ...DEFAULT_PREFERENCES,
      lastSiteId: lastSite ? parseInt(lastSite, 10) : null,
      lastYardId: lastYard ? parseInt(lastYard, 10) : null,
      ...uiPrefs,
    }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

export function clearYardPreferences(): void {
  localStorage.removeItem(STORAGE_KEYS.lastSite)
  localStorage.removeItem(STORAGE_KEYS.lastYard)
  localStorage.removeItem(STORAGE_KEYS.uiPreferences)
}
