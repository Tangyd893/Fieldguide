/**
 * Markdown rendering for assistant answers.
 *
 * The renderer must never inject raw HTML (LLM output inside Electron), so these
 * tests cover both the block/inline parsing and the fact that hostile input is
 * escaped rather than executed.
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { parseMarkdown, renderMarkdown } from '../markdown'

describe('parseMarkdown', () => {
  it('parses a fenced code block with its language', () => {
    const blocks = parseMarkdown('text before\n```go\nfunc main() {}\n```\nafter')
    expect(blocks.map((b) => b.type)).toEqual(['paragraph', 'code', 'paragraph'])
    expect(blocks[1].language).toBe('go')
    expect(blocks[1].text).toBe('func main() {}')
  })

  it('keeps blank lines inside a code block', () => {
    const blocks = parseMarkdown('```\nline 1\n\nline 3\n```')
    expect(blocks).toHaveLength(1)
    expect(blocks[0].text).toBe('line 1\n\nline 3')
  })

  it('parses headings by level', () => {
    const blocks = parseMarkdown('# Title\n\n### Details')
    expect(blocks[0]).toMatchObject({ type: 'heading', text: 'Title', level: 1 })
    expect(blocks[1]).toMatchObject({ type: 'heading', text: 'Details', level: 3 })
  })

  it('parses unordered and ordered lists', () => {
    const unordered = parseMarkdown('- first\n- second')
    expect(unordered).toHaveLength(1)
    expect(unordered[0]).toMatchObject({ type: 'list', ordered: false, items: ['first', 'second'] })

    const ordered = parseMarkdown('1. one\n2. two')
    expect(ordered[0]).toMatchObject({ type: 'list', ordered: true, items: ['one', 'two'] })
  })

  it('starts a new list when the marker style changes', () => {
    const blocks = parseMarkdown('- bullet\n1. numbered')
    expect(blocks).toHaveLength(2)
    expect(blocks[0].ordered).toBe(false)
    expect(blocks[1].ordered).toBe(true)
  })

  it('parses blockquotes and merges consecutive quote lines', () => {
    const blocks = parseMarkdown('> first line\n> second line')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({ type: 'quote', text: 'first line\nsecond line' })
  })

  it('treats empty input as no blocks', () => {
    expect(parseMarkdown('')).toEqual([])
    expect(parseMarkdown('\n\n')).toEqual([])
  })

  it('handles an unterminated code fence without dropping content', () => {
    const blocks = parseMarkdown('```ts\nconst a = 1')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({ type: 'code', language: 'ts', text: 'const a = 1' })
  })
})

describe('renderMarkdown', () => {
  const html = (md: string) => renderToStaticMarkup(renderMarkdown(md))

  it('renders fenced code as pre/code', () => {
    const out = html('```go\nfunc main() {}\n```')
    expect(out).toContain('<pre')
    expect(out).toContain('<code>func main() {}</code>')
  })

  it('renders inline code, bold and links', () => {
    const out = html('use `mergeIncrementalGraph` and **never** re-parse, see [docs](https://example.com/x)')
    expect(out).toContain('<code')
    expect(out).toContain('mergeIncrementalGraph')
    expect(out).toContain('<strong')
    expect(out).toContain('never')
    expect(out).toContain('href="https://example.com/x"')
    expect(out).toContain('rel="noopener noreferrer"')
  })

  it('renders lists and headings as real elements', () => {
    const out = html('## Steps\n\n1. build\n2. ship')
    expect(out).toContain('<h4')
    expect(out).toContain('<ol')
    expect(out).toContain('<li>build</li>')
  })

  it('escapes hostile HTML instead of injecting it', () => {
    const out = html('<script>alert(1)</script> and <img src=x onerror=alert(1)>')
    // No element is created from the hostile markup — it stays escaped text.
    expect(out).not.toContain('<script')
    expect(out).not.toContain('<img')
    expect(out).not.toMatch(/<[a-z]+[^>]*onerror/i)
    expect(out).toContain('&lt;script&gt;')
    expect(out).toContain('&lt;img')
  })

  it('escapes HTML that appears inside a code block', () => {
    const out = html('```html\n<script>alert(1)</script>\n```')
    expect(out).not.toContain('<script')
    expect(out).toContain('&lt;script&gt;')
  })

  it('keeps node-id references in the answer text so the shell can link them', () => {
    const out = html('The handler lives in [node:fn:handleRequest].')
    expect(out).toContain('[node:fn:handleRequest]')
  })
})
