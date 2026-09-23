import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { BRAND_LOGO_ASPECT, BRAND_LOGO_URL, hasBrandLogo } from '../../constants/branding'
import { CONTAINER_DIMENSIONS } from '../../constants/containerSizes'
import { CONTAINER_NUMBER_COLOR } from '../../constants/yardConfig'
import { columnBaseHeight, isPlaced, isRotated, slotBox } from '../../utils/slotLayout'
import { isMarkedForExit } from '../../utils/exitMark'
import { isMultiGiacenza, materialLabel } from '../../utils/containerMaterial'
import { logger } from '../../utils/logger'
import type { Block, Container, ContainerProductInfo, PlacedContainer } from '../../types'

interface ContainerLabelsProps {
  containers: Container[]
  blocks: Block[]
  selectedNumber: string | null
  pulseNumber: string | null
  /** Materiale in giacenza per numero container: scritto in basso sul fianco, per ogni cassa etichettata. */
  productByNumber: Record<string, ContainerProductInfo>
  /** How many of the containers nearest to the camera get a label besides the selected one. */
  maxLabels?: number
}

/** Gap (m) between the container face and the text, to avoid z-fighting. */
const FACE_OFFSET = 0.05
/** Font del materiale rispetto a quello del numero: leggermente piu' piccolo, stessa riga in basso sulla cassa. */
const MATERIAL_FONT_RATIO = 0.75
/** Margine (in font-size del materiale) dal bordo inferiore della cassa, cosi' il testo non tocca il pianale. */
const MATERIAL_BOTTOM_MARGIN = 0.75
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
/**
 * Targhetta bianca dietro logo e numero sulle casse a scacchi: su quadri da mezzo metro il
 * numero, largo un metro, sarebbe illeggibile. Altezza in multipli dello spazio occupato.
 */
const PLATE_PADDING = 1.15
/** Distanza (m) fra targhetta e scritta: la targhetta sta fra la cassa e il testo. */
const PLATE_DEPTH = 0.01

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
  /** Targhetta bianca dietro logo e numero, solo per le casse marcate per l'uscita. */
  plate: { width: number; height: number } | null
  /** Riga in basso sulla cassa col materiale in giacenza: font leggermente piu' piccolo del numero, indipendente dalla sua posizione. */
  material: { y: number; width: number; fontSize: number }
  /** Numero anche sul tetto, per la vista dall'alto: posizione locale (sopra il centro) e misura. */
  roof: { y: number; fontSize: number; maxWidth: number }
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
  const rotated = isRotated(block.orientation)
  const along = dims.length
  const across = dims.width
  const branded = hasBrandLogo(c.container_number)
  const width = along * TEXT_FILL
  // The icon is sized on the cassa (70% of its height), not on the number.
  const logoWidth = branded
    ? Math.min(dims.height * LOGO_FACE_RATIO * BRAND_LOGO_ASPECT, width * LOGO_MAX_SHARE)
    : 0
  const logoHeight = logoWidth / BRAND_LOGO_ASPECT
  const logoGap = logoWidth * LOGO_GAP_SHARE
  // The number fills the width the logo leaves, up to a share of the container height.
  const chars = Math.max(c.container_number.length, 8)
  const available = width - logoWidth - logoGap
  const fontSize = Math.min(Math.max(available / (chars * CHAR_ADVANCE), 0.3), dims.height * NUMBER_MAX_RATIO)
  // Sul tetto lo spazio e' vincolato dalla larghezza della cassa (across), non dall'altezza:
  // stessa formula per-carattere, cap sulla larghezza invece che sull'altezza.
  const roofFontSize = Math.min(Math.max((along * TEXT_FILL) / (chars * CHAR_ADVANCE), 0.3), across * NUMBER_MAX_RATIO * 2)
  const materialFontSize = fontSize * MATERIAL_FONT_RATIO
  return {
    number: c.container_number,
    center: box.center,
    half: across / 2,
    axis: rotated ? 'x' : 'z',
    fontSize,
    roof: { y: dims.height / 2 + FACE_OFFSET, fontSize: roofFontSize, maxWidth: along * TEXT_FILL },
    // [ logo ][ gap ][ number ]: the logo eats the left end, the number is centred in the rest
    textWidth: available,
    textX: (logoWidth + logoGap) / 2,
    logo: branded ? { x: -width / 2 + logoWidth / 2, width: logoWidth, height: logoHeight } : null,
    plate: isMarkedForExit(c)
      ? { width, height: Math.max(logoHeight, fontSize * 1.6) * PLATE_PADDING }
      : null,
    // In basso sul fianco, non sotto al numero: il numero resta dov'era.
    material: { y: -dims.height / 2 + materialFontSize * MATERIAL_BOTTOM_MARGIN, width, fontSize: materialFontSize },
  }
}

