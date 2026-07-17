# UA 集成 Spike 记录

> 状态：**✅ 通过** — 动工门禁完成。  
> 步骤见 [understand-anything-integration.md §九](./understand-anything-integration.md) 与 [doc-index.md §5.2](./doc-index.md)。

---

## 记录

| 项 | 值 |
|----|-----|
| 日期 | 2026-06-30 |
| 执行人 | AI Agent (Reasonix) |
| UA commit / tag | `54754a6f97051d1d76c8758353d8ea41afe502a6` (fix(homepage): keep trending badge visible) |
| 依赖方式 | npm workspace `@understand-anything/core`（pnpm monorepo） |
| pipeline 入口 | `scan-project.mjs` → `compute-batches.mjs` → `extract-structure.mjs` + `GraphBuilder` / `saveGraph` |
| Dashboard 嵌入 | 静态 SPA（`index.html` + bundled JS/CSS），BrowserWindow 加载 |
| Electron 验证 | Dashboard dist 构建成功，index.html 为标准 React SPA 可加载 |
| `--language zh` 验证 | UA 支持 `zh`/`zh-TW`/`en` 等 locale 文件（`skills/understand/locales/`）；Dashboard 有 zh/zh-TW locale；结构提取不受语言参数影响（LLM 阶段才需要） |
| 结论 | **✅ 通过** |

---

## 命令与输出摘要

### 1. Clone 与测试

```bash
git clone https://github.com/Egonex-AI/Understand-Anything.git
cd Understand-Anything
pnpm install
pnpm --filter @understand-anything/core test
```

**结果**：✅ 35 test files, **753 tests passed**，0 failures

### 2. tiny-go fixture 扫描

```bash
cd understand-anything-plugin
node skills/understand/scan-project.mjs \
  D:\workspace\coding\Fieldguide\tests\fixtures\tiny-go \
  D:\workspace\coding\Fieldguide\tests\fixtures\tiny-go\scan-result.json
```

**结果**：filesScanned=4, filteredByIgnore=0, complexity=small
- 3 Go 文件 + 1 go.mod 正确识别

### 3. 批量计算 (Tree-sitter 解析)

```bash
node skills/understand/compute-batches.mjs \
  D:\workspace\coding\Fieldguide\tests\fixtures\tiny-go
```

**结果**：1 batch (4 files)，正确提取 exports：
- `handler.go`: Handler, NewHandler, Hello, ListItems
- `db.go`: Item, DB, NewDB, All

### 4. 结构提取

```bash
node skills/understand/extract-structure.mjs \
  extract-input.json extract-output.json
```

**结果**：4 files analyzed，提取出：
- functions: main, NewHandler, Hello, ListItems, NewDB, All
- classes: Handler (methods: Hello, ListItems), DB (methods: All)
- callGraph: main→NewDB, main→NewHandler, ListItems→All

### 5. Programmatic GraphBuilder → knowledge-graph.json

```bash
# （历史）曾用独立 generate 脚本验证 GraphBuilder；现以 `pnpm qa:graph` / 应用内索引为准
# node scripts/spike-generate-graph.mjs
```

**结果**：✅ 12 nodes, 14 edges，schema validate 通过

**fixture 索引输出路径**：
```
tests/fixtures/tiny-go/.understand-anything/knowledge-graph.json
```

**节点数**：12 nodes（3 file + 6 function + 2 class + 1 config）

### 6. Dashboard 构建

```bash
cd packages/dashboard
npm run build   # tsc -b && vite build
```

**结果**：✅ 构建成功（15 chunks，~2.5MB total），输出到 `dist/`：
- `index.html`（标准 React SPA，`<div id="root">`）
- `assets/` (14 JS/CSS bundles)
- `knowledge-graph.json`（sample）

---

## 已知问题

1. **无 LLM Agent 运行时**：完整 pipeline（Phase 2-7：架构分析、Tour 生成、Graph Review）需要 Claude Code 或兼容 Agent 运行时。当前 Spike 验证了 Phase 0-2（扫描 + 结构提取）的程序化调用路径，Phase 3+ 的 LLM 部分将在 Phase 2 集成时通过 UA Skill 系统调用。
2. **pnpm 版本差异**：UA 使用 pnpm v10.6.2，全局安装的是 v11.9.0，lockfile 可向上兼容。
3. **Dashboard 依赖 Google Fonts**：嵌入 Electron 时需要处理离线字体或允许网络访问。

---

## 签收

- [x] Spike 通过，可启动 roadmap Phase 1.1
- [x] UA 版本已记录（commit: `54754a6`）
- [x] 已在 doc-index.md §5.2 与 design-review.md 打勾（本记录即为打勾证据）
