import { create } from 'zustand'
import { login, logout, getStoredAuth, clearStoredAuth } from '../api/authApi'
import { workHubAPI } from '../api/WorkHubAPI'
import { canWrite, isAdmin, canReadProduct } from '../constants/roles'
import { logger } from '../utils/logger'
import type { User, TokenData } from '../types'

interface AuthStore {
  isAuthenticated: boolean
  isLoading: boolean
  user: User | null
  tokenData: TokenData | null
  error: string | null
  /** Derived from the user's roles: may enter/move/edit/exit containers. */
  canWrite: boolean
  /** Derived from the user's roles: may manage yards and blocks. */
  isAdmin: boolean
  /** Derived from the user's roles: may see the material in giacenza (dato commerciale). */
  canReadProduct: boolean

  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  initializeAuth: () => Promise<void>
  clearError: () => void
}

function permissionsOf(user: User | null) {
  return {
    canWrite: canWrite(user?.roles),
    isAdmin: isAdmin(user?.roles),
    canReadProduct: canReadProduct(user?.roles),
  }
}

/**
 * Auth state. Token refresh is NOT scheduled here: the API client refreshes lazily on the
 * first request that finds the token close to expiry and reports back via session callbacks.
 */
export const useAuthStore = create<AuthStore>((set, get) => {
  const clearSession = (error: string | null) => {
    workHubAPI.setTokenData(null)
    clearStoredAuth()
    set({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      tokenData: null,
      error,
      ...permissionsOf(null),
    })
  }

  workHubAPI.setSessionCallbacks({
    onTokenRefreshed: (tokenData, user) => set({ tokenData, user, ...permissionsOf(user) }),
    onSessionExpired: (reason) => {
      if (get().isAuthenticated) {
        logger.warn('Sessione terminata:', reason)
        clearSession(reason)
      }
    },
  })

  return {
    isAuthenticated: false,
    isLoading: true,
    user: null,
    tokenData: null,
    error: null,
    canWrite: false,
    isAdmin: false,
    canReadProduct: false,

    login: async (username, password) => {
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
          ...permissionsOf(user),
        })
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
      if (tokenData?.refreshToken) {
        await logout(tokenData.refreshToken)
      }
      clearSession(null)
    },

    /**
     * Restores a persisted session. If the access token is stale the API client refreshes it
     * now, so the app never shows the yard with a dead session.
     */
    initializeAuth: async () => {
      const stored = getStoredAuth()
      if (!stored) {
        set({ isLoading: false })
        return
      }

      workHubAPI.setTokenData(stored.tokenData)
      try {
        await workHubAPI.ensureValidToken()
        const user = get().user ?? stored.user
        set({
          isAuthenticated: true,
          isLoading: false,
          user,
          tokenData: workHubAPI.getTokenData() ?? stored.tokenData,
          error: null,
          ...permissionsOf(user),
        })
      } catch (err) {
        logger.debug('Sessione salvata non ripristinabile', err)
        clearSession(null)
      }
    },

    clearError: () => set({ error: null }),
  }
})
