import * as THREE from 'three'

/**
 * The material for every plane in the fruit field.
 *
 * A `MeshBasicMaterial` with two injections rather than a hand-written shader,
 * for one reason: instancing. three handles `instanceMatrix` and the per-instance
 * attribute plumbing for built-in materials, and reimplementing that in a raw
 * `ShaderMaterial` is the kind of thing that works until three changes an
 * internal. So the code is added to the built-in vertex and fragment stages
 * instead, through two of the most stable hooks in the library.
 *
 * Two things the material adds:
 *
 *  - **A soft edge.** A plane has corners. A background fruit is meant to be out
 *    of focus, so the alpha falls away over the outer fraction of the plane's
 *    radius — nearly the whole disc for the far layer, barely the rim for the
 *    near one. This is the blur, and it costs nothing: no post-processing pass,
 *    no second render target.
 *  - **A per-instance alpha.** Each layer has its own ceiling
 *    (FRUIT_FIELD_OPACITY), carried as an instanced attribute rather than as
 *    `instanceColor`, because an instance color only multiplies RGB — it cannot
 *    carry an alpha, and an opaque quad on a bright backdrop is exactly what
 *    this field must not have.
 *
 * `uFieldOpacity` is the whole-field fade, owned by the caller: it carries the
 * flavor cross-fade and the fade-out at the shatter.
 */

/** The uniform handle the caller mutates every frame. */
export function fieldUniforms(material) {
  return material.userData.fieldUniforms
}

export function createFruitFieldMaterial(map) {
  const uniforms = {
    uFieldOpacity: { value: 0 },
  }

  const material = new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    // Background fruit never writes depth and is never lit, so it cannot
    // leave a seam in the cup or pick up a highlight from the scene lights.
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  })

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uFieldOpacity = uniforms.uFieldOpacity

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aFieldAlpha;
        attribute float aFieldSoft;
        varying float vFieldAlpha;
        varying float vFieldSoft;
        varying vec2 vFieldUv;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vFieldAlpha = aFieldAlpha;
        vFieldSoft = aFieldSoft;
        vFieldUv = uv;`,
      )

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uFieldOpacity;
        varying float vFieldAlpha;
        varying float vFieldSoft;
        varying vec2 vFieldUv;`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        {
          // 0 at the centre, 1 at the plane's edge, so the fade is a disc.
          float fieldRadius = length( vFieldUv - 0.5 ) * 2.0;
          float fieldEdge = 1.0 - smoothstep( 1.0 - vFieldSoft, 1.0, fieldRadius );
          diffuseColor.a *= fieldEdge * vFieldAlpha * uFieldOpacity;
        }`,
      )
  }

  material.userData.fieldUniforms = uniforms
  return material
}
