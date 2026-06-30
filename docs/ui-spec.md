# Fieldguide 界面与交互规格

> 版本：v0.3 | 状态：设计定稿（Phase 0，已纳入 Understand-Anything 集成）

---

## 一、设计目标

参考 EasyIdea 类「代码地图」产品的易用性：**打开即懂、点即深入、Tour 即路径**。

**代码地图中央区域**：嵌入 **[Understand-Anything Dashboard](https://github.com/Egonex-AI/Understand-Anything)**（Phase 1），图谱交互、Tour、节点详情、源码预览由 UA 提供。Fieldguide 负责顶栏、左栏（Tour 列表叠加）、右栏（Phase 2 聊天）与理论/桥接 Tab。

详见 [understand-anything-integration.md](./understand-anything-integration.md) §4.3。

---

## 二、窗口与布局

### 2.1 窗口

| 属性 | 值 |
|------|-----|
| 最小尺寸 | 1280 × 800 |
| 默认尺寸 | 1440 × 900 |
| 可调整 | 是 |
| 全屏 | 支持（F11） |
| 多窗口 | Phase 1 不支持；Phase 4 评估「地图 detach」 |

### 2.2 全局结构

```
┌──────────────────────────────────────────────────────────────────────────┐
│  [Logo Fieldguide]  项目库 │ 代码地图 │ 理论 │ 桥接     🔍 搜索   ⚙ 设置   │  ← 顶栏 48px
├──────────────┬───────────────────────────────────────────┬───────────────┤
│   左栏       │     【 UA Dashboard 嵌入 — 图谱 / Tour / 节点详情 】  │   右栏         │
│   240px      │              flex-1                         │   320px       │
│   可收窄     │                                             │   可折叠      │
│              │                                             │               │
├──────────────┴───────────────────────────────────────────┴───────────────┤
│  状态栏：索引状态 · 节点数 · Tour 进度 · 当前项目名                           │  ← 24px
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.3 顶栏

- **Logo + 产品名**：点击回到项目库
- **主导航 Tab**：项目库 | 代码地图 | 理论 | 桥接（当前 Tab 下划线高亮）
- **全局搜索（⌘K / Ctrl+K）**：命令面板（重新索引、切换项目、打开设置）；**代码语义搜索在 Dashboard 内完成**；跨项目跳转通过项目库 + `graph:search`（包装 UA，Phase 2）
- **设置**：API Key、语言、主题、关于

**规则**：未选中项目时，「代码地图 / 桥接」Tab 禁用并 tooltip「请先添加项目」。

### 2.4 首次启动引导

首次打开且 `onboardingCompleted !== true` 时，全屏 wizard 覆盖主界面。完整流程见 [onboarding-spec.md](./onboarding-spec.md)。

```
┌─────────────────────────────────────────────────────────────┐
│                    [半透明遮罩 #00000040]                      │
│         ┌─────────────────────────────────────┐             │
│         │  ● ○ ○ ○   Step 2 / 4               │             │
│         │                                     │             │
│         │  选择界面语言                         │             │
│         │  ○ 简体中文  ● 繁體中文  ○ English    │             │
│         │                                     │             │
│         │         [ 上一步 ]  [ 下一步 ]        │             │
│         └─────────────────────────────────────┘             │
│                      480px 居中卡片                           │
└─────────────────────────────────────────────────────────────┘
```

- 步骤：欢迎 → 语言 → 项目根目录 → 如何开始（Demo / 本地 / 稍后）
- 无关闭按钮；Esc 无效
- 语言选择即时切换 wizard 文案

---

## 三、视图规格

### 3.1 项目库

**空状态**（居中）：
- 插图 + 「添加你的第一个项目」
- 主按钮：「选择本地文件夹」
- 次按钮：「从 Git URL 克隆」

**列表项**（卡片或表格）：
- 项目名、主语言 badge、框架 tag
- 索引状态：就绪 / 索引中（进度环）/ 失败（可重试）/ **源码已变更**（橙色小圆点 + tooltip「自 {indexed_at} 起源码有更新，建议重新索引」）
- 元信息：节点数、最后索引时间、`root_path` 摘要（hover 显示完整路径）
- 操作：打开地图 · 重新索引 · 删除

**添加 Git 对话框**：
- URL 输入、分支（可选）、浅克隆 checkbox
- **目标目录**：默认 `{projectsRoot}/{slug}/`，显示「更改目录」链接触发资源管理器
- 若未设置 `projectsRoot`：每次必须选择目录
- 克隆进度条

---

### 3.2 代码地图（核心）

> **实现来源**：中央画布、节点详情、Tour 播放、层着色、LOD、源码预览、代码内聊天 — 均由 **UA Dashboard** 提供（嵌入）。本节描述 **Fieldguide 壳层** 与 Dashboard 的分工及联动；自研 `@xyflow/react` / Monaco 画布 **不在范围内**。详见 [understand-anything-integration.md](./understand-anything-integration.md) §4.3。

#### 布局分工

| 区域 | Fieldguide 壳层 | UA Dashboard（嵌入中央 + 可选占满中右区） |
|------|----------------|-------------------------------------------|
| 左栏 240px | 项目内 Tour 快捷列表（与 Dashboard 同步）、重新索引入口 | 图例/筛选以 Dashboard 为准，壳层不重复造控件 |
| 中央 flex-1 | 容器 + `postMessage`/IPC 桥 | 图谱、Tour 模式、节点详情、源码、代码问答 |
| 右栏 320px | Phase 2：跨论文+桥接的统一 Agent；Phase 1 可折叠隐藏 | Dashboard 内置详情/聊天优先 |

**Phase 1 最小可行**：中央嵌入 Dashboard 占满「左栏右侧」区域；Fieldguide 左栏仅保留 Tour 列表与「重新索引」；右栏可折叠。

#### 左栏（Fieldguide）

- **Tour 快捷列表**：读取 `knowledge-graph.json` 中的 `tours[]`；点击通过 IPC/postMessage 通知 Dashboard 进入对应 Tour
- **索引操作**：「重新索引」「增量更新」按钮（调用 `project:index`）
- **源码已变更**：badge 与 tooltip（见 §3.1）

#### 中央（UA Dashboard — 行为以 UA 为准）

以下能力 **不由 Fieldguide 规格重复定义**，实现与交互跟随 UA Dashboard 版本：

- 分层 / 力导向 / 业务域视图切换
- 缩放、平移、LOD、节点选中、邻居展开
- 节点摘要、源码预览、上下游关系
- Tour 控制条与步骤高亮
- Dashboard 内代码搜索与 `/understand-chat` 等价问答

Fieldguide 仅保证：嵌入后可用、主题 Phase 2 尽量统一、选中节点 id 可同步给桥接/右栏 Agent。

#### 右栏（Fieldguide — Phase 2 起）

**Tab：桥接助手 | 全局上下文**（默认桥接助手；纯代码问题引导用户使用 Dashboard 内问答）

- **桥接助手**（Phase 3 完整）：跨论文 + 代码节点的 ReAct，工具含 `query_paper`、`link_concept`
- **ThoughtChain** 折叠卡片（与 product-spec §4.5 一致）
- 显示 context 标签：`📍 nodeId` · `📄 paperChunk`

> Dashboard 内已有代码问答时，右栏 **不重复** 实现纯代码 ReAct，避免双聊天入口。

#### Tour 模式

- **主体验**：在 UA Dashboard 内播放（步骤条、高亮、讲解）
- **壳层联动**：左栏 Tour 列表、状态栏「Tour 3/8」、完成后「打开桥接」引导（Phase 3）

---

### 3.3 理论学习

**布局**：左论文列表 | 中阅读区 | 右笔记/聊天

**论文列表**：
- Tab：收藏 | arXiv 搜索
- arXiv 搜索：关键词 → 结果列表 → 收藏 / 打开摘要

**阅读区**：
- PDF 分页渲染（pdf.js）
- 文本选择 → 高亮 / 添加笔记
- 高亮右键：「关联到代码节点」（跳转桥接）

**右侧**：
- 笔记列表（关联页码）
- 针对本文的 AI 问答

---

### 3.4 概念桥接

**布局**：左右分屏 + 底部 Tour 预览

- **左**：论文段落列表（高亮 + 笔记）
- **右**：UA 节点搜索（`graph:search` 包装 UA）或节点 id 列表；非自研缩小版图谱
- **操作**：拖拽关联 / 「AI 推荐关联」
- **底部**：已有关联列表 + 「生成对照 Tour」

**空状态**：「从理论学习中选择段落，或在代码地图中选择节点开始关联」

---

### 3.5 设置

| 分组 | 项 |
|------|-----|
| LLM | Base URL、API Key（密码框）、Chat Model、Embed Model、测试连接 |
| 通用 | **界面语言**（简体中文 / 繁體中文 / English (US)，默认简中，即时切换无需重启）、主题（系统/浅/深） |
| 项目 | **项目根目录**（Git clone 与 Demo 默认父路径；「选择目录」按钮） |
| 索引 | 默认忽略规则、并行度、浅克隆默认 |
| 数据 | 打开数据目录、清除缓存、导出图谱 |
| 关于 | 版本、文档链接 |

### 3.6 LLM 成本透明（Phase 2+）

触发「深度分析」或首次含 Analyze 阶段的索引时，显示确认对话框：

```
┌─────────────────────────────────────────┐
│  即将进行 LLM 分析                        │
│  约 847 个文件，预估 ~120k tokens         │
│  ☐ 仅静态索引（跳过摘要与 Tour）          │
│              [ 取消 ]  [ 继续 ]           │
└─────────────────────────────────────────┘
```

- 索引进行中可在状态栏点击「取消 Analyze」保留静态结果
- 设置页展示累计 token 估算（可选，Phase 2）

---

## 四、组件规范

### 4.1 ThoughtChain（思考链）

复用理念：每步 ReAct 可折叠

```
▸ Thought    我需要先找到 HTTP 入口...
▸ Action     search_code({ query: "main listen" })
▸ Observation  找到 gateway/main.go ...
▸ Answer     （最终回答区域）
```

- 索引中：Action 显示 `index_project` 进度
- 错误步：红色左边框

### 4.2 索引进度

- 非阻塞：用户可浏览其他 Tab，状态栏显示进度
- 进度事件：`index:progress`（包装 UA pipeline 回调）
- 阶段文案 **以 UA 为准**，Fieldguide 做本地化映射，示例：

| UA 阶段（示意） | 状态栏文案示例 |
|----------------|----------------|
| scan | `正在扫描文件… (1243 files)` |
| parse / file-analyzer | `正在解析源码… (45%)` |
| analyze / architecture | `正在分析架构…` |
| tour-builder | `正在生成导览…` |
| review | `正在校验图谱…` |

- 模态进度：首次添加项目时可选详细阶段条
- **不含** Fieldguide 自研「Embed」阶段（代码向量由 UA 负责）

### 4.3 命令面板（Ctrl+K）

Fieldguide 壳层命令（Phase 1）：
- 切换项目、重新索引、打开设置、切换主题

委托 UA / `graph-reader`（Phase 2）：
- 跳转节点、开始 Tour（通知 Dashboard）

---

## 五、视觉规范

### 5.1 主题

**浅色（默认）**：
- 背景 `#FAFAFA`
- 卡片 `#FFFFFF`
- 边框 `#E5E7EB`
- 文字 primary `#111827` / secondary `#6B7280`

**深色**：
- 背景 `#0F172A`
- 卡片 `#1E293B`
- 边框 `#334155`
- 文字 primary `#F8FAFC` / secondary `#94A3B8`

### 5.2 字体

- UI：`Segoe UI`, system-ui, sans-serif（Windows 原生感）
- 代码：`Cascadia Code`, `Consolas`, monospace
- 字号：正文 14px，标题 16–20px，代码 13px

### 5.3 图谱节点

| 类型 | 形状 | 大小 |
|------|------|------|
| file | 圆角矩形 | 120×40 |
| function | 椭圆 | 100×36 |
| class | 六边形 | 110×44 |
| package | 大圆角矩形 | 140×48 |

选中：2px 主色描边 + 阴影  
Tour 当前：脉冲动画（CSS `@keyframes pulse`）

### 5.4 边

- `imports`：实线，箭头，`#94A3B8`
- `calls`（高置信）：虚线，箭头
- `calls`（低置信，静态推断）：虚线，箭头，`#CBD5E1`，图例标注「低置信调用（静态推断，非运行时）」
- `contains`：细实线，无箭头
- Tour / 路径高亮：`#3B82F6`

---

## 六、动效

| 场景 | 动效 | 时长 |
|------|------|------|
| Tab 切换 | 淡入 | 150ms |
| 节点选中 | 描边过渡 | 200ms |
| Tour 步骤切换 | pan + zoom 至节点 | 400ms ease |
| 右栏折叠 | 宽度过渡 | 200ms |
| 索引进度 |  indeterminate bar | — |

避免：大面积 parallax、 gratuitous 粒子效果。

---

## 七、无障碍（基础）

- 键盘：Tab 导航顶栏；Esc 关闭对话框；Tour 用 ←/→
- 对比度：WCAG AA 级（正文与背景）
- 图谱：选中节点同步 focus 到右栏详情（screen reader 读 label + summary）

---

## 八、错误与空状态文案

| 场景 | 文案 |
|------|------|
| 索引失败 | 「索引未完成：{reason}。你可以重试或仅查看结构图谱。」 |
| 无 API Key | 「请先在设置中配置 LLM API Key，以生成摘要与 Tour。」 |
| 图谱过大 | 「项目较大，已折叠为目录视图。双击目录展开。」 |
| 源码已变更 | 「源码自上次索引后有更新。重新索引以获取最新图谱。」 |
| Git clone 失败 | 「克隆失败：{reason}。请检查网络或更换目录后重试。」 |
| LLM 限流 | 「API 请求过于频繁，已自动降速。预计还需 N 分钟。」 |

语气：冷静、可操作，不 blame 用户。

---

## 九、Phase 与 UI 交付对应

| Phase | UI 交付 |
|-------|---------|
| 1 | 首次引导 wizard、i18n 三语 shell、项目库 + 静态图谱 + 节点详情（无 summary） |
| 2 | summary、Tour、聊天、语义搜索、LLM 成本对话框 |
| 3 | 理论 Tab、桥接 Tab |
| 4 | diff overlay、文案 polish、安装包图标与品牌 |
