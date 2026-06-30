/**
 * TourPanel — shows tour steps from knowledge-graph.json.
 * Phase 2: displays tour list, Phase 2+ can sync with Dashboard playback.
 */
import { useState, useEffect } from 'react'

interface TourStep {
  id?: string
  title?: string
  description?: string
  nodeIds?: string[]
}

interface Tour {
  id?: string
  name?: string
  description?: string
  steps?: TourStep[]
}

interface Props {
  projectId: string
  t: (key: string) => string
}

export default function TourPanel({ projectId, t }: Props) {
  const [tours, setTours] = useState<Tour[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  useEffect(() => {
    loadTours()
  }, [projectId])

  async function loadTours() {
    setLoading(true)
    try {
      const result = await window.fieldguide.graphGet(projectId)
      if (result.ok && result.data) {
        const graph = result.data as { tour?: Tour[] }
        setTours(graph.tour || [])
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-3 text-xs text-gray-400">{t('codeMap.loading')}</div>
    )
  }

  if (tours.length === 0) {
    return (
      <div className="p-3 text-xs text-gray-400">
        <p className="mb-1">📋 暂无导览</p>
        <p className="text-gray-300">索引项目并启用 LLM 分析后可生成 Tour</p>
      </div>
    )
  }

  return (
    <div className="overflow-auto">
      {tours.map((tour, i) => (
        <div key={tour.id ?? i} className="border-b border-[var(--fg-border)] last:border-0">
          <button
            onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
            className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs text-blue-500">
                {expandedIndex === i ? '▾' : '▸'}
              </span>
              <span className="text-sm font-medium text-[var(--fg-text-primary)]">
                {tour.name || `Tour ${i + 1}`}
              </span>
              <span className="text-xs text-gray-400">
                {(tour.steps || []).length} 步
              </span>
            </div>
            {tour.description && (
              <p className="text-xs text-gray-400 mt-0.5 ml-5">{tour.description}</p>
            )}
          </button>
          {expandedIndex === i && (
            <div className="pb-2">
              {(tour.steps || []).map((step, si) => (
                <div key={step.id ?? si} className="flex items-start gap-2 px-3 py-1.5 ml-5 hover:bg-blue-50/50 cursor-pointer transition-colors">
                  <span className="w-5 h-5 flex items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-medium flex-shrink-0 mt-0.5">
                    {si + 1}
                  </span>
                  <div>
                    <p className="text-xs font-medium text-[var(--fg-text-primary)]">
                      {step.title || `Step ${si + 1}`}
                    </p>
                    {step.description && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{step.description}</p>
                    )}
                    {step.nodeIds && step.nodeIds.length > 0 && (
                      <p className="text-xs text-gray-300 mt-0.5">
                        {(step.nodeIds as string[]).length} 个节点
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
