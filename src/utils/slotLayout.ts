/**
 * Pure slot geometry and placement rules. Mirrors the server-side rules of BERLink
 * (`YardSlotService`) so the client can validate and preview before calling the API.
 *
 * Coordinate conventions:
 * - Server `position_x` = world X, `position_y` = world Z (ground depth), `position_z` = height.
 * - Block local axes: `u` runs along the bays, `v` along the rows. With `orientation = 0`
 *   `u` maps to world X and `v` to world Z; with `orientation = 90` they are swapped.
 * - A bay is a 20' unit. Every type longer than a 20' (30', 40', 40HC, 45HC) takes two
 *   consecutive bays starting on an ODD bay and is registered on that odd bay.
 * - Stacks are homogeneous: every tier of a column has the same `bay` and `bay_span`.
 */
import type { Block, Container, ContainerType, PlacedContainer, SlotRef, BaySpan } from '../types'
import { CONTAINER_DIMENSIONS } from '../constants/containerSizes'

export interface SlotBox {
  center: [number, number, number]
  size: [number, number, number]
}

export interface PlacementResult {
  ok: boolean
  /** Tier the container would occupy (top + 1) when `ok`. */
  tier: number
  reason?: string
}

export function baySpanOf(type: ContainerType | string): BaySpan {
  return type === '20' ? 1 : 2
}

export function containerHeight(type: ContainerType | string): number {
  return CONTAINER_DIMENSIONS[type as ContainerType]?.height ?? 2.6
}

export function isPlaced(c: Container): c is PlacedContainer {
  return c.id_block != null && c.bay != null && c.row_no != null && c.tier != null
}

/** Length (m) along the bay axis covered by `span` bays including inner gaps. */
export function footprintLength(block: Block, span: BaySpan): number {
  return span * block.bay_length + (span - 1) * block.gap
}

/** World min-corner of a slot. */
export function slotOrigin(block: Block, bay: number, row: number): { x: number; z: number } {
  const u = (bay - 1) * (block.bay_length + block.gap)
  const v = (row - 1) * (block.row_width + block.gap)
  return block.orientation === 90
    ? { x: block.origin_x + v, z: block.origin_y + u }
    : { x: block.origin_x + u, z: block.origin_y + v }
}

/** Axis-aligned box of a slot footprint at `baseY`, `height` tall. */
export function slotBox(block: Block, bay: number, row: number, span: BaySpan, baseY: number, height: number): SlotBox {
  const along = footprintLength(block, span)
  const across = block.row_width
  const o = slotOrigin(block, bay, row)
  if (block.orientation === 90) {
    return { center: [o.x + across / 2, baseY + height / 2, o.z + along / 2], size: [across, height, along] }
  }
  return { center: [o.x + along / 2, baseY + height / 2, o.z + across / 2], size: [along, height, across] }
}

/** World rectangle covered by a block (without the trailing gap). */
export function blockBounds(block: Block): { x0: number; z0: number; x1: number; z1: number } {
  const alongBays = block.n_bays * block.bay_length + (block.n_bays - 1) * block.gap
  const alongRows = block.n_rows * block.row_width + (block.n_rows - 1) * block.gap
  const dx = block.orientation === 90 ? alongRows : alongBays
  const dz = block.orientation === 90 ? alongBays : alongRows
  return { x0: block.origin_x, z0: block.origin_y, x1: block.origin_x + dx, z1: block.origin_y + dz }
}

/**
 * Maps a world point to a slot of the block, snapping two-bay footprints to the odd bay.
 * Returns null when the point is outside the block or the footprint does not fit.
 */
export function worldToSlot(block: Block, x: number, z: number, span: BaySpan): { bay: number; row: number } | null {
  const u = block.orientation === 90 ? z - block.origin_y : x - block.origin_x
  const v = block.orientation === 90 ? x - block.origin_x : z - block.origin_y
  if (u < 0 || v < 0) return null

  let bay = Math.floor(u / (block.bay_length + block.gap)) + 1
  const row = Math.floor(v / (block.row_width + block.gap)) + 1
  if (row < 1 || row > block.n_rows || bay < 1 || bay > block.n_bays) return null

  if (span === 2) {
    if (bay % 2 === 0) bay -= 1
    if (bay + 1 > block.n_bays) return null
  }
  return { bay, row }
}

/** First active block containing the point, as a slot reference. */
export function findSlotAt(blocks: Block[], x: number, z: number, span: BaySpan): SlotRef | null {
  for (const block of blocks) {
    if (!block.is_active) continue
    const hit = worldToSlot(block, x, z, span)
    if (hit) return { id_block: block.id_block, bay: hit.bay, row_no: hit.row }
  }
  return null
}

