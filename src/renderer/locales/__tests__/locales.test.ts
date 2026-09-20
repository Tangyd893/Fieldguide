/**
 * Locale parity.
 *
 * The UI is shipped in three languages and a missing key silently falls back to
 * the raw key string (or to English), which is easy to miss in review and hard to
 * notice in the app. This keeps the three files honest.
 */
import { describe, it, expect } from 'vitest'
import zhCN from '../zh-CN.json'
import zhTW from '../zh-TW.json'
import enUS from '../en-US.json'

type Json = Record<string, unknown>

/** Every leaf key path, e.g. `settings.obsidian.state.ok`. */
function leafPaths(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return [prefix]
  return Object.entries(value as Json).flatMap(([key, child]) =>
    leafPaths(child, prefix ? `${prefix}.${key}` : key),
  )
}

const locales: Array<[string, Json]> = [
  ['zh-TW', zhTW as Json],
  ['en-US', enUS as Json],
]

describe('locale key parity', () => {
  const reference = leafPaths(zhCN).sort()

  it.each(locales)('%s has exactly the same keys as zh-CN', (_name, locale) => {
    const actual = leafPaths(locale).sort()
    expect(actual.filter((k) => !reference.includes(k))).toEqual([])
    expect(reference.filter((k) => !actual.includes(k))).toEqual([])
  })

  it.each(locales)('%s translates every string value (no blanks)', (_name, locale) => {
    const at = (path: string) => path.split('.').reduce<unknown>((acc, key) => (acc as Json)?.[key], locale)
    // Non-string leaves (arrays, booleans) are legitimate; blank strings are not.
    const blanks = leafPaths(locale).filter((path) => typeof at(path) === 'string' && (at(path) as string).trim() === '')
    expect(blanks).toEqual([])
  })

  it('keeps the interpolation placeholders that the UI passes in', () => {
    // A dropped {{count}} renders a sentence with a hole in it.
    const placeholders = (text: string) => (text.match(/\{\{\s*\w+\s*\}\}/g) ?? []).sort()
    const collect = (locale: Json) =>
      Object.fromEntries(
        leafPaths(locale)
          .map((path) => [path, path.split('.').reduce<unknown>((acc, key) => (acc as Json)?.[key], locale)])
          .filter(([, value]) => typeof value === 'string' && value.includes('{{')) as Array<[string, string]>,
      )

    const referenceMap = collect(zhCN as Json)
    for (const [name, locale] of locales) {
      const localeMap = collect(locale)
      for (const [path, text] of Object.entries(referenceMap)) {
        expect(placeholders(localeMap[path] ?? ''), `${name}:${path}`).toEqual(placeholders(text))
      }
    }
  })
})
