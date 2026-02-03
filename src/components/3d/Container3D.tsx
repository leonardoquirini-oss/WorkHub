import { useRef, useState, useMemo, useEffect } from 'react'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { useUIStore } from '../../store/uiStore'
import { CONTAINER_DIMENSIONS, CONTAINER_STATUS_COLORS } from '../../constants/containerSizes'
import { SELECTED_CONTAINER_COLOR } from '../../constants/yardConfig'
import type { Container } from '../../types'

interface Container3DProps {
  container: Container
  onSelect: (containerNumber: string) => void
  onDragStart?: (container: Container, e: ThreeEvent<PointerEvent>) => void
  onDragEnd?: () => void
}

export function Container3D({ container, onSelect, onDragStart }: Container3DProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const groupRef = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)
  const { selectedContainerNumber, isDragging } = useUIStore()
  const isSelected = selectedContainerNumber === container.container_number

  // Animated Y position for gravity fall effect
  const [animatedY, setAnimatedY] = useState<number | null>(null)
  const targetY = useRef(container.position_z)

  const dimensions = CONTAINER_DIMENSIONS[container.container_type] || CONTAINER_DIMENSIONS['40']

  // Calculate actual dimensions based on rotation
  const rotatedDims = useMemo(() => {
    if (!dimensions) {
      console.warn('[DEBUG] Container3D - Missing dimensions for type:', container.container_type)
      return { x: 12.2, y: 2.6, z: 2.4 } // Default 40' fallback
    }
    if (container.rotation === 90 || container.rotation === 270) {
      return { x: dimensions.width, y: dimensions.height, z: dimensions.length }
    }
    return { x: dimensions.length, y: dimensions.height, z: dimensions.width }
  }, [container.rotation, dimensions, container.container_type])

  // Track position_z changes for fall animation
  useEffect(() => {
    if (container.position_z !== targetY.current) {
      // Position changed - start animation from current animated position
      if (animatedY === null) {
        setAnimatedY(targetY.current)
      }
      targetY.current = container.position_z
    }
  }, [container.position_z])

  // Position is the center of the container
  // Use animated Y when falling, otherwise use actual position
  const currentZ = animatedY !== null ? animatedY : container.position_z
  const position: [number, number, number] = [
    container.position_x + rotatedDims.x / 2,
    currentZ + rotatedDims.y / 2,
    container.position_y + rotatedDims.z / 2,
  ]

  // Determine color
  const baseColor = useMemo(() => {
    if (isSelected) return SELECTED_CONTAINER_COLOR
    if (container.status !== 'active') return CONTAINER_STATUS_COLORS[container.status]
    return container.color || '#3b82f6'
  }, [isSelected, container.status, container.color])

  // Hover animation and fall animation
  useFrame(() => {
    if (!meshRef.current) return

    // Hover scale effect
    const scale = hovered && !isDragging ? 1.02 : 1
    meshRef.current.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.1)

    // Fall animation - interpolate Y position toward target
    if (animatedY !== null && groupRef.current) {
      const diff = targetY.current - animatedY
      if (Math.abs(diff) < 0.01) {
        // Close enough - snap to target and stop animating
        setAnimatedY(null)
      } else {
        // Interpolate with gravity-like acceleration (faster when higher up)
        const speed = 0.15 + Math.abs(diff) * 0.05
        setAnimatedY(animatedY + diff * Math.min(speed, 0.5))
      }
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onSelect(container.container_number)
  }

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (onDragStart && e.button === 0) {
      e.stopPropagation()
      onDragStart(container, e)
    }
  }

  return (
    <group ref={groupRef} position={position}>
      {/* Main container box */}
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHovered(false)
          document.body.style.cursor = 'auto'
        }}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[rotatedDims.x, rotatedDims.y, rotatedDims.z]} />
        <meshStandardMaterial
          color={baseColor}
          roughness={0.7}
          metalness={0.1}
          emissive={isSelected || hovered ? baseColor : '#000000'}
          emissiveIntensity={isSelected ? 0.3 : hovered ? 0.15 : 0}
        />
      </mesh>

      {/* Container edges */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(rotatedDims.x, rotatedDims.y, rotatedDims.z)]} />
        <lineBasicMaterial color={isSelected ? '#ffffff' : '#000000'} linewidth={isSelected ? 2 : 1} />
      </lineSegments>

      {/* Container number label - Front side (+Z) */}
      <Text
        position={[0, 0, rotatedDims.z / 2 + 0.15]}
        rotation={[0, 0, 0]}
        fontSize={0.7}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.04}
        outlineColor="#000000"
        maxWidth={rotatedDims.x * 0.9}
      >
        {container.container_number}
      </Text>

      {/* Container number label - Back side (-Z) */}
      <Text
        position={[0, 0, -rotatedDims.z / 2 - 0.15]}
        rotation={[0, Math.PI, 0]}
        fontSize={0.7}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.04}
        outlineColor="#000000"
        maxWidth={rotatedDims.x * 0.9}
      >
        {container.container_number}
      </Text>

      {/* Container number label - Right side (+X) */}
      <Text
        position={[rotatedDims.x / 2 + 0.15, 0, 0]}
        rotation={[0, Math.PI / 2, 0]}
        fontSize={0.7}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.04}
        outlineColor="#000000"
        maxWidth={rotatedDims.z * 0.9}
      >
        {container.container_number}
      </Text>

      {/* Container number label - Left side (-X) */}
      <Text
        position={[-rotatedDims.x / 2 - 0.15, 0, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        fontSize={0.7}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.04}
        outlineColor="#000000"
        maxWidth={rotatedDims.z * 0.9}
      >
        {container.container_number}
      </Text>
    </group>
  )
}

// Ghost preview during drag
interface DragPreviewProps {
  containerType: string
  position: { x: number; y: number; z: number }
  rotation: number
  isValid: boolean
}

export function DragPreview({ containerType, position, rotation, isValid }: DragPreviewProps) {
  const dimensions = CONTAINER_DIMENSIONS[containerType as keyof typeof CONTAINER_DIMENSIONS] || CONTAINER_DIMENSIONS['40']

  const rotatedDims = useMemo(() => {
    if (rotation === 90 || rotation === 270) {
      return { x: dimensions.width, y: dimensions.height, z: dimensions.length }
    }
    return { x: dimensions.length, y: dimensions.height, z: dimensions.width }
  }, [rotation, dimensions])

  const meshPosition: [number, number, number] = [
    position.x + rotatedDims.x / 2,
    position.z + rotatedDims.y / 2,
    position.y + rotatedDims.z / 2,
  ]

  return (
    <mesh position={meshPosition}>
      <boxGeometry args={[rotatedDims.x, rotatedDims.y, rotatedDims.z]} />
      <meshStandardMaterial
        color={isValid ? '#22c55e' : '#ef4444'}
        transparent
        opacity={0.5}
        depthWrite={false}
      />
    </mesh>
  )
}
