/**
 * CostDialog — LLM 分析成本确认 (ui-spec §3.6, roadmap 2.8)
 */
import { useState, useEffect } from 'react'

interface Props {
  t: (key: string) => string
  projectId: string
  projectName: string
  onCancel: () => void
  onContinue: () => void
  onSkipLLM: () => void
}

export default function CostDialog({ projectId, projectName, onCancel, onContinue, onSkipLLM }: Props) {
  const [fileCount, setFileCount] = useState<number | null>(null)
  const [nodeCount, setNodeCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [projectId])

  async function loadStats() {
    try {
      // Try to get existing graph stats first
      const graphResult = await window.fieldguide.graphGet(projectId)
      if (graphResult.ok && graphResult.data) {
        const g = graphResult.data as Record<string, unknown>
        const nodes = g.nodes as Array<unknown> | undefined
        const meta = g.project as Record<string, unknown> | undefined
        setNodeCount(nodes?.length ?? null)
        setFileCount((meta?.fileCount as number) ?? null)
        setLoading(false)
        return
      }
    } catch { /* ignore */ }

    // Fallback: count files from file tree
    try {
      const treeResult = await window.fieldguide.fileTree(projectId)
      if (treeResult.ok && treeResult.data) {
        const countFiles = (entries: unknown[]): number => {
          let n = 0
          for (const e of entries) {
            const entry = e as Record<string, unknown>
            if (entry.isDirectory && Array.isArray(entry.children)) n += countFiles(entry.children as unknown[])
            else if (!entry.isDirectory) n++
          }
          return n
        }
        setFileCount(countFiles(treeResult.data as unknown[]))
      }
    } catch { /* ignore */ }
    setLoading(false)
  }

  // Rough token estimate: ~200 tokens per file for structural analysis, ~500 for LLM summaries
  const estStructureTokens = fileCount ? fileCount * 200 : null
  const estLLMTokens = fileCount ? fileCount * 500 : null
  // DeepSeek pricing: ~¥1/1M tokens input, ~¥2/1M tokens output (rough)
  const estCost = estLLMTokens ? (estLLMTokens / 1_000_000 * 3).toFixed(2) : null

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onCancel} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[460px] bg-white rounded-xl shadow-2xl z-50 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">索引「{projectName}」</h3>
        <p className="text-sm text-gray-500 mb-4">选择索引模式</p>

        {loading ? (
          <div className="text-center py-4 text-gray-400 text-sm">加载项目统计…</div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {fileCount !== null && (
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-800">{fileCount}</p>
                  <p className="text-xs text-gray-500">源文件</p>
                </div>
              )}
              {nodeCount !== null && (
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-800">{nodeCount}</p>
                  <p className="text-xs text-gray-500">结构节点（已有）</p>
                </div>
              )}
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-yellow-800">
                LLM 分析将为代码节点生成摘要、架构分层和引导 Tour。
              </p>
              {estCost && (
                <p className="text-xs text-yellow-600 mt-2">
                  ⚡ 预估消耗 ~{estLLMTokens?.toLocaleString()} tokens（约 ¥{estCost}）
                </p>
              )}
            </div>
          </>
        )}

        <div className="space-y-3 mb-6">
          <button
            onClick={onContinue}
            className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            🤖 完整索引（含 LLM 分析）
          </button>
          <button
            onClick={onSkipLLM}
            className="w-full px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            📊 仅静态索引（跳过摘要与 Tour）
            {estStructureTokens && <span className="text-gray-400 ml-1">~{estStructureTokens.toLocaleString()} tokens</span>}
          </button>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
          >
            取消
          </button>
        </div>
      </div>
    </>
  )
}
