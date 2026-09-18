import * as THREE from 'three'

/**
 * Costolatura verticale delle pareti container: una texture procedurale che modula il colore
 * della cassa e la sua ombreggiatura, senza aggiungere geometria.
 *
 * La striscia contiene UN periodo di corrugazione e viene ripetuta lungo la faccia, cosi' il
 * passo resta costante al variare della lunghezza del container. E' uniforme in verticale:
 * da lontano i mipmap la sfumano in un grigio piatto, senza moire'.
 */

/** Passo (m) delle costole, misurato sulla foto di riferimento `ctr.png`. */
export const RIB_PITCH = 0.25
/** Profondita' apparente delle costole (solo bump, nessun rilievo reale). */
export const RIB_BUMP_SCALE = 0.05
/** Luminosita' della valle rispetto alla cresta: piu' vicino a 1 = costole piu' tenui. */
const RIB_MIN_SHADE = 0.9

const STRIP_WIDTH = 64

let strip: THREE.DataTexture | null = null

/** Un periodo di corrugazione in scala di grigi, creato una volta e condiviso. */
function ribStrip(): THREE.DataTexture {
  if (strip) return strip
  const data = new Uint8Array(STRIP_WIDTH * 4)
  for (let i = 0; i < STRIP_WIDTH; i++) {
    // cresta in u=0, valle in u=0.5
    const crest = 0.5 + 0.5 * Math.cos((2 * Math.PI * i) / STRIP_WIDTH)
    const shade = Math.round(255 * (RIB_MIN_SHADE + (1 - RIB_MIN_SHADE) * crest))
    data.set([shade, shade, shade, 255], i * 4)
  }
  strip = new THREE.DataTexture(data, STRIP_WIDTH, 1)
  strip.needsUpdate = true
  return strip
}

/**
 * Texture con una costola ogni `RIB_PITCH` metri sulla faccia lunga `length`.
 * Il chiamante e' proprietario della texture restituita e deve chiamare `dispose()`.
 */
export function ribTexture(length: number): THREE.Texture {
  const texture = ribStrip().clone()
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.repeat.set(Math.max(Math.round(length / RIB_PITCH), 1), 1)
  texture.generateMipmaps = true
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.needsUpdate = true
  return texture
}
