import { describe, it, expect } from 'vitest'
import { chunkText } from '../chunk'
import { cosineSimilarity } from '../embed'

describe('chunkText', () => {
  it('returns empty array for empty input', () => {
    expect(chunkText('')).toEqual([])
    expect(chunkText('   \n\n  ')).toEqual([])
  })

  it('creates a single chunk for short text', () => {
    const chunks = chunkText('Hello world. This is a short text.')
    expect(chunks).toHaveLength(1)
    expect(chunks[0].text).toBe('Hello world. This is a short text.')
    expect(chunks[0].index).toBe(0)
    expect(chunks[0].tokenCount).toBeGreaterThan(0)
  })

  it('splits long text into multiple chunks', () => {
    // Generate ~6000 chars (should produce ~3 chunks of ~2048 each)
    const paragraph = 'This is a test paragraph with enough content to fill space. '
    const text = paragraph.repeat(100) // ~5800 chars

    const chunks = chunkText(text)
    expect(chunks.length).toBeGreaterThanOrEqual(2)
    expect(chunks.length).toBeLessThanOrEqual(5)

    // Each chunk should be roughly within target size
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(2500) // some slack
      expect(chunk.tokenCount).toBeGreaterThan(0)
    }
  })

  it('respects paragraph boundaries', () => {
    // Two paragraphs separated by double newline
    const text = [
      'First paragraph with some content here.',
      '',
      'Second paragraph with different content.',
    ].join('\n\n')

    const chunks = chunkText(text)
    expect(chunks).toHaveLength(1)
    expect(chunks[0].text).toContain('First paragraph')
    expect(chunks[0].text).toContain('Second paragraph')
  })

  it('handles single very long paragraph', () => {
    // A single paragraph larger than TARGET_CHARS (~2048)
    const word = 'superlongword'
    const text = (word + ' ').repeat(500) // ~7000 chars, no paragraph breaks

    const chunks = chunkText(text)
    expect(chunks.length).toBeGreaterThanOrEqual(3)

    // Each chunk should not exceed target significantly
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(2500)
    }
  })

  it('preserves sequential chunk indices', () => {
    const paragraph = 'Content filler text for testing chunking behavior. '
    const text = paragraph.repeat(150)

    const chunks = chunkText(text)
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].index).toBe(i)
    }
  })

  it('handles text with only newlines and spaces', () => {
    const chunks = chunkText('   \n\n\n   \n   ')
    expect(chunks).toEqual([])
  })

  it('normalizes whitespace', () => {
    const chunks = chunkText('Hello   world.\tTab here.\r\nWindows newline.')
    expect(chunks).toHaveLength(1)
    // No tabs, no \r\n, no double spaces
    expect(chunks[0].text).not.toContain('\t')
    expect(chunks[0].text).not.toContain('\r')
    expect(chunks[0].text).not.toContain('  ')
  })
})

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const v = [1, 2, 3, 4, 5]
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5)
  })

  it('returns 0 for orthogonal vectors', () => {
    const a = [1, 0, 0]
    const b = [0, 1, 0]
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5)
  })

  it('returns -1 for opposite vectors', () => {
    const a = [1, 2, 3]
    const b = [-1, -2, -3]
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 5)
  })

  it('handles zero vectors gracefully', () => {
    const a = [0, 0, 0]
    const b = [1, 2, 3]
    expect(cosineSimilarity(a, b)).toBe(0)
  })

  it('throws on dimension mismatch', () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow('dimension mismatch')
  })

  it('returns positive for somewhat similar vectors', () => {
    const a = [1, 2, 3, 4]
    const b = [1.1, 2.1, 3.1, 4.1]
    const sim = cosineSimilarity(a, b)
    expect(sim).toBeGreaterThan(0.99)
    expect(sim).toBeLessThan(1)
  })

  it('handles high-dimensional vectors', () => {
    const dim = 1536 // OpenAI embedding dimension
    const a = Array.from({ length: dim }, () => Math.random())
    const b = Array.from({ length: dim }, () => Math.random())
    const sim = cosineSimilarity(a, b)
    expect(sim).toBeGreaterThanOrEqual(-1)
    expect(sim).toBeLessThanOrEqual(1)
  })
})
