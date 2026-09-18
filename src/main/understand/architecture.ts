/**
 * Architecture Mapping — build ArchitectureSummary from knowledge graph.
 * Heuristic always available; LLM enrichment optional.
 */
import type { ArchitectureSummary, ArchitectureModule, ArchitectureFlow, TechChoice } from '../../shared/understand'
import { callLLM as sharedCallLLM, extractJson as sharedExtractJson } from './llm-utils'

export interface GraphLike {
  project?: { projectName?: string; language?: string }
  meta?: { projectName?: string; language?: string; fileCount?: number }
  nodes?: Array<{
    id: string
    label?: string
    type?: string
    filePath?: string
    layer?: string
    metadata?: { summary?: string; tags?: string[] }
  }>
  edges?: Array<{ source?: string; target?: string; type?: string }>
  layers?: Array<{ id?: string; name: string; description?: string }>
  tour?: Array<{ name?: string; description?: string; steps?: Array<{ title?: string; description?: string; nodeIds?: string[] }> }>
}

export interface LLMConfig {
  baseUrl: string
  apiKey: string
  chatModel: string
}

const STACK_HINTS: Array<{ re: RegExp; name: string }> = [
  { re: /package\.json$/i, name: 'Node.js' },
  { re: /go\.mod$/i, name: 'Go' },
  { re: /Cargo\.toml$/i, name: 'Rust' },
  { re: /requirements\.txt$|pyproject\.toml$/i, name: 'Python' },
  { re: /pom\.xml$|build\.gradle/i, name: 'Java' },
  { re: /Dockerfile$/i, name: 'Docker' },
  { re: /redis/i, name: 'Redis' },
  { re: /kafka/i, name: 'Kafka' },
  { re: /react/i, name: 'React' },
  { re: /express|koa|fastify/i, name: 'HTTP API' },
  { re: /sqlite|postgres|mysql|mongodb/i, name: 'Database' },
]

function detectStack(graph: GraphLike): string[] {
  const found = new Set<string>()
  const lang = graph.project?.language || graph.meta?.language
  if (lang) found.add(lang)

  for (const node of graph.nodes || []) {
    const hay = `${node.filePath || ''} ${node.label || ''} ${(node.metadata?.tags || []).join(' ')}`
    for (const hint of STACK_HINTS) {
      if (hint.re.test(hay)) found.add(hint.name)
    }
  }
  return [...found].slice(0, 12)
}

function buildModules(graph: GraphLike): ArchitectureModule[] {
  const byLayer = new Map<string, ArchitectureModule>()
  for (const layer of graph.layers || []) {
    byLayer.set(layer.name, {
      name: layer.name,
      layer: layer.name,
      description: layer.description || '',
      nodeIds: [],
    })
  }

  for (const node of graph.nodes || []) {
    if (node.type !== 'file' && node.type !== 'directory') continue
    const layerName = node.layer || 'Other'
    let mod = byLayer.get(layerName)
    if (!mod) {
      mod = { name: layerName, layer: layerName, description: '', nodeIds: [] }
      byLayer.set(layerName, mod)
    }
    if (node.id && (mod.nodeIds?.length || 0) < 8) {
      mod.nodeIds = [...(mod.nodeIds || []), node.id]
    }
  }

  // Top-level path segments as modules when no layers
  if (byLayer.size === 0) {
    const dirs = new Map<string, string[]>()
    for (const node of graph.nodes || []) {
      if (node.type !== 'file' || !node.filePath) continue
      const top = node.filePath.replace(/\\/g, '/').split('/')[0] || 'root'
      if (!dirs.has(top)) dirs.set(top, [])
      const ids = dirs.get(top)!
      if (ids.length < 6) ids.push(node.id)
    }
    return [...dirs.entries()].slice(0, 10).map(([name, nodeIds]) => ({
      name,
      description: `Top-level package / directory`,
      nodeIds,
    }))
  }

  return [...byLayer.values()]
}

