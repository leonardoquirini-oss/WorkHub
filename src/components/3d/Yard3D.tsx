import { Suspense, useCallback, useRef } from 'react'
import { Canvas, ThreeEvent } from '@react-three/fiber'
import { useYardStore } from '../../store/yardStore'
import { useUIStore } from '../../store/uiStore'
import { Container3D, DragPreview } from './Container3D'
import { Grid3D } from './Grid3D'
import { YardAreas3D } from './YardAreas3D'
import { Controls } from './Controls'
import { useContainerDrag } from '../../hooks/useContainerDrag'
import type { Container } from '../../types'

function Scene() {
  const { yards, selectedYardId, containers } = useYardStore()
  const { showGrid, showAreas, selectContainer, selectedContainerNumber, dragPreviewPosition, dragValid } = useUIStore()
  const planeRef = useRef<THREE.Mesh>(null)

  const yard = yards.find((y) => y.id_yard === selectedYardId)

  const { handleDragStart, handleDragMove, handleDragEnd, draggingContainer } = useContainerDrag()

  const handleSelect = useCallback(
    (containerNumber: string) => {
      selectContainer(selectedContainerNumber === containerNumber ? null : containerNumber)
    },
    [selectContainer, selectedContainerNumber]
  )

  const handleContainerDragStart = useCallback(
    (container: Container, e: ThreeEvent<PointerEvent>) => {
      handleDragStart(container, e)
    },
    [handleDragStart]
  )

  const handlePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (draggingContainer) {
        handleDragMove(e, planeRef.current)
      }
    },
    [draggingContainer, handleDragMove]
  )

  const handlePointerUp = useCallback(() => {
    if (draggingContainer) {
      handleDragEnd()
    }
  }, [draggingContainer, handleDragEnd])

  const handleBackgroundClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      // Only deselect if clicking on the ground, not on a container
      if (e.object === planeRef.current) {
        selectContainer(null)
      }
    },
    [selectContainer]
  )

  if (!yard) {
    return null
  }

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[yard.width, 50, yard.length / 2]}
        intensity={1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-yard.width}
        shadow-camera-right={yard.width}
        shadow-camera-top={yard.length}
        shadow-camera-bottom={-yard.length}
      />
      <directionalLight position={[-30, 30, -30]} intensity={0.3} />

      {/* Controls */}
      <Controls yardWidth={yard.width} yardLength={yard.length} />

      {/* Ground plane for raycasting */}
      <mesh
        ref={planeRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[yard.width / 2, 0, yard.length / 2]}
        onClick={handleBackgroundClick}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        visible={false}
      >
        <planeGeometry args={[yard.width * 2, yard.length * 2]} />
        <meshBasicMaterial />
      </mesh>

      {/* Grid */}
      <Grid3D
        width={yard.width}
        length={yard.length}
        cellSize={yard.grid_cell_size}
        visible={showGrid}
      />

      {/* Yard areas */}
      <YardAreas3D areas={yard.areas} visible={showAreas} />

      {/* Containers */}
      {containers.map((container) => (
        <Container3D
          key={container.container_number}
          container={container}
          onSelect={handleSelect}
          onDragStart={handleContainerDragStart}
        />
      ))}

      {/* Drag preview */}
      {dragPreviewPosition && draggingContainer && (
        <DragPreview
          containerType={draggingContainer.container_type}
          position={dragPreviewPosition}
          rotation={draggingContainer.rotation}
          isValid={dragValid}
        />
      )}
    </>
  )
}

export function Yard3D() {
  const { selectedYardId, isLoadingContainers } = useYardStore()

  if (!selectedYardId) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900">
        <p className="text-slate-400">Seleziona un piazzale per visualizzare i container</p>
      </div>
    )
  }

  return (
    <div className="w-full h-full relative">
      {isLoadingContainers && (
        <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center z-10">
          <div className="text-white">Caricamento container...</div>
        </div>
      )}
      <Canvas
        shadows
        camera={{ position: [60, 40, 60], fov: 50, near: 0.1, far: 1000 }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.setClearColor('#1a1a2e')
        }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  )
}

import * as THREE from 'three'
