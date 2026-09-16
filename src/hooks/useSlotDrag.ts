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
/** Movement (px) above which the gesture is a camera orbit, not a tap on the container. */
const ORBIT_SLOP_PX = 14

const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const hitPoint = new THREE.Vector3()

interface PendingPress {
  container: Container
  x: number
  y: number
  /** Largest distance (px) travelled since pointerdown. */
  travel: number
  timer: ReturnType<typeof setTimeout> | null
}

/**
 * Slot-based drag & drop: long-press a container to pick it up, drag over a block and
 * release on a valid slot. Validation mirrors the server (`canPlace`); the store performs
 * the optimistic move and the API call.
 *
 * A short press that never becomes a drag is a tap: it selects the container (and opens the
 * details panel). The press is kept until pointerup even when the long-press timer is
 * cancelled by a small movement, so an imprecise click still selects.
 */
export function useSlotDrag() {
  const pressRef = useRef<PendingPress | null>(null)
  const draggingRef = useRef<Container | null>(null)
  const [dragging, setDraggingState] = useState<Container | null>(null)

  const canWrite = useAuthStore((s) => s.canWrite)
  const { blocks, containers, moveContainer } = useYardStore()
  const { setDragging, setDragTarget, selectContainer } = useUIStore()

  const clearPress = useCallback(() => {
    const press = pressRef.current
    if (press?.timer) clearTimeout(press.timer)
    pressRef.current = null
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
      clearPress()
      const timer = canWrite
        ? setTimeout(() => {
            if (pressRef.current) pressRef.current.timer = null
            selectContainer(container.container_number)
            setDragging_(container)
            pressRef.current = null
          }, LONG_PRESS_MS)
        : null
      pressRef.current = { container, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, travel: 0, timer }
    },
    [canWrite, clearPress, selectContainer, setDragging_]
  )

  const onPointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      const press = pressRef.current
      if (press) {
        press.travel = Math.max(press.travel, Math.hypot(e.nativeEvent.clientX - press.x, e.nativeEvent.clientY - press.y))
        // Too much movement: this is an orbit, cancel the pick-up but keep the press for the tap check
        if (press.travel > TAP_SLOP_PX && press.timer) {
          clearTimeout(press.timer)
          press.timer = null
        }
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
    [blocks, containers, setDragTarget]
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

  /**
   * Ends the gesture. Bound to both the ground plane and the containers, because the pointer
   * can be released over either; whichever fires first consumes the pending press.
   */
  const onPointerUp = useCallback(() => {
    const press = pressRef.current
    if (press) {
      clearPress()
      // While placing a container the tap chooses the slot: it must not steal the selection.
      const placing = useUIStore.getState().pendingEnter !== null
      if (!placing && press.travel <= ORBIT_SLOP_PX) selectContainer(press.container.container_number)
      return
    }
    void finishDrag()
  }, [clearPress, finishDrag, selectContainer])

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

  // A press that never reaches pointerup on the canvas (e.g. released outside) must not leak.
  useEffect(() => {
    const cancel = () => {
      const press = pressRef.current
      if (!press) return
      clearPress()
      const placing = useUIStore.getState().pendingEnter !== null
      if (!placing && press.travel <= ORBIT_SLOP_PX) selectContainer(press.container.container_number)
    }
    window.addEventListener('pointerup', cancel)
    window.addEventListener('pointercancel', cancel)
    return () => {
      window.removeEventListener('pointerup', cancel)
      window.removeEventListener('pointercancel', cancel)
    }
  }, [clearPress, selectContainer])

  useEffect(() => () => clearPress(), [clearPress])

  return { dragging, onContainerPointerDown, onPointerMove, onPointerUp }
}
