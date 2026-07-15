/**
 * IPC helper failure-path tests — architecture.md §7.5
 */
import { describe, it, expect } from 'vitest'
import { ipcOk, ipcErr } from '../../../shared/ipc'

describe('IPC error shapes (handler contract)', () => {
  it('ipcOk wraps data', () => {
    const r = ipcOk({ id: 'p1' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data).toEqual({ id: 'p1' })
  })

  it('ipcErr PROJECT_NOT_FOUND is not retryable', () => {
    const r = ipcErr('PROJECT_NOT_FOUND', '项目不存在')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.code).toBe('PROJECT_NOT_FOUND')
      expect(r.error.retryable).toBe(false)
    }
  })

  it('ipcErr INDEX_IN_PROGRESS is retryable', () => {
    const r = ipcErr('INDEX_IN_PROGRESS', '索引中', true)
    if (!r.ok) expect(r.error.retryable).toBe(true)
  })

  it('ipcErr INDEX_CANCELLED is not retryable', () => {
    const r = ipcErr('INDEX_CANCELLED', '已取消', false)
    if (!r.ok) {
      expect(r.error.code).toBe('INDEX_CANCELLED')
      expect(r.error.retryable).toBe(false)
    }
  })

  it('ipcErr LLM_NOT_CONFIGURED is retryable', () => {
    const r = ipcErr('LLM_NOT_CONFIGURED', '请配置 Key', true)
    if (!r.ok) expect(r.error.retryable).toBe(true)
  })

  it('ipcErr GIT_CLONE_FAILED is retryable', () => {
    const r = ipcErr('GIT_CLONE_FAILED', 'clone 失败', true)
    if (!r.ok) expect(r.error.retryable).toBe(true)
  })

  it('ipcErr SOURCE_UNAVAILABLE is not retryable by default', () => {
    const r = ipcErr('SOURCE_UNAVAILABLE', '文件不存在')
    if (!r.ok) expect(r.error.retryable).toBe(false)
  })
})
