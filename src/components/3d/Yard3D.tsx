import { Suspense, useCallback, useMemo } from 'react'
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { useYardStore } from '../../store/yardStore'
import { useUIStore } from '../../store/uiStore'
import { notify } from '../../store/notificationStore'
import { useSlotDrag } from '../../hooks/useSlotDrag'
import { usePlacePending } from '../../hooks/usePlacePending'
import { getQualitySettings } from '../../utils/performance'
import { baySpanOf, findSlotAt } from '../../utils/slotLayout'
import { Grid3D } from './Grid3D'
import { YardAreas3D } from './YardAreas3D'
import { Controls } from './Controls'
import { Block3D } from './Block3D'
import { ContainersInstanced } from './ContainersInstanced'
import { SlotHighlight } from './SlotHighlight'
import { ContainerLabels } from './ContainerLabels'
import { PulseMarker } from './PulseMarker'

const CLICK_SLOP_PX = 6

function Scene({ highQuality }: { highQuality: boolean }) {
  const { yards, selectedYardId, containers, blocks } = useYardStore()
  const { showGrid, showAreas, selectContainer, selectedContainerNumber, dragTarget, pulseNumber } = useUIStore()
  const { dragging, onContainerPointerDown, onContainerContextMenu, onPointerMove, onPointerUp } = useSlotDrag()
  const { pendingEnter, placeAt } = usePlacePending()

  const yard = yards.find((y) => y.id_yard === selectedYardId)
  const pulseContainer = useMemo(
    () => (pulseNumber ? containers.find((c) => c.container_number === pulseNumber) ?? null : null),
    [containers, pulseNumber]
  )

  /**
   * Click on a container. R3F also delivers the click to the ground plane behind it (it was
   * part of the pointerdown hit list), which would immediately deselect: consume it here.
   * While placing a pending container the click must reach the ground instead, so the tap
   * picks the slot under the pointer.
   */
  const handleContainerClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      if (!pendingEnter) e.stopPropagation()
    },
    [pendingEnter]
  )

  const handleGroundClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      if (e.delta > CLICK_SLOP_PX) return // it was an orbit, not a tap
      // Something closer than the ground was clicked (container, marker): not a click on the yard
      if (e.intersections[0] && e.intersections[0].eventObject !== e.eventObject) return
      if (pendingEnter) {
        const slot = findSlotAt(blocks, e.point.x, e.point.z, baySpanOf(pendingEnter.container_type))
        if (!slot) {
          notify.warning('Tocca uno slot libero dentro un blocco')
          return
        }
        void placeAt(slot)
        return
      }
      selectContainer(null)
    },
    [pendingEnter, blocks, placeAt, selectContainer]
  )

  if (!yard) return null

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[yard.width, 60, yard.length / 2]}
        intensity={1}
        castShadow={highQuality}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-yard.width}
        shadow-camera-right={yard.width}
        shadow-camera-top={yard.length}
        shadow-camera-bottom={-yard.length}
      />
      <directionalLight position={[-30, 30, -30]} intensity={0.3} />

      <Controls yardWidth={yard.width} yardLength={yard.length} />

      {/* Invisible ground plane: pointer target for drag, tap-to-place and deselect */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[yard.width / 2, 0, yard.length / 2]}
        onClick={handleGroundClick}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        visible={false}
      >
        <planeGeometry args={[yard.width * 3, yard.length * 3]} />
        <meshBasicMaterial />
      </mesh>

      <Grid3D width={yard.width} length={yard.length} cellSize={yard.grid_cell_size ?? 6.1} visible={showGrid} />
      <YardAreas3D areas={yard.areas ?? []} visible={showAreas} />

      {blocks.filter((b) => b.is_active).map((block) => (
        <Block3D key={block.id_block} block={block} />
      ))}

      <ContainersInstanced
        containers={containers}
        blocks={blocks}
        selectedNumber={selectedContainerNumber}
        hiddenNumber={dragging?.container_number ?? null}
        onPointerDown={onContainerPointerDown}
        onPointerUp={onPointerUp}
        onClick={handleContainerClick}
        onContextMenu={onContainerContextMenu}
      />

      <ContainerLabels containers={containers} blocks={blocks} selectedNumber={selectedContainerNumber} pulseNumber={pulseNumber} />

      {pulseContainer && <PulseMarker container={pulseContainer} blocks={blocks} containers={containers} />}

      {dragging && dragTarget && (
        <SlotHighlight target={dragTarget} container={dragging} blocks={blocks} containers={containers} />
      )}
    </>
  )
}

export function Yard3D() {
  const { selectedYardId, isLoadingContainers, blocks } = useYardStore()
  const quality = useMemo(() => getQualitySettings(), [])
  const highQuality = quality.shadowMapSize >= 2048
  const dpr = Math.min(Math.max(quality.pixelRatio, 1), 1.5)

  if (!selectedYardId) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900">
        <p className="text-slate-400">Seleziona un piazzale per visualizzare i container</p>
      </div>
    )
  }

  return (
    <div className="w-full h-full relative touch-none select-none" onContextMenu={(e) => e.preventDefault()}>
      {isLoadingContainers && (
        <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center z-10 pointer-events-none">
          <div className="text-white">Caricamento piazzale...</div>
        </div>
      )}
      {!isLoadingContainers && blocks.length === 0 && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-300 text-xs">
          Nessun blocco configurato per questo piazzale
        </div>
      )}
      <Canvas
        frameloop="demand"
        shadows={highQuality}
        dpr={dpr}
        camera={{ position: [60, 40, 60], fov: 50, near: 0.1, far: 1000 }}
        gl={{ antialias: quality.antialias, alpha: false, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => gl.setClearColor('#1a1a2e')}
      >
        <Suspense fallback={null}>
          <Scene highQuality={highQuality} />
        </Suspense>
      </Canvas>
    </div>
  )
}
