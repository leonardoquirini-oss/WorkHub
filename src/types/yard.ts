import type { Container } from './container'

export type AreaType = 'import' | 'export' | 'storage' | 'maintenance'

export interface YardArea {
  id_yard_area: number
  id_yard: number
  name: string
  area_type: AreaType
  start_x: number
  start_y: number
  end_x: number
  end_y: number
  color: string
}

export type BlockOrientation = 0 | 90

/**
 * A block is a grid of slots inside a yard: `n_bays` × `n_rows` ground positions,
 * each stackable up to `max_tier`. A bay is a 20' unit; 40'/45' containers take two bays.
 */
export interface Block {
  id_block: number
  id_yard: number
  id_yard_area?: number | null
  code: string
  name?: string | null
  origin_x: number
  origin_y: number
  orientation: BlockOrientation
  n_bays: number
  n_rows: number
  max_tier: number
  bay_length: number
  row_width: number
  gap: number
  color?: string | null
  is_active: boolean
}

export interface Yard {
  id_yard: number
  id_site: number
  code: string
  name: string
  description?: string | null
  width: number
  length: number
  max_stack_height: number
  grid_cell_size?: number
  is_active: boolean
  site_name?: string
  revision?: number
  areas: YardArea[]
  blocks: Block[]
}

export interface Site {
  id_site: number
  name: string
  description?: string
}

export interface YardStats {
  totalContainers: number
  unallocated: number
  containersByType: Record<string, number>
  containersByStatus: Record<string, number>
  /** TEU occupied (a 40' counts 2). */
  capacityUsed: number
  /** TEU capacity of all active blocks (bays × rows × max_tier). */
  maxCapacity: number
}

/** `GET /api/workhub/yards/{id}/snapshot` */
export interface YardSnapshot {
  revision: number
  yard: Yard
  containers: Container[]
}

export type YardEventType = 'ENTER' | 'MOVE' | 'EXIT' | 'UPDATE' | 'LAYOUT'

/** Payload of the SSE `yard` event (Valkey channel `workhub:yard:{id}`). */
export interface YardEvent {
  type: YardEventType
  id_yard: number
  revision: number
  containers?: Container[]
  removed?: string[]
  by?: string
  at?: string
}
