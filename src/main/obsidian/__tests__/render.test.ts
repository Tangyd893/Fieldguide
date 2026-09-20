import { describe, it, expect } from 'vitest'
import {
  MANAGED_BEGIN,
  MANAGED_END,
  computeHash,
  frontmatterValue,
  mergeFrontmatter,
  notePath,
  parseInlineList,
  renderNote,
  rerenderNote,
  sanitizeNoteName,
  splitFrontmatter,
  splitManaged,
  subfolderForKind,
  userAnnotationText,
  wikilink,
  wrapManaged,
  yamlList,
  yamlScalar,
} from '../render'
import type { VaultNoteKind } from '../types'

const meta = {
  kind: 'knowledge' as VaultNoteKind,
  project: 'pulsegate',
  projectName: 'PulseGate',
  source: 'kn-1',
  nodeIds: ['fn:auth:verify'],
  updated: '2026-09-19T10:00:00.000Z',
  aliases: ['JWT 校验'],
}

describe('yamlScalar', () => {
  it('leaves simple values bare and quotes what would change meaning', () => {
    expect(yamlScalar('PulseGate')).toBe('PulseGate')
    expect(yamlScalar('知识卡')).toBe('知识卡')
    // A colon or a leading dash/comma turning into a map or a list would silently
    // corrupt the frontmatter, which Obsidian parses strictly.
    expect(yamlScalar('a: b')).toBe('"a: b"')
    expect(yamlScalar('- item')).toBe('"- item"')
    expect(yamlScalar('#tag')).toBe('"#tag"')
    expect(yamlScalar('true')).toBe('"true"')
    expect(yamlScalar('42')).toBe('"42"')
    expect(yamlScalar(' padded ')).toBe('" padded "')
    expect(yamlScalar('')).toBe("''")
  })

  it('escapes quotes, backslashes and newlines instead of emitting broken YAML', () => {
    expect(yamlScalar('say "hi"')).toBe('"say \\"hi\\""')
    expect(yamlScalar('C:\\vault')).toBe('"C:\\\\vault"')
    expect(yamlScalar('two\nlines')).toBe('"two\\nlines"')
  })
})

describe('yamlList / parseInlineList', () => {
  it('round-trips a list', () => {
    expect(parseInlineList(yamlList(['a', 'b c']))).toEqual(['a', 'b c'])
    expect(yamlList([])).toBe('[]')
    expect(parseInlineList('[]')).toEqual([])
  })

  it('tolerates plain comma-separated input from hand-edited notes', () => {
    expect(parseInlineList('one, two')).toEqual(['one', 'two'])
  })
})

describe('frontmatter handling', () => {
  it('splits frontmatter from the body', () => {
    const parts = splitFrontmatter('---\ntype: x\n---\n\nbody')
    expect(parts.body).toBe('type: x')
    expect(parts.rest).toBe('\nbody')
  })

  it('treats a note without frontmatter as all body', () => {
    expect(splitFrontmatter('just text').body).toBe('')
    expect(splitFrontmatter('just text').rest).toBe('just text')
  })

  it('writes our keys and keeps the ones the user added', () => {
    const existing = 'my-custom: keep me\ntags: [mine]\nfieldguide-kind: stale'
    const merged = mergeFrontmatter(existing, meta)
    expect(merged).toContain('my-custom: keep me')
    expect(frontmatterValue(merged, 'fieldguide-kind')).toBe('knowledge')
    expect(merged).not.toContain('stale')
  })

  it('unions tags instead of replacing the user\'s own', () => {
    const merged = mergeFrontmatter('tags: [mine, project/other]', meta)
    const tags = parseInlineList(frontmatterValue(merged, 'tags') ?? '')
    expect(tags).toContain('mine')
    expect(tags).toContain('project/other')
    expect(tags).toContain('project/pulsegate')
    expect(tags).toContain('kind/knowledge')
  })

  it('routes hostile titles through the YAML quoting rules', () => {
    const merged = mergeFrontmatter('', { ...meta, aliases: ['a: b', 'x"y'] })
    expect(merged).toContain('aliases: ["a: b", "x\\"y"]')
  })
})

describe('managed block', () => {
  it('splits a note into before / managed / after', () => {
    const split = splitManaged(`intro\n${MANAGED_BEGIN}\ngenerated\n${MANAGED_END}\noutro`)
    expect(split.hasMarkers).toBe(true)
    expect(split.before.trim()).toBe('intro')
    expect(split.managed.trim()).toBe('generated')
    expect(split.after.trim()).toBe('outro')
  })

  it('reports missing markers rather than guessing a boundary', () => {
    const split = splitManaged('no markers here')
    expect(split.hasMarkers).toBe(false)
    expect(split.managed).toBe('')
  })

  it('exposes only the text the reader wrote outside the block', () => {
    const content = `---\ntype: x\n---\n\nmy preamble\n${wrapManaged('generated')}\nmy own note\n`
    const annotations = userAnnotationText(content)
    expect(annotations).toContain('my preamble')
    expect(annotations).toContain('my own note')
    expect(annotations).not.toContain('generated')
  })
})

