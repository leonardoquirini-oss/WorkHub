import type { Container, ContainerType, Rotation } from '../types'
import { getRotatedDimensions, CONTAINER_DIMENSIONS } from '../constants/containerSizes'
import { getContainerBoundingBox } from './collisionDetection'

interface SupportResult {
  isSupported: boolean
  supportPercentage: number
  supportingContainers: string[]
}

export function checkStackingSupport(
  posX: number,
  posY: number,
  posZ: number,
  containerType: ContainerType,
  rotation: Rotation,
  containers: Container[],
  excludeNumber?: string
): SupportResult {
  // If on ground level, always supported
  if (posZ <= 0.01) {
    return { isSupported: true, supportPercentage: 100, supportingContainers: [] }
  }

  const dims = getRotatedDimensions(containerType, rotation)
  const containerArea = dims.length * dims.width

  // Find containers directly below this position
  const containersBelowLevel = containers.filter((c) => {
    if (excludeNumber && c.container_number === excludeNumber) return false
    const cDims = getRotatedDimensions(c.container_type, c.rotation)
    const cTopZ = c.position_z + cDims.height
    // Container is directly below if its top is at our bottom
    return Math.abs(cTopZ - posZ) < 0.1
  })

  if (containersBelowLevel.length === 0) {
    return { isSupported: false, supportPercentage: 0, supportingContainers: [] }
  }

  // Calculate overlap area with containers below
  let totalSupportArea = 0
  const supportingContainers: string[] = []

  for (const below of containersBelowLevel) {
    const belowDims = getRotatedDimensions(below.container_type, below.rotation)

    // Calculate 2D overlap (X-Y plane)
    const overlapMinX = Math.max(posX, below.position_x)
    const overlapMaxX = Math.min(posX + dims.length, below.position_x + belowDims.length)
    const overlapMinY = Math.max(posY, below.position_y)
    const overlapMaxY = Math.min(posY + dims.width, below.position_y + belowDims.width)

    if (overlapMaxX > overlapMinX && overlapMaxY > overlapMinY) {
      const overlapArea = (overlapMaxX - overlapMinX) * (overlapMaxY - overlapMinY)
      totalSupportArea += overlapArea
      supportingContainers.push(below.container_number)
    }
  }

  const supportPercentage = (totalSupportArea / containerArea) * 100

  return {
    isSupported: supportPercentage >= 50, // Minimum 50% support required
    supportPercentage,
    supportingContainers,
  }
}

export function findValidStackPosition(
  posX: number,
  posY: number,
  containerType: ContainerType,
  rotation: Rotation,
  containers: Container[],
  maxStackHeight: number
): number {
  const dims = getRotatedDimensions(containerType, rotation)

  // Find the highest container at this X-Y position
  let maxZ = 0

  for (const c of containers) {
    const cDims = getRotatedDimensions(c.container_type, c.rotation)

    // Check if containers overlap in X-Y plane
    const overlapX = posX < c.position_x + cDims.length && posX + dims.length > c.position_x
    const overlapY = posY < c.position_y + cDims.width && posY + dims.width > c.position_y

    if (overlapX && overlapY) {
      const topZ = c.position_z + cDims.height
      if (topZ > maxZ) {
        maxZ = topZ
      }
    }
  }

  // Check if we exceed max stack height
  const maxHeight = CONTAINER_DIMENSIONS[containerType].height
  const totalTiers = Math.ceil((maxZ + maxHeight) / maxHeight)

  if (totalTiers > maxStackHeight) {
    return -1 // Invalid - exceeds max stack
  }

  return maxZ
}

export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize
}

export function calculateTier(posZ: number, containerType: ContainerType): number {
  const height = CONTAINER_DIMENSIONS[containerType].height
  return Math.round(posZ / height)
}
