import * as THREE from 'three'
import { cupModel, lidModel, strawModel } from '../src/config/cupProfile.js'
import {
  CUP_FIT,
  CUP_SWAY,
  CUP_TILT_X,
  CUP_TILT_Z,
  CUP_TOP_CLEARANCE,
  MOBILE_GLASS_Y_OFFSET,
  NAVBAR_HEIGHT_PX,
  TIERS,
  toRadians,
} from '../src/config/performance.js'
import { GLASS_TARGETS, SECTION_ORDER } from '../src/config/sections.js'
import {
  buildCupBodyGeometry,
  buildHighlightGeometry,
  buildLidGeometry,
  buildRimFlangeGeometry,
  buildStrawHoleGeometry,
  buildStrawInnerGeometry,
  buildStrawOuterGeometry,
} from '../src/three/cupGeometry.js'

/**
 * "Is the cup on screen?" — checked without a renderer.
 *
 * Phase 8A puts a ceiling on the cup's height and a clamp under its top edge.
 * Both are stated as fractions of the viewport, so the thing worth asserting is
 * exactly that: on the narrow screens the brief names, in every section, the
 * straw stays clear of the top and the cup still fits the frame.
 *
 * The cup is measured the same way MojitoGroup.jsx measures it — a real Box3
 * over the real geometries, with the real tilt applied — rather than by
 * re-deriving the extremes by hand. A hand-written bound would agree with the
 * config it was copied from and disagree with the mesh.
 *
 * The camera is the one Scene.jsx sets up: fov 40 at z = 5. That fixes the
 * world-space height of the viewport at 3.64 regardless of the screen, which is
 * why the fit is a function of the aspect ratio and nothing else.
 */

const failures = []
const check = (name, ok, detail = '') => {
  if (ok) {
    console.log(`  PASS  ${name}${detail ? ` (${detail})` : ''}`)
  } else {
    console.log(`  FAIL  ${name}${detail ? ` (${detail})` : ''}`)
    failures.push(name)
  }
}

const CAMERA_FOV = 40
const CAMERA_Z = 5
const VIEWPORT_HEIGHT = 2 * Math.tan(toRadians(CAMERA_FOV / 2)) * CAMERA_Z

const TILT_X = toRadians(CUP_TILT_X)
const TILT_Z = toRadians(CUP_TILT_Z)
const SWAY = toRadians(CUP_SWAY)

/**
 * The same nested groups MojitoGroup.jsx builds, with only the cup inside, and
 * the same Box3 over them — so the numbers below are the numbers the component
 * computes, not a second opinion about them.
 *
 * Measured at both extremes of the idle sway, because that is what the
 * component does: the clamp has to hold while the cup rocks.
 */
function measureCup() {
  const group = new THREE.Group()
  const centre = new THREE.Group()
  const tilt = new THREE.Group()
  const cup = new THREE.Group()

  centre.position.set(0, -0.5, 0)
  group.add(centre)
  centre.add(tilt)
  tilt.add(cup)

  const material = new THREE.MeshBasicMaterial()
  const segments = TIERS.desktop.latheSegments

  for (const geometry of [
    buildCupBodyGeometry(segments),
    buildRimFlangeGeometry(),
    buildLidGeometry(segments),
    buildStrawHoleGeometry(),
    buildHighlightGeometry(),
  ]) {
    cup.add(new THREE.Mesh(geometry, material))
  }

  // The straw pivots on its own hole, exactly as Cup.jsx mounts it.
  const straw = new THREE.Group()
  straw.position.set(strawModel.holeX, strawModel.holeY, strawModel.holeZ)
  straw.rotation.z = strawModel.tiltZ
  straw.add(new THREE.Mesh(buildStrawInnerGeometry(), material))
  straw.add(new THREE.Mesh(buildStrawOuterGeometry(), material))
  cup.add(straw)

  let top = -Infinity
  let bottom = Infinity

  for (const lean of [TILT_Z - SWAY, TILT_Z + SWAY]) {
    tilt.rotation.set(TILT_X, 0, lean)
    group.updateMatrixWorld(true)

    const box = new THREE.Box3().setFromObject(cup)
    top = Math.max(top, box.max.y)
    bottom = Math.min(bottom, box.min.y)
  }

  return { top, bottom, height: top - bottom }
}

