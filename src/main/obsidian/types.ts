/**
 * Obsidian integration — main-process-only types.
 *
 * Everything that crosses the IPC boundary lives in `src/shared/obsidian.ts`;
 * only the internal working shapes (the desired-note document a card builder
 * produces, and the raw plan the sync engine applies) stay here.
 */
export type {
  ObsidianStatus,
  SyncAction,
  SyncActionKind,
  VaultBinding,
  VaultBindingKind,
  VaultCliState,
  VaultCliStatus,
  VaultConflictAction,
  VaultInfo,
  VaultNoteKind,
  VaultNoteStatus,
  VaultNoteView,
  VaultSyncConflict,
  VaultSyncReport,
  VaultUnbindMode,
} from '../../shared/obsidian'

import type { VaultNoteKind } from '../../shared/obsidian'

/** A note Fieldguide wants to exist, rendered except for frontmatter and markers. */
export interface VaultNoteDoc {
  /** Vault-relative posix path, including `.md`. */
  notePath: string
  title: string
  kind: VaultNoteKind
  /** Source row id in SQLite (knowledge id, question id, …); '' for aggregates. */
  sourceId: string
  /** Graph node ids this card refers to. */
  nodeIds: string[]
  /** Body markdown without frontmatter and without managed-block markers. */
  body: string
}

/** One note as it exists on disk, fed to the planner. */
export interface DiskNote {
  notePath: string
  content: string
}

/** A previous write we know about (from `vault_notes`). */
export interface KnownNote {
  notePath: string
  title: string
  kind: VaultNoteKind
  sourceId: string
  contentHash: string
}
