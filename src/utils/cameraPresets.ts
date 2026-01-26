import type { CameraPreset } from '../types'

export interface CameraConfig {
  position: [number, number, number]
  target: [number, number, number]
  fov?: number
}

export const CAMERA_CONFIGS: Record<CameraPreset, CameraConfig> = {
  perspective: {
    position: [60, 40, 60],
    target: [25, 0, 25],
    fov: 50,
  },
  top: {
    position: [50, 80, 50],
    target: [50, 0, 25],
    fov: 60,
  },
  front: {
    position: [50, 20, 80],
    target: [50, 0, 25],
    fov: 50,
  },
  side: {
    position: [120, 20, 25],
    target: [50, 0, 25],
    fov: 50,
  },
}

export function getScaledCameraConfig(
  preset: CameraPreset,
  yardWidth: number,
  yardLength: number
): CameraConfig {
  const config = CAMERA_CONFIGS[preset]
  const scaleX = yardWidth / 100
  const scaleZ = yardLength / 50
  const scale = Math.max(scaleX, scaleZ)

  return {
    position: [
      config.position[0] * scaleX,
      config.position[1] * scale,
      config.position[2] * scaleZ,
    ],
    target: [
      (config.target[0] / 100) * yardWidth,
      config.target[1],
      (config.target[2] / 50) * yardLength,
    ],
    fov: config.fov,
  }
}

export function calculateFitToContainersCamera(
  containers: { position_x: number; position_y: number }[],
  yardWidth: number,
  yardLength: number
): CameraConfig {
  if (containers.length === 0) {
    return getScaledCameraConfig('perspective', yardWidth, yardLength)
  }

  // Calculate bounding box of all containers
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const c of containers) {
    minX = Math.min(minX, c.position_x)
    maxX = Math.max(maxX, c.position_x + 12) // Assume max container length
    minY = Math.min(minY, c.position_y)
    maxY = Math.max(maxY, c.position_y + 3) // Assume max container width
  }

  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const width = maxX - minX
  const length = maxY - minY
  const diagonal = Math.sqrt(width * width + length * length)

  return {
    position: [
      centerX + diagonal * 0.8,
      diagonal * 0.6,
      centerY + diagonal * 0.8,
    ],
    target: [centerX, 0, centerY],
    fov: 50,
  }
}
