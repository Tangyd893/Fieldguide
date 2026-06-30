/**
 * Dashboard embedder — registers custom protocol to serve UA Dashboard.
 *
 * Phase 1: static serve of Dashboard dist files.
 * Phase 2: IPC bridge for project-specific graph loading.
 */
import { app, protocol, net } from 'electron'
import { join, extname } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'

const DASHBOARD_SCHEME = 'ua-dashboard'

/** Map file extension → MIME type */
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

function findDashboardDist(): string {
  // Try multiple paths to find the Dashboard dist
  const candidates = [
    // Installed beside Fieldguide
    join(app.getAppPath(), '..', 'Understand-Anything', 'understand-anything-plugin', 'packages', 'dashboard', 'dist'),
    // In UA monorepo
    join(app.getAppPath(), '..', '..', 'Understand-Anything', 'understand-anything-plugin', 'packages', 'dashboard', 'dist'),
    // Relative to CWD
    join(process.cwd(), '..', 'Understand-Anything', 'understand-anything-plugin', 'packages', 'dashboard', 'dist'),
  ]

  for (const p of candidates) {
    if (existsSync(join(p, 'index.html'))) {
      return p
    }
  }

  throw new Error(
    'Dashboard dist not found. Build it first:\n' +
    '  cd ../Understand-Anything/understand-anything-plugin/packages/dashboard\n' +
    '  npm run build'
  )
}

export function registerDashboardProtocol(): string {
  const distDir = findDashboardDist()

  protocol.handle(DASHBOARD_SCHEME, (request) => {
    const url = new URL(request.url)
    let pathname = url.pathname

    // Remove leading slash
    if (pathname.startsWith('/')) {
      pathname = pathname.slice(1)
    }
    // Default to index.html
    if (!pathname || pathname === '') {
      pathname = 'index.html'
    }

    const filePath = join(distDir, pathname)

    // Security: ensure file is within distDir
    if (!filePath.startsWith(distDir)) {
      return new Response('Forbidden', { status: 403 })
    }

    if (!existsSync(filePath)) {
      return new Response('Not Found', { status: 404 })
    }

    const ext = extname(filePath).toLowerCase()
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream'

    try {
      const data = readFileSync(filePath)
      return new Response(data, {
        status: 200,
        headers: {
          'content-type': mimeType,
          'access-control-allow-origin': '*',
        },
      })
    } catch {
      return new Response('Internal Error', { status: 500 })
    }
  })

  return `${DASHBOARD_SCHEME}://dashboard/index.html`
}
