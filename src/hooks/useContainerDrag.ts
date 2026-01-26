import { useState, useCallback, useRef } from 'react'
import { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { useUIStore } from '../store/uiStore'
import { useYardStore } from '../store/yardStore'
import { notify } from '../store/notificationStore'
import { checkCollision, isWithinYardBounds } from '../utils/collisionDetection'
import { checkStackingSupport, findValidStackPosition, snapToGrid } from '../utils/stackingLogic'
import type { Container } from '../types'

export function useContainerDrag() {
  const [draggingContainer, setDraggingContainer] = useState<Container | null>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)

  const { setDragging, setDragPreview, selectContainer } = useUIStore()
  const { yards, selectedYardId, containers, updateContainer, getContainer } = useYardStore()

  const yard = yards.find((y) => y.id_yard === selectedYardId)

  const handleDragStart = useCallback(
    (container: Container, e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()

      setDraggingContainer(container)
      setDragging(true)
      selectContainer(container.container_number)

      // Store initial position for potential cancel
      dragStartRef.current = { x: container.position_x, y: container.position_y }
    },
    [setDragging, selectContainer]
  )

  const handleDragMove = useCallback(
    (e: ThreeEvent<PointerEvent>, groundPlane: THREE.Mesh | null) => {
      if (!draggingContainer || !yard || !groundPlane) return

      // Raycast to ground plane
      const raycaster = new THREE.Raycaster()
      const pointer = new THREE.Vector2(
        (e.nativeEvent.offsetX / e.nativeEvent.target.clientWidth) * 2 - 1,
        -(e.nativeEvent.offsetY / e.nativeEvent.target.clientHeight) * 2 + 1
      )

      raycaster.setFromCamera(pointer, e.camera)
      const intersects = raycaster.intersectObject(groundPlane)

      if (intersects.length === 0) return

      const point = intersects[0].point

      // Snap to grid
      const snappedX = snapToGrid(point.x, yard.grid_cell_size)
      const snappedY = snapToGrid(point.z, yard.grid_cell_size)

      // Find valid Z position (stacking)
      const validZ = findValidStackPosition(
        snappedX,
        snappedY,
        draggingContainer.container_type,
        draggingContainer.rotation,
        containers,
        yard.max_stack_height
      )

      // Check validity
      let isValid = validZ >= 0

      if (isValid) {
        // Check within bounds
        isValid = isWithinYardBounds(
          snappedX,
          snappedY,
          draggingContainer.container_type,
          draggingContainer.rotation,
          yard.width,
          yard.length
        )
      }

      if (isValid) {
        // Check collisions
        const hasCollision = checkCollision(
          {
            posX: snappedX,
            posY: snappedY,
            posZ: validZ,
            type: draggingContainer.container_type,
            rotation: draggingContainer.rotation,
          },
          containers,
          draggingContainer.container_number
        )
        isValid = !hasCollision
      }

      if (isValid && validZ > 0) {
        // Check stacking support
        const support = checkStackingSupport(
          snappedX,
          snappedY,
          validZ,
          draggingContainer.container_type,
          draggingContainer.rotation,
          containers,
          draggingContainer.container_number
        )
        isValid = support.isSupported
      }

      setDragPreview({ x: snappedX, y: snappedY, z: Math.max(0, validZ) }, isValid)
    },
    [draggingContainer, yard, containers, setDragPreview]
  )

  const handleDragEnd = useCallback(async () => {
    const { dragPreviewPosition, dragValid } = useUIStore.getState()

    console.log('[DEBUG] handleDragEnd - container:', draggingContainer?.container_number)
    console.log('[DEBUG] handleDragEnd - dragPreviewPosition:', dragPreviewPosition)
    console.log('[DEBUG] handleDragEnd - dragValid:', dragValid)

    if (!draggingContainer || !dragPreviewPosition) {
      console.log('[DEBUG] handleDragEnd - Early return: no container or preview')
      setDragging(false)
      setDragPreview(null, false)
      setDraggingContainer(null)
      return
    }

    if (dragValid) {
      // Check if position actually changed
      const posChanged =
        Math.abs(dragPreviewPosition.x - draggingContainer.position_x) > 0.1 ||
        Math.abs(dragPreviewPosition.y - draggingContainer.position_y) > 0.1 ||
        Math.abs(dragPreviewPosition.z - draggingContainer.position_z) > 0.1

      console.log('[DEBUG] handleDragEnd - posChanged:', posChanged, {
        old: { x: draggingContainer.position_x, y: draggingContainer.position_y, z: draggingContainer.position_z },
        new: dragPreviewPosition,
      })

      if (posChanged) {
        try {
          console.log('[DEBUG] handleDragEnd - Calling updateContainer with id_yard:', selectedYardId)
          await updateContainer(draggingContainer.container_number, {
            id_yard: selectedYardId,
            position_x: dragPreviewPosition.x,
            position_y: dragPreviewPosition.y,
            position_z: dragPreviewPosition.z,
          })
          console.log('[DEBUG] handleDragEnd - updateContainer SUCCESS')
          notify.success('Posizione container aggiornata')
        } catch (err) {
          console.error('[DEBUG] handleDragEnd - updateContainer ERROR:', err)
          notify.error(
            err instanceof Error ? err.message : 'Errore aggiornamento posizione'
          )
        }
      }
    } else {
      notify.warning('Posizione non valida')
    }

    setDragging(false)
    setDragPreview(null, false)
    setDraggingContainer(null)
  }, [draggingContainer, setDragging, setDragPreview, updateContainer])

  return {
    draggingContainer,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
  }
}
