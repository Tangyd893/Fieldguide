import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

const TOKENS_PATH = resolve(__dirname, '../tokens.css')

const REQUIRED_VARS = [
  '--fg-bg',
  '--fg-card',
  '--fg-border',
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
})
