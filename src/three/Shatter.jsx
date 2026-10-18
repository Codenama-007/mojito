import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { cupModel, shardSpawns } from '../config/cupProfile.js'
import { quality } from '../config/performance.js'
import { useStore } from '../store/useStore.js'
import { createPlasticMaterial } from './shaders/plasticMaterial.js'
import {
  BREAK_START,
  buildShards,
  progressToT,
  shardDisplacement,
  shardFade,
  shardRotation,
  shardTi,
} from './shardMath.js'

/** One irregular flat triangle, shared by every instance. */
function buildShardGeometry(count) {
  const geometry = new THREE.BufferGeometry()

  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [-0.52, -0.34, 0, 0.48, -0.16, 0, 0.06, 0.5, 0],
      3,
    ),
  )
  geometry.setAttribute(
    'normal',
    new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3),
  )
  geometry.setAttribute(
    'uv',
    new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2),
  )
  geometry.setAttribute(
    'aShardFade',
    new THREE.InstancedBufferAttribute(new Float32Array(count), 1),
  )

  return geometry
}

export default function Shatter() {
  const meshRef = useRef(null)
  const count = quality.shardCount

  // Origins come from points computed on the cup, so the burst starts on the
  // surface and the lid breaks with the body. Sizes, speeds and gravity scale
  // with the cup's width, so the burst keeps its proportions if the shape is
  // retuned.
  const shards = useMemo(
    () => buildShards(count, { spawns: shardSpawns, width: cupModel.widestRadius * 2 }),
    [count],
  )
  const geometry = useMemo(() => buildShardGeometry(count), [count])
  const material = useMemo(() => createPlasticMaterial({ instanceFade: true }), [])

  // Scratch objects, so the per-frame loop allocates nothing.
  const scratch = useRef({
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    scale: new THREE.Vector3(),
    matrix: new THREE.Matrix4(),
  })

  useEffect(() => {
    meshRef.current?.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  }, [])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return

    const breakProgress = useStore.getState().breakProgress
    const active = breakProgress >= BREAK_START

    mesh.visible = active
    if (!active) return

    const t = progressToT(breakProgress)
    const { position, quaternion, scale, matrix } = scratch.current

    // Read off the mesh rather than captured, so nothing from a hook is
    // mutated through this closure.
    const fade = mesh.geometry.getAttribute('aShardFade')

    for (let i = 0; i < shards.length; i++) {
      const shard = shards[i]
      const ti = shardTi(shard, t)

      shardDisplacement(shard, ti, position)
      shardRotation(shard, ti, quaternion)
      scale.setScalar(shard.scale)

      matrix.compose(position, quaternion, scale)
      mesh.setMatrixAt(i, matrix)

      fade.array[i] = shardFade(ti)
    }

    mesh.instanceMatrix.needsUpdate = true
    fade.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, count]}
      frustumCulled={false}
      visible={false}
      renderOrder={3}
    />
  )
}
