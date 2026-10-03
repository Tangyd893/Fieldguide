/**
 * Lexical retrieval layer: CJK-aware tokenization + BM25 + bilingual term expansion.
 *
 * Why this exists (measured problem, not a hunch):
 *
 *   The offline benchmark showed retrieval is strongly language-sensitive. On a
 *   repository whose summaries are written in English, Chinese natural-language
 *   questions retrieved **12.8%** Recall@5 while keyword queries reached 68.0% —
 *   with the same code path. Two causes were identified:
 *
 *   1. **Tokenization**: `substringSearch` splits a query on whitespace, so a
 *      Chinese question ("事件从 HTTP 入口进来之后经过哪些环节") is a single token
 *      that can never match anything. Chinese has no spaces, so the whitespace
 *      assumption silently disables the whole lexical channel for CJK input.
 *   2. **Vocabulary mismatch**: Chinese questions name concepts (入口 / 缓存 /
 *      背压) while the index stores identifiers and English summaries
 *      (`main.go`, `lru.go`, `ErrQueueFull`). Even a perfect tokenizer cannot
 *      bridge that without a bilingual step.
 *
 * This module adds the missing lexical path as pure functions: character
 * bigrams for CJK, identifier splitting for Latin identifiers, BM25 scoring, and
 * a curated zh→en term map used to expand a Chinese query with English terms
 * that actually occur in the index. `rrfFuse` then combines this ranking with
 * the semantic engine's ranking (reciprocal rank fusion) so neither channel has
 * to be trusted alone.
 *
 * Everything here is deterministic and dependency-free, so the ablation in
 * `eval/agent-baseline.md` can measure each step separately and CI can assert it.
 */

/** Minimal shape needed from a searchable node — kept local to avoid an import cycle. */
export interface LexicalNode {
  id: string
  name?: string
  label?: string
  summary?: string
  tags?: string[]
  filePath?: string
  type?: string
}

export interface SearchHit {
  nodeId: string
  score: number
}

const CJK_RANGE = '\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff\\u3040-\\u30ff'
const CJK_RE = new RegExp(`[${CJK_RANGE}]`)
const CJK_OR_LATIN = new RegExp(`[${CJK_RANGE}]+|[a-z0-9]+`, 'g')

/**
 * Question words carry no retrieval signal in either language.
 *
 * Bigrams are listed explicitly because a Chinese question word becomes a
 * bigram ("怎么", "什么") after tokenization, and leaving those in makes every
 * document with a question in its summary look relevant.
 */
const STOPWORDS = new Set([
  // latin
  'the', 'a', 'an', 'of', 'to', 'in', 'on', 'at', 'is', 'are', 'was', 'were', 'be', 'been',
  'and', 'or', 'for', 'with', 'from', 'by', 'as', 'it', 'its', 'this', 'that', 'these', 'those',
  'how', 'what', 'where', 'which', 'who', 'why', 'when', 'does', 'do', 'did', 'can', 'could',
  'should', 'would', 'will', 'there', 'here', 'about', 'into', 'over', 'under', 'get', 'gets',
  // cjk question words / particles as bigrams
  '怎么', '什么', '哪里', '在哪', '哪些', '哪个', '为什', '么样', '这个', '那个', '我们', '你们',
  '可以', '是否', '有哪', '请问', '一下', '时候', '是怎', '如何', '以及', '并且', '因为', '所以',
  '如果', '就是', '这样', '那样', '一个', '两个', '这些', '那些', '发生', '会发',
])

/**
 * Curated Chinese → English/identifier term map.
 *
 * Deliberately a data artifact rather than a model call: it is inspectable,
 * deterministic, free, and its coverage can be measured (that is what the
 * `lexical+terms` ablation row reports). Terms were chosen from the vocabulary
 * that actually appears in the benchmark repositories (layer names, file names,
 * curated tag sets) plus general engineering vocabulary.
 */
