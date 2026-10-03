export type AgentStepType = 'thought' | 'action' | 'observation' | 'answer' | 'context'

export interface AgentStep {
  type: AgentStepType
  content: string
  tool?: string
}

export interface AgentToolCall {
  name: string
  arguments: Record<string, unknown>
}

export interface AgentResult {
  content: string
  steps: AgentStep[]
  nodeRefs: string[]
  /**
   * True when the answer text was already streamed to the caller.
   *
   * The UI needs this to know whether to render `content` from scratch or keep the
   * text it has been appending — otherwise a streamed answer would appear twice.
   */
  streamed?: boolean
}

export interface AgentContext {
  projectId: string
  projectName: string
  projectRoot: string
  locale: string
  /** Currently selected graph node in the Dashboard (optional). */
  focusedNodeId?: string | null
  /** Current guided-tour step index from Dashboard / TourPanel (optional). */
  tourStepIndex?: number | null
}
