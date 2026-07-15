# Phase 4 发布验收清单（p4-release）

> 版本：v1.0 | 目标：干净机器可安装、场景 A/B 用户路径可完成

## 构建

```bash
pnpm install
pnpm typecheck
pnpm test:unit
pnpm qa:baseline
pnpm dist
```

产出：`dist/Fieldguide Setup x.y.z.exe`

> **自动化基线**（2026-07-13）：`pnpm qa:baseline` 覆盖 typecheck + unit tests + fixture 存在性。干净机器安装仍需人工勾选。

## 干净机器安装（Win10/11）

- [ ] 在无 Node/pnpm 环境的机器上运行安装包
- [ ] 安装目录可自定义（NSIS `allowToChangeInstallationDirectory`）
- [ ] 桌面/开始菜单快捷方式可启动
- [ ] 首次启动显示 Onboarding 向导
- [ ] 选择「内置 Demo」→ 索引完成 → 代码地图可见图谱

## 场景 A：读懂新项目（30 分钟自测）

- [ ] 添加本地文件夹或 Git clone
- [ ] 索引完成，节点数 > 0
- [ ] 跟随 Tour 完成至少一条路径
- [ ] Ctrl+K 搜索文件/节点可跳转
- [ ] 能说出入口、核心模块、主数据流（人工记录）

## 场景 B：论文 ↔ 实现对照

- [ ] 理论 Tab 搜索 arXiv 并下载 PDF
- [ ] PDF 阅读器可选中段落
- [ ] 概念桥接关联论文段落与代码节点
- [ ] 生成对照 Tour 并在 Dashboard 播放

## 回归项

- [x] `pnpm typecheck` 通过（自动化）
- [x] `pnpm test:unit` 通过（自动化）
- [x] `pnpm qa:baseline` 通过（自动化）
- [ ] 完成 [ux-visual-regression.md](./ux-visual-regression.md) 全部勾选
- [ ] 完成 [scenario-abc-test-record.md](./scenario-abc-test-record.md) 人工部分
- [ ] LLM Key 跳过时结构图仍可浏览
- [ ] 三语切换（简中/繁中/en-US）主要界面无硬编码中文漏网

## 验收记录

| 日期 | 环境 | 结果 | 备注 |
|------|------|------|------|
| 2026-07-13 | 开发机 | ✅ 自动化基线 | `pnpm qa:baseline` + `pnpm qa:scenario` 通过 |
| | Win11 干净 VM | ⬜ 待验收 | 需人工安装 NSIS 包 |
