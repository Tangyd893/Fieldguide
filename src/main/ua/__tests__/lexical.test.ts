/**
 * Lexical retrieval layer: CJK tokenization, BM25, bilingual expansion, RRF.
 *
 * These are the pure functions behind the measured improvement in
 * docs/eval/agent-baseline.md (Chinese questions: 12.8% → 42.1% Recall@5 on an
 * English-indexed repo; 29.6% → 89.2% on a Chinese-indexed one), so each step is
 * pinned here rather than only being visible as an aggregate number.
 */
import { describe, it, expect } from 'vitest'
import {
  ZH_TERM_MAP,
  buildLexicalIndex,
  documentText,
  expandQuery,
  lexicalSearch,
  rrfFuse,
  tokenize,
  type LexicalNode,
} from '../lexical'

function node(id: string, name: string, extra: Partial<LexicalNode> = {}): LexicalNode {
  return { id, name, summary: extra.summary ?? '', tags: extra.tags ?? [], filePath: extra.filePath, type: extra.type }
}

describe('tokenize', () => {
  it('splits camelCase, PascalCase and separators into identifiers', () => {
    expect(tokenize('ErrQueueFull')).toEqual(['err', 'queue', 'full'])
    expect(tokenize('internal/store/memory.go')).toEqual(['internal', 'store', 'memory', 'go'])
    expect(tokenize('NewHandler')).toEqual(['new', 'handler'])
    expect(tokenize('read_path')).toEqual(['read', 'path'])
  })

  it('turns CJK runs into character bigrams (no whitespace to split on)', () => {
    expect(tokenize('队列满了')).toEqual(['队列', '列满', '满了'])
    expect(tokenize('内存存储')).toEqual(['内存', '存存', '存储'])
    expect(tokenize('入口')).toEqual(['入口'])
  })

  it('drops question words and latin stopwords that carry no signal', () => {
    const tokens = tokenize('这个项目的事件是怎么处理的 what does it do')
    expect(tokens).not.toContain('这个')
    expect(tokens).not.toContain('是怎')
    expect(tokens).not.toContain('what')
    expect(tokens).not.toContain('does')
    expect(tokens).toContain('项目')
    expect(tokens).toContain('事件')
  })

  it('keeps digits and handles empty input', () => {
    expect(tokenize('')).toEqual([])
    expect(tokenize('   ')).toEqual([])
    expect(tokenize('http2 200')).toEqual(['http2', '200'])
  })
})

describe('expandQuery', () => {
  it('adds english candidates for chinese terms present in the query', () => {
    const { primary, expanded, matchedTerms } = expandQuery('缓存是怎么实现的')
    expect(primary).toContain('缓存')
    expect(expanded).toContain('cache')
    expect(expanded).toContain('lru')
    expect(matchedTerms).toContain('缓存')
  })

  it('prefers the longest matching key so a specific term is not shadowed', () => {
    const { matchedTerms } = expandQuery('依赖注入是怎么做的')
    expect(matchedTerms).toContain('依赖注入')
    expect(matchedTerms).not.toContain('依赖')
  })

  it('never duplicates a token the query already produced', () => {
    const { primary, expanded } = expandQuery('缓存 cache 怎么用')
    expect(primary).toContain('cache')
    expect(expanded).not.toContain('cache')
  })

  it('is a no-op for a latin query and for unmatched chinese', () => {
    expect(expandQuery('handleRequest pool').expanded).toEqual([])
    expect(expandQuery('量子纠缠').expanded).toEqual([])
  })

  it('keeps every candidate tokenizable and non-empty (map hygiene)', () => {
    for (const [zh, candidates] of Object.entries(ZH_TERM_MAP)) {
      // Single-character keys are legitimate (锁 → mutex/lock) but must not be empty.
      expect(zh.trim().length, `key ${zh} must not be empty`).toBeGreaterThan(0)
      expect(candidates.length, `key ${zh} needs candidates`).toBeGreaterThan(0)
      for (const candidate of candidates) {
        expect(tokenize(candidate).length, `key ${zh} → "${candidate}" tokenizes to nothing`).toBeGreaterThan(0)
      }
    }
  })
})

