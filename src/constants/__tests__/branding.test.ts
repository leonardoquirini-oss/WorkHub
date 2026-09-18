import { describe, it, expect } from 'vitest'
import { hasBrandLogo } from '../branding'

describe('hasBrandLogo', () => {
  it('matches the owned prefixes, whatever the case or padding', () => {
    expect(hasBrandLogo('GBTU 028123.5')).toBe(true)
    expect(hasBrandLogo('BRND 1234.5')).toBe(true)
    expect(hasBrandLogo('  gbtu 0281')).toBe(true)
    expect(hasBrandLogo('brnd0001')).toBe(true)
  })

  it('leaves other containers without a logo', () => {
    expect(hasBrandLogo('MSCU 1234567')).toBe(false)
    expect(hasBrandLogo('GBT 1234')).toBe(false)
    expect(hasBrandLogo('XGBTU 1234')).toBe(false)
    expect(hasBrandLogo('')).toBe(false)
    expect(hasBrandLogo(null)).toBe(false)
  })
})
