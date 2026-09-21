import type { Container } from '../types'

/**
 * Marchio "da far uscire": il container e' stato scaricato in RCS (merce non piu' in giacenza) ma
 * la cassa e' ancora sul piazzale. Il backend lo calcola dall'ultima riga del registro
 * carico/scarico e lo porta sul container come riferimento a quella riga.
 */
export function isMarkedForExit(c: Pick<Container, 'id_exit_availability'>): boolean {
  return c.id_exit_availability != null
}

/**
 * Giorni di attesa dalla data di uscita della merce (non dal momento della marcatura: dopo un
 * riallineamento del registro la marcatura e' di oggi, l'uscita puo' essere di mesi prima).
 * `null` se la data manca o non e' leggibile; 0 il giorno stesso, mai negativo.
 */
export function daysWaiting(
  c: Pick<Container, 'exit_off_date'>,
  now: Date = new Date()
): number | null {
  if (!c.exit_off_date) return null
  const exit = new Date(`${c.exit_off_date}T00:00:00`)
  if (Number.isNaN(exit.getTime())) return null
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const days = Math.floor((today.getTime() - exit.getTime()) / 86_400_000)
  return Math.max(days, 0)
}

/** Riferimento RCS da mostrare all'operatore: DDT e data di uscita, quello che c'e'. */
export function exitReference(c: Pick<Container, 'exit_ddt_number' | 'exit_off_date'>): string {
  const parts: string[] = []
  if (c.exit_ddt_number) parts.push(`DDT ${c.exit_ddt_number}`)
  if (c.exit_off_date) parts.push(formatDate(c.exit_off_date))
  return parts.join(' · ')
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}
