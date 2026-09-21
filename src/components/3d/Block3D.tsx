import { useLayoutEffect, useMemo, useRef } from 'react'
import { Line, Text } from '@react-three/drei'
import * as THREE from 'three'
import { blockBounds, isReversed, isRotated, slotOrigin } from '../../utils/slotLayout'
import type { Block } from '../../types'

interface Block3DProps {
  block: Block
}

const LABEL_COLOR = '#cbd5e1'
const tmpMatrix = new THREE.Matrix4()

/** Ground grid of a block: one faint cell per (bay, row), the outline and bay/row labels. */
export function Block3D({ block }: Block3DProps) {
  const cellsRef = useRef<THREE.InstancedMesh>(null)
  const bounds = useMemo(() => blockBounds(block), [block])
  const cellCount = block.n_bays * block.n_rows
  const color = block.color || '#64748b'

  useLayoutEffect(() => {
    const mesh = cellsRef.current
    if (!mesh) return
    let i = 0
    for (let bay = 1; bay <= block.n_bays; bay++) {
      for (let row = 1; row <= block.n_rows; row++) {
        const o = slotOrigin(block, bay, row)
        const along = isRotated(block.orientation) ? block.row_width : block.bay_length
        const across = isRotated(block.orientation) ? block.bay_length : block.row_width
        tmpMatrix.makeRotationX(-Math.PI / 2)
        tmpMatrix.setPosition(o.x + along / 2, 0.015, o.z + across / 2)
        // plane geometry is 1x1: scale to the cell size (x = along world X, y = along world Z)
        tmpMatrix.multiply(new THREE.Matrix4().makeScale(along, across, 1))
        mesh.setMatrixAt(i++, tmpMatrix)
      }
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [block])

  const outline = useMemo<[number, number, number][]>(
    () => [
      [bounds.x0, 0.03, bounds.z0],
      [bounds.x1, 0.03, bounds.z0],
      [bounds.x1, 0.03, bounds.z1],
      [bounds.x0, 0.03, bounds.z1],
      [bounds.x0, 0.03, bounds.z0],
    ],
    [bounds]
  )

  const labels = useMemo(() => {
    const items: { key: string; text: string; x: number; z: number; size: number }[] = []
    const pitchBay = block.bay_length + block.gap
    const pitchRow = block.row_width + block.gap
    for (let bay = 1; bay <= block.n_bays; bay++) {
      const u = (bay - 1) * pitchBay + block.bay_length / 2
      const v = -1.4
      items.push({ key: `b${bay}`, text: String(bay).padStart(2, '0'), size: 1.1, ...toWorld(block, u, v) })
    }
    for (let row = 1; row <= block.n_rows; row++) {
      const u = -2.2
      const v = (row - 1) * pitchRow + block.row_width / 2
      items.push({ key: `r${row}`, text: String(row).padStart(2, '0'), size: 1.1, ...toWorld(block, u, v) })
    }
    items.push({ key: 'code', text: block.code, size: 2.4, ...toWorld(block, -2.2, -1.4) })
    return items
  }, [block])

  const textRotation: [number, number, number] = [-Math.PI / 2, 0, isRotated(block.orientation) ? -Math.PI / 2 : 0]

  return (
    <group>
      <instancedMesh key={cellCount} ref={cellsRef} args={[undefined, undefined, cellCount]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={color} transparent opacity={0.18} depthWrite={false} />
      </instancedMesh>

      <Line points={outline} color={color} lineWidth={1.5} />

      {labels.map((l) => (
        <Text
          key={l.key}
          position={[l.x, 0.05, l.z]}
          rotation={textRotation}
          fontSize={l.size}
          color={l.key === 'code' ? color : LABEL_COLOR}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.05}
          outlineColor="#0f172a"
        >
          {l.text}
        </Text>
      ))}
    </group>
  )
}

/**
 * Block-local (u along bays, v along rows) → world (x, z). With orientation 180/270 riflette u/v
 * (bay=1/row=1 e' dal lato opposto a origin_x/origin_y): stessa identita' geometrica di
 * `slotOrigin` in `slotLayout.ts` (un punto locale riflesso e' l'estensione meno il punto).
 */
function toWorld(block: Block, u: number, v: number): { x: number; z: number } {
  let uu = u
  let vv = v
  if (isReversed(block.orientation)) {
    const baysExtent = block.n_bays * block.bay_length + (block.n_bays - 1) * block.gap
    const rowsExtent = block.n_rows * block.row_width + (block.n_rows - 1) * block.gap
    uu = baysExtent - u
    vv = rowsExtent - v
  }
  return isRotated(block.orientation)
    ? { x: block.origin_x + vv, z: block.origin_y + uu }
    : { x: block.origin_x + uu, z: block.origin_y + vv }
}
