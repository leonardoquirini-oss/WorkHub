import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
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

/** Gap (m) between the container face and the text, to avoid z-fighting. */
const FACE_OFFSET = 0.05
/** Fraction of the long side the text may use. */
const TEXT_FILL = 0.82

interface FaceLabel {
  number: string
  /** Centre of the container box. */
  center: [number, number, number]
  /** Half thickness along the short axis: distance from the centre to a long face. */
  half: number
  /** Length of the long side (drives the font size). */
  along: number
  /** World axis the long faces look along: 'x' when the block is rotated 90°, otherwise 'z'. */
  axis: 'x' | 'z'
  fontSize: number
  color: string
}

const tmp = new THREE.Vector3()

function labelOf(c: PlacedContainer, block: Block, all: Container[], color: string): FaceLabel {
  const box = slotBox(block, c.bay, c.row_no, c.bay_span, columnBaseHeight(all, c), containerHeight(c.container_type))
  const rotated = block.orientation === 90
  // slotBox returns [along, height, across] and swaps the two when the block is rotated.
  const along = rotated ? box.size[2] : box.size[0]
  const across = rotated ? box.size[0] : box.size[2]
  const chars = Math.max(c.container_number.length, 8)
  return {
    number: c.container_number,
    center: box.center,
    half: across / 2,
    along,
    axis: rotated ? 'x' : 'z',
    fontSize: Math.min(Math.max((along * TEXT_FILL) / chars, 0.3), 0.85),
    color,
  }
}

/**
 * Container numbers painted on the long side facing the observer. The side is re-picked from
 * the camera position on every rendered frame (cheap: only position/rotation are mutated),
 * so the number stays readable while orbiting. Only the containers nearest to the camera are
 * labelled, plus the selected and the searched one.
 */
export function ContainerLabels({ containers, blocks, selectedNumber, pulseNumber, maxLabels = 48 }: ContainerLabelsProps) {
  const [nearest, setNearest] = useState<string[]>([])
  const lastCheck = useRef(0)
  const groups = useRef(new Map<string, THREE.Group>())
  const blocksById = useMemo(() => new Map(blocks.map((b) => [b.id_block, b])), [blocks])

  const placed = useMemo(() => containers.filter(isPlaced), [containers])

  const byNumber = useMemo(() => {
    const map = new Map<string, FaceLabel>()
    for (const c of placed) {
      const block = blocksById.get(c.id_block)
      if (!block) continue
      const color = c.container_number === pulseNumber ? '#f472b6' : c.container_number === selectedNumber ? '#fde68a' : '#f8fafc'
      map.set(c.container_number, labelOf(c, block, containers, color))
    }
    return map
  }, [placed, blocksById, containers, selectedNumber, pulseNumber])

  useFrame(({ camera, clock }) => {
    // Re-rank by distance at most 3 times per second: the set of labelled containers changes slowly.
    const now = clock.elapsedTime
    if (now - lastCheck.current > 0.3) {
      lastCheck.current = now
      const ranked = Array.from(byNumber.values())
        .map((l) => ({ n: l.number, d: camera.position.distanceTo(tmp.set(l.center[0], l.center[1], l.center[2])) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, maxLabels)
        .map((r) => r.n)
      if (ranked.length !== nearest.length || ranked.some((n, i) => n !== nearest[i])) setNearest(ranked)
    }

    // Move each label onto the long face that looks towards the camera.
    for (const [number, group] of groups.current) {
      const label = byNumber.get(number)
      if (!label) continue
      const [cx, cy, cz] = label.center
      if (label.axis === 'x') {
        const sign = camera.position.x >= cx ? 1 : -1
        group.position.set(cx + sign * (label.half + FACE_OFFSET), cy, cz)
        group.rotation.set(0, (sign * Math.PI) / 2, 0)
      } else {
        const sign = camera.position.z >= cz ? 1 : -1
        group.position.set(cx, cy, cz + sign * (label.half + FACE_OFFSET))
        group.rotation.set(0, sign > 0 ? 0 : Math.PI, 0)
      }
    }
  })

  const visible = useMemo(() => {
    const set = new Set(nearest)
    if (selectedNumber) set.add(selectedNumber)
    if (pulseNumber) set.add(pulseNumber)
    return Array.from(set).filter((n) => byNumber.has(n))
  }, [nearest, selectedNumber, pulseNumber, byNumber])

  return (
    <group>
      {visible.map((n) => {
        const label = byNumber.get(n)!
        return (
          <group
            key={n}
            ref={(g) => {
              if (g) groups.current.set(n, g)
              else groups.current.delete(n)
            }}
            position={label.center}
          >
            <Text
              fontSize={label.fontSize}
              color={label.color}
              anchorX="center"
              anchorY="middle"
              maxWidth={label.along * TEXT_FILL}
              outlineWidth={label.fontSize * 0.09}
              outlineColor="#0f172a"
              depthOffset={-2}
            >
              {n}
            </Text>
          </group>
        )
      })}
    </group>
  )
}
