/**
 * Coach extensions: tutor questioning (B4), code review (B5) and learning paths (B6).
 *
 * Every entry point works without an API key by falling back to a heuristic built
 * from data the app already computed (graph, knowledge cards, debt scan), and
 * upgrades to an LLM answer when one is configured. That keeps the features
 * demonstrable offline and matches how the index/understand pipelines behave.
 */
import { getArchitectureSummary, listKnowledgeNodes, listQuestions } from './db'
import { loadGraph, getNode, getNeighbors } from './ua/graph-reader'
import { callLLM, extractJson, type LLMConfig } from './llm/client'
import { scanProjectDebt } from './insights'
import type { ReviewFindingInput, LearningStep } from './db'

export interface CoachContextInput {
  projectId: string
  projectName: string
  rootPath: string
  focusedNodeId?: string | null
  filePath?: string | null
  language?: string
}

/* ──────────── B4: tutor question ──────────── */

export interface TutorQuestion {
  question: string
  /** Points a good answer should touch. */
  hints: string[]
  nodeIds: string[]
  source: 'heuristic' | 'llm'
}

function nodeBrief(rootPath: string, nodeId: string): string {
  const graph = loadGraph(rootPath)
  if (!graph) return nodeId
  const node = getNode(graph, nodeId)
  if (!node) return nodeId
  const neighbors = getNeighbors(graph, nodeId, 1).nodes
    .filter((n) => n.id !== nodeId)
    .slice(0, 6)
    .map((n) => `${n.label || n.name || n.id}(${n.type})`)
  return [
    `${node.label || node.name || node.id} [${node.type}]`,
    node.filePath ? `file=${node.filePath}${node.lineRange ? `:${node.lineRange[0]}-${node.lineRange[1]}` : ''}` : '',
    node.metadata?.summary ? `summary=${node.metadata.summary}` : '',
    neighbors.length ? `connected to: ${neighbors.join(', ')}` : '',
  ].filter(Boolean).join('\n')
}

/** Fallback question built from the focused node alone. */
function heuristicQuestion(graph: ReturnType<typeof loadGraph>, focusedNodeId: string | null | undefined): TutorQuestion {
  const node = graph && focusedNodeId ? getNode(graph, focusedNodeId) : undefined
  if (!node) {
    return {
      question: '这个项目的入口在哪？它初始化了哪些东西，顺序为什么是这样？',
      hints: ['找到 main / 入口文件', '列出被初始化的组件', '说明初始化顺序的依赖关系'],
      nodeIds: [],
      source: 'heuristic',
    }
  }

  const name = node.label || node.name || node.id
  const neighbors = graph ? getNeighbors(graph, node.id, 1).nodes.filter((n) => n.id !== node.id) : []
  return {
    question: `\`${name}\` 为什么放在这一层？如果把它换掉，哪些地方会受影响？`,
    hints: [
      node.metadata?.summary ? `它的职责：${node.metadata.summary}` : '先说明它的职责',
      neighbors.length ? `直接相关的 ${neighbors.length} 个节点：${neighbors.slice(0, 5).map((n) => n.label || n.name || n.id).join('、')}` : '列出它的上下游',
      '说出一个替代方案，以及为什么不选它',
    ],
    nodeIds: [node.id],
    source: 'heuristic',
  }
}

