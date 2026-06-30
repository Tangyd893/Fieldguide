/**
 * ConceptBridge — 论文段落 ↔ 代码节点关联 (Phase 3.3)
 *
 * Used inside TheoryView paper detail when a project is selected.
 */
import { useState, useEffect } from 'react'

interface Props {
  paperId: string
  projectId: string
  t: (key: string) => string
}

interface LinkRow {
  id: string; paper_id: string; project_id: string
  node_id: string; anchor_text: string; note: string; created_at: string
}

interface GraphNode {
  id: string; label?: string; type?: string; filePath?: string
  metadata?: { summary?: string }
}

interface PaperRow {
  id: string; arxiv_id: string; title: string; authors: string
  summary: string; published: string; pdf_path: string
  notes: string; tags: string; created_at: string
}

export default function ConceptBridge({ paperId, projectId, t: _t }: Props) {
  const [links, setLinks] = useState<LinkRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [nodeQuery, setNodeQuery] = useState('')
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [anchorText, setAnchorText] = useState('')
  const [linkNote, setLinkNote] = useState('')
  const [adding, setAdding] = useState(false)
  const [explaining, setExplaining] = useState<string | null>(null)

  useEffect(() => { loadLinks() }, [paperId, projectId])

  async function loadLinks() {
    setLoading(true)
    try {
      const r = await window.fieldguide.conceptList(projectId, paperId)
      if (r.ok && r.data) setLinks(r.data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  async function loadNodes() {
    try {
      const r = await window.fieldguide.graphGet(projectId)
      if (r.ok && r.data) {
        const g = r.data as { nodes?: GraphNode[] }
        setNodes((g.nodes || []).filter(n => n.type === 'function' || n.type === 'class' || n.type === 'file'))
      }
    } catch { /* ignore */ }
  }

  async function addLink() {
    if (!selectedNode) return
    setAdding(true)
    try {
      await window.fieldguide.conceptAdd({
        paper_id: paperId,
        project_id: projectId,
        node_id: selectedNode.id,
        anchor_text: anchorText,
        note: linkNote,
      })
      await loadLinks()
      setShowAdd(false); setSelectedNode(null); setAnchorText(''); setLinkNote('')
    } catch { /* ignore */ }
    finally { setAdding(false) }
  }

  async function explainLink(link: LinkRow) {
    setExplaining(link.id)
    try {
      // Get paper info
      const paperR = await window.fieldguide.paperList()
      const paper = paperR.ok ? (paperR.data as PaperRow[] | undefined)?.find(p => p.id === paperId) : undefined

      const prompt = paper
        ? `请解释这篇论文和代码节点之间的关联：\n\n论文：${paper.title}\n摘要：${paper.summary.slice(0, 500)}\n关联段落：${link.anchor_text || '未指定'}\n\n代码节点：${link.node_id}\n备注：${link.note || '无'}\n\n请用中文简要说明论文中的概念如何在代码中实现，以及代码节点在整体架构中的角色。`
        : `请解释代码节点「${link.node_id}」与关联论文段落「${link.anchor_text}」之间的关系。`

      const r = await window.fieldguide.chatSend(projectId, [{ role: 'user', content: prompt }])
      if (r.ok && r.data) {
        const d = r.data as { content: string }
        setLinks(prev => prev.map(l => l.id === link.id ? { ...l, note: l.note + '\n\n---\n🤖 AI 解释:\n' + d.content } : l))
      }
    } catch { /* ignore */ }
    finally { setExplaining(null) }
  }

  async function removeLink(id: string) {
    await window.fieldguide.conceptRemove(id)
    await loadLinks()
  }

  const filteredNodes = nodeQuery
    ? nodes.filter(n => (n.label || n.id).toLowerCase().includes(nodeQuery.toLowerCase()))
    : nodes.slice(0, 50)

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">🔗 概念桥接</h3>
        <button onClick={() => { setShowAdd(!showAdd); if (!showAdd) loadNodes() }}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium">
          {showAdd ? '取消' : '+ 关联代码节点'}
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-gray-400">加载中…</p>
      ) : links.length === 0 && !showAdd ? (
        <p className="text-xs text-gray-400">尚未关联代码节点。点击上方按钮建立关联。</p>
      ) : (
        <div className="space-y-2">
          {links.map((link) => (
            <div key={link.id} className="flex items-start gap-2 p-2 bg-gray-50 rounded group">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono text-blue-700 truncate">{link.node_id}</p>
                {link.anchor_text && <p className="text-xs text-gray-500 mt-0.5">📖 {link.anchor_text}</p>}
                {link.note && <p className="text-xs text-gray-400 mt-0.5 whitespace-pre-wrap">{link.note}</p>}
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => explainLink(link)} disabled={explaining === link.id}
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-purple-500 text-xs px-1 transition-opacity disabled:opacity-50"
                  title="AI 解释关联">{explaining === link.id ? '…' : '🤖'}</button>
                <button onClick={() => removeLink(link.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 text-xs transition-opacity">×</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add link form */}
      {showAdd && (
        <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">搜索代码节点</label>
            <input type="text" value={nodeQuery} onChange={(e) => setNodeQuery(e.target.value)}
              placeholder="输入函数名或类名…"
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>

          {filteredNodes.length > 0 && (
            <div className="max-h-40 overflow-auto border border-gray-200 rounded">
              {filteredNodes.map((n) => (
                <button key={n.id}
                  onClick={() => setSelectedNode(n)}
                  className={`w-full text-left px-2 py-1.5 text-xs hover:bg-blue-50 transition-colors ${selectedNode?.id === n.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}>
                  <span className="font-mono">{n.label || n.id}</span>
                  <span className="text-gray-400 ml-2">{n.type}</span>
                  {n.filePath && <span className="text-gray-300 ml-2 truncate">— {n.filePath}</span>}
                </button>
              ))}
            </div>
          )}
          {nodeQuery && filteredNodes.length === 0 && (
            <p className="text-xs text-gray-400">未找到匹配节点</p>
          )}

          {selectedNode && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">关联的论文段落</label>
                <input type="text" value={anchorText} onChange={(e) => setAnchorText(e.target.value)}
                  placeholder="如: Section 3.2 介绍了 splitter 算法…"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">备注</label>
                <input type="text" value={linkNote} onChange={(e) => setLinkNote(e.target.value)}
                  placeholder="如: 该函数实现了论文中的 splitter"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
              </div>
              <button onClick={addLink} disabled={adding}
                className="w-full py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-40">
                {adding ? '关联中…' : `关联到「${selectedNode.label || selectedNode.id}」`}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
