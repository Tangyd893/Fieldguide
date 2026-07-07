/**
 * Embedding generation — OpenAI-compatible /embeddings endpoint.
 *
 * Architecture.md §九: embeddings share the same baseUrl + apiKey as config.llm.
 * Uses the `embedModel` field from LLMConfig (e.g., "text-embedding-3-small").
 */
import { loadConfig } from '../config'

export interface EmbedResult {
  /** The embedding vector (float32 array) */
  embedding: number[]
  /** Model used */
  model: string
  /** Token count for billing */
  tokensUsed: number
}

/**
 * Generate an embedding for a single text.
 * Calls POST {baseUrl}/v1/embeddings (OpenAI-compatible).
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const config = loadConfig()

  if (!config.llm.apiKey) {
    throw new Error('LLM API key not configured')
  }

  const embedModel = config.llm.embedModel || 'text-embedding-3-small'
  const baseUrl = config.llm.baseUrl.replace(/\/+$/, '')
  const url = `${baseUrl}/v1/embeddings`

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.llm.apiKey}`,
    },
    body: JSON.stringify({
      model: embedModel,
      input: text,
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!resp.ok) {
    const body = await resp.text().catch(() => '')
    throw new Error(`Embedding API error (${resp.status}): ${body.slice(0, 300)}`)
  }

  const data = (await resp.json()) as {
    data?: Array<{ embedding: number[] }>
    usage?: { total_tokens: number }
    model?: string
  }

  const embedding = data.data?.[0]?.embedding
  if (!embedding || embedding.length === 0) {
    throw new Error('Embedding API returned empty embedding')
  }

  return embedding
}

/**
 * Generate embeddings for multiple texts in batch.
 * Many providers support batched inputs; we send up to 20 at a time.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const BATCH_SIZE = 20
  const results: number[][] = []

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)

    const config = loadConfig()
    const embedModel = config.llm.embedModel || 'text-embedding-3-small'
    const baseUrl = config.llm.baseUrl.replace(/\/+$/, '')
    const url = `${baseUrl}/v1/embeddings`

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.llm.apiKey}`,
      },
      body: JSON.stringify({
        model: embedModel,
        input: batch,
      }),
      signal: AbortSignal.timeout(60_000),
    })

    if (!resp.ok) {
      const body = await resp.text().catch(() => '')
      throw new Error(`Embedding API error (${resp.status}): ${body.slice(0, 300)}`)
    }

    const data = (await resp.json()) as {
      data?: Array<{ embedding: number[]; index: number }>
    }

    const batchResults = (data.data || []).sort((a, b) => a.index - b.index)
    for (const r of batchResults) {
      results.push(r.embedding)
    }
  }

  return results
}

/**
 * Compute cosine similarity between two embedding vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`)
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  if (normA === 0 || normB === 0) return 0
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}
