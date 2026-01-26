import { useRef, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsType } from 'three-stdlib'
import { useUIStore } from '../../store/uiStore'
import { CAMERA_PRESETS } from '../../constants/yardConfig'

interface ControlsProps {
  yardWidth: number
  yardLength: number
}

export function Controls({ yardWidth, yardLength }: ControlsProps) {
  const controlsRef = useRef<OrbitControlsType>(null)
  const { camera } = useThree()
  const { cameraPreset, isDragging } = useUIStore()

  // Apply camera preset
  useEffect(() => {
    if (!controlsRef.current) return

    const preset = CAMERA_PRESETS[cameraPreset]

    // Adjust preset based on yard size
    const scaleX = yardWidth / 100
    const scaleZ = yardLength / 50
    const scale = Math.max(scaleX, scaleZ)

    const position = preset.position.map((v, i) => {
      if (i === 0) return v * scaleX // X
      if (i === 2) return v * scaleZ // Z
      return v * scale // Y
    }) as [number, number, number]

    const target = [
      (preset.target[0] / 100) * yardWidth,
      preset.target[1],
      (preset.target[2] / 50) * yardLength,
    ] as [number, number, number]

    // Animate to new position
    const startPos = camera.position.clone()
    const startTarget = controlsRef.current.target.clone()
    const endPos = { x: position[0], y: position[1], z: position[2] }
    const endTarget = { x: target[0], y: target[1], z: target[2] }

    let progress = 0
    const duration = 500 // ms
    const startTime = Date.now()

    const animate = () => {
      progress = Math.min((Date.now() - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // Ease out cubic

      camera.position.x = startPos.x + (endPos.x - startPos.x) * eased
      camera.position.y = startPos.y + (endPos.y - startPos.y) * eased
      camera.position.z = startPos.z + (endPos.z - startPos.z) * eased

      if (controlsRef.current) {
        controlsRef.current.target.x = startTarget.x + (endTarget.x - startTarget.x) * eased
        controlsRef.current.target.y = startTarget.y + (endTarget.y - startTarget.y) * eased
        controlsRef.current.target.z = startTarget.z + (endTarget.z - startTarget.z) * eased
        controlsRef.current.update()
      }

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    animate()
  }, [cameraPreset, camera, yardWidth, yardLength])

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.1}
      minDistance={10}
      maxDistance={200}
      maxPolarAngle={Math.PI / 2 - 0.05} // Prevent going below ground
      minPolarAngle={0.1}
      enabled={!isDragging}
      // Touch settings for tablet
      touches={{
        ONE: 0, // ROTATE
        TWO: 2, // DOLLY_PAN
      }}
    />
  )
}