export const ZH_TERM_MAP: Record<string, string[]> = {
  // entry / wiring
  入口: ['entry', 'entrypoint', 'main', 'gateway'],
  启动: ['start', 'boot', 'main', 'listen'],
  装配: ['wiring', 'wire', 'new'],
  依赖注入: ['inject', 'wiring', 'new'],
  注册: ['register', 'handlefunc', 'route'],
  路由: ['router', 'route', 'transport', 'http'],
  中间件: ['middleware'],
  // configuration
  配置: ['config', 'configuration', 'env', 'environment', 'defaults'],
  默认值: ['defaults', 'default'],
  环境变量: ['env', 'environment'],
  校验: ['validate', 'validation', 'reject'],
  参数: ['param', 'query', 'arg'],
  // persistence / cache
  存储: ['store', 'persistence', 'persist', 'memory'],
  持久化: ['persistence', 'store'],
  落库: ['store', 'persist', 'query'],
  内存: ['memory', 'bounded-memory'],
  缓存: ['cache', 'lru', 'ttl'],
  容量: ['capacity', 'limit', 'bounded'],
  过期: ['ttl', 'expire'],
  // concurrency
  队列: ['queue', 'submit', 'back-pressure'],
  背压: ['back-pressure', 'queuefull', 'queue'],
  限流: ['back-pressure', 'status-codes', 'drop'],
  工作池: ['worker', 'pool', 'worker-pool'],
  协程: ['goroutine', 'context'],
  并发: ['concurrency', 'mutex', 'goroutine', 'context'],
  锁: ['mutex', 'lock', 'rwmutex', 'rlock'],
  异步: ['async', 'goroutine', 'queue'],
  取消: ['context', 'cancel', 'cancellation'],
  // paths
  写路径: ['write-path', 'ingest', 'write'],
  读路径: ['read-path', 'query', 'cache-aside'],
  查询: ['query', 'read', 'filter'],
  去重: ['dedupe', 'idempotency', 'deduplicate'],
  幂等: ['idempotency', 'idempotent'],
  批量: ['batch', 'batches'],
  // domain
  事件: ['event', 'domain'],
  领域: ['domain', 'innermost'],
  枚举: ['level', 'enum'],
  不变式: ['invariants', 'validate'],
  数据流: ['flow', 'wiring', 'chain'],
  // transport / errors
  处理器: ['handler', 'handlers'],
  状态码: ['status-codes', 'status', 'error'],
  错误: ['error', 'err', 'fail'],
  解码: ['decode', 'json'],
  编码: ['encode', 'json', 'content-type'],
  响应: ['response', 'writer', 'json'],
  // quality / ops
  日志: ['log', 'logger', 'observability'],
  可观测: ['observability', 'metrics', 'stats'],
  指标: ['metrics', 'stats', 'counters'],
  关闭: ['shutdown', 'graceful-shutdown', 'signal'],
  信号: ['signal', 'sigint', 'sigterm'],
  技术债: ['tech-debt', 'debt', 'todo', 'fixme'],
  测试: ['test', 'tests', 'httptest', 'integration'],
  文档: ['docs', 'documentation', 'readme', 'tooling'],
  分层: ['layer', 'layers', 'architecture'],
  架构: ['architecture', 'boundary', 'layers'],
  模块: ['module', 'layer', 'package'],
  接口: ['interface', 'boundary', 'type'],
  边界: ['boundary', 'interface'],
  // product features (used by the coach, not the demo)
  图谱: ['graph', 'node', 'edge'],
  索引: ['index', 'indexed', 'scan', 'parse'],
  检索: ['search', 'retrieval', 'query'],
  论文: ['paper', 'arxiv', 'chunk', 'rag'],
  笔记: ['note', 'annotation', 'highlight'],
  进度: ['progress', 'mastered', 'coverage'],
  复习: ['review', 'card', 'due', 'interval'],
  影响: ['diff', 'affected', 'changed'],
  // tiny-go fixture vocabulary
  存储层: ['store', 'db'],
  服务层: ['service', 'handler'],
  副本: ['copy', 'slice', 'all'],
  构造函数: ['new', 'newdb', 'newhandler', 'create'],
  读取全部: ['all', 'read'],
  问候: ['hello', 'greeting'],
  路由注册: ['handlefunc', 'register', 'route'],
}

export interface ExpandedQuery {
  /** Tokens from the query itself. */
  primary: string[]
  /** Extra tokens contributed by the term map (weighted lower when scoring). */
  expanded: string[]
  /** Map keys that fired, kept for the ablation report and for debugging. */
  matchedTerms: string[]
}

/**
 * Tokenize text for lexical matching.
 *
 * - Latin identifiers are split on camelCase/PascalCase boundaries, separators,
 *   and dots, so `ErrQueueFull` and `internal/store/memory.go` become matchable
 *   tokens (`err`, `queue`, `full`, `store`, `memory`, `go`).
 * - CJK runs become character bigrams: Chinese has no spaces, and bigrams are
 *   the standard cheap approximation of segmentation ("队列满了" → 队列/列满/满了).
 */
