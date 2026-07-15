#!/usr/bin/env node
/**
 * Automated QA baseline — runs typecheck, unit tests, and fixture smoke checks.
 * Usage: node scripts/qa-baseline.mjs
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const results = []

function run(cmd, args, label) {
  const r = spawnSync(cmd, args, { cwd: root, shell: true, encoding: 'utf-8' })
  const ok = r.status === 0
  results.push({ label, ok, output: (r.stdout || '') + (r.stderr || '') })
  console.log(ok ? `✅ ${label}` : `❌ ${label}`)
  if (!ok) console.log(r.stdout || r.stderr)
  return ok
}

console.log('Fieldguide QA Baseline\n')

run('pnpm', ['typecheck'], 'typecheck')
run('pnpm', ['test:unit'], 'test:unit')

// Fixture smoke
const fixtureGraph = join(root, 'tests/fixtures/tiny-go/.understand-anything/knowledge-graph.json')
const fixtureOk = existsSync(fixtureGraph)
if (fixtureOk) {
  const g = JSON.parse(readFileSync(fixtureGraph, 'utf-8'))
  const nodeCount = g.nodes?.length ?? 0
  console.log(nodeCount > 0 ? `✅ fixture graph (${nodeCount} nodes)` : '❌ fixture graph empty')
  results.push({ label: 'fixture graph', ok: nodeCount > 0, output: `${nodeCount} nodes` })
} else {
  console.log('❌ fixture graph missing')
  results.push({ label: 'fixture graph', ok: false, output: 'missing' })
}

const sampleGraph = join(root, 'resources/sample-project/.understand-anything/knowledge-graph.json')
const sampleOk = existsSync(sampleGraph)
console.log(sampleOk ? '✅ bundled sample-project graph' : '❌ bundled sample-project graph missing')
results.push({ label: 'sample graph', ok: sampleOk, output: sampleOk ? 'exists' : 'missing' })

const failed = results.filter(r => !r.ok)
console.log(`\n${failed.length === 0 ? 'All checks passed.' : `${failed.length} check(s) failed.`}`)
process.exit(failed.length === 0 ? 0 : 1)
