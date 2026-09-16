import { describe, it, expect } from 'vitest'
import { parseJwt, extractUserFromToken } from '../authApi'

function b64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function makeJwt(payload: Record<string, unknown>): string {
  return `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url(payload)}.signature`
}

describe('parseJwt', () => {
  it('decodes the payload of a well-formed token', () => {
    const token = makeJwt({ sub: '123', preferred_username: 'mario' })
    expect(parseJwt(token)).toEqual({ sub: '123', preferred_username: 'mario' })
  })

  it('returns an empty object on malformed input', () => {
    expect(parseJwt('not-a-jwt')).toEqual({})
    expect(parseJwt('')).toEqual({})
  })
})

describe('extractUserFromToken', () => {
  it('reads BERLink client roles from resource_access and merges realm roles', () => {
    const token = makeJwt({
      preferred_username: 'piazzalista',
      name: 'Mario Rossi',
      email: 'm.rossi@example.com',
      realm_access: { roles: ['offline_access', 'logs'] },
      resource_access: { 'berlink-client': { roles: ['logs', 'resources'] } },
    })

    const user = extractUserFromToken(token, 'berlink-client')

    expect(user.username).toBe('piazzalista')
    expect(user.name).toBe('Mario Rossi')
    expect(user.email).toBe('m.rossi@example.com')
    expect(user.roles).toEqual(['logs', 'resources', 'offline_access'])
  })

  it('falls back to the username when name is missing and to no roles when claims are absent', () => {
    const user = extractUserFromToken(makeJwt({ preferred_username: 'anon' }), 'berlink-client')
    expect(user.name).toBe('anon')
    expect(user.roles).toEqual([])
    expect(user.email).toBeUndefined()
  })
})
