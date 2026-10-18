/**
 * The fruit field's artwork, drawn in code (AGENTS.md section 4, rule 3).
 *
 * Deliberately separate from `fruitTextures.js`, which owns the canvas and the
 * `THREE.CanvasTexture`. Everything here is plain canvas 2D with no imports at
 * all, which is what lets `scripts/verify-fruit-field.mjs` drive it with a stub
 * context and check the four flavors really do draw four different fruits.
 *
 * ## Recognisability is the whole job
 *
 * These are out-of-focus background fruit at 25–55% opacity, sitting on a base
 * colour that is a shade of *their own flavor*. Lime on lime-green, mango on
 * mango-orange: colour alone cannot separate a fruit from its backdrop, and the
 * first version of this field leaned on colour alone, which is why three of the
 * four flavors read as empty. So every fruit now carries two things that do not
 * depend on hue at all:
 *
 *  - **A silhouette of its own.** A squashed disc for the lime, a dipped
 *    two-lobed apple, a narrow-topped mango, a wedge for the strawberry. Shape
 *    survives being blurred; colour does not.
 *  - **A dark rim, and a soft dark halo behind it.** A deep shade of the fruit's
 *    own skin, so it is still the right color, but dark enough to cut a line
 *    against a background of any brightness. This is what makes the fruit read
 *    as *in front of* the base rather than as a stain in it.
 *
 * Every color comes off the flavor's `fruit` block in config/flavors.js, so the
 * background fruit and the slice in the drink can never drift apart.
 */

/** The canvas every fruit is drawn into. 128px: enough to survive being scaled. */
export const ART_SIZE = 128

const TAU = Math.PI * 2

/** Every flavor's `fruit.kind`, and the four the switch below has to handle. */
export const FRUIT_KINDS = ['lime', 'strawberry', 'apple', 'mango']

/** The kinds drawn as a wheel of segments rather than as a cut face. */
const SEGMENTED = ['lime', 'mango']

/** Segment walls per kind. A mango is a chunk, not a citrus wheel. */
const SEGMENTS = { lime: 8, mango: 5 }

/**
 * The halo behind every fruit. Deep green-black rather than pure black, so it
 * reads as shade in a summer scene rather than as a cut-out, and strong enough
 * that a mango on a mango-orange backdrop still has an edge.
 */
const HALO_COLOR = 'rgba(16, 26, 12, 0.5)'

/** Darkens a `#rrggbb` string. Negative keeps the hue and takes the light out. */
export function shade(hex, amount) {
  const value = Number.parseInt(hex.slice(1), 16)
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255]

  return `rgb(${channels
    .map((channel) =>
      Math.round(
        amount < 0 ? channel * (1 + amount) : channel + (255 - channel) * amount,
      ),
    )
    .join(', ')})`
}

/** The soft dark halo, on for the skin fill and off again immediately after. */
function halo(ctx, size) {
  ctx.shadowColor = HALO_COLOR
  ctx.shadowBlur = size * 0.09
}

function noHalo(ctx) {
  ctx.shadowColor = 'rgba(0, 0, 0, 0)'
  ctx.shadowBlur = 0
}

/**
 * One fruit's outline, in a local space centred on the origin.
 *
 * The beziers are all held inside 1.18 x `radius`, so that a `radius` of
 * 0.4 x the canvas plus the rim stroke still fits inside the canvas. The
 * strawberry used to overflow its canvas and get clipped.
 */
