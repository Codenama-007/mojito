import * as THREE from 'three'
import { quality } from '../../config/performance.js'

/**
 * The glass look, in one place: transparent, high clearcoat, no transmission
 * and no refraction (AGENTS.md section 5), plus a fresnel rim injected into
 * the physical shader so grazing angles glow.
 *
 * Surface numbers come from the quality tier, so this stays the single recipe
 * for both the glass and the shards. The shards only skip transmission —
 * there is none on either tier — and take a slightly higher opacity and rim
 * so a small, fast-moving triangle still reads.
 *
 * `instanceFade` adds a per-instance alpha attribute. MeshPhysicalMaterial has
 * a single global `opacity`, so per-shard fade is otherwise impossible, and
 * that is why the shards need their own material instance instead of sharing
 * the glass's. The shader injection is otherwise identical, which is why both
 * share this function.
 */
const RIM_COLOR = new THREE.Color('#ffffff')

export function createGlassMaterial({ instanceFade = false, opacity, look = quality.glass } = {}) {
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#eef6ff'),
    transparent: true,
    opacity: opacity ?? (instanceFade ? look.opacity + 0.1 : look.opacity),
    roughness: look.roughness,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: look.clearcoatRoughness,
    envMapIntensity: look.envMapIntensity,
    ior: 1.5,
    side: THREE.DoubleSide,
    depthWrite: false,
  })

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = { value: RIM_COLOR }
    shader.uniforms.uRimStrength = {
      value: instanceFade ? look.rimStrength + 0.18 : look.rimStrength,
    }

    shader.vertexShader = shader.vertexShader
      .replace(
        'void main() {',
        instanceFade
          ? 'attribute float aShardFade;\nvarying float vShardFade;\nvoid main() {'
          : 'void main() {',
      )
      .replace(
        '#include <begin_vertex>',
        instanceFade
          ? '#include <begin_vertex>\n  vShardFade = aShardFade;'
          : '#include <begin_vertex>',
      )

    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        instanceFade
          ? 'varying float vShardFade;\nuniform vec3 uRimColor;\nuniform float uRimStrength;\nvoid main() {'
          : 'uniform vec3 uRimColor;\nuniform float uRimStrength;\nvoid main() {',
      )
      .replace(
        '#include <alphamap_fragment>',
        instanceFade
          ? '#include <alphamap_fragment>\n  diffuseColor.a *= vShardFade;'
          : '#include <alphamap_fragment>',
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float rimFresnel = pow(
          1.0 - abs(dot(normalize(normal), normalize(vViewPosition))),
          3.0
        );
        totalEmissiveRadiance += uRimColor * rimFresnel * uRimStrength;`,
      )
  }

  // Two materials whose shaders differ only by injected code would otherwise
  // share one cached program, and the instanced one would draw wrong.
  material.customProgramCacheKey = () =>
    instanceFade ? 'glass-instanced' : 'glass-plain'

  return material
}
