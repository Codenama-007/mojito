import * as THREE from 'three'
import { createFruitFieldMaterial } from './fruitFieldMaterial.js'
import { buildFieldInstances, fieldPose } from './fruitFieldMath.js'

/**
 * The fruit field as three.js objects: one `InstancedMesh` per fruit type, and
 * the per-frame update that walks them.
 *
 * Kept out of the component on purpose. `FruitField.jsx` should be a swap and a
 * `<primitive>`, and everything that knows about `Matrix4` lives here.
 *
 * Drawn before anything else in the scene (a negative renderOrder), because the
 * field is behind the cup and the cup is transparent: with both in the
 * transparent pass, nothing but an explicit order decides which is in front.
 *
 * Textures are passed in rather than built here, so that this module has no
 * dependency on a canvas and can be built and inspected from Node — see
 * `scripts/verify-fruit-field.mjs`, which constructs a whole field and checks it.
 */

const FIELD_RENDER_ORDER = -1

/**
 * @param {{whole: THREE.Texture, slice: THREE.Texture}} textures  Owned by the
 *   caller, which disposes them; this function only reads them.
 * @param {number} count     Planes per fruit type.
 * @param {{width: number, height: number}} viewport
 */
export function createFruitFieldScene(textures, count, viewport) {
  const maps = [textures.whole, textures.slice]

  const group = new THREE.Group()
  // Named for the browser's own inspector, and for the verifier: a group of
  // zero children is the signature of this field having gone missing.
  group.name = 'FruitField'

  const fields = maps.map((map, index) => {
    // A different seed per fruit type, so the whole fruit and the slices are
    // not two identical grids of positions sitting on top of each other.
    const instances = buildFieldInstances(count, viewport, 0x5eed + index * 0x9e37)
    const material = createFruitFieldMaterial(map)
    const geometry = new THREE.PlaneGeometry(1, 1)

    geometry.setAttribute(
      'aFieldAlpha',
      new THREE.InstancedBufferAttribute(
        new Float32Array(instances.map((instance) => instance.alpha)),
        1,
      ),
    )
    geometry.setAttribute(
      'aFieldSoft',
      new THREE.InstancedBufferAttribute(
        new Float32Array(instances.map((instance) => instance.soft)),
        1,
      ),
    )

    const mesh = new THREE.InstancedMesh(geometry, material, instances.length)
    mesh.renderOrder = FIELD_RENDER_ORDER
    // The instances are spread far wider than the unit plane they are built
    // from, so the geometry's own bounds are meaningless here.
    mesh.frustumCulled = false
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    group.add(mesh)

    return { mesh, instances, material, geometry }
  })

  const pose = { x: 0, y: 0, z: 0, rotation: 0 }
  const position = new THREE.Vector3()
  const size = new THREE.Vector3()
  const quaternion = new THREE.Quaternion()
  const euler = new THREE.Euler()
  const matrix = new THREE.Matrix4()

  return {
    group,
    materials: fields.map((field) => field.material),

    /**
     * @param {number} time     Seconds.
     * @param {number} scroll   Scroll progress, 0 to 1.
     * @param {number} opacity  The whole field's fade, 0 to 1.
     * @param {number} slide    The push, in viewport widths. 0 is home; 1 is a
     *   full viewport off to one side. Held here rather than by the component so
     *   that the group's own transform is only ever written from the module that
     *   built the group.
     */
    update(time, scroll, opacity, slide = 0) {
      group.position.x = slide * viewport.width

      for (const { mesh, instances, material } of fields) {
        material.userData.fieldUniforms.uFieldOpacity.value = opacity

        for (let index = 0; index < instances.length; index++) {
          const instance = instances[index]
          fieldPose(instance, time, scroll, viewport, pose)

          position.set(pose.x, pose.y, pose.z)
          size.setScalar(instance.size)
          euler.set(0, 0, pose.rotation)
          quaternion.setFromEuler(euler)
          matrix.compose(position, quaternion, size)

          mesh.setMatrixAt(index, matrix)
        }

        mesh.instanceMatrix.needsUpdate = true
      }
    },

    /**
     * Frees the GPU resources. It deliberately does **not** touch the group.
     *
     * The tempting version of this also detaches the meshes from the group, and
     * that version costs you the whole feature: React runs an effect, its
     * cleanup, and the effect again on every mount in development, so the
     * cleanup fires moments after the field appears and would leave a mounted,
     * empty group behind — the fruit field silently renders nothing, on every
     * flavor, with no error anywhere. That is exactly what this did until the
     * verifier was taught to look for a group with no children.
     *
     * Leaving the graph alone is also all that is needed. On a real unmount R3F
     * detaches the `<primitive>` group itself and the rest is collected, and a
     * geometry, material or texture disposed out from under a live mesh is
     * re-uploaded by three on the next frame — which is how every other
     * instanced component in this project already behaves.
     */
    dispose() {
      for (const { material, geometry } of fields) {
        geometry.dispose()
        material.dispose()
      }
    },
  }
}
