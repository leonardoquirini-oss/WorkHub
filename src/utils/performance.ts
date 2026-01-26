// Adaptive quality settings based on device capabilities

export interface QualitySettings {
  shadowMapSize: number
  antialias: boolean
  pixelRatio: number
  maxContainersHighDetail: number
}

export function getQualitySettings(): QualitySettings {
  // Check for touch device (likely mobile/tablet)
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0

  // Check for WebGL capabilities
  const canvas = document.createElement('canvas')
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')

  let isLowEnd = false

  if (gl) {
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    if (debugInfo) {
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
      // Check for known low-end GPUs
      isLowEnd = /intel|mali|adreno 3|powervr/i.test(renderer)
    }
  }

  // Determine device pixel ratio (cap at 2 for performance)
  const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2)

  if (isLowEnd || isTouchDevice) {
    return {
      shadowMapSize: 1024,
      antialias: false,
      pixelRatio: Math.min(devicePixelRatio, 1.5),
      maxContainersHighDetail: 50,
    }
  }

  return {
    shadowMapSize: 2048,
    antialias: true,
    pixelRatio: devicePixelRatio,
    maxContainersHighDetail: 200,
  }
}

// Throttle function for performance-sensitive operations
export function throttle<T extends (...args: Parameters<T>) => ReturnType<T>>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false

  return function (this: unknown, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => {
        inThrottle = false
      }, limit)
    }
  }
}

// Debounce function for delayed operations
export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null

  return function (this: unknown, ...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => {
      func.apply(this, args)
    }, wait)
  }
}
