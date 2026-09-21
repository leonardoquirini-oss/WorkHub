import { describe, it, expect } from 'vitest'
import {
  baySpanOf,
  blockBounds,
  canPlace,
  cascadePreview,
  columnBaseHeight,
  findSlotAt,
  footprintLength,
  columnNeighbor,
  labelOf,
  posFromTop,
  restackPreview,
  slotBox,
  slotOrigin,
  topTier,
  worldToSlot,
} from '../slotLayout'
import type { Block, Container, ContainerType } from '../../types'

const block: Block = {
  id_block: 1,
  id_yard: 10,
  code: 'A',
  origin_x: 2,
  origin_y: 3,
  orientation: 0,
  n_bays: 6,
  n_rows: 3,
  max_tier: 3,
  bay_length: 6.1,
  row_width: 2.4,
  gap: 0.3,
  is_active: true,
}

const rotated: Block = { ...block, id_block: 2, code: 'B', orientation: 90, origin_x: 60, origin_y: 5 }

// Stessi numeri di SlotGeometryTest.java lato BERLink (n_bays=5, n_rows=3), per incrociare i due lati.
const reversed: Block = { ...block, id_block: 3, code: 'C', orientation: 180, origin_x: 10, origin_y: 5, n_bays: 5, n_rows: 3 }
const reversedRotated: Block = { ...block, id_block: 4, code: 'D', orientation: 270, origin_x: 10, origin_y: 5, n_bays: 5, n_rows: 3 }

function ctr(number: string, type: ContainerType, bay: number, row: number, tier: number, idBlock = 1): Container {
  return {
    container_number: number,
    id_yard: 10,
    id_block: idBlock,
    bay,
    bay_span: baySpanOf(type),
    row_no: row,
    tier,
    container_type: type,
    position_x: 0,
    position_y: 0,
    position_z: 0,
    rotation: 0,
    status: 'active',
    version: 1,
  }
}

describe('footprint and geometry', () => {
  it("20' and 30' take one bay (TEU), 40'/40HC/45HC take two", () => {
    expect(baySpanOf('20')).toBe(1)
    expect(baySpanOf('30')).toBe(1)
    expect(baySpanOf('40')).toBe(2)
    expect(baySpanOf('40HC')).toBe(2)
    expect(baySpanOf('45HC')).toBe(2)
    expect(footprintLength(block, 2)).toBeCloseTo(12.5)
  })

  it('slotOrigin follows the block orientation', () => {
    const o = slotOrigin(block, 2, 3)
    expect(o.x).toBeCloseTo(2 + 6.4)
    expect(o.z).toBeCloseTo(3 + 5.4)
    const r = slotOrigin(rotated, 2, 3)
    expect(r.x).toBeCloseTo(60 + 5.4)
    expect(r.z).toBeCloseTo(5 + 6.4)
  })

  it('slotBox centres the footprint and swaps axes when rotated', () => {
    const b0 = slotBox(block, 1, 1, 2, 0, 2.6)
    expect(b0.size).toEqual([12.5, 2.6, 2.4])
    expect(b0.center[0]).toBeCloseTo(2 + 6.25)
    expect(b0.center[1]).toBeCloseTo(1.3)
    expect(b0.center[2]).toBeCloseTo(3 + 1.2)

    const b90 = slotBox(rotated, 1, 1, 2, 2.6, 2.9)
    expect(b90.size).toEqual([2.4, 2.9, 12.5])
    expect(b90.center[1]).toBeCloseTo(2.6 + 1.45)
  })

  it('blockBounds covers all bays and rows', () => {
    const b = blockBounds(block)
    expect(b.x1 - b.x0).toBeCloseTo(6 * 6.1 + 5 * 0.3)
    expect(b.z1 - b.z0).toBeCloseTo(3 * 2.4 + 2 * 0.3)
    const r = blockBounds(rotated)
    expect(r.x1 - r.x0).toBeCloseTo(3 * 2.4 + 2 * 0.3)
  })

  it('slotOrigin with orientation 180 counts bay/row from the corner OPPOSITE origin_x/origin_y', () => {
    const p1 = slotOrigin(reversed, 1, 1, 1)
    expect(p1.x).toBeCloseTo(10 + 25.6) // 5*6.1+4*0.3 - 6.1 - 0
    expect(p1.z).toBeCloseTo(5 + 5.4) // 3*2.4+2*0.3 - 2.4 - 0

    // span 2 (40'): l'intero footprint va riflesso, non solo il bay di partenza.
    const p2 = slotOrigin(reversed, 3, 1, 2)
    expect(p2.x).toBeCloseTo(10 + 6.4) // 31.7 - footprintLength(2)=12.5 - along(bay3)=12.8
  })

  it('slotOrigin with orientation 270 swaps axes AND counts from the opposite corner', () => {
    const p = slotOrigin(reversedRotated, 2, 2, 1)
    expect(p.x).toBeCloseTo(10 + 2.7) // row reversed: 7.8 - 2.4 - 2.7
    expect(p.z).toBeCloseTo(5 + 19.2) // bay reversed: 31.7 - 6.1 - 6.4
  })
})

