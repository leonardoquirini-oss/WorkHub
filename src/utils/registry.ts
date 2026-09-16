import type { ContainerType } from '../types'

/** Guesses the ISO type from the registry description (e.g. "40' High Cube", "20 BOX"). */
export function typeFromRegistry(tipo: string | undefined | null): ContainerType | null {
  if (!tipo) return null
  if (tipo.includes('45')) return '45HC'
  if (/40\s*HC|high/i.test(tipo)) return '40HC'
  if (tipo.includes('40')) return '40'
  if (tipo.includes('30')) return '30'
  if (tipo.includes('20')) return '20'
  return null
}
