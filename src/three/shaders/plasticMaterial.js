import * as THREE from 'three'
import { quality } from '../../config/performance.js'

/**
 * The plastic look, in one place: transparent, high clearcoat, and a fresnel
 * rim injected into the physical shader so grazing angles catch the light.
 *
 * This is the single recipe for the cup, the lid, the straw's collar and the
 * shards, so a cup that breaks into pieces still breaks into pieces of the same
 * material. Only two things change between callers: the opacity, and whether
 * the shader is instanced.
 *
 * `instanceFade` adds a per-instance alpha attribute. MeshPhysicalMaterial has
 * one global `opacity`, so per-shard fade is otherwise impossible — and that is
 * why the shards need their own material rather than sharing the cup's.
 *
 * Transmission is deliberately *not* used for the shards, whatever the tier
 * says. Refraction costs a whole extra pass over the scene, and sixty thrown
 * triangles are not where that is worth spending (AGENTS.md section 5).
 */
const RIM_COLOR = new THREE.Color('#ffffff')

export function createPlasticMaterial({
  instanceFade = false,
  opacity,
  transmission,
  look = quality.plastic,
} = {}) {
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#f4f9ff'),
    transparent: true,
    // A shard is small and fast, so it carries a little more alpha than the cup
    // does, or it reads as a glint rather than as a piece of plastic.
    opacity: opacity ?? (instanceFade ? look.opacity + 0.12 : look.opacity),
    roughness: look.roughness,
    metalness: 0,
    clearcoat: look.clearcoat,
    clearcoatRoughness: look.clearcoatRoughness,
    envMapIntensity: look.envMapIntensity,
    ior: look.ior,
    side: THREE.DoubleSide,
    depthWrite: look.depthWrite,
  })

  const refract = instanceFade ? 0 : (transmission ?? look.transmission)
  if (refract > 0) {
    material.transmission = refract
    material.thickness = look.thickness
  }

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = { value: RIM_COLOR }
    shader.uniforms.uRimStrength = {
      value: instanceFade ? look.rimStrength + 0.2 : look.rimStrength,
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
      // The rim is what separates clear plastic from a grey ghost: without some
      // edge response, a 0.2-alpha surface has almost nothing to see.
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
    instanceFade ? 'plastic-instanced' : 'plastic-plain'

  return material
}