/** Generate a project-grounded question for the reader. */
export async function generateTutorQuestion(
  ctx: CoachContextInput,
  llm?: LLMConfig,
): Promise<TutorQuestion> {
  const graph = loadGraph(ctx.rootPath)
  if (!llm) return heuristicQuestion(graph, ctx.focusedNodeId)

  const architecture = getArchitectureSummary(ctx.projectId)
  const knowledge = listKnowledgeNodes(ctx.projectId).slice(0, 8)

  const prompt = `You are a senior engineer tutoring someone who is reading this repository.
Ask ONE probing question that tests real understanding of the code (not trivia), then list 2-4 answer points.

Project: ${ctx.projectName}
${architecture ? `Layers: ${architecture.layers.map((l) => l.name).join(' → ')}` : ''}
${architecture?.keyFlows?.length ? `Main flow: ${architecture.keyFlows[0].name} (${(architecture.keyFlows[0].steps ?? []).join(' → ')})` : ''}
${knowledge.length ? `Known concepts: ${knowledge.map((k) => k.concept).join(', ')}` : ''}
${ctx.focusedNodeId ? `Currently looking at:\n${nodeBrief(ctx.rootPath, ctx.focusedNodeId)}` : ''}
${ctx.filePath ? `Open file: ${ctx.filePath}` : ''}

Return JSON: { "question": string, "hints": string[], "nodeIds": string[] }
nodeIds must be ids that appear in the context above (may be empty).`

  try {
    const response = await callLLM(prompt, llm, ctx.language, { temperature: 0.6, maxTokens: 900 })
    const parsed = extractJson(response) as { question?: string; hints?: unknown; nodeIds?: unknown }
    if (!parsed.question) return heuristicQuestion(graph, ctx.focusedNodeId)
    return {
      question: String(parsed.question),
      hints: Array.isArray(parsed.hints) ? parsed.hints.map(String).slice(0, 6) : [],
      nodeIds: Array.isArray(parsed.nodeIds) ? parsed.nodeIds.map(String).slice(0, 8) : [],
      source: 'llm',
    }
  } catch (err) {
    console.warn(`[tutor] LLM question failed: ${String(err)}`)
    return heuristicQuestion(graph, ctx.focusedNodeId)
  }
}

export interface TutorEvaluation {
  score: number
  verdict: 'weak' | 'ok' | 'strong'
  missed: string[]
  feedback: string
  source: 'heuristic' | 'llm'
}

/** Evaluate the reader's own explanation against the question's answer points. */
export async function evaluateTutorAnswer(
  ctx: CoachContextInput,
  question: string,
  answer: string,
  hints: string[],
  llm?: LLMConfig,
): Promise<TutorEvaluation> {
  const trimmed = answer.trim()

  const heuristic = (): TutorEvaluation => {
    const words = trimmed ? trimmed.split(/\s+|(?=[\u4e00-\u9fa5])/).filter(Boolean).length : 0
    const hit = hints.filter((h) => {
      // Cheap keyword overlap: any token of the hint longer than 3 chars appears.
      const tokens = h.split(/[\s，,。；;：:()（）]+/).filter((t) => t.length >= 3)
      return tokens.some((t) => trimmed.includes(t))
    })
    const coverage = hints.length > 0 ? hit.length / hints.length : 0
    const score = Math.max(0, Math.min(5, Math.round(coverage * 4 + (words > 60 ? 1 : 0))))
    return {
      score,
      verdict: score >= 4 ? 'strong' : score >= 2 ? 'ok' : 'weak',
      missed: hints.filter((h) => !hit.includes(h)),
      feedback: words === 0
        ? '先用自己的话写一段，哪怕不完整——写出来才知道哪里是空的。'
        : coverage >= 0.6
          ? '覆盖面不错，补上遗漏点就能形成完整表述。'
          : '回答偏薄：试着按「职责 → 依赖 → 取舍」三段展开。',
      source: 'heuristic',
    }
  }

  if (!llm || !trimmed) return heuristic()

  try {
    const prompt = `Grade this explanation of a code question. Be concrete and strict.

Question: ${question}
Expected points: ${hints.map((h, i) => `${i + 1}. ${h}`).join(' | ') || '(none provided)'}
${ctx.focusedNodeId ? `Node in question:\n${nodeBrief(ctx.rootPath, ctx.focusedNodeId)}` : ''}

Learner's answer:
"""
${trimmed.slice(0, 4000)}
"""

Return JSON: { "score": 0-5, "missed": string[], "feedback": string }`

    const response = await callLLM(prompt, llm, ctx.language, { temperature: 0.2, maxTokens: 700 })
    const parsed = extractJson(response) as { score?: number; missed?: unknown; feedback?: string }
    const score = Math.max(0, Math.min(5, Math.round(Number(parsed.score) || 0)))
    return {
      score,
      verdict: score >= 4 ? 'strong' : score >= 2 ? 'ok' : 'weak',
      missed: Array.isArray(parsed.missed) ? parsed.missed.map(String).slice(0, 6) : [],
      feedback: String(parsed.feedback || ''),
      source: 'llm',
    }
  } catch (err) {
    console.warn(`[tutor] LLM evaluation failed: ${String(err)}`)
    return heuristic()
  }
}

