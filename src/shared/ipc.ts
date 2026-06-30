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
  | 'PARSE_ERROR'
  | 'SOURCE_UNAVAILABLE'
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
