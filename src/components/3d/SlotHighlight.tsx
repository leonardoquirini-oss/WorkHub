import { useMemo } from 'react'
import { columnBaseHeight, containerHeight, isPlaced, slotBox } from '../../utils/slotLayout'
import type { Block, Container } from '../../types'
import type { DragTarget } from '../../store/uiStore'

interface SlotHighlightProps {
  target: DragTarget
  container: Container
  blocks: Block[]
  containers: Container[]
}

/** Ghost box at the candidate slot: green when the move is valid, red otherwise. */
export function SlotHighlight({ target, container, blocks, containers }: SlotHighlightProps) {
  const box = useMemo(() => {
    const block = blocks.find((b) => b.id_block === target.id_block)
    if (!block) return null
    const span = container.bay_span
    const probe = { ...container, id_block: target.id_block, bay: target.bay, row_no: target.row_no, tier: target.tier || 1 }
    const baseY = isPlaced(probe) ? columnBaseHeight(containers.filter((c) => c.container_number !== container.container_number), probe) : 0
    return slotBox(block, target.bay, target.row_no, span, baseY, containerHeight(container.container_type))
  }, [target, container, blocks, containers])

  if (!box) return null
  const color = target.valid ? '#22c55e' : '#ef4444'

  return (
    <group>
      <mesh position={box.center}>
        <boxGeometry args={box.size} />
        <meshStandardMaterial color={color} transparent opacity={0.45} depthWrite={false} />
      </mesh>
      <mesh position={[box.center[0], 0.04, box.center[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[box.size[0], box.size[2]]} />
        <meshBasicMaterial color={color} transparent opacity={0.35} depthWrite={false} />
      </mesh>
    </group>
  )
}
