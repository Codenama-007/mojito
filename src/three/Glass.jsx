import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

/**
 * Highball glass, built as a LatheGeometry from a hand-written profile.
 * Points are (radius, height) and walk from the base center, out along the
 * bottom, up the outer wall, over the rim, down the interior wall, and back
 * across the interior floor.
 *
 * The outer wall tapers 0.42 -> 0.50 so the glass reads as slightly narrower
 * at the bottom. The interior stays a vertical cylinder at 0.445 so the liquid
 * cylinder fits cleanly at any fill level.
 */
const PROFILE = [
  [0.0, 0.0], // base center
  [0.3, 0.0], // flat foot
  [0.42, 0.015], // chamfer: narrowest visible point
  [0.5, 0.07], // outer wall starts
  [0.5, 0.985], // outer wall top
  [0.5, 1.0], // rim, outer lip
  [0.445, 1.0], // rim, inner lip (0.055 wall)
  [0.445, 0.14], // interior wall down to the floor
  [0.0, 0.14], // interior floor, sits on a 0.14-thick base
]

const RIM_COLOR = new THREE.Color('#ffffff')

function buildGeometry(segments) {
  const points = PROFILE.map(([x, y]) => new THREE.Vector2(x, y))
  const geometry = new THREE.LatheGeometry(points, segments)
  geometry.computeVertexNormals()
  return geometry
}

/**
 * Grazing angles glow, which is what sells glass without an environment map
 * or real refraction. Injected after <emissivemap_fragment>, where the
 * shading normal and view vector are both already in scope.
 */
function addFresnelRim(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = { value: RIM_COLOR }
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform vec3 uRimColor;\nvoid main() {')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float rimFresnel = pow(
          1.0 - abs(dot(normalize(normal), normalize(vViewPosition))),
          3.0
        );
        totalEmissiveRadiance += uRimColor * rimFresnel * 0.32;`,
      )
  }
  return material
}

export default function Glass({ segments = 64 }) {
  const geometry = useMemo(() => buildGeometry(segments), [segments])

  const material = useMemo(
    () =>
      addFresnelRim(
        new THREE.MeshPhysicalMaterial({
          color: new THREE.Color('#eef6ff'),
          transparent: true,
          opacity: 0.22,
          roughness: 0.05,
          metalness: 0,
          clearcoat: 1,
          clearcoatRoughness: 0.05,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      ),
    [],
  )

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  return <mesh geometry={geometry} material={material} renderOrder={2} />
}
