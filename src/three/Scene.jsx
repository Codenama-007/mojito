import { Suspense, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import { quality } from '../config/performance.js'
import { useAdaptiveQuality } from '../hooks/useAdaptiveQuality.js'
import { useStore } from '../store/useStore.js'
import Ground from './Ground.jsx'
import MojitoGroup from './MojitoGroup.jsx'
import FruitField from './FruitField.jsx'
import { useGlassBaseScale } from '../hooks/useGlassBaseScale.js'

/** Env map shipped in public/, so no CDN request and no runtime build step. */
const ENV_MAP = '/env/studio.hdr'

/**
 * Renders nothing, and exists entirely for where it renders: *inside* the
 * Suspense boundary below, so React only mounts it once the environment map has
 * arrived. That is the moment the cup is lit the way it was designed to be, which
 * is what the loader in index.html is waiting for.
 *
 * Move it out of that boundary and it fires immediately, and the loader lifts on
 * an unlit cup.
 */
function ReadySignal({ onReady }) {
  useEffect(() => {
    onReady()
  }, [onReady])

  return null
}

/** Stable, so ReadySignal's effect runs on mount rather than on every render. */
const markReady = () => useStore.getState().setBooting(false)

/**
 * Inside the canvas, so it can read the viewport. Only the glass and its
 * shadow are tied to the viewport scale; the lights and the environment are
 * not.
 */
function Stage() {
  const baseScale = useGlassBaseScale()

  return (
    <>
      {/* Phase 8B. Behind the cup, and drawn first: it is in the canvas rather
          than in the DOM precisely so the cup can stand in front of it. */}
      <FruitField />
      <MojitoGroup baseScale={baseScale} />
      <Ground baseScale={baseScale} />
    </>
  )
}

export default function Scene() {
  const dpr = useAdaptiveQuality()

  // Rendering stops while the tab is hidden (AGENTS.md section 5).
  const [frameloop, setFrameloop] = useState('always')

  useEffect(() => {
    const handleVisibility = () => {
      setFrameloop(document.visibilityState === 'visible' ? 'always' : 'never')
    }

    handleVisibility()
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  return (
    <div className="scene">
      <Canvas
        dpr={dpr}
        frameloop={frameloop}
        camera={{ position: [0, 0, 5], fov: 40 }}
        gl={{ antialias: true, alpha: true }}
      >
        {/* Two lights, the maximum the performance rules allow (AGENTS
            section 5). The environment map below is image-based lighting, not
            a third light. */}
        <ambientLight intensity={0.7} />
        <directionalLight position={[-2.5, 3, -4]} intensity={2.4} />

        {/* Its own boundary: a 1.4 MB HDR must not hold up the glass. */}
        <Suspense fallback={null}>
          <Environment files={ENV_MAP} environmentIntensity={quality.environmentIntensity} />
          <ReadySignal onReady={markReady} />
        </Suspense>

        <Stage />
      </Canvas>
    </div>
  )
}
