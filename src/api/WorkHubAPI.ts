import { API_CONFIG } from './config'
import { refreshAccessToken } from './authApi'
import type {
  ApiResponse,
  Container,
  ContainerCreateRequest,
  ContainerUpdateRequest,
  Site,
  Yard,
  UnitSearchResult,
  TokenData,
} from '../types'

class WorkHubAPI {
  private tokenData: TokenData | null = null
  private refreshPromise: Promise<void> | null = null

  setTokenData(tokenData: TokenData | null) {
    this.tokenData = tokenData
  }

  private async ensureValidToken(): Promise<string> {
    if (!this.tokenData) {
      throw new Error('Non autenticato')
    }

    // Check if token needs refresh
    if (Date.now() > this.tokenData.tokenExpiry - API_CONFIG.tokenRefreshBuffer) {
      // Prevent multiple concurrent refresh attempts
      if (!this.refreshPromise) {
        this.refreshPromise = this.doRefresh()
      }
      await this.refreshPromise
      this.refreshPromise = null
    }

    return this.tokenData.accessToken
  }

  private async doRefresh(): Promise<void> {
    if (!this.tokenData?.refreshToken) {
      throw new Error('Sessione scaduta')
    }

    const { tokenData } = await refreshAccessToken(this.tokenData.refreshToken)
    this.tokenData = tokenData
  }

  private async fetch<T>(url: string, options: RequestInit = {}): Promise<T> {
    const token = await this.ensureValidToken()
    const fullUrl = `${API_CONFIG.apiUrl}${url}`

    console.log(`[DEBUG] fetch - ${options.method || 'GET'} ${fullUrl}`)

    const response = await fetch(fullUrl, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    })

    console.log(`[DEBUG] fetch - Response status: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[DEBUG] fetch - Error response body:`, errorText)

      if (response.status === 401) {
        throw new Error('Non autorizzato')
      }

      let errorMessage = `Errore HTTP: ${response.status}`
      try {
        const errorData = JSON.parse(errorText)
        errorMessage = errorData.message || errorMessage
      } catch {
        // errorText is not JSON
      }
      throw new Error(errorMessage)
    }

    return response.json()
  }

  // === SITES ===

  async getSites(onlyWithYards = true): Promise<ApiResponse<Site[]>> {
    return this.fetch(`/workhub/sites?onlyWithYards=${onlyWithYards}`)
  }

  // === YARDS ===

  async getYards(siteId: number): Promise<ApiResponse<Yard[]>> {
    return this.fetch(`/workhub/yards?siteId=${siteId}`)
  }

  // === CONTAINERS ===

  async getContainers(params: { siteId?: number; yardId?: number }): Promise<ApiResponse<Container[]>> {
    const searchParams = new URLSearchParams()
    if (params.siteId) searchParams.append('siteId', params.siteId.toString())
    if (params.yardId) searchParams.append('yardId', params.yardId.toString())
    return this.fetch(`/workhub/containers?${searchParams}`)
  }

  async getContainer(containerNumber: string): Promise<ApiResponse<Container>> {
    return this.fetch(`/workhub/containers/${encodeURIComponent(containerNumber)}`)
  }

  async createContainer(data: ContainerCreateRequest): Promise<ApiResponse<Container>> {
    return this.fetch('/workhub/containers', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateContainer(containerNumber: string, data: ContainerUpdateRequest): Promise<ApiResponse<Container>> {
    const url = `/workhub/containers/${encodeURIComponent(containerNumber)}`
    console.log('[DEBUG] WorkHubAPI.updateContainer - URL:', `${API_CONFIG.apiUrl}${url}`)
    console.log('[DEBUG] WorkHubAPI.updateContainer - Method: PUT, Body:', data)
    const response = await this.fetch<ApiResponse<Container>>(url, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    console.log('[DEBUG] WorkHubAPI.updateContainer - Response:', response)
    return response
  }

  async deleteContainer(containerNumber: string): Promise<ApiResponse<null>> {
    return this.fetch(`/workhub/containers/${encodeURIComponent(containerNumber)}`, {
      method: 'DELETE',
    })
  }

  // === SEARCH ===

  async searchUnits(query: string, limit = 20): Promise<ApiResponse<UnitSearchResult[]>> {
    return this.fetch(`/units/search?q=${encodeURIComponent(query)}&limit=${limit}`)
  }
}

export const workHubAPI = new WorkHubAPI()
