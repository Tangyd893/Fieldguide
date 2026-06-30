/**
 * Tests for IPC error shapes — architecture.md §7.5 contract.
 */
import { describe, it, expect } from 'vitest'
import { ipcOk, ipcErr } from '../ipc'
import type { IpcResult, IpcErrorCode } from '../ipc'

describe('ipcOk', () => {
  it('wraps data in ok result', () => {
    const result = ipcOk({ name: 'test' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toEqual({ name: 'test' })
    }
  })

  it('handles null data', () => {
    const result = ipcOk(null)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toBeNull()
    }
  })

  it('handles undefined data', () => {
    const result = ipcOk(undefined)
    expect(result.ok).toBe(true)
  })
})

describe('ipcErr', () => {
  it('returns error with correct shape', () => {
    const result = ipcErr('PROJECT_NOT_FOUND', '项目不存在')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('PROJECT_NOT_FOUND')
      expect(result.error.message).toBe('项目不存在')
      expect(result.error.retryable).toBe(false)
    }
  })

  it('marks retryable errors correctly', () => {
    const retryable: IpcErrorCode[] = [
      'INDEX_IN_PROGRESS',
      'GIT_CLONE_FAILED',
      'LLM_RATE_LIMIT',
      'LLM_API_ERROR',
    ]
    const nonRetryable: IpcErrorCode[] = [
      'PROJECT_NOT_FOUND',
      'LLM_NOT_CONFIGURED',
      'PARSE_ERROR',
      'SOURCE_UNAVAILABLE',
      'UNKNOWN',
    ]

    for (const code of retryable) {
      const result = ipcErr(code, 'test', true)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.retryable).toBe(true)
      }
    }

    for (const code of nonRetryable) {
      const result = ipcErr(code, 'test')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.retryable).toBe(false)
      }
    }
  })

  it('includes all error shape fields', () => {
    const result = ipcErr('LLM_API_ERROR', '请求超时', true)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      // Verify shape matches architecture.md §7.5
      expect(typeof result.error.code).toBe('string')
      expect(typeof result.error.message).toBe('string')
      expect(typeof result.error.retryable).toBe('boolean')
      expect(Object.keys(result.error)).toHaveLength(3)
    }
  })
})

describe('IpcResult type discrimination', () => {
  it('narrows ok correctly', () => {
    const result: IpcResult<{ id: number }> = ipcOk({ id: 42 })
    if (result.ok) {
      // TypeScript should know data has { id: number }
      expect(result.data.id).toBe(42)
    } else {
      // Should not reach here
      expect.fail('Expected ok result')
    }
  })

  it('narrows error correctly', () => {
    const result: IpcResult<{ id: number }> = ipcErr('UNKNOWN', 'test')
    if (!result.ok) {
      expect(result.error.code).toBe('UNKNOWN')
    } else {
      expect.fail('Expected error result')
    }
  })
})
