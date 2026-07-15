export type AgentStepType = 'thought' | 'action' | 'observation' | 'answer'

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
}

export interface AgentContext {
  projectId: string
  projectName: string
  projectRoot: string
  locale: string
}
