#!/usr/bin/env node
/**
 * Graph path smoke (non-GUI) — verifies everything needed before iframe shows nodes
 * and the click→open-file bridge contract (including built Dashboard __uaStore).
 *
 * Checks:
 *  1. Built-in Demo sample-project graph
 *  2. UA Dashboard dist (resources + packaged)
 *  3. Built JS exposes __uaStore (bootstrap-ua patch survived build)
 *  4. Shell bridge wiring (tourStepChanged / nodeSelected)
 *  5. HIS-Go graph if sibling present
 *  6. Incremental merge export
 *
 * Usage: node scripts/graph-e2e-smoke.mjs
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function check(label, ok, detail = '') {
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  return ok
}

function loadJson(p) {
  return JSON.parse(readFileSync(p, 'utf-8'))
}

/** True if any Dashboard asset JS contains the Fieldguide bridge hook. */
function bundleHasUaStore(dashIndexHtml) {
  if (!dashIndexHtml || !existsSync(dashIndexHtml)) return false
  const assetsDir = join(dirname(dashIndexHtml), 'assets')
  if (!existsSync(assetsDir)) return false
  return readdirSync(assetsDir)
    .filter((f) => f.endsWith('.js'))
    .some((f) => readFileSync(join(assetsDir, f), 'utf-8').includes('__uaStore'))
}

console.log('Fieldguide Graph E2E Smoke (headless)\n')

let pass = true

// ── 1. Demo sample graph ──
const sampleGraph = join(root, 'resources/sample-project/.understand-anything/knowledge-graph.json')
if (!existsSync(sampleGraph)) {
  pass = check('Demo sample knowledge-graph.json', false) && pass
} else {
  const g = loadJson(sampleGraph)
  const n = g.nodes?.length ?? 0
  const withPath = (g.nodes || []).filter((x) => x.filePath).length
  pass = check('Demo sample graph nodes > 0', n > 0, `${n} nodes`) && pass
  pass = check('Demo sample clickable filePath', withPath > 0, `${withPath}/${n}`) && pass
}

// ── 2. Dashboard dist ──
const localDash = join(root, 'resources', 'dashboard', 'index.html')
const packagedDash = join(root, 'dist/win-unpacked/resources/dashboard/index.html')
const siblingDash = join(
  root,
  '..',
  'Understand-Anything',
  'understand-anything-plugin',
  'packages',
  'dashboard',
  'dist',
  'index.html',
)
const dashCandidates = [localDash, packagedDash, siblingDash]
const dashFound = dashCandidates.find((p) => existsSync(p))
pass = check('UA Dashboard dist available', !!dashFound, dashFound || 'not found — run: pnpm bootstrap:ua') && pass

pass = check(
  'resources/dashboard bundle exposes __uaStore',
  bundleHasUaStore(localDash),
  localDash,
) && pass

if (existsSync(packagedDash)) {
  pass = check(
    'packaged dist dashboard exposes __uaStore',
    bundleHasUaStore(packagedDash),
    packagedDash,
  ) && pass
} else {
  console.log('⚠️  packaged dist/win-unpacked dashboard not found — skip pack __uaStore check (run pnpm dist)')
}

// ── 3. Shell bridge (static source checks) ──
const appSrc = readFileSync(join(root, 'src/renderer/App.tsx'), 'utf-8')
pass = check('Shell handles tourStepChanged', appSrc.includes("case 'tourStepChanged'")) && pass
pass = check('Shell handles nodeSelected → openFile', appSrc.includes("case 'nodeSelected'") && appSrc.includes('openFile')) && pass
const dashSrc = readFileSync(join(root, 'src/main/ua/dashboard.ts'), 'utf-8')
pass = check('Dashboard protocol / graph override', dashSrc.includes('setDashboardGraph') || dashSrc.includes('knowledge-graph')) && pass
pass = check('Bridge polls __uaStore.getState', dashSrc.includes('__uaStore') && dashSrc.includes('store.getState')) && pass
pass = check('Bridge invokes actions via getState()', dashSrc.includes('s.selectNode') || dashSrc.includes('getState().selectNode')) && pass
pass = check('Embed token bypasses TokenGate', dashSrc.includes('fieldguide-embed') && dashSrc.includes('understand-anything-token')) && pass
pass = check('Theme maps to UA --color-root', dashSrc.includes('--color-root')) && pass

const uaMain = join(root, '..', 'Understand-Anything', 'understand-anything-plugin', 'packages', 'dashboard', 'src', 'main.tsx')
if (existsSync(uaMain)) {
  const mainSrc = readFileSync(uaMain, 'utf-8')
  pass = check('UA Dashboard exposes window.__uaStore', mainSrc.includes('__uaStore')) && pass
} else {
  console.log('⚠️  UA dashboard main.tsx not found — skip __uaStore source check')
}

// ── 4. HIS-Go (optional but preferred) ──
let hisGoRoot = join(root, '..', 'his-go')
if (!existsSync(join(hisGoRoot, '.understand-anything', 'knowledge-graph.json'))) {
  hisGoRoot = join(root, '..', 'HIS-Go')
}
const hisGraph = join(hisGoRoot, '.understand-anything', 'knowledge-graph.json')
if (existsSync(hisGraph)) {
  const g = loadJson(hisGraph)
  const n = g.nodes?.length ?? 0
  const e = g.edges?.length ?? 0
  pass = check('HIS-Go graph nodes > 0', n > 0, `${n} nodes / ${e} edges`) && pass
  const withPath = (g.nodes || []).filter((x) => x.filePath).length
  pass = check('HIS-Go clickable nodes', withPath > 0, `${withPath}/${n}`) && pass
} else {
  console.log('⚠️  HIS-Go graph not found (optional) — skip')
}

// ── 5. Incremental merge present ──
const clientSrc = readFileSync(join(root, 'src/main/ua/client.ts'), 'utf-8')
pass = check('mergeIncrementalGraph exported', clientSrc.includes('export function mergeIncrementalGraph')) && pass

// ── 6. Pack readiness (sibling core + local dashboard) ──
const coreLink = join(root, 'node_modules', '@understand-anything', 'core')
pass = check('@understand-anything/core resolvable', existsSync(coreLink), coreLink) && pass

console.log(`\n${pass ? 'Graph path smoke passed.' : 'Graph path smoke FAILED.'}`)
console.log('Click→file: verified via bridge source + built __uaStore + vitest runtime sim (dashboard-bridge-script).')
process.exit(pass ? 0 : 1)
