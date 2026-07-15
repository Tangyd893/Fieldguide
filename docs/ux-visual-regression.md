# UX Visual Regression 验收清单

> 版本：v1.0 | 对照基准：Obsidian 工作台壳层质感  
> 用途：Phase 4 发布前人工验收 + 截图基线建立

## 截图基线目录

将验收截图保存至 `docs/screenshots/ux-baseline/`（按日期命名）：

| 文件名 | 场景 |
|--------|------|
| `01-parchment-default.png` | 默认 parchment v2，代码地图双面板 |
| `02-theme-forest.png` | 设置切换 forest 预设 |
| `03-theme-midnight.png` | midnight 暗色预设 |
| `04-zoom-80.png` | 缩放 80% |
| `05-zoom-120.png` | 缩放 120% |
| `06-dual-panel-files.png` | 双面板打开不同文件 |
| `07-index-progress.png` | 索引进度条（状态栏） |
| `08-graph-skeleton.png` | 图谱 iframe 加载骨架 |
| `09-command-palette.png` | Ctrl+K / 顶栏搜索命令面板 |
| `10-settings-appearance.png` | 设置 → 外观 |
| `11-project-library.png` | 项目库列表 |
| `12-theory-tab.png` | 理论 Tab |
| `13-filetree-context.png` | 文件树右键菜单 |

## 验收清单

### 主题与外观

- [ ] 默认启动为 **parchment v2**（`#FDFCF8` 纯色背景，无网格）
- [ ] 打开设置/关于/命令面板时遮罩足够深（`--fg-modal-scrim`），背后主界面不可读
- [ ] 5 套预设均可切换且顶栏/侧栏/面板/状态栏同步变色
- [ ] 亮/暗模式与预设组合无文字不可读
- [ ] 缩放 80% / 100% / 120% 布局不破、代码行号对齐
- [ ] UI 字体与代码字体分开生效

### 代码地图壳层

- [ ] 侧栏宽度拖拽 160–400px，重启后保持
- [ ] 双面板默认左代码右图谱，布局持久化
- [ ] 文件 Tab 多开、悬停关闭、中键关闭
- [ ] 分隔条拖拽手感顺畅，双击恢复 50/50
- [ ] 活动面板有 accent 描边提示

### 图谱区（Dashboard iframe）

- [ ] iframe 加载时显示骨架屏
- [ ] 主题切换后 Dashboard 背景/强调色与壳层一致
- [ ] 索引完成后 iframe 自动刷新

### 交互

- [ ] 顶栏搜索按钮打开命令面板（等同 Ctrl+K）
- [ ] 文件树右键：打开 / 复制路径 / 资源管理器
- [ ] 命令面板键盘导航（↑↓ Enter Esc）
- [ ] 主题/Tab 切换有 150–200ms 过渡动画

### 次级视图（无色块突兀）

- [ ] ChatPanel / TourPanel 在 parchment v2 下无白底残留
- [ ] ProjectLibrary 卡片与弹窗使用 token 色
- [ ] Theory / Bridge / Onboarding 弹窗主题一致

### 安装包（p4-release 交叉项）

- [ ] `pnpm dist` 产出 NSIS 安装包
- [ ] 干净 Win10/11 机器可安装并启动
- [ ] 首次引导 → Demo 项目 → 代码地图全流程

## 自动化辅助

```bash
pnpm typecheck && pnpm test:unit && pnpm qa:baseline
```

主题 token 一致性可由 `src/renderer/theme/__tests__/theme-tokens.test.ts` 校验 `--fg-*` 变量在 presets 中均已定义。

### 已自动化（2026-07-13）

- [x] typecheck 三份 tsconfig
- [x] vitest 单元 + 集成（graph-reader fixture、agent、IPC handlers）
- [x] tiny-go / sample-project 图谱 fixture 存在
- [x] GitHub Actions CI（`.github/workflows/ci.yml`）

## 验收记录

| 日期 | 验收人 | 结果 | 备注 |
|------|--------|------|------|
| | | ⬜ 待验收 | |
