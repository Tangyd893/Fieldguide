#!/usr/bin/env node
/**
 * Remove electron-builder output folders.
 * Close Fieldguide / electron.exe first if deletion fails (file lock).
 */
import { rmSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
for (const dir of ['dist', 'dist-release']) {
  const path = resolve(root, dir)
  if (!existsSync(path)) continue
  try {
    rmSync(path, { recursive: true, force: true })
    console.log(`[clean-dist] removed ${dir}/`)
  } catch (err) {
    console.warn(`[clean-dist] failed to remove ${dir}/ — close running Fieldguide and retry`)
    console.warn(err instanceof Error ? err.message : err)
  }
}
