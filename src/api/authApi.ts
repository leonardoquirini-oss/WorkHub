import { API_CONFIG, STORAGE_KEYS } from './config'
import type { KeycloakTokenResponse, TokenData, User } from '../types'

/** Decodes the payload of a JWT without verifying it. Returns `{}` on malformed input. */
export function parseJwt(token: string): Record<string, unknown> {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch {
    return {}
  }
}

/**
 * Builds the app user from the access token.
 * BERLink assigns roles as Keycloak *client* roles (`resource_access.<clientId>.roles`);
 * realm roles are merged in for completeness.
 */
export function extractUserFromToken(accessToken: string, clientId = API_CONFIG.clientId): User {
  const payload = parseJwt(accessToken)
  const realmAccess = (payload.realm_access as { roles?: string[] } | undefined) ?? {}
  const resourceAccess =
    (payload.resource_access as Record<string, { roles?: string[] }> | undefined) ?? {}
  const clientRoles = resourceAccess[clientId]?.roles ?? []
  const roles = Array.from(new Set([...clientRoles, ...(realmAccess.roles ?? [])]))

  return {
    username: (payload.preferred_username as string) || '',
    name: (payload.name as string) || (payload.preferred_username as string) || '',
    email: (payload.email as string) || undefined,
    roles,
  }
}

function tokenEndpoint(): string {
  return `${API_CONFIG.keycloakUrl}/realms/${API_CONFIG.realm}/protocol/openid-connect/token`
}

/** Converts a Keycloak token response into TokenData + User and persists it. */
function persistSession(data: KeycloakTokenResponse): { tokenData: TokenData; user: User } {
  const tokenExpiry = Date.now() + data.expires_in * 1000
  const tokenData: TokenData = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    tokenExpiry,
  }
  const user = extractUserFromToken(data.access_token)

  localStorage.setItem(STORAGE_KEYS.accessToken, tokenData.accessToken)
  localStorage.setItem(STORAGE_KEYS.refreshToken, tokenData.refreshToken)
  localStorage.setItem(STORAGE_KEYS.tokenExpiry, tokenExpiry.toString())
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user))

  return { tokenData, user }
}

export async function login(username: string, password: string): Promise<{ tokenData: TokenData; user: User }> {
  const response = await fetch(tokenEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: API_CONFIG.clientId,
      username,
      password,
    }),
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Username o password non corretti')
    }
    throw new Error('Errore durante il login')
  }

  return persistSession((await response.json()) as KeycloakTokenResponse)
}

export async function refreshAccessToken(refreshToken: string): Promise<{ tokenData: TokenData; user: User }> {
  const response = await fetch(tokenEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: API_CONFIG.clientId,
      refresh_token: refreshToken,
    }),
  })

  if (!response.ok) {
    clearStoredAuth()
    throw new Error('Sessione scaduta, effettuare nuovo login')
  }

  return persistSession((await response.json()) as KeycloakTokenResponse)
}

export async function logout(refreshToken: string): Promise<void> {
  const url = `${API_CONFIG.keycloakUrl}/realms/${API_CONFIG.realm}/protocol/openid-connect/logout`

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: API_CONFIG.clientId,
        refresh_token: refreshToken,
      }),
    })
  } catch {
    // Keycloak unreachable: local session is cleared anyway
  }

  clearStoredAuth()
}

export function clearStoredAuth(): void {
  localStorage.removeItem(STORAGE_KEYS.accessToken)
  localStorage.removeItem(STORAGE_KEYS.refreshToken)
  localStorage.removeItem(STORAGE_KEYS.tokenExpiry)
  localStorage.removeItem(STORAGE_KEYS.user)
}

export function getStoredAuth(): { tokenData: TokenData; user: User } | null {
  const accessToken = localStorage.getItem(STORAGE_KEYS.accessToken)
  const refreshToken = localStorage.getItem(STORAGE_KEYS.refreshToken)
  const tokenExpiry = localStorage.getItem(STORAGE_KEYS.tokenExpiry)
  const userJson = localStorage.getItem(STORAGE_KEYS.user)

  if (!accessToken || !refreshToken || !tokenExpiry || !userJson) {
    return null
  }

  try {
    const user = JSON.parse(userJson) as User
    const tokenData: TokenData = {
      accessToken,
      refreshToken,
      expiresIn: 0,
      tokenExpiry: parseInt(tokenExpiry, 10),
    }
    return { tokenData, user }
  } catch {
    clearStoredAuth()
    return null
  }
}
