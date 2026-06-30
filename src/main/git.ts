/**
 * Git service — wraps simple-git for clone operations.
 */
import { simpleGit, SimpleGit, SimpleGitOptions } from 'simple-git'
import { join } from 'node:path'
import { existsSync } from 'node:fs'

export interface CloneResult {
  success: boolean
  path: string
  error?: string
}

export async function cloneRepo(
  url: string,
  targetDir: string,
  branch?: string,
): Promise<CloneResult> {
  // Security: block file:// and other dangerous protocols
  const lower = url.toLowerCase().trim()
  if (lower.startsWith('file://') || lower.startsWith('\\') || /^[a-z]:[/\\]/i.test(lower)) {
    return { success: false, path: targetDir, error: '不支持本地路径作为 Git URL' }
  }

  if (existsSync(targetDir)) {
    return { success: false, path: targetDir, error: `目标目录已存在: ${targetDir}` }
  }

  try {
    const git: SimpleGit = simpleGit()
    const options: string[] = ['--depth', '1']
    if (branch) {
      options.push('--branch', branch)
    }
    await git.clone(url, targetDir, options)
    return { success: true, path: targetDir }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, path: targetDir, error: `克隆失败: ${msg}` }
  }
}
