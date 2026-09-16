import { useCallback, useEffect, useRef, useState } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { useYardStore } from '../store/yardStore'
import { notify } from '../store/notificationStore'
import { baySpanOf, canPlace, findSlotAt } from '../utils/slotLayout'
import type { Container } from '../types'

/** Hold this long (ms) on a container to pick it up. A shorter touch is a tap = select. */
export const LONG_PRESS_MS = 300
/** Pointer movement (px) that cancels a pending long-press. */
const TAP_SLOP_PX = 10

const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const hitPoint = new THREE.Vector3()

interface PendingPress {
  container: Container
  x: number
  y: number
  timer: ReturnType<typeof setTimeout>
}

/**
 * Slot-based drag & drop: long-press a container to pick it up, drag over a block and
 * release on a valid slot. Validation mirrors the server (`canPlace`); the store performs
 * the optimistic move and the API call.
 */
export function useSlotDrag() {
  const pressRef = useRef<PendingPress | null>(null)
  const draggingRef = useRef<Container | null>(null)
  const [dragging, setDraggingState] = useState<Container | null>(null)

  const canWrite = useAuthStore((s) => s.canWrite)
  const { blocks, containers, moveContainer } = useYardStore()
  const { setDragging, setDragTarget, toggleSelect, selectContainer } = useUIStore()

  const clearPress = useCallback(() => {
    if (pressRef.current) {
      clearTimeout(pressRef.current.timer)
      pressRef.current = null
    }
  }, [])

  const setDragging_ = useCallback(
    (c: Container | null) => {
      draggingRef.current = c
      setDraggingState(c)
      setDragging(c !== null)
      if (!c) setDragTarget(null)
    },
    [setDragging, setDragTarget]
  )

  const onContainerPointerDown = useCallback(
    (container: Container, e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      if (!canWrite) {
        toggleSelect(container.container_number)
        return
      }
      clearPress()
      const timer = setTimeout(() => {
        pressRef.current = null
        selectContainer(container.container_number)
        setDragging_(container)
      }, LONG_PRESS_MS)
      pressRef.current = { container, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, timer }
    },
    [canWrite, clearPress, selectContainer, setDragging_, toggleSelect]
  )

  const onPointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      const press = pressRef.current
      if (press) {
        const dx = e.nativeEvent.clientX - press.x
        const dy = e.nativeEvent.clientY - press.y
        if (Math.hypot(dx, dy) > TAP_SLOP_PX) clearPress()
        return
      }
      const current = draggingRef.current
      if (!current) return

      if (!e.ray.intersectPlane(GROUND_PLANE, hitPoint)) {
        setDragTarget(null)
        return
      }
      const slot = findSlotAt(blocks, hitPoint.x, hitPoint.z, baySpanOf(current.container_type))
      if (!slot) {
        setDragTarget(null)
        return
      }
      const result = canPlace(current, slot, blocks, containers)
      setDragTarget({ ...slot, tier: result.tier, valid: result.ok, reason: result.reason })
    },
    [blocks, containers, clearPress, setDragTarget]
  )

  const finishDrag = useCallback(async () => {
    const current = draggingRef.current
    if (!current) return
    const target = useUIStore.getState().dragTarget
    setDragging_(null)
    if (!target) return
    if (!target.valid) {
      notify.warning(target.reason ?? 'Posizione non valida')
      return
    }
    await moveContainer(current.container_number, { id_block: target.id_block, bay: target.bay, row_no: target.row_no })
  }, [moveContainer, setDragging_])

  const onPointerUp = useCallback(() => {
    const press = pressRef.current
    if (press) {
      clearPress()
      toggleSelect(press.container.container_number)
      return
    }
    void finishDrag()
  }, [clearPress, finishDrag, toggleSelect])

  // Releasing outside the canvas must still end the drag.
  useEffect(() => {
    if (!dragging) return
    const end = () => void finishDrag()
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    return () => {
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
  }, [dragging, finishDrag])

  useEffect(() => () => clearPress(), [clearPress])

  return { dragging, onContainerPointerDown, onPointerMove, onPointerUp }
}