const CUP = measureCup()

check(
  'the measured cup spans its body plus the lid and straw',
  CUP.height > lidModel.topY - 0.5 && CUP.height < strawModel.topY + 0.1,
  `height ${CUP.height.toFixed(4)}, body 1.0, straw top ${strawModel.topY.toFixed(3)} untilted`,
)
check(
  'the straw is what sets the top of the cup',
  CUP.top > lidModel.topY - 0.5 + 0.1,
  `top ${CUP.top.toFixed(4)} vs lid top ${(lidModel.topY - 0.5).toFixed(4)}`,
)
check(
  'the lid is at least as wide as the rim it clips onto',
  lidModel.radius >= cupModel.rimRadius,
  `lid ${lidModel.radius} >= rim ${cupModel.rimRadius}`,
)

// ------------------------------------------------------------- the transform

/** The camera's world-space viewport at the given CSS size. */
const viewportFor = (width, height) => ({
  width: VIEWPORT_HEIGHT * (width / height),
  height: VIEWPORT_HEIGHT,
})

/**
 * The base scale `useGlassBaseScale.js` returns, repeated here so the check is
 * against the same expression and not a remembered number.
 */
const baseScaleFor = (viewport) =>
  Math.min(viewport.height * 0.55, viewport.width * 0.62, 2.4)

/**
 * Where MojitoGroup.jsx would put the cup for one section at one screen size.
 *
 * Transcribed from the frame loop, in the same order: fit, then the mobile
 * offset, then the clamp.
 */
function layout(target, mode, width, height) {
  const viewport = viewportFor(width, height)
  const baseScale = baseScaleFor(viewport)
  const isMobile = mode === 'mobile'

  const fitFraction = isMobile ? CUP_FIT.mobile : CUP_FIT.desktop
  const fitting = (viewport.height * fitFraction) / (baseScale * target.scale * CUP.height)
  const scale = baseScale * target.scale * Math.min(1, fitting)

  let y =
    target.y * viewport.height -
    (isMobile ? MOBILE_GLASS_Y_OFFSET * viewport.height : 0)

  const navbarY = (NAVBAR_HEIGHT_PX / height) * viewport.height
  const clearance = isMobile
    ? Math.max(viewport.height * CUP_TOP_CLEARANCE, navbarY)
    : viewport.height * CUP_TOP_CLEARANCE

  const topLimit = viewport.height / 2 - clearance
  const topBeforeClamp = y + CUP.top * scale
  if (topBeforeClamp > topLimit) y -= topBeforeClamp - topLimit

  return {
    viewport,
    scale,
    top: y + CUP.top * scale,
    bottom: y + CUP.bottom * scale,
    topLimit,
    worldHeight: CUP.height * scale,
    fitFraction,
  }
}

