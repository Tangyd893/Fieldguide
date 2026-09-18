/**
 * Vitest config for on-demand repository tools (never part of the default suite).
 *
 * The default config only includes `src/**\/__tests__\/**\/*.test.ts`. Tools under
 * `scripts/` are invoked explicitly so they can never fire during a normal test
 * run — they either mutate repository files or produce reports on purpose:
 *
 *   pnpm regen:sample-graph   regenerate the bundled demo graph
 *   pnpm eval:agent           run the coach evaluation harness
 */
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['scripts/**/*.test.ts'],
  },
})
