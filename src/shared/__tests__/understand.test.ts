import { describe, it, expect } from 'vitest'
import { migratePanelTabs, ALL_PANEL_TABS, LAYOUT_PRESETS } from '../understand'

describe('migratePanelTabs', () => {
  it('upgrades legacy four-tab layouts to full V1 catalog', () => {
    const tabs = migratePanelTabs(['graph', 'code', 'chat', 'tour'])
    expect(tabs).toEqual(ALL_PANEL_TABS)
    expect(tabs).toContain('overview')
    expect(tabs).toContain('knowledge')
    expect(tabs).toContain('interview')
  })

  it('handles empty / invalid input', () => {
    expect(migratePanelTabs(undefined)).toEqual(ALL_PANEL_TABS)
    expect(migratePanelTabs(['nope'])).toEqual(ALL_PANEL_TABS)
  })
})

describe('LAYOUT_PRESETS', () => {
  it('includes recommended understanding layouts', () => {
    const ids = LAYOUT_PRESETS.map(p => p.id)
    expect(ids).toContain('overview-graph')
    expect(ids).toContain('knowledge-code')
    expect(ids).toContain('interview-chat')
  })
})
