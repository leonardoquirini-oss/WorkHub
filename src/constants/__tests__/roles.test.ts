import { describe, it, expect } from 'vitest'
import { canWrite, isAdmin, canReadProduct, hasAnyRole } from '../roles'

describe('roles', () => {
  it('grants write to cd, logs and resources only', () => {
    expect(canWrite(['cd'])).toBe(true)
    expect(canWrite(['logs'])).toBe(true)
    expect(canWrite(['resources'])).toBe(true)
    expect(canWrite(['read'])).toBe(false)
    expect(canWrite(['amst', 'coin'])).toBe(false)
    expect(canWrite([])).toBe(false)
    expect(canWrite(undefined)).toBe(false)
  })

  it('grants admin to cd only', () => {
    expect(isAdmin(['cd', 'logs'])).toBe(true)
    expect(isAdmin(['logs', 'resources'])).toBe(false)
  })

  it('grants product visibility to cd and logs only, not resources', () => {
    expect(canReadProduct(['cd'])).toBe(true)
    expect(canReadProduct(['logs'])).toBe(true)
    expect(canReadProduct(['resources'])).toBe(false)
    expect(canReadProduct(undefined)).toBe(false)
  })

  it('hasAnyRole matches any intersection', () => {
    expect(hasAnyRole(['a', 'b'], ['b', 'c'])).toBe(true)
    expect(hasAnyRole(['a'], ['b', 'c'])).toBe(false)
  })
})
