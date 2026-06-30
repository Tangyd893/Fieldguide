# fieldguide-demo 仓库规格

> 版本：v0.1 | 状态：待创建（Phase 1 外部依赖）  
> 用途：首次引导「体验 Demo」与日常 dogfooding。由 **独立仓库** 分发，不内嵌 Fieldguide 安装包。

---

## 一、仓库信息

| 项 | 值 |
|----|-----|
| 组织/仓库 | `https://github.com/fieldguide-app/fieldguide-demo` |
| slug | `demo` |
| clone 路径 | `{projectsRoot}/demo/` |
| 引用 | [onboarding-spec.md §五](./onboarding-spec.md)、[doc-index.md §5.3](./doc-index.md) |

---

## 二、代码体量与结构

**目标**：约 **500 行**，可在无 LLM 时 1–2 分钟内完成 UA 静态索引。

```
fieldguide-demo/
├── README.md                 # 说明：配合 Fieldguide 引导使用
├── go.mod
├── cmd/
│   └── server/
│       └── main.go           # HTTP 入口（Gin 或 net/http）
├── internal/
│   ├── handler/
│   │   └── api.go            # HTTP handler → service
│   ├── service/
│   │   └── user.go           # 业务逻辑
│   └── store/
│       └── memory.go         # 数据层
└── web/                      # 可选：少量 TypeScript
    ├── package.json
    └── src/
        └── index.ts          # 前端入口（可选）
```

**主链路（Tour 应能覆盖）**：

```
HTTP 入口 (main.go)
  → handler
    → service
      → store
```

---

## 三、语言与框架

| 语言 | 要求 |
|------|------|
| Go | 必须；含 HTTP 入口 |
| TypeScript | 可选；若有则 ≤200 行 |

**框架**：Go 可用 `gin` 或标准库；避免重型依赖。

---

## 四、与 Fieldguide 的约定

1. **不提交** `.understand-anything/` 到 demo 仓库（用户本地索引生成）；或可选提交一份小 graph 供 CI（<1MB）。
2. README 注明：「在 Fieldguide 首次引导中选择体验 Demo 将 clone 本仓库」。
3. 仓库创建后，在 Fieldguide `onboarding-spec.md` 将 URL 确认为可访问。

---

## 五、验收（demo 仓库就绪）

- [ ] `git clone` 成功
- [ ] UA `/understand` 或 core pipeline 可索引并生成 graph
- [ ] 图谱含 `cmd/` 或 `main` 入口节点
- [ ] Fieldguide 引导「体验 Demo」路径可指向本仓库

---

## 六、创建清单（仓库维护者）

- [ ] 创建 GitHub 仓库 `fieldguide-app/fieldguide-demo`
- [ ] 按 §二 实现代码
- [ ] 添加 LICENSE（建议 MIT，与 Fieldguide 一致）
- [ ] 本地 UA 索引验证
- [ ] 在 Fieldguide [doc-index.md §5.3](./doc-index.md) 打勾
