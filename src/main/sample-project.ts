/**
 * Install bundled sample project from resources/sample-project (dev) or
 * extraResources/sample-project (packaged).
 */
import { app } from 'electron'
import { join } from 'node:path'
import { existsSync, cpSync, mkdirSync, readFileSync } from 'node:fs'
import { loadConfig } from './config'
import { insertProject, getProject, listProjects, updateProjectStatus, type ProjectRow } from './db'

function bundledSamplePath(): string {
  const packaged = join(process.resourcesPath, 'sample-project')
  if (app.isPackaged && existsSync(packaged)) return packaged

  const candidates = [
    join(process.cwd(), 'resources', 'sample-project'),
    join(app.getAppPath(), 'resources', 'sample-project'),
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  throw new Error('内置示例项目未找到（resources/sample-project）')
}

function graphNodeCount(rootPath: string): number {
  const graphPath = join(rootPath, '.understand-anything', 'knowledge-graph.json')
  if (!existsSync(graphPath)) return 0
  try {
    const graph = JSON.parse(readFileSync(graphPath, 'utf-8')) as { nodes?: unknown[] }
    return Array.isArray(graph.nodes) ? graph.nodes.length : 0
  } catch {
    return 0
  }
}

export function installDemoProject(projectsRoot?: string): ProjectRow {
  const config = loadConfig()
  const root = projectsRoot || config.projectsRoot
  if (!root) {
    throw new Error('请先在设置中配置项目根目录（projectsRoot）')
  }

  const targetPath = join(root, 'demo')
  const existing = listProjects().find((p) => p.root_path === targetPath)
  if (existing) return existing

  const src = bundledSamplePath()
  if (!existsSync(targetPath)) {
    mkdirSync(root, { recursive: true })
    cpSync(src, targetPath, { recursive: true })
  }

  const nodeCount = graphNodeCount(targetPath)
  const status = nodeCount > 0 ? 'ready' : 'pending'

  insertProject({
    id: 'demo-builtin',
    name: 'Fieldguide Demo',
    slug: 'demo',
    source_type: 'local',
    source_uri: 'builtin:sample-project',
    root_path: targetPath,
    status,
  })

  if (nodeCount > 0) {
    updateProjectStatus('demo-builtin', 'ready', nodeCount)
  }

  return getProject('demo-builtin')!
}
