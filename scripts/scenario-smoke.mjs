#!/usr/bin/env node
/**
 * Scenario A/B/C automated smoke checks (non-GUI).
 * Usage: node scripts/scenario-smoke.mjs
 */
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const fixtureRoot = join(root, 'tests/fixtures/tiny-go')

function check(label, ok, detail = '') {
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  return ok
}

console.log('Fieldguide Scenario Smoke (automated)\n')

let pass = true
const graphPath = join(fixtureRoot, '.understand-anything/knowledge-graph.json')
if (!existsSync(graphPath)) {
  pass = check('Scenario A: fixture graph exists', false)
} else {
  let graph
  try {
    graph = JSON.parse(readFileSync(graphPath, 'utf-8'))
  } catch {
    pass = check('Scenario A: parse graph', false) && pass
    graph = null
  }
  if (graph) {
    pass = check('Scenario A: nodes > 0', (graph.nodes?.length ?? 0) > 0, `${graph.nodes?.length} nodes`) && pass
    const entry = (graph.nodes || []).find((n) => n.filePath?.includes('cmd/main') || n.id?.includes('main'))
    pass = check('Scenario A: entry node exists', !!entry, entry?.id) && pass
    pass = check('Scenario A: graph structure usable', (graph.nodes?.length ?? 0) >= 5, `${graph.nodes?.length} nodes`) && pass
    const search = (graph.nodes || []).filter(n => (n.label || n.id || '').toLowerCase().includes('handler'))
    pass = check('Scenario A: search "handler"', search.length > 0, `${search.length} matches`) && pass
  }
}

const dbSrc = readFileSync(join(root, 'src/main/db/index.ts'), 'utf-8')
pass = check('Scenario B: concept_links table', dbSrc.includes('concept_links')) && pass
pass = check('Scenario B: paper_highlights table', dbSrc.includes('paper_highlights')) && pass
pass = check('Scenario B: ReAct agent module', existsSync(join(root, 'src/main/agent/react.ts'))) && pass

pass = check('Scenario C: diff module', existsSync(join(root, 'src/main/ua/diff.ts'))) && pass
const diffSrc = readFileSync(join(root, 'src/main/ua/diff.ts'), 'utf-8')
pass = check('Scenario C: diff overlay support', diffSrc.includes('affectedNodeIds') || diffSrc.includes('changedNodeIds')) && pass
pass = check('Scenario C: index cancel support', readFileSync(join(root, 'src/main/ua/client.ts'), 'utf-8').includes('cancelIndex')) && pass

console.log(`\n${pass ? 'Smoke checks passed.' : 'Some smoke checks failed.'}`)
process.exit(pass ? 0 : 1)