/* ──────────── B5: code / architecture review ──────────── */

export interface CodeReviewResult {
  findings: ReviewFindingInput[]
  filesReviewed: string[]
  source: 'heuristic' | 'llm'
}

export interface CodeReviewOptions {
  /** Files to review; defaults to the highest-fan-in file nodes. */
  paths?: string[]
  maxFiles?: number
  language?: string
}

function pickReviewTargets(rootPath: string, maxFiles: number): string[] {
  const graph = loadGraph(rootPath)
  if (!graph) return []
  const fanIn = new Map<string, number>()
  for (const edge of graph.edges ?? []) {
    if (edge.type === 'contains') continue
    fanIn.set(edge.target, (fanIn.get(edge.target) ?? 0) + 1)
  }
  const score = new Map<string, number>()
  for (const node of graph.nodes) {
    if (!node.filePath) continue
    score.set(node.filePath, (score.get(node.filePath) ?? 0) + (fanIn.get(node.id) ?? 0))
  }
  return [...score.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, maxFiles)
    .map(([path]) => path)
}

/**
 * Review the project's most load-bearing files.
 *
 * Heuristic mode reuses the debt scan (markers, oversized files, fan-in) so the
 * panel is never empty; LLM mode adds bug/architecture findings with detail.
 */
export async function runCodeReview(
  ctx: CoachContextInput,
  opts: CodeReviewOptions = {},
  llm?: LLMConfig,
): Promise<CodeReviewResult> {
  const maxFiles = Math.min(Math.max(opts.maxFiles ?? 6, 1), 12)
  const paths = opts.paths?.length ? opts.paths.slice(0, maxFiles) : pickReviewTargets(ctx.rootPath, maxFiles)

  if (!llm) {
    const debt = await scanProjectDebt(ctx.projectId, { maxItems: 40, maxFiles: 400 })
    const findings: ReviewFindingInput[] = debt.items
      .filter((item) => item.kind !== 'no-summary')
      .slice(0, 25)
      .map((item) => ({
        severity: item.kind === 'todo' && item.weight >= 3 ? 'high' : item.kind === 'high-fan-in' ? 'medium' : 'low',
        kind: item.kind === 'high-fan-in' ? 'architecture' : item.kind === 'todo' ? 'debt' : 'debt',
        title: item.kind === 'todo'
          ? `${item.detail.slice(0, 80)}`
          : item.kind === 'large-file'
            ? `超大文件：${item.path}`
            : `高扇入节点：${item.nodeId}`,
        detail: item.kind === 'high-fan-in'
          ? `${item.detail} —— 变更风险集中在这里`
          : item.kind === 'large-file'
            ? `${item.detail}（未配置 LLM，仅做启发式扫描）`
            : '未完成标记（未配置 LLM，仅做启发式扫描）',
        file_path: item.path ?? '',
        line: item.line ?? null,
        node_id: item.nodeId ?? '',
      }))
    return { findings, filesReviewed: paths, source: 'heuristic' }
  }

  // Read a bounded slice of each target file to keep the prompt small.
  const { readFileSync } = await import('node:fs')
  const { join } = await import('node:path')
  const snippets: string[] = []
  for (const rel of paths) {
    try {
      const content = readFileSync(join(ctx.rootPath, rel), 'utf-8')
      if (content.includes('\u0000')) continue
      snippets.push(`### ${rel}\n\`\`\`\n${content.slice(0, 6000)}\n\`\`\``)
    } catch { /* skip unreadable */ }
  }
  if (snippets.length === 0) return { findings: [], filesReviewed: [], source: 'llm' }

  const architecture = getArchitectureSummary(ctx.projectId)
  const prompt = `Review these files from a real repository like a strict senior reviewer.
Look for: potential bugs, architecture/design risks, and concrete tech debt. No style nitpicks.

Project: ${ctx.projectName}
${architecture ? `Layers: ${architecture.layers.map((l) => l.name).join(' → ')}` : ''}

${snippets.join('\n\n')}

Return JSON: { "findings": [{ "severity": "high|medium|low|info", "kind": "bug|architecture|debt|performance|security", "title": string, "detail": string, "file_path": string, "line": number|null }] }
At most 12 findings, most important first. file_path must be one of the file names above.`

  try {
    const response = await callLLM(prompt, llm, opts.language ?? ctx.language, { temperature: 0.2, maxTokens: 2500 })
    const parsed = extractJson(response) as { findings?: Array<Partial<ReviewFindingInput>> }
    const findings = (Array.isArray(parsed.findings) ? parsed.findings : [])
      .slice(0, 12)
      .map((f): ReviewFindingInput => ({
        severity: (['high', 'medium', 'low', 'info'] as const).includes(f.severity as never)
          ? (f.severity as ReviewFindingInput['severity'])
          : 'info',
        kind: (['bug', 'architecture', 'debt', 'performance', 'security'] as const).includes(f.kind as never)
          ? (f.kind as ReviewFindingInput['kind'])
          : 'debt',
        title: String(f.title || '未命名问题'),
        detail: String(f.detail || ''),
        file_path: String(f.file_path || ''),
        line: typeof f.line === 'number' ? f.line : null,
      }))
    return { findings, filesReviewed: paths, source: 'llm' }
  } catch (err) {
    console.warn(`[review] LLM review failed: ${String(err)}`)
    return { findings: [], filesReviewed: paths, source: 'llm' }
  }
}

