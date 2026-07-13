/**
 * Read a project's directory tree for the file explorer.
 */
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import {
  BINARY_EXTS,
  IGNORE_DIRS,
  type ProjectIgnoreFilter,
} from './project-ignore'

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  size: number
  children?: FileEntry[]
}

export interface ReadProjectTreeOptions {
  maxDepth?: number
  maxNodes?: number
  ignoreFilter?: ProjectIgnoreFilter
}

const DEFAULT_MAX_DEPTH = 8
const DEFAULT_MAX_NODES = 2000

export function readProjectTree(
  rootPath: string,
  options: ReadProjectTreeOptions = {},
): FileEntry[] {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH
  const maxNodes = options.maxNodes ?? DEFAULT_MAX_NODES
  const ignoreFilter = options.ignoreFilter ?? { ignores: () => false }
  let nodeCount = 0
  let truncated = false

  function walk(currentPath: string, depth: number): FileEntry[] {
    if (depth > maxDepth || truncated) return []

    let entries: string[]
    try {
      entries = readdirSync(currentPath)
    } catch {
      return []
    }

    entries.sort((a, b) => {
      const aIsDir = statSync(join(currentPath, a), { throwIfNoEntry: false })?.isDirectory() ?? false
      const bIsDir = statSync(join(currentPath, b), { throwIfNoEntry: false })?.isDirectory() ?? false
      if (aIsDir && !bIsDir) return -1
      if (!aIsDir && bIsDir) return 1
      return a.localeCompare(b)
    })

    const children: FileEntry[] = []

    for (const entry of entries) {
      if (truncated) break
      if (entry.startsWith('.')) continue
      if (IGNORE_DIRS.has(entry)) continue

      const fullPath = join(currentPath, entry)
      let st: ReturnType<typeof statSync>
      try {
        st = statSync(fullPath)
      } catch {
        continue
      }

      const relPath = relative(rootPath, fullPath).replace(/\\/g, '/')
      if (ignoreFilter.ignores(relPath)) continue

      if (st.isDirectory()) {
        nodeCount++
        if (nodeCount > maxNodes) {
          truncated = true
          break
        }

        const child: FileEntry = {
          name: entry,
          path: relPath,
          isDirectory: true,
          size: 0,
        }
        const sub = walk(fullPath, depth + 1)
        if (sub.length > 0) {
          child.children = sub
        }
        children.push(child)
      } else if (st.isFile()) {
        const ext = entry.includes('.') ? `.${entry.split('.').pop()?.toLowerCase() ?? ''}` : ''
        if (BINARY_EXTS.has(ext)) continue

        nodeCount++
        if (nodeCount > maxNodes) {
          truncated = true
          break
        }

        children.push({
          name: entry,
          path: relPath,
          isDirectory: false,
          size: st.size,
        })
      }
    }

    return children
  }

  return walk(rootPath, 0)
}
