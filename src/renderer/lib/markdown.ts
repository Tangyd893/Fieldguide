/**
 * Minimal Markdown renderer for assistant answers.
 *
 * Deliberately hand-rolled instead of pulling in `marked`/`react-markdown`:
 *  - answers are LLM output rendered inside an Electron shell, so the renderer
 *    must never inject raw HTML (this builds React elements only — no
 *    `dangerouslySetInnerHTML`, so a hostile answer cannot execute anything);
 *  - the supported subset is exactly what the coach prompt produces: fenced code
 *    blocks, inline code, bold/italic, headings, lists, quotes and links.
 *  - it keeps the app dependency-free and the parse function trivially testable.
 *
 * Anything unsupported degrades to plain text rather than disappearing.
 */
import type { ReactNode } from 'react'
import { createElement, Fragment } from 'react'

export interface MarkdownBlock {
  type: 'code' | 'heading' | 'list' | 'quote' | 'paragraph'
  /** Raw text for the block (code keeps its own language tag). */
  text: string
  language?: string
  ordered?: boolean
  items?: string[]
  level?: number
}

/** Fenced code blocks first, then line-based block structure. */
export function parseMarkdown(source: string): MarkdownBlock[] {
  const lines = String(source ?? '').replace(/\r\n/g, '\n').split('\n')
  const blocks: MarkdownBlock[] = []
  let paragraph: string[] = []
  let listItems: string[] = []
  let listOrdered = false
  let quoteLines: string[] = []

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: 'paragraph', text: paragraph.join('\n').trim() })
      paragraph = []
    }
  }
  const flushList = () => {
    if (listItems.length) {
      blocks.push({ type: 'list', text: '', items: listItems, ordered: listOrdered })
      listItems = []
    }
  }
  const flushQuote = () => {
    if (quoteLines.length) {
      blocks.push({ type: 'quote', text: quoteLines.join('\n').trim() })
      quoteLines = []
    }
  }
  const flushAll = () => {
    flushParagraph()
    flushList()
    flushQuote()
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Fenced code block
    const fence = line.match(/^\s*```(\S*)\s*$/)
    if (fence) {
      flushAll()
      const language = fence[1] || undefined
      const body: string[] = []
      i++
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
        body.push(lines[i])
        i++
      }
      blocks.push({ type: 'code', text: body.join('\n'), language })
      continue
    }

    // Heading
    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      flushAll()
      blocks.push({ type: 'heading', text: heading[2].trim(), level: heading[1].length })
      continue
    }

    // Blockquote
    const quote = line.match(/^\s*>\s?(.*)$/)
    if (quote) {
      flushParagraph()
      flushList()
      quoteLines.push(quote[1])
      continue
    }

    // List item (-, *, + or 1.)
    const bullet = line.match(/^\s*([-*+]|\d+[.)])\s+(.*)$/)
    if (bullet) {
      flushParagraph()
      flushQuote()
      const ordered = /^\d/.test(bullet[1])
      if (listItems.length && ordered !== listOrdered) flushList()
      listOrdered = ordered
      listItems.push(bullet[2])
      continue
    }

    // Blank line ends the current block
    if (!line.trim()) {
      flushAll()
      continue
    }

    flushList()
    flushQuote()
    paragraph.push(line)
  }

  flushAll()
  return blocks
}

/** Inline spans: `code`, **bold**, *italic*, [text](url). */
export function parseInline(text: string, keyPrefix = 'i'): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\n]+\*)|(\[[^\]]+\]\((?:https?:|\/)[^)\s]+\))/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let n = 0

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }
    const token = match[0]
    const key = `${keyPrefix}-${n++}`

    if (token.startsWith('`')) {
      nodes.push(
        createElement(
          'code',
          {
            key,
            className: 'px-1 py-0.5 rounded bg-[var(--fg-tree-hover)] font-mono text-[0.9em]',
          },
          token.slice(1, -1),
        ),
      )
    } else if (token.startsWith('**')) {
      nodes.push(createElement('strong', { key, className: 'font-semibold' }, token.slice(2, -2)))
    } else if (token.startsWith('*')) {
      nodes.push(createElement('em', { key }, token.slice(1, -1)))
    } else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      if (link) {
        nodes.push(
          createElement(
            'a',
            {
              key,
              href: link[2],
              target: '_blank',
              rel: 'noopener noreferrer',
              className: 'text-[var(--fg-accent-text)] underline',
            },
            link[1],
          ),
        )
      } else {
        nodes.push(token)
      }
    }
    lastIndex = pattern.lastIndex
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

/**
 * Render Markdown text as React nodes.
 * `onCopyCode` is optional; when provided, fenced blocks get a copy affordance.
 */
export function renderMarkdown(source: string): ReactNode {
  const blocks = parseMarkdown(source)
  return createElement(
    Fragment,
    null,
    ...blocks.map((block, index) => {
      const key = `b-${index}`
      switch (block.type) {
        case 'code':
          return createElement(
            'pre',
            {
              key,
              className:
                'my-1.5 p-2 rounded bg-[var(--fg-tree-hover)] overflow-x-auto text-[12px] leading-5 font-mono',
            },
            createElement('code', null, block.text),
          )
        case 'heading':
          return createElement(
            block.level === 1 ? 'h3' : 'h4',
            { key, className: 'font-semibold text-[var(--fg-text-primary)] mt-2 mb-1 first:mt-0' },
            ...parseInline(block.text, key),
          )
        case 'list':
          return createElement(
            block.ordered ? 'ol' : 'ul',
            {
              key,
              className: block.ordered
                ? 'list-decimal list-inside space-y-0.5 my-1'
                : 'list-disc list-inside space-y-0.5 my-1',
            },
            ...(block.items ?? []).map((item, i) =>
              createElement('li', { key: `${key}-${i}` }, ...parseInline(item, `${key}-${i}`)),
            ),
          )
        case 'quote':
          return createElement(
            'blockquote',
            {
              key,
              className:
                'border-l-2 border-[var(--fg-accent)] pl-2 my-1 text-[var(--fg-text-secondary)]',
            },
            ...parseInline(block.text, key),
          )
        default:
          return createElement(
            'p',
            { key, className: 'my-1 first:mt-0 last:mb-0 whitespace-pre-wrap' },
            ...parseInline(block.text, key),
          )
      }
    }),
  )
}
