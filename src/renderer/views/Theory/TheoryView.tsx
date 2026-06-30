/**
 * TheoryView — arXiv search + paper library placeholder.
 * Phase 3 will add PDF import + RAG, but the search works now.
 */
import { useState } from 'react'

interface ArxivEntry {
  id: string
  title: string
  summary: string
  authors: string[]
  published: string
  link: string
}

interface Props {
  t: (key: string) => string
}

export default function TheoryView({ t }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ArxivEntry[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function search() {
    if (!query.trim()) return
    setSearching(true)
    setError(null)
    try {
      // arXiv API: https://info.arxiv.org/help/api/user-manual.html
      const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=10&sortBy=relevance`
      const response = await fetch(url)
      const text = await response.text()
      const entries = parseArxivXML(text)
      setResults(entries)
      if (entries.length === 0) setError('未找到相关论文')
    } catch (err) {
      setError(String(err))
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-[var(--fg-bg)]">
      {/* Search bar */}
      <div className="flex gap-2 p-4 border-b border-[var(--fg-border)] bg-[var(--fg-card)]">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="搜索 arXiv 论文… (如: RAG, transformer, code generation)"
          className="flex-1 px-3 py-2 border border-[var(--fg-border)] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={search}
          disabled={searching}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          {searching ? '搜索中…' : '搜索'}
        </button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto p-4">
        {error && (
          <div className="text-center text-red-500 text-sm py-8">{error}</div>
        )}
        {!error && results.length === 0 && !searching && (
          <div className="text-center text-gray-400 py-16">
            <div className="text-4xl mb-4">📚</div>
            <p className="text-lg font-medium mb-2">{t('theory.title')}</p>
            <p className="text-sm">{t('theory.desc')}</p>
            <p className="text-xs text-gray-300 mt-3">输入关键词搜索 arXiv 论文</p>
          </div>
        )}
        {searching && (
          <div className="text-center text-gray-400 py-8 text-sm">搜索中…</div>
        )}
        <div className="space-y-3 max-w-2xl mx-auto">
          {results.map((entry) => (
            <div key={entry.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
              <a
                href={entry.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-blue-700 hover:text-blue-900 line-clamp-2"
              >
                {entry.title}
              </a>
              <p className="text-xs text-gray-500 mt-1.5">
                {entry.authors.slice(0, 3).join(', ')}
                {entry.authors.length > 3 && ` et al.`}
                {' · '}
                {entry.published.slice(0, 10)}
              </p>
              <p className="text-xs text-gray-400 mt-1.5 line-clamp-3">{entry.summary}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Simple arXiv Atom XML parser */
function parseArxivXML(xml: string): ArxivEntry[] {
  const entries: ArxivEntry[] = []
  // Match <entry>...</entry> blocks
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g
  let match
  while ((match = entryRegex.exec(xml)) !== null) {
    const block = match[1]
    const id = extractTag(block, 'id')?.split('/abs/').pop() || ''
    const title = stripHtml(extractTag(block, 'title') || '')
    const summary = stripHtml(extractTag(block, 'summary') || '')
    const authors: string[] = []
    const authorRegex = /<author>[\s\S]*?<name>([^<]+)<\/name>[\s\S]*?<\/author>/g
    let am
    while ((am = authorRegex.exec(block)) !== null) {
      authors.push(am[1].trim())
    }
    const published = extractTag(block, 'published') || ''
    const link = extractAttr(block, 'link', 'href') || `https://arxiv.org/abs/${id}`
    entries.push({ id: `arxiv:${id}`, title, summary, authors, published, link })
  }
  return entries
}

function extractTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const m = xml.match(re)
  return m ? m[1].trim() : null
}

function extractAttr(xml: string, tag: string, attr: string): string | null {
  const re = new RegExp(`<${tag}[^>]*${attr}=["']([^"']+)["'][^>]*\\/?>`, 'i')
  const m = xml.match(re)
  return m ? m[1] : null
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}
