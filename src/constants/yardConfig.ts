export const GRID_COLOR = '#334155'
export const GRID_SECONDARY_COLOR = '#1e293b'
export const GROUND_COLOR = '#1e293b'
export const SELECTED_CONTAINER_COLOR = '#fbbf24'

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
