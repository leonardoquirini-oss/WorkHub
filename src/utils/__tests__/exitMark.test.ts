import { describe, it, expect } from 'vitest'
import { daysWaiting, exitReference, isMarkedForExit } from '../exitMark'

describe('isMarkedForExit', () => {
  it('guarda il riferimento alla riga di registro, non il DDT', () => {
    expect(isMarkedForExit({ id_exit_availability: 4211 })).toBe(true)
    expect(isMarkedForExit({ id_exit_availability: null })).toBe(false)
    expect(isMarkedForExit({ id_exit_availability: undefined })).toBe(false)
    expect(isMarkedForExit({})).toBe(false)
  })

  it('id 0 e\' un riferimento valido (nessuna sequenza parte da 0, ma 0 non e\' "assente")', () => {
    expect(isMarkedForExit({ id_exit_availability: 0 })).toBe(true)
  })
})

describe('daysWaiting', () => {
  const now = new Date(2026, 8, 21) // 21 settembre 2026, ora locale

  it('conta i giorni dalla data di uscita della merce', () => {
    expect(daysWaiting({ exit_off_date: '2026-09-21' }, now)).toBe(0)
    expect(daysWaiting({ exit_off_date: '2026-09-20' }, now)).toBe(1)
    expect(daysWaiting({ exit_off_date: '2026-03-05' }, now)).toBe(199)
  })

  it('una data futura non da\' mai giorni negativi', () => {
    expect(daysWaiting({ exit_off_date: '2026-10-01' }, now)).toBe(0)
  })

  it('senza data o con data illeggibile torna null', () => {
    expect(daysWaiting({ exit_off_date: null }, now)).toBeNull()
    expect(daysWaiting({ exit_off_date: undefined }, now)).toBeNull()
    expect(daysWaiting({ exit_off_date: 'non-una-data' }, now)).toBeNull()
  })

  it('non e\' influenzata dall\'ora del giorno corrente', () => {
    const lateEvening = new Date(2026, 8, 21, 23, 59)
    expect(daysWaiting({ exit_off_date: '2026-09-20' }, lateEvening)).toBe(1)
  })
})

describe('exitReference', () => {
  it('mostra DDT e data in formato italiano', () => {
    expect(exitReference({ exit_ddt_number: 'DDT/2026/123', exit_off_date: '2026-09-20' }))
      .toBe('DDT DDT/2026/123 · 20/09/2026')
  })

  it('mostra quello che c\'e\'', () => {
    expect(exitReference({ exit_ddt_number: 'A1', exit_off_date: null })).toBe('DDT A1')
    expect(exitReference({ exit_ddt_number: null, exit_off_date: '2026-09-20' })).toBe('20/09/2026')
    expect(exitReference({ exit_ddt_number: null, exit_off_date: null })).toBe('')
  })
})
