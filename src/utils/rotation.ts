import type { Rotation } from '../types'

const ROTATIONS: Rotation[] = [0, 90, 180, 270]

export function rotateClockwise(current: Rotation): Rotation {
  const index = ROTATIONS.indexOf(current)
  return ROTATIONS[(index + 1) % 4]
}

export function rotateCounterClockwise(current: Rotation): Rotation {
  const index = ROTATIONS.indexOf(current)
  return ROTATIONS[(index - 1 + 4) % 4]
}

export function normalizeRotation(degrees: number): Rotation {
  const normalized = ((degrees % 360) + 360) % 360
  const closest = ROTATIONS.reduce((prev, curr) =>
    Math.abs(curr - normalized) < Math.abs(prev - normalized) ? curr : prev
  )
  return closest
}
