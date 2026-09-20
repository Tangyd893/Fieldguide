/**
 * IPC error codes — shared across main / preload / renderer.
 * See architecture.md §7.5 for the full contract.
 */
export type IpcErrorCode =
  | 'PROJECT_NOT_FOUND'
  | 'INDEX_IN_PROGRESS'
  | 'GIT_CLONE_FAILED'
  | 'LLM_RATE_LIMIT'
  | 'LLM_NOT_CONFIGURED'
  | 'LLM_API_ERROR'
  | 'PARSE_ERROR'
  | 'SOURCE_UNAVAILABLE'
  | 'EMBED_API_ERROR'
  | 'INDEX_CANCELLED'
  /* ── Obsidian vault integration (F-17) ── */
  | 'OBSIDIAN_CLI_MISSING'
  | 'OBSIDIAN_APP_NOT_RUNNING'
  | 'OBSIDIAN_CLI_ERROR'
  | 'VAULT_NOT_BOUND'
  | 'VAULT_NOT_FOUND'
  | 'VAULT_NOT_REGISTERED'
  | 'VAULT_PATH_INVALID'
  | 'VAULT_SYNC_IN_PROGRESS'
  | 'VAULT_WRITE_CONFLICT'
  | 'UNKNOWN';

export interface IpcError {
  code: IpcErrorCode;
  message: string; // already localised, safe to display
  retryable: boolean;
}

export type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: IpcError };

export function ipcOk<T>(data: T): IpcResult<T> {
  return { ok: true, data };
}

export function ipcErr(
  code: IpcErrorCode,
  message: string,
  retryable = false,
): IpcResult<never> {
  return { ok: false, error: { code, message, retryable } };
}
