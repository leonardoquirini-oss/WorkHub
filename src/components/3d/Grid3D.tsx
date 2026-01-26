import { useMemo } from 'react'
import * as THREE from 'three'
import { GRID_COLOR, GRID_SECONDARY_COLOR, GROUND_COLOR } from '../../constants/yardConfig'

interface Grid3DProps {
  width: number
  length: number
  cellSize: number
  visible?: boolean
}

export function Grid3D({ width, length, cellSize, visible = true }: Grid3DProps) {
  const gridLines = useMemo(() => {
    if (!visible) return null

    const points: THREE.Vector3[] = []
    const secondaryPoints: THREE.Vector3[] = []

    // Vertical lines (along X axis)
    for (let x = 0; x <= width; x += cellSize) {
      const isMainLine = x % (cellSize * 5) === 0
      if (isMainLine) {
        points.push(new THREE.Vector3(x, 0.01, 0))
        points.push(new THREE.Vector3(x, 0.01, length))
      } else {
        secondaryPoints.push(new THREE.Vector3(x, 0.01, 0))
        secondaryPoints.push(new THREE.Vector3(x, 0.01, length))
      }
    }

    // Horizontal lines (along Z axis)
    for (let z = 0; z <= length; z += cellSize) {
      const isMainLine = z % (cellSize * 5) === 0
      if (isMainLine) {
        points.push(new THREE.Vector3(0, 0.01, z))
        points.push(new THREE.Vector3(width, 0.01, z))
      } else {
        secondaryPoints.push(new THREE.Vector3(0, 0.01, z))
        secondaryPoints.push(new THREE.Vector3(width, 0.01, z))
      }
    }

    return { main: points, secondary: secondaryPoints }
  }, [width, length, cellSize, visible])

  if (!visible || !gridLines) return null

  return (
    <group>
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[width / 2, 0, length / 2]} receiveShadow>
        <planeGeometry args={[width, length]} />
        <meshStandardMaterial color={GROUND_COLOR} roughness={0.9} metalness={0.1} />
      </mesh>

      {/* Main grid lines */}
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={gridLines.main.length}
            array={new Float32Array(gridLines.main.flatMap((v) => [v.x, v.y, v.z]))}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color={GRID_COLOR} linewidth={1} />
      </lineSegments>

      {/* Secondary grid lines */}
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={gridLines.secondary.length}
            array={new Float32Array(gridLines.secondary.flatMap((v) => [v.x, v.y, v.z]))}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color={GRID_SECONDARY_COLOR} linewidth={1} />
      </lineSegments>
    </group>
  )
}
