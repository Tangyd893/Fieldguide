/**
 * Dashboard embedder — custom protocol to serve UA Dashboard + project graphs.
 *
 * Phase 1: static serve of Dashboard dist files.
 * Phase 2: project-specific knowledge-graph.json override + postMessage bridge.
 */
import { app, protocol } from 'electron'
import { join, extname } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { buildUARuntimeConfig } from './config-bridge'
import { ensureProjectGraphLayers, ensureLayersInGraphJson } from './ensure-layers'
import { projectRootFromGraphFile, readProjectSourceFile } from './file-content'

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
/** Absolute project root currently bound to the Dashboard (for /file-content.json) */
let projectRootPath: string | null = null
/** Path to a project's diff-overlay.json to serve */
let diffOverlayPath: string | null = null

export function setDashboardGraph(projectRoot: string | null): void {
  if (projectRoot) {
    projectRootPath = projectRoot
    const p = join(projectRoot, '.understand-anything', 'knowledge-graph.json')
    projectGraphPath = existsSync(p) ? p : null
    const d = join(projectRoot, '.understand-anything', 'diff-overlay.json')
    diffOverlayPath = existsSync(d) ? d : null
    // Repair empty layers on project switch (HIS-Go structure-only indexes)
    if (projectGraphPath) {
      try {
        ensureProjectGraphLayers(projectRoot)
      } catch (err) {
        console.warn('[dashboard] ensure layers failed:', err)
      }
    }
  } else {
    projectRootPath = null
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
    // Skip UA first-visit overlay — Fieldguide has its own onboarding
    localStorage.setItem('ua-onboarding-dismissed-v1', '1');
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
            var root = window.document.documentElement;
            var c = data.colors;
            // Map Fieldguide tokens → UA Dashboard CSS variables (--color-*)
            if (c.background) root.style.setProperty('--color-root', c.background);
            if (c.card) {
              root.style.setProperty('--color-surface', c.card);
              root.style.setProperty('--color-elevated', c.card);
            }
            if (c.text) root.style.setProperty('--color-text-primary', c.text);
            if (c.muted) {
              root.style.setProperty('--color-text-muted', c.muted);
              root.style.setProperty('--color-text-secondary', c.muted);
            }
            if (c.tertiary) {
              root.style.setProperty('--color-text-muted', c.tertiary);
            }
            if (c.accent) {
              root.style.setProperty('--color-accent', c.accent);
              root.style.setProperty('--color-accent-bright', c.accent);
              // Readable overlays on parchment / light shells
              root.style.setProperty('--color-accent-overlay-bg', 'color-mix(in srgb, ' + c.accent + ' 12%, transparent)');
              root.style.setProperty('--color-accent-overlay-border', 'color-mix(in srgb, ' + c.accent + ' 35%, transparent)');
            }
            if (c.accentMuted) root.style.setProperty('--color-accent-dim', c.accentMuted);
            if (c.accentText) {
              // Prefer darker accent label color for light mode chips
              root.style.setProperty('--fg-accent-label', c.accentText);
            }
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
            if (c.background) window.document.body.style.backgroundColor = c.background;
            // Light-mode contrast pack — UA defaults are dark-theme (amber-200, vsDark prism)
            var styleEl = window.document.getElementById('fg-embed-contrast');
            if (!styleEl) {
              styleEl = window.document.createElement('style');
              styleEl.id = 'fg-embed-contrast';
              window.document.head.appendChild(styleEl);
            }
            if (mode === 'light') {
              var accentLabel = (c.accentText || c.accent || '#1F5C4A');
              styleEl.textContent = [
                /* Warning / error banners (Tailwind amber-* / red-* on parchment) */
                '[data-theme="light"] [class*="bg-amber-900"],[data-theme="light"] [class*="bg-amber-800"]{background-color:#FDE68A!important;border-color:#B45309!important;color:#78350F!important;}',
                '[data-theme="light"] [class*="bg-amber-900"] *,[data-theme="light"] [class*="bg-amber-800"] *{color:#78350F!important;}',
                '[data-theme="light"] [class*="text-amber-200"],[data-theme="light"] [class*="text-amber-300"],[data-theme="light"] [class*="text-amber-400"]{color:#78350F!important;}',
                '[data-theme="light"] [class*="border-amber-700"],[data-theme="light"] [class*="border-amber-600"]{border-color:#B45309!important;}',
                '[data-theme="light"] [class*="bg-red-900"],[data-theme="light"] [class*="bg-red-800"]{background-color:#FECACA!important;border-color:#B91C1C!important;color:#7F1D1D!important;}',
                '[data-theme="light"] [class*="bg-red-900"] *,[data-theme="light"] [class*="bg-red-800"] *{color:#7F1D1D!important;}',
                '[data-theme="light"] [class*="text-red-200"],[data-theme="light"] [class*="text-red-400"]{color:#7F1D1D!important;}',
                /* Toolbar chips: accent fill must use dark ink, not near-white */
                '[data-theme="light"] .text-accent,[data-theme="light"] [class*="text-accent"]{color:' + accentLabel + '!important;}',
                '[data-theme="light"] [class*="bg-accent/"]{color:' + accentLabel + '!important;}',
                '[data-theme="light"] button[class*="bg-accent/"]{color:' + accentLabel + '!important;}',
                /* Muted copy */
                '[data-theme="light"] .text-text-muted,[data-theme="light"] [class*="text-text-muted"],[data-theme="light"] .text-text-secondary{color:#57534E!important;}',
                '[data-theme="light"] .text-text-primary{color:#1C1917!important;}',
                /* CodeViewer always uses prism vsDark — force readable ink on light bg */
                '[data-theme="light"] .bg-root pre,[data-theme="light"] .bg-root pre *{color:#1E293B!important;}',
                '[data-theme="light"] .bg-root pre span[style]{color:#1E293B!important;}',
                '[data-theme="light"] .bg-root pre .token.comment,[data-theme="light"] .bg-root pre span[class*="comment"]{color:#64748B!important;}',
                '[data-theme="light"] .bg-root pre .token.string,[data-theme="light"] .bg-root pre span[class*="string"]{color:#047857!important;}',
                '[data-theme="light"] .bg-root pre .token.keyword,[data-theme="light"] .bg-root pre span[class*="keyword"]{color:#6D28D9!important;}',
                '[data-theme="light"] .bg-root pre .token.number,[data-theme="light"] .bg-root pre span[class*="number"]{color:#C2410C!important;}',
                '[data-theme="light"] .bg-root pre .token.tag,[data-theme="light"] .bg-root pre span[class*="tag"]{color:#0369A1!important;}',
                '[data-theme="light"] .bg-root pre .token.attr-name,[data-theme="light"] .bg-root pre span[class*="attr"]{color:#A16207!important;}',
              ].join('');
            } else {
              styleEl.textContent = '';
            }
          }
          break;
        case 'viewportZoomIn':
          if (s.reactFlowInstance && s.reactFlowInstance.zoomIn) s.reactFlowInstance.zoomIn({ duration: 120 });
          break;
        case 'viewportZoomOut':
          if (s.reactFlowInstance && s.reactFlowInstance.zoomOut) s.reactFlowInstance.zoomOut({ duration: 120 });
          break;
        case 'viewportZoomReset':
          if (s.reactFlowInstance && s.reactFlowInstance.fitView) {
            s.reactFlowInstance.fitView({ padding: 0.15, duration: 200 });
          } else if (s.reactFlowInstance && s.reactFlowInstance.setViewport) {
            s.reactFlowInstance.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 200 });
          }
          break;
        case 'setChromeless':
          window.document.documentElement.classList.toggle('fg-chromeless', !!data.chromeless);
          var chromeHeader = window.document.querySelector('header');
          if (chromeHeader) chromeHeader.style.display = data.chromeless ? 'none' : '';
          break;
      }
    }
    run();
  });

  var lastSelectedNodeId = null;
  var lastTourStep = null;
  var lastLayoutBusy = null;
  var lastLayoutNodeCount = -1;
  setInterval(function() {
    if (window.parent === window) return;
    var store = window.__uaStore;
    if (!store || !store.getState) return;
    var state = store.getState();
    var nodeId = state.selectedNodeId || state.focusNodeId || null;
    if (nodeId !== lastSelectedNodeId) {
      lastSelectedNodeId = nodeId;
      if (nodeId) {
        var filePath = null;
        try {
          var g = state.graph || (state.viewMode === 'domain' ? state.domainGraph : null);
          var nodes = (g && g.nodes) ? g.nodes : [];
          for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].id === nodeId) {
              filePath = nodes[i].filePath || null;
              break;
            }
          }
        } catch (e) { /* ignore */ }
        window.parent.postMessage({
          source: 'ua-dashboard',
          type: 'nodeSelected',
          nodeId: nodeId,
          filePath: filePath,
        }, '*');
      }
    }
    var tourStep = state.tourStep ?? state.tourStepIndex ?? state.currentTourStep ?? null;
    if (tourStep !== lastTourStep) {
      lastTourStep = tourStep;
      if (tourStep != null) {
        window.parent.postMessage({ source: 'ua-dashboard', type: 'tourStepChanged', step: tourStep }, '*');
      }
    }
    // Layout progress for large graphs (HIS-Go etc.) — shell shows a wait overlay
    var nodeCount = (state.graph && state.graph.nodes) ? state.graph.nodes.length : 0;
    var layerCount = (state.graph && state.graph.layers) ? state.graph.layers.length : 0;
    var rendered = window.document.querySelectorAll('.react-flow__node').length;
    var busy = nodeCount > 0 && rendered === 0;
    var reason = !busy ? 'ready' : (layerCount === 0 ? 'no-layers' : 'layout');
    if (busy !== lastLayoutBusy || nodeCount !== lastLayoutNodeCount) {
      lastLayoutBusy = busy;
      lastLayoutNodeCount = nodeCount;
      window.parent.postMessage({
        source: 'ua-dashboard',
        type: 'layoutStatus',
        busy: busy,
        reason: reason,
        nodeCount: nodeCount,
        layerCount: layerCount,
        renderedNodes: rendered,
      }, '*');
    }
  }, 150);

  // Ctrl/Cmd + wheel → React Flow viewport zoom (menu shortcuts handled via postMessage from shell)
  window.addEventListener('wheel', function(e) {
    if (!(e.ctrlKey || e.metaKey)) return;
    var store = window.__uaStore;
    if (!store || !store.getState) return;
    var rf = store.getState().reactFlowInstance;
    if (!rf) return;
    e.preventDefault();
    if (e.deltaY < 0) {
      if (rf.zoomIn) rf.zoomIn({ duration: 80 });
    } else if (rf.zoomOut) {
      rf.zoomOut({ duration: 80 });
    }
  }, { passive: false });
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

    // Serve locale for UA I18nProvider (config.json → outputLanguage)
    if (pathname === 'config.json' || pathname.endsWith('/config.json')) {
      try {
        const { language } = buildUARuntimeConfig()
        const body = JSON.stringify({ outputLanguage: language })
        return new Response(body, {
          status: 200,
          headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' },
        })
      } catch {
        return new Response(JSON.stringify({ outputLanguage: 'zh' }), {
          status: 200,
          headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' },
        })
      }
    }

    // Intercept knowledge-graph.json — project graph, else sample fallback
    if (pathname === 'knowledge-graph.json' || pathname.endsWith('/knowledge-graph.json')) {
      const graphFile = (projectGraphPath && existsSync(projectGraphPath))
        ? projectGraphPath
        : findSampleGraph()
      if (graphFile) {
        try {
          const raw = readFileSync(graphFile)
          // Inject heuristic layers when missing — UA overview needs layers
          const body = ensureLayersInGraphJson(raw)
          return new Response(body, {
            status: 200,
            headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' },
          })
        } catch { /* fall through */ }
      }
    }

    // UA CodeViewer fetches /file-content.json?token=&path= — must return JSON (never plain "Not Found")
    if (pathname === 'file-content.json' || pathname.endsWith('/file-content.json')) {
      const graphFile = (projectGraphPath && existsSync(projectGraphPath))
        ? projectGraphPath
        : findSampleGraph()
      const root = projectRootPath
        || (graphFile ? projectRootFromGraphFile(graphFile) : null)
      const requestedPath = url.searchParams.get('path') || ''
      if (!root) {
        return new Response(JSON.stringify({ error: 'No project bound. Open a project in Fieldguide first.' }), {
          status: 404,
          headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' },
        })
      }
      const result = readProjectSourceFile(requestedPath, root, graphFile)
      return new Response(JSON.stringify(result.payload), {
        status: result.statusCode,
        headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' },
      })
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
    if (!filePath.startsWith(distDir)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' },
      })
    }
    if (!existsSync(filePath)) {
      // Prefer JSON for .json requests so Dashboard fetch().json() does not throw
      if (pathname.endsWith('.json')) {
        return new Response(JSON.stringify({ error: 'Not Found' }), {
          status: 404,
          headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' },
        })
      }
      return new Response('Not Found', { status: 404 })
    }

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
