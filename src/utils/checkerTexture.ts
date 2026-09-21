import * as THREE from 'three'

/**
 * Scacchiera bianco/rosso per le casse marcate "da far uscire": texture procedurale come
 * `ribTexture`, nessun asset da caricare.
 *
 * La scacchiera e' l'unico segnale che si legge da lontano e a qualunque angolo di camera: il
 * colore di stato (damaged/maintenance) resta visibile nel pannello e nella lista.
 */

/** Lato del quadro (m): abbastanza grande da leggersi da lontano, abbastanza piccolo da non sembrare un errore di colore. */
export const CHECKER_SQUARE = 0.5
/** Rosso dei quadri (rosso segnaletico, non il rosso dello stato "danneggiato"). */
const CHECKER_RED: [number, number, number] = [204, 24, 30]
const CHECKER_WHITE: [number, number, number] = [250, 250, 250]

/** Pixel per quadro: 16 basta per bordi netti e mipmap che sfumano in rosa uniforme da lontano. */
const SQUARE_PX = 16
const SIZE_PX = SQUARE_PX * 2

let base: THREE.DataTexture | null = null

/** Due quadri per lato, creata una volta e clonata per ogni tipo di cassa. */
function checkerBase(): THREE.DataTexture {
  if (base) return base
  const data = new Uint8Array(SIZE_PX * SIZE_PX * 4)
  for (let y = 0; y < SIZE_PX; y++) {
    for (let x = 0; x < SIZE_PX; x++) {
      const red = Math.floor(x / SQUARE_PX) === Math.floor(y / SQUARE_PX)
      const [r, g, b] = red ? CHECKER_RED : CHECKER_WHITE
      data.set([r, g, b, 255], (y * SIZE_PX + x) * 4)
    }
  }
  base = new THREE.DataTexture(data, SIZE_PX, SIZE_PX)
  // La texture porta un colore, non dati: senza sRGB il rosso viene slavato.
  base.colorSpace = THREE.SRGBColorSpace
  base.needsUpdate = true
  return base
}

/**
 * Scacchiera con quadri di ~`CHECKER_SQUARE` metri sulla faccia `length` x `height`.
 * Il chiamante e' proprietario della texture restituita e deve chiamare `dispose()`.
 */
export function checkerTexture(length: number, height: number): THREE.Texture {
  const texture = checkerBase().clone()
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  // Il periodo della texture e' 2 quadri: ripetizioni arrotondate, cosi' i quadri restano quadri
  // e non si spezzano al bordo della faccia.
  texture.repeat.set(repeats(length), repeats(height))
  texture.generateMipmaps = true
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.needsUpdate = true
  return texture
}

function repeats(size: number): number {
  return Math.max(Math.round(size / (CHECKER_SQUARE * 2)), 1)
}
