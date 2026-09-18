/**
 * Accessibility and motion rules in the shell stylesheet.
 *
 * These are cheap to get wrong and easy to regress (Tailwind's preflight removes
 * the UA focus outline), so they get an explicit guard.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

const CSS = readFileSync(resolve(__dirname, '../../index.css'), 'utf-8')

describe('shell accessibility css', () => {
  it('draws a visible keyboard focus ring from tokens', () => {
    expect(CSS).toMatch(/:focus-visible\s*\{/)
    const block = CSS.slice(CSS.indexOf(':focus-visible'))
    expect(block).toContain('outline: 2px solid var(--fg-accent)')
  })

  it('does not draw the ring for pointer interaction', () => {
    expect(CSS).toMatch(/:focus:not\(:focus-visible\)/)
  })

  it('honours prefers-reduced-motion', () => {
    expect(CSS).toContain('@media (prefers-reduced-motion: reduce)')
    const block = CSS.slice(CSS.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(block).toContain('animation-duration: 0.001ms !important')
    expect(block).toContain('transition-duration: 0.001ms !important')
  })
})
