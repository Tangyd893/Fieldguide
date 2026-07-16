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
/** Fixed embed token — Fieldguide protocol does not enforce auth; this bypasses UA TokenGate. */
export const DASHBOARD_EMBED_TOKEN = 'fieldguide-embed'

/**
 * MUST run before app.ready(). Without privileged registration, Chromium will
 * refuse ES module scripts / fetch under ua-dashboard:// — iframe stays blank
 * while the Fieldguide shell still shows node counts from IPC.
 */
export function registerDashboardScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: DASHBOARD_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ])
}

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
/** Path to a project's diff-overlay.json to serve */
let diffOverlayPath: string | null = null

export function setDashboardGraph(projectRoot: string | null): void {
  if (projectRoot) {
    const p = join(projectRoot, '.understand-anything', 'knowledge-graph.json')
    projectGraphPath = existsSync(p) ? p : null
    const d = join(projectRoot, '.understand-anything', 'diff-overlay.json')
    diffOverlayPath = existsSync(d) ? d : null
  } else {
    projectGraphPath = null
    diffOverlayPath = null
  }
}

export function setDashboardDiffOverlay(projectRoot: string): void {
  const d = join(projectRoot, '.understand-anything', 'diff-overlay.json')
  diffOverlayPath = existsSync(d) ? d : null
}

function findDashboardDist(): string {
  const candidates = [
    // Dev / bootstrap: Fieldguide resources/dashboard (pnpm bootstrap:ua)
    join(process.cwd(), 'resources', 'dashboard'),
    join(app.getAppPath(), 'resources', 'dashboard'),
    join(app.getAppPath(), '..', '..', 'resources', 'dashboard'),
    // Packaged app: electron-builder extraResources → resources/dashboard
    join(process.resourcesPath, 'dashboard'),
    join(app.getAppPath(), '..', 'dashboard'),
    // Sibling UA build (dev without live local copy)
    join(app.getAppPath(), '..', 'Understand-Anything', 'understand-anything-plugin', 'packages', 'dashboard', 'dist'),
    join(app.getAppPath(), '..', '..', 'Understand-Anything', 'understand-anything-plugin', 'packages', 'dashboard', 'dist'),
    join(process.cwd(), '..', 'Understand-Anything', 'understand-anything-plugin', 'packages', 'dashboard', 'dist'),
  ]
  for (const p of candidates) {
    if (existsSync(join(p, 'index.html'))) return p
  }
  throw new Error(
    'Dashboard dist not found. Run: pnpm bootstrap:ua\n' +
      '(clones Understand-Anything at ua.commit, builds Dashboard, copies to resources/dashboard)',
  )
}

function findSampleGraph(): string | null {
  const candidates = [
    join(process.cwd(), 'resources', 'sample-project', '.understand-anything', 'knowledge-graph.json'),
    join(process.resourcesPath, 'sample-project', '.understand-anything', 'knowledge-graph.json'),
    join(app.getAppPath(), '..', '..', 'resources', 'sample-project', '.understand-anything', 'knowledge-graph.json'),
  ]
  return candidates.find((p) => existsSync(p)) ?? null
}

/**
 * Injected early — bypass UA TokenGate when embedded in Fieldguide.
 * Must run before the Dashboard React app boots.
 */
const EMBED_AUTH_SCRIPT = `
<script>
(function() {
  try {
    sessionStorage.setItem('understand-anything-token', '${DASHBOARD_EMBED_TOKEN}');
  } catch (e) { /* ignore */ }
})();
</script>
`

/**
 * Injected script that bridges Fieldguide shell ↔ UA Dashboard via postMessage.
 *
 * Protocol (both directions use `window.postMessage`):
 *   Shell → Dashboard: { source: 'fieldguide', type: 'selectNode'|..., nodeId?: string, step?: number }
 *   Dashboard → Shell: { source: 'ua-dashboard', type: 'nodeSelected'|..., nodeId?: string, step?: number }
 */
