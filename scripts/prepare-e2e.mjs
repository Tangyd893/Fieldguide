#!/usr/bin/env node
/**
 * Prepare an E2E run.
 *
 * E2E drives the *built* app (out/main/index.js), and Playwright cannot start a
 * dev server for Electron. Rebuilding here means `pnpm test:e2e` always tests the
 * current source — running it against a stale bundle silently passes while the
 * real UI has changed (which happened while writing these tests).
 *
 * Also verifies the two prerequisites: the renderer/main bundles, and the UA
 * Dashboard dist the code map embeds.
 */
import { existsSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function run(label, command, args) {
  console.log(`\n[e2e] ${label}: ${command} ${args.join(' ')}`)
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) {
    console.error(`[e2e] ${label} failed with exit code ${result.status}`)
    process.exit(result.status ?? 1)
  }
}

// 1. Build main + preload + renderer.
run('build', process.platform === 'win32' ? 'npx.cmd' : 'npx', ['electron-vite', 'build'])

// 2. The code map embeds the Dashboard dist; without it the graph panel only
//    renders its "unavailable" placeholder and the graph assertions are vacuous.
const dashboard = join(root, 'resources', 'dashboard', 'index.html')
if (!existsSync(dashboard)) {
  console.error(
    '[e2e] UA Dashboard dist missing at resources/dashboard — run `pnpm bootstrap:ua` first.\n'
    + '      The code map embeds it, so graph tests cannot run without it.',
  )
  process.exit(1)
}

// 3. Sanity: the bundles we just built are present and non-empty.
for (const rel of ['out/main/index.js', 'out/preload/index.js', 'out/renderer/index.html']) {
  const path = join(root, rel)
  if (!existsSync(path) || statSync(path).size === 0) {
    console.error(`[e2e] expected build artifact missing or empty: ${rel}`)
    process.exit(1)
  }
}

console.log('\n[e2e] ready: bundles rebuilt, Dashboard dist present')
