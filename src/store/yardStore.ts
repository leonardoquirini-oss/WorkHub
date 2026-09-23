import { create } from 'zustand'
import { workHubAPI, ApiError } from '../api/WorkHubAPI'
import { API_CONFIG, STORAGE_KEYS } from '../api/config'
import { useAuthStore } from './authStore'
import { logger } from '../utils/logger'
import { notify } from './notificationStore'
import { baySpanOf, canPlace, cascadePreview, isPlaced, labelOf, posFromTop, restackPreview } from '../utils/slotLayout'
import { isMarkedForExit } from '../utils/exitMark'
import type {
  Block,
  Container,
  ContainerEnterRequest,
  ContainerPatchRequest,
  ContainerProductInfo,
  Site,
  SlotRef,
  Yard,
  YardEvent,
  YardStats,
} from '../types'

interface YardStore {
  sites: Site[]
  yards: Yard[]
  containers: Container[]
  blocks: Block[]
  /** Materiale in giacenza per numero container (registro C/S), da mostrare sotto al numero. Vuoto per chi non ha il ruolo (dato commerciale). */
  productByNumber: Record<string, ContainerProductInfo>
  /** Yard revision from the last snapshot / event / mutation; drives SSE delta application. */
  revision: number
  yardCode: string

  selectedSiteId: number | null
  selectedYardId: number | null

  isLoadingSites: boolean
  isLoadingYards: boolean
  isLoadingContainers: boolean
  error: string | null

  loadSites: () => Promise<void>
  selectSite: (siteId: number) => Promise<void>
  selectYard: (yardId: number) => Promise<void>
  loadYards: (siteId: number) => Promise<void>
  loadSnapshot: (yardId?: number) => Promise<void>

  enterContainer: (data: Omit<ContainerEnterRequest, keyof SlotRef>, slot: SlotRef) => Promise<Container | null>
  moveContainer: (containerNumber: string, slot: SlotRef) => Promise<boolean>
  restackContainer: (containerNumber: string, toTier: number) => Promise<boolean>
  patchContainer: (containerNumber: string, patch: Omit<ContainerPatchRequest, 'version'>) => Promise<Container | null>
  exitContainer: (containerNumber: string, note?: string) => Promise<boolean>
  applyYardEvent: (event: YardEvent) => void

