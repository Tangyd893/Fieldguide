/**
 * Obsidian integration — types shared by main, preload and renderer.
 *
 * The settings page and the vault panel render these directly, so the states are
 * a closed set: the UI localises by state, never by parsing an error message.
 */

/** Why the integration is or is not usable right now. */
export type VaultCliState =
  /** CLI resolved and answering — the only state that unlocks the pickers. */
  | 'ok'
  /** No `obsidian` executable found on PATH, in the install dirs, or via override. */
  | 'cli-missing'
  /** CLI present but the Obsidian app is not running (the CLI talks to it over IPC). */
  | 'app-not-running'
  /** CLI present but the installed Obsidian is older than the 1.12.7 requirement. */
  | 'unsupported-version'
  /** Anything else — timeouts, spawn failures, unexpected exit codes. */
  | 'error'

export interface VaultCliStatus {
  state: VaultCliState
  /** Absolute path of the resolved CLI ('' when none was found). */
  cliPath: string
  /** Version reported by `obsidian version` ('' when unknown). */
  version: string
  /** Raw diagnostic detail; shown as secondary text only. */
  detail: string
  /** True when this answer came from the short-lived probe cache. */
  cached: boolean
  checkedAt: string
}

/** A vault Obsidian knows about. */
export interface VaultInfo {
  name: string
  path: string
}

/** How a picked directory relates to Obsidian's vault registry. */
export type VaultBindingKind = 'registered' | 'nested' | 'unregistered'

export interface VaultBinding {
  path: string
  name: string
  kind: VaultBindingKind
  /** Set for `nested`: the registered vault that contains the picked folder. */
  parentVault?: VaultInfo
}

export type VaultNoteKind =
  | 'index'
  | 'architecture'
  | 'layer'
  | 'module'
  | 'tour'
  | 'knowledge'
  | 'interview'
  | 'bridge'
  | 'path'
  | 'note'
  | 'report'

export type VaultNoteStatus =
  /** On disk exactly as Fieldguide last wrote it. */
  | 'clean'
  /** User added text outside the managed block — safe to re-sync. */
  | 'user-edited'
  /** Managed region changed or markers removed — needs a decision. */
  | 'conflict'
  /** Row exists but the file is gone. */
  | 'missing'

export interface VaultNoteView {
  notePath: string
  title: string
  kind: VaultNoteKind
  sourceId: string
  status: VaultNoteStatus
  syncedAt: string
  /** Characters the user added outside the managed block, when detectable. */
  userChars: number
}

export type SyncActionKind =
  | 'create'
  | 'update'
  /** Already identical — no write. */
  | 'skip'
  /** On disk without our bookkeeping row, but clearly ours (markers intact). */
  | 'adopt'
  /** User edited inside the generated region, or removed the markers. */
  | 'conflict'
  /** Source disappeared, but the file was edited by the user → keep it. */
  | 'orphan-kept'
  /** Source disappeared and the file is untouched → remove it. */
  | 'delete'

export interface SyncAction {
  kind: SyncActionKind
  notePath: string
  title: string
  noteKind: VaultNoteKind
  reason?: string
}

export interface VaultSyncConflict {
  notePath: string
  title: string
  reason: string
}

export interface VaultSyncReport {
  projectId: string
  projectName: string
  vaultPath: string
  /** Vault-relative folder this project owns. */
  folder: string
  /** True for a preview: nothing was written. */
  dryRun: boolean
  created: number
  updated: number
  unchanged: number
  removed: number
  conflicts: VaultSyncConflict[]
  /** Notes kept because the user had edited them. */
  orphaned: string[]
  warnings: string[]
  actions: SyncAction[]
  /** False when the run stopped early (e.g. the CLI gate failed before writing). */
  applied: boolean
  finishedAt: string
}

/** What the settings page and the vault panel render. */
export interface ObsidianStatus {
  cli: VaultCliStatus
  binding: VaultBinding | null
  /** Root folder Fieldguide owns inside the vault. */
  folder: string
  notesCount: number
  lastSyncAt: string | null
  syncInFlight: boolean
}

/** Actions offered for a conflicted note in the vault panel. */
export type VaultConflictAction =
  /** Accept the on-disk version: record it as the new baseline. */
  | 'keep-user'
  /** Replace the managed block with Fieldguide's current content. */
  | 'overwrite'
  /** Leave the file alone and write the incoming version beside it. */
  | 'save-copy'

/** What to do with the generated notes when unbinding a vault. */
export type VaultUnbindMode = 'keep' | 'cleanup'
