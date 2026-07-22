/**
 * Knowledge Extraction — tech concepts from architecture + graph → in-app cards.
 */
import type { ArchitectureSummary, KnowledgeNode } from '../../shared/understand'
import { joinLlmUrl } from '../../shared/llm-url'
import type { GraphLike, LLMConfig } from './architecture'

function uid(): string {
  return `kn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function relatedIdsForConcept(concept: string, graph: GraphLike): string[] {
  const re = new RegExp(concept.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
  return (graph.nodes || [])
    .filter(n => re.test(n.label || '') || re.test(n.filePath || '') || (n.metadata?.tags || []).some(t => re.test(t)))
    .slice(0, 6)
    .map(n => n.id)
}

export function buildHeuristicKnowledge(
  projectId: string,
  architecture: ArchitectureSummary,
  graph: GraphLike,
): Omit<KnowledgeNode, 'id' | 'createdAt'>[] {
  const concepts = new Set<string>()
  for (const s of architecture.stack) concepts.add(s)
  for (const t of architecture.techChoices) concepts.add(t.name)
  for (const layer of architecture.layers) {
    if (layer.name) concepts.add(layer.name)
  }

  return [...concepts].slice(0, 12).map(concept => ({
    projectId,
    concept,
    principle: `${concept} appears in this project's stack or architecture layers.`,
    tradeoffs: architecture.techChoices.find(t => t.name === concept)?.reason
      || 'Review whether this technology fits scale, team skill, and operational cost.',
    examples: architecture.modules
      .filter(m => m.layer === concept || m.name.includes(concept) || (m.description || '').includes(concept))
      .slice(0, 3)
      .map(m => m.name)
      .join(', ') || (architecture.entryPoints || []).slice(0, 2).join(', '),
    relatedNodeIds: relatedIdsForConcept(concept, graph),
  }))
}

function extractJson(text: string): unknown {
  const trimmed = text.trim()
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fence ? fence[1].trim() : trimmed
  return JSON.parse(raw)
}

async function callLLM(prompt: string, config: LLMConfig, language?: string): Promise<string> {
  const url = joinLlmUrl(config.baseUrl, '/v1/chat/completions')
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.chatModel,
      messages: [
        {
          role: 'system',
          content: language === 'en'
            ? 'You extract technical knowledge cards from software projects. JSON only.'
            : '你从软件项目中抽取技术知识卡片。只输出 JSON。',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.35,
      max_tokens: 4096,
    }),
    signal: AbortSignal.timeout(120_000),
  })
  if (!resp.ok) throw new Error(`LLM error ${resp.status}`)
  const data = await resp.json() as { choices?: Array<{ message?: { content?: string } }> }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('empty LLM response')
  return content
}

export async function generateKnowledgeNodes(
  projectId: string,
  architecture: ArchitectureSummary,
  graph: GraphLike,
  llm?: LLMConfig,
  language?: string,
): Promise<Array<Omit<KnowledgeNode, 'id' | 'createdAt'> & { id?: string }>> {
  const heuristic = buildHeuristicKnowledge(projectId, architecture, graph)
  if (!llm) return heuristic

  try {
    const prompt = `Extract 5-10 knowledge cards for interview / deep understanding.
Return JSON: { "nodes": [{ "concept", "principle", "tradeoffs", "examples", "relatedNodeIds": string[] }] }

Architecture:
${JSON.stringify({
  stack: architecture.stack,
  layers: architecture.layers,
  modules: architecture.modules.slice(0, 10),
  techChoices: architecture.techChoices,
}, null, 2)}

Sample node ids (prefer these when linking):
${JSON.stringify(
  (graph.nodes || []).filter(n => n.type === 'file').slice(0, 30).map(n => ({ id: n.id, path: n.filePath })),
  null,
  2,
)}
`
    const response = await callLLM(prompt, llm, language)
    const parsed = extractJson(response) as { nodes?: Array<Partial<KnowledgeNode>> }
    if (!Array.isArray(parsed.nodes) || parsed.nodes.length === 0) return heuristic

    return parsed.nodes.slice(0, 12).map(n => ({
      projectId,
      concept: String(n.concept || 'Concept'),
      principle: String(n.principle || ''),
      tradeoffs: String(n.tradeoffs || ''),
      examples: String(n.examples || ''),
      relatedNodeIds: Array.isArray(n.relatedNodeIds) ? n.relatedNodeIds.map(String) : relatedIdsForConcept(String(n.concept || ''), graph),
    }))
  } catch (err) {
    console.warn(`[understand/knowledge] LLM failed: ${String(err)}`)
    return heuristic
  }
}

export { uid as knowledgeUid }
