#!/usr/bin/env node
/**
 * his-go headless smoke test (non-GUI).
 *
 * Validates that the existing knowledge-graph.json for his-go is
 * well-formed, searchable, and ready for the Code Map view.
 *
 * Usage: node scripts/his-go-smoke.mjs
 */
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
// Try both casings (Windows is case-insensitive for existence checks)
let hisGoRoot = join(root, '..', 'his-go')
if (!existsSync(join(hisGoRoot, '.understand-anything', 'knowledge-graph.json'))) {
  hisGoRoot = join(root, '..', 'HIS-Go')
}
const graphPath = join(hisGoRoot, '.understand-anything', 'knowledge-graph.json')
if (!existsSync(graphPath)) {
  console.log('HIS-Go graph not found. Looked at:', graphPath)
  process.exit(1)
}

function check(label, ok, detail = '') {
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  return ok
}

console.log('Fieldguide his-go Smoke (headless)\n')

let pass = true

// ── 1. Project exists ──
pass = check('HIS-Go project exists', true, hisGoRoot) && pass

// ── 2. Graph file exists ──
const graphStat = readFileSync(graphPath)
pass = check('knowledge-graph.json exists', true, `${(graphStat.length / 1024).toFixed(0)} KB`) && pass

// ── 3. Parse graph ──
let graph
try {
  graph = JSON.parse(graphStat.toString('utf-8'))
  pass = check('Parse JSON', true) && pass
} catch (e) {
  pass = check('Parse JSON', false, e.message) && pass
  process.exit(1)
}

// ── 4. Structure checks ──
const nodeCount = graph?.nodes?.length ?? 0
const edgeCount = graph?.edges?.length ?? 0
pass = check('nodeCount > 0', nodeCount > 0, `${nodeCount} nodes`) && pass
pass = check('edgeCount > 0', edgeCount > 0, `${edgeCount} edges`) && pass

// ── 5. Node types ──
const types = new Map()
for (const n of (graph.nodes || [])) {
  types.set(n.type, (types.get(n.type) || 0) + 1)
}
const typeSummary = [...types.entries()].map(([t, c]) => `${t}:${c}`).join(', ')
pass = check('Node type diversity', types.size >= 2, typeSummary) && pass

// ── 6. Clickable nodes (have filePath) ──
const withPath = (graph.nodes || []).filter(n => !!n.filePath)
pass = check('Nodes with filePath (clickable)', withPath.length > 0, `${withPath.length} of ${nodeCount}`) && pass

// ── 7. Node identity (name or label) ──
const withIdentity = (graph.nodes || []).filter(n => !!(n.name || n.label))
pass = check('Nodes with name/label', withIdentity.length === nodeCount, `${withIdentity.length}/${nodeCount}`) && pass

// ── 8. Layers ──
const layerCount = graph?.layers?.length ?? 0
pass = check('Layers (LLM optional)', layerCount >= 0, layerCount > 0 ? `${layerCount} layers` : 'none') && pass

// ── 9. Tour ──
const tourItems = graph?.tour ?? []
const tourCount = Array.isArray(tourItems) ? tourItems.length : 0
pass = check('Tour (LLM optional)', tourCount >= 0, tourCount > 0 ? `${tourCount} steps` : 'none') && pass

// ── 10. Search test ──
const searchQ = 'handler'
const searchResults = (graph.nodes || []).filter(n => {
  const label = (n.label || n.name || n.id || '').toLowerCase()
  return label.includes(searchQ)
})
pass = check(`Search "${searchQ}"`, searchResults.length > 0, `${searchResults.length} matches`) && pass

// ── 11. Entry point ──
const entry = (graph.nodes || []).find(n =>
  n.filePath?.includes('cmd/') || n.id?.includes('main') || (n.name || '').toLowerCase() === 'main'
)
pass = check('Entry point (cmd/main)', !!entry, entry?.id || 'none') && pass

// ── 12. File tree correlation ──
const fileSet = new Set()
for (const n of (graph.nodes || [])) {
  if (n.filePath) fileSet.add(n.filePath)
}
pass = check('Unique files in graph', fileSet.size > 0, `${fileSet.size} files`) && pass

// ── 13. Version / meta ──
const analyzedAt = graph?.project?.analyzedAt || graph?.meta?.analyzedAt
pass = check('Analyzed timestamp', !!analyzedAt, analyzedAt || 'missing') && pass

// ── Summary ──
console.log(`\n${'─'.repeat(50)}`)
console.log(`his-go graph summary:`)
console.log(`  Nodes:    ${nodeCount}`)
console.log(`  Edges:    ${edgeCount}`)
console.log(`  Types:    ${typeSummary}`)
console.log(`  Layers:   ${layerCount}`)
console.log(`  Tour:     ${tourCount} step(s)`)
console.log(`  Files:    ${fileSet.size} unique`)
console.log(`  Indexed:  ${analyzedAt || 'unknown'}`)
console.log(`\n${pass ? '✅ All his-go smoke checks passed.' : '❌ Some checks failed.'}`)

process.exit(pass ? 0 : 1)
