#!/usr/bin/env node
/**
 * Record real coach answers for the answer-level benchmark.
 *
 *   pnpm eval:record-answers [--field=question|questionEn|keywords] [--limit=N] [--dataset=name]
 *
 * This is the **only** step in the evaluation pipeline that needs an API key and
 * costs money; everything downstream (`pnpm eval:answers`) re-scores the recorded
 * file offline. That split is why citation metrics can live in CI without a key.
 *
 * How it runs: it drives the **real Electron app** (same mechanism as the Playwright
 * E2E suite) with a temp `FIELDGUIDE_DATA_DIR`, registers each dataset's repository
 * as a project, asks the dataset's questions through the real `chat:send` IPC, and
 * writes `eval/answers/<dataset>.<model>.json`.
 *
 * Why not call the agent in-process instead: `agent/tools.ts` pulls in the SQLite
 * layer, and better-sqlite3 is built for Electron's ABI, so it cannot load under
 * plain Node/vitest. Driving the app is both simpler and more faithful — the
 * recording then reflects the same code path a user hits.
 *
 * No key present → prints how to configure one and exits 0 (never fails a build).
 */
import { _electron as electron } from '@playwright/test'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const entry = join(repoRoot, 'out', 'main', 'index.js')
const datasetsDir = join(repoRoot, 'eval', 'datasets')
const answersDir = join(repoRoot, 'eval', 'answers')

const ENV_KEYS = [
  'DEEPSEEK_API_KEY',
  'OPENAI_API_KEY',
  'MOONSHOT_API_KEY',
  'SILICONFLOW_API_KEY',
  'OPENROUTER_API_KEY',
  'FIELDGUIDE_API_KEY',
]

/** Recorded nodeRefs mean "the agent leaned on these nodes", not "the answer named them". */
const CITATION_SEMANTICS =
  'citedNodeIds = Agent 运行时的 nodeRefs（上下文种子节点 ∪ 工具 observation 中提取的节点，见 src/main/agent/react.ts），' +
  '不是从答案正文解析出的引用标记。因此它度量的是「Agent 依据了哪些节点」的覆盖度；' +
  '引用精确率/召回率据此解读，忠实度与幻觉率仍是真实存在的校验（引用了图谱里不存在的 id）。'

function parseArgs(argv) {
  const opts = { field: 'question', limit: 0, dataset: '', model: '' }
  for (const arg of argv.slice(2)) {
    const [key, value = ''] = arg.replace(/^--/, '').split('=')
    if (key === 'field') opts.field = value
    else if (key === 'limit') opts.limit = Number(value) || 0
    else if (key === 'dataset') opts.dataset = value
    else if (key === 'model') opts.model = value
    else if (key === 'help' || key === '-h') opts.help = true
  }
  return opts
}

function usage() {
  console.log(`
用法：pnpm eval:record-answers [选项]

  --field=<question|questionEn|keywords>  录制的提问形式（默认 question，即中文自然语言——
                                          它是最弱的一档，也是改进实验最关心的一档）
  --limit=<N>                             每个数据集只录前 N 题（冒烟用）
  --dataset=<name>                        只录指定数据集
  --model=<name>                          覆盖 config 里的 chatModel

API Key 来源（任一即可）：${ENV_KEYS.join(' / ')}
录制产物：eval/answers/<dataset>.<model>.json —— 建议提交进仓库，之后
\`pnpm eval:answers\` 就能离线复现答案级指标。
`)
}

const opts = parseArgs(process.argv)
if (opts.help) {
  usage()
  process.exit(0)
}

const presentKeys = ENV_KEYS.filter((k) => (process.env[k] ?? '').trim())
if (presentKeys.length === 0) {
  console.log('[record] 未检测到 API Key，跳过录制（这不是失败）。')
  console.log(`[record] 可选环境变量：${ENV_KEYS.join(' / ')}`)
  console.log('[record] 配置后重跑：pnpm eval:record-answers')
  process.exit(0)
}
console.log(`[record] 使用环境变量 ${presentKeys[0]} 调用模型`)

