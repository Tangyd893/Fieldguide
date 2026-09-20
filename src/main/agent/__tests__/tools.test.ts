import { describe, it, expect } from 'vitest'
import { AGENT_TOOLS, buildAgentTools } from '../tools'
import { VAULT_TOOL_NAMES } from '../../obsidian/agent'
import { detectCoachIntent, coachPolicyHints } from '../context-packer'

/**
 * The vault tools are gated on a bound vault. A tool the model can see but never
 * use is an invitation to invent Obsidian contents, so the gating is asserted
 * rather than left to the prompt.
 */
describe('buildAgentTools', () => {
  it('exposes graph and paper tools only when no vault is bound', () => {
    const names = buildAgentTools().map((tool) => tool.function.name)
    expect(names).toContain('search_nodes')
    expect(names).toContain('query_paper')
    for (const vaultTool of VAULT_TOOL_NAMES) {
      expect(names).not.toContain(vaultTool)
    }
  })

  it('adds exactly the vault tools when a vault is bound', () => {
    const names = buildAgentTools({ vault: true }).map((tool) => tool.function.name)
    for (const vaultTool of VAULT_TOOL_NAMES) {
      expect(names).toContain(vaultTool)
    }
    expect(names.length).toBe(buildAgentTools().length + VAULT_TOOL_NAMES.size)
  })

  it('keeps the exported constant and the builder in sync', () => {
    expect(AGENT_TOOLS.map((tool) => tool.function.name)).toEqual(buildAgentTools().map((tool) => tool.function.name))
  })

  it('describes every vault tool with a schema the LLM client can accept', () => {
    for (const schema of buildAgentTools({ vault: true }).slice(-VAULT_TOOL_NAMES.size)) {
      expect(schema.type).toBe('function')
      expect(schema.function.name).toMatch(/^vault_/)
      expect(schema.function.description.length).toBeGreaterThan(20)
      expect(schema.function.parameters.type).toBe('object')
    }
  })
})

describe('detectCoachIntent — vault', () => {
  it('routes questions about the reader\'s notes to the vault', () => {
    expect(detectCoachIntent('我的 Obsidian 卡片里有哪些取舍？')).toBe('vault')
    expect(detectCoachIntent('知识卡片里怎么写的')).toBe('vault')
    expect(detectCoachIntent('我在 vault 里记了什么')).toBe('vault')
    expect(detectCoachIntent('what did my notes say about auth?')).toBe('vault')
  })

  it('still routes project-overview questions to overview', () => {
    expect(detectCoachIntent('介绍这个项目')).toBe('overview')
    expect(detectCoachIntent('项目架构分层')).toBe('overview')
  })

  it('keeps code and paper questions where they were', () => {
    expect(detectCoachIntent('认证怎么实现的')).toBe('code')
    expect(detectCoachIntent('这篇论文的 chunk 策略')).toBe('paper')
  })

  it('gives vault answers their own policy hints', () => {
    const hints = coachPolicyHints('vault')
    expect(hints).toContain('vault_list_cards')
    expect(hints).toContain('note path')
  })
})
