import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Static contract: injected postMessage bridge must talk to Zustand via getState().
 * (window.__uaStore is the create() hook — actions are not on the hook itself.)
 *
 * Runtime sim: click→nodeSelected postMessage without launching Electron.
 */
describe('dashboard postMessage bridge script', () => {
  const src = readFileSync(join(__dirname, '../dashboard.ts'), 'utf-8')

  function extractBridgeIife(): string {
    const m = src.match(
      /const POSTMESSAGE_BRIDGE_SCRIPT = `\r?\n<script>\r?\n([\s\S]*?)\r?\n<\/script>\r?\n`/,
    )
    if (!m) throw new Error('POSTMESSAGE_BRIDGE_SCRIPT not found in dashboard.ts')
    return m[1]
  }

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

  it('maps shell theme to UA --color-* variables', () => {
    expect(src).toContain('--color-root')
    expect(src).toContain('--color-surface')
    expect(src).toContain('fieldguide-embed')
  })

  it('injects embed auth to bypass TokenGate', () => {
    expect(src).toContain('understand-anything-token')
    expect(src).toContain('DASHBOARD_EMBED_TOKEN')
  })

  it('registers privileged scheme so ES modules load in the iframe', () => {
    const indexSrc = readFileSync(join(__dirname, '../../index.ts'), 'utf-8')
    expect(src).toContain('registerDashboardScheme')
    expect(src).toContain('registerSchemesAsPrivileged')
    expect(src).toContain('supportFetchAPI')
    expect(indexSrc).toContain('registerDashboardScheme()')
  })

  it('serves config.json language and reports layoutStatus', () => {
    expect(src).toContain('outputLanguage')
    expect(src).toContain('buildUARuntimeConfig')
    expect(src).toContain("type: 'layoutStatus'")
    expect(src).toContain('ua-onboarding-dismissed-v1')
  })

  it('injects light-mode contrast pack and viewport zoom bridge', () => {
    expect(src).toContain('fg-embed-contrast')
    expect(src).toContain('viewportZoomIn')
    expect(src).toContain('viewportZoomOut')
    expect(src).toContain('reactFlowInstance')
    expect(src).toContain('text-amber-200')
  })

  describe('runtime: click → nodeSelected', () => {
    let messages: unknown[]
    let selectedNodeId: string | null
    let selectNode: ReturnType<typeof vi.fn>
    let messageHandler: ((event: { data: unknown }) => void) | null
    let parentWin: { postMessage: (data: unknown, origin: string) => void }

    beforeEach(() => {
      vi.useFakeTimers()
      messages = []
      selectedNodeId = null
      selectNode = vi.fn((id: string | null) => {
        selectedNodeId = id
      })
      messageHandler = null
      parentWin = {
        postMessage: (data: unknown) => {
          messages.push(data)
        },
      }

      const store = {
        getState: () => ({
          selectedNodeId,
          focusNodeId: null as string | null,
          selectNode,
          tourStep: null as number | null,
        }),
      }

      const documentMock = {
        documentElement: {
          style: { setProperty: vi.fn() },
          classList: { toggle: vi.fn() },
          setAttribute: vi.fn(),
        },
        body: { style: {} as Record<string, string> },
        head: { appendChild: vi.fn() },
        querySelector: () => null,
        querySelectorAll: () => [],
        getElementById: () => null,
        createElement: () => ({ id: '', textContent: '' }),
      }
      const windowMock = {
        __uaStore: store,
        parent: parentWin,
        addEventListener: (type: string, handler: (event: { data: unknown }) => void) => {
          if (type === 'message') messageHandler = handler
        },
        document: documentMock,
        matchMedia: undefined,
      }

      // parent !== window so the poll loop runs
      const run = new Function('window', extractBridgeIife())
      run(windowMock)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('posts nodeSelected when selectedNodeId changes (simulates click)', () => {
      selectedNodeId = 'file:src/main.go'
      vi.advanceTimersByTime(200)
      expect(messages).toContainEqual({
        source: 'ua-dashboard',
        type: 'nodeSelected',
        nodeId: 'file:src/main.go',
        filePath: null,
      })
    })

    it('invokes selectNode via getState() on shell selectNode message', () => {
      expect(messageHandler).toBeTypeOf('function')
      messageHandler!({
        data: { source: 'fieldguide', type: 'selectNode', nodeId: 'n-42' },
      })
      expect(selectNode).toHaveBeenCalledWith('n-42')
    })
  })
})
