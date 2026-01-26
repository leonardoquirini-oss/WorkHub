import { Text } from '@react-three/drei'
import type { YardArea } from '../../types'

interface YardAreas3DProps {
  areas: YardArea[]
  visible?: boolean
}

export function YardAreas3D({ areas, visible = true }: YardAreas3DProps) {
  if (!visible) return null

  return (
    <group>
      {areas.map((area) => {
        const width = area.end_x - area.start_x
        const length = area.end_y - area.start_y
        const centerX = area.start_x + width / 2
        const centerZ = area.start_y + length / 2

        return (
          <group key={area.id_yard_area}>
            {/* Area highlight plane */}
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[centerX, 0.02, centerZ]}
            >
              <planeGeometry args={[width, length]} />
              <meshStandardMaterial
                color={area.color}
                transparent
                opacity={0.2}
                depthWrite={false}
              />
            </mesh>

            {/* Area border */}
            <lineSegments position={[centerX, 0.03, centerZ]}>
              <edgesGeometry
                args={[new THREE.PlaneGeometry(width, length)]}
                // @ts-ignore - needed for proper rotation
                rotation={[-Math.PI / 2, 0, 0]}
              />
              <lineBasicMaterial color={area.color} linewidth={2} />
            </lineSegments>

            {/* Area label */}
            <Text
              position={[centerX, 0.5, centerZ]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={2}
              color={area.color}
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.1}
              outlineColor="#000000"
            >
              {area.name}
            </Text>
          </group>
        )
      })}
    </group>
  )
}

// Need to import THREE for PlaneGeometry
import * as THREE from 'three'
