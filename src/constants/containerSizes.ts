import type { ContainerType, ContainerDimensions } from '../types'

// ISO Standard container dimensions in meters
export const CONTAINER_DIMENSIONS: Record<ContainerType, ContainerDimensions> = {
  '20': {
    length: 6.1,
    width: 2.4,
    height: 2.6,
  },
  '40': {
    length: 12.2,
    width: 2.4,
    height: 2.6,
  },
  '40HC': {
    length: 12.2,
    width: 2.4,
    height: 2.9,
  },
  '45HC': {
    length: 13.7,
    width: 2.4,
    height: 2.9,
  },
}

export const CONTAINER_TYPE_LABELS: Record<ContainerType, string> = {
  '20': "20' Standard",
  '40': "40' Standard",
  '40HC': "40' High Cube",
  '45HC': "45' High Cube",
}

export const CONTAINER_STATUS_LABELS: Record<string, string> = {
  active: 'Attivo',
  damaged: 'Danneggiato',
  maintenance: 'In manutenzione',
}

export const CONTAINER_STATUS_COLORS: Record<string, string> = {
  active: '#22c55e',
  damaged: '#ef4444',
  maintenance: '#f59e0b',
}

export const DEFAULT_CONTAINER_COLORS = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#22c55e', // Green
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#84cc16', // Lime
]

export function getContainerDimensions(type: ContainerType): ContainerDimensions {
  return CONTAINER_DIMENSIONS[type]
}

export function getRotatedDimensions(
  type: ContainerType,
  rotation: number
): { length: number; width: number; height: number } {
  const dims = CONTAINER_DIMENSIONS[type]
  // For 90 or 270 degree rotation, swap length and width
  if (rotation === 90 || rotation === 270) {
    return {
      length: dims.width,
      width: dims.length,
      height: dims.height,
    }
  }
  return { ...dims }
}
