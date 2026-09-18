/**
 * FieldGuide understanding-workbench models & panel catalog.
 * Knowledge stays in-app — no external PKB / Obsidian coupling.
 */

/** V1 fixed panel types for Code Map split workspace */
export type PanelTab =
  | 'graph'
  | 'code'
  | 'chat'
  | 'tour'
  | 'overview'
  | 'knowledge'
  | 'interview'
  | 'explore'

export const ALL_PANEL_TABS: PanelTab[] = [
  'overview',
  'graph',
  'code',
  'chat',
  'tour',
  'knowledge',
  'interview',
  'explore',
]

/** Product analysis stages (distinct from UA index phases) */
export type AnalysisStage = 'structure' | 'architecture' | 'knowledge' | 'interview'

export const ANALYSIS_STAGES: AnalysisStage[] = [
  'structure',
  'architecture',
  'knowledge',
  'interview',
]

export interface ArchitectureModule {
  name: string
  layer?: string
  description?: string
  nodeIds?: string[]
}

export interface ArchitectureFlow {
  name: string
  description?: string
  steps?: string[]
}

export interface TechChoice {
  name: string
  reason?: string
  alternatives?: string[]
}

export interface ArchitectureSummary {
  projectId: string
  stack: string[]
  layers: Array<{ id?: string; name: string; description?: string }>
  modules: ArchitectureModule[]
  keyFlows: ArchitectureFlow[]
  techChoices: TechChoice[]
  entryPoints?: string[]
  generatedAt: string
  source: 'heuristic' | 'llm'
}

export interface KnowledgeNode {
  id: string
  projectId: string
  concept: string
  principle: string
  tradeoffs: string
  examples: string
  relatedNodeIds: string[]
  createdAt: string
}

export interface InterviewQuestion {
  id: string
  projectId: string
  problem: string
  context: string
  answer: string
  relatedConcepts: string[]
  knowledgeIds: string[]
  relatedNodeIds: string[]
  createdAt: string
}

export type LayoutPresetId =
  | 'default'
  | 'overview-graph'
  | 'knowledge-code'
  | 'interview-chat'
  | 'tour-code'
  | 'explore-code'

export interface LayoutPresetDef {
  id: LayoutPresetId
  labelKey: string
  left: PanelTab
  right?: PanelTab
  direction?: 'horizontal' | 'vertical'
}

export const LAYOUT_PRESETS: LayoutPresetDef[] = [
  { id: 'default', labelKey: 'split.preset.default', left: 'graph' },
  { id: 'overview-graph', labelKey: 'split.preset.overviewGraph', left: 'overview', right: 'graph' },
  { id: 'knowledge-code', labelKey: 'split.preset.knowledgeCode', left: 'knowledge', right: 'code' },
  { id: 'interview-chat', labelKey: 'split.preset.interviewChat', left: 'interview', right: 'chat' },
  { id: 'tour-code', labelKey: 'split.preset.tourCode', left: 'tour', right: 'code' },
  { id: 'explore-code', labelKey: 'split.preset.exploreCode', left: 'explore', right: 'code' },
]

/** Normalize saved panel tabs to the full V1 catalog (canonical order). */
export function migratePanelTabs(_tabs?: unknown): PanelTab[] {
  return [...ALL_PANEL_TABS]
}

export function isPanelTab(v: unknown): v is PanelTab {
  return typeof v === 'string' && (ALL_PANEL_TABS as string[]).includes(v)
}
