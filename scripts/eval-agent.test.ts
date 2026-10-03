/**
 * Run the coach evaluation harness across every dataset and write the report (C1 + C2).
 *
 *   pnpm eval:agent
 *
 * Offline by design: retrieval and graph navigation are local, so this produces
 * real numbers without an API key. Datasets whose repositories are not present on
 * this machine (e.g. the external HIS-Go checkout) are reported as skipped rather
 * than silently dropped, so a report can never look better than the coverage it had.
 *
 * Why a `.test.ts` under scripts/: it needs the electron mock and vitest's TS
 * pipeline to import main-process modules (see scripts/vitest.tools.config.ts).
 */
import { describe, it, expect, vi } from 'vitest'
import { writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => process.cwd(),
    getPath: () => process.env.TEMP || process.cwd(),
  },
}))

import { loadDataset, missingRepos, runEvaluation, type EvalReport } from '../src/main/eval/harness'
import { ZH_TERM_MAP } from '../src/main/ua/lexical'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const datasetsDir = join(repoRoot, 'eval', 'datasets')
const outDir = join(repoRoot, 'docs', 'eval')

/** Pull one metric out of a variant, for the assertions below. */
function metric(report: EvalReport, label: string, metricName: string): number {
  const variant = report.variants.find((v) => v.label === label)
  if (!variant) throw new Error(`variant not found: ${label}`)
  return variant.rows.find((r) => r.label === metricName)?.value ?? 0
}

const pct = (report: EvalReport, label: string, metricName = 'Recall@5') =>
  (metric(report, label, metricName) * 100).toFixed(1)

