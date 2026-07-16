/**
 * Materialize pnpm workspace symlinks before electron-builder packaging.
 * electron-builder cannot pack files outside the project root via symlinks.
 */
import { cpSync, lstatSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function materializeDir(dest, src) {
  if (!existsSync(src)) {
    throw new Error(`Missing source for packaging: ${src}`)
  }
  rmSync(dest, { recursive: true, force: true })
  mkdirSync(dirname(dest), { recursive: true })
  cpSync(src, dest, {
    recursive: true,
    dereference: true,
    filter: (srcPath) => !srcPath.includes(`${join('dist', '__tests__')}`),
  })
  console.log(`[prepare-pack] materialized ${dest}`)
}

function materializeIfSymlink(dest, src) {
  if (!existsSync(dest)) {
    materializeDir(dest, src)
    return
  }
  const stat = lstatSync(dest)
  if (stat.isSymbolicLink()) {
    materializeDir(dest, src)
  }
}

const uaRoot = join(root, '..', 'Understand-Anything', 'understand-anything-plugin', 'packages')

// ── Dashboard dist guard ───────────────────────────────────────────
const dashboardSrc = join(uaRoot, 'dashboard', 'dist')
const dashboardIndex = join(dashboardSrc, 'index.html')
if (!existsSync(dashboardIndex)) {
  console.error(
    `[prepare-pack] ERROR: Dashboard dist not found at ${dashboardSrc}\n` +
    '  Build the UA Dashboard first, or run: cd ../Understand-Anything/understand-anything-plugin && pnpm build\n' +
    '  Without the dashboard, the Code Map view will not render.',
  )
  process.exit(1)
}
console.log(`[prepare-pack] Dashboard dist OK: ${dashboardSrc}`)

// ── UA commit guard ────────────────────────────────────────────────
const pkgPath = join(root, 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
const expectedCommit = pkg?.ua?.commit
if (expectedCommit) {
  const uaRepo = join(root, '..', 'Understand-Anything')
  try {
    const actual = execSync('git rev-parse HEAD', { cwd: uaRepo, encoding: 'utf-8' }).trim()
    if (actual !== expectedCommit) {
      console.warn(
        `[prepare-pack] WARNING: UA repo commit mismatch!\n` +
        `  Expected: ${expectedCommit}\n` +
        `  Actual:   ${actual}\n` +
        `  Run: cd ../Understand-Anything && git checkout ${expectedCommit}\n` +
        `  (continuing anyway — the build may fail if APIs have changed)`,
      )
    } else {
      console.log(`[prepare-pack] UA commit verified: ${expectedCommit.slice(0, 7)}`)
    }
  } catch {
    console.warn('[prepare-pack] WARNING: Could not verify UA repo commit (not a git repo?)')
  }
}

materializeIfSymlink(
  join(root, 'node_modules', '@understand-anything', 'core'),
  join(uaRoot, 'core'),
)

const dartWasmSrc = join(uaRoot, 'tree-sitter-dart-wasm')
const dartWasmDest = join(root, 'node_modules', '@understand-anything', 'tree-sitter-dart-wasm')
if (existsSync(dartWasmSrc)) {
  materializeIfSymlink(dartWasmDest, dartWasmSrc)
}

console.log('[prepare-pack] done')
