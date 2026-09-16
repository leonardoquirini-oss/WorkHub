import { API_CONFIG } from './config'
import { refreshAccessToken } from './authApi'
import { logger } from '../utils/logger'
import type {
  ApiResponse,
  Container,
  ContainerEnterRequest,
  ContainerExitRequest,
  ContainerMoveRequest,
  ContainerPatchRequest,
  ExitResponse,
  MoveResponse,
  Movement,
  PositionInfo,
  Site,
  Yard,
  YardSnapshot,
  UnitSearchResult,
  TokenData,
  User,
} from '../types'

/** HTTP error raised by the API client; `body` is the parsed JSON error payload when available. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body: unknown = null
  ) {
    super(message)
    this.name = 'ApiError'
  }

  /** `currentData` sent by the server on optimistic-lock conflicts (409). */
  get currentData(): Container | null {
    const body = this.body as { currentData?: Container } | null
    return body?.currentData ?? null
  }
}

export interface SessionCallbacks {
  /** Called after a successful silent token refresh. */
  onTokenRefreshed?: (tokenData: TokenData, user: User) => void
  /** Called when the session cannot be continued (refresh failed or server answered 401). */
  onSessionExpired?: (reason: string) => void
}

type TokenListener = (tokenData: TokenData) => void

/**
 * Single API client for BERLink. Owns the access token and is the only place where the
 * token is refreshed: every request goes through `ensureValidToken()`.
 */
class WorkHubAPI {
  private tokenData: TokenData | null = null
  private refreshPromise: Promise<void> | null = null
  private callbacks: SessionCallbacks = {}
  private tokenListeners = new Set<TokenListener>()

  setTokenData(tokenData: TokenData | null) {
    this.tokenData = tokenData
  }

  getTokenData(): TokenData | null {
    return this.tokenData
  }

  setSessionCallbacks(callbacks: SessionCallbacks) {
    this.callbacks = callbacks
  }

  /** Subscribe to token refreshes (used by the SSE client, which embeds the token in its URL). */
  addTokenRefreshListener(listener: TokenListener): () => void {
    this.tokenListeners.add(listener)
    return () => this.tokenListeners.delete(listener)
  }

  /** Returns a valid access token, refreshing it first when it is about to expire. */
  async ensureValidToken(): Promise<string> {
    if (!this.tokenData) {
      throw new ApiError(401, 'Non autenticato')
    }

    if (Date.now() > this.tokenData.tokenExpiry - API_CONFIG.tokenRefreshBuffer) {
      // Concurrent callers share one refresh round-trip
      if (!this.refreshPromise) {
        this.refreshPromise = this.doRefresh().finally(() => {
          this.refreshPromise = null
        })
      }
      await this.refreshPromise
    }

    if (!this.tokenData) {
      throw new ApiError(401, 'Sessione scaduta')
    }
    return this.tokenData.accessToken
  }

  private async doRefresh(): Promise<void> {
    const refreshToken = this.tokenData?.refreshToken
    if (!refreshToken) {
      this.expireSession('Sessione scaduta')
      throw new ApiError(401, 'Sessione scaduta')
    }

    try {
      const { tokenData, user } = await refreshAccessToken(refreshToken)
      this.tokenData = tokenData
      this.callbacks.onTokenRefreshed?.(tokenData, user)
      this.tokenListeners.forEach((listener) => listener(tokenData))
      logger.debug('Token aggiornato, scadenza', new Date(tokenData.tokenExpiry).toISOString())
    } catch (err) {
      this.expireSession(err instanceof Error ? err.message : 'Sessione scaduta')
      throw err
    }
  }

  private expireSession(reason: string) {
    this.tokenData = null
    this.callbacks.onSessionExpired?.(reason)
  }

  private async fetch<T>(url: string, options: RequestInit = {}): Promise<T> {
    const token = await this.ensureValidToken()
    const fullUrl = `${API_CONFIG.apiUrl}${url}`
    const method = options.method ?? 'GET'
    logger.debug(`${method} ${fullUrl}`)

    const response = await fetch(fullUrl, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      let body: unknown = null
      let message = `Errore HTTP: ${response.status}`
      try {
        body = JSON.parse(errorText)
        message = (body as { message?: string }).message || message
      } catch {
        // error body is not JSON
      }

      if (response.status === 401) {
        message = 'Non autorizzato'
        this.expireSession(message)
      }

      logger.warn(`${method} ${fullUrl} → ${response.status}`, errorText)
      throw new ApiError(response.status, message, body)
    }

    if (response.status === 204) {
      return undefined as T
    }
    return response.json() as Promise<T>
  }

  private json(method: 'POST' | 'PUT' | 'PATCH', body: unknown): RequestInit {
    return { method, body: JSON.stringify(body) }
  }

  private containerPath(containerNumber: string, suffix = ''): string {
    return `/workhub/containers/${encodeURIComponent(containerNumber)}${suffix}`
  }

  // === SITES / YARDS ===

  async getSites(onlyWithYards = true): Promise<ApiResponse<Site[]>> {
    return this.fetch(`/workhub/sites?onlyWithYards=${onlyWithYards}`)
  }

  async getYards(siteId: number): Promise<ApiResponse<Yard[]>> {
    return this.fetch(`/workhub/yards?siteId=${siteId}`)
  }

  /** Full state of a yard (layout + containers) with its `revision`. */
  async getSnapshot(yardId: number): Promise<ApiResponse<YardSnapshot>> {
    return this.fetch(`/workhub/yards/${yardId}/snapshot`)
  }

  // === CONTAINERS ===

  async enterContainer(data: ContainerEnterRequest): Promise<ApiResponse<Container>> {
    return this.fetch('/workhub/containers', this.json('POST', data))
  }

  async moveContainer(containerNumber: string, data: ContainerMoveRequest): Promise<ApiResponse<MoveResponse>> {
    return this.fetch(this.containerPath(containerNumber, '/move'), this.json('POST', data))
  }

  async patchContainer(containerNumber: string, data: ContainerPatchRequest): Promise<ApiResponse<Container>> {
    return this.fetch(this.containerPath(containerNumber), this.json('PATCH', data))
  }

  async exitContainer(containerNumber: string, data: ContainerExitRequest): Promise<ApiResponse<ExitResponse>> {
    return this.fetch(this.containerPath(containerNumber, '/exit'), this.json('POST', data))
  }

  async getHistory(containerNumber: string, limit = 50): Promise<ApiResponse<Movement[]>> {
    return this.fetch(this.containerPath(containerNumber, `/history?limit=${limit}`))
  }

  /** Where the given containers are, across all yards. Missing keys = not in any yard. */
  async lookupPositions(containerNumbers: string[]): Promise<ApiResponse<Record<string, PositionInfo>>> {
    return this.fetch('/workhub/containers/lookup-positions', this.json('POST', containerNumbers))
  }

  // === SEARCH ===

  /** Registry search (Valkey); the backend returns a bare list or an ApiResponse depending on version. */
  async searchUnits(query: string, limit = 20): Promise<ApiResponse<UnitSearchResult[]> | UnitSearchResult[]> {
    return this.fetch(`/units/search?q=${encodeURIComponent(query)}&limit=${limit}`)
  }
}

export const workHubAPI = new WorkHubAPI()
