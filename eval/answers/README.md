# 答案级评测的录制文件

这个目录存放 **真实模型回答的录制**，用于离线复现答案级指标（引用忠实度 / 引用精确率 /
引用召回率 / 引用幻觉率）。

## 约定

- 文件名：`<dataset>.<model>.json`，与 `eval/datasets/<dataset>.qa.json` 同名对应。
  同一个数据集可以有多个模型的录制，`pnpm eval:answers` 会把它们并列成表。
- 生产：`pnpm eval:record-answers`（需要 API Key，是整条评测链上**唯一**产生费用的步骤）。
  它驱动真实 Electron 应用，用真实 `chat:send` 通道逐题提问。
- 消费：`pnpm eval:answers` —— 离线、免费、可复现，写出 `docs/eval/agent-answers.md`。
- **建议把这些 JSON 提交进仓库**：它们是"离线可复现"这条承诺的载体；没有它们，
  答案级指标在 CI 里只能显示为"未录制"，而不是被 0 填充。
- 提交前请自行确认：文件里不应包含 API Key。录制内容只有题目 id、引用节点 id、
  回答前 200 字与 token 计数。

## 引用口径（务必在论文里写清）

`citedNodeIds` 取自 Agent 运行时的 `nodeRefs`，即**上下文种子节点 ∪ 工具 observation 中提取的
节点**，而不是从答案正文里解析出的引用标记。因此：

- 引用**忠实度**与**幻觉率**是硬校验：引用了图谱里不存在的 id 会被算作幻觉。
- 引用**精确率/召回率**度量的是"Agent 依据的节点是否命中标注"，应表述为
  **依据覆盖度**，不要写成"答案里写了哪些引用"。

这条口径也写在每个录制文件自己的 `citationSemantics` 字段里，避免随文件流转而丢失。

## 冒烟

```bash
# 每个数据集只录 2 题，验证链路（仍需 Key）
pnpm eval:record-answers --limit=2
# 只录关键词形式
pnpm eval:record-answers --field=keywords
```

没有 Key 时脚本会打印配置方法并 **以 0 退出**：跳过不是失败，也不会把缺失的录制
伪装成"已经跑过"。
