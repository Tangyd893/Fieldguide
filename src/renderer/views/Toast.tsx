/**
 * Toast — lightweight notification system.
 * Auto-dismiss after 3 seconds.
 */
import { useState, useEffect, useCallback } from 'react'

export interface ToastItem {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
}

let toastId = 0
let globalAddToast: ((item: Omit<ToastItem, 'id'>) => void) | null = null

export function showToast(type: ToastItem['type'], message: string) {
  globalAddToast?.({ type, message })
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const addToast = useCallback((item: Omit<ToastItem, 'id'>) => {
    const id = String(++toastId)
    setToasts((prev) => [...prev, { ...item, id }])
  }, [])

  useEffect(() => {
    globalAddToast = addToast
    return () => { globalAddToast = null }
  }, [addToast])

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  return { toasts, removeToast }
}

const typeStyles: Record<string, string> = {
  success: 'bg-[var(--fg-status-success)] text-white',
  error: 'bg-[var(--fg-status-error)] text-white',
  info: 'bg-[var(--fg-accent)] text-white',
  warning: 'bg-[var(--fg-status-warning)] text-white',
}

interface ToastContainerProps {
  toasts: ToastItem[]
  onRemove: (id: string) => void
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <Toast key={toast.id} item={toast} onRemove={onRemove} />
      ))}
    </div>
  )
}

function Toast({ item, onRemove }: { item: ToastItem; onRemove: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(item.id), 3000)
    return () => clearTimeout(timer)
  }, [item.id, onRemove])

  return (
    <div
      className={`${typeStyles[item.type]} px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium pointer-events-auto flex items-center gap-2 min-w-[200px] max-w-[400px] animate-slide-up`}
    >
      <span className="flex-1">{item.message}</span>
      <button onClick={() => onRemove(item.id)} className="opacity-70 hover:opacity-100 text-lg leading-none">×</button>
    </div>
  )
}
