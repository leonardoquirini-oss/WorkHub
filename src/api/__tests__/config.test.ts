import { describe, it, expect } from 'vitest'
import { buildApiConfig } from '../config'

describe('buildApiConfig', () => {
  it('uses built-in defaults when nothing is configured', () => {
    const cfg = buildApiConfig({}, {})
    expect(cfg.keycloakUrl).toBe('http://localhost:8080')
    expect(cfg.realm).toBe('gb-realm')
    expect(cfg.clientId).toBe('berlink-client')
    expect(cfg.apiUrl).toBe('/api')
    expect(cfg.defaultSiteId).toBe(1)
  })

  it('prefers build-time env over defaults', () => {
    const cfg = buildApiConfig({}, { VITE_KEYCLOAK_URL: 'http://kc.build:8080', VITE_DEFAULT_SITE_ID: '7' })
    expect(cfg.keycloakUrl).toBe('http://kc.build:8080')
    expect(cfg.defaultSiteId).toBe(7)
  })

  it('prefers runtime config over build-time env and ignores empty runtime values', () => {
    const cfg = buildApiConfig(
      { KEYCLOAK_URL: 'http://kc.runtime:8080', API_URL: '   ', DEFAULT_SITE_ID: '' },
      { VITE_KEYCLOAK_URL: 'http://kc.build:8080', VITE_API_URL: '/backend/api', VITE_DEFAULT_SITE_ID: '3' }
    )
    expect(cfg.keycloakUrl).toBe('http://kc.runtime:8080')
    expect(cfg.apiUrl).toBe('/backend/api')
    expect(cfg.defaultSiteId).toBe(3)
  })
})
