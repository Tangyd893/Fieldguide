/**
 * Read a project's directory tree for the file explorer.
 *
 * Returns a flat list of entries with depth/parent info,
 * so the renderer can build the tree UI.
 */
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

export interface FileEntry {
  name: string
  path: string       // relative to project root
  isDirectory: boolean
  size: number
  children?: FileEntry[]
}

const IGNORE_DIRS = new Set([
  '.git', 'node_modules', '.understand-anything', 'vendor',
  '__pycache__', '.venv', 'dist', 'build', 'out', '.next',
  'target', '.turbo', '.cache', '.idea', '.vscode',
])

const BINARY_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg',
  '.woff', '.woff2', '.ttf', '.eot',
  '.exe', '.dll', '.so', '.dylib',
  '.zip', '.tar', '.gz', '.7z',
  '.pdf', '.doc', '.docx',
])

export function readProjectTree(rootPath: string, maxDepth = 3): FileEntry[] {
  const result: FileEntry[] = []

  function walk(currentPath: string, depth: number): FileEntry[] {
    if (depth > maxDepth) return []

    let entries: string[]
    try {
      entries = readdirSync(currentPath)
    } catch {
      return []
    }

    // Sort: directories first, then files, both alphabetically
    entries.sort((a, b) => {
      const aIsDir = statSync(join(currentPath, a), { throwIfNoEntry: false })?.isDirectory() ?? false
      const bIsDir = statSync(join(currentPath, b), { throwIfNoEntry: false })?.isDirectory() ?? false
      if (aIsDir && !bIsDir) return -1
      if (!aIsDir && bIsDir) return 1
      return a.localeCompare(b)
    })

    const children: FileEntry[] = []

    for (const entry of entries) {
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

      if (st.isDirectory()) {
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
        const ext = entry.split('.').pop()?.toLowerCase() ?? ''
        if (BINARY_EXTS.has(`.${ext}`)) continue

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