  getContainer: (containerNumber: string) => Container | undefined
  getYardStats: () => YardStats
  initializeFromStorage: () => Promise<void>
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

/** Replaces (or appends) containers by number. */
function upsertAll(list: Container[], updates: Container[]): Container[] {
  const byNumber = new Map(list.map((c) => [c.container_number, c]))
  for (const u of updates) byNumber.set(u.container_number, u)
  return Array.from(byNumber.values())
}

/** Recomputes the derived `pos_from_top` after a local (optimistic) change. */
function withPosFromTop(list: Container[]): Container[] {
  return list.map((c) => ({ ...c, pos_from_top: posFromTop(list, c) }))
}

export const useYardStore = create<YardStore>((set, get) => {
  /** Rollback helper for optimistic mutations: restores state, explains, reloads. */
  const recover = async (before: Container[], err: unknown, fallback: string) => {
    set({ containers: before })
    if (err instanceof ApiError && err.status === 409) {
      notify.warning(err.message || 'Conflitto: il piazzale e\' stato modificato da un altro utente')
    } else {
      notify.error(errorMessage(err, fallback))
    }
    logger.warn(fallback, err)
    await get().loadSnapshot()
  }

  /**
   * Interroga il materiale in giacenza per i numeri dati e aggiorna la cache: assente dalla
   * risposta = nessuna riga aperta, la voce va tolta (non lasciata con un dato vecchio). Dato
   * commerciale: niente richiesta per chi non ha il ruolo cd/logs (`WorkhubRoles.READ_PRODUCT`).
   */
  const refreshProducts = async (numbers: string[]) => {
    if (numbers.length === 0 || !useAuthStore.getState().canReadProduct) return
    try {
      const { data } = await workHubAPI.lookupProducts(numbers)
      set((s) => {
        const next = { ...s.productByNumber }
        for (const number of numbers) {
          if (data[number]) next[number] = data[number]
          else delete next[number]
        }
        return { productByNumber: next }
      })
    } catch (err) {
      logger.warn('Materiale in giacenza non aggiornato', err)
    }
  }

  return {
    sites: [],
    yards: [],
    containers: [],
    blocks: [],
    productByNumber: {},
    revision: 0,
    yardCode: '',
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
        logger.error('Caricamento siti fallito', err)
        set({ error: errorMessage(err, 'Errore caricamento siti'), isLoadingSites: false })
      }
    },

    selectSite: async (siteId) => {
      set({ selectedSiteId: siteId, selectedYardId: null, yards: [], containers: [], blocks: [], revision: 0 })
      localStorage.setItem(STORAGE_KEYS.lastSite, siteId.toString())
      await get().loadYards(siteId)
    },

    selectYard: async (yardId) => {
      set({ selectedYardId: yardId, containers: [], blocks: [], productByNumber: {}, revision: 0 })
      localStorage.setItem(STORAGE_KEYS.lastYard, yardId.toString())
      await get().loadSnapshot(yardId)
    },

    loadYards: async (siteId) => {
      set({ isLoadingYards: true, error: null })
      try {
        const response = await workHubAPI.getYards(siteId)
        set({ yards: response.data, isLoadingYards: false })
      } catch (err) {
        logger.error('Caricamento piazzali fallito', err)
        set({ error: errorMessage(err, 'Errore caricamento piazzali'), isLoadingYards: false })
      }
    },

    loadSnapshot: async (yardId) => {
      const id = yardId ?? get().selectedYardId
      if (!id) return
      set({ isLoadingContainers: true, error: null })
      try {
        const { data } = await workHubAPI.getSnapshot(id)
        if (get().selectedYardId !== id) return // yard changed while loading
        set({
          containers: data.containers,
          blocks: data.yard.blocks ?? [],
          revision: data.revision,
          yardCode: data.yard.code,
          yards: get().yards.map((y) => (y.id_yard === id ? { ...y, ...data.yard } : y)),
          isLoadingContainers: false,
        })
        void refreshProducts(data.containers.map((c) => c.container_number))
      } catch (err) {
        logger.error('Caricamento piazzale fallito', err)
        set({ error: errorMessage(err, 'Errore caricamento piazzale'), isLoadingContainers: false })
      }
    },

    enterContainer: async (data, slot) => {
      const { blocks, containers, yardCode } = get()
      const check = canPlace({ container_number: data.container_number, container_type: data.container_type ?? '40' }, slot, blocks, containers)
      if (!check.ok) {
        notify.warning(check.reason ?? 'Posizione non valida')
        return null
      }
      const block = blocks.find((b) => b.id_block === slot.id_block)
      const optimistic: Container = {
        container_number: data.container_number,
        id_yard: get().selectedYardId ?? 0,
        id_block: slot.id_block,
        bay: slot.bay,
        bay_span: baySpanOf(data.container_type ?? '40'),
        row_no: slot.row_no,
        tier: check.tier,
        label: labelOf(yardCode, block?.code ?? '?', slot.bay, slot.row_no),
        container_type: data.container_type ?? '40',
        position_x: 0,
        position_y: 0,
        position_z: 0,
        rotation: (block?.orientation ?? 0) as Container['rotation'],
        color: data.color ?? null,
        content_description: data.content_description ?? null,
        notes: data.notes ?? null,
        status: data.status ?? 'active',
        version: 0,
      }
      const before = containers
      set({ containers: withPosFromTop(upsertAll(containers, [optimistic])) })
      try {
        const response = await workHubAPI.enterContainer({ ...data, ...slot, tier: check.tier })
        set((s) => ({ containers: withPosFromTop(upsertAll(s.containers, [response.data])) }))
        if (response.message) notify.warning(response.message)
        return response.data
      } catch (err) {
        await recover(before, err, 'Ingresso container fallito')
        return null
      }
    },

    moveContainer: async (containerNumber, slot) => {
      const { blocks, containers, yardCode } = get()
      const current = containers.find((c) => c.container_number === containerNumber)
      if (!current) return false
      const check = canPlace(current, slot, blocks, containers)
      if (!check.ok) {
        notify.warning(check.reason ?? 'Posizione non valida')
        return false
      }
      const block = blocks.find((b) => b.id_block === slot.id_block)
      const moved: Container = {
        ...current,
        id_block: slot.id_block,
        bay: slot.bay,
        row_no: slot.row_no,
        tier: check.tier,
        label: labelOf(yardCode, block?.code ?? '?', slot.bay, slot.row_no),
        rotation: (block?.orientation ?? 0) as Container['rotation'],
      }
      const cascaded = isPlaced(current) ? cascadePreview(containers, current) : []
      const before = containers
      set({ containers: withPosFromTop(upsertAll(containers, [moved, ...cascaded])) })
      try {
        const { data } = await workHubAPI.moveContainer(containerNumber, { ...slot, tier: check.tier, version: current.version })
        set((s) => ({
          containers: withPosFromTop(upsertAll(s.containers, [data.moved, ...data.cascaded])),
          revision: Math.max(s.revision, data.revision),
        }))
        return true
      } catch (err) {
        await recover(before, err, 'Spostamento fallito')
        return false
      }
    },

    restackContainer: async (containerNumber, toTier) => {
      const { containers } = get()
      const current = containers.find((c) => c.container_number === containerNumber)
      if (!current || !isPlaced(current)) return false
      const preview = restackPreview(containers, current, toTier)
      if (preview.length === 0) {
        notify.warning('Riordino non valido per questa pila')
        return false
      }
      const before = containers
      set({ containers: withPosFromTop(upsertAll(containers, preview)) })
      try {
        const { data } = await workHubAPI.restackContainer(containerNumber, { tier: toTier, version: current.version })
        set((s) => ({
          containers: withPosFromTop(upsertAll(s.containers, [data.moved, ...data.cascaded])),
          revision: Math.max(s.revision, data.revision),
        }))
        return true
      } catch (err) {
        await recover(before, err, 'Riordino fallito')
        return false
      }
    },

    patchContainer: async (containerNumber, patch) => {
      const before = get().containers
      const current = before.find((c) => c.container_number === containerNumber)
      if (!current) return null
      set({ containers: upsertAll(before, [{ ...current, ...patch }]) })
      try {
        const { data } = await workHubAPI.patchContainer(containerNumber, { ...patch, version: current.version })
        set((s) => ({ containers: upsertAll(s.containers, [data]) }))
        return data
      } catch (err) {
        await recover(before, err, 'Aggiornamento fallito')
        return null
      }
    },

    exitContainer: async (containerNumber, note) => {
      const before = get().containers
      const current = before.find((c) => c.container_number === containerNumber)
      if (!current) return false
      const cascaded = isPlaced(current) ? cascadePreview(before, current) : []
      set({
        containers: withPosFromTop(upsertAll(before, cascaded).filter((c) => c.container_number !== containerNumber)),
      })
      try {
        const { data } = await workHubAPI.exitContainer(containerNumber, { version: current.version, note: note ?? null })
        set((s) => ({
          containers: withPosFromTop(upsertAll(s.containers, data.cascaded)),
          revision: Math.max(s.revision, data.revision),
        }))
        return true
      } catch (err) {
        await recover(before, err, 'Uscita container fallita')
        return false
      }
    },

    applyYardEvent: (event) => {
      const { selectedYardId, revision } = get()
      if (event.id_yard !== selectedYardId) return
      if (event.type === 'LAYOUT') {
        void get().loadSnapshot()
        return
      }
      if (event.revision <= revision) return // already applied (e.g. our own mutation)
      if (event.revision !== revision + 1) {
        logger.debug(`Evento fuori sequenza (locale ${revision}, ricevuto ${event.revision}): ricarico`)
        void get().loadSnapshot()
        return
      }
      const removed = new Set(event.removed ?? [])
      set((s) => {
        const productByNumber = { ...s.productByNumber }
        for (const number of removed) delete productByNumber[number]
        return {
          containers: withPosFromTop(
            upsertAll(s.containers, event.containers ?? []).filter((c) => !removed.has(c.container_number))
          ),
          productByNumber,
          revision: event.revision,
        }
      })
      void refreshProducts((event.containers ?? []).map((c) => c.container_number))
    },

    getContainer: (containerNumber) => get().containers.find((c) => c.container_number === containerNumber),

    getYardStats: () => {
      const { containers, blocks } = get()
      const containersByType: Record<string, number> = {}
      const containersByStatus: Record<string, number> = {}
      let capacityUsed = 0
      let unallocated = 0
      let markedForExit = 0
      for (const c of containers) {
        containersByType[c.container_type] = (containersByType[c.container_type] || 0) + 1
        containersByStatus[c.status] = (containersByStatus[c.status] || 0) + 1
        if (isPlaced(c)) capacityUsed += c.bay_span
        else unallocated += 1
        if (isMarkedForExit(c)) markedForExit += 1
      }
      const maxCapacity = blocks.filter((b) => b.is_active).reduce((sum, b) => sum + b.n_bays * b.n_rows * b.max_tier, 0)
      return { totalContainers: containers.length, unallocated, containersByType, containersByStatus, capacityUsed, maxCapacity, markedForExit }
    },

    initializeFromStorage: async () => {
      await get().loadSites()

      const { sites } = get()
      if (sites.length === 0) return

      const lastSite = localStorage.getItem(STORAGE_KEYS.lastSite)
      const lastYard = localStorage.getItem(STORAGE_KEYS.lastYard)

      const savedSiteId = lastSite ? parseInt(lastSite, 10) : API_CONFIG.defaultSiteId
      const siteId = sites.some((s) => s.id_site === savedSiteId) ? savedSiteId : sites[0].id_site
      await get().selectSite(siteId)

      const { yards } = get()
      if (yards.length === 0) return

      const savedYardId = lastYard ? parseInt(lastYard, 10) : NaN
      const yardId = yards.some((y) => y.id_yard === savedYardId) ? savedYardId : yards[0].id_yard
      await get().selectYard(yardId)
    },
  }
})
