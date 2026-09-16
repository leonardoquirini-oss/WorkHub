import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { columnBaseHeight, containerHeight, isPlaced, slotBox } from '../../utils/slotLayout'
import type { Block, Container } from '../../types'

interface PulseMarkerProps {
  container: Container
  blocks: Block[]
  containers: Container[]
}

/** Pulsing wireframe around a container found through the search box. */
export function PulseMarker({ container, blocks, containers }: PulseMarkerProps) {
  const ref = useRef<THREE.Mesh>(null)
  const box = useMemo(() => {
    if (!isPlaced(container)) return null
    const block = blocks.find((b) => b.id_block === container.id_block)
    if (!block) return null
    return slotBox(block, container.bay, container.row_no, container.bay_span, columnBaseHeight(containers, container), containerHeight(container.container_type))
  }, [container, blocks, containers])

  useFrame(({ clock, invalidate }) => {
    if (!ref.current) return
    const s = 1.04 + Math.sin(clock.elapsedTime * 4) * 0.04
    ref.current.scale.set(s, s, s)
    invalidate()
  })

  if (!box) return null
  return (
    <mesh ref={ref} position={box.center}>
      <boxGeometry args={box.size} />
      <meshBasicMaterial color="#f472b6" wireframe transparent opacity={0.9} />
    </mesh>
  )
}
