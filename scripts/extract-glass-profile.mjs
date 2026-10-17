/**
 * Reads public/models/glass.glb and writes src/config/glassProfile.js.
 *
 *   node scripts/extract-glass-profile.mjs
 *
 * The model is a Sketchfab FBX round-trip, so its node graph, material
 * extension and vertex layout are all awkward. Rather than hardcode geometry
 * numbers by hand and hope, this measures the real mesh and emits the three
 * things the 3D code needs:
 *
 *   - the bowl's interior profile, for the liquid
 *   - the outer silhouette, for the fallback lathe
 *   - surface points for shard origins, so the shatter starts on the glass
 *
 * Everything comes out in the glass's own local space: y runs 0 (base) to 1
 * (rim), centred on x/z. That is the space the Phase 3 scroll rig already uses,
 * so nothing downstream needs an offset.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

const GLB_PATH = join(root, 'public', 'models', 'glass.glb')
const OUT_PATH = join(root, 'src', 'config', 'glassProfile.js')

const SHARD_COUNT = 60

// ---------------------------------------------------------------- glTF parsing

function parseGlb(buffer) {
  const total = buffer.readUInt32LE(8)
  let offset = 12
  let json = null
  let bin = null

  while (offset < total) {
    const chunkLength = buffer.readUInt32LE(offset)
    const chunkType = buffer.readUInt32LE(offset + 4)
    const data = buffer.subarray(offset + 8, offset + 8 + chunkLength)
    if (chunkType === 0x4e4f534a) json = JSON.parse(data.toString('utf8'))
    else if (chunkType === 0x004e4942) bin = data
    offset += 8 + chunkLength
  }

  if (!json || !bin) throw new Error('GLB is missing a JSON or BIN chunk')
  return { json, bin }
}

function readAccessor(json, bin, index) {
  const accessor = json.accessors[index]
  const view = json.bufferViews[accessor.bufferView]
  const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[accessor.type]
  const isFloat = accessor.componentType === 5126
  const componentSize = isFloat ? 4 : 2
  const base = (view.byteOffset || 0) + (accessor.byteOffset || 0)
  const stride = view.byteStride || componentSize * components

  const out = []
  for (let i = 0; i < accessor.count; i++) {
    const at = base + i * stride
    const row = []
    for (let c = 0; c < components; c++) {
      row.push(
        isFloat ? bin.readFloatLE(at + c * 4) : bin.readUInt16LE(at + c * 2),
      )
    }
    out.push(row)
  }
  return out
}

// Column-major 4x4 helpers, matching how glTF stores matrices.
const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

function multiply(a, b) {
  const out = new Array(16)
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let sum = 0
      for (let k = 0; k < 4; k++) sum += a[k * 4 + r] * b[c * 4 + k]
      out[c * 4 + r] = sum
    }
  }
  return out
}

function fromTrs(translation, rotation, scale) {
  let m = identity()

  if (rotation) {
    const [x, y, z, w] = rotation
    const x2 = x + x
    const y2 = y + y
    const z2 = z + z
    const xx = x * x2
    const xy = x * y2
    const xz = x * z2
    const yy = y * y2
    const yz = y * z2
    const zz = z * z2
    const wx = w * x2
    const wy = w * y2
    const wz = w * z2
    m = [
      1 - (yy + zz), xy + wz, xz - wy, 0,
      xy - wz, 1 - (xx + zz), yz + wx, 0,
      xz + wy, yz - wx, 1 - (xx + yy), 0,
      0, 0, 0, 1,
    ]
  }

  const s = scale || [1, 1, 1]
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) m[c * 4 + r] *= s[c]

  const t = translation || [0, 0, 0]
  m[12] = t[0]
  m[13] = t[1]
  m[14] = t[2]
  return m
}

/** Every vertex of the scene, in world space. */
function collectWorldVertices(json, bin) {
  const points = []

  const walk = (nodeIndex, parent) => {
    const node = json.nodes[nodeIndex]
    const local = node.matrix
      ? node.matrix.slice()
      : fromTrs(node.translation, node.rotation, node.scale)
    const world = multiply(parent, local)

    if (node.mesh != null) {
      for (const primitive of json.meshes[node.mesh].primitives) {
        for (const v of readAccessor(json, bin, primitive.attributes.POSITION)) {
          points.push([
            world[0] * v[0] + world[4] * v[1] + world[8] * v[2] + world[12],
            world[1] * v[0] + world[5] * v[1] + world[9] * v[2] + world[13],
            world[2] * v[0] + world[6] * v[1] + world[10] * v[2] + world[14],
          ])
        }
      }
    }

    for (const child of node.children || []) walk(child, world)
  }

  const scene = json.scenes[json.scene ?? 0]
  for (const nodeIndex of scene.nodes) walk(nodeIndex, identity())

  return points
}

