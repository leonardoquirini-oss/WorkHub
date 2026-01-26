export * from './auth'
export * from './container'
export * from './yard'

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

export interface ApiError {
  success: false
  message: string
}

export type CameraPreset = 'perspective' | 'top' | 'front' | 'side'

export interface CameraState {
  position: [number, number, number]
  target: [number, number, number]
  preset: CameraPreset
}

export interface UIState {
  showGrid: boolean
  showAreas: boolean
  showStats: boolean
  showPanel: boolean
  selectedContainerNumber: string | null
  isDragging: boolean
  dragPreviewPosition: { x: number; y: number; z: number } | null
  dragValid: boolean
}

export interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  duration?: number
}
