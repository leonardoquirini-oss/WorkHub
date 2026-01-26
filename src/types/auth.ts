export interface TokenData {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenExpiry: number
}

export interface User {
  username: string
  name?: string
  email?: string
  roles: string[]
}

export interface AuthState {
  isAuthenticated: boolean
  isLoading: boolean
  user: User | null
  tokenData: TokenData | null
  error: string | null
}

export interface LoginCredentials {
  username: string
  password: string
}

export interface KeycloakTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  refresh_expires_in: number
  token_type: string
  scope: string
}