if (!existsSync(entry)) {
  console.error(`[record] 找不到构建产物 ${entry}`)
  console.error('[record] 先跑 `pnpm build`（或 `node scripts/prepare-e2e.mjs`）再重试。')
  process.exit(1)
}

/** Load every dataset that has a repository present on this machine. */
function loadDatasets() {
  const files = readdirSync(datasetsDir).filter((f) => f.endsWith('.qa.json')).sort()
  const datasets = []
  for (const file of files) {
    const dataset = JSON.parse(readFileSync(join(datasetsDir, file), 'utf-8'))
    const repos = dataset.repos?.length
      ? dataset.repos
      : [{ name: dataset.name, projectPath: dataset.projectPath }]
    const missing = repos.filter(
      (repo) => !existsSync(join(repoRoot, repo.projectPath, '.understand-anything', 'knowledge-graph.json')),
    )
    if (missing.length > 0) {
      console.log(`[record] 跳过 ${dataset.name}：缺少仓库 ${missing.map((r) => r.name).join('、')}`)
      continue
    }
    if (opts.dataset && dataset.name !== opts.dataset) continue
    datasets.push({ dataset, repos })
  }
  return datasets
}

const datasets = loadDatasets()
if (datasets.length === 0) {
  console.error('[record] 没有可用的数据集（检查 eval/datasets 与仓库路径）')
  process.exit(1)
}

const dataDir = mkdtempSync(join(tmpdir(), 'fg-record-data-'))
const projectsRoot = mkdtempSync(join(tmpdir(), 'fg-record-projects-'))
mkdirSync(dataDir, { recursive: true })

const chatModel = opts.model || 'deepseek-v4-flash'
writeFileSync(
  join(dataDir, 'config.json'),
  JSON.stringify(
    {
      // The key itself stays in the environment so it never touches the temp config.
      llm: { baseUrl: 'https://api.deepseek.com/v1', chatModel, embedModel: '' },
      locale: 'zh-CN',
      theme: 'light',
      appearance: {
        themePreset: 'parchment',
        shellZoom: 100,
        dashboardZoom: 100,
        uiFont: 'Segoe UI',
        monoFont: 'Cascadia Code',
        uiFontSize: 14,
        monoFontSize: 13,
        sidebarWidth: 260,
      },
      projectsRoot,
      onboardingCompleted: true,
      ua: { language: 'zh', incremental: true },
    },
    null,
    2,
  ),
  'utf-8',
)

