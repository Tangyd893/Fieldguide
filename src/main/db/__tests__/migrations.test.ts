/**
 * Schema migration planning.
 *
 * These run without a database: `better-sqlite3` is a native addon built for
 * Electron's ABI, so a driver-backed test cannot execute under vitest. The plan
 * (what to ALTER) is therefore pure logic and is what we assert here.
 */
import { describe, it, expect } from 'vitest'
import { SCHEMA_VERSION, ADDED_COLUMNS, planMigrations, migrationSql } from '../migrations'

describe('migration planning', () => {
  it('upgrades a v1 chat_messages table that lacks node_refs', () => {
    const steps = planMigrations(0, {
      chat_messages: ['id', 'project_id', 'role', 'content', 'steps_json', 'created_at'],
    })
    expect(steps).toEqual([
      { table: 'chat_messages', column: 'node_refs', definition: "TEXT NOT NULL DEFAULT '[]'" },
    ])
    expect(migrationSql(steps[0])).toBe(
      "ALTER TABLE chat_messages ADD COLUMN node_refs TEXT NOT NULL DEFAULT '[]'",
    )
  })

  it('does nothing when the column is already present', () => {
    const steps = planMigrations(0, {
      chat_messages: ['id', 'project_id', 'role', 'content', 'steps_json', 'node_refs', 'created_at'],
    })
    expect(steps).toEqual([])
  })

  it('does nothing for a fresh database whose table was just created', () => {
    // A table that does not exist yet is created by the baseline schema, which
    // already includes every added column.
    expect(planMigrations(0, {})).toEqual([])
    expect(planMigrations(0, { chat_messages: undefined })).toEqual([])
  })

  it('is a no-op once the database is at the current version', () => {
    const stale = planMigrations(0, { chat_messages: ['id'] })
    expect(stale.length).toBeGreaterThan(0)
    expect(planMigrations(SCHEMA_VERSION, { chat_messages: ['id'] })).toEqual([])
  })

  it('covers every table declared in ADDED_COLUMNS', () => {
    const tables = Object.keys(ADDED_COLUMNS)
    expect(tables).toContain('chat_messages')
    // Guard against a version bump without a matching rule.
    expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(2)
    for (const table of tables) {
      for (const { column, definition } of ADDED_COLUMNS[table]) {
        expect(column).toMatch(/^[a-z_]+$/)
        expect(definition.length).toBeGreaterThan(0)
        // SQLite cannot add a NOT NULL column without a default.
        if (/NOT NULL/.test(definition)) expect(definition).toContain('DEFAULT')
      }
    }
  })
})
