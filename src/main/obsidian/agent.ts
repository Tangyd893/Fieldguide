/**
 * Obsidian tools for the coaching agent.
 *
 * Two constraints shape these:
 *
 *  1. **They only exist when a vault is bound.** `buildAgentTools()` omits them
 *     entirely otherwise, because a tool the model can see but never use is an
 *     invitation to hallucinate vault contents.
 *  2. **Reads are broad, writes are narrow.** Listing, reading and searching the
 *     project's cards is free; writing goes through `upsertAgentCard`, which pins
 *     the path inside the project's own folder and refuses files it does not own.
 */
import { existsSync } from 'node:fs'
import { loadConfig } from '../config'
import { backlinks, probeCli, searchVault } from './cli'
import { listProjectNotes, listVaultFiles, projectFolderRel, readProjectNote, userAnnotationOf } from './read'
import { upsertAgentCard } from './sync'
import type { VaultNoteKind } from './types'
import type { ToolSchema } from '../llm/client'

/** Facts the agent's tools need about the bound vault, scoped to one project. */
export interface VaultToolContext {
  projectId: string
  vaultPath: string
  vaultName: string
  /** Vault-relative folder owned by this project. */
  folderRel: string
  /** False when the user disabled agent writes in settings. */
  allowWrite: boolean
  notesCount: number
}

/** Maximum characters returned by a single read, to protect the context budget. */
const READ_LIMIT = 4000
const SEARCH_LIMIT = 15

/**
 * Build the vault context, or undefined when the integration is off.
 *
 * Total by contract: this is called on the hot path of every chat turn (and from
 * unit tests with a stubbed Electron), so an unreadable config, an unknown project
 * or a missing vault must all degrade to "no vault tools" instead of throwing.
 *
 * Deliberately does not require a reachable CLI: cards are files on disk, and the
 * agent must be able to read what a previous sync wrote even while Obsidian is
 * closed. The CLI-only tools report their own unavailability.
 */
export function vaultToolContext(projectId: string): VaultToolContext | undefined {
  try {
    const { vaultPath, vaultName, agentWrite } = loadConfig().obsidian
    if (!vaultPath || !existsSync(vaultPath)) return undefined
    return {
      projectId,
      vaultPath,
      vaultName,
      folderRel: projectFolderRel(projectId),
      allowWrite: agentWrite,
      notesCount: listProjectNotes(projectId).length,
    }
  } catch {
    return undefined
  }
}

/** OpenAI-style schemas, injected only when a vault is bound. */
export const VAULT_TOOL_SCHEMAS: ToolSchema[] = [
  {
    type: 'function' as const,
    function: {
      name: 'vault_list_cards',
      description: 'List the Obsidian cards Fieldguide synced for this project (path, title, kind, sync status, and how much the reader annotated).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'vault_read_note',
      description: 'Read one synced card or note from the project vault folder, including the text the reader added outside the generated block.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Vault-relative note path, as returned by vault_list_cards' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'vault_search',
      description: `Full-text search inside the project vault folder (needs Obsidian to be running). Returns matching note paths.`,
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search text' },
          limit: { type: 'number', description: `Max results (default ${SEARCH_LIMIT})` },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'vault_upsert_card',
      description: 'Create or update one Obsidian card in the project vault folder. Content outside the generated block is preserved. Use this to save a synthesis the reader will want in their notes.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Card title (also used as the filename)' },
          body: { type: 'string', description: 'Card body in Markdown' },
          kind: { type: 'string', description: 'One of: knowledge, interview, bridge, layer, module, tour, path (default knowledge)' },
          path: { type: 'string', description: 'Optional explicit vault-relative path inside the project folder' },
          node_ids: { type: 'array', items: { type: 'string' }, description: 'Graph node ids this card refers to' },
        },
        required: ['title', 'body'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'vault_backlinks',
      description: 'List notes that link to a synced card (needs Obsidian to be running).',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Vault-relative note path' } },
        required: ['path'],
      },
    },
  },
]

export const VAULT_TOOL_NAMES = new Set(VAULT_TOOL_SCHEMAS.map((schema) => schema.function.name))

const WRITABLE_KINDS = new Set<VaultNoteKind>(['knowledge', 'interview', 'bridge', 'layer', 'module', 'tour', 'path'])

