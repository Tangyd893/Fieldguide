/**
 * BridgeView — 顶栏「桥接」Tab (Phase 3)
 *
 * Shows concept links between papers and code nodes.
 * Requires a project with indexed graph and at least one saved paper.
 */
import { useState, useEffect } from 'react'
import ConceptBridge from '../Theory/ConceptBridge'

interface Props {
  t: (key: string) => string
  projectId?: string
}

interface PaperRow {
  id: string; arxiv_id: string; title: string; authors: string
  summary: string; published: string; pdf_path: string
  notes: string; tags: string; created_at: string
}

interface LinkRow {
  id: string; paper_id: string; project_id: string
  node_id: string; anchor_text: string; note: string; created_at: string
}

export default function BridgeView({ t, projectId }: Props) {
  const [papers, setPapers] = useState<PaperRow[]>([])
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null)
  const [allLinks, setAllLinks] = useState<LinkRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPapers()
  }, [])

  useEffect(() => {
    if (projectId) loadAllLinks()
  }, [projectId])

  async function loadPapers() {
    try {
      const r = await window.fieldguide.paperList()
      if (r.ok && r.data) setPapers(r.data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  async function loadAllLinks() {
    try {
      const r = await window.fieldguide.conceptList(projectId)
      if (r.ok && r.data) setAllLinks(r.data)
    } catch { /* ignore */ }
  }

  // Build a map of paper_id → link count for the sidebar
  const paperLinkCounts = new Map<string, number>()
  for (const link of allLinks) {
    paperLinkCounts.set(link.paper_id, (paperLinkCounts.get(link.paper_id) || 0) + 1)
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        {t('codeMap.loading')}
      </div>
    )
  }

  if (!projectId) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="border-2 border-dashed border-gray-200 rounded-lg p-12 text-center text-gray-300">
          <p className="text-lg mb-2">📎 概念桥接</p>
          <p className="text-sm">请先在项目库中选择一个项目，以浏览和创建论文与代码的桥接关联。</p>
        </div>
      </div>
    )
  }

  if (papers.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="border-2 border-dashed border-gray-200 rounded-lg p-12 text-center text-gray-300">
          <p className="text-lg mb-2">📄 暂无论文</p>
          <p className="text-sm">请先在「理论」Tab 中搜索并保存 arXiv 论文，然后回到此处建立桥接。</p>
        </div>
      </div>
    )
  }

  const selectedPaper = papers.find(p => p.id === selectedPaperId)

  return (
    <div className="h-full flex">
      {/* Left sidebar: paper list */}
      <div className="w-64 border-r border-[var(--fg-border)] bg-[var(--fg-card)] overflow-auto shrink-0">
        <div className="px-3 py-3 border-b border-[var(--fg-border)]">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">论文列表</h3>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {allLinks.length} 条关联 · {papers.length} 篇论文
          </p>
        </div>
        {papers.map((paper) => {
          const linkCount = paperLinkCounts.get(paper.id) || 0
          const isSelected = paper.id === selectedPaperId
          return (
            <button
              key={paper.id}
              onClick={() => setSelectedPaperId(paper.id)}
              className={`w-full text-left px-3 py-2.5 border-b border-[var(--fg-border)] transition-colors ${
                isSelected ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-gray-800 line-clamp-1 flex-1">
                  {paper.title}
                </span>
                {linkCount > 0 && (
                  <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full shrink-0">
                    {linkCount}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {paper.authors?.split(',').slice(0, 2).join(', ') || '未知作者'}
              </p>
              {paper.arxiv_id && (
                <p className="text-[10px] text-gray-300 font-mono mt-0.5">{paper.arxiv_id}</p>
              )}
            </button>
          )
        })}
      </div>

      {/* Main content: ConceptBridge or prompt */}
      <div className="flex-1 overflow-auto p-6">
        {selectedPaper ? (
          <ConceptBridge
            paperId={selectedPaper.id}
            projectId={projectId}
            t={t}
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-gray-400">
              <p className="text-5xl mb-4">🔗</p>
              <p className="text-lg mb-2">概念桥接</p>
              <p className="text-sm">从左侧选择一篇论文，查看和创建它与代码节点之间的关联。</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
