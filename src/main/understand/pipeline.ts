/**
 * Progressive understanding pipeline: architecture → knowledge → interview.
 * Runs after UA structure index; stages are skippable independently via IPC.
 */
import { loadGraph } from '../ua/graph-reader'
import {
  replaceArchitectureSummary,
  replaceKnowledgeNodes,
  replaceQuestions,
  listKnowledgeNodes,
  getArchitectureSummary,
} from '../db'
import { generateArchitectureSummary, type GraphLike, type LLMConfig } from './architecture'
import { generateKnowledgeNodes } from './knowledge'
import { generateInterviewQuestions } from './interview'
import type { AnalysisStage } from '../../shared/understand'

export interface UnderstandRunOptions {
  projectId: string
  rootPath: string
  stages?: AnalysisStage[]
  llm?: LLMConfig
  language?: string
  onStage?: (stage: AnalysisStage) => void
}

export interface UnderstandRunResult {
  architecture: boolean
  knowledgeCount: number
  questionCount: number
}

const DEFAULT_STAGES: AnalysisStage[] = ['architecture', 'knowledge', 'interview']

export async function runUnderstandPipeline(opts: UnderstandRunOptions): Promise<UnderstandRunResult> {
  const stages = opts.stages?.length ? opts.stages : DEFAULT_STAGES
  const graph = loadGraph(opts.rootPath) as GraphLike | null
  if (!graph) {
    throw new Error('Knowledge graph not found — index the project first')
  }

  const result: UnderstandRunResult = {
    architecture: false,
    knowledgeCount: 0,
    questionCount: 0,
  }

  let architecture = getArchitectureSummary(opts.projectId)

  if (stages.includes('architecture')) {
    opts.onStage?.('architecture')
    architecture = await generateArchitectureSummary(opts.projectId, graph, opts.llm, opts.language)
    replaceArchitectureSummary(opts.projectId, architecture)
    result.architecture = true
  }

  if (!architecture && (stages.includes('knowledge') || stages.includes('interview'))) {
    opts.onStage?.('architecture')
    architecture = await generateArchitectureSummary(opts.projectId, graph, undefined, opts.language)
    replaceArchitectureSummary(opts.projectId, architecture)
    result.architecture = true
  }

  if (!architecture) {
    return result
  }

  if (stages.includes('knowledge')) {
    opts.onStage?.('knowledge')
    const nodes = await generateKnowledgeNodes(opts.projectId, architecture, graph, opts.llm, opts.language)
    replaceKnowledgeNodes(opts.projectId, nodes)
    result.knowledgeCount = nodes.length
  }

  if (stages.includes('interview')) {
    opts.onStage?.('interview')
    const knowledge = listKnowledgeNodes(opts.projectId)
    const questions = await generateInterviewQuestions(
      opts.projectId,
      architecture,
      knowledge,
      opts.llm,
      opts.language,
    )
    replaceQuestions(opts.projectId, questions)
    result.questionCount = questions.length
  }

  return result
}
