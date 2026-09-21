import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsType } from 'three-stdlib'
import * as THREE from 'three'
import { useUIStore } from '../../store/uiStore'
import { CAMERA_PRESETS } from '../../constants/yardConfig'

interface ControlsProps {
  yardWidth: number
  yardLength: number
}

type Vec3 = { x: number; y: number; z: number }

/** Eases camera position and orbit target to the destination (500 ms, ease-out cubic). */
function animateCamera(camera: THREE.Camera, controls: OrbitControlsType, endPos: Vec3, endTarget: Vec3) {
  const startPos = camera.position.clone()
  const startTarget = controls.target.clone()
  const duration = 500
  const startTime = performance.now()

  const step = () => {
    const progress = Math.min((performance.now() - startTime) / duration, 1)
    const eased = 1 - Math.pow(1 - progress, 3)
    camera.position.set(
      startPos.x + (endPos.x - startPos.x) * eased,
      startPos.y + (endPos.y - startPos.y) * eased,
      startPos.z + (endPos.z - startPos.z) * eased
    )
    controls.target.set(
      startTarget.x + (endTarget.x - startTarget.x) * eased,
      startTarget.y + (endTarget.y - startTarget.y) * eased,
      startTarget.z + (endTarget.z - startTarget.z) * eased
    )
    controls.update() // dispatches "change" → invalidate() in demand mode
    if (progress < 1) requestAnimationFrame(step)
  }
  step()
}

export function Controls({ yardWidth, yardLength }: ControlsProps) {
  const controlsRef = useRef<OrbitControlsType>(null)
  const { camera } = useThree()
  const { cameraPreset, isDragging, flyTo } = useUIStore()

  // Camera presets scaled to the yard size
  useEffect(() => {
    if (!controlsRef.current) return
    const preset = CAMERA_PRESETS[cameraPreset]
    const scaleX = yardWidth / 100
    const scaleZ = yardLength / 50
    const scaleY = Math.max(scaleX, scaleZ)
    animateCamera(
      camera,
      controlsRef.current,
      { x: preset.position[0] * scaleX, y: preset.position[1] * scaleY, z: preset.position[2] * scaleZ },
      { x: (preset.target[0] / 100) * yardWidth, y: preset.target[1], z: (preset.target[2] / 50) * yardLength }
    )
  }, [cameraPreset, camera, yardWidth, yardLength])

  // "Trova container": keep the current viewing direction, move closer to the target
  useEffect(() => {
    if (!flyTo || !controlsRef.current) return
    const controls = controlsRef.current
    const dir = camera.position.clone().sub(controls.target)
    if (dir.lengthSq() < 1) dir.set(20, 20, 20)
    dir.setLength(Math.max(25, Math.min(dir.length(), 45)))
    animateCamera(camera, controls, { x: flyTo.x + dir.x, y: flyTo.y + dir.y, z: flyTo.z + dir.z }, flyTo)
  }, [flyTo, camera])

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.1}
      minDistance={8}
      maxDistance={250}
      maxPolarAngle={Math.PI / 2 - 0.05}
      minPolarAngle={0.1}
      enabled={!isDragging}
      mouseButtons={{
        LEFT: THREE.MOUSE.PAN, // drag on empty ground pans; on a container it selects (stops propagation before reaching here)
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.ROTATE,
      }}
      touches={{
        ONE: THREE.TOUCH.PAN, // one finger on empty ground pans; on a container it selects / long-press picks up
        TWO: THREE.TOUCH.DOLLY_ROTATE, // pinch = zoom, twist = orbit — kept separate from pan
      }}
    />
  )
}