const POSTMESSAGE_BRIDGE_SCRIPT = `
<script>
(function() {
  'use strict';

  window.addEventListener('message', function(event) {
    var data = event.data;
    if (!data || data.source !== 'fieldguide') return;

    function getStore() {
      return window.__uaStore;
    }

    function run() {
      var store = getStore();
      if (!store || !store.getState) { setTimeout(run, 50); return; }
      var s = store.getState();

      switch (data.type) {
        case 'selectNode':
          if (s.selectNode) s.selectNode(data.nodeId || null);
          break;
        case 'focusNode':
          if (s.setFocusNode) s.setFocusNode(data.nodeId || null);
          break;
        case 'navigateToNode':
          if (s.navigateToNode) s.navigateToNode(data.nodeId);
          break;
        case 'startTour':
          if (s.startTour) s.startTour();
          break;
        case 'stopTour':
          if (s.stopTour) s.stopTour();
          break;
        case 'setTourStep':
          if (s.setTourStep) s.setTourStep(data.step || 0);
          break;
        case 'nextTourStep':
          if (s.nextTourStep) s.nextTourStep();
          break;
        case 'prevTourStep':
          if (s.prevTourStep) s.prevTourStep();
          break;
        case 'navigateToOverview':
          if (s.navigateToOverview) s.navigateToOverview();
          break;
        case 'setViewMode':
          if (s.setViewMode) s.setViewMode(data.mode);
          break;
        case 'setDiffOverlay':
          if (s.setDiffOverlay) s.setDiffOverlay(data.changed || [], data.affected || []);
          break;
        case 'clearDiffOverlay':
          if (s.clearDiffOverlay) s.clearDiffOverlay();
          break;
        case 'drillIntoLayer':
          if (s.drillIntoLayer) s.drillIntoLayer(data.layerId);
          break;
        case 'setTheme':
          if (data.colors) {
            var root = document.documentElement;
            var c = data.colors;
            // Map Fieldguide tokens → UA Dashboard CSS variables (--color-*)
            if (c.background) root.style.setProperty('--color-root', c.background);
            if (c.card) {
              root.style.setProperty('--color-surface', c.card);
              root.style.setProperty('--color-elevated', c.card);
            }
            if (c.text) root.style.setProperty('--color-text-primary', c.text);
            if (c.muted) root.style.setProperty('--color-text-muted', c.muted);
            if (c.accent) {
              root.style.setProperty('--color-accent', c.accent);
              root.style.setProperty('--color-accent-bright', c.accent);
            }
            if (c.accentMuted) root.style.setProperty('--color-accent-dim', c.accentMuted);
            if (c.border) {
              root.style.setProperty('--color-border-subtle', c.border);
              root.style.setProperty('--color-border-medium', c.border);
            }
            if (c.scrollbarThumb) root.style.setProperty('--scrollbar-thumb', c.scrollbarThumb);
            // Only light|dark — never pass shell preset names as data-theme
            var mode = 'light';
            if (c.mode === 'dark') mode = 'dark';
            else if (c.mode === 'system' && window.matchMedia) {
              mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            } else if (c.background) {
              var hex = String(c.background).replace('#', '');
              if (hex.length === 6) {
                var r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
                var lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                mode = lum < 0.45 ? 'dark' : 'light';
              }
            }
            root.setAttribute('data-theme', mode);
            if (c.background) document.body.style.backgroundColor = c.background;
          }
          break;
        case 'setChromeless':
          document.documentElement.classList.toggle('fg-chromeless', !!data.chromeless);
          var chromeHeader = document.querySelector('header');
          if (chromeHeader) chromeHeader.style.display = data.chromeless ? 'none' : '';
          break;
      }
    }
    run();
  });

  var lastSelectedNodeId = null;
  var lastTourStep = null;
  setInterval(function() {
    if (window.parent === window) return;
    var store = window.__uaStore;
    if (!store || !store.getState) return;
    var state = store.getState();
    var nodeId = state.selectedNodeId || state.focusNodeId || null;
    if (nodeId !== lastSelectedNodeId) {
      lastSelectedNodeId = nodeId;
      if (nodeId) {
        window.parent.postMessage({ source: 'ua-dashboard', type: 'nodeSelected', nodeId: nodeId }, '*');
      }
    }
    var tourStep = state.tourStep ?? state.tourStepIndex ?? state.currentTourStep ?? null;
    if (tourStep !== lastTourStep) {
      lastTourStep = tourStep;
      if (tourStep != null) {
        window.parent.postMessage({ source: 'ua-dashboard', type: 'tourStepChanged', step: tourStep }, '*');
      }
    }
  }, 150);
})();
</script>
`

export function registerDashboardProtocol(): string {
  const distDir = findDashboardDist()

  protocol.handle(DASHBOARD_SCHEME, (request) => {
    const url = new URL(request.url)
    let pathname = url.pathname
    // ua-dashboard://dashboard/index.html → host=dashboard, path=/index.html
    // Also accept ua-dashboard:///assets/... absolute-from-root asset URLs
    if (pathname.startsWith('/')) pathname = pathname.slice(1)
    if (pathname.startsWith('dashboard/')) pathname = pathname.slice('dashboard/'.length)
    if (!pathname || pathname === 'dashboard') pathname = 'index.html'

    // Intercept knowledge-graph.json — project graph, else sample fallback
    if (pathname === 'knowledge-graph.json' || pathname.endsWith('/knowledge-graph.json')) {
      const graphFile = (projectGraphPath && existsSync(projectGraphPath))
        ? projectGraphPath
        : findSampleGraph()
      if (graphFile) {
        try {
          const data = readFileSync(graphFile)
          return new Response(data, {
            status: 200,
            headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' },
          })
        } catch { /* fall through */ }
      }
    }

    // Intercept diff-overlay.json
    if ((pathname === 'diff-overlay.json' || pathname.endsWith('/diff-overlay.json'))
      && diffOverlayPath && existsSync(diffOverlayPath)) {
      try {
        const data = readFileSync(diffOverlayPath)
        return new Response(data, {
          status: 200,
          headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' },
        })
      } catch { /* fall through */ }
    }

    const filePath = join(distDir, pathname)
    if (!filePath.startsWith(distDir)) return new Response('Forbidden', { status: 403 })
    if (!existsSync(filePath)) return new Response('Not Found', { status: 404 })

    const ext = extname(filePath).toLowerCase()
    try {
      let content = readFileSync(filePath)

      if (pathname === 'index.html' || pathname.endsWith('/index.html')) {
        const html = content.toString('utf-8')
        const injected = html.replace(
          '</head>',
          EMBED_AUTH_SCRIPT + POSTMESSAGE_BRIDGE_SCRIPT + '\n</head>',
        )
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

  return `${DASHBOARD_SCHEME}://dashboard/index.html?token=${DASHBOARD_EMBED_TOKEN}`
}
