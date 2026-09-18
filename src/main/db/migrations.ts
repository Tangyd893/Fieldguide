/**
 * Schema migration planning — pure logic, no database driver.
 *
 * `db/index.ts` owns the connection; this module only decides *what* has to
 * change. Keeping it free of `better-sqlite3` matters because that module is a
 * native addon compiled for Electron's ABI, so anything importing it cannot run
 * under plain Node/vitest — the migration rules would have been untestable.
 */

/** Bump when the schema changes and add the matching entry to ADDED_COLUMNS. */
export const SCHEMA_VERSION = 2

/**
 * Columns introduced after the initial schema, keyed by table.
 *
 * Fresh databases get these straight from the CREATE TABLE statements; existing
 * databases are upgraded by applying the matching ALTER TABLE steps.
 */
export const ADDED_COLUMNS: Record<string, Array<{ column: string; definition: string }>> = {
  chat_messages: [
    // v2: assistant answers persist the code nodes they cited.
    { column: 'node_refs', definition: "TEXT NOT NULL DEFAULT '[]'" },
  ],
}

export interface MigrationStep {
  table: string
  column: string
  definition: string
}

/**
 * Decide which columns are missing.
 *
 * @param fromVersion   `PRAGMA user_version` read before migrating.
 * @param tableColumns  column names per table, as reported by `PRAGMA table_info`.
 *                      A table absent from the map is treated as not-yet-created
 *                      (its columns come from the baseline CREATE TABLE).
 */
export function planMigrations(
  fromVersion: number,
  tableColumns: Record<string, string[] | undefined>,
): MigrationStep[] {
  if (fromVersion >= SCHEMA_VERSION) return []

  const steps: MigrationStep[] = []
  for (const [table, columns] of Object.entries(ADDED_COLUMNS)) {
    const existing = tableColumns[table]
    if (!existing) continue // table does not exist yet → baseline creates it
    for (const { column, definition } of columns) {
      if (!existing.includes(column)) {
        steps.push({ table, column, definition })
      }
    }
  }
  return steps
}

/** Render a plan step as the SQL that applies it. */
export function migrationSql(step: MigrationStep): string {
  return `ALTER TABLE ${step.table} ADD COLUMN ${step.column} ${step.definition}`
}
