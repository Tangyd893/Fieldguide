/**
 * Simple syntax highlighting by language.
 * Phase 2: keyword/comment/string detection.
 * Phase 2+: Monaco Editor.
 */

const LANG_KEYWORDS: Record<string, string[]> = {
  go: ['func', 'package', 'import', 'return', 'if', 'else', 'for', 'range', 'var', 'const', 'type', 'struct', 'interface', 'map', 'chan', 'defer', 'go', 'select', 'case', 'switch', 'break', 'continue', 'fallthrough', 'nil', 'true', 'false', 'make', 'new', 'append', 'len', 'cap', 'panic', 'recover'],
  typescript: ['function', 'const', 'let', 'var', 'return', 'if', 'else', 'for', 'while', 'class', 'interface', 'type', 'extends', 'implements', 'import', 'export', 'default', 'from', 'async', 'await', 'try', 'catch', 'throw', 'new', 'this', 'super', 'null', 'undefined', 'true', 'false'],
  javascript: ['function', 'const', 'let', 'var', 'return', 'if', 'else', 'for', 'while', 'class', 'extends', 'import', 'export', 'default', 'from', 'async', 'await', 'try', 'catch', 'throw', 'new', 'this', 'null', 'undefined', 'true', 'false'],
  python: ['def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while', 'import', 'from', 'as', 'try', 'except', 'finally', 'raise', 'with', 'yield', 'lambda', 'pass', 'break', 'continue', 'and', 'or', 'not', 'in', 'is', 'None', 'True', 'False', 'self'],
  rust: ['fn', 'let', 'mut', 'pub', 'use', 'mod', 'struct', 'enum', 'impl', 'trait', 'match', 'if', 'else', 'for', 'while', 'loop', 'return', 'self', 'Self', 'where', 'as', 'in', 'ref', 'move', 'unsafe', 'true', 'false', 'None', 'Some', 'Ok', 'Err'],
  java: ['public', 'private', 'protected', 'class', 'interface', 'extends', 'implements', 'static', 'final', 'void', 'return', 'if', 'else', 'for', 'while', 'new', 'this', 'super', 'try', 'catch', 'throw', 'throws', 'import', 'package', 'null', 'true', 'false'],
}

export function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    go: 'go', ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', rs: 'rust', java: 'java', rb: 'ruby', php: 'php',
    c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp', cs: 'csharp', kt: 'kotlin',
    swift: 'swift', dart: 'dart', sql: 'sql',
  }
  return map[ext] || 'plaintext'
}

export function highlightLine(line: string, language: string): React.ReactNode {
  const keywords = LANG_KEYWORDS[language]
  if (!keywords || language === 'plaintext') return line

  const keywordSet = new Set(keywords)
  const tokens: React.ReactNode[] = []
  let i = 0

  // Simple tokenizer: strings, comments, keywords, identifiers
  while (i < line.length) {
    // String (double quote)
    if (line[i] === '"' || line[i] === '`') {
      const quote = line[i]
      let j = i + 1
      while (j < line.length && line[j] !== quote) {
        if (line[j] === '\\') j++
        j++
      }
      if (j < line.length) j++
      tokens.push(
        <span key={i} className="text-green-600">{line.slice(i, j)}</span>
      )
      i = j
      continue
    }
    // String (single quote) — only in languages that support it
    if (line[i] === "'" && !['python'].includes(language)) {
      let j = i + 1
      while (j < line.length && line[j] !== "'") {
        if (line[j] === '\\') j++
        j++
      }
      if (j < line.length) j++
      tokens.push(
        <span key={i} className="text-green-600">{line.slice(i, j)}</span>
      )
      i = j
      continue
    }
    // Line comment
    if (line[i] === '/' && line[i + 1] === '/') {
      tokens.push(
        <span key={i} className="text-gray-400 italic">{line.slice(i)}</span>
      )
      break
    }
    // Python comment
    if (line[i] === '#') {
      tokens.push(
        <span key={i} className="text-gray-400 italic">{line.slice(i)}</span>
      )
      break
    }
    // Number
    if (/[0-9]/.test(line[i])) {
      let j = i
      while (j < line.length && /[0-9.xXa-fA-F_]/.test(line[j])) j++
      tokens.push(
        <span key={i} className="text-orange-500">{line.slice(i, j)}</span>
      )
      i = j
      continue
    }
    // Word (identifier or keyword)
    if (/[a-zA-Z_]/.test(line[i])) {
      let j = i
      while (j < line.length && /[a-zA-Z0-9_]/.test(line[j])) j++
      const word = line.slice(i, j)
      if (keywordSet.has(word)) {
        tokens.push(
          <span key={i} className="text-purple-600 font-medium">{word}</span>
        )
      } else {
        tokens.push(<span key={i}>{word}</span>)
      }
      i = j
      continue
    }
    // Other characters
    tokens.push(<span key={i}>{line[i]}</span>)
    i++
  }

  return <>{tokens}</>
}
