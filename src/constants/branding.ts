import tbLogo from '../assets/tb-logo.png'

/**
 * Logo aziendale disegnato accanto al numero dei container di proprieta'.
 * L'asset deriva da `tb.png` (logo su fondo bianco): fondo reso trasparente, tratto ricolorato
 * in blu scuro #1D3263 e immagine ritagliata al monogramma.
 */
export const BRAND_LOGO_URL = tbLogo

/** Larghezza / altezza dell'immagine del logo (256 × 227 px). */
export const BRAND_LOGO_ASPECT = 256 / 227

/** Prefissi dei numeri container che portano il logo. */
export const BRAND_LOGO_PREFIXES = ['GBTU', 'BRND']

/** true se il numero container appartiene a una delle sigle di proprieta'. */
export function hasBrandLogo(containerNumber: string | null | undefined): boolean {
  if (!containerNumber) return false
  const number = containerNumber.trim().toUpperCase()
  return BRAND_LOGO_PREFIXES.some((prefix) => number.startsWith(prefix))
}
