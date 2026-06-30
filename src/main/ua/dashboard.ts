/**
 * Dashboard embedder — custom protocol to serve UA Dashboard + project graphs.
 *
 * Phase 1: static serve of Dashboard dist files.
 * Phase 2: project-specific knowledge-graph.json override + postMessage bridge.
 */
import { app, protocol } from 'electron'
import { join, extname } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'

const DASHBOARD_SCHEME = 'ua-dashboard'

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
}

/** Path to a project's knowledge-graph.json to serve instead of the sample */
let projectGraphPath: string | null = null

export function setDashboardGraph(projectRoot: string | null): void {
  if (projectRoot) {
    const p = join(projectRoot, '.understand-anything', 'knowledge-graph.json')
    projectGraphPath = existsSync(p) ? p : null
  } else {
    projectGraphPath = null
  }
}

function findDashboardDist(): string {
  const candidates = [
    join(app.getAppPath(), '..', 'Understand-Anything', 'understand-anything-plugin', 'packages', 'dashboard', 'dist'),
    join(app.getAppPath(), '..', '..', 'Understand-Anything', 'understand-anything-plugin', 'packages', 'dashboard', 'dist'),
    join(process.cwd(), '..', 'Understand-Anything', 'understand-anything-plugin', 'packages', 'dashboard', 'dist'),
  ]
  for (const p of candidates) {
    if (existsSync(join(p, 'index.html'))) return p
  }
  throw new Error('Dashboard dist not found. Build it: cd ../Understand-Anything/.../dashboard && npm run build')
}

/**
 * Injected script that bridges Fieldguide shell ↔ UA Dashboard via postMessage.
 *
 * Protocol (both directions use `window.postMessage`):
 *   Shell → Dashboard: { source: 'fieldguide', type: 'selectNode'|'focusNode'|..., nodeId?: string, step?: number }
 *   Dashboard → Shell: { source: 'ua-dashboard', type: 'nodeSelected'|'tourStepChanged'|..., nodeId?: string, step?: number }
 */
const POSTMESSAGE_BRIDGE_SCRIPT = `
<script>
(function() {
  'use strict';

  // ── Receive commands from Fieldguide shell ──
  window.addEventListener('message', function(event) {
    var data = event.data;
    if (!data || data.source !== 'fieldguide') return;

    // Defer until Zustand store is available (poll for it)
    function withStore(fn) {
      var maxTries = 100;
      var tries = 0;
      function tryGet() {
        // Zustand stores expose getState/setState on the hook itself,
        // but we need to find the store instance. The Dashboard's
        // useDashboardStore is a Zustand hook — its getState() is on
        // the hook function.
        var el = document.getElementById('root');
        if (!el) { tries++; if (tries < maxTries) setTimeout(tryGet, 50); return; }
        // Access React fiber to find the store — or wait for a global
        // that we'll expose below
        fn();
      }
      tryGet();
    }

    // The Dashboard's main.tsx will expose __uaStore on window
    // after the store is created. We'll poll for it.
    function getStore() {
      return window.__uaStore;
    }

    function run() {
      var store = getStore();
      if (!store) { setTimeout(run, 50); return; }

      switch (data.type) {
        case 'selectNode':
          store.selectNode(data.nodeId || null);
          break;
        case 'focusNode':
          store.setFocusNode(data.nodeId || null);
          break;
        case 'navigateToNode':
          store.navigateToNode(data.nodeId);
          break;
        case 'startTour':
          store.startTour();
          break;
        case 'stopTour':
          store.stopTour();
          break;
        case 'setTourStep':
          store.setTourStep(data.step || 0);
          break;
        case 'nextTourStep':
          store.nextTourStep();
          break;
        case 'prevTourStep':
          store.prevTourStep();
          break;
        case 'navigateToOverview':
          store.navigateToOverview();
          break;
        case 'setViewMode':
          store.setViewMode(data.mode);
          break;
      }
    }
    run();
  });

  // ── Expose store when available (poll for Zustand) ──
  // We look for the store by intercepting Zustand's createStore
  var _origCreate = window.__ZUSTAND_ORIGINAL__;
  var pollInterval = setInterval(function() {
    // Try to find the store via React internals on the root fiber
    try {
      var rootEl = document.getElementById('root');
      if (!rootEl) return;
      var fiberKey = Object.keys(rootEl).find(function(k) { return k.startsWith('__reactFiber'); });
      if (!fiberKey) return;
      // Walk fiber tree to find a component that uses useDashboardStore
      function walkFiber(fiber, depth) {
        if (!fiber || depth > 50) return;
        if (fiber.memoizedState && fiber.memoizedState.queue) {
          // This might be a hook state — check if it has store-like methods
        }
        walkFiber(fiber.child, depth + 1);
        walkFiber(fiber.sibling, depth + 1);
      }
    } catch(e) {}
  }, 200);

  // ── Send events to Fieldguide shell on store changes ──
  // We use a MutationObserver to detect node selection in the sidebar
  var observer = new MutationObserver(function() {
    if (window.parent === window) return;
    // Look for the "NodeInfo" sidebar content
    var nodeInfo = document.querySelector('[data-testid="node-info"]');
    if (nodeInfo) {
      // NodeInfo is rendered when a node is selected
      window.parent.postMessage({ source: 'ua-dashboard', type: 'nodeSelected' }, '*');
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
</script>`

export function registerDashboardProtocol(): string {
  const distDir = findDashboardDist()

  protocol.handle(DASHBOARD_SCHEME, (request) => {
    const url = new URL(request.url)
    let pathname = url.pathname
    if (pathname.startsWith('/')) pathname = pathname.slice(1)
    if (!pathname) pathname = 'index.html'

    // Intercept knowledge-graph.json — serve project graph if available
    if (pathname === 'knowledge-graph.json' && projectGraphPath && existsSync(projectGraphPath)) {
      try {
        const data = readFileSync(projectGraphPath)
        return new Response(data, {
          status: 200,
          headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' },
        })
      } catch { /* fall through to sample */ }
    }

    const filePath = join(distDir, pathname)
    if (!filePath.startsWith(distDir)) return new Response('Forbidden', { status: 403 })
    if (!existsSync(filePath)) return new Response('Not Found', { status: 404 })

    const ext = extname(filePath).toLowerCase()
    try {
      let content = readFileSync(filePath)

      // Inject postMessage bridge into index.html
      if (pathname === 'index.html') {
        const html = content.toString('utf-8')
        const injected = html.replace('</head>', POSTMESSAGE_BRIDGE_SCRIPT + '\n</head>')
        content = Buffer.from(injected, 'utf-8')
      }

      return new Response(content, {
        status: 200,
        headers: { 'content-type': MIME_TYPES[ext] || 'application/octet-stream', 'access-control-allow-origin': '*' },
      })
    } catch {
      return new Response('Internal Error', { status: 500 })
    }
  })

  return `${DASHBOARD_SCHEME}://dashboard/index.html`
}