let app
let exitCode = 0
try {
  app = await electron.launch({
    args: [entry],
    cwd: repoRoot,
    env: { ...process.env, FIELDGUIDE_DATA_DIR: dataDir, NO_PROXY: '*' },
  })
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  // The renderer must have mounted React before window.fieldguide is callable.
  await page.waitForFunction(() => Boolean(window.fieldguide?.projectList), null, { timeout: 30_000 })

  mkdirSync(answersDir, { recursive: true })

  const registered = new Map() // dataset name → projectId

  for (const { dataset } of datasets) {
    const repos = dataset.repos?.length
      ? dataset.repos
      : [{ name: dataset.name, projectPath: dataset.projectPath }]
    const repo = repos[0]

    const projectId = await page.evaluate(
      async ({ projectPath, name }) => {
        // The bundled demo must go through installDemo (it copies the sample
        // project into the user's root); everything else is a local folder.
        if (projectPath === 'resources/sample-project') {
          const installed = await window.fieldguide.projectInstallDemo()
          if (!installed.ok) return { error: installed.error?.message ?? 'installDemo failed' }
          return { id: installed.data.id }
        }
        const added = await window.fieldguide.projectAddLocal(projectPath)
        if (!added.ok) {
          // Already registered from an earlier dataset in the same run.
          const list = await window.fieldguide.projectList()
          const found = (list.data ?? []).find((p) => p.root_path?.endsWith(name))
          return found ? { id: found.id } : { error: added.error?.message ?? 'addLocal failed' }
        }
        return { id: added.data.id }
      },
      { projectPath: repo.projectPath === 'resources/sample-project' ? repo.projectPath : join(repoRoot, repo.projectPath), name: repo.name },
    )

    if (!projectId?.id) {
      console.error(`[record] ${dataset.name}: 注册项目失败 → ${projectId?.error ?? 'unknown'}`)
      exitCode = 1
      continue
    }
    registered.set(dataset.name, projectId.id)

    const items = opts.limit > 0 ? dataset.items.slice(0, opts.limit) : dataset.items
    const answers = []
    let failures = 0
    let aborted = false

    await page.evaluate(() => window.fieldguide.llmResetUsage())

    for (const item of items) {
      const query = item[opts.field] ?? item.question
      const result = await page.evaluate(
        async ({ projectId, query }) => {
          const res = await window.fieldguide.chatSend(projectId, [{ role: 'user', content: query }])
          if (!res.ok) return { error: res.error?.code ?? 'unknown', message: res.error?.message ?? '' }
          const data = res.data
          return {
            content: typeof data.content === 'string' ? data.content : '',
            nodeRefs: Array.isArray(data.nodeRefs) ? data.nodeRefs : [],
          }
        },
        { projectId: projectId.id, query },
      )

      if (result.error) {
        failures += 1
        console.error(`  ✗ ${dataset.name}/${item.id}: ${result.error} ${result.message}`)
        if (result.error === 'LLM_NOT_CONFIGURED' || result.error === 'PROJECT_NOT_FOUND') {
          aborted = true
          break
        }
        continue
      }
      answers.push({
        id: item.id,
        citedNodeIds: result.nodeRefs,
        answerExcerpt: result.content.slice(0, 200),
      })
      console.log(`  ✓ ${dataset.name}/${item.id} refs=${result.nodeRefs.length}`)
    }

    const usage = await page.evaluate(async () => {
      const res = await window.fieldguide.llmUsage()
      return res.ok ? res.data : null
    })

    if (aborted) {
      console.error(`[record] ${dataset.name}: 中止（配置或项目问题），未写出录制文件`)
      exitCode = 1
      continue
    }
    if (answers.length === 0) {
      console.error(`[record] ${dataset.name}: 没有任何成功回答，未写出录制文件`)
      exitCode = 1
      continue
    }
    if (failures > 0) {
      console.warn(`[record] ${dataset.name}: ${failures} 题失败 —— 覆盖不足会被如实报告`)
    }

    // Attribute the process-wide usage counters to this dataset: they are reset
    // before each dataset, so the delta belongs to it.
    const perItem = answers.length > 0 && usage ? Math.round((usage.promptTokens ?? 0) / answers.length) : 0
    const outFile = join(answersDir, `${dataset.name}.${chatModel}.json`)
    writeFileSync(
      outFile,
      `${JSON.stringify(
        {
          dataset: dataset.name,
          model: chatModel,
          recordedAt: new Date().toISOString(),
          queryField: opts.field,
          citationSemantics: CITATION_SEMANTICS,
          usage,
          usageNote: `usage 为整个数据集的进程级累计；均摊到每题约 prompt ${perItem} tokens（同一次运行内先 reset 再累计）`,
          answers,
        },
        null,
        2,
      )}\n`,
      'utf-8',
    )
    console.log(`[record] ${dataset.name} → ${outFile}（${answers.length} 题，失败 ${failures}）`)
    console.log(`[record] token：prompt ${usage?.promptTokens ?? 0} / completion ${usage?.completionTokens ?? 0} / calls ${usage?.calls ?? 0}`)
  }
} catch (err) {
  console.error('[record] 录制失败：', err)
  exitCode = 1
} finally {
  if (app) await app.close().catch(() => { /* already gone */ })
  rmSync(dataDir, { recursive: true, force: true })
  rmSync(projectsRoot, { recursive: true, force: true })
}

console.log(exitCode === 0 ? '[record] 完成。下一步：pnpm eval:answers' : '[record] 结束但有问题（见上）。')
process.exit(exitCode)
