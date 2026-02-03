import type { Container } from '../types'
import { getRotatedDimensions } from '../constants/containerSizes'
import { checkStackingSupport } from './stackingLogic'

export interface ContainerUpdate {
  containerNumber: string
  newZ: number
}

/**
 * Calculates all container position updates needed after removing a container.
 * Containers that lose support will "fall" to the next valid Z position.
 * This handles cascading falls (container A falls, causing container B to fall, etc.)
 */
export function calculateGravityCascade(
  removedContainerNumber: string,
  allContainers: Container[]
): ContainerUpdate[] {
  console.log('[Gravity] Calculating cascade for removal of:', removedContainerNumber)
  console.log('[Gravity] All containers:', allContainers.map(c => ({
    num: c.container_number,
    x: c.position_x,
    y: c.position_y,
    z: c.position_z
  })))

  // Work with a mutable copy, excluding the removed container
  const remainingContainers = allContainers
    .filter((c) => c.container_number !== removedContainerNumber)
    .map((c) => ({ ...c })) // Deep copy

  console.log('[Gravity] Remaining containers after removal:', remainingContainers.length)

  const updates: ContainerUpdate[] = []
  let hasChanges = true

  // Keep iterating until no more containers need to fall
  while (hasChanges) {
    hasChanges = false

    // Sort by Z ascending - process lower containers first
    remainingContainers.sort((a, b) => a.position_z - b.position_z)

    for (const container of remainingContainers) {
      // Skip ground-level containers
      if (container.position_z <= 0.01) {
        continue
      }

      console.log('[Gravity] Checking support for:', container.container_number, 'at Z:', container.position_z)

      // Check if this container still has support
      const support = checkStackingSupport(
        container.position_x,
        container.position_y,
        container.position_z,
        container.container_type,
        container.rotation,
        remainingContainers,
        container.container_number
      )

      console.log('[Gravity] Support result:', support)

      if (!support.isSupported) {
        // Container needs to fall - find the new valid Z position
        const newZ = findFallPosition(container, remainingContainers)
        console.log('[Gravity] Container needs to fall from', container.position_z, 'to', newZ)

        if (newZ !== container.position_z) {
          // Record this update
          const existingUpdate = updates.find(
            (u) => u.containerNumber === container.container_number
          )
          if (existingUpdate) {
            existingUpdate.newZ = newZ
          } else {
            updates.push({
              containerNumber: container.container_number,
              newZ,
            })
          }

          // Update the container in our working copy
          container.position_z = newZ
          hasChanges = true
        }
      }
    }
  }

  console.log('[Gravity] Final updates:', updates)
  return updates
}

/**
 * Finds the Z position where a falling container should land.
 * This is either ground level (0) or on top of another container.
 */
function findFallPosition(
  container: Container,
  allContainers: Container[]
): number {
  const dims = getRotatedDimensions(container.container_type, container.rotation)

  // Find the highest container top that is below our current position
  // and overlaps with us in X-Y plane
  let highestTopBelow = 0

  for (const c of allContainers) {
    if (c.container_number === container.container_number) {
      continue
    }

    const cDims = getRotatedDimensions(c.container_type, c.rotation)
    const cTopZ = c.position_z + cDims.height

    // Skip containers that are at or above our current position
    if (cTopZ >= container.position_z) {
      continue
    }

    // Check for X-Y overlap
    const overlapX =
      container.position_x < c.position_x + cDims.length &&
      container.position_x + dims.length > c.position_x
    const overlapY =
      container.position_y < c.position_y + cDims.width &&
      container.position_y + dims.width > c.position_y

    if (overlapX && overlapY) {
      // This container is below us and overlaps - it could support us
      if (cTopZ > highestTopBelow) {
        highestTopBelow = cTopZ
      }
    }
  }

  return highestTopBelow
}

/**
 * Checks if removing a container would cause any other containers to fall.
 * Useful for showing warnings before deletion.
 */
export function wouldCauseCascade(
  containerNumber: string,
  allContainers: Container[]
): { wouldFall: boolean; affectedCount: number; affectedContainers: string[] } {
  const updates = calculateGravityCascade(containerNumber, allContainers)
  return {
    wouldFall: updates.length > 0,
    affectedCount: updates.length,
    affectedContainers: updates.map((u) => u.containerNumber),
  }
}

/**
 * Calculates gravity cascade after a container has been moved to a new position.
 * This simulates the container being in its new position and checks which
 * containers lost support and need to fall.
 */
export function calculateGravityAfterMove(
  movedContainerNumber: string,
  newPosition: { x: number; y: number; z: number },
  allContainers: Container[]
): ContainerUpdate[] {
  console.log('[Gravity] Calculating gravity after move of:', movedContainerNumber)
  console.log('[Gravity] New position:', newPosition)

  // Create a copy of containers with the moved container at its new position
  const simulatedContainers = allContainers.map((c) => {
    if (c.container_number === movedContainerNumber) {
      return {
        ...c,
        position_x: newPosition.x,
        position_y: newPosition.y,
        position_z: newPosition.z,
      }
    }
    return { ...c }
  })

  const updates: ContainerUpdate[] = []
  let hasChanges = true

  // Keep iterating until no more containers need to fall
  while (hasChanges) {
    hasChanges = false

    // Sort by Z ascending - process lower containers first
    simulatedContainers.sort((a, b) => a.position_z - b.position_z)

    for (const container of simulatedContainers) {
      // Skip the moved container itself and ground-level containers
      if (container.container_number === movedContainerNumber) continue
      if (container.position_z <= 0.01) continue

      // Check if this container still has support
      const support = checkStackingSupport(
        container.position_x,
        container.position_y,
        container.position_z,
        container.container_type,
        container.rotation,
        simulatedContainers,
        container.container_number
      )

      if (!support.isSupported) {
        // Container needs to fall - find the new valid Z position
        const newZ = findFallPosition(container, simulatedContainers)
        console.log('[Gravity] Container', container.container_number, 'needs to fall from', container.position_z, 'to', newZ)

        if (newZ !== container.position_z) {
          // Record this update
          const existingUpdate = updates.find(
            (u) => u.containerNumber === container.container_number
          )
          if (existingUpdate) {
            existingUpdate.newZ = newZ
          } else {
            updates.push({
              containerNumber: container.container_number,
              newZ,
            })
          }

          // Update the container in our simulated copy
          container.position_z = newZ
          hasChanges = true
        }
      }
    }
  }

  console.log('[Gravity] Updates after move:', updates)
  return updates
}
