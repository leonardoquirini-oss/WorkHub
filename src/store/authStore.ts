import { create } from 'zustand'
import { login, logout, refreshAccessToken, getStoredAuth, clearStoredAuth } from '../api/authApi'
import { workHubAPI } from '../api/WorkHubAPI'
import { API_CONFIG } from '../api/config'
import type { User, TokenData } from '../types'

interface AuthStore {
  isAuthenticated: boolean
  isLoading: boolean
  user: User | null
  tokenData: TokenData | null
  error: string | null

  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  initializeAuth: () => void
  clearError: () => void
}

export const useAuthStore = create<AuthStore>((set, get) => {
  let refreshInterval: ReturnType<typeof setInterval> | null = null

  const startTokenRefresh = () => {
    if (refreshInterval) {
      clearInterval(refreshInterval)
    }

    // Check token every 30 seconds
    refreshInterval = setInterval(async () => {
      const { tokenData, isAuthenticated } = get()
      if (!isAuthenticated || !tokenData?.refreshToken) {
        return
      }

      // Refresh if token expires within 60 seconds
      if (Date.now() > tokenData.tokenExpiry - API_CONFIG.tokenRefreshBuffer) {
        try {
          const result = await refreshAccessToken(tokenData.refreshToken)
          set({ tokenData: result.tokenData, user: result.user })
          workHubAPI.setTokenData(result.tokenData)
        } catch {
          // Session expired
          set({
            isAuthenticated: false,
            user: null,
            tokenData: null,
            error: 'Sessione scaduta',
          })
          workHubAPI.setTokenData(null)
          clearStoredAuth()
        }
      }
    }, 30000)
  }

  const stopTokenRefresh = () => {
    if (refreshInterval) {
      clearInterval(refreshInterval)
      refreshInterval = null
    }
  }

  return {
    isAuthenticated: false,
    isLoading: true,
    user: null,
    tokenData: null,
    error: null,

    login: async (username: string, password: string) => {
      set({ isLoading: true, error: null })
      try {
        const { tokenData, user } = await login(username, password)
        workHubAPI.setTokenData(tokenData)
        set({
          isAuthenticated: true,
          isLoading: false,
          user,
          tokenData,
          error: null,
        })
        startTokenRefresh()
      } catch (err) {
        set({
          isLoading: false,
          error: err instanceof Error ? err.message : 'Errore durante il login',
        })
        throw err
      }
    },

    logout: async () => {
      const { tokenData } = get()
      stopTokenRefresh()
      if (tokenData?.refreshToken) {
        await logout(tokenData.refreshToken)
      }
      workHubAPI.setTokenData(null)
      set({
        isAuthenticated: false,
        user: null,
        tokenData: null,
        error: null,
      })
    },

    initializeAuth: () => {
      const stored = getStoredAuth()
      if (stored) {
        const { tokenData, user } = stored
        // Check if token is still valid (or can be refreshed)
        if (Date.now() < tokenData.tokenExpiry + 30 * 60 * 1000) {
          // Token or refresh token still valid
          workHubAPI.setTokenData(tokenData)
          set({
            isAuthenticated: true,
            isLoading: false,
            user,
            tokenData,
          })
          startTokenRefresh()
          return
        }
      }
      set({ isLoading: false })
    },

    clearError: () => set({ error: null }),
  }
})