describe('worldToSlot', () => {
  it('round-trips slotOrigin for all four orientations', () => {
    for (const b of [block, rotated, reversed, reversedRotated]) {
      for (let bay = 1; bay <= b.n_bays; bay++) {
        for (let row = 1; row <= b.n_rows; row++) {
          const o = slotOrigin(b, bay, row)
          expect(worldToSlot(b, o.x + 0.5, o.z + 0.5, 1)).toEqual({ bay, row })
        }
      }
    }
  })

  it('snaps two-bay footprints to the odd bay and rejects the last odd bay overflow', () => {
    const evenBay = slotOrigin(block, 2, 1)
    expect(worldToSlot(block, evenBay.x + 1, evenBay.z + 1, 2)).toEqual({ bay: 1, row: 1 })
    const narrow: Block = { ...block, n_bays: 5 }
    const lastBay = slotOrigin(narrow, 5, 1)
    expect(worldToSlot(narrow, lastBay.x + 1, lastBay.z + 1, 2)).toBeNull()
  })

  it('returns null outside the block', () => {
    expect(worldToSlot(block, 0, 0, 1)).toBeNull()
    expect(worldToSlot(block, 2 + 6 * 6.4 + 1, 4, 1)).toBeNull()
  })

  it('findSlotAt picks the first active block containing the point', () => {
    const inactive: Block = { ...block, id_block: 9, is_active: false }
    const o = slotOrigin(block, 3, 2)
    expect(findSlotAt([inactive, block, rotated], o.x + 0.1, o.z + 0.1, 1)).toEqual({ id_block: 1, bay: 3, row_no: 2 })
    expect(findSlotAt([block], -5, -5, 1)).toBeNull()
  })
})