function silhouette(ctx, radius, kind) {
  ctx.beginPath()

  if (kind === 'strawberry') {
    // A wedge: shoulders wide, tapering to a point. The only fruit here with a
    // point, which is what makes it unmistakable at a glance.
    ctx.moveTo(0, radius * 1.16)
    ctx.bezierCurveTo(
      -radius * 1.14,
      radius * 0.3,
      -radius * 0.94,
      -radius * 0.94,
      0,
      -radius * 0.82,
    )
    ctx.bezierCurveTo(
      radius * 0.94,
      -radius * 0.94,
      radius * 1.14,
      radius * 0.3,
      0,
      radius * 1.16,
    )
    ctx.closePath()
    return
  }

  if (kind === 'apple') {
    // Two lobes meeting at a dip, narrowing towards the base.
    ctx.moveTo(0, -radius * 0.74)
    ctx.bezierCurveTo(
      -radius * 0.55,
      -radius * 1.16,
      -radius * 1.14,
      -radius * 0.7,
      -radius * 1.0,
      radius * 0.14,
    )
    ctx.bezierCurveTo(
      -radius * 0.88,
      radius * 0.92,
      -radius * 0.3,
      radius * 1.1,
      0,
      radius * 0.98,
    )
    ctx.bezierCurveTo(
      radius * 0.3,
      radius * 1.1,
      radius * 0.88,
      radius * 0.92,
      radius * 1.0,
      radius * 0.14,
    )
    ctx.bezierCurveTo(
      radius * 1.14,
      -radius * 0.7,
      radius * 0.55,
      -radius * 1.16,
      0,
      -radius * 0.74,
    )
    ctx.closePath()
    return
  }

  if (kind === 'mango') {
    // Narrow at the top, heavy at the base — an egg on its side of the line
    // between a disc and a teardrop.
    ctx.moveTo(0, -radius * 1.06)
    ctx.bezierCurveTo(
      radius * 0.84,
      -radius * 0.96,
      radius * 0.98,
      -radius * 0.04,
      radius * 0.6,
      radius * 0.78,
    )
    ctx.bezierCurveTo(
      radius * 0.32,
      radius * 1.18,
      -radius * 0.32,
      radius * 1.18,
      -radius * 0.6,
      radius * 0.78,
    )
    ctx.bezierCurveTo(
      -radius * 0.98,
      -radius * 0.04,
      -radius * 0.84,
      -radius * 0.96,
      0,
      -radius * 1.06,
    )
    ctx.closePath()
    return
  }

  // Lime, and the fallback: a disc, very slightly wider than it is tall.
  ctx.ellipse(0, 0, radius * 1.04, radius * 0.96, 0, 0, TAU)
  ctx.closePath()
}

/**
 * What sits on top of the whole fruit: a nub, a stalk, a stalk and a leaf, or a
 * strawberry's fan of calyx leaves.
 *
 * @param {string} color The flavor's own `whole.detail`.
 * @param {string} [accent] `whole.skinAlt`, for the apple's leaf.
 */
function crown(ctx, radius, kind, color, accent) {
  if (kind === 'strawberry') {
    ctx.fillStyle = color
    for (const angle of [-0.95, 0, 0.95]) {
      ctx.save()
      ctx.translate(0, -radius * 0.86)
      ctx.rotate(angle)
      ctx.beginPath()
      ctx.ellipse(0, -radius * 0.18, radius * 0.14, radius * 0.28, 0, 0, TAU)
      ctx.fill()
      ctx.restore()
    }
    return
  }

  if (kind === 'apple') {
    // Stalk, then a leaf off it. The leaf is the one green in the apple's
    // palette and is what stops a red apple reading as a cherry.
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.ellipse(0, -radius * 1.04, radius * 0.075, radius * 0.22, 0, 0, TAU)
    ctx.fill()

    ctx.fillStyle = accent ?? color
    ctx.beginPath()
    ctx.ellipse(radius * 0.34, -radius * 1.06, radius * 0.32, radius * 0.15, -0.5, 0, TAU)
    ctx.fill()
    return
  }

  if (kind === 'mango') {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.ellipse(0, -radius * 1.0, radius * 0.07, radius * 0.18, 0, 0, TAU)
    ctx.fill()
    return
  }

  // Lime: the small pale nub where the fruit met the branch.
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(0, -radius * 0.94, radius * 0.16, radius * 0.11, 0, 0, TAU)
  ctx.fill()
}

/**
 * The whole fruit: skin, shading, rim, highlight, crown.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} fruit  A flavor's `fruit` block.
 * @param {number} [size]
 */
export function drawWhole(ctx, fruit, size = ART_SIZE) {
  const { skin, skinAlt, detail } = fruit.whole
  // 0.4 rather than 0.42: the widest bezier reaches 1.16 x radius, and the rim
  // stroke adds half its width outside that. 0.42 clipped the strawberry.
  const radius = size * 0.4

  ctx.save()
  ctx.translate(size / 2, size / 2)

  silhouette(ctx, radius, fruit.kind)

  // Skin, lit from the upper left and falling away towards the lower right. One
  // radial gradient does the shading; the highlight below does the rest.
  const skinGradient = ctx.createRadialGradient(
    -radius * 0.34,
    -radius * 0.4,
    radius * 0.08,
    0,
    0,
    radius * 1.28,
  )
  skinGradient.addColorStop(0, skinAlt)
  skinGradient.addColorStop(0.62, skin)
  skinGradient.addColorStop(1, shade(skin, -0.3))

  halo(ctx, size)
  ctx.fillStyle = skinGradient
  ctx.fill()
  noHalo(ctx)

  // The rim. Dark enough to cut a line against a backdrop of the same hue —
  // this is the single thing that makes the field read on every flavor rather
  // than only on the two whose fruit contrasts with their own base.
  ctx.lineWidth = size * 0.05
  ctx.lineJoin = 'round'
  ctx.strokeStyle = shade(skin, -0.58)
  ctx.globalAlpha = 0.8
  ctx.stroke()
  ctx.globalAlpha = 1

  ctx.beginPath()
  ctx.ellipse(
    -radius * 0.36,
    -radius * 0.44,
    radius * 0.3,
    radius * 0.17,
    -0.55,
    0,
    TAU,
  )
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
  ctx.fill()

  if (detail) crown(ctx, radius, fruit.kind, detail, skinAlt)

  ctx.restore()
}

