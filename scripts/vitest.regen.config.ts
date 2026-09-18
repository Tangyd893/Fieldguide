/**
 * Vitest config for on-demand repository tools (not part of the default suite).
 *
 * The default config only includes `src/**\/__tests__\/**\/*.test.ts`; tools under
 * `scripts/` are run explicitly so they can never fire during a normal test run
 * (they mutate repository files on purpose).
 *
 * Usage: pnpm regen:sample-graph
 */
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['scripts/**/*.test.ts'],
  },
})