describe('stacking rules', () => {
  const stack = [ctr('A1', '20', 1, 1, 1), ctr('A2', '20', 1, 1, 2), ctr('B1', '40', 3, 1, 1)]

  it('topTier and posFromTop', () => {
    expect(topTier(stack, 1, 1, 1)).toBe(2)
    expect(topTier(stack, 1, 1, 5)).toBe(0)
    expect(posFromTop(stack, stack[0])).toBe(2)
    expect(posFromTop(stack, stack[1])).toBe(1)
  })

  it('places on top of a homogeneous column', () => {
    expect(canPlace({ container_number: 'N', container_type: '20' }, { id_block: 1, bay: 1, row_no: 1 }, [block], stack)).toEqual({ ok: true, tier: 3 })
  })

  it('rejects mixed footprints, even bays for 40s, overflow and max tier', () => {
    const on40 = canPlace({ container_number: 'N', container_type: '20' }, { id_block: 1, bay: 3, row_no: 1 }, [block], stack)
    expect(on40.ok).toBe(false)
    const on20 = canPlace({ container_number: 'N', container_type: '40' }, { id_block: 1, bay: 1, row_no: 1 }, [block], stack)
    expect(on20.ok).toBe(false)
    expect(canPlace({ container_number: 'N', container_type: '40' }, { id_block: 1, bay: 2, row_no: 1 }, [block], []).ok).toBe(false)
    expect(canPlace({ container_number: 'N', container_type: '40' }, { id_block: 1, bay: 5, row_no: 1 }, [block], []).ok).toBe(true)
    expect(canPlace({ container_number: 'N', container_type: '20' }, { id_block: 1, bay: 7, row_no: 1 }, [block], []).ok).toBe(false)
    const full = [...stack, ctr('A3', '20', 1, 1, 3)]
    expect(canPlace({ container_number: 'N', container_type: '20' }, { id_block: 1, bay: 1, row_no: 1 }, [block], full).ok).toBe(false)
  })

  it('rejects moving a container onto its own column and inactive blocks', () => {
    expect(canPlace(stack[0], { id_block: 1, bay: 1, row_no: 1 }, [block], stack).ok).toBe(false)
    expect(canPlace(stack[0], { id_block: 1, bay: 5, row_no: 2 }, [{ ...block, is_active: false }], stack).ok).toBe(false)
  })

  it('cascadePreview drops everything above the leaving container', () => {
    const column = [ctr('C1', '20', 5, 3, 1), ctr('C2', '20', 5, 3, 2), ctr('C3', '20', 5, 3, 3)]
    const updated = cascadePreview(column, column[0] as never)
    expect(updated.map((c) => [c.container_number, c.tier])).toEqual([
      ['C2', 1],
      ['C3', 2],
    ])
    expect(cascadePreview(column, column[2] as never)).toEqual([])
  })

  it('columnBaseHeight sums the real heights below', () => {
    const column = [ctr('H1', '40', 1, 1, 1), ctr('H2', '40HC', 1, 1, 2), ctr('H3', '40', 1, 1, 3)]
    expect(columnBaseHeight(column, column[2] as never)).toBeCloseTo(2.6 + 2.9)
    expect(columnBaseHeight(column, column[0] as never)).toBe(0)
  })

  it('labels are zero-padded', () => {
    expect(labelOf('PZ1', 'A', 3, 12)).toBe('PZ1-A-03-12')
  })
})

describe('restack inside a column', () => {
  const column = [ctr('R1', '40', 1, 1, 1), ctr('R2', '40', 1, 1, 2), ctr('R3', '40', 1, 1, 3)]
  const other = ctr('X1', '40', 3, 1, 1)
  const containers = [...column, other]

  it('columnNeighbor finds the container right below and right above', () => {
    expect(columnNeighbor(containers, column[1] as never, -1)?.container_number).toBe('R1')
    expect(columnNeighbor(containers, column[1] as never, 1)?.container_number).toBe('R3')
    expect(columnNeighbor(containers, column[0] as never, -1)).toBeNull()
    expect(columnNeighbor(containers, column[2] as never, 1)).toBeNull()
  })

  it('swaps with the container below (one tier down)', () => {
    const updated = restackPreview(containers, column[1] as never, 1)
    expect(updated.map((c) => [c.container_number, c.tier])).toEqual([
      ['R2', 1],
      ['R1', 2],
    ])
  })

  it('swaps with the container above (one tier up)', () => {
    const updated = restackPreview(containers, column[1] as never, 3)
    expect(updated.map((c) => [c.container_number, c.tier])).toEqual([
      ['R2', 3],
      ['R3', 2],
    ])
  })

  it('lifts to the top of the stack and shifts the others down', () => {
    const updated = restackPreview(containers, column[0] as never, 3)
    expect(updated.map((c) => [c.container_number, c.tier])).toEqual([
      ['R1', 3],
      ['R2', 1],
      ['R3', 2],
    ])
  })

  it('ignores other columns and rejects targets outside the stack', () => {
    expect(restackPreview(containers, column[0] as never, 1)).toEqual([])
    expect(restackPreview(containers, column[0] as never, 4)).toEqual([])
    expect(restackPreview(containers, column[0] as never, 0)).toEqual([])
    expect(restackPreview(containers, other as never, 1)).toEqual([])
  })
})
