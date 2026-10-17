import { useEffect, useRef, useState } from 'react'
import { brand } from '../config/brand.js'
import { NAV_LINKS, HERO_ID } from '../config/sections.js'
import { getLenis } from '../hooks/useLenis.js'
import './Navbar.css'

/** Clears the fixed navbar when a link scrolls to a section. */
const SCROLL_OFFSET = -64

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const toggleRef = useRef(null)
  const wasOpen = useRef(false)

  // Lock the page while the overlay is up, and close it on Escape.
  useEffect(() => {
    if (!open) return

    const lenis = getLenis()
    lenis?.stop()

    const handleKey = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKey)

    return () => {
      document.removeEventListener('keydown', handleKey)
      lenis?.start()
    }
  }, [open])

  // Focus the first overlay link on open, return focus to the toggle on close.
  useEffect(() => {
    if (open) {
      wasOpen.current = true
      const first = document.querySelector('.navbar__overlay a')
      first?.focus()
      return
    }

    if (wasOpen.current) {
      wasOpen.current = false
      toggleRef.current?.focus()
    }
  }, [open])

  const go = (event, href) => {
    event.preventDefault()

    const lenis = getLenis()
    if (lenis) {
      lenis.scrollTo(href, {
        offset: SCROLL_OFFSET,
        onComplete: () => setOpen(false),
      })
    } else {
      document.querySelector(href)?.scrollIntoView()
      setOpen(false)
    }
  }

  return (
    <>
      <nav className="navbar">
        <a
          className="navbar__logo"
          href={`#${HERO_ID}`}
          onClick={(event) => go(event, `#${HERO_ID}`)}
        >
          {brand.name}
        </a>

        <ul className="navbar__links">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a href={link.href} onClick={(event) => go(event, link.href)}>
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <button
          ref={toggleRef}
          type="button"
          className="navbar__toggle"
          aria-expanded={open}
          aria-controls="navbar-overlay"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="navbar__icon" data-open={open} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
      </nav>

      <div
        id="navbar-overlay"
        className={`navbar__overlay${open ? ' is-open' : ''}`}
      >
        <nav className="navbar__overlay-nav" aria-label="Sections">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(event) => go(event, link.href)}
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </>
  )
}