function buildFlows(graph: GraphLike): ArchitectureFlow[] {
  const flows: ArchitectureFlow[] = []
  for (const tour of graph.tour || []) {
    const steps = (tour.steps || []).map(s => s.title || s.description || '').filter(Boolean)
    if (steps.length || tour.name) {
      flows.push({
        name: tour.name || 'Main path',
        description: tour.description || '',
        steps: steps.slice(0, 12),
      })
    }
  }
  if (flows.length === 0) {
    const entries = (graph.nodes || [])
      .filter(n => /main\.(go|ts|js|py)$|index\.(ts|js)|cmd\//i.test(n.filePath || n.label || ''))
      .slice(0, 5)
      .map(n => n.label || n.filePath || n.id)
    flows.push({
      name: 'Entry → core',
      description: 'Heuristic entry points',
      steps: entries.length ? entries : ['Scan project entry files', 'Follow call / import edges'],
    })
  }
  return flows
}

function buildTechChoices(stack: string[]): TechChoice[] {
  return stack.slice(0, 8).map(name => ({
    name,
    reason: `Detected from project structure and dependencies`,
    alternatives: [],
  }))
}

function entryPoints(graph: GraphLike): string[] {
  return (graph.nodes || [])
    .filter(n => /main\.(go|ts|js|py)$|index\.(ts|js)|App\.(tsx|jsx)|cmd\//i.test(n.filePath || ''))
    .slice(0, 8)
    .map(n => n.filePath || n.label || n.id)
}

export function buildHeuristicArchitecture(projectId: string, graph: GraphLike): ArchitectureSummary {
  const stack = detectStack(graph)
  const layers = (graph.layers || []).map(l => ({
    id: l.id,
    name: l.name,
    description: l.description,
  }))
  return {
    projectId,
    stack,
    layers: layers.length
      ? layers
      : [
          { name: 'Presentation', description: 'UI / API entry' },
          { name: 'Business', description: 'Domain logic' },
          { name: 'Data', description: 'Persistence / IO' },
        ],
    modules: buildModules(graph),
    keyFlows: buildFlows(graph),
    techChoices: buildTechChoices(stack),
    entryPoints: entryPoints(graph),
    generatedAt: new Date().toISOString(),
    source: 'heuristic',
  }
}

function extractJson(text: string): unknown {
  return sharedExtractJson(text)
}

function callLLM(prompt: string, config: LLMConfig, language?: string): Promise<string> {
  return sharedCallLLM(prompt, config, language, {
    system: language === 'en'
      ? 'You are a software architecture assistant. Respond with valid JSON only.'
      : '你是软件架构助手。只回复合法 JSON。',
    temperature: 0.3,
  })
}

export async function enrichArchitectureWithLLM(
  base: ArchitectureSummary,
  graph: GraphLike,
  config: LLMConfig,
  language?: string,
): Promise<ArchitectureSummary> {
  const nodeSample = (graph.nodes || [])
    .filter(n => n.type === 'file')
    .slice(0, 40)
    .map(n => ({ id: n.id, path: n.filePath, layer: n.layer, summary: n.metadata?.summary }))

  const prompt = `Given this project architecture draft and file sample, refine the architecture summary.
Return JSON:
{
  "stack": string[],
  "layers": [{"name": string, "description": string}],
  "modules": [{"name": string, "layer": string, "description": string, "nodeIds": string[]}],
  "keyFlows": [{"name": string, "description": string, "steps": string[]}],
  "techChoices": [{"name": string, "reason": string, "alternatives": string[]}],
  "entryPoints": string[]
}

Draft:
${JSON.stringify({
  stack: base.stack,
  layers: base.layers,
  modules: base.modules.slice(0, 12),
  keyFlows: base.keyFlows,
  entryPoints: base.entryPoints,
}, null, 2)}

Files:
${JSON.stringify(nodeSample, null, 2)}
`

  const response = await callLLM(prompt, config, language)
  const parsed = extractJson(response) as Partial<ArchitectureSummary>
  return {
    ...base,
    stack: Array.isArray(parsed.stack) && parsed.stack.length ? parsed.stack as string[] : base.stack,
    layers: Array.isArray(parsed.layers) && parsed.layers.length ? parsed.layers as ArchitectureSummary['layers'] : base.layers,
    modules: Array.isArray(parsed.modules) && parsed.modules.length ? parsed.modules as ArchitectureModule[] : base.modules,
    keyFlows: Array.isArray(parsed.keyFlows) && parsed.keyFlows.length ? parsed.keyFlows as ArchitectureFlow[] : base.keyFlows,
    techChoices: Array.isArray(parsed.techChoices) && parsed.techChoices.length ? parsed.techChoices as TechChoice[] : base.techChoices,
    entryPoints: Array.isArray(parsed.entryPoints) ? parsed.entryPoints as string[] : base.entryPoints,
    generatedAt: new Date().toISOString(),
    source: 'llm',
  }
}

export async function generateArchitectureSummary(
  projectId: string,
  graph: GraphLike,
  llm?: LLMConfig,
  language?: string,
): Promise<ArchitectureSummary> {
  const heuristic = buildHeuristicArchitecture(projectId, graph)
  if (!llm) return heuristic
  try {
    return await enrichArchitectureWithLLM(heuristic, graph, llm, language)
  } catch (err) {
    console.warn(`[understand/architecture] LLM enrich failed: ${String(err)}`)
    return heuristic
  }
}
