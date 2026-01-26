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

export interface Yard {
  id_yard: number
  id_site: number
  name: string
  description?: string
  width: number
  length: number
  max_stack_height: number
  grid_cell_size: number
  is_active: boolean
  site_name?: string
  areas: YardArea[]
}

export interface Site {
  id_site: number
  name: string
  description?: string
}

export interface YardStats {
  totalContainers: number
  containersByType: Record<string, number>
  containersByStatus: Record<string, number>
  capacityUsed: number
  maxCapacity: number
}
