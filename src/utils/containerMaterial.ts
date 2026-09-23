import type { ContainerProductInfo } from '../types'

/**
 * Piu' righe aperte (senza data di uscita) nel registro carico/scarico per la stessa cassa:
 * anomalia di inserimento, il backend la calcola e il client la segnala all'operatore.
 */
export function isMultiGiacenza(info: ContainerProductInfo | null | undefined): boolean {
  return (info?.open_count ?? 0) >= 2
}

/**
 * Testo da mostrare sotto al numero container: "Multi-Giacenza" se il registro ha piu' righe
 * aperte, il materiale dell'unica riga aperta, o `null` se non c'e' nessuna riga (cassa vuota).
 */
export function materialLabel(info: ContainerProductInfo | null | undefined): string | null {
  if (!info) return null
  if (isMultiGiacenza(info)) return 'Multi-Giacenza'
  return info.product ?? null
}
