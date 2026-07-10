/**
 * PDF text extraction & token-based chunking for paper RAG.
 *
 * Chunk strategy (per architecture.md §九):
 *   - ~512 tokens per chunk (≈ ~2048 chars for English)
 *   - 64 token overlap between adjacent chunks (≈ ~256 chars)
 *   - Chunk boundaries respect paragraph breaks when possible
 */
import { readFileSync } from 'node:fs'

export interface PaperChunk {
  /** 0-based chunk index within the paper */
  index: number
  /** The chunked text */
  text: string
  /** Estimated token count */
  tokenCount: number
  /** Byte range in the raw extracted text (for source attribution) */
  charStart: number
  charEnd: number
}

/** Rough token estimate: ~4 chars per token for English/technical text */
const CHARS_PER_TOKEN = 4
const TARGET_TOKENS = 512
const OVERLAP_TOKENS = 64
const TARGET_CHARS = TARGET_TOKENS * CHARS_PER_TOKEN // ~2048
const OVERLAP_CHARS = OVERLAP_TOKENS * CHARS_PER_TOKEN // ~256

/**
 * Extract raw text from a PDF file buffer.
 */
export async function extractPdfText(pdfPath: string): Promise<string> {
  const { PDFParse } = await import('pdf-parse')
  const buffer = readFileSync(pdfPath)
  const parser = new PDFParse({ data: buffer })
  try {
    const result = await parser.getText()
    return result.text
  } finally {
    await parser.destroy()
  }
}

/**
 * Split raw text into overlapping chunks targeting ~512 tokens each.
 * Tries to break at paragraph boundaries (double newlines).
 */
export function chunkText(text: string): PaperChunk[] {
  const chunks: PaperChunk[] = []

  // Normalize whitespace: collapse multiple spaces, keep paragraph breaks
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/ {2,}/g, ' ')
    // Collapse 3+ newlines to exactly 2 (paragraph break marker)
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (normalized.length === 0) return chunks

  const paragraphs = normalized.split('\n\n')

  let currentText = ''
  let currentStart = 0
  let idx = 0

  for (const para of paragraphs) {
    const trimmed = para.replace(/\n/g, ' ').trim()
    if (!trimmed) continue

    // If adding this paragraph keeps us under target, accumulate
    if (currentText.length + trimmed.length + 2 <= TARGET_CHARS) {
      if (currentText) currentText += '\n\n'
      currentText += trimmed
    } else {
      // Current chunk is full — emit it
      if (currentText.length > 0) {
        const tokenCount = Math.ceil(currentText.length / CHARS_PER_TOKEN)
        chunks.push({
          index: idx++,
          text: currentText,
          tokenCount,
          charStart: currentStart,
          charEnd: currentStart + currentText.length,
        })
      }

      // Handle paragraphs that are themselves larger than target
      if (trimmed.length > TARGET_CHARS) {
        // Split long paragraph into fixed-size chunks with overlap
        let pos = 0
        while (pos < trimmed.length) {
          const end = Math.min(pos + TARGET_CHARS, trimmed.length)
          const slice = trimmed.slice(pos, end)
          const tokenCount = Math.ceil(slice.length / CHARS_PER_TOKEN)
          chunks.push({
            index: idx++,
            text: slice,
            tokenCount,
            charStart: currentStart + pos,
            charEnd: currentStart + end,
          })
          if (end >= trimmed.length) break
          pos = end - OVERLAP_CHARS
        }
        currentText = ''
        currentStart += trimmed.length + 2
      } else {
        // Start new chunk with this paragraph
        currentText = trimmed
        currentStart += (currentText.length > 0 ? currentText.length + 2 : 0)
      }
    }
  }

  // Emit final chunk
  if (currentText.length > 0) {
    const tokenCount = Math.ceil(currentText.length / CHARS_PER_TOKEN)
    chunks.push({
      index: idx++,
      text: currentText,
      tokenCount,
      charStart: currentStart,
      charEnd: currentStart + currentText.length,
    })
  }

  return chunks
}