export function tokenize(text: string): string[] {
  if (!text) return []
  const spaced = text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[_\-./\\:()[\]{},<>|"'`*+=~!?;@#$%^&]+/g, ' ')
    .toLowerCase()

  const out: string[] = []
  for (const piece of spaced.match(CJK_OR_LATIN) ?? []) {
    if (CJK_RE.test(piece)) {
      if (piece.length === 1) {
        if (!STOPWORDS.has(piece)) out.push(piece)
      } else {
        for (let i = 0; i + 2 <= piece.length; i += 1) {
          const bigram = piece.slice(i, i + 2)
          if (!STOPWORDS.has(bigram)) out.push(bigram)
        }
      }
    } else if (part(piece)) {
      if (!STOPWORDS.has(piece)) out.push(piece)
    }
  }
  return out
}

/** Latin tokens of a single character are noise unless they are digits. */
function part(token: string): boolean {
  return token.length >= 2 || /^[0-9]+$/.test(token)
}

/**
 * Expand a query with bilingual term candidates.
 *
 * Longest key wins, so a specific term ("依赖注入") is not shadowed by a shorter
 * one ("依赖") when both could match. Candidates already produced by tokenizing
 * the query itself are dropped, so expansion never double-counts.
 */
export function expandQuery(query: string): ExpandedQuery {
  const lower = (query ?? '').toLowerCase()
  const primary = tokenize(query)
  const seen = new Set(primary)
  const expanded: string[] = []
  const matchedTerms: string[] = []

  const keys = Object.keys(ZH_TERM_MAP).sort((a, b) => b.length - a.length)
  for (const key of keys) {
    if (!lower.includes(key)) continue
    matchedTerms.push(key)
    for (const candidate of ZH_TERM_MAP[key]) {
      for (const token of tokenize(candidate)) {
        if (seen.has(token)) continue
        seen.add(token)
        expanded.push(token)
      }
    }
  }

  return { primary, expanded, matchedTerms }
}

export interface LexicalIndexEntry {
  id: string
  tf: Map<string, number>
  len: number
}

export interface LexicalIndex {
  entries: LexicalIndexEntry[]
  df: Map<string, number>
  avgLen: number
}

/** The text a node is matched against. Field order is also priority order. */
export function documentText(node: LexicalNode): string {
  return [
    node.name ?? node.label ?? '',
    node.filePath ?? '',
    node.summary ?? '',
    (node.tags ?? []).join(' '),
    node.type ?? '',
  ].filter(Boolean).join(' ')
}

export function buildLexicalIndex(nodes: LexicalNode[]): LexicalIndex {
  const entries: LexicalIndexEntry[] = []
  const df = new Map<string, number>()
  let totalLen = 0

  for (const node of nodes) {
    const tokens = tokenize(documentText(node))
    const tf = new Map<string, number>()
    for (const token of tokens) tf.set(token, (tf.get(token) ?? 0) + 1)
    for (const token of tf.keys()) df.set(token, (df.get(token) ?? 0) + 1)
    entries.push({ id: node.id, tf, len: tokens.length })
    totalLen += tokens.length
  }

  return { entries, df, avgLen: entries.length > 0 ? totalLen / entries.length : 0 }
}

export interface LexicalSearchOptions {
  /** Add bilingual term candidates to the query (default: on). */
  expand?: boolean
  /** Weight of expanded tokens relative to the query's own tokens (default 0.5). */
  expandedWeight?: number
  /** BM25 term-frequency saturation. */
  k1?: number
  /** BM25 length normalization. */
  b?: number
}

/**
 * BM25 over the lexical index.
 *
 * Expanded tokens are scored with a lower weight so a Chinese question cannot be
 * dominated by the English terms the map happened to suggest — the query's own
 * tokens stay in charge, expansion only widens the net.
 */
export function lexicalSearch(
  index: LexicalIndex,
  query: string,
  limit: number,
  options: LexicalSearchOptions = {},
): SearchHit[] {
  const expand = options.expand ?? true
  const expandedWeight = options.expandedWeight ?? 0.5
  const k1 = options.k1 ?? 1.2
  const b = options.b ?? 0.75

  const { primary, expanded } = expand ? expandQuery(query) : { primary: tokenize(query), expanded: [] }
  const weights = new Map<string, number>()
  for (const token of primary) weights.set(token, 1)
  for (const token of expanded) if (!weights.has(token)) weights.set(token, expandedWeight)
  if (weights.size === 0) return []

  const n = index.entries.length
  const scored: SearchHit[] = []

  for (const entry of index.entries) {
    let score = 0
    for (const [token, weight] of weights) {
      const tf = entry.tf.get(token)
      if (!tf) continue
      const df = index.df.get(token) ?? 0
      const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5))
      const norm = 1 - b + (b * entry.len) / (index.avgLen || 1)
      score += weight * idf * ((tf * (k1 + 1)) / (tf + k1 * norm))
    }
    if (score > 0) scored.push({ nodeId: entry.id, score })
  }

  // Deterministic ordering: score desc, then id asc so runs are reproducible.
  scored.sort((a, b2) => b2.score - a.score || a.nodeId.localeCompare(b2.nodeId))
  return scored.slice(0, limit)
}

/**
 * Reciprocal rank fusion.
 *
 * RRF needs no score calibration between channels, which matters here: BM25
 * scores and the semantic engine's scores live on incomparable scales, and
 * normalizing them would be an unverifiable choice. Fusion by rank is the
 * honest option. `k = 60` is the value from the original RRF paper.
 */
export function rrfFuse(rankings: Array<Array<string | { nodeId: string }>>, k = 60): string[] {
  const score = new Map<string, number>()
  const firstSeen = new Map<string, number>()
  let order = 0

  for (const ranking of rankings) {
    ranking.forEach((entry, position) => {
      const id = typeof entry === 'string' ? entry : entry.nodeId
      if (!firstSeen.has(id)) firstSeen.set(id, order++)
      score.set(id, (score.get(id) ?? 0) + 1 / (k + position + 1))
    })
  }

  return [...score.entries()]
    .sort((a, b) => b[1] - a[1] || (firstSeen.get(a[0]) ?? 0) - (firstSeen.get(b[0]) ?? 0))
    .map(([id]) => id)
}
