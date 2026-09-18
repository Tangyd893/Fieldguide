/**
 * Data-directory resolution.
 *
 * `FIELDGUIDE_DATA_DIR` exists for portable installs and for end-to-end tests:
 * Electron resolves `appData` through the OS API, so overriding the APPDATA
 * environment variable does not isolate anything (an E2E run would otherwise read
 * and write the developer's real project library).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => process.cwd(),
    // Points at a throwaway directory so nothing here touches real app data.
    getPath: () => join(tmpdir(), 'fg-datadir-mock'),
  },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (buffer: Buffer) => buffer.toString(),
  },
}))

import { dataDir } from '../config'

const created: string[] = []

afterEach(() => {
  delete process.env.FIELDGUIDE_DATA_DIR
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('dataDir', () => {
  it('uses FIELDGUIDE_DATA_DIR when set and creates it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fg-datadir-'))
    created.push(dir)
    const nested = join(dir, 'nested', 'fieldguide')

    process.env.FIELDGUIDE_DATA_DIR = nested
    expect(dataDir()).toBe(nested)
    expect(existsSync(nested)).toBe(true)
  })

  it('falls back to appData/Fieldguide when the override is empty', () => {
    process.env.FIELDGUIDE_DATA_DIR = '   '
    expect(dataDir()).toBe(join(tmpdir(), 'fg-datadir-mock', 'Fieldguide'))
  })

  it('falls back when the override is unset', () => {
    expect(dataDir()).toBe(join(tmpdir(), 'fg-datadir-mock', 'Fieldguide'))
  })
})
