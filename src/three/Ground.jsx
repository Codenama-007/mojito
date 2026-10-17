import { useThree } from '@react-three/fiber'
import { ContactShadows } from '@react-three/drei'
import { FALLBACK_TARGET, GLASS_TARGETS } from '../config/sections.js'
import { isMobile, quality } from '../config/performance.js'
import { useStore } from '../store/useStore.js'

/**
 * The soft shadow that grounds the glass on the floor.
 *
 * Desktop only: it costs a second pass over the scene every frame, and AGENTS
 * section 5 rules out real-time shadow work on mobile. Mobile gets the same
 * grounding from the backdrop instead.
 *
 * The scene is re-read every frame (`frames` defaults to Infinity) rather than
 * baked once. A single bake would freeze the shadow at whatever pose the glass
 * happened to be in when the section changed, and the glass eases between
 * sections over ~0.66s, so the bake would always be stale.
 *
 * The floor sits at the glass's base, worked out from the section target
 * rather than from the eased transform: for most of the scroll the two agree,
 * and a slightly soft shadow is more forgiving than a shadow that jitters.
 */
export default function Ground({ baseScale }) {
  const activeSection = useStore((state) => state.activeSection)
  const viewport = useThree((state) => state.viewport)

  // Desktop only, so the target below is always the desktop one.
  if (!quality.contactShadows || isMobile) return null

  const target = (GLASS_TARGETS[activeSection] ?? FALLBACK_TARGET).desktop

  // The glass group is centred on its own origin, so its base is half a glass
  // below the group.
  const floorY = target.y * viewport.height - 0.5 * baseScale * target.scale - 0.02

  return (
    <ContactShadows
      position={[0, floorY, 0]}
      scale={baseScale * 3}
      resolution={quality.contactShadowResolution}
      far={baseScale * 1.4}
      blur={3}
      opacity={0.42}
      smooth
    />
  )
}
