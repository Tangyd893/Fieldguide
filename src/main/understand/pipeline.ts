/**
 * Progressive understanding pipeline: architecture → knowledge → interview.
 * Runs after UA structure index; stages are skippable independently via IPC.
 *
 * A stage failing must not discard the work of the stages before it:
 * product-spec.md §六 requires "失败保留部分结果", so each stage is isolated and
 * its outcome is reported per-stage instead of throwing out of the pipeline.
 */
import { loadGraph } from '../ua/graph-reader'
import {
  replaceArchitectureSummary,
  replaceKnowledgeNodes,
  replaceQuestions,
  listKnowledgeNodes,
  getArchitectureSummary,
} from '../db'
import {
  generateArchitectureSummary,
  type GraphLike,
  type LLMConfig,
} from './architecture'
import { generateKnowledgeNodes } from './knowledge'
import { generateInterviewQuestions } from './interview'
import type { AnalysisStage, ArchitectureSummary } from '../../shared/understand'

export interface UnderstandRunOptions {
  projectId: string
  rootPath: string
  stages?: AnalysisStage[]
  llm?: LLMConfig
  language?: string
  onStage?: (stage: AnalysisStage) => void
}

/** Per-stage outcome, so callers can tell "skipped" from "failed". */
export interface StageOutcome {
  stage: AnalysisStage
  status: 'completed' | 'skipped' | 'failed'
  count?: number
  error?: string
}

export interface UnderstandRunResult {
  architecture: boolean
  knowledgeCount: number
  questionCount: number
  /** Present for every requested stage, in execution order. */
  stages: StageOutcome[]
}

const DEFAULT_STAGES: AnalysisStage[] = ['architecture', 'knowledge', 'interview']

/** Build (or rebuild) the architecture summary and persist it. */
async function ensureArchitecture(
  projectId: string,
  graph: GraphLike,
  llm: LLMConfig | undefined,
  language: string | undefined,
  onStage: ((stage: AnalysisStage) => void) | undefined,
  /** False for the implicit dependency run, so progress UIs don't announce a stage the user did not request. */
  reportStage: boolean,
): Promise<ArchitectureSummary> {
  if (reportStage) onStage?.('architecture')
  const summary = await generateArchitectureSummary(projectId, graph, llm, language)
  replaceArchitectureSummary(projectId, summary)
  return summary
}

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
    stages: [],
  }
  const record = (outcome: StageOutcome) => result.stages.push(outcome)

  // Architecture is a dependency of the other two stages, so it may run even
  // when it was not requested (that implicit run is not reported as a user stage).
  let architecture = getArchitectureSummary(opts.projectId)
  const architectureRequested = stages.includes('architecture')

  if (architectureRequested || (!architecture && (stages.includes('knowledge') || stages.includes('interview')))) {
    try {
      architecture = await ensureArchitecture(
        opts.projectId,
        graph,
        opts.llm,
        opts.language,
        opts.onStage,
        architectureRequested,
      )
      result.architecture = true
      if (architectureRequested) record({ stage: 'architecture', status: 'completed' })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (architectureRequested) record({ stage: 'architecture', status: 'failed', error: message })
      console.warn(`[understand/pipeline] architecture stage failed: ${message}`)
    }
  }

  // Without architecture there is nothing to ground the later stages on.
  if (!architecture) {
    for (const stage of stages) {
      if (stage !== 'architecture') {
        record({ stage, status: 'skipped', error: 'architecture summary unavailable' })
      }
    }
    return result
  }

  if (stages.includes('knowledge')) {
    opts.onStage?.('knowledge')
    try {
      const nodes = await generateKnowledgeNodes(opts.projectId, architecture, graph, opts.llm, opts.language)
      replaceKnowledgeNodes(opts.projectId, nodes)
      result.knowledgeCount = nodes.length
      record({ stage: 'knowledge', status: 'completed', count: nodes.length })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      record({ stage: 'knowledge', status: 'failed', error: message })
      console.warn(`[understand/pipeline] knowledge stage failed: ${message}`)
    }
  }

  if (stages.includes('interview')) {
    opts.onStage?.('interview')
    try {
      // Generated knowledge may have failed; fall back to whatever is persisted.
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
      record({ stage: 'interview', status: 'completed', count: questions.length })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      record({ stage: 'interview', status: 'failed', error: message })
      console.warn(`[understand/pipeline] interview stage failed: ${message}`)
    }
  }

  return result
}