/* ──────────── B6: learning path ──────────── */

export interface LearningPathResult {
  goal: string
  steps: LearningStep[]
  source: 'heuristic' | 'llm'
}

/** Order files by how central they are, which is a decent first reading order. */
function heuristicPath(ctx: CoachContextInput, goal: string): LearningStep[] {
  const graph = loadGraph(ctx.rootPath)
  const architecture = getArchitectureSummary(ctx.projectId)
  const steps: LearningStep[] = []
  let order = 1

  const entry = architecture?.entryPoints?.[0]
  if (entry) {
    steps.push({
      order: order++,
      title: `从入口开始：${entry.split('/').pop()}`,
      why: '先看程序从哪里开始，再顺着主数据流读下去。',
      files: [entry],
    })
  }

  for (const flow of architecture?.keyFlows?.slice(0, 2) ?? []) {
    steps.push({
      order: order++,
      title: `主数据流：${flow.name}`,
      why: flow.description || '跟着这条链路走一遍，形成整体印象。',
      nodeIds: [],
      files: [],
    })
  }

  // Then the most connected files, skipping ones already scheduled.
  const fanIn = new Map<string, number>()
  for (const edge of graph?.edges ?? []) {
    if (edge.type === 'contains') continue
    fanIn.set(edge.target, (fanIn.get(edge.target) ?? 0) + 1)
  }
  const byFile = new Map<string, number>()
  for (const node of graph?.nodes ?? []) {
    if (!node.filePath) continue
    byFile.set(node.filePath, (byFile.get(node.filePath) ?? 0) + (fanIn.get(node.id) ?? 0))
  }
  const seen = new Set(steps.flatMap((s) => s.files ?? []))
  for (const [file, score] of [...byFile.entries()].sort((a, b) => b[1] - a[1])) {
    if (steps.length >= 6) break
    if (seen.has(file)) continue
    seen.add(file)
    steps.push({
      order: order++,
      title: `精读：${file}`,
      why: `被依赖 ${score} 次，理解它才能读懂调用方。`,
      files: [file],
    })
  }

  const knowledge = listKnowledgeNodes(ctx.projectId).slice(0, 3)
  for (const card of knowledge) {
    steps.push({
      order: order++,
      title: `补齐概念：${card.concept}`,
      why: card.principle || '先把概念弄清，再看实现。',
      nodeIds: card.relatedNodeIds.slice(0, 3),
      files: [],
    })
  }

  if (steps.length === 0) {
    steps.push({
      order: 1,
      title: `围绕「${goal}」先索引并生成架构总览`,
      why: '这个项目还没有可用的图谱或架构信息，先生成分析产物。',
      files: [],
    })
  }

  return steps
}

