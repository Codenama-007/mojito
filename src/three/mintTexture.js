import * as THREE from 'three'
import { mint } from '../config/flavors.js'
import { quality } from '../config/performance.js'

/**
 * The mint leaf's veins, drawn into a canvas instead of downloaded.
 *
 * AGENTS.md section 5 caps the total asset weight, and Phase 7 has so far spent
 * nothing on art — the cup, the lid, the straw and the four fruits are all code.
 * A 40 KB PNG of a single leaf would be the heaviest thing in the scene after
 * the environment map, for a texture that is nine strokes.
 *
 * UV runs 0 at the stem to 1 at the tip (leafGeometry.js normalises it), and
 * `CanvasTexture` flips Y on upload, so the canvas's *bottom* row is the stem.
 * Which is why the gradient below is built from `size` up to 0.
 */

/** Darker than either end of the leaf, and greener than black would be. */
const VEIN_COLOR = '#20451A'

/** Four pairs, thinner and shorter as they climb towards the tip. */
const VEIN_PAIRS = 4

export function createMintLeafTexture() {
  const size = quality.mintTextureSize
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const ctx = canvas.getContext('2d')
  const half = size / 2

  // Body: darker at the stem, lighter at the tip — the same gradient the
  // strawberry's crown gets from its vertex colours, so the two leaves match.
  const body = ctx.createLinearGradient(0, size, 0, 0)
  body.addColorStop(0, mint.stemColor)
  body.addColorStop(1, mint.tipColor)
  ctx.fillStyle = body
  ctx.fillRect(0, 0, size, size)

  ctx.lineCap = 'round'
  ctx.strokeStyle = VEIN_COLOR

  // Midrib, from the stem almost to the tip.
  ctx.lineWidth = size * 0.035
  ctx.beginPath()
  ctx.moveTo(half, size * 0.98)
  ctx.lineTo(half, size * 0.09)
  ctx.stroke()

  for (let i = 0; i < VEIN_PAIRS; i++) {
    const from = size * (0.82 - i * 0.16)
    const to = from - size * 0.19
    const spread = size * (0.36 - i * 0.055)

    ctx.lineWidth = size * (0.028 - i * 0.004)

    for (const direction of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(half, from)
      ctx.lineTo(half + direction * spread, to)
      ctx.stroke()
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  // The leaves are small on screen and mostly seen at an angle, so a little
  // anisotropy is worth more here than it would be on a large texture.
  texture.anisotropy = 2
  return texture
}
