import { CONTAINER_STATUS_COLORS } from '../constants/containerSizes'
import { DEFAULT_CONTAINER_COLOR, SELECTED_CONTAINER_COLOR } from '../constants/yardConfig'
import { isMarkedForExit } from './exitMark'
import type { Container } from '../types'

/** Bianco: la texture a scacchi delle casse in uscita va moltiplicata per un colore neutro. */
export const MARKED_CONTAINER_COLOR = '#ffffff'

/** Colore della cassa in 3D: selezione, poi marchio d'uscita, poi stato, poi colore proprio. */
export function colorOf(c: Container, selected: boolean): string {
  if (selected) return SELECTED_CONTAINER_COLOR
  // La scacchiera di chi e' in uscita e' una `map`: moltiplica instanceColor, che quindi resta
  // bianco (il colore di stato resta leggibile nel pannello e nella lista).
  if (isMarkedForExit(c)) return MARKED_CONTAINER_COLOR
  if (c.status !== 'active') return CONTAINER_STATUS_COLORS[c.status] ?? DEFAULT_CONTAINER_COLOR
  return c.color || DEFAULT_CONTAINER_COLOR
}
