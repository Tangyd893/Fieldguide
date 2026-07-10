/**
 * useIndexProgress — shared hook for indexing progress.
 * Subscribes to main → renderer 'index:progress' IPC events.
 * 
 * Usage:
 *   const progress = useIndexProgress(projectId) // optional filter by project
 */
import { useState, useEffect, useCallback } from 'react'

export interface IndexProgress {
  type: 'phase' | 'progress' | 'complete' | 'error'
  phase?: string // scan | parse | build | save | llm
  current?: number
  total?: number
  nodeCount?: number
  error?: string
  projectId?: string
}

export function useIndexProgress(projectId?: string) {
  const [progress, setProgress] = useState<IndexProgress | null>(null)
  const [isIndexing, setIsIndexing] = useState(false)

  useEffect(() => {
    const unsub = window.fieldguide.onIndexProgress?.((data: unknown) => {
      const ev = data as IndexProgress
      // Filter by projectId if specified
      if (projectId && ev.projectId && ev.projectId !== projectId) return

      setProgress(ev)
      if (ev.type === 'phase' || ev.type === 'progress') {
        setIsIndexing(true)
      } else if (ev.type === 'complete' || ev.type === 'error') {
        setIsIndexing(false)
      }
    })
    return () => unsub?.()
  }, [projectId])

  const phaseLabel = useCallback((phase: string, t: (k: string) => string) => {
    const key = `index.phase.${phase}`
    return t(key) || phase
  }, [])

  return { progress, isIndexing, phaseLabel }
}

/** Percentage 0–100 derived from progress, or -1 if indeterminate */
export function progressPercent(p: IndexProgress | null): number {
  if (!p) return -1
  if (p.type === 'complete') return 100
  if (p.type === 'progress' && p.current !== undefined && p.total && p.total > 0) {
    const base = p.phase === 'parse' ? 20 : p.phase === 'build' ? 40 : p.phase === 'save' ? 70 : 0
    return Math.min(99, base + Math.round((p.current / p.total) * (100 - base) * 0.5))
  }
  // Phase-only progress: estimate
  if (p.phase === 'scan') return 5
  if (p.phase === 'parse') return 20
  if (p.phase === 'build') return 50
  if (p.phase === 'save') return 90
  return -1
}
