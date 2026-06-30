/// <reference types="vite/client" />

interface FieldguideAPI {
  projectList(): Promise<{ ok: boolean; data?: unknown[]; error?: unknown }>
  projectAddLocal(path: string): Promise<{ ok: boolean; data?: unknown; error?: unknown }>
  graphGet(projectId: string): Promise<{ ok: boolean; data?: unknown; error?: unknown }>
  projectIndex(projectId: string): Promise<{ ok: boolean; data?: unknown; error?: unknown }>
  onIndexProgress(cb: (data: unknown) => void): () => void
  appVersion(): Promise<string>
}

declare global {
  interface Window {
    fieldguide: FieldguideAPI
  }
}
