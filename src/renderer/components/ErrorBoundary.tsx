/**
 * Global error boundary.
 *
 * Before this, any render error inside a panel unmounted the whole shell with a
 * blank window and no explanation (several panels also swallow errors in empty
 * `catch {}` blocks, which made failures invisible). The boundary keeps the app
 * usable: it reports what broke and offers a reload or a retry that remounts the
 * subtree.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCw } from 'lucide-react'

interface Props {
  children: ReactNode
  /** Optional label shown in the fallback, e.g. the panel name. */
  label?: string
  /** Rendered instead of the default fallback. */
  fallback?: (error: Error, reset: () => void) => ReactNode
  onError?: (error: Error, info: ErrorInfo) => void
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Keep the stack in the console for diagnostics; the logger lives in main.
    console.error('[ErrorBoundary]', this.props.label ?? '', error, info.componentStack)
    this.props.onError?.(error, info)
  }

  private reset = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children
    if (this.props.fallback) return this.props.fallback(error, this.reset)

    return (
      <div className="h-full w-full flex items-center justify-center p-6 bg-[var(--fg-bg)]">
        <div className="max-w-lg w-full rounded-lg border border-[var(--fg-status-error)] bg-[var(--fg-card)] p-5">
          <h2 className="text-sm font-semibold text-[var(--fg-status-error)] inline-flex items-center gap-1.5">
            <AlertTriangle size={15} />
            {this.props.label ? `「${this.props.label}」渲染出错` : '界面渲染出错'}
          </h2>
          <p className="text-xs text-[var(--fg-text-secondary)] mt-2 break-words">
            {error.message || String(error)}
          </p>
          <details className="mt-3">
            <summary className="text-xs text-[var(--fg-text-tertiary)] cursor-pointer">技术细节</summary>
            <pre className="mt-1 max-h-40 overflow-auto text-[10px] text-[var(--fg-text-tertiary)] whitespace-pre-wrap">
              {error.stack || '(no stack)'}
            </pre>
          </details>
          <div className="flex gap-2 mt-4">
            <button
              onClick={this.reset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--fg-accent-muted)] text-[var(--fg-accent-text)] hover:opacity-90"
            >
              <RotateCw size={12} />重试
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--fg-border)] text-[var(--fg-text-secondary)] hover:bg-[var(--fg-tree-hover)]"
            >
              重新加载应用
            </button>
          </div>
        </div>
      </div>
    )
  }
}