describe('agent evaluation harness', () => {
  it('runs every dataset, verifies the invariants, and writes a combined report', async () => {
    const files = readdirSync(datasetsDir).filter((f) => f.endsWith('.qa.json')).sort()
    expect(files.length).toBeGreaterThanOrEqual(2)

    const ran: Array<{ file: string; report: EvalReport }> = []
    const skipped: Array<{ file: string; missing: string[] }> = []

    for (const file of files) {
      const dataset = loadDataset(join(datasetsDir, file))
      const missing = missingRepos(dataset, repoRoot)
      if (missing.length > 0) {
        skipped.push({ file, missing })
        console.log(`[eval] skipped ${dataset.name}: missing repo(s) ${missing.join(', ')}`)
        continue
      }

      const report = await runEvaluation(dataset, repoRoot, { ks: [5, 10] })
      ran.push({ file, report })

      // ── invariants that must hold for every dataset ──────────────────────────
      // 1. Every variant scored every item (a crash would surface as an error row).
      for (const variant of report.variants) {
        const scored = variant.results.filter((r) => !r.error)
        expect(scored.length, `${dataset.name} · ${variant.label} produced errors`).toBe(dataset.items.length)
      }
      // 2. No retrieval must score 0; real retrieval must beat it.
      for (const queryField of report.variants.filter((v) => v.k === 5).map((v) => v.queryLabel)) {
        expect(
          metric(report, `无检索（基线） / ${queryField} @5`, 'Recall@5'),
          `${dataset.name} · baseline must be 0`,
        ).toBe(0)
        expect(
          metric(report, `语义 + 邻居扩展 / ${queryField} @5`, 'Recall@5'),
          `${dataset.name} · retrieval must beat the baseline`,
        ).toBeGreaterThan(0)
      }
      // 3. Path questions must be solvable — a broken graph reader shows up here.
      const pathRows = report.variants[0].rows.filter((r) => r.label.startsWith('路径'))
      expect(pathRows.length, `${dataset.name} has no path metrics`).toBeGreaterThan(0)
      for (const row of pathRows) expect(row.value, `${dataset.name} · ${row.label}`).toBeGreaterThan(0.5)
    }

    expect(ran.length).toBeGreaterThan(0)

    // ── headline findings on the primary dataset (pulsegate) ──────────────────
    const primary = ran.find((r) => r.report.dataset === 'pulsegate') ?? ran[0]
    const report = primary.report

    const zh = metric(report, '语义 + 邻居扩展 / 中文自然语言 @5', 'Recall@5')
    const kw = metric(report, '语义 + 邻居扩展 / 关键词 @5', 'Recall@5')
    expect(kw).toBeGreaterThan(zh)

    const semanticKw = metric(report, '语义检索 / 关键词 @5', 'Recall@5')
    const substringKw = metric(report, '子串匹配 / 关键词 @5', 'Recall@5')
    expect(semanticKw).toBeGreaterThan(substringKw)

    // Neighbour expansion is included in the grid, but this benchmark is the
    // honest place to record that it does NOT improve retrieval recall here:
    // semantic search already returns several nodes per file, so the 1-hop
    // neighbours are mostly redundant. It is kept because it feeds the context
    // packer (connections for the LLM), which retrieval recall cannot measure.
    const plain5 = metric(report, '语义检索 / 关键词 @5', 'Recall@5')
    const expand5 = metric(report, '语义 + 邻居扩展 / 关键词 @5', 'Recall@5')
    const plain10 = metric(report, '语义检索 / 关键词 @10', 'Recall@10')
    const expand10 = metric(report, '语义 + 邻居扩展 / 关键词 @10', 'Recall@10')
    expect(expand5).toBe(plain5)
    expect(expand10).toBe(plain10)

    // ── the improvement (W2): each mechanism's contribution, asserted so CI
    //    fails if the gain regresses. Numbers live in the report, not here. ─────
    const imp = {
      pulseZhSemantic: metric(report, '语义检索 / 中文自然语言 @5', 'Recall@5'),
      pulseZhLexical: metric(report, '词法 BM25（CJK 分词） / 中文自然语言 @5', 'Recall@5'),
      pulseZhTerms: metric(report, '词法 BM25 + 术语映射 / 中文自然语言 @5', 'Recall@5'),
      pulseZhHybrid: metric(report, '混合（语义 ⊕ 词法 RRF） / 中文自然语言 @5', 'Recall@5'),
      pulseKwSemantic: metric(report, '语义检索 / 关键词 @5', 'Recall@5'),
      pulseKwHybrid: metric(report, '混合（语义 ⊕ 词法 RRF） / 关键词 @5', 'Recall@5'),
      pulseEnSemantic: metric(report, '语义检索 / 英文自然语言 @5', 'Recall@5'),
      pulseEnHybrid: metric(report, '混合（语义 ⊕ 词法 RRF） / 英文自然语言 @5', 'Recall@5'),
    }
    // The stated target: Chinese natural language must clear 40% on the
    // English-indexed repo, and the keyword surface must not regress.
    expect(imp.pulseZhHybrid, '中文自然语言 Recall@5 目标未达成（应 ≥40%）').toBeGreaterThanOrEqual(0.4)
    expect(imp.pulseKwHybrid, '关键词档不得低于纯语义').toBeGreaterThanOrEqual(imp.pulseKwSemantic)
    expect(imp.pulseEnHybrid, '英文自然语言应优于纯语义').toBeGreaterThan(imp.pulseEnSemantic)
    // Mechanism 1: bilingual term expansion is what bridges zh → English index.
    expect(imp.pulseZhTerms, '术语映射必须优于纯词法（否则映射没起作用）').toBeGreaterThan(imp.pulseZhLexical)
    // Mechanism 2: CJK bigrams are what make a Chinese-indexed repo searchable.
    const tinyReport = ran.map(({ report: r }) => r).find((r) => r.dataset !== report.dataset)
    const tinyZhLexical = tinyReport
      ? metric(tinyReport, '词法 BM25（CJK 分词） / 中文自然语言 @5', 'Recall@5')
      : 0
    const tinyZhSemantic = tinyReport ? metric(tinyReport, '语义检索 / 中文自然语言 @5', 'Recall@5') : 0
    if (tinyReport) {
      expect(tinyZhLexical, 'CJK 分词必须优于语义引擎（中文索引仓库）').toBeGreaterThan(tinyZhSemantic)
    }

    // ── the language contrast: same code, index language differs ──────────────
    const contrast = ran
      .map(({ report: r }) => ({
        name: r.dataset,
        zh: metric(r, '语义检索 / 中文自然语言 @5', 'Recall@5'),
        en: metric(r, '语义检索 / 英文自然语言 @5', 'Recall@5'),
        kw: metric(r, '语义检索 / 关键词 @5', 'Recall@5'),
      }))
      .filter((c) => c.kw > 0)

    const contrastAfterRows = ran.map(({ report: r }) => {
      const zhBefore = metric(r, '语义检索 / 中文自然语言 @5', 'Recall@5')
      const zhAfter = metric(r, '混合（语义 ⊕ 词法 RRF） / 中文自然语言 @5', 'Recall@5')
      return `| ${r.dataset} | ${(zhBefore * 100).toFixed(1)}% | ${(zhAfter * 100).toFixed(1)}% | ${((zhAfter - zhBefore) * 100 >= 0 ? '+' : '')}${((zhAfter - zhBefore) * 100).toFixed(1)} pp |`
    })

    mkdirSync(outDir, { recursive: true })

    const summaryRows = ran.flatMap(({ report: r }) =>
      r.variants
        .filter((v) => v.label.includes('@5'))
        .map((v) => {
          const recall = v.rows.find((row) => row.label === 'Recall@5')?.value ?? 0
          const mrr = v.rows.find((row) => row.label === 'MRR')?.value ?? 0
          return `| ${r.dataset} | ${v.label.replace(' @5', '')} | ${(recall * 100).toFixed(1)}% | ${mrr.toFixed(3)} |`
        }),
    )

    const coverageRows = ran.map(({ report: r }) => {
      const repos = r.repos.map((repo) => `${repo.name}(${repo.nodes}节点/${repo.items}题)`).join('+')
      return `| ${r.dataset} | ${repos} | ${r.variants.length} | ${r.graphNodes} / ${r.graphEdges} | 已运行 |`
    })
    const skippedRows = skipped.map(({ file, missing }) => `| ${file} | — | — | — | 跳过（缺 ${missing.join('、')}） |`)

    const contrastRows = contrast.map(
      (c) => `| ${c.name} | ${(c.zh * 100).toFixed(1)}% | ${(c.en * 100).toFixed(1)}% | ${(c.kw * 100).toFixed(1)}% |`,
    )

    // ── neighbour expansion: measured per dataset instead of asserted globally ──
    // It was a clean negative result on pulsegate; tiny-go shows it is not a
    // universal one, so the report has to state where it helps and where it does not.
    const neighbourRows: string[] = []
    const neighbourSummary: string[] = []
    for (const { report: r } of ran) {
      const fields = [...new Set(r.variants.filter((v) => v.k === 5).map((v) => v.queryLabel))]
      for (const field of fields) {
        const plain = metric(r, `语义检索 / ${field} @5`, 'Recall@5')
        const expanded = metric(r, `语义 + 邻居扩展 / ${field} @5`, 'Recall@5')
        const delta = (expanded - plain) * 100
        neighbourRows.push(
          `| ${r.dataset} | ${field} | ${(plain * 100).toFixed(1)}% | ${(expanded * 100).toFixed(1)}% | ${delta >= 0 ? '+' : ''}${delta.toFixed(1)} pp |`,
        )
        neighbourSummary.push(`${r.dataset}·${field} ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}pp`)
      }
    }

    const header = [
      '# Agent 评测基准（C1）与消融实验（C2）',
      '',
      '> 由 `pnpm eval:agent` 生成。**离线运行**（检索与图导航全本地，不需要 API Key），因此结果可复现。',
      '> 指标定义见 `src/main/eval/metrics.ts`；数据集目录：`eval/datasets/*.qa.json`。',
      '',
      '## 数据集覆盖',
      '',
      '| 数据集 | 覆盖仓库 | 变体数 | 节点 / 边 | 状态 |',
      '|--------|----------|--------|-----------|------|',
      ...coverageRows,
      ...skippedRows,
      '',
      '## 结果速览（Recall@5 / MRR）',
      '',
      '| 数据集 | 变体 | Recall@5 | MRR |',
      '|--------|------|----------|-----|',
      ...summaryRows,
      '',
      '## 提问语言 × 索引语言 对照（纯语义检索 @5，改进前）',
      '',
      '| 数据集 | 中文自然语言 | 英文自然语言 | 关键词 |',
      '|--------|--------------|--------------|--------|',
      ...contrastRows,
      '',
      '## 改进效果：中文自然语言（纯语义 → 混合检索 @5）',
      '',
      '| 数据集 | 改进前（语义） | 改进后（混合） | 差值 |',
      '|--------|----------------|----------------|------|',
      ...contrastAfterRows,
      '',
      '### 两个机制各自的贡献（消融）',
      '',
      `- **CJK 字符二元分词**：中文没有空格，「整句 = 一个词」的假设让词法通道对中文完全失效。分词后，中文索引仓库 ${tinyReport?.dataset ?? '对照仓库'} 的中文档达 **${(tinyZhLexical * 100).toFixed(1)}%**（纯语义 ${(tinyZhSemantic * 100).toFixed(1)}%）。`,
      `- **中英术语映射（${Object.keys(ZH_TERM_MAP).length} 条，人工维护）**：中文提问里的概念（入口 / 缓存 / 背压）与索引里的英文标识符、英文摘要之间存在词汇鸿沟。映射把中文查询扩成英文候选词（权重 0.5，低于查询自身的词），把中文档从 ${pct(report, '词法 BM25（CJK 分词） / 中文自然语言 @5')}% 提到 **${pct(report, '词法 BM25 + 术语映射 / 中文自然语言 @5')}%**。`,
      `- **RRF 融合**：两通道分数不可比（BM25 与语义引擎刻度不同），因此按**名次**融合而不是调分。混合在三档上都不差，关键词档 ${pct(report, '混合（语义 ⊕ 词法 RRF） / 关键词 @5')}% 不低于纯语义的 ${pct(report, '语义检索 / 关键词 @5')}%。`,
      '',
      '## 邻居扩展的增益（按数据集拆开看）',
      '',
      '| 数据集 | 提问形式 | 语义检索 | 语义 + 邻居扩展 | 差值 |',
      '|--------|----------|----------|------------------|------|',
      ...neighbourRows,
      '',
      '## 结论（由本次运行自动生成）',
      '',
      `1. **检索是决定性的**：无检索基线为 0%，加检索后关键词提问达 ${pct(report, '混合（语义 ⊕ 词法 RRF） / 关键词 @5')}%（中文自然语言 ${pct(report, '混合（语义 ⊕ 词法 RRF） / 中文自然语言 @5')}%）。`,
      `2. **语言敏感性被定位，并在检索层修复**：纯语义引擎在英文索引仓库上对中文提问只有 ${(imp.pulseZhSemantic * 100).toFixed(1)}%，而关键词提问有 ${(imp.pulseKwSemantic * 100).toFixed(1)}% —— 同一套代码，差别只在提问语言。加入「CJK 分词 + 术语映射 + RRF 融合」后中文档升到 **${(imp.pulseZhHybrid * 100).toFixed(1)}%**（+${((imp.pulseZhHybrid - imp.pulseZhSemantic) * 100).toFixed(1)} 个百分点），关键词档 ${(imp.pulseKwHybrid * 100).toFixed(1)}% 不退化。这说明它不是模型能力问题，而是**检索引擎的分词与词汇表问题**。`,
      `3. **语义引擎优于子串**：关键词提问下 ${pct(report, '语义检索 / 关键词 @5')}% vs ${pct(report, '子串匹配 / 关键词 @5')}%，说明接 UA SearchEngine 的收益是可测的（降级到子串会损失约 ${(Number(pct(report, '语义检索 / 关键词 @5')) - Number(pct(report, '子串匹配 / 关键词 @5'))).toFixed(1)} 个百分点）。`,
      `4. **邻居扩展的增益取决于数据集，不能一概而论**：pulsegate 上它相对纯语义是 0 增益（语义检索已召回同一文件多个节点，1-hop 多为冗余）；tiny-go 上它是有增益的。逐档差值见上表（${neighbourSummary.join('，')}）。这修正了「邻居扩展无用」这个过于笼统的说法：它的作用依赖图规模与索引语言，而它真正的价值是给模型提供连接关系（答案级收益，检索召回测不到）。`,
      `5. **路径可达率**：pulsegate 的 4 道路径题跳数与源码 import 结构一致；tiny-go 的 3 道路径题依赖 Go 包路径导入解析产生的跨文件边（fixture 由图谱流水线离线再生成，边数 9 → 12）。`,
      `6. **残留问题（如实记录）**：中文档仍低于英文/关键词档，瓶颈是术语映射的覆盖率（当前 ${Object.keys(ZH_TERM_MAP).length} 条，人工维护）。把映射换成自动化（从仓库标识符与注释挖掘，或用 LLM 做查询改写并录制回放）是下一阶段工作；评估脚本已预留 \`lexical+terms\` 一档用于对比。`,
      '',
      '> 引用类指标（忠实度 / 精确率 / 召回率 / 幻觉率）需要真实模型回答：先跑 `pnpm eval:record-answers` 录制，',
      '> 再跑 `pnpm eval:answers` 离线评分，结果写入 `docs/eval/agent-answers.md`。',
      '',
    ].join('\n')

    const body = ran.map(({ report: r }) => r.markdown).join('\n---\n\n')
    const outPath = join(outDir, 'agent-baseline.md')
    writeFileSync(outPath, `${header}\n${body}\n`, 'utf-8')

    console.log(`\n[eval] report → ${outPath}`)
    console.log(`[eval] datasets: ${ran.length} ran, ${skipped.length} skipped, ${ran.reduce((n, r) => n + r.report.variants.length, 0)} variants`)
    for (const { report: r } of ran) {
      console.log(`  ${r.dataset.padEnd(12)} ${r.repos.map((repo) => `${repo.name}:${repo.nodes}n/${repo.items}q`).join(' ')}`)
      for (const v of r.variants.filter((x) => x.k === 5)) {
        const recall = v.rows.find((row) => row.label === 'Recall@5')?.value ?? 0
        console.log(`    ${v.label.padEnd(38)} Recall@5=${(recall * 100).toFixed(1)}%`)
      }
    }
  }, 300_000)
})
