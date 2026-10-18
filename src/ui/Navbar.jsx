import { useEffect, useRef, useState } from 'react'
import { brand } from '../config/brand.js'
import { NAV_LINKS, HERO_ID } from '../config/sections.js'
import { getLenis, scrollToSection } from '../hooks/useLenis.js'
import './Navbar.css'

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const toggleRef = useRef(null)
  const closeRef = useRef(null)
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

  // Focus the close button on open, return focus to the toggle on close.
  useEffect(() => {
    if (open) {
      wasOpen.current = true
      closeRef.current?.focus()
      return
    }

    if (wasOpen.current) {
      wasOpen.current = false
      toggleRef.current?.focus()
    }
  }, [open])

  /**
   * A nav link, wherever it is: the bar on a desktop, the overlay on a phone.
   *
   * The menu closes first and the scroll goes out immediately, in that order. The
   * menu holds the page still while it is up, so the closing transition and the
   * scroll overlap — the veil lifts over the first third of the travel rather than
   * holding the screen for a second while the page moves behind it.
   */
  const go = (event, href) => {
    event.preventDefault()
    setOpen(false)
    scrollToSection(href)
  }

  return (
    <>
      {/*
        `inert` while the overlay is up: the bar is behind the veil, so its logo
        and its toggle would otherwise still be reachable by Tab as invisible
        controls. React 19 takes a boolean here.
      */}
      <nav className="navbar" inert={open}>
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
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        aria-hidden={!open}
        /* Scrolls on its own if the links do not fit, rather than being swallowed
           by a Lenis that is deliberately stopped while this is up. */
        data-lenis-prevent
      >
        {/*
          The hamburger sits *below* the overlay, so before this existed the menu
          opened over the only control that could close it. This button occupies
          the same 44 px corner, so the hamburger appears to turn into an X in
          place rather than the menu swallowing it.
        */}
        <button
          ref={closeRef}
          type="button"
          className="navbar__close"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        >
          <span className="navbar__icon" data-open="true" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>

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
