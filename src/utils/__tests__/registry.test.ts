import { describe, it, expect } from 'vitest'
import { typeFromRegistry } from '../registry'

describe('typeFromRegistry', () => {
  it('maps registry descriptions to ISO types', () => {
    expect(typeFromRegistry("20' BOX")).toBe('20')
    expect(typeFromRegistry("40' Standard")).toBe('40')
    expect(typeFromRegistry("40' High Cube")).toBe('40HC')
    expect(typeFromRegistry('40HC')).toBe('40HC')
    expect(typeFromRegistry("45' HC")).toBe('45HC')
    expect(typeFromRegistry('Cisterna')).toBeNull()
    expect(typeFromRegistry(undefined)).toBeNull()
  })
})
