import { useEffect, useRef, useState } from 'react'
import Navbar from './ui/Navbar.jsx'
import Hero from './ui/Hero.jsx'
import FlavorSection from './ui/FlavorSection.jsx'
import About from './ui/About.jsx'
import Contact from './ui/Contact.jsx'
import Scene from './three/Scene.jsx'
import { flavors, getFlavor } from './config/flavors.js'
import { useStore } from './store/useStore.js'
import { useLenis } from './hooks/useLenis.js'
import { useScrollProgress } from './hooks/useScrollProgress.js'

export default function App() {
  const activeFlavor = useStore((state) => state.activeFlavor)
  const flavor = getFlavor(activeFlavor)

  const [gradient, setGradient] = useState(flavor.backgroundGradient)
  const [previousGradient, setPreviousGradient] = useState(null)
  const previousRef = useRef(null)
  const gradientRef = useRef(flavor.backgroundGradient)

  useLenis()
  useScrollProgress()

  // Cross-fade the backdrop instead of hard-cutting between flavors.
  useEffect(() => {
    const next = flavor.backgroundGradient
    const previous = gradientRef.current
    gradientRef.current = next

    if (previous === next) return

    setPreviousGradient(previous)
    setGradient(next)

    const timer = setTimeout(() => setPreviousGradient(null), 700)
    return () => clearTimeout(timer)
  }, [flavor.backgroundGradient])

  // The old layer mounts at full opacity, so drop it on the next frame.
  useEffect(() => {
    if (!previousRef.current) return

    const frame = requestAnimationFrame(() => {
      if (previousRef.current) previousRef.current.style.opacity = '0'
    })

    return () => cancelAnimationFrame(frame)
  }, [previousGradient])

  return (
    <div className="app" style={{ '--flavor-accent': flavor.accentColor }}>
      {previousGradient && (
        <div
          ref={previousRef}
          className="backdrop backdrop--previous"
          style={{ backgroundImage: previousGradient }}
        />
      )}
      <div className="backdrop" style={{ backgroundImage: gradient }} />

      <Scene />
      <Navbar />

      <main className="page">
        <Hero />

        {flavors.map((flavorItem, index) => (
          <FlavorSection
            key={flavorItem.id}
            flavor={flavorItem}
            index={index + 1}
          />
        ))}

        <About />
        <Contact />
      </main>
    </div>
  )
}
