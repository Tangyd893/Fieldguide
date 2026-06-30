/**
 * Dashboard embedder — custom protocol to serve UA Dashboard + project graphs.
 *
 * Phase 1: static serve of Dashboard dist files.
 * Phase 2: project-specific knowledge-graph.json override.
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
      return new Response(readFileSync(filePath), {
        status: 200,
        headers: { 'content-type': MIME_TYPES[ext] || 'application/octet-stream', 'access-control-allow-origin': '*' },
      })
    } catch {
      return new Response('Internal Error', { status: 500 })
    }
  })

  return `${DASHBOARD_SCHEME}://dashboard/index.html`
}