/**
 * Materiale in giacenza, in basso sul fianco della cassa. In rosso lampeggiante quando il
 * registro ha piu' righe aperte per la stessa cassa ("Multi-Giacenza"): l'oscillazione e' un
 * `setInterval` invece di un `useFrame`, perche' con `frameloop="demand"` un render continuo per
 * un solo testo lampeggiante e' spreco — qui basta invalidare a ogni cambio di stato.
 */
function MaterialSubLabel({
  text,
  multi,
  y,
  width,
  fontSize,
}: {
  text: string
  multi: boolean
  y: number
  width: number
  fontSize: number
}) {
  const [on, setOn] = useState(true)
  const invalidate = useThree((s) => s.invalidate)

  useEffect(() => {
    if (!multi) return
    const id = setInterval(() => {
      setOn((v) => !v)
      invalidate()
    }, 450)
    return () => clearInterval(id)
  }, [multi, invalidate])

  return (
    <Text
      position={[0, y, 0]}
      fontSize={fontSize}
      color={multi ? '#ef4444' : CONTAINER_NUMBER_COLOR}
      fillOpacity={multi ? (on ? 1 : 0.25) : 1}
      anchorX="center"
      anchorY="middle"
      maxWidth={width}
      strokeWidth={fontSize * NUMBER_STROKE}
      strokeColor={multi ? '#ef4444' : CONTAINER_NUMBER_COLOR}
      outlineWidth={fontSize * 0.03}
      outlineColor="#ffffff"
      outlineOpacity={0.4}
      depthOffset={-2}
    >
      {text}
    </Text>
  )
}

/**
 * Container numbers (with the brand logo on their left, for the owned prefixes) painted on the
 * long side facing the observer. The side is re-picked from
 * the camera position on every rendered frame (cheap: only position/rotation are mutated),
 * so the number stays readable while orbiting. Only the containers nearest to the camera are
 * labelled, plus the selected and the searched one.
 */
export function ContainerLabels({
  containers,
  blocks,
  selectedNumber,
  pulseNumber,
  productByNumber,
  maxLabels = 48,
}: ContainerLabelsProps) {
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
        const materialText = materialLabel(productByNumber[n])
        return (
          <Fragment key={n}>
            <group
              ref={(g) => {
                if (g) groups.current.set(n, g)
                else groups.current.delete(n)
              }}
              position={label.center}
            >
              {label.plate && (
                <mesh position={[0, 0, -PLATE_DEPTH]}>
                  <planeGeometry args={[label.plate.width, label.plate.height]} />
                  <meshBasicMaterial color="#ffffff" toneMapped={false} />
                </mesh>
              )}
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
              {materialText && (
                <MaterialSubLabel
                  text={materialText}
                  multi={isMultiGiacenza(productByNumber[n])}
                  fontSize={label.material.fontSize}
                  y={label.material.y}
                  width={label.material.width}
                />
              )}
            </group>
            {/* Numero anche sul tetto: posizione/rotazione fisse, non seguono la camera (vista dall'alto).
               Ruotato di 90° in pianta quando il blocco e' ruotato, cosi' resta parallelo al lato
               lungo della cassa (stesso asse gia' usato per il numero sul fianco). */}
            <group
              position={[label.center[0], label.center[1] + label.roof.y, label.center[2]]}
              rotation={[-Math.PI / 2, 0, label.axis === 'x' ? Math.PI / 2 : 0]}
            >
              <Text
                fontSize={label.roof.fontSize}
                color={CONTAINER_NUMBER_COLOR}
                anchorX="center"
                anchorY="middle"
                maxWidth={label.roof.maxWidth}
                strokeWidth={label.roof.fontSize * NUMBER_STROKE}
                strokeColor={CONTAINER_NUMBER_COLOR}
                outlineWidth={label.roof.fontSize * 0.03}
                outlineColor="#ffffff"
                outlineOpacity={0.4}
                depthOffset={-2}
              >
                {n}
              </Text>
            </group>
          </Fragment>
        )
      })}
    </group>
  )
}