describe('renderNote / rerenderNote', () => {
  it('renders frontmatter, a managed block and a trailing newline', () => {
    const content = renderNote({ meta, body: '# Card\n\nbody text' })
    expect(content.startsWith('---\n')).toBe(true)
    expect(content).toContain(`type: fieldguide/knowledge`)
    expect(content).toContain(MANAGED_BEGIN)
    expect(content).toContain(MANAGED_END)
    expect(content.endsWith('\n')).toBe(true)
    expect(frontmatterValue(splitFrontmatter(content).body, 'fieldguide-project')).toBe('pulsegate')
  })

  it('keeps the reader\'s own text when the markers are intact', () => {
    const first = renderNote({ meta, body: 'first body' })
    // The reader's note goes *outside* the generated block — that is the contract.
    const edited = `${first}\n> 我的批注：这里要重新看\n`
    const result = rerenderNote({ meta, body: 'second body', existing: edited })
    expect(result.mode).toBe('block')
    expect(result.content).toContain('second body')
    expect(result.content).not.toContain('first body')
    expect(result.content).toContain('我的批注')
  })

  it('does not duplicate user text on repeated re-renders (idempotent)', () => {
    const once = rerenderNote({ meta, body: 'v1', existing: `${renderNote({ meta, body: 'v0' })}\nnote\n` })
    const twice = rerenderNote({ meta, body: 'v2', existing: once.content })
    expect(twice.content.match(/note/g)?.length).toBe(1)
    expect(twice.content).toContain('v2')
  })

  it('preserves user text even when the markers were removed', () => {
    const withoutMarkers = 'my own file\n\ntype: neither\n'
    const result = rerenderNote({ meta, body: 'generated', existing: withoutMarkers })
    expect(result.mode).toBe('full')
    expect(result.content).toContain('my own file')
    expect(result.content).toContain(MANAGED_BEGIN)
  })

  it('is a fixed point: re-rendering the same body changes nothing', () => {
    const first = renderNote({ meta, body: 'stable' })
    const second = rerenderNote({ meta, body: 'stable', existing: first })
    expect(second.content).toBe(first)
  })
})

describe('sanitizeNoteName', () => {
  it('keeps CJK titles so wikilinks resolve naturally', () => {
    expect(sanitizeNoteName('JWT 校验流程')).toBe('JWT 校验流程')
  })

  it('strips characters that are illegal on Windows or inside a wikilink', () => {
    expect(sanitizeNoteName('a/b\\c:d*e?f"g<h>i|j#k^l[m]n')).toBe('a b c d e f g h i j k l m n')
  })

  it('collapses whitespace, trims dots and enforces a length bound', () => {
    expect(sanitizeNoteName('  a   b  ')).toBe('a b')
    expect(sanitizeNoteName('...name...')).toBe('name')
    expect(sanitizeNoteName('x'.repeat(200)).length).toBe(80)
  })

  it('falls back instead of producing an empty filename', () => {
    expect(sanitizeNoteName('///')).toBe('Untitled')
    expect(sanitizeNoteName('')).toBe('Untitled')
  })

  it('de-duplicates collisions per sync run', () => {
    const taken = new Set<string>()
    expect(sanitizeNoteName('聚合', taken)).toBe('聚合')
    expect(sanitizeNoteName('聚合', taken)).toBe('聚合-2')
    expect(sanitizeNoteName('聚合', taken)).toBe('聚合-3')
  })
})

describe('paths and links', () => {
  it('builds vault-relative paths per kind', () => {
    expect(notePath('Fieldguide/pulsegate', subfolderForKind('knowledge'), '知识-认证')).toBe('Fieldguide/pulsegate/cards/知识-认证.md')
    expect(notePath('Fieldguide/pulsegate', subfolderForKind('index'), '项目索引')).toBe('Fieldguide/pulsegate/项目索引.md')
    expect(notePath('Fieldguide/pulsegate', subfolderForKind('note'), '笔记-a')).toBe('Fieldguide/pulsegate/notes/笔记-a.md')
  })

  it('drops empty segments instead of emitting `//`', () => {
    expect(notePath('', '', 'x')).toBe('x.md')
  })

  it('strips characters that would break a wikilink', () => {
    expect(wikilink('a|b')).toBe('[[ab]]')
    expect(wikilink('概念', '别名')).toBe('[[概念|别名]]')
  })
})

describe('computeHash', () => {
  it('is stable and content-sensitive', () => {
    expect(computeHash('abc')).toBe(computeHash('abc'))
    expect(computeHash('abc')).not.toBe(computeHash('abd'))
  })
})
