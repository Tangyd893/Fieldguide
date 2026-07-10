/**
 * Materialize pnpm workspace symlinks before electron-builder packaging.
 * electron-builder cannot pack files outside the project root via symlinks.
 */
import { cpSync, lstatSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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
