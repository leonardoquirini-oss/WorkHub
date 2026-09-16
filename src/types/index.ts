export * from './auth'
export * from './container'
export * from './yard'

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

export type CameraPreset = 'perspective' | 'top' | 'front' | 'side'

export type ViewMode = '3d' | '2d' | 'list'

export type RealtimeStatus = 'connecting' | 'sse' | 'polling' | 'offline'

export interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  duration?: number
}
