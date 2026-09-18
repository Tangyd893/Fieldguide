import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

const TOKENS_PATH = resolve(__dirname, '../tokens.css')

const REQUIRED_VARS = [
  '--fg-bg',
  '--fg-card',
  '--fg-border',
  '--fg-chrome-bg',
  '--fg-chrome-border',
  '--fg-text-primary',
  '--fg-text-secondary',
  '--fg-accent',
  '--fg-accent-muted',
  '--fg-tree-selected',
  '--fg-tree-hover',
  '--fg-tab-active',
  '--fg-input-bg',
  '--fg-overlay',
]

const PRESETS = ['parchment', 'forest', 'slate', 'midnight', 'paper-dark']

describe('theme tokens', () => {
  const css = readFileSync(TOKENS_PATH, 'utf-8')

  it('defines base semantic variables in :root', () => {
    for (const v of REQUIRED_VARS) {
      expect(css).toMatch(new RegExp(`${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:`))
    }
  })

  it('defines all theme presets', () => {
    for (const preset of PRESETS) {
      expect(css).toContain(`data-theme-preset="${preset}"`)
    }
  })

  it('parchment v2 uses expected background', () => {
    expect(css).toContain('--fg-bg: #FDFCF8')
    expect(css).toContain('--fg-accent: #4A8B71')
  })

  it('system dark outranks light presets (specificity guard)', () => {
    // Regression guard: without the :not() guards the system-dark block ties
    // with `:root[data-theme-preset="..."]` (0,2,0) and, appearing earlier,
    // loses — so the default parchment preset cancelled OS dark mode.
    const mediaAt = css.indexOf('@media (prefers-color-scheme: dark)')
    expect(mediaAt).toBeGreaterThan(-1)

    // Selector is the text between the media query's opening brace and the next one.
    const afterMedia = css.slice(css.indexOf('{', mediaAt) + 1)
    const selectorLine = afterMedia.slice(0, afterMedia.indexOf('{'))

    expect(selectorLine).toContain(':not([data-theme="light"])')
    expect(selectorLine).toContain(':not([data-theme-preset="midnight"])')
    expect(selectorLine).toContain(':not([data-theme-preset="paper-dark"])')

    // :root + one attribute-level token per :not() guard must exceed a preset's (0,2,0).
    const guards = [...selectorLine.matchAll(/:not\(/g)].length
    expect(guards + 1).toBeGreaterThanOrEqual(4)
  })
})
