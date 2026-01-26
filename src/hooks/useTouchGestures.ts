import { useRef, useCallback } from 'react'

interface TouchState {
  startTime: number
  startX: number
  startY: number
  isTap: boolean
  isLongPress: boolean
}

const LONG_PRESS_DURATION = 500 // ms
const TAP_THRESHOLD = 10 // pixels

export function useTouchGestures(
  onTap?: () => void,
  onLongPress?: () => void,
  onDragStart?: (x: number, y: number) => void,
  onDrag?: (x: number, y: number, deltaX: number, deltaY: number) => void,
  onDragEnd?: () => void
) {
  const touchState = useRef<TouchState | null>(null)
  const longPressTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0]
      touchState.current = {
        startTime: Date.now(),
        startX: touch.clientX,
        startY: touch.clientY,
        isTap: true,
        isLongPress: false,
      }

      // Set up long press detection
      if (onLongPress) {
        longPressTimeout.current = setTimeout(() => {
          if (touchState.current?.isTap) {
            touchState.current.isLongPress = true
            onLongPress()
          }
        }, LONG_PRESS_DURATION)
      }
    },
    [onLongPress]
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!touchState.current) return

      const touch = e.touches[0]
      const deltaX = touch.clientX - touchState.current.startX
      const deltaY = touch.clientY - touchState.current.startY
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

      // If moved beyond threshold, it's no longer a tap
      if (distance > TAP_THRESHOLD) {
        touchState.current.isTap = false

        // Cancel long press
        if (longPressTimeout.current) {
          clearTimeout(longPressTimeout.current)
          longPressTimeout.current = null
        }

        // Start drag if first significant movement
        if (!touchState.current.isLongPress && onDragStart) {
          onDragStart(touch.clientX, touch.clientY)
        }

        // Continue drag
        if (onDrag) {
          onDrag(touch.clientX, touch.clientY, deltaX, deltaY)
        }
      }
    },
    [onDragStart, onDrag]
  )

  const handleTouchEnd = useCallback(() => {
    // Clear long press timeout
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current)
      longPressTimeout.current = null
    }

    if (touchState.current) {
      // Check if it was a tap
      if (touchState.current.isTap && !touchState.current.isLongPress && onTap) {
        onTap()
      }

      // End drag if was dragging
      if (!touchState.current.isTap && onDragEnd) {
        onDragEnd()
      }
    }

    touchState.current = null
  }, [onTap, onDragEnd])

  return {
    touchHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchEnd,
    },
  }
}
