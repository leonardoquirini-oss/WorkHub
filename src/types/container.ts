export type ContainerType = '20' | '40' | '40HC' | '45HC'

export type ContainerStatus = 'active' | 'damaged' | 'maintenance'

export type Rotation = 0 | 90 | 180 | 270

export interface ContainerDimensions {
  length: number // X axis
  width: number  // Y axis
  height: number // Z axis
}

export interface ContainerPosition {
  x: number
  y: number
  z: number // tier level (0 = ground)
}

export interface Container {
  container_number: string
  id_yard: number
  yard_name?: string
  container_type: ContainerType
  position_x: number
  position_y: number
  position_z: number
  rotation: Rotation
  weight?: number
  content_description?: string
  color: string
  notes?: string
  status: ContainerStatus
  created_at?: string
  updated_at?: string
}

export interface ContainerCreateRequest {
  container_number: string
  id_yard: number
  container_type: ContainerType
  position_x: number
  position_y: number
  position_z: number
  rotation: Rotation
  weight?: number
  content_description?: string
  color?: string
  status?: ContainerStatus
  notes?: string
}

export interface ContainerUpdateRequest {
  id_yard?: number
  container_type?: ContainerType
  position_x?: number
  position_y?: number
  position_z?: number
  rotation?: Rotation
  weight?: number
  content_description?: string
  color?: string
  status?: ContainerStatus
  notes?: string
}

export interface UnitSearchResult {
  id: string
  cassa: string
  tipo: string
  descrizione: string
  targa: string | null
  unitType: 'c' | 't' // container or trailer
}