/** The apple's core and pips, or a strawberry's seeds. Neither has segments. */
function cutFace(ctx, fruit, radius, size) {
  if (fruit.kind === 'apple') {
    ctx.strokeStyle = fruit.inner
    ctx.lineWidth = size * 0.03
    ctx.beginPath()
    ctx.arc(0, 0, radius * 0.36, 0, TAU)
    ctx.stroke()

    ctx.fillStyle = fruit.seed
    for (const at of [-0.16, 0.16]) {
      ctx.beginPath()
      ctx.ellipse(at * radius, -radius * 0.06, radius * 0.055, radius * 0.085, at, 0, TAU)
      ctx.fill()
    }
    return
  }

  // A strawberry: soft flesh, a lighter heart, and seeds scattered over it.
  ctx.beginPath()
  ctx.arc(0, 0, radius * 0.42, 0, TAU)
  ctx.fillStyle = shade(fruit.inner, 0.24)
  ctx.fill()

  ctx.fillStyle = fruit.seed
  for (let index = 0; index < 12; index++) {
    const angle = (index / 12) * TAU + 0.4
    const distance = radius * (0.5 + (index % 3) * 0.11)
    ctx.beginPath()
    ctx.ellipse(
      Math.cos(angle) * distance,
      Math.sin(angle) * distance,
      radius * 0.045,
      radius * 0.032,
      angle,
      0,
      TAU,
    )
    ctx.fill()
  }
}

const drawWheel = (ctx, fruit, radius, size) => {
  const segments = SEGMENTS[fruit.kind] ?? 8

  ctx.strokeStyle = fruit.inner
  ctx.lineWidth = size * 0.028
  ctx.beginPath()
  ctx.arc(0, 0, radius * 0.74, 0, TAU)
  ctx.stroke()

  for (let index = 0; index < segments; index++) {
    const angle = (index / segments) * TAU + Math.PI * 0.12
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(Math.cos(angle) * radius * 0.74, Math.sin(angle) * radius * 0.74)
    ctx.stroke()
  }

  ctx.fillStyle = fruit.seed
  for (let index = 0; index < segments; index++) {
    const angle = ((index + 0.5) / segments) * TAU + Math.PI * 0.12
    ctx.beginPath()
    ctx.ellipse(
      Math.cos(angle) * radius * 0.5,
      Math.sin(angle) * radius * 0.5,
      radius * 0.055,
      radius * 0.04,
      angle,
      0,
      TAU,
    )
    ctx.fill()
  }
}

/**
 * The cut fruit: a rind ring, a lit face, then whatever that fruit has inside.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} fruit  A flavor's `fruit` block.
 * @param {number} [size]
 */
export function drawSlice(ctx, fruit, size = ART_SIZE) {
  const { flesh, rind } = fruit
  const radius = size * 0.43

  ctx.save()
  ctx.translate(size / 2, size / 2)

  halo(ctx, size)
  ctx.beginPath()
  ctx.arc(0, 0, radius, 0, TAU)
  ctx.fillStyle = rind
  ctx.fill()
  noHalo(ctx)

  const faceGradient = ctx.createRadialGradient(
    -radius * 0.3,
    -radius * 0.34,
    radius * 0.08,
    0,
    0,
    radius * 0.9,
  )
  faceGradient.addColorStop(0, shade(flesh, 0.22))
  faceGradient.addColorStop(1, flesh)

  ctx.beginPath()
  ctx.arc(0, 0, radius * 0.88, 0, TAU)
  ctx.fillStyle = faceGradient
  ctx.fill()

  if (SEGMENTED.includes(fruit.kind)) drawWheel(ctx, fruit, radius, size)
  else cutFace(ctx, fruit, radius, size)

  ctx.beginPath()
  ctx.ellipse(
    -radius * 0.3,
    -radius * 0.36,
    radius * 0.34,
    radius * 0.18,
    -0.6,
    0,
    TAU,
  )
  ctx.fillStyle = 'rgba(255, 255, 255, 0.24)'
  ctx.fill()

  // The slice's own rim, in the same deep shade as the whole fruit's, so the
  // two read as the same object cut two ways.
  ctx.beginPath()
  ctx.arc(0, 0, radius, 0, TAU)
  ctx.lineWidth = size * 0.05
  ctx.strokeStyle = shade(rind, -0.45)
  ctx.globalAlpha = 0.8
  ctx.stroke()
  ctx.globalAlpha = 1

  ctx.restore()
}
