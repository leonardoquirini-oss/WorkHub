import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { BRAND_LOGO_ASPECT, BRAND_LOGO_URL, hasBrandLogo } from '../../constants/branding'
import { CONTAINER_DIMENSIONS } from '../../constants/containerSizes'
import { CONTAINER_NUMBER_COLOR } from '../../constants/yardConfig'
import { columnBaseHeight, isPlaced, slotBox } from '../../utils/slotLayout'
import { logger } from '../../utils/logger'
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
/** Fraction of the long side logo + number may use. */
const TEXT_FILL = 0.88
/**
 * Per-character advance (em) used to size the number to the space it has. Deliberately wider
 * than the real average of the font (~0.55 em) so the number never wraps to a second line.
 */
const CHAR_ADVANCE = 0.66
/** Cap on the number: never taller than this fraction of the container height. */
const NUMBER_MAX_RATIO = 0.4
/** Faux bold: black stroke around the glyphs, as a share of the font size. */
const NUMBER_STROKE = 0.05
/** Logo height as a fraction of the container face height. */
const LOGO_FACE_RATIO = 0.7
/** Cap: the logo never takes more than this share of the usable width (short containers). */
const LOGO_MAX_SHARE = 0.3
/** Gap between logo and number, as a share of the logo width. */
const LOGO_GAP_SHARE = 0.2

interface FaceLabel {
  number: string
  /** Centre of the container box. */
  center: [number, number, number]
  /** Half thickness along the short axis: distance from the centre to a long face. */
  half: number
  /** World axis the long faces look along: 'x' when the block is rotated 90°, otherwise 'z'. */
  axis: 'x' | 'z'
  fontSize: number
  /** Width available to the number and its centre, once the logo has taken its room. */
  textWidth: number
  textX: number
  /** Logo placed at the left of the number, when the container carries one. */
  logo: { x: number; width: number; height: number } | null
}

const tmp = new THREE.Vector3()

/**
 * Loads the brand logo once, without suspending: if the asset is missing the yard keeps
 * rendering, just without the icon.
 */
function useBrandLogoTexture(): THREE.Texture | null {
  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  const invalidate = useThree((s) => s.invalidate)

  useEffect(() => {
    let active = true
    new THREE.TextureLoader().load(
      BRAND_LOGO_URL,
      (loaded) => {
        if (!active) {
          loaded.dispose()
          return
        }
        loaded.colorSpace = THREE.SRGBColorSpace
        setTexture(loaded)
        invalidate()
      },
      undefined,
      (err) => logger.warn('Logo container non caricato', err)
    )
    return () => {
      active = false
    }
  }, [invalidate])

  return texture
}

function labelOf(c: PlacedContainer, block: Block, all: Container[]): FaceLabel {
  // The mesh is the cassa, centred in a slot footprint that can be longer (a 30' sits in two
  // bays) or shorter (a 45' overhangs): the label follows the cassa, not the footprint.
  const dims = CONTAINER_DIMENSIONS[c.container_type] ?? CONTAINER_DIMENSIONS['40']
  const box = slotBox(block, c.bay, c.row_no, c.bay_span, columnBaseHeight(all, c), dims.height)
  const rotated = block.orientation === 90
  const along = dims.length
  const across = dims.width
  const branded = hasBrandLogo(c.container_number)
  const width = along * TEXT_FILL
  // The icon is sized on the cassa (70% of its height), not on the number.
  const logoWidth = branded
    ? Math.min(dims.height * LOGO_FACE_RATIO * BRAND_LOGO_ASPECT, width * LOGO_MAX_SHARE)
    : 0
  const logoHeight = logoWidth / BRAND_LOGO_ASPECT
  const gap = logoWidth * LOGO_GAP_SHARE
  // The number fills the width the logo leaves, up to a share of the container height.
  const chars = Math.max(c.container_number.length, 8)
  const available = width - logoWidth - gap
  const fontSize = Math.min(Math.max(available / (chars * CHAR_ADVANCE), 0.3), dims.height * NUMBER_MAX_RATIO)
  return {
    number: c.container_number,
    center: box.center,
    half: across / 2,
    axis: rotated ? 'x' : 'z',
    fontSize,
    // [ logo ][ gap ][ number ]: the logo eats the left end, the number is centred in the rest
    textWidth: available,
    textX: (logoWidth + gap) / 2,
    logo: branded ? { x: -width / 2 + logoWidth / 2, width: logoWidth, height: logoHeight } : null,
  }
}

/**
 * Container numbers (with the brand logo on their left, for the owned prefixes) painted on the
 * long side facing the observer. The side is re-picked from
 * the camera position on every rendered frame (cheap: only position/rotation are mutated),
 * so the number stays readable while orbiting. Only the containers nearest to the camera are
 * labelled, plus the selected and the searched one.
 */
export function ContainerLabels({ containers, blocks, selectedNumber, pulseNumber, maxLabels = 48 }: ContainerLabelsProps) {
  const [nearest, setNearest] = useState<string[]>([])
  const lastCheck = useRef(0)
  const groups = useRef(new Map<string, THREE.Group>())
  const blocksById = useMemo(() => new Map(blocks.map((b) => [b.id_block, b])), [blocks])
  const logoTexture = useBrandLogoTexture()

  const placed = useMemo(() => containers.filter(isPlaced), [containers])

  const byNumber = useMemo(() => {
    const map = new Map<string, FaceLabel>()
    for (const c of placed) {
      const block = blocksById.get(c.id_block)
      if (!block) continue
      map.set(c.container_number, labelOf(c, block, containers))
    }
    return map
  }, [placed, blocksById, containers])

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
            {label.logo && logoTexture && (
              <mesh position={[label.logo.x, 0, 0]}>
                <planeGeometry args={[label.logo.width, label.logo.height]} />
                <meshBasicMaterial map={logoTexture} transparent depthWrite={false} toneMapped={false} />
              </mesh>
            )}
            <Text
              position={[label.textX, 0, 0]}
              fontSize={label.fontSize}
              color={CONTAINER_NUMBER_COLOR}
              anchorX="center"
              anchorY="middle"
              maxWidth={label.textWidth}
              strokeWidth={label.fontSize * NUMBER_STROKE}
              strokeColor={CONTAINER_NUMBER_COLOR}
              outlineWidth={label.fontSize * 0.03}
              outlineColor="#ffffff"
              outlineOpacity={0.4}
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
