#!/usr/bin/env node
/**
 * Contract audit — the checks typecheck cannot make.
 *
 * Four surfaces must agree at runtime but are written by hand, so a mistake in any
 * of them ships as a dead button rather than a compile error:
 *
 *   1. every `ipcMain.handle('x')` has a caller and vice versa;
 *   2. every `window.fieldguide.x` a view calls exists in preload;
 *   3. `env.d.ts`'s hand-written `FieldguideAPI` matches preload exactly;
 *   4. every static `t('key')` exists in zh-CN (a missing key renders its own name);
 *   5. nothing bypasses `dataDir()` for app data (breaks the documented
 *      `FIELDGUIDE_DATA_DIR` isolation used by portable installs and E2E).
 *
 * Exits non-zero on any mismatch. Run: `node scripts/contract-audit.mjs`
 * (also wired into `pnpm qa:baseline`, so CI enforces it).
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(root, rel), 'utf-8')

function walk(dir, out = []) {
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`
    if (entry.isDirectory()) walk(rel, out)
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(rel)
  }
  return out
}

const sourceFiles = [...walk('src'), ...walk('e2e')]
const sources = sourceFiles.map((file) => [file, read(file)])
const problems = []
const report = (label, ok, detail) => {
  console.log(ok ? `  ok   ${label}` : `  FAIL ${label}`)
  if (!ok) problems.push(`${label}: ${detail}`)
}

/* ── 1. IPC channels ── */
console.log('IPC channels')
const handled = new Set()
const invoked = new Set()
for (const [, text] of sources) {
  for (const m of text.matchAll(/ipcMain\.handle\(\s*'([^']+)'/g)) handled.add(m[1])
  for (const m of text.matchAll(/ipcRenderer\.invoke\(\s*'([^']+)'/g)) invoked.add(m[1])
}
const withoutHandler = [...invoked].filter((c) => !handled.has(c))
const withoutCaller = [...handled].filter((c) => !invoked.has(c))
report('every invoked channel has a handler', withoutHandler.length === 0, withoutHandler.join(', '))
report('every handler is reachable from preload', withoutCaller.length === 0, withoutCaller.join(', '))

/* ── 2. renderer → preload ── */
console.log('Renderer ↔ preload')
const preload = read('src/preload/index.ts')
const preloadKeys = new Set([...preload.matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]))
const called = new Set()
for (const [file, text] of sources) {
  if (!file.includes('/renderer/')) continue
  for (const m of text.matchAll(/window\.fieldguide\.(\w+)/g)) called.add(m[1])
}
const unexposed = [...called].filter((k) => !preloadKeys.has(k))
report('every window.fieldguide call exists in preload', unexposed.length === 0, unexposed.join(', '))

/* ── 3. env.d.ts ↔ preload ── */
console.log('Renderer types ↔ preload')
const envDts = read('src/renderer/env.d.ts')
const apiBlock = envDts.slice(envDts.indexOf('interface FieldguideAPI'), envDts.indexOf('declare global'))
const typed = new Set([...apiBlock.matchAll(/^\s{2}(\w+)[(:]/gm)].map((m) => m[1]))
const notTyped = [...preloadKeys].filter((k) => !typed.has(k))
const notImplemented = [...typed].filter((k) => !preloadKeys.has(k))
report('preload methods are all typed', notTyped.length === 0, notTyped.join(', '))
report('typed methods are all implemented', notImplemented.length === 0, notImplemented.join(', '))

/* ── 4. i18n keys ── */
console.log('i18n')
const flat = (value, prefix = '') =>
  Object.entries(value).flatMap(([key, child]) =>
    child && typeof child === 'object'
      ? flat(child, prefix ? `${prefix}.${key}` : key)
      : [prefix ? `${prefix}.${key}` : key])
const zhKeys = new Set(flat(JSON.parse(read('src/renderer/locales/zh-CN.json'))))
const used = new Set()
for (const [file, text] of sources) {
  if (!file.includes('/renderer/')) continue
  for (const m of text.matchAll(/\bt\(\s*'([a-zA-Z][\w.]*)'/g)) used.add(m[1])
  // Template keys (`t(`settings.providers.${id}`)`) are dynamic; skip their prefix.
  for (const m of text.matchAll(/\bt\(\s*`([a-zA-Z][\w.]*)\.\$\{/g)) used.add(`${m[1]}.*`)
}
const missingKeys = [...used].filter((key) => !key.endsWith('.*') && !zhKeys.has(key))
report('every static t() key exists in zh-CN', missingKeys.length === 0, missingKeys.join(', '))

/* ── 5. data dir ── */
console.log('Data directory')
const bypasses = []
for (const [file, text] of sources) {
  text.split('\n').forEach((line, index) => {
    // config.ts *is* the dataDir() implementation.
    if (file === 'src/main/config.ts') return
    if (line.includes("app.getPath('appData')") && !line.trim().startsWith('*')) {
      bypasses.push(`${file}:${index + 1}`)
    }
  })
}
report('app data goes through dataDir()', bypasses.length === 0, bypasses.join(', '))

console.log(problems.length === 0 ? '\nContract audit passed.' : `\n${problems.length} contract problem(s).`)
process.exit(problems.length === 0 ? 0 : 1)
