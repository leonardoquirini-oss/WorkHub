import type { Container, ContainerType, Rotation } from '../types'
import { getRotatedDimensions } from '../constants/containerSizes'

interface BoundingBox {
  minX: number
  maxX: number
  minY: number
  maxY: number
  minZ: number
  maxZ: number
}

export function getContainerBoundingBox(
  posX: number,
  posY: number,
  posZ: number,
  containerType: ContainerType,
  rotation: Rotation
): BoundingBox {
  const dims = getRotatedDimensions(containerType, rotation)

  return {
    minX: posX,
    maxX: posX + dims.length,
    minY: posY,
    maxY: posY + dims.width,
    minZ: posZ,
    maxZ: posZ + dims.height,
  }
}

export function boxesIntersect(a: BoundingBox, b: BoundingBox, tolerance = 0.01): boolean {
  // Add small tolerance to avoid floating point issues
  return (
    a.minX < b.maxX - tolerance &&
    a.maxX > b.minX + tolerance &&
    a.minY < b.maxY - tolerance &&
    a.maxY > b.minY + tolerance &&
    a.minZ < b.maxZ - tolerance &&
    a.maxZ > b.minZ + tolerance
  )
}

export function checkCollision(
  container: { posX: number; posY: number; posZ: number; type: ContainerType; rotation: Rotation },
  otherContainers: Container[],
  excludeNumber?: string
): boolean {
  const newBox = getContainerBoundingBox(
    container.posX,
    container.posY,
    container.posZ,
    container.type,
    container.rotation
  )

  for (const other of otherContainers) {
    if (excludeNumber && other.container_number === excludeNumber) continue

    const otherBox = getContainerBoundingBox(
      other.position_x,
      other.position_y,
      other.position_z,
      other.container_type,
      other.rotation
    )

    if (boxesIntersect(newBox, otherBox)) {
      return true
    }
  }

  return false
}

export function isWithinYardBounds(
  posX: number,
  posY: number,
  containerType: ContainerType,
  rotation: Rotation,
  yardWidth: number,
  yardLength: number
): boolean {
  const dims = getRotatedDimensions(containerType, rotation)

  return (
    posX >= 0 &&
    posY >= 0 &&
    posX + dims.length <= yardWidth &&
    posY + dims.width <= yardLength
  )
}
