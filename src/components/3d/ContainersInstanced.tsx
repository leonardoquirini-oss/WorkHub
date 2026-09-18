import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { CONTAINER_DIMENSIONS, CONTAINER_STATUS_COLORS } from '../../constants/containerSizes'
import { DEFAULT_CONTAINER_COLOR, SELECTED_CONTAINER_COLOR } from '../../constants/yardConfig'
import { columnBaseHeight, isPlaced, slotBox } from '../../utils/slotLayout'
import { RIB_BUMP_SCALE, ribTexture } from '../../utils/ribTexture'
import type { Block, Container, ContainerType, PlacedContainer } from '../../types'

interface ContainersInstancedProps {
  containers: Container[]
  blocks: Block[]
  selectedNumber: string | null
  /** Container being dragged: hidden in place (the ghost is drawn by SlotHighlight). */
  hiddenNumber: string | null
  onPointerDown: (container: Container, e: ThreeEvent<PointerEvent>) => void
  /** Ends the gesture when the pointer is released over a container instead of the ground. */
  onPointerUp: () => void
  /** Click on a container: consumed here so the ground plane behind does not deselect it. */
  onClick: (e: ThreeEvent<MouseEvent>) => void
  /** Right click on a container: opens the column context menu. */
  onContextMenu: (container: Container, e: ThreeEvent<MouseEvent>) => void
}

const tmpMatrix = new THREE.Matrix4()
const tmpPos = new THREE.Vector3()
const tmpQuat = new THREE.Quaternion()
const tmpScale = new THREE.Vector3()
const tmpColor = new THREE.Color()
const ROT_90 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)
const ROT_0 = new THREE.Quaternion()

function colorOf(c: Container, selected: boolean): string {
  if (selected) return SELECTED_CONTAINER_COLOR
  if (c.status !== 'active') return CONTAINER_STATUS_COLORS[c.status] ?? DEFAULT_CONTAINER_COLOR
  return c.color || DEFAULT_CONTAINER_COLOR
}

interface TypeInstancesProps {
  type: ContainerType
  list: PlacedContainer[]
  all: Container[]
  blocksById: Map<number, Block>
  selectedNumber: string | null
  hiddenNumber: string | null
  onPointerDown: (container: Container, e: ThreeEvent<PointerEvent>) => void
  onPointerUp: () => void
  onClick: (e: ThreeEvent<MouseEvent>) => void
  onContextMenu: (container: Container, e: ThreeEvent<MouseEvent>) => void
}

/** One InstancedMesh per container type (same box geometry, per-instance transform + colour). */
function TypeInstances({ type, list, all, blocksById, selectedNumber, hiddenNumber, onPointerDown, onPointerUp, onClick, onContextMenu }: TypeInstancesProps) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const invalidate = useThree((s) => s.invalidate)
  const dims = CONTAINER_DIMENSIONS[type]

  // Costolatura verticale della cassa: una costola ogni RIB_PITCH lungo la faccia.
  const ribs = useMemo(() => ribTexture(dims.length), [dims.length])
  useEffect(() => () => ribs.dispose(), [ribs])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    list.forEach((c, i) => {
      const block = blocksById.get(c.id_block)
      if (!block || c.container_number === hiddenNumber) {
        tmpMatrix.makeScale(0, 0, 0)
      } else {
        const box = slotBox(block, c.bay, c.row_no, c.bay_span, columnBaseHeight(all, c), dims.height)
        tmpPos.set(box.center[0], box.center[1], box.center[2])
        tmpScale.set(1, 1, 1)
        tmpQuat.copy(block.orientation === 90 ? ROT_90 : ROT_0)
        tmpMatrix.compose(tmpPos, tmpQuat, tmpScale)
      }
      mesh.setMatrixAt(i, tmpMatrix)
      mesh.setColorAt(i, tmpColor.set(colorOf(c, c.container_number === selectedNumber)))
    })
    mesh.count = list.length
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
    invalidate()
  }, [list, all, blocksById, selectedNumber, hiddenNumber, dims.height, invalidate])

  if (list.length === 0) return null

  return (
    <instancedMesh
      key={list.length}
      ref={ref}
      args={[undefined, undefined, list.length]}
      castShadow
      receiveShadow
      onPointerDown={(e) => {
        if (e.instanceId === undefined) return
        onPointerDown(list[e.instanceId], e)
      }}
      onPointerUp={() => onPointerUp()}
      onClick={onClick}
      onContextMenu={(e) => {
        if (e.instanceId === undefined) return
        onContextMenu(list[e.instanceId], e)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto'
      }}
    >
      <boxGeometry args={[dims.length, dims.height, dims.width]} />
      <meshStandardMaterial map={ribs} bumpMap={ribs} bumpScale={RIB_BUMP_SCALE} roughness={0.75} metalness={0.15} />
    </instancedMesh>
  )
}

export function ContainersInstanced({ containers, blocks, selectedNumber, hiddenNumber, onPointerDown, onPointerUp, onClick, onContextMenu }: ContainersInstancedProps) {
  const blocksById = useMemo(() => new Map(blocks.map((b) => [b.id_block, b])), [blocks])

  const byType = useMemo(() => {
    const groups = new Map<ContainerType, PlacedContainer[]>()
    for (const c of containers) {
      if (!isPlaced(c)) continue
      const type = (CONTAINER_DIMENSIONS[c.container_type] ? c.container_type : '40') as ContainerType
      const list = groups.get(type) ?? []
      list.push(c)
      groups.set(type, list)
    }
    return groups
  }, [containers])

  return (
    <group>
      {Array.from(byType.entries()).map(([type, list]) => (
        <TypeInstances
          key={type}
          type={type}
          list={list}
          all={containers}
          blocksById={blocksById}
          selectedNumber={selectedNumber}
          hiddenNumber={hiddenNumber}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onClick={onClick}
          onContextMenu={onContextMenu}
        />
      ))}
    </group>
  )
}
