import * as THREE from 'three'

/**
 * The glass look, in one place: transparent, high clearcoat, no transmission
 * and no refraction (AGENTS.md section 5), plus a fresnel rim injected into
 * the physical shader so grazing angles glow without an environment map.
 *
 * `instanceFade` adds a per-instance alpha attribute. MeshPhysicalMaterial has
 * a single global `opacity`, so per-shard fade is otherwise impossible, and
 * that is why the shards need their own material instance instead of sharing
 * the glass's. The recipe is identical either way.
 */
const RIM_COLOR = new THREE.Color('#ffffff')

export function createGlassMaterial({ instanceFade = false, opacity } = {}) {
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#eef6ff'),
    transparent: true,
    opacity: opacity ?? (instanceFade ? 0.34 : 0.22),
    roughness: 0.05,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    side: THREE.DoubleSide,
    depthWrite: false,
  })

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = { value: RIM_COLOR }
    shader.uniforms.uRimStrength = { value: instanceFade ? 0.5 : 0.32 }

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