/** Produce an ordered reading plan for a goal (job description, feature, …). */
export async function generateLearningPath(
  ctx: CoachContextInput,
  goal: string,
  llm?: LLMConfig,
): Promise<LearningPathResult> {
  const trimmedGoal = goal.trim()
  if (!llm || !trimmedGoal) {
    return { goal: trimmedGoal, steps: heuristicPath(ctx, trimmedGoal), source: 'heuristic' }
  }

  const graph = loadGraph(ctx.rootPath)
  const fileSample = (graph?.nodes ?? [])
    .filter((n) => n.type === 'file' && n.filePath)
    .slice(0, 60)
    .map((n) => ({ path: n.filePath, summary: n.metadata?.summary ?? '' }))
  const architecture = getArchitectureSummary(ctx.projectId)
  const knowledge = listKnowledgeNodes(ctx.projectId).slice(0, 12)

  const prompt = `Plan a study path through this repository for the following goal.

Goal: ${trimmedGoal}
Project: ${ctx.projectName}
${architecture ? `Layers: ${architecture.layers.map((l) => l.name).join(' → ')}` : ''}
${architecture?.keyFlows?.length ? `Flows: ${architecture.keyFlows.map((f) => f.name).join(', ')}` : ''}
${knowledge.length ? `Knowledge cards: ${knowledge.map((k) => k.concept).join(', ')}` : ''}
Files:
${JSON.stringify(fileSample, null, 1)}

Return JSON: { "steps": [{ "order": number, "title": string, "why": string, "files": string[] }] }
4-8 steps, ordered from broad to specific. "files" must come from the list above.`

  try {
    const response = await callLLM(prompt, llm, ctx.language, { temperature: 0.3, maxTokens: 1800 })
    const parsed = extractJson(response) as { steps?: Array<Partial<LearningStep>> }
    const steps = (Array.isArray(parsed.steps) ? parsed.steps : [])
      .slice(0, 10)
      .map((s, i): LearningStep => ({
        order: Number(s.order) || i + 1,
        title: String(s.title || `第 ${i + 1} 步`),
        why: String(s.why || ''),
        files: Array.isArray(s.files) ? s.files.map(String).slice(0, 6) : [],
        nodeIds: Array.isArray(s.nodeIds) ? s.nodeIds.map(String).slice(0, 6) : [],
      }))
    if (steps.length === 0) return { goal: trimmedGoal, steps: heuristicPath(ctx, trimmedGoal), source: 'heuristic' }
    return { goal: trimmedGoal, steps, source: 'llm' }
  } catch (err) {
    console.warn(`[path] LLM path failed: ${String(err)}`)
    return { goal: trimmedGoal, steps: heuristicPath(ctx, trimmedGoal), source: 'heuristic' }
  }
}

/** Knowledge cards exist? Used to decide whether a path can reference concepts. */
export function hasKnowledge(projectId: string): boolean {
  return listKnowledgeNodes(projectId).length > 0
}

/** Interview questions exist? Used by the review-card generator. */
export function questionCount(projectId: string): number {
  return listQuestions(projectId).length
}
