/**
 * Interview Simulation — questions from architecture + knowledge cards.
 */
import type { ArchitectureSummary, InterviewQuestion, KnowledgeNode } from '../../shared/understand'
import { callLLM as sharedCallLLM, extractJson as sharedExtractJson } from '../llm/client'
import type { LLMConfig } from './architecture'

function uid(): string {
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function buildHeuristicQuestions(
  projectId: string,
  architecture: ArchitectureSummary,
  knowledge: Array<Pick<KnowledgeNode, 'id' | 'concept' | 'principle' | 'tradeoffs' | 'examples' | 'relatedNodeIds'>>,
): Omit<InterviewQuestion, 'id' | 'createdAt'>[] {
  const questions: Omit<InterviewQuestion, 'id' | 'createdAt'>[] = []

  if (architecture.layers.length) {
    questions.push({
      projectId,
      problem: 'Why is the system layered this way?',
      context: `Layers: ${architecture.layers.map(l => l.name).join(' → ')}`,
      answer: architecture.layers.map(l => `${l.name}: ${l.description || 'see module responsibilities'}`).join('\n'),
      relatedConcepts: architecture.layers.map(l => l.name),
      knowledgeIds: [],
      relatedNodeIds: architecture.modules.flatMap(m => m.nodeIds || []).slice(0, 6),
    })
  }

  if (architecture.keyFlows[0]) {
    const flow = architecture.keyFlows[0]
    questions.push({
      projectId,
      problem: `Walk through the main flow: ${flow.name}. What happens if traffic increases 10x?`,
      context: flow.description || flow.steps?.join(' → ') || '',
      answer: `Baseline path: ${(flow.steps || []).join(' → ')}. Scale risks: bottlenecks at IO, shared state, and synchronous fan-out.`,
      relatedConcepts: architecture.stack.slice(0, 4),
      knowledgeIds: knowledge.slice(0, 2).map(k => k.id).filter(Boolean),
      relatedNodeIds: [],
    })
  }

  for (const kn of knowledge.slice(0, 5)) {
    questions.push({
      projectId,
      problem: `Why use ${kn.concept} here? What would you replace it with?`,
      context: kn.principle,
      answer: `${kn.tradeoffs}\nExamples in repo: ${kn.examples || 'see related nodes'}`,
      relatedConcepts: [kn.concept],
      knowledgeIds: kn.id ? [kn.id] : [],
      relatedNodeIds: kn.relatedNodeIds || [],
    })
  }

  if (architecture.techChoices[0]) {
    const t = architecture.techChoices[0]
    questions.push({
      projectId,
      problem: `What are the risks of choosing ${t.name}?`,
      context: t.reason || '',
      answer: `Tradeoffs around ops complexity, team familiarity, and lock-in. Alternatives: ${(t.alternatives || []).join(', ') || 'evaluate ecosystem peers'}.`,
      relatedConcepts: [t.name],
      knowledgeIds: [],
      relatedNodeIds: [],
    })
  }

  return questions.slice(0, 12)
}

function extractJson(text: string): unknown {
  return sharedExtractJson(text)
}

function callLLM(prompt: string, config: LLMConfig, language?: string): Promise<string> {
  return sharedCallLLM(prompt, config, language, {
    system: language === 'en'
      ? 'You write project-specific interview questions. JSON only.'
      : '你编写基于项目的面试题。只输出 JSON。',
    temperature: 0.4,
  })
}

export async function generateInterviewQuestions(
  projectId: string,
  architecture: ArchitectureSummary,
  knowledge: Array<Pick<KnowledgeNode, 'id' | 'concept' | 'principle' | 'tradeoffs' | 'relatedNodeIds' | 'examples'>>,
  llm?: LLMConfig,
  language?: string,
): Promise<Omit<InterviewQuestion, 'id' | 'createdAt'>[]> {
  const heuristic = buildHeuristicQuestions(projectId, architecture, knowledge)
  if (!llm) return heuristic

  try {
    const prompt = `Generate 6-10 interview questions grounded in this project.
Return JSON: { "questions": [{ "problem", "context", "answer", "relatedConcepts": string[], "knowledgeIds": string[], "relatedNodeIds": string[] }] }

Architecture summary:
${JSON.stringify({
  stack: architecture.stack,
  layers: architecture.layers,
  keyFlows: architecture.keyFlows,
  techChoices: architecture.techChoices,
}, null, 2)}

Knowledge cards:
${JSON.stringify(knowledge.map(k => ({ id: k.id, concept: k.concept, principle: k.principle })), null, 2)}
`
    const response = await callLLM(prompt, llm, language)
    const parsed = extractJson(response) as { questions?: Array<Partial<InterviewQuestion>> }
    if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) return heuristic

    return parsed.questions.slice(0, 12).map(q => ({
      projectId,
      problem: String(q.problem || 'Design question'),
      context: String(q.context || ''),
      answer: String(q.answer || ''),
      relatedConcepts: Array.isArray(q.relatedConcepts) ? q.relatedConcepts.map(String) : [],
      knowledgeIds: Array.isArray(q.knowledgeIds) ? q.knowledgeIds.map(String) : [],
      relatedNodeIds: Array.isArray(q.relatedNodeIds) ? q.relatedNodeIds.map(String) : [],
    }))
  } catch (err) {
    console.warn(`[understand/interview] LLM failed: ${String(err)}`)
    return heuristic
  }
}

export { uid as questionUid }
