import * as THREE from 'three'
import { ART_SIZE, drawSlice, drawWhole } from './fruitArt.js'

/**
 * The fruit field's textures: two per flavor, one whole fruit and one cut slice,
 * at 128 px square.
 *
 * Deliberately small. This is out-of-focus background fruit, so the texture is
 * drawn to survive being scaled up and softened by the shader rather than to
 * bear close inspection. Four flavors x two views is eight textures, drawn once
 * on a flavor's first render and disposed when that field goes away.
 *
 * The drawing itself is in `fruitArt.js`, with no imports at all, so the
 * per-flavor artwork can be driven and asserted without a renderer. This module
 * is only the canvas and the texture — and the sheet override below.
 */

/**
 * `public/backdrops/fruits/<flavor>.webp`, if it is there, wins over the
 * drawing. Resolved by Vite at build time rather than probed at runtime, so an
 * absent folder costs no request — and, more to the point, no 404 in the
 * console, which is a stated condition of done.
 *
 * A sheet is read as two columns: the whole fruit on the left, a cut slice on
 * the right. A single flat texture would put the whole sheet on every plane,
 * which is not what a cutout sheet is for.
 */
const SHEETS = import.meta.glob('../../public/backdrops/fruits/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
})

function paint(flavor, view) {
  const canvas = document.createElement('canvas')
  canvas.width = ART_SIZE
  canvas.height = ART_SIZE

  const ctx = canvas.getContext('2d')
  if (view === 'whole') drawWhole(ctx, flavor.fruit)
  else drawSlice(ctx, flavor.fruit)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

/** The two halves of a cutout sheet, sharing one upload of the image. */
function sheetTextures(url) {
  const halves = []
  const sheet = new THREE.TextureLoader().load(url, () => {
    // The clones were made before the image arrived, so they have never been
    // uploaded; the sheet's own load is what hands them their pixels.
    for (const half of halves) half.needsUpdate = true
  })

  for (let column = 0; column < 2; column++) {
    const half = sheet.clone()
    half.colorSpace = THREE.SRGBColorSpace
    half.wrapS = THREE.ClampToEdgeWrapping
    half.offset.set(column * 0.5, 0)
    half.repeat.set(0.5, 1)
    halves.push(half)
  }

  return {
    whole: halves[0],
    slice: halves[1],
    source: 'sheet',
    dispose() {
      halves[0].dispose()
      halves[1].dispose()
      sheet.dispose()
    },
  }
}

/**
 * @param {object} flavor  One entry from config/flavors.js.
 * @returns {{ whole: THREE.Texture, slice: THREE.Texture, source: string,
 *             dispose: () => void }}
 */
export function buildFruitTextures(flavor) {
  const key = Object.keys(SHEETS).find((path) =>
    path.endsWith(`/${flavor.id}.webp`),
  )
  if (key) return sheetTextures(SHEETS[key])

  const whole = paint(flavor, 'whole')
  const slice = paint(flavor, 'slice')

  return {
    whole,
    slice,
    source: 'canvas',
    dispose() {
      whole.dispose()
      slice.dispose()
    },
  }
}
