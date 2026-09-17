export type ContainerType = '20' | '30' | '40' | '40HC' | '45HC'

export type ContainerStatus = 'active' | 'damaged' | 'maintenance'

/** Block orientation cached on the container (0 = bays along X, 90 = bays along Z). */
export type Rotation = 0 | 90 | 180 | 270

export type BaySpan = 1 | 2

export interface ContainerDimensions {
  length: number // along the bay axis
  width: number // along the row axis
  height: number
}

/** A ground position inside a block; `tier` is 1 at ground level. */
export interface SlotRef {
  id_block: number
  bay: number
  row_no: number
}

export interface Container {
  container_number: string
  id_yard: number
  yard_name?: string
  id_block: number | null
  bay: number | null
  bay_span: BaySpan
  row_no: number | null
  tier: number | null
  /** 1 = top of the stack (operators' convention). */
  pos_from_top?: number | null
  label?: string | null
  container_type: ContainerType
  /** Server-computed cache of the slot geometry (metres). */
  position_x: number
  position_y: number
  position_z: number
  rotation: Rotation
  weight?: number | null
  content_description?: string | null
  color?: string | null
  notes?: string | null
  status: ContainerStatus
  version: number
  registry_match?: boolean | null
  created_at?: string
  updated_at?: string | null
  updated_by?: string | null
}

/** Container with a slot assigned (narrowed by `isPlaced`). */
export type PlacedContainer = Container & { id_block: number; bay: number; row_no: number; tier: number }

/** `POST /api/workhub/containers` */
export interface ContainerEnterRequest extends SlotRef {
  container_number: string
  tier?: number | null
  container_type?: ContainerType
  weight?: number | null
  content_description?: string | null
  color?: string | null
  notes?: string | null
  status?: ContainerStatus
}

/** `POST /api/workhub/containers/{n}/move` */
export interface ContainerMoveRequest extends SlotRef {
  tier?: number | null
  version: number
  note?: string | null
}

/** `POST /api/workhub/containers/{n}/restack` — riordino dentro la stessa colonna. */
export interface ContainerRestackRequest {
  /** Livello di destinazione nella colonna (1 = terra); deve essere dentro la pila esistente. */
  tier: number
  version: number
  note?: string | null
}

/** `PATCH /api/workhub/containers/{n}` */
export interface ContainerPatchRequest {
  status?: ContainerStatus
  notes?: string | null
  content_description?: string | null
  color?: string | null
  weight?: number | null
  version: number
}

/** `POST /api/workhub/containers/{n}/exit` */
export interface ContainerExitRequest {
  version: number
  note?: string | null
}

export interface MoveResponse {
  moved: Container
  cascaded: Container[]
  revision: number
}

export interface ExitResponse {
  cascaded: Container[]
  revision: number
}

/** Value of `POST /api/workhub/containers/lookup-positions` */
export interface PositionInfo {
  label: string
  id_yard: number
  yard_name: string
  block_code: string
  bay: number
  row_no: number
  tier: number
  pos_from_top: number
}

export type MovementAction = 'ENTER' | 'MOVE' | 'CASCADE' | 'EXIT' | 'UPDATE'

/** Row of `GET /api/workhub/containers/{n}/history` */
export interface Movement {
  id_movement: number
  container_number: string
  action: MovementAction
  label_from?: string | null
  label_to?: string | null
  id_yard_from?: number | null
  id_yard_to?: number | null
  tier_from?: number | null
  tier_to?: number | null
  username: string
  note?: string | null
  created_at: string
}

export interface UnitSearchResult {
  id: string
  cassa: string
  tipo: string
  descrizione: string
  targa: string | null
  unitType: 'c' | 't' // container or trailer
}