/** The widths the brief names, with the heights those widths usually come with. */
const SCREENS = [
  { width: 360, height: 780 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
]

/**
 * Every height, too. The world-space viewport is fixed by the fov, so a shorter
 * canvas only narrows the aspect and moves the base scale — and the navbar's
 * share grows. Sweeping the heights is what catches a short-and-wide window that
 * a single "360 x 780" assumption would miss.
 */
const SWEEP_HEIGHTS = []
for (let h = 520; h <= 1200; h += 20) SWEEP_HEIGHTS.push(h)

/**
 * Every section, including the hero and the far end of the scroll. The
 * transitions between two sections are covered by the fact that both endpoints
 * satisfy the bound and both `y` and `scale` ease affinely towards them, so
 * every frame between two legal states is legal.
 */
const SECTIONS = SECTION_ORDER.filter((id) => GLASS_TARGETS[id])

for (const mode of ['mobile', 'desktop']) {
  for (const screen of SCREENS) {
    let worstTop = -Infinity
    let worstTopAt = ''
    let tallestRatio = 0
    let tallestAt = ''
    let topBreach = ''
    let sizeBreach = ''
    let lowest = Infinity
    let lowestAt = ''
    let smallestScale = Infinity

    for (const sectionId of SECTIONS) {
      for (const height of SWEEP_HEIGHTS) {
        const state = layout(GLASS_TARGETS[sectionId][mode], mode, screen.width, height)
        const at = `${sectionId}@${screen.width}x${height}`

        if (state.top > worstTop) {
          worstTop = state.top
          worstTopAt = at
        }
        if (state.worldHeight / state.viewport.height > tallestRatio) {
          tallestRatio = state.worldHeight / state.viewport.height
          tallestAt = at
        }
        if (state.top > state.topLimit + 1e-9 && topBreach === '') topBreach = at
        if (state.worldHeight > state.viewport.height * state.fitFraction + 1e-9 && sizeBreach === '') {
          sizeBreach = at
        }
        if (state.bottom < lowest) {
          lowest = state.bottom
          lowestAt = at
        }
        smallestScale = Math.min(smallestScale, state.scale)
      }
    }

    const label = `${mode} ${screen.width}x${screen.height}`
    const hero = layout(GLASS_TARGETS[SECTIONS[0]][mode], mode, screen.width, screen.height)

    check(
      `${label}: the straw never crosses the top clearance`,
      topBreach === '',
      topBreach || `worst top ${worstTop.toFixed(3)} at ${worstTopAt}, limit ${hero.topLimit.toFixed(3)}`,
    )
    check(
      `${label}: the cup never exceeds its share of the viewport`,
      sizeBreach === '',
      sizeBreach || `tallest ${(tallestRatio * 100).toFixed(1)}% at ${tallestAt}, cap ${(hero.fitFraction * 100).toFixed(0)}%`,
    )
    check(
      `${label}: the cup is still on screen vertically`,
      lowest > -hero.viewport.height / 2,
      `lowest ${lowest.toFixed(3)} at ${lowestAt}, floor ${(-hero.viewport.height / 2).toFixed(3)}`,
    )
    check(
      `${label}: the fit never shrinks the cup into a dot`,
      smallestScale > 0.3,
      `smallest scale ${smallestScale.toFixed(3)}`,
    )
  }
}

// ------------------------------------------------------------------ the lean

check(
  'the cup leans to the right, not the left',
  CUP_TILT_Z < 0,
  `CUP_TILT_Z ${CUP_TILT_Z} degrees`,
)

/**
 * "Right" means the top of the cup moves towards +x on screen. A Z rotation
 * maps (x, y) to (x cos - y sin, x sin + y cos), so a point above the pivot
 * lands at x = -y sin(Z), and a positive Z therefore leans left.
 */
check(
  'the lean puts the top of the cup on the right of the pivot',
  -Math.sin(TILT_Z) > 0,
  `top offset ${(-Math.sin(TILT_Z)).toFixed(3)} right per unit of height`,
)

// ------------------------------------------------------------- the fallbacks

check(
  'the sway is a small fraction of the top clearance',
  SWAY * 2 < CUP_TOP_CLEARANCE,
  `sway ${(SWAY * 2).toFixed(3)} rad, clearance ${CUP_TOP_CLEARANCE}`,
)

const leanSwing =
  Math.abs(Math.cos(TILT_Z + SWAY) - Math.cos(TILT_Z)) * strawModel.topY
check(
  'a sway of either sign moves the top by well under the clearance',
  leanSwing < CUP_TOP_CLEARANCE * 0.2,
  `sway moves the top by ${leanSwing.toFixed(4)} of ${CUP_TOP_CLEARANCE}`,
)

// --------------------------------------------------------------------- report

console.log('')
console.log(
  `  ....  cup measures ${CUP.height.toFixed(4)} tall after tilt, top at ${CUP.top.toFixed(
    4,
  )} in group space; the viewport is ${VIEWPORT_HEIGHT.toFixed(4)} world units tall`,
)
console.log('')
console.log(
  failures.length === 0
    ? `PASS: all checks green (${SECTIONS.length} sections x ${SCREENS.length} screens x ${SWEEP_HEIGHTS.length} heights, both tiers)`
    : `FAIL: ${failures.join(' | ')}`,
)
process.exit(failures.length === 0 ? 0 : 1)
