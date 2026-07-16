#!/usr/bin/env node
/**
 * Graph path smoke (non-GUI) — verifies everything needed before iframe shows nodes.
 *
 * Checks:
 *  1. Built-in Demo sample-project graph
 *  2. UA Dashboard dist (sibling or packaged)
 *  3. Shell bridge wiring (tourStepChanged / nodeSelected)
 *  4. HIS-Go graph if sibling present
 *
 * Usage: node scripts/graph-e2e-smoke.mjs
 */
import { existsSync, readFileSync } from 'node:fs'
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
const dashCandidates = [
  join(root, 'dist/win-unpacked/resources/dashboard/index.html'),
  join(root, '..', 'Understand-Anything', 'understand-anything-plugin', 'packages', 'dashboard', 'dist', 'index.html'),
]
const dashFound = dashCandidates.find((p) => existsSync(p))
pass = check('UA Dashboard dist available', !!dashFound, dashFound || 'not found') && pass

// ── 3. Shell bridge (static source checks) ──
const appSrc = readFileSync(join(root, 'src/renderer/App.tsx'), 'utf-8')
pass = check('Shell handles tourStepChanged', appSrc.includes("case 'tourStepChanged'")) && pass
pass = check('Shell handles nodeSelected → openFile', appSrc.includes("case 'nodeSelected'") && appSrc.includes('openFile')) && pass
const dashSrc = readFileSync(join(root, 'src/main/ua/dashboard.ts'), 'utf-8')
pass = check('Dashboard protocol / graph override', dashSrc.includes('setDashboardGraph') || dashSrc.includes('knowledge-graph')) && pass

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

console.log(`\n${pass ? 'Graph path smoke passed.' : 'Graph path smoke FAILED.'}`)
console.log('Note: iframe click→file still needs one manual check in `pnpm dev` / installed app.')
process.exit(pass ? 0 : 1)
