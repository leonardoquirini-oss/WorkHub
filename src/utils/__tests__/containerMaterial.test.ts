import { describe, it, expect } from 'vitest'
import { isMultiGiacenza, materialLabel } from '../containerMaterial'
import type { ContainerProductInfo } from '../../types'

function info(overrides: Partial<ContainerProductInfo> = {}): ContainerProductInfo {
  return {
    product: 'Materiale test',
    id_material_type: 1,
    open_count: 1,
    id_site: 1,
    loading_date: '2026-09-01',
    ...overrides,
  }
}

describe('isMultiGiacenza', () => {
  it('e\' vero da due righe aperte in su', () => {
    expect(isMultiGiacenza(info({ open_count: 2 }))).toBe(true)
    expect(isMultiGiacenza(info({ open_count: 3 }))).toBe(true)
  })

  it('e\' falso con una sola riga o nessuna', () => {
    expect(isMultiGiacenza(info({ open_count: 1 }))).toBe(false)
    expect(isMultiGiacenza(info({ open_count: 0 }))).toBe(false)
  })

  it('e\' falso senza dato (nessuna riga aperta, cassa vuota)', () => {
    expect(isMultiGiacenza(null)).toBe(false)
    expect(isMultiGiacenza(undefined)).toBe(false)
  })
})

describe('materialLabel', () => {
  it('nessuna riga aperta: niente da scrivere', () => {
    expect(materialLabel(null)).toBeNull()
    expect(materialLabel(undefined)).toBeNull()
  })

  it('una riga aperta: mostra il materiale', () => {
    expect(materialLabel(info({ product: 'Rottame ferroso' }))).toBe('Rottame ferroso')
  })

  it('piu\' righe aperte: "Multi-Giacenza" vince sul nome del materiale', () => {
    expect(materialLabel(info({ open_count: 2, product: 'Rottame ferroso' }))).toBe('Multi-Giacenza')
  })
})
