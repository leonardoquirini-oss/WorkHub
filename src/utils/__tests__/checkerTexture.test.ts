import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { CHECKER_SQUARE, checkerTexture } from '../checkerTexture'

describe('checkerTexture', () => {
  it('ripete i quadri sulla faccia, uno ogni CHECKER_SQUARE metri', () => {
    const texture = checkerTexture(12, 2.6)
    // il periodo della texture e' 2 quadri: 12 m / 1 m = 12 ripetizioni
    expect(texture.repeat.x).toBe(Math.round(12 / (CHECKER_SQUARE * 2)))
    expect(texture.repeat.y).toBe(Math.round(2.6 / (CHECKER_SQUARE * 2)))
    texture.dispose()
  })

  it('non scende sotto una ripetizione su facce piccole', () => {
    const texture = checkerTexture(0.2, 0.2)
    expect(texture.repeat.x).toBe(1)
    expect(texture.repeat.y).toBe(1)
    texture.dispose()
  })

  it('e\' in sRGB e si ripete su entrambi gli assi', () => {
    const texture = checkerTexture(12, 2.6)
    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace)
    expect(texture.wrapS).toBe(THREE.RepeatWrapping)
    expect(texture.wrapT).toBe(THREE.RepeatWrapping)
    texture.dispose()
  })

  it('ogni chiamata restituisce una texture indipendente (repeat diverso per tipo)', () => {
    const short = checkerTexture(6.1, 2.6)
    const long = checkerTexture(12.2, 2.6)
    expect(short.repeat.x).not.toBe(long.repeat.x)
    short.dispose()
    long.dispose()
  })
})
