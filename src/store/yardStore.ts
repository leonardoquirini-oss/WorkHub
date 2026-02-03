import { create } from 'zustand'
import { workHubAPI } from '../api/WorkHubAPI'
import { API_CONFIG, STORAGE_KEYS } from '../api/config'
import { calculateGravityCascade, calculateGravityAfterMove } from '../utils/gravityLogic'
import type { Yard, Container, ContainerCreateRequest, ContainerUpdateRequest, YardStats, Site } from '../types'

interface YardStore {
  // Data
  sites: Site[]
  yards: Yard[]
  containers: Container[]

  // Selection
  selectedSiteId: number | null
  selectedYardId: number | null

  // Loading states
  isLoadingSites: boolean
  isLoadingYards: boolean
  isLoadingContainers: boolean
  error: string | null

  // Actions
  loadSites: () => Promise<void>
  setSites: (sites: Site[]) => void
  selectSite: (siteId: number) => Promise<void>
  selectYard: (yardId: number) => Promise<void>
  loadYards: (siteId: number) => Promise<void>
  loadContainers: (yardId: number) => Promise<void>
  addContainer: (data: ContainerCreateRequest) => Promise<Container>
  updateContainer: (containerNumber: string, data: ContainerUpdateRequest) => Promise<Container>
  removeContainer: (containerNumber: string) => Promise<void>
  removeContainerWithGravity: (containerNumber: string) => Promise<{ fallenContainers: string[] }>
  applyGravityAfterMove: (containerNumber: string, newPosition: { x: number; y: number; z: number }) => Promise<{ fallenContainers: string[] }>
  getContainer: (containerNumber: string) => Container | undefined
  getYardStats: () => YardStats
  initializeFromStorage: () => Promise<void>
}

