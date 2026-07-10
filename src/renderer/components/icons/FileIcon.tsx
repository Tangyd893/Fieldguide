/**
 * FileIcon — file-type-aware icon using Lucide.
 * Simplified Seti-inspired color palette.
 */
import {
  File, FileCode2, FileJson, FileText, FileImage, FileKey,
  Folder, FolderOpen, ChevronRight, ChevronDown,
  type LucideIcon,
} from 'lucide-react'

/** File extension → { icon, color } */
const FILE_ICON_MAP: Record<string, { icon: LucideIcon; color: string }> = {
  // Go
  go:        { icon: FileCode2, color: '#00ADD8' },
  // TypeScript / JavaScript
  ts:        { icon: FileCode2, color: '#3178C6' },
  tsx:       { icon: FileCode2, color: '#3178C6' },
  js:        { icon: FileCode2, color: '#F0DB4F' },
  jsx:       { icon: FileCode2, color: '#F0DB4F' },
  mjs:       { icon: FileCode2, color: '#F0DB4F' },
  cjs:       { icon: FileCode2, color: '#F0DB4F' },
  // Rust
  rs:        { icon: FileCode2, color: '#DEA584' },
  // Python
  py:        { icon: FileCode2, color: '#3572A5' },
  pyi:       { icon: FileCode2, color: '#3572A5' },
  // Java / Kotlin
  java:      { icon: FileCode2, color: '#B07219' },
  kt:        { icon: FileCode2, color: '#7F52FF' },
  // C / C++
  c:         { icon: FileCode2, color: '#555555' },
  cpp:       { icon: FileCode2, color: '#F34B7D' },
  cc:        { icon: FileCode2, color: '#F34B7D' },
  cxx:       { icon: FileCode2, color: '#F34B7D' },
  h:         { icon: FileCode2, color: '#555555' },
  hpp:       { icon: FileCode2, color: '#F34B7D' },
  // Ruby
  rb:        { icon: FileCode2, color: '#701516' },
  // PHP
  php:       { icon: FileCode2, color: '#4F5D95' },
  // CSS / Style
  css:       { icon: FileCode2, color: '#563D7C' },
  scss:      { icon: FileCode2, color: '#C6538C' },
  less:      { icon: FileCode2, color: '#1D365D' },
  // HTML
  html:      { icon: FileCode2, color: '#E34F26' },
  htm:       { icon: FileCode2, color: '#E34F26' },
  // JSON / Config
  json:      { icon: FileJson,   color: '#F0DB4F' },
  yaml:      { icon: FileJson,   color: '#CB171E' },
  yml:       { icon: FileJson,   color: '#CB171E' },
  toml:      { icon: FileJson,   color: '#9C4221' },
  xml:       { icon: FileJson,   color: '#005FAD' },
  // Markdown / Text
  md:        { icon: FileText,   color: '#4285F4' },
  mdx:       { icon: FileText,   color: '#4285F4' },
  txt:       { icon: FileText,   color: '#6B7280' },
  // SQL
  sql:       { icon: FileText,   color: '#336791' },
  // Shell
  sh:        { icon: FileCode2,  color: '#89E051' },
  bash:      { icon: FileCode2,  color: '#89E051' },
  zsh:       { icon: FileCode2,  color: '#89E051' },
  ps1:       { icon: FileCode2,  color: '#012456' },
  // GraphQL
  graphql:   { icon: FileCode2,  color: '#E10098' },
  gql:       { icon: FileCode2,  color: '#E10098' },
  // Images
  svg:       { icon: FileImage,  color: '#FFB13B' },
  png:       { icon: FileImage,  color: '#FFB13B' },
  jpg:       { icon: FileImage,  color: '#FFB13B' },
  jpeg:      { icon: FileImage,  color: '#FFB13B' },
  gif:       { icon: FileImage,  color: '#FFB13B' },
  ico:       { icon: FileImage,  color: '#FFB13B' },
  // Env / Secrets
  env:       { icon: FileKey,    color: '#F0DB4F' },
}

/** Special filenames (before extension fallback) */
const FILENAME_MAP: Record<string, { icon: LucideIcon; color: string }> = {
  'Dockerfile':     { icon: FileCode2,  color: '#2496ED' },
  'Makefile':       { icon: FileCode2,  color: '#6D3400' },
  'go.mod':         { icon: FileCode2,  color: '#00ADD8' },
  'go.sum':         { icon: FileKey,    color: '#00ADD8' },
  'package.json':   { icon: FileJson,   color: '#CB3837' },
  'tsconfig.json':  { icon: FileJson,   color: '#3178C6' },
  'Cargo.toml':     { icon: FileJson,   color: '#DEA584' },
  '.gitignore':     { icon: FileText,   color: '#F05032' },
  'README.md':      { icon: FileText,   color: '#4285F4' },
  'LICENSE':        { icon: FileText,   color: '#6B7280' },
  'NOTICE':         { icon: FileText,   color: '#6B7280' },
}

const FALLBACK_ICON: { icon: LucideIcon; color: string } = { icon: File, color: '#6B7280' }

/** Props for the main FileIcon */
export interface FileIconProps {
  /** File name (including extension) or directory name */
  name: string
  /** Whether this entry is a directory */
  isDirectory?: boolean
  /** Whether the directory is expanded (only for directories) */
  expanded?: boolean
  /** Icon size in pixels (default 14) */
  size?: number
  /** Additional class names */
  className?: string
}

/** Lucide-based file/folder icon with extension-color mapping */
export default function FileIcon({ name, isDirectory, expanded, size = 14, className }: FileIconProps) {
  if (isDirectory) {
    const Icon = expanded ? FolderOpen : Folder
    return <Icon size={size} className={className} color="#DCAC4A" />
  }

  const match = FILENAME_MAP[name] ?? FILE_ICON_MAP[getExt(name)] ?? FALLBACK_ICON
  const Icon = match.icon
  return <Icon size={size} className={className} color={match.color} />
}

function getExt(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

// ── Re-export tree chevrons for convenience ─────────────

export function TreeChevron({ expanded, size = 10 }: { expanded?: boolean; size?: number }) {
  const Icon = expanded ? ChevronDown : ChevronRight
  return <Icon size={size} className="text-[var(--fg-text-tertiary)] shrink-0" />
}