describe('lexicalSearch', () => {
  const NODES: LexicalNode[] = [
    node('f:cache.go', 'lru.go', {
      summary: 'Concurrency-safe LRU cache with TTL limits.',
      tags: ['cache', 'lru', 'ttl'],
      filePath: 'internal/cache/lru.go',
      type: 'file',
    }),
    node('f:pool.go', 'pool.go', {
      summary: 'Bounded worker pool with ErrQueueFull back-pressure.',
      tags: ['worker-pool', 'back-pressure'],
      filePath: 'internal/worker/pool.go',
      type: 'file',
    }),
    node('f:store.go', 'memory.go', {
      summary: '有界的内存环形缓冲，用读写锁保护。',
      tags: ['存储层', '读写锁'],
      filePath: 'internal/store/memory.go',
      type: 'file',
    }),
  ]
  const index = buildLexicalIndex(NODES)

  it('ranks the identifier match first for a latin query', () => {
    const hits = lexicalSearch(index, 'ErrQueueFull', 3)
    expect(hits[0].nodeId).toBe('f:pool.go')
  })

  it('finds a chinese-indexed document from a chinese query (bigrams)', () => {
    const hits = lexicalSearch(index, '内存是怎么保护的', 3, { expand: false })
    expect(hits.map((h) => h.nodeId)).toContain('f:store.go')
  })

  it('bridges a chinese query to an english-indexed document via the term map', () => {
    // Without expansion the Chinese query has nothing to match in English text.
    expect(lexicalSearch(index, '缓存和过期时间怎么处理', 3, { expand: false })).toEqual([])
    const expanded = lexicalSearch(index, '缓存和过期时间怎么处理', 3, { expand: true })
    expect(expanded[0].nodeId).toBe('f:cache.go')
  })

  it('weights expanded tokens below the query\'s own tokens', () => {
    const query = '背压' // expands to back-pressure/queuefull/queue
    const withExpansion = lexicalSearch(index, query, 3, { expand: true, expandedWeight: 1 })
    const discounted = lexicalSearch(index, query, 3, { expand: true, expandedWeight: 0.1 })
    expect(withExpansion[0].nodeId).toBe('f:pool.go')
    expect(discounted.map((h) => h.nodeId)).toContain('f:pool.go')
    expect(discounted[0].score).toBeLessThan(withExpansion[0].score)
  })

  it('returns nothing for an unmatched query and honours the limit deterministically', () => {
    expect(lexicalSearch(index, 'zzz-nonexistent', 3)).toEqual([])
    const first = lexicalSearch(index, 'go', 10).map((h) => h.nodeId)
    const second = lexicalSearch(index, 'go', 10).map((h) => h.nodeId)
    expect(first).toEqual(second)
    expect(lexicalSearch(index, 'go', 1).length).toBeLessThanOrEqual(1)
  })

  it('treats an empty index and empty query as no results, not a crash', () => {
    const empty = buildLexicalIndex([])
    expect(lexicalSearch(empty, 'anything', 5)).toEqual([])
    expect(lexicalSearch(index, '   ', 5)).toEqual([])
  })
})

describe('rrfFuse', () => {
  it('ranks an item highly when both channels agree', () => {
    const fused = rrfFuse([['a', 'b', 'c'], ['a', 'c', 'b']])
    expect(fused[0]).toBe('a')
  })

  it('keeps items that only one channel found', () => {
    const fused = rrfFuse([['a'], ['b', 'a']])
    expect(new Set(fused)).toEqual(new Set(['a', 'b']))
  })

  it('is deterministic and accepts hit objects as well as ids', () => {
    const a = rrfFuse([['x', 'y'], [{ nodeId: 'y' }, { nodeId: 'z' }]])
    const b = rrfFuse([['x', 'y'], ['y', 'z']])
    expect(a).toEqual(b)
  })

  it('returns an empty list when there is nothing to fuse', () => {
    expect(rrfFuse([])).toEqual([])
    expect(rrfFuse([[], []])).toEqual([])
  })
})

describe('documentText', () => {
  it('includes the fields retrieval relies on, in priority order', () => {
    const text = documentText(node('n1', 'pool.go', { summary: 'bounded', tags: ['queue'], filePath: 'a/pool.go', type: 'file' }))
    expect(text).toBe('pool.go a/pool.go bounded queue file')
  })

  it('falls back to label and tolerates missing fields', () => {
    expect(documentText({ id: 'n2', label: 'Thing' })).toBe('Thing')
    expect(documentText({ id: 'n3' })).toBe('')
  })
})