// ------------------------------------------------------------------ measuring

const buffer = readFileSync(GLB_PATH)
const { json, bin } = parseGlb(buffer)
const world = collectWorldVertices(json, bin)

const bounds = {
  min: [Infinity, Infinity, Infinity],
  max: [-Infinity, -Infinity, -Infinity],
}
for (const p of world) {
  for (let c = 0; c < 3; c++) {
    if (p[c] < bounds.min[c]) bounds.min[c] = p[c]
    if (p[c] > bounds.max[c]) bounds.max[c] = p[c]
  }
}

const modelHeight = bounds.max[1] - bounds.min[1]
const scale = 1 / modelHeight
const centreX = (bounds.min[0] + bounds.max[0]) / 2
const centreZ = (bounds.min[2] + bounds.max[2]) / 2

/** World space -> the glass's local space: y 0..1, centred on x/z. */
const toLocal = (p) => [
  (p[0] - centreX) * scale,
  (p[1] - bounds.min[1]) * scale,
  (p[2] - centreZ) * scale,
]

const local = world.map(toLocal)

// Vertices arrive in rings around the Y axis. Group them by height so each
// ring gives one radius, then pair neighbouring rings: the smaller radius is
// the interior wall, the larger is the exterior (the glass shell is thin).
const RING_TOLERANCE = 0.00005
const rings = new Map()
for (const p of local) {
  const key = Math.round(p[1] / RING_TOLERANCE)
  if (!rings.has(key)) rings.set(key, [])
  rings.get(key).push(Math.hypot(p[0], p[2]))
}
const ringList = [...rings.entries()]
  .map(([key, radii]) => ({
    y: key * RING_TOLERANCE,
    rMin: Math.min(...radii),
    rMax: Math.max(...radii),
  }))
  .sort((a, b) => a.y - b.y)

/** Rings closer together than this are the inner and outer wall at one height. */
const PAIR_WINDOW = 0.002
const paired = []
for (let i = 0; i < ringList.length; i++) {
  const ring = ringList[i]
  const next = ringList[i + 1]
  if (next && next.y - ring.y <= PAIR_WINDOW) {
    paired.push({ y: (ring.y + next.y) / 2, rInner: Math.min(ring.rMin, next.rMin), rOuter: Math.max(ring.rMax, next.rMax) })
    i++
  } else {
    paired.push({ y: ring.y, rInner: ring.rMin, rOuter: ring.rMax })
  }
}

/**
 * Interior wall of the bowl, floor to rim.
 *
 * Below roughly y 0.5 everything is stem and the bowl's outer underside, so
 * those rings are excluded; the ones that remain trace a clean curve from
 * near the axis at the bowl floor out to the rim.
 */
const BOWL_FLOOR_Y = 0.49
const rawInterior = paired
  .filter((r) => r.y >= BOWL_FLOOR_Y && r.rInner > 0.008)
  .map((r) => [r.rInner, r.y])

/**
 * The lower bowl interleaves rings from the inner wall and the bowl's outer
 * underside closer together than PAIR_WINDOW can separate, which leaves a
 * couple of points out of order (a larger radius at a lower height). The
 * interior is a surface of revolution, so it rises to a single widest point and
 * falls again; anything that breaks that shape is a stray outer ring and is
 * dropped.
 */
function monotone(profile) {
  const widest = profile.reduce((best, p, i) => (p[0] > profile[best][0] ? i : best), 0)
  const kept = []

  for (let i = 0; i <= widest; i++) {
    const p = profile[i]
    const prev = kept[kept.length - 1]
    if (!prev || (p[0] > prev[0] && p[1] > prev[1])) kept.push(p)
  }
  for (let i = widest + 1; i < profile.length; i++) {
    const p = profile[i]
    const prev = kept[kept.length - 1]
    if (p[0] < prev[0] && p[1] > prev[1]) kept.push(p)
  }
  return kept
}

const interior = monotone(rawInterior)

/** Widest radius anywhere on the glass: the belly of the bowl, not the rim. */
const widestRadius = Math.max(...paired.map((r) => r.rOuter))

/**
 * Outer silhouette for the fallback lathe: the widest radius in each height
 * band. The foot is a hollow cone of alternating rings, which the binning
 * smooths into a usable profile.
 */
const SILHOUETTE_BANDS = 30
const silhouette = []
for (let b = 0; b < SILHOUETTE_BANDS; b++) {
  const lo = b / SILHOUETTE_BANDS
  const hi = (b + 1) / SILHOUETTE_BANDS
  let widest = 0
  for (const p of local) {
    if (p[1] >= lo && p[1] < hi) {
      const r = Math.hypot(p[0], p[2])
      if (r > widest) widest = r
    }
  }
  if (widest > 0) silhouette.push([widest, (lo + hi) / 2])
}