export function columnKey(idBlock: number, rowNo: number, bay: number): string {
  return `${idBlock}:${rowNo}:${bay}`
}

/** Containers registered exactly on this column, lowest tier first. */
export function columnOf(containers: Container[], idBlock: number, rowNo: number, bay: number): PlacedContainer[] {
  return containers
    .filter((c): c is PlacedContainer => isPlaced(c) && c.id_block === idBlock && c.row_no === rowNo && c.bay === bay)
    .sort((a, b) => a.tier - b.tier)
}

/** Containers of the same block/row whose bay range intersects `[bay, bay + span)`. */
export function overlappingInRow(
  containers: Container[],
  idBlock: number,
  rowNo: number,
  bay: number,
  span: BaySpan,
  excludeNumber?: string
): PlacedContainer[] {
  const end = bay + span
  return containers.filter((c): c is PlacedContainer => {
    if (!isPlaced(c) || c.id_block !== idBlock || c.row_no !== rowNo) return false
    if (excludeNumber && c.container_number === excludeNumber) return false
    return c.bay < end && c.bay + c.bay_span > bay
  })
}

export function topTier(containers: Container[], idBlock: number, rowNo: number, bay: number): number {
  return columnOf(containers, idBlock, rowNo, bay).reduce((max, c) => Math.max(max, c.tier), 0)
}

/** Height (m) of everything stacked below `c` in its column. */
export function columnBaseHeight(containers: Container[], c: PlacedContainer): number {
  return columnOf(containers, c.id_block, c.row_no, c.bay)
    .filter((o) => o.tier < c.tier && o.container_number !== c.container_number)
    .reduce((sum, o) => sum + containerHeight(o.container_type), 0)
}

/** Position from the top of the stack (1 = top). */
export function posFromTop(containers: Container[], c: Container): number | null {
  if (!isPlaced(c)) return null
  return topTier(containers, c.id_block, c.row_no, c.bay) - c.tier + 1
}

function fail(reason: string): PlacementResult {
  return { ok: false, tier: 0, reason }
}

/** Client-side mirror of the server placement rules. */
export function canPlace(
  subject: { container_number: string; container_type: ContainerType | string },
  target: SlotRef,
  blocks: Block[],
  containers: Container[]
): PlacementResult {
  const block = blocks.find((b) => b.id_block === target.id_block)
  if (!block || !block.is_active) return fail('Blocco non disponibile')

  const span = baySpanOf(subject.container_type)
  if (target.row_no < 1 || target.row_no > block.n_rows) return fail('Fila fuori dal blocco')
  if (target.bay < 1 || target.bay + span - 1 > block.n_bays) return fail('Bay fuori dal blocco')
  if (span === 2 && target.bay % 2 === 0) return fail("Un 40' occupa due bay a partire da un bay dispari")

  const self = containers.find((c) => c.container_number === subject.container_number)
  if (self && isPlaced(self) && self.id_block === target.id_block && self.row_no === target.row_no && self.bay === target.bay) {
    return fail("Il container e' gia' in questa colonna")
  }

  const overlapping = overlappingInRow(containers, target.id_block, target.row_no, target.bay, span, subject.container_number)
  if (overlapping.some((c) => c.bay !== target.bay || c.bay_span !== span)) {
    return fail('Ingombro diverso dalla pila esistente')
  }

  const tier = overlapping.reduce((max, c) => Math.max(max, c.tier), 0) + 1
  if (tier > block.max_tier) return fail(`Altezza massima (${block.max_tier}) raggiunta`)

  return { ok: true, tier }
}

/**
 * Containers that drop by one tier when `source` leaves its column
 * (everything above it). Returns updated copies; the original list is untouched.
 */
export function cascadePreview(containers: Container[], source: PlacedContainer): Container[] {
  return columnOf(containers, source.id_block, source.row_no, source.bay)
    .filter((c) => c.tier > source.tier && c.container_number !== source.container_number)
    .map((c) => ({ ...c, tier: c.tier - 1 }))
}

const pad2 = (n: number) => String(n).padStart(2, '0')

export function labelOf(yardCode: string, blockCode: string, bay: number, row: number): string {
  return `${yardCode}-${blockCode}-${pad2(bay)}-${pad2(row)}`
}

export function slotLabelOf(blocks: Block[], yardCode: string, slot: SlotRef): string {
  const block = blocks.find((b) => b.id_block === slot.id_block)
  return labelOf(yardCode, block?.code ?? '?', slot.bay, slot.row_no)
}
