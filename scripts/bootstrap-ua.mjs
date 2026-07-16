#!/usr/bin/env node
/**
 * Bootstrap Understand-Anything sibling + Dashboard dist for Fieldguide.
 *
 * 1. Clone (or update) ../Understand-Anything at package.json ua.commit
 * 2. Install + build UA Dashboard
 * 3. Copy dist → resources/dashboard (so GraphPanel works without live sibling lookup)
 *
 * Usage: node scripts/bootstrap-ua.mjs
 *        pnpm bootstrap:ua
 */
import { existsSync, mkdirSync, cpSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'))
const uaRepo = pkg?.ua?.repo || 'https://github.com/Egonex-AI/Understand-Anything'
const uaCommit = pkg?.ua?.commit
if (!uaCommit) {
  console.error('[bootstrap-ua] ERROR: package.json missing ua.commit')
  process.exit(1)
}

const uaRoot = join(root, '..', 'Understand-Anything')
const pluginRoot = join(uaRoot, 'understand-anything-plugin')
const dashboardPkg = join(pluginRoot, 'packages', 'dashboard')
const dashboardDist = join(dashboardPkg, 'dist')
const localDashboard = join(root, 'resources', 'dashboard')

function run(cmd, cwd, opts = {}) {
  console.log(`[bootstrap-ua] $ ${cmd}`)
  execSync(cmd, { cwd, stdio: 'inherit', ...opts })
}

function git(cmd, cwd) {
  return execSync(`git ${cmd}`, { cwd, encoding: 'utf-8' }).trim()
}

console.log('[bootstrap-ua] Fieldguide UA bootstrap')
console.log(`  repo:   ${uaRepo}`)
console.log(`  commit: ${uaCommit}`)
console.log(`  target: ${uaRoot}`)

// ── 1. Clone or fetch ──────────────────────────────────────────────
if (!existsSync(join(uaRoot, '.git'))) {
  if (existsSync(uaRoot)) {
    console.error(`[bootstrap-ua] ERROR: ${uaRoot} exists but is not a git repo`)
    process.exit(1)
  }
  run(`git clone ${uaRepo} "${uaRoot}"`, dirname(uaRoot))
} else {
  console.log('[bootstrap-ua] UA repo already present — fetching')
  try {
    run('git fetch --all --tags', uaRoot)
  } catch {
    console.warn('[bootstrap-ua] WARNING: git fetch failed; using local commits')
  }
}

const head = git('rev-parse HEAD', uaRoot)
if (head !== uaCommit) {
  console.log(`[bootstrap-ua] Checking out ${uaCommit.slice(0, 7)} (was ${head.slice(0, 7)})`)
  try {
    run(`git checkout ${uaCommit}`, uaRoot)
  } catch {
    console.error(
      `[bootstrap-ua] ERROR: cannot checkout ${uaCommit}.\n` +
        '  Try: cd ../Understand-Anything && git fetch && git checkout ' + uaCommit,
    )
    process.exit(1)
  }
} else {
  console.log(`[bootstrap-ua] Already at ${uaCommit.slice(0, 7)}`)
}

if (!existsSync(dashboardPkg)) {
  console.error(`[bootstrap-ua] ERROR: Dashboard package missing at ${dashboardPkg}`)
  process.exit(1)
}

// ── 1b. Patch Dashboard to expose Zustand store for Fieldguide bridge ─
// Locked UA commit does not set window.__uaStore; Fieldguide postMessage bridge requires it.
const mainTsx = join(dashboardPkg, 'src', 'main.tsx')
if (existsSync(mainTsx)) {
  let mainSrc = readFileSync(mainTsx, 'utf-8')
  if (!mainSrc.includes('__uaStore')) {
    if (!mainSrc.includes('useDashboardStore')) {
      mainSrc = mainSrc.replace(
        'import App from "./App";',
        'import App from "./App";\nimport { useDashboardStore } from "./store";\n\n;(window as unknown as { __uaStore: typeof useDashboardStore }).__uaStore = useDashboardStore;',
      )
    } else if (!mainSrc.includes('__uaStore')) {
      mainSrc +=
        '\n;(window as unknown as { __uaStore: typeof useDashboardStore }).__uaStore = useDashboardStore;\n'
    }
    if (!mainSrc.includes('__uaStore')) {
      console.error('[bootstrap-ua] ERROR: failed to patch dashboard main.tsx for __uaStore')
      process.exit(1)
    }
    writeFileSync(mainTsx, mainSrc, 'utf-8')
    console.log('[bootstrap-ua] Patched dashboard main.tsx → window.__uaStore')
  } else {
    console.log('[bootstrap-ua] Dashboard already exposes __uaStore')
  }
}

// ── 2. Install + build Dashboard ───────────────────────────────────
const installCwd = existsSync(join(pluginRoot, 'pnpm-workspace.yaml'))
  ? pluginRoot
  : uaRoot

if (!existsSync(join(installCwd, 'node_modules'))) {
  run('pnpm install', installCwd)
} else {
  console.log('[bootstrap-ua] node_modules present — skip full install (run pnpm install manually if build fails)')
}

// Prefer filter build; fall back to vite in dashboard package
try {
  run('pnpm --filter @understand-anything/dashboard build', installCwd)
} catch {
  console.warn('[bootstrap-ua] filter build failed — trying npx vite build in dashboard package')
  run('npx vite build', dashboardPkg)
}

if (!existsSync(join(dashboardDist, 'index.html'))) {
  console.error(`[bootstrap-ua] ERROR: Dashboard dist missing index.html at ${dashboardDist}`)
  process.exit(1)
}

// ── 3. Copy to Fieldguide resources/dashboard ──────────────────────
rmSync(localDashboard, { recursive: true, force: true })
mkdirSync(localDashboard, { recursive: true })
cpSync(dashboardDist, localDashboard, { recursive: true })
console.log(`[bootstrap-ua] Copied Dashboard → ${localDashboard}`)

console.log('\n[bootstrap-ua] Done.')
console.log('  Next: pnpm install   # resolve @understand-anything/core workspace')
console.log('        pnpm qa:graph  # verify Dashboard + Demo graph')
console.log('        pnpm dev')