/**
 * Shard origins, sampled from real vertices so the burst starts on the glass
 * rather than in empty air. Stratified by height so they spread up the glass
 * instead of clumping where the mesh happens to be dense.
 *
 * These stay in local space (y 0..1). They used to be centred on y = 0, which
 * put half the burst below the glass.
 */
function sampleShardSpawns(count, seed) {
  let state = seed >>> 0
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }

  const sorted = [...local].sort((a, b) => a[1] - b[1])
  const spawns = []
  for (let i = 0; i < count; i++) {
    const from = Math.floor((i / count) * sorted.length)
    const to = Math.max(from + 1, Math.floor(((i + 1) / count) * sorted.length))
    const pick = sorted[from + Math.floor(random() * (to - from))]
    spawns.push(pick)
  }
  return spawns
}

const spawns = sampleShardSpawns(SHARD_COUNT, 20261018)

// --------------------------------------------------------------- emit the file

const f = (n) => Number(n.toFixed(5))
const rows = (list, perLine = 4) => {
  const lines = []
  for (let i = 0; i < list.length; i += perLine) {
    lines.push(
      '  ' +
        list
          .slice(i, i + perLine)
          .map((p) => `[${p.map(f).join(', ')}]`)
          .join(', ') +
        ',',
    )
  }
  return lines.join('\n')
}

const maxInterior = Math.max(...interior.map((p) => p[0]))

const output = `/**
 * GENERATED by scripts/extract-glass-profile.mjs -- do not edit by hand.
 * Re-run that script after replacing public/models/glass.glb.
 *
 * All coordinates are in the glass's own local space: y runs 0 (base) to 1
 * (rim) and the glass is centred on x/z. The Phase 3 scroll rig and the shatter
 * both work in this space, so nothing here needs an offset applied.
 *
 * The model is a stemmed glass: a wide foot, a thin stem, then a rounded bowl.
 * Measured from the mesh, it is ${f(widestRadius)} wide at its widest, against a height of 1.
 */

/** Measured properties of the source mesh, before anything is applied. */
export const glassModel = {
  source: 'public/models/glass.glb',
  /** Height in the file's own units, used to derive the normalising scale. */
  modelHeight: ${f(modelHeight)},
  /** Multiply model units by this to get local units (y 0..1). */
  normaliseScale: ${f(scale)},
  /** Widest radius, local units, at the bowl's belly. The code-built highball was 0.5. */
  widestRadius: ${f(widestRadius)},
  /** Height of the top of the bowl's interior, where the rim is. */
  rimY: ${f(Math.max(...interior.map((p) => p[1])))},
  /** Lowest point of the bowl's interior, where the liquid sits. */
  bowlFloorY: ${f(Math.min(...interior.map((p) => p[1])))},
}

/**
 * Interior wall of the bowl, [radius, y], floor to rim. This is the inside of
 * the glass, so it is what the liquid has to fit within.
 *
 * Note the bowl is widest (${f(maxInterior)}) just below its middle and narrower
 * at the rim (${f(interior[interior.length - 1][0])}), so a straight cylinder
 * cannot sit inside it without either poking through the wall or leaving a
 * visible gap. Hence the liquid is a lathe on this profile.
 */
export const interiorProfile = [
${rows(interior)}
]

/**
 * Outer silhouette, [radius, y], bottom to top. Used to build the lathe that
 * stands in when the model cannot be loaded, so the fallback at least has the
 * right proportions.
 */
export const outerProfile = [
${rows(silhouette)}
]

/**
 * ${spawns.length} points on the glass surface, [x, y, z], local space. Shard
 * origins are picked from these so the burst starts on the real glass.
 */
export const shardSpawns = [
${rows(spawns)}
]

/** Widest radius of the bowl interior, for sizing and for assertions. */
export const interiorMaxRadius = ${f(maxInterior)}
`

writeFileSync(OUT_PATH, output, 'utf8')

console.log(`wrote ${OUT_PATH}`)
console.log('')
console.log(`  model height        ${f(modelHeight)}`)
console.log(`  normalise scale     ${f(scale)}`)
console.log(`  widest radius       ${f(widestRadius)}  (code-built glass: 0.5)`)
console.log(`  interior floor y    ${f(Math.min(...interior.map((p) => p[1])))}`)
console.log(`  interior rim y      ${f(Math.max(...interior.map((p) => p[1])))}`)
console.log(`  interior max radius ${f(maxInterior)} at y ${f(interior.reduce((b, p) => (p[0] > b[0] ? p : b), interior[0])[1])}`)
console.log(`  interior points     ${interior.length}`)
console.log(`  silhouette points   ${silhouette.length}`)
console.log(`  shard spawns        ${spawns.length}`)