/** Run one vault tool. The caller has already established that a vault is bound. */
export async function executeVaultTool(
  name: string,
  args: Record<string, unknown>,
  ctx: VaultToolContext,
): Promise<string> {
  switch (name) {
    case 'vault_list_cards': {
      const notes = listProjectNotes(ctx.projectId)
      // The bookkeeping table and the folder can disagree (another install wrote
      // the cards, or the database was reset). Reporting only the tracked rows
      // made the coach believe the sync had never run, so both views are returned.
      const tracked = new Set(notes.map((note) => note.notePath))
      const onDisk = listVaultFiles(ctx.projectId).filter((file) => !tracked.has(file))
      return JSON.stringify({
        folder: ctx.folderRel,
        trackedCount: notes.length,
        cards: notes.slice(0, 60).map((note) => ({
          path: note.notePath,
          title: note.title,
          kind: note.kind,
          status: note.status,
          readerAnnotations: note.userChars,
        })),
        ...(onDisk.length > 0
          ? {
            untrackedCount: onDisk.length,
            untracked: onDisk.slice(0, 50),
            untrackedNote: 'These notes exist in the vault folder but have no Fieldguide bookkeeping in this profile — read them with vault_read_note instead of concluding the sync never ran.',
          }
          : {}),
      })
    }

    case 'vault_read_note': {
      const relPath = String(args.path ?? '').trim()
      if (!relPath) return JSON.stringify({ error: 'path is required' })
      const note = readProjectNote(ctx.projectId, relPath)
      if (!note) return JSON.stringify({ error: `note not found: ${relPath}` })
      return JSON.stringify({
        path: relPath,
        title: note.title,
        content: note.content.slice(0, READ_LIMIT),
        truncated: note.content.length > READ_LIMIT,
        readerAnnotations: userAnnotationOf(ctx.projectId, relPath).slice(0, 1000),
      })
    }

    case 'vault_search': {
      const query = String(args.query ?? '').trim()
      if (!query) return JSON.stringify({ error: 'query is required' })
      const cli = await probeCli({ cliPath: loadConfig().obsidian.cliPath })
      if (cli.state !== 'ok' || !cli.cliPath) {
        return JSON.stringify({
          error: 'Obsidian CLI unavailable (the app is probably not running)',
          fallback: 'Use vault_list_cards and vault_read_note instead — they read the files directly.',
        })
      }
      const limit = Math.min(Math.max(Number(args.limit) || SEARCH_LIMIT, 1), 30)
      const hits = await searchVault({
        cliPath: cli.cliPath,
        vaultName: ctx.vaultName || undefined,
        query,
        folder: ctx.folderRel,
        limit,
      })
      return JSON.stringify({ query, scope: ctx.folderRel, hits })
    }

    case 'vault_upsert_card': {
      if (!ctx.allowWrite) {
        return JSON.stringify({ error: 'The user disabled agent writes to the vault (Settings → Obsidian).' })
      }
      const title = String(args.title ?? '').trim()
      const body = String(args.body ?? '').trim()
      if (!title || !body) return JSON.stringify({ error: 'title and body are required' })
      const kindArg = String(args.kind ?? 'knowledge').trim() as VaultNoteKind
      const kind = WRITABLE_KINDS.has(kindArg) ? kindArg : 'knowledge'
      try {
        const result = await upsertAgentCard({
          projectId: ctx.projectId,
          title,
          body,
          kind,
          path: args.path ? String(args.path) : undefined,
          nodeIds: Array.isArray(args.node_ids) ? args.node_ids.map(String) : [],
        })
        return JSON.stringify({ notePath: result.notePath, created: result.created })
      } catch (err) {
        return JSON.stringify({ error: err instanceof Error ? err.message : String(err) })
      }
    }

    case 'vault_backlinks': {
      const relPath = String(args.path ?? '').trim()
      if (!relPath) return JSON.stringify({ error: 'path is required' })
      const cli = await probeCli({ cliPath: loadConfig().obsidian.cliPath })
      if (cli.state !== 'ok' || !cli.cliPath) {
        return JSON.stringify({ error: 'Obsidian CLI unavailable (the app is probably not running)' })
      }
      const links = await backlinks({
        cliPath: cli.cliPath,
        vaultName: ctx.vaultName || undefined,
        notePath: relPath,
      })
      return JSON.stringify({ path: relPath, backlinks: links.slice(0, 30) })
    }

    default:
      return JSON.stringify({ error: `Unknown vault tool: ${name}` })
  }
}
