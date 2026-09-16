import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import { columnBaseHeight, containerHeight, isPlaced, slotBox } from '../../utils/slotLayout'
import type { Block, Container, PlacedContainer } from '../../types'

interface ContainerLabelsProps {
  containers: Container[]
  blocks: Block[]
  selectedNumber: string | null
  pulseNumber: string | null
  /** How many of the containers nearest to the camera get a label besides the selected one. */
  maxLabels?: number
}

const tmp = new THREE.Vector3()

function topOf(c: PlacedContainer, block: Block, all: Container[]): [number, number, number] {
  const box = slotBox(block, c.bay, c.row_no, c.bay_span, columnBaseHeight(all, c), containerHeight(c.container_type))
  return [box.center[0], box.center[1] + box.size[1] / 2 + 0.7, box.center[2]]
}

/**
 * Billboard labels for the selected container, the "found" container and the N containers
 * closest to the camera (recomputed at most every 300 ms of rendered frames).
 */
export function ContainerLabels({ containers, blocks, selectedNumber, pulseNumber, maxLabels = 14 }: ContainerLabelsProps) {
  const [nearest, setNearest] = useState<string[]>([])
  const lastCheck = useRef(0)
  const blocksById = useMemo(() => new Map(blocks.map((b) => [b.id_block, b])), [blocks])

  const placed = useMemo(() => containers.filter(isPlaced), [containers])
  const positions = useMemo(() => {
    const map = new Map<string, [number, number, number]>()
    for (const c of placed) {
      const block = blocksById.get(c.id_block)
      if (block) map.set(c.container_number, topOf(c, block, containers))
    }
    return map
  }, [placed, blocksById, containers])

  useFrame(({ camera, clock }) => {
    const now = clock.elapsedTime
    if (now - lastCheck.current < 0.3) return
    lastCheck.current = now
    const ranked = placed
      .map((c) => {
        const p = positions.get(c.container_number)
        const d = p ? camera.position.distanceTo(tmp.set(p[0], p[1], p[2])) : Infinity
        return { n: c.container_number, d }
      })
      .sort((a, b) => a.d - b.d)
      .slice(0, maxLabels)
      .map((r) => r.n)
    if (ranked.length !== nearest.length || ranked.some((n, i) => n !== nearest[i])) {
      setNearest(ranked)
    }
  })

  const visible = useMemo(() => {
    const set = new Set(nearest)
    if (selectedNumber) set.add(selectedNumber)
    if (pulseNumber) set.add(pulseNumber)
    return Array.from(set)
  }, [nearest, selectedNumber, pulseNumber])

  return (
    <group>
      {visible.map((n) => {
        const p = positions.get(n)
        if (!p) return null
        const highlighted = n === selectedNumber || n === pulseNumber
        return (
          <Billboard key={n} position={p}>
            <Text
              fontSize={highlighted ? 1.1 : 0.8}
              color={n === pulseNumber ? '#f472b6' : highlighted ? '#fbbf24' : '#ffffff'}
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.06}
              outlineColor="#0f172a"
            >
              {n}
            </Text>
          </Billboard>
        )
      })}
    </group>
  )
}
