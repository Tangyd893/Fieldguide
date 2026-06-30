# Fieldguide



**Fieldguide** 是一款 Windows 桌面学习应用：把代码库变成可探索、可导览、可提问的知识地图，并与论文/文档学习打通，形成「理论 ↔ 实现」的学习闭环。



> 图谱用来**教**，不是用来炫。



**代码地图能力基于 [Understand-Anything](https://github.com/Egonex-AI/Understand-Anything)**（MIT）：复用其 Tree-sitter + 多 Agent 索引流水线与交互式 Dashboard；Fieldguide 在此基础上构建独立桌面壳、理论学习、概念桥接与跨模块 Agent。



---



## 产品定位



面向 AI 时代主动学习前沿技术的软件开发者——既需要读懂优秀开源项目的工程实践，也需要消化 arXiv 论文与文档中的理论。Fieldguide 不是 IDE 插件，不是学术 citation 工具，而是长期陪伴的**本地学习工作台**。



| 模块 | 作用 | 实现来源 |

|------|------|----------|

| 代码地图 | 交互式知识图谱、架构分层、引导 Tour | **Understand-Anything** |

| 理论学习 | arXiv 搜索、PDF 阅读与 RAG 问答、笔记 | Fieldguide |

| 概念桥接 | 论文术语 ↔ 代码节点，生成对照导览 | Fieldguide |

| AI 助手 | 代码问答 + 论文/桥接联合上下文 | UA + Fieldguide 扩展 |



---



## 动工前



准备写代码时，请先阅读：

1. **[docs/doc-index.md](docs/doc-index.md)** — 文档地图、一致性检查表、动工门禁
2. **[docs/understand-anything-integration.md](docs/understand-anything-integration.md)** — UA 集成边界、数据流、仓库结构
3. **[docs/getting-started.md](docs/getting-started.md)** — 动工清单、Phase 边界、实施顺序
4. 完成 **[docs/spike-ua.md](docs/spike-ua.md)** — UA 集成 Spike（硬门禁）



---



## 设计文档



| 文档 | 说明 |
|------|------|
| [docs/doc-index.md](docs/doc-index.md) | **文档索引**：地图、决策表、一致性检查、动工门禁 |
| [docs/spike-ua.md](docs/spike-ua.md) | UA 集成 Spike 记录（动工前必填） |
| [docs/understand-anything-integration.md](docs/understand-anything-integration.md) | **UA 集成规格**：复用范围、架构、风险、Spike |

| [docs/getting-started.md](docs/getting-started.md) | **动工前引导**：清单、原则、顺序、陷阱、验收 |

| [docs/product-spec.md](docs/product-spec.md) | 产品需求：愿景、用户场景、功能边界、非目标 |

| [docs/architecture.md](docs/architecture.md) | 技术架构：Electron、UA 集成层、数据模型、Agent |

| [docs/ui-spec.md](docs/ui-spec.md) | 界面与交互：三栏布局、图谱、Tour、视觉规范 |

| [docs/roadmap.md](docs/roadmap.md) | 分阶段路线图与验收标准 |
| [docs/todos.md](docs/todos.md) | **工程待办**：下一步任务、优先级与完成状态 |

| [docs/design-review.md](docs/design-review.md) | 设计审视：用户 × 开发者双视角、已决项 |

| [docs/onboarding-spec.md](docs/onboarding-spec.md) | 首次启动引导：语言、项目根目录、Demo |

| [docs/testing-strategy.md](docs/testing-strategy.md) | 测试策略：单测、集成、E2E、验收清单 |
| [docs/fieldguide-demo-spec.md](docs/fieldguide-demo-spec.md) | 引导用 Demo 仓库规格（外部依赖） |
| [docs/fixtures-tiny-go-spec.md](docs/fixtures-tiny-go-spec.md) | 测试 fixture `tiny-go` 规格 |

**建议阅读顺序**：doc-index → understand-anything-integration → getting-started → product-spec → architecture → ui-spec → roadmap



---



## 当前状态



**Phase 1 — 完成 ✅** · **Phase 2 — 进行中 🔵**（约 55%）



- [x] 产品命名与定位

- [x] 设计文档（含 UA 集成规格、引导、测试策略）

- [x] 技术路线：基于 UA 构建代码地图，不自研索引管线

- [x] Electron 脚手架与 Phase 1 主体（项目库、结构索引、Dashboard 嵌入、Onboarding、graph-reader）
- [x] Phase 2 LLM 索引（文件摘要、架构层检测、Tour 生成）
- [x] postMessage 双向通信（Dashboard ↔ 壳层节点高亮/Tour 同步/Ctrl+K 跳转）
- [x] 桥接 Tab（论文 ↔ 代码概念链接）
- [x] Vitest 单测基线（32 tests 通过）
- [ ] Phase 2 剩余（diff 集成、增量索引 UI、LLM 成本提示）
- [ ] Phase 3 RAG（LanceDB 论文向量检索）
- [ ] Phase 4 发布（NSIS 安装包）



---



## 技术概要



- **平台**：Windows 桌面（Electron），后续可评估 macOS / Linux

- **代码地图**：[@understand-anything/core](https://github.com/Egonex-AI/Understand-Anything) + Dashboard 嵌入

- **Fieldguide 栈**：Electron + React + TypeScript + SQLite（扩展数据）+ LanceDB（论文 RAG）

- **数据**：本地优先；配置/论文/桥接在 `%APPDATA%/Fieldguide/`；图谱产物在 `{project}/.understand-anything/`（与 UA 一致）

- **语言**：默认简体中文；支持繁中、en-US（与 UA `zh` / `zh-TW` / `en` 映射）

- **LLM**：OpenAI 兼容 API（用户自配 Key，如 DeepSeek）



---



## 许可证



- **Understand-Anything**：MIT（上游）

- **Fieldguide**：实现期采用 MIT（与上游一致）；见 [NOTICE.md](../NOTICE.md)


