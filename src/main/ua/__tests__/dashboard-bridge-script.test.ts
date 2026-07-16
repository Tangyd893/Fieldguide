import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Static contract: injected postMessage bridge must talk to Zustand via getState().
 * (window.__uaStore is the create() hook — actions are not on the hook itself.)
 */
describe('dashboard postMessage bridge script', () => {
  const src = readFileSync(join(__dirname, '../dashboard.ts'), 'utf-8')

  it('polls __uaStore and posts nodeSelected to parent', () => {
    expect(src).toContain("window.__uaStore")
    expect(src).toContain("type: 'nodeSelected'")
    expect(src).toContain("source: 'ua-dashboard'")
  })

  it('calls store actions through getState()', () => {
    expect(src).toContain('store.getState')
    expect(src).toMatch(/var s = store\.getState\(\)/)
    expect(src).toContain('s.selectNode')
    expect(src).not.toMatch(/store\.selectNode\(/)
  })

  it('forwards tourStepChanged from currentTourStep', () => {
    expect(src).toContain('currentTourStep')
    expect(src).toContain("type: 'tourStepChanged'")
  })
})
