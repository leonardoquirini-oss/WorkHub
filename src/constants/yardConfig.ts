import type { AreaType } from '../types'

export const DEFAULT_YARD_CONFIG = {
  width: 100, // meters
  length: 50, // meters
  maxStackHeight: 6,
  gridCellSize: 2.4, // meters (standard container width)
}

export const MAX_STACK_HEIGHT = 6

export const AREA_TYPE_LABELS: Record<AreaType, string> = {
  import: 'Import',
  export: 'Export',
  storage: 'Stoccaggio',
  maintenance: 'Manutenzione',
}

export const AREA_TYPE_COLORS: Record<AreaType, string> = {
  import: '#3b82f6', // Blue
  export: '#22c55e', // Green
  storage: '#f59e0b', // Amber
  maintenance: '#ef4444', // Red
}

export const GRID_COLOR = '#334155'
export const GRID_SECONDARY_COLOR = '#1e293b'
export const GROUND_COLOR = '#1e293b'
export const SELECTED_CONTAINER_COLOR = '#fbbf24'
export const DRAG_VALID_COLOR = '#22c55e'
export const DRAG_INVALID_COLOR = '#ef4444'

export const CAMERA_PRESETS = {
  perspective: {
    position: [60, 40, 60] as [number, number, number],
    target: [25, 0, 25] as [number, number, number],
  },
  top: {
    position: [50, 80, 50] as [number, number, number],
    target: [50, 0, 25] as [number, number, number],
  },
  front: {
    position: [50, 20, 80] as [number, number, number],
    target: [50, 0, 25] as [number, number, number],
  },
  side: {
    position: [120, 20, 25] as [number, number, number],
    target: [50, 0, 25] as [number, number, number],
  },
}
