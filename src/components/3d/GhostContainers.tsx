import { useMemo } from 'react'
import * as THREE from 'three'
import { CONTAINER_DIMENSIONS } from '../../constants/containerSizes'
import { columnBaseHeight, isPlaced, isRotated, slotBox } from '../../utils/slotLayout'
import { colorOf } from '../../utils/containerColor'
import type { Block, Container, ContainerType } from '../../types'

interface GhostContainersProps {
  /** Casse fuori dalla colonna isolata: qui solo per far vedere lo spazio, non per leggerle. */
  containers: Container[]
  blocks: Block[]
}

const DASH_SIZE = 0.25
const GAP_SIZE = 0.18
const ROT_90 = Math.PI / 2

/** Un solo bordo (EdgesGeometry) per tipo di cassa: la sagoma non cambia da un'istanza all'altra. */
function useEdgeGeometries(): Map<ContainerType, THREE.BufferGeometry> {
  return useMemo(() => {
    const map = new Map<ContainerType, THREE.BufferGeometry>()
    for (const type of Object.keys(CONTAINER_DIMENSIONS) as ContainerType[]) {
      const dims = CONTAINER_DIMENSIONS[type]
      const box = new THREE.BoxGeometry(dims.length, dims.height, dims.width)
      const edges = new THREE.EdgesGeometry(box)
      // I trattini sono una distanza cumulata lungo il segmento: uguale per ogni cassa dello
      // stesso tipo, quindi si calcola una volta sola sulla geometria condivisa.
      new THREE.LineSegments(edges).computeLineDistances()
      map.set(type, edges)
      box.dispose()
    }
    return map
  }, [])
}

/**
 * Casse fuori dalla colonna isolata: solo il contorno tratteggiato, nessun riempimento. Servono a
 * capire quanto spazio resta sulle altre pile (per trascinarne una li'), non a leggerne il numero
 * (quello resta sulla colonna selezionata, disegnata piena da `ContainersInstanced`).
 */
export function GhostContainers({ containers, blocks }: GhostContainersProps) {
  const blocksById = useMemo(() => new Map(blocks.map((b) => [b.id_block, b])), [blocks])
  const edgeGeometries = useEdgeGeometries()
  const placed = useMemo(() => containers.filter(isPlaced), [containers])

  return (
    <group>
      {placed.map((c) => {
        const block = blocksById.get(c.id_block)
        if (!block) return null
        const type = (CONTAINER_DIMENSIONS[c.container_type] ? c.container_type : '40') as ContainerType
        const dims = CONTAINER_DIMENSIONS[type]
        const geometry = edgeGeometries.get(type)
        if (!geometry) return null
        const box = slotBox(block, c.bay, c.row_no, c.bay_span, columnBaseHeight(containers, c), dims.height)
        return (
          <lineSegments
            key={c.container_number}
            geometry={geometry}
            position={box.center}
            rotation={[0, isRotated(block.orientation) ? ROT_90 : 0, 0]}
          >
            <lineDashedMaterial color={colorOf(c, false)} dashSize={DASH_SIZE} gapSize={GAP_SIZE} transparent opacity={0.55} />
          </lineSegments>
        )
      })}
    </group>
  )
}