export const useYardStore = create<YardStore>((set, get) => ({
  // Initial state
  sites: [],
  yards: [],
  containers: [],
  selectedSiteId: null,
  selectedYardId: null,
  isLoadingSites: false,
  isLoadingYards: false,
  isLoadingContainers: false,
  error: null,

  loadSites: async () => {
    set({ isLoadingSites: true, error: null })
    try {
      const response = await workHubAPI.getSites()
      set({ sites: response.data, isLoadingSites: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Errore caricamento siti',
        isLoadingSites: false,
      })
    }
  },

  setSites: (sites) => set({ sites }),

  selectSite: async (siteId) => {
    set({ selectedSiteId: siteId, selectedYardId: null, yards: [], containers: [] })
    localStorage.setItem(STORAGE_KEYS.lastSite, siteId.toString())
    await get().loadYards(siteId)
  },

  selectYard: async (yardId) => {
    set({ selectedYardId: yardId, containers: [] })
    localStorage.setItem(STORAGE_KEYS.lastYard, yardId.toString())
    await get().loadContainers(yardId)
  },

  loadYards: async (siteId) => {
    set({ isLoadingYards: true, error: null })
    try {
      const response = await workHubAPI.getYards(siteId)
      set({ yards: response.data, isLoadingYards: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Errore caricamento piazzali',
        isLoadingYards: false,
      })
    }
  },

  loadContainers: async (yardId) => {
    set({ isLoadingContainers: true, error: null })
    try {
      const response = await workHubAPI.getContainers({ yardId })
      set({ containers: response.data, isLoadingContainers: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Errore caricamento container',
        isLoadingContainers: false,
      })
    }
  },

  addContainer: async (data) => {
    const response = await workHubAPI.createContainer(data)
    set((state) => ({
      containers: [...state.containers, response.data],
    }))
    return response.data
  },

  updateContainer: async (containerNumber, data) => {
    console.log('[DEBUG] yardStore.updateContainer - containerNumber:', containerNumber, 'data:', data)
    const response = await workHubAPI.updateContainer(containerNumber, data)
    console.log('[DEBUG] yardStore.updateContainer - API response:', response)
    set((state) => ({
      containers: state.containers.map((c) =>
        c.container_number === containerNumber
          ? { ...c, ...response.data } // Merge: mantieni campi esistenti, aggiorna con response
          : c
      ),
    }))
    return response.data
  },

  removeContainer: async (containerNumber) => {
    await workHubAPI.deleteContainer(containerNumber)
    set((state) => ({
      containers: state.containers.filter((c) => c.container_number !== containerNumber),
    }))
  },

  removeContainerWithGravity: async (containerNumber) => {
    console.log('[yardStore] removeContainerWithGravity called for:', containerNumber)
    const { containers, updateContainer } = get()
    console.log('[yardStore] Current containers count:', containers.length)

    // Calculate which containers will fall before removing
    const cascadeUpdates = calculateGravityCascade(containerNumber, containers)
    console.log('[yardStore] Cascade updates:', cascadeUpdates)

    // Delete the container from API
    await workHubAPI.deleteContainer(containerNumber)
    console.log('[yardStore] Container deleted from API')

    // Remove from local state first
    set((state) => ({
      containers: state.containers.filter((c) => c.container_number !== containerNumber),
    }))

    // Apply gravity updates to fallen containers
    const fallenContainers: string[] = []
    for (const update of cascadeUpdates) {
      try {
        console.log('[yardStore] Updating fallen container:', update.containerNumber, 'to Z:', update.newZ)
        await updateContainer(update.containerNumber, { position_z: update.newZ })
        fallenContainers.push(update.containerNumber)
        console.log('[yardStore] Update successful')
      } catch (err) {
        console.error(`[Gravity] Failed to update container ${update.containerNumber}:`, err)
      }
    }

    console.log('[yardStore] Fallen containers:', fallenContainers)
    return { fallenContainers }
  },

  applyGravityAfterMove: async (containerNumber, newPosition) => {
    console.log('[yardStore] applyGravityAfterMove called for:', containerNumber, 'to:', newPosition)
    const { containers, updateContainer } = get()

    // Calculate which containers will fall after this move
    const cascadeUpdates = calculateGravityAfterMove(containerNumber, newPosition, containers)
    console.log('[yardStore] Gravity cascade updates:', cascadeUpdates)

    // Apply gravity updates to fallen containers
    const fallenContainers: string[] = []
    for (const update of cascadeUpdates) {
      try {
        console.log('[yardStore] Updating fallen container:', update.containerNumber, 'to Z:', update.newZ)
        await updateContainer(update.containerNumber, { position_z: update.newZ })
        fallenContainers.push(update.containerNumber)
      } catch (err) {
        console.error(`[Gravity] Failed to update container ${update.containerNumber}:`, err)
      }
    }

    return { fallenContainers }
  },

  getContainer: (containerNumber) => {
    return get().containers.find((c) => c.container_number === containerNumber)
  },

  getYardStats: () => {
    const { containers, yards, selectedYardId } = get()
    const yard = yards.find((y) => y.id_yard === selectedYardId)

    const containersByType: Record<string, number> = {}
    const containersByStatus: Record<string, number> = {}

    for (const c of containers) {
      containersByType[c.container_type] = (containersByType[c.container_type] || 0) + 1
      containersByStatus[c.status] = (containersByStatus[c.status] || 0) + 1
    }

    // Rough capacity calculation (ground slots only)
    const gridSize = yard?.grid_cell_size || 2.4
    const yardWidth = yard?.width || 100
    const yardLength = yard?.length || 50
    const maxCapacity = Math.floor((yardWidth / (12.2 + gridSize)) * (yardLength / gridSize))

    return {
      totalContainers: containers.length,
      containersByType,
      containersByStatus,
      capacityUsed: containers.length,
      maxCapacity,
    }
  },

  initializeFromStorage: async () => {
    // First, load sites from API
    await get().loadSites()

    const { sites } = get()
    if (sites.length === 0) {
      return
    }

    const lastSite = localStorage.getItem(STORAGE_KEYS.lastSite)
    const lastYard = localStorage.getItem(STORAGE_KEYS.lastYard)

    // Determine which site to select: saved site or first available
    let siteId: number
    if (lastSite) {
      const savedSiteId = parseInt(lastSite, 10)
      // Check if saved site still exists
      if (sites.some((s) => s.id_site === savedSiteId)) {
        siteId = savedSiteId
      } else {
        siteId = sites[0].id_site
      }
    } else {
      siteId = API_CONFIG.defaultSiteId || sites[0].id_site
    }

    await get().selectSite(siteId)

    // Select yard
    const { yards } = get()
    if (yards.length > 0) {
      if (lastYard) {
        const yardId = parseInt(lastYard, 10)
        if (yards.some((y) => y.id_yard === yardId)) {
          await get().selectYard(yardId)
        } else {
          await get().selectYard(yards[0].id_yard)
        }
      } else {
        await get().selectYard(yards[0].id_yard)
      }
    }
  },
}))
