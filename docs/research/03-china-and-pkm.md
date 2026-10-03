# Fieldguide competitive research — Part A (China code-intelligence) & Part B (PKM overlap)

**Research date:** 2026-09-22 (all fetches performed on this date; star counts and prices are "as of 2026-09-22").
**Method:** every factual claim below is backed by a page fetched live with `Invoke-WebRequest`. URLs that failed to fetch are listed in each section's "Fetch log" as `UNVERIFIED` / `FETCH FAILED` rather than silently cited. GitHub REST API returns HTTP 403 from this environment, so star counts were scraped from `github.com/<owner>/<repo>` HTML (`id="repo-stars-counter-star"` `title` attribute **and** the `stargazerCount` JSON field, cross-checked against the `aria-label="N users starred this repository"` string).
**Vendor claim vs confirmed:** statements sourced from a vendor's own marketing page are marked *(vendor claim)*. Anything I could not verify is marked `UNVERIFIED`.

---

## Part A — Chinese-market code-intelligence tools

### Zread (智谱 Zhipu AI / Z.ai)

**(a) The one differentiated capability.** GitHub repo → an interactive *Guide* — architecture breakdown, module explanations, design patterns — plus **Buzz**, which aggregates the real community signal (commits, issues, news) around the project, plus in-document annotation and Q&A, a contributor graph, and a free-text note tool. Its positioning is explicitly *"Where to Go Next?"* for a repo you don't know. It is the natively-Chinese answer to Cognition's DeepWiki, and it is pivoting from "read a public repo" to "document **your own** repo": the site now ships **Zread CLI for Local Repos** — *"Run `zread` in any project directory. Turn your **local codebase** into structured, browsable project docs"* (install via npm or Homebrew; the CLI generates pages such as Overview / Project Structure / Dev Environment / Core Modules / Data Flow / Team Conventions / Deployment). Zread's own HTML metadata advertises `codebase guide, ai tutorial, ai course` — i.e. it is already claiming the *teach-me-this-codebase* territory. Source: `https://zread.ai` (fetched, HTTP 200, i18n strings `CliPage` and meta keywords).

**(b) Pricing / business model.** **Free, with no consumer pricing page.** `https://zread.ai` exposes a sidebar item literally named "Subscription", but its own strings show that this means *"Subscribe a repo to tracking its updates"* (`"subscription": "Subscription"` / `"Subscribe a repo to tracking its updates."`), **not** a paid plan. `https://zread.ai/pricing` and `https://zread.ai/zh` **failed to fetch** (connection reset — `FETCH FAILED`), so I cannot prove a pricing page does not exist, only that the fetched surfaces contain none. There are real usage limits though: the app ships the error string *"You've reached today's submission limit. Please wait until tomorrow before submitting more repositories."* Monetisation is **indirect and real**: per Z.AI's own docs, the *"ZRead MCP Server is an exclusive Remote MCP Server developed by Z.AI for **GLM Coding Plan** users"* — so Zread is a free developer top-of-funnel for a paid model subscription. The adjacent paid product is **GLM Coding Plan**: *"Plans from $18/month"* with credit tiers **Lite** 2,000 five-hour credits / 10,000 weekly, **Pro** 12,000 / 60,000, **Max** 28,000 / 140,000 (sources: `https://docs.z.ai/devpack/mcp/zread-mcp-server` HTTP 200; `https://docs.z.ai/devpack/overview.md` HTTP 200; `https://z.ai/subscribe` HTTP 200 meta description; `https://docs.z.ai/llms.txt` HTTP 200).
**Third-party claim (LOW-CONFIDENCE, aggregator):** AIHub states Zread is *"免费使用，无需登录，无需注册"* ("free to use, no login, no registration") — `https://www.aihub.cn/tools/coding/zread/` HTTP 200. Consistent with the primary surfaces, but it is a directory site, not a vendor page.

**(c) Open source vs proprietary; local vs cloud.** **Proprietary, cloud-only** for the hosted product (no source repository is published for the service). The new CLI reads a local repo, but Zread's model is Zhipu's hosted GLM, so "local repo" ≠ "local inference". **Private repos are supported** but require connecting a GitHub account — aihub notes *"建议在处理含敏感信息的私有仓库前评估风险"* (LOW-CONFIDENCE).

**(d) Owner and strategic role.** **Zhipu AI (智谱)**, which listed on the Hong Kong Stock Exchange under **2513.HK** and is described by 36Kr as *"the 'first large model stock' on the Hong Kong Stock Exchange"* (`https://eu.36kr.com/en/p/3992798380833792` HTTP 200). Zhipu reported H1-2026 revenue exceeding the whole of the prior year, with MaaS token call volume up **more than 40×** versus the start of the year (`https://www.jjckb.cn/20260901/511a6bc8f7f84993ae650efdee76830f/c.html`, 新华社《经济参考报`). Strategic role: **Zread is not a product business — it is a demand-generation surface for GLM/GLM Coding Plan.**

**Launch date.** Reported **2025-07-22** as a new Zhipu Z.ai tool supporting Chinese and indexing many popular projects (`https://www.chinaz.com/ainews/19852.shtml` HTTP 200, dated 2025-07-22, source credit AIbase). The formal launch **with GLM-4.5 as the model behind it was announced 2025-08-05** — PingWest, citing Zhipu officially: *"智谱面向开发者群体推出全新工具 Zread，由 GLM-4.5 模型提供支持"* (`https://www.pingwest.com/w/306654` HTTP 200).

**Model behind it.** **GLM-4.5.** Zhipu evaluated multiple LLMs and *"最终选择了 GLM-4.5 作为代码分析与文档生成的核心底座"*, citing code comprehension, low hallucination, Deep Research support and agent capability (`https://www.chinaz.com/ainews/20222.shtml` HTTP 200). Note this is the 2025 launch model; the current GLM Coding Plan sells GLM-5.3/5.3-Flash/5.2.

**Adoption numbers.** `UNVERIFIED: searched "Zread 用户 数量", "Zread 索引 仓库 数量 数据", "zread.ai 访问量 增长" — no vendor-published user, repo-index or traffic figure exists in any source I could fetch. Zhipu publishes group-level MaaS token statistics (40× growth) but not Zread-specific adoption.`

---

### 通义灵码 (Tongyi Lingma) → **renamed Qoder CN** (Alibaba)

**The single most important name-level finding: "通义灵码" no longer exists as a product brand.** Alibaba's own docs: *"Qoder CN 系列原名'智能编码助手通义灵码'（Lingma），已于 **2026 年 5 月 20 日**正式更名"* (`https://docs.qoder.cn/` HTTP 200; same statement on the Alibaba Cloud billing doc, HTTP 200). Anyone tracking "Tongyi Lingma" competitively is tracking a renamed product.

**(a) The one differentiated capability.** For Fieldguide's purposes it is **not** the repo Q&A (that is table stakes) — it is the **enterprise data-locality offer**: a **VPC-deployed tier with a dedicated instance**, sold explicitly to finance/government buyers on data-safety grounds, combined with **repo-level Q&A, `Repo Wiki`, a `Knowledge Base`, and an agentic "Quest" mode**. Vendor language: *"国产大模型、国内部署：底层支持 GLM、DeepSeek、Kimi、MiniMax 等国内主流大模型，**全链路在国内云上部署**，符合国内数据安全与合规要求"* and *"适合金融、政务等行业：面向**银行、保险、政务**等对数据安全与合规要求高的客户群体，提供专属版、私域知识增强、**专属 VPC 部署**等企业级方案"* (`https://docs.qoder.cn/` HTTP 200). Vendor adoption claim: Alibaba Cloud CTO 周靖人 — *"阿里云是中国首家推行全员AI编码的云厂商，AI代码生成占比达34%，研发效率提升21%"* (`https://www.alibabacloud.com/zh/product/lingma` HTTP 200, **vendor claim**). Lingma's site also claims *"百万开发者用通义灵码"* and >87% developer satisfaction (**vendor claims**, `https://lingma.aliyun.com/` HTTP 200).

**(b) Pricing with concrete numbers (RMB).** From Alibaba Cloud's own billing doc, updated **Aug 11 2026** (`https://www.alibabacloud.com/help/zh/lingma/billing-description` HTTP 200). Billing unit is **"seat × month"**, plus a one-off prepaid **Credits** pack:

| Tier | Price | Credits | Minimum seats |
|---|---|---|---|
| 个人体验版 (Free) | 免费 | 2-week Pro trial + 300 Credits; limited completions | — |
| 个人专业版 (Pro) | **¥59 / 月** | 2,000 Credits / month | — |
| 个人高级版 (Pro+) | **¥169 / 月** | 6,000 Credits / month | — |
| 团队版 (Teams) | **¥99 / 席位·月** | 3,000 Credits / seat / month | 1 |
| 企业标准版 (Enterprise) | **¥149 / 席位·月** | 3,000 Credits / seat / month | 10 |
| 企业专属版 (Enterprise VPC) | **¥199 / 席位·月** | 3,000 Credits / seat / month, team-shareable | **50** |

Enterprise VPC includes *"独立实例与存储 / 专有网络 / 访问控制 / IP 白名单管理"*. The promotion end is itself a datapoint: *"个人专业版限时免费活动已于北京时间 2026 年 5 月 20 日 18:00:00 结束"* — Alibaba **stopped giving the Pro tier away** and moved the free users down to the community edition. Current promo noise on `docs.qoder.cn` includes *"每日领取 100 Credits"* and *"Qwen3.8-Flash 限时免费使用"*.

**(c) Open source vs proprietary; local vs cloud.** **Proprietary, closed source.** **Cloud-first, but with a genuine private-deployment tier** (Enterprise VPC = dedicated instance + private network + IP allowlist). I found **no evidence of a fully offline/air-gapped on-prem build** — VPC here means an isolated network inside Alibaba Cloud's domestic footprint (`全链路在国内云上部署`), not your own laptops. Claim the distinction carefully.

**(d) Owner and strategic role.** **Alibaba Cloud (阿里云) first-party product** — *"阿里云一方产品：由阿里云统一研发与运维"*. It has metastasised into a family: Qoder CN IDE, JetBrains plugin, Qoder CN CLI, QoderWork CN desktop app, QoderWake CN ("数字员工"/digital employee), Cloud Agents CN, mobile. Strategic role: enterprise lock-in into Alibaba Cloud + Qwen, sold through the compliance/procurement channel rather than bottom-up developer love. Gartner positioning claim (vendor): *"阿里云是唯一进入…Gartner AI 代码助手挑战者象限的中国厂商"* (`https://lingma.aliyun.com/` HTTP 200) — **vendor claim**, not independently verified here.

---

### CodeGeeX (Tsinghua THUDM → Zhipu / `zai-org`)

**(a) The one differentiated capability.** **Repository-level code Q&A in a single 9B open-weight model that runs on your own machine.** Per the official README: *"Using a single CodeGeeX4-ALL-9B model, it can support comprehensive functions such as code completion and generation, code interpreter, web search, function call, **repository-level code Q&A**, covering various scenarios of software development… It is currently the most powerful code generation model with less than 10B parameters"* (`https://raw.githubusercontent.com/zai-org/CodeGeeX4/main/README.md` HTTP 200). That is the closest thing in China to "a local model that understands your repo."

**(b) Pricing / business model.** **Free.** Official-mirrored FAQ: *"目前IDE插件市场的 CodeGeeX 都是免费使用的"* ("CodeGeeX in the IDE plugin marketplaces is currently all free to use") — `https://www.w3cschool.cn/codegeex/product-related.html` HTTP 200 (third-party mirror of Zhipu's own Feishu wiki). There is no paid CodeGeeX tier; it is Zhipu's free/open ecosystem play alongside paid GLM API + Coding Plan. Commercial use of the *model weights* requires a registration form — see (c).

**(c) Open source vs proprietary; local vs cloud.** **Split, and this nuance matters:**
- **Source code: Apache-2.0.** *"The code in this repository is open source under the Apache-2.0 license."* (`https://raw.githubusercontent.com/zai-org/CodeGeeX4/main/LICENSE` HTTP 200 — verbatim Apache 2.0 text.)
- **Model weights: NOT commercially open.** *"The model weights are licensed under the Model License. CodeGeeX4-9B weights are open for **academic research**. For users who wish to use the models for **commercial purposes**, please fill in the registration form"* (README, HTTP 200). So this is "open weights for research", not OSI open source.
- **Local/offline: YES, genuinely.** There is a *"Local Mode Tutorial: Local deployment with the Visual Studio Code / Jetbrains extensions"*: click the extension, *"Open the local mode in the extension settings (**no need to login**)"*, then `ollama run codegeex4` / `ollama serve`, enter the API address (`https://raw.githubusercontent.com/zai-org/CodeGeeX4/main/guides/Local_mode_guideline.md` HTTP 200). The docs index also lists an *"离线模式教程：Ollama篇"* (offline-mode tutorial) and *"CodeGeeX 本地模式使用指南"*.
- **Private deployment for enterprises: YES.** *"在私有化部署的情况下，模型和服务都部署在客户私域内，数据不会流出，可以放心使用"* (w3cschool mirror, HTTP 200).
- **Stars (as of 2026-09-22):** `zai-org/CodeGeeX` **8,807**; `zai-org/CodeGeeX4` **2,593**. Both fetched HTTP 200; neither archived.

**(d) Owner and strategic role.** Born at **Tsinghua University's THUDM** (the KDD-2023 paper, `https://arxiv.org/abs/2303.17568`), now hosted under **`zai-org`**, i.e. **Zhipu AI** — the same owner as Zread and GLM. Strategic role: **open-weights credibility and academic/sovereignty marketing for Zhipu**, not revenue. Note CodeGeeX's own site (`https://codegeex.cn`) returned HTTP 200 but renders as an almost-empty JS shell (4 KB of markup), so I could not extract product/pricing text from it.

---

### 豆包 MarsCode → **Trae** (ByteDance)

**(a) The one differentiated capability.** **SOLO mode** — an agentic "Context Engineer" that owns plan → code → test → deploy, shipped as **SOLO Builder** and **SOLO Coder** (the latter adds a Plan mode, repo-level iteration and context compaction). Trade-press framing of the vendor's message: *"SOLO 模式是一个能够思考、计划、执行和交付全流程的 Context Engineer（上下文工程师），覆盖了规划、编码、测试、部署等完整的开发周期"* (极客公园 via 智源社区, `https://hub.baai.ac.cn/view/47554`, SECONDARY). The **codebase-comprehension** hook is enterprise-scale indexing: Trae CN 企业版 supports *"10 万文件、1.5 亿行代码的超大仓库索引"* and *"更完整的上下文理解和代码依赖分析"* (`https://developer.volcengine.com/articles/7598410745965248522`, PRIMARY vendor blog — note it is also the source of the cloud-deployment contradiction below).

**(b) Pricing / business model — concrete numbers.** Two live, self-consistent price pages:
- **USD (`https://www.trae.ai/pricing`, HTTP 200, fetched 2026-09-22):** Free `$0` (*"Auto mode only / Limited usage / Limited Autocomplete"*); **Pro `$20 per month, auto-renews`** ($20 usage/month, unlimited autocomplete, 10 concurrent cloud tasks); **Pro+ `$60 per month`**; **Ultra `$200 per month`** (model early access).
- **RMB (`https://www.trae.com.cn/pricing`, HTTP 200, fetched 2026-09-22 — independently fetched by me and consistent with the sub-research):** 免费 `¥0` (500 积分/月); **会员 Lite `¥49`/月 (首月 ¥39)** with 2,000 积分; **会员 Pro `¥99`/月 (首月优惠 ¥69)**, 4,000 积分/月; **会员 Pro+ `¥239`**, 12,000 积分/月; **会员 Ultra `¥699`**, 40,000 积分/月. Model discounts apply: Seed-2.1-Turbo / Seed-Code at 2.5折, GLM-5.2/5.3 and Seed-2.1 at 5折. The authoritative plan table (`https://docs.trae.cn/ide_coming-soon`) also gives the **连续包月** (auto-renewing) prices — **¥45 / ¥89 / ¥219 / ¥629** for Lite/Pro/Pro+/Ultra — and a *"限时首月优惠：首月 ¥29.9，第 2 个月恢复 ¥45。仅限付费新用户"*.
- ⚠️ **Documented inconsistency, not papered over:** Trae's own blog announced token-based pricing effective **2026-02-24** with tiers *"ranging from $3 to $100 per month"* (Lite `$3`), which does **not** match the live `$20/$60/$200` page. `UNVERIFIED: why the USD tier range moved from $3–$100 to $20–$200; no superseding notice found.` Similarly, SOLO GA was reported at *"$3 first month, $10 thereafter"* — also inconsistent with both. Use the live pages.

**(c) Is MarsCode folded into Trae? YES — verified by redirect.** `https://www.marscode.cn/` **301-redirects to `https://www.trae.cn/plugin`**, and that page self-describes the product as *"TRAE 旗下新一代 AI 开发编程助手（**原 MarsCode 编程助手**）"* — primary confirmation. The international `https://www.marscode.com/` still serves English MarsCode copy under a "Trae – AI IDE" navbar with **no redirect** (fetched HTTP 200), so the fold-in is complete on the CN domain and legacy on `.com`. Timeline from a Trae core member's retrospective: the team abandoned MarsCode's Cloud-IDE path on **2024-11-15** after concluding *"国内企业的代码很难上云，而程序员的 Side Project 又不足以支撑产品的健康发展"* (`https://hub.baai.ac.cn/view/47554`, SECONDARY).
`UNVERIFIED: the "Trae要被豆包吞了" toutiao article — HTTP 200 but JS-gated, body unreadable.`

**(d) Open source vs proprietary; local vs cloud.** **Proprietary, closed source.** TraeCode is a downloadable IDE/plugin/CLI, but inference runs on ByteDance's 火山引擎 cloud. **On-prem claims are self-contradictory across two ByteDance-owned pages** — the security doc says *"客户数据（包括代码、文档、模型）**100% 留存在客户自有服务器**"* and offers *"私有化部署、全链路加密、**数据不出域**"* (`https://docs.trae.cn/enterprise_security-compliance-and-governance`), while the Volcengine launch PR says *"**全面采用云端部署的方式**…云**端零存储**"* (`https://developer.volcengine.com/articles/7598410745965248522`). **Cite both or neither.**

**(e) Owner and strategic role.** **ByteDance** (CN footer: *"北京引力弹弓科技有限公司"*). Strategic role is **vertical integration** — ByteDance ships both the IDE and its own coding model, reportedly after *"Anthropic断供TRAE"* (SECONDARY, tmtpost). Reported adoption (**vendor/PR-sourced, not independently confirmed**): Trae 个人版 registered users *">600万"*; May-2025 figures of *"累计生成了超过60亿行被用户采纳的代码。月活用户就突破了100万"*.

---

### Gitee AI — **pivoted away from code understanding**

**(a) The one differentiated capability (and the honest correction).** Gitee AI has **stopped being a code-understanding product and is now 模力方舟 (MoArk), an "企业级 Token 精细化治理平台"** — a multi-model token gateway. *"模力方舟（MoArk）是新一代企业级 Token 精细化治理平台，连接全球 AI 模型"*, *"200+ 大模型"*, *"完全兼容 OpenAI / Anthropic API"*, *"全面支持 国产芯片算力"* (`https://ai.gitee.com/`, HTTP 200). Its **repo-understanding** capability is delivered as an **MCP server that gives a third-party assistant repo access**, and the blog concedes the gap Fieldguide targets: *"AI 编程助手（如 Windsurf、Cursor、Codeium）… 仍然存在一个局限：缺乏对整个项目的全局理解"* (`https://blog.gitee.com/2026/01/22/gitee-official-mcp-server-ai-code-repo/`, PRIMARY, 2026-01-22). Repo: `https://gitee.com/oschina/mcp-gitee`.
`UNVERIFIED: an AI-semantic code search / 仓库问答 product on Gitee. Gitee's own blog index shows "代码搜索服务 Gitee Search 正式上线 7 年前" — i.e. it predates the LLM era. No primary page advertising LLM-based repo Q&A was found.`

**(b) Pricing.** **No public AI price numbers exist.** `https://ai.gitee.com/pricing` → HTTP 200 but body is *"你所访问的页面不存在"* (soft-404); `https://ai.gitee.com/docs/serverless-api/pricing` → hard 404; the model marketplace's *"购买全模型 Token 资源包"* button sits next to a **"0 个模型"** counter with no prices (`https://ai.gitee.com/serverless-api`). Gitee platform pricing is quote-gated: homepage shows *"企业免费使用"*, *"企业版免费注册"*, *"专业版预约演示"*, and a **信创一体机 (含机器)** SKU at *"联系我们"* (`https://gitee.com/`). `UNVERIFIED: any concrete RMB price for Gitee AI/MoArk tokens, Gitee 专业版, or the 信创一体机.` (Trap for future researchers: `gitee.com/pricing` is a *user profile* named "pricing", not a pricing page.)

**(c) Open source vs proprietary; local vs cloud.** **Proprietary SaaS + a genuine on-prem platform SKU**, but note the split: *"专业的私有化部署服务 Gitee 专业版 — 满足国内主流信创要求，可支持高可用、分布式部署"* plus *"Gitee 专业版信创一体机 (含机器)"* covers the **code-hosting/DevOps platform**; MoArk's AI delivery is cloud-shaped (*"模型专属部署 独享算力资源"*, *"算力市场…小时级起租"*). The MCP server is open source (Go) and written for private installs: *"支持自定义 API 端点（-api-base），适配企业私有化部署场景"*. `UNVERIFIED: on-prem/offline delivery of Gitee AI's model inference itself.`

**(d) Owner and strategic role.** **开源中国 / OSChina** (entities: 北京奥思研工智能科技有限公司, 深圳奥思研工智能科技有限公司). Funding is well documented: **B+ round of ¥7.75亿 (775M RMB), June 2023, led by 天际资本**, which cut **Baidu's stake from 51.54% to 14.04%** and made the founding team controller, aiming at *"完全中立平台"* (`https://news.pedaily.cn/202306/516204.shtml`, SECONDARY). Scale (vendor-published): *"截至2024年12月，Gitee已经有1400万名注册用户和3600万个代码仓库"*, 企业版 *"已服务超过 420,000+ 家企业"* (`https://blog.gitee.com/`). Strategic role: the domestic-GitHub/信创 alternative, having led the MIIT national open-source hosting platform project in 2020.

---

### 百度 Comate (文心快码)

**(a) The one differentiated capability.** **私有化部署 as a first-class, documented product line — not a footnote.** The official pricing doc has a dedicated `私有化版` section, and the top enterprise SKU is explicitly annotated **"模型私有化部署"** (`https://cloud.baidu.com/doc/COMATE/s/rlnvnio4a`, PRIMARY, 更新时间 2026-07-15). Comate also ships a full AI IDE with Mission Mode / Spec 模式, @上下文, Subagents/Skills/Plugin/Rules/MCP, 代码索引, 设计稿转代码, and a **Deepwiki**-style doc sidebar and AgentHub.

**(b) Pricing — concrete RMB numbers** (same PRIMARY doc, HTTP 200):
| Tier | Price | Notes |
|---|---|---|
| 个人标准版 | **免费** | 赠智能体请求券 ¥10 (first time) |
| 个人专业版 | **¥100/月 · ¥270/季 · ¥1000/年** | includes ¥55/月 agent-request credit |
| 个人旗舰版 | **¥299/月 · ¥889/季 · ¥3499/年** | includes ¥199/月 credit |
| 企业专业版 | **¥150/人/月 · ¥450/人/季 · ¥1500/人/年** | 1 seat minimum |
| 企业旗舰版 | **¥358/人/月 · ¥1074/人/季 · ¥3998/人/年** | 1 seat minimum |
| **企业专属版** | **¥2500/人/年** | **100 人起购**, annotated **"模型私有化部署"** |
Add-on 智能体请求包 (perpetually valid): ¥18 / ¥33 / ¥150 each. Billing rule: *"智能体请求券消耗额度=消耗的Tokens数x模型单价"*; 智能补全 is free on personal tiers. **私有化版 has no public price** — *"步骤一：预约演示…步骤二：个性化报价"* (quote-gated).

**(c) Open source vs proprietary; local vs cloud.** Proprietary. Delivered as **SaaS (公有云) + 私有化版 + 混合云**; the doc nav includes a separate **混合云帮助手册** and a 代码安全 section.

**(d) Owner and strategic role.** **Baidu (百度智能云)** — a distribution channel for ERNIE/文心 into enterprise dev workflows. Note the Gitee link above: Baidu *was* Gitee's majority shareholder (51.54%) before the 2023 round diluted it to 14.04%, so Baidu and Gitee are no longer the same camp.

---

### 腾讯 CodeBuddy

**(a) The one differentiated capability.** **A genuinely free individual tier, plus a "专有云" enterprise SKU at a published per-seat price** — the cheapest documented free → dedicated-cloud-isolation path in this set. Its doc set is also unusually broad (IDE, 插件, CLI, WorkBuddy + 小程序/移动端/Enterprise, 智能体模式, Plan 模式, Subagents, Skills, Hooks, MCP, Figma).

**(b) Pricing — concrete numbers.**
*Enterprise* (PRIMARY, `https://www.codebuddy.cn/docs/ide/Codebuddy-enterprise-edition/Codebuddy-enterprise-edition-Pricing`), new billing effective **2026-05-15**:
- SaaS企业版（旗舰版）: **¥198/人/月** or **¥2,376/人/年** — 2,000 积分/人/month, team-shared, 对话问答不限频, **1 seat minimum**.
- 专有云企业版（专享版）: **¥316/人/月** or **¥3,792/人/年** — **100 seats minimum**.
- 企业加量包: 2,000 积分 ¥100; 5,000 ¥245; 10,000 ¥480; 50,000 ¥2,375; 200,000 ¥9,200.
- **BYO-model relief:** *"当企业使用自定义模型时，不消耗积分用量"*.
*Individual/Team* (PRIMARY, `https://www.codebuddy.ai/docs/zh/ide/Account/pricing`): **Free** — 100 基础积分/月, 5,000 completions/month; **Pro $10.00/月** ($96/年 = $8/月); **Team $40.00/seat/月** ($480/seat/年).
**"Some tiers are free" — VERIFIED and scoped precisely:** the Free plan is **permanent at the 100-credit level**, while the "unlimited" experience is an explicitly reversible promotion: *"Free 版限免期间，用户可享受全模型可选、代码补全不限次、自动任务 99 个；限免结束后恢复档位额度"*.

**(c) Open source vs proprietary; local vs cloud.** Proprietary, closed source. SaaS + **专有云（专享版）**, i.e. isolated tenancy inside Tencent Cloud — **not air-gapped/offline**. `UNVERIFIED: an offline or customer-datacenter CodeBuddy edition.`

**(d) Owner and strategic role.** **Tencent (腾讯云)**. Only vendor here wiring a coding agent into a mass-market messaging platform — the doc nav lists a *"微信 ClawBot 接入指南（推荐）"*.

---

### 华为 CodeArts — **"CodeArts Snap" is retired**

**(a) The one differentiated capability.** **Understanding very large legacy codebases plus HarmonyOS-specific models, only on Huawei's own stack.** Vendor headings: *"存量代码深度理解（Codebase）— 精准理解大型代码库，快速上手项目"*; *"千万行级代码索引，应对复杂项目增量开发难题"*; *"鸿蒙代码增训模型"*; *"Agent Team专家团队"*; *"CodeArts Agent Space"* (`https://codearts.huaweicloud.com/`, PRIMARY).
**Name correction:** *"CodeArts Snap"* is effectively retired — every `support.huaweicloud.com/qs-codeartssnap/...` URL now returns Huawei's **404 page**. The live product is **华为云码道 CodeArts 代码智能体**. The only reachable Snap material is versioned legacy (*"智能开发助手(CodeArts Snap) 2.1.0 使用指南 (for 华为云Stack 8.3.1)"*, `https://support.huawei.com/carrier/docview!docview?nid=DOC1101262094&topicId=d8e4097e`). Credit billing went live **2026-09-04 23:59:59 Beijing** (`https://support.huaweicloud.com/price-codeartsagent/codeartsagent_billing_0028.md`, PRIMARY).

**(b) Pricing — concrete RMB numbers** (fetched 2026-09-22 from `https://codearts.huaweicloud.com/`):
| Plan | Price | Included |
|---|---|---|
| 体验版 | **¥0.00 免费体验** | 500 积分/月, 3 并发, 500MB 知识空间, **5,000 个代码库索引文件** |
| 标准版 | **¥98.00/月** | 2,000 积分/月, 5 并发, 5GB, **50,000 个代码库索引文件** |
| 高级版 | **¥198.00/月** | 4,000 积分/月, 5 并发, 5GB, 50,000 files |
| 旗舰版 | **¥498.00/月** | 10,000 积分/月, 5 并发, 5GB, 50,000 files |
Promos: *"个人版新用户注册登录送 4,000 积分"*, *"限时每日领1000积分"*, *"每日千万Token免费领"*. Published per-model credit coefficients: GLM-5.2 **0.7**, OpenPangu-2.0-Flash **0.32**, GLM-5.2-ArkTS-SPARK 0.7, OpenPangu-2.0-Pro 0.7 (PRIMARY). `UNVERIFIED: enterprise per-seat price and credit-pack prices (tab content not in the fetched DOM).`

**(c) Open source vs proprietary; local vs cloud.** Proprietary and **requires Huawei Cloud** — enterprise usage is scoped to *"升级套餐的账号、及该账号下的IAM用户或企业联邦用户"* (`https://support.huaweicloud.com/price-codeartsagent/codeartsagent_billing_0032.md`). Private path is **Huawei Cloud Stack** (Huawei's private-cloud appliance), evidenced by the legacy Snap guide scoped *"for 华为云Stack 8.3.1"*. Security claims: *"数据本地存储与加密传输双重保障"*, *"网络沙箱双重隔离"*. `UNVERIFIED: a standalone offline/air-gapped CodeArts edition and its price.`

**(d) Owner and strategic role.** **Huawei (华为云计算技术有限公司)** — 信创/sovereign-stack capture (domestic chips, OpenPangu models, HarmonyOS/ArkTS tooling) and Huawei Cloud consumption. `UNVERIFIED: any primary vendor-published customer count or named customer list for CodeArts/码道.`

---

### CodeFuse (蚂蚁集团 / Ant Group)

**(a) The one differentiated capability.** **A full-lifecycle, open-weight, research-grade code LLM family — the only vendor in this set whose flagship model weights are genuinely public and self-hostable**, with explicitly repo-level and code-search work: *"2024.08 … Release D2Coder-v1 Embedding model for **code search**"*; *"2024.07 … D2LLM … **RepoFuse**: Repository-Level Code Completion with Language Models with Fused Dual Context"* (`https://raw.githubusercontent.com/codefuse-ai/codefuse/master/README.md`, PRIMARY).

**(b) Pricing.** **No public pricing — `UNVERIFIED`.** `https://codefuse.ai/zh-CN` returns HTTP 200 but an empty body under text extraction (JS app). Whether CodeFuse is sold to external enterprises at all is `UNVERIFIED`; my reading that it is primarily internal/reputation-driven is an **inference** from the absence of any pricing/product page plus the research-paper-shaped release cadence — **not** a vendor statement.

**(c) Open source vs proprietary — with a correction to the brief.** Open source: **yes**. Stars as of 2026-09-22: `codefuse-ai/codefuse` **134**, `codefuse-ai/ModelCache` **937**, `codefuse-ai/MFTCoder` **712**, `codefuse-ai/codefuse-evaluation` **111**.
⚠️ **Correction: `github.com/codefuse-ai/CodeFuse-13B` and `github.com/codefuse-ai/CodeFuse-CodeLLaMA` both return HTTP 404.** Cite the model cards instead: `https://huggingface.co/codefuse-ai/CodeFuse-13B` (HTTP 200, **Like 49**, 245 followers, **License: other** — *not* a standard OSI licence, so read the custom `MODEL_LICENSE.md` before assuming commercial rights) and `https://huggingface.co/codefuse-ai/CodeFuse-CodeLlama-34B`. Paper: DOI `10.1145/3639477.3639719`, arXiv 2310.06266. Weights being downloadable makes self-hosting technically possible, but `UNVERIFIED: any CodeFuse on-prem product page or supported-deployment statement.`

**(d) Owner and strategic role.** **Ant Group (蚂蚁集团)** — an open-source/reputation engineering brand plus internal productivity, not a priced product.

---

### aiXcoder (硅心科技)

**(a) The one differentiated capability.** **The strongest and most specific local/offline story in the entire set: an "内网-only" enterprise coding agent with its own downloadable small models** — and, critically, **a codebase-analysis agent that is the closest analogue to Fieldguide found anywhere in China**: *"CodeWiki — 代码库分析与文档智能体：全面解析项目架构与代码逻辑，自动生成项目级高质量文档——随代码变更实时更新，企业内网共享"* (`https://aixcoder.com/`, PRIMARY). The agent runs fully inside the customer network: *"CodeAgent Plugin … **面向企业：全程在内网运行**，调用企业自有模型与知识库"*. Architecture bet: *"「大 × 小」协同实现全场景效能最优解"*.

**(b) Pricing.** **No public prices — `UNVERIFIED`, and it looks deliberate.** `https://aixcoder.com/pricing/` and `/version/` **308-redirect to `/zh/pricing` and `/zh/version`, which then 404**. The only commercial CTA is a services funnel: *"需求评估 → 企业代码库POC → 私有化上线，企业私有算力部署（含国产芯片）"*. Reported outcomes (**vendor/PR-sourced, unverified**): a bank case with *"累计编码800万行…6000+使用者、2000+日活"* and *"35%+ 生成代码占比"*; a nuclear-power case with *"国内首个核电专用代码大模型…在国产芯片上完成全栈适配"*.

**(c) Open source vs proprietary; local vs cloud.** **Hybrid, and the most genuinely local of the set.** Open local models: `https://github.com/aixcoder-plugin/aiXcoder-7B` (**2,270 stars** as of 2026-09-22; HF mirror `https://huggingface.co/aiXcoder/aixcoder-7b-base` HTTP 200), plus **aiXapply-4B** (May 2026, *"4B参数的准确率比肩千亿级大模型；**单张消费级显卡即可部署**"*, *"94.4% 代码变更应用准确率"* vs *"397B前沿大模型为94.8%"*, claimed *"2,000 tok/s"* on a single RTX 4090). On-prem: *"Enterprise Hub … **端到端私有化**，管得住、看得见、审得出"*.

**(d) Owner and strategic role.** **北京硅心科技有限公司 (aiXcoder)**. Funding: **数千万人民币 A+ round led by 彬复资本**, with 清流资本 and 三七互娱 participating; earlier 伽利略资本 angel and **高瓴创投** A round (`https://www.newseed.cn/ht/1372739-43081`, SECONDARY). Strategic role: the pure-play sovereign/enterprise vendor — no consumer funnel, no cloud ecosystem to feed, monetising 私有化 + domain tuning. Founding date conflicts across sources (新芽: 2018; 百度百科: 2017-03-24) — flagged, not resolved.

---

### Part A comparison table

| Tool | Owner | Differentiated capability | Pricing (as of 2026-09-22) | Open source? | Local / on-prem? |
|---|---|---|---|---|---|
| **Zread** | Zhipu (2513.HK) | Repo → interactive Guide + **Buzz** community aggregation + notes + **CLI for local repos** | **Free**; monetised indirectly via GLM Coding Plan **from $18/mo** | No (proprietary service) | Cloud; local-repo CLI reads disk but infers in cloud |
| **通义灵码 → Qoder CN** | Alibaba Cloud | Enterprise **VPC deployment** + Repo Wiki + Knowledge Base | **¥59 / ¥169** per mo (Pro/Pro+); **¥99 / ¥149 / ¥199** per seat·mo (Teams / Enterprise / Enterprise VPC, 50 seats min) | No | **Yes** — VPC private deployment, but inside Alibaba Cloud's domestic footprint |
| **CodeGeeX / CodeGeeX4** | Tsinghua THUDM → Zhipu (`zai-org`) | **Repository-level code Q&A in a single locally-runnable 9B model** | **Free** plugins; no paid tier | Code **Apache-2.0**; **weights research-only** (commercial use needs registration) | **Yes** — documented Ollama local mode, *"no need to login"*; 私有化部署 *"数据不会流出"* |
| **Trae (ex-MarsCode)** | ByteDance | **SOLO** agentic mode; 1.5亿-line enterprise repo indexing | **$0 / $20 / $60 / $200** per mo (USD); **¥0 / ¥49 / ¥99 / ¥239 / ¥699** per mo (CN) | No | **Contradictory** — security doc claims *"100% 留存在客户自有服务器"*; launch PR says cloud-deployed, *"云端零存储"* |
| **Gitee AI / MoArk** | 开源中国 (OSChina) | **Pivoted**: now a multi-model token gateway; repo access via open-source **MCP server** | **No public AI prices** (soft-404 pricing pages); platform *"企业免费使用"*, 信创一体机 quote-only | Platform no; MCP server yes (Go) | Platform **yes** (私有化 + 信创一体机); AI service cloud-shaped, `UNVERIFIED` |
| **百度 Comate** | Baidu | **私有化 as a documented SKU**, incl. **模型私有化部署** at ¥2500/seat/yr | Personal **free / ¥100 / ¥299** per mo; enterprise **¥150 / ¥358** per seat·mo; 专属版 **¥2500 per seat·yr** (100 min); 私有化 = 个性化报价 | No | **Yes** — 私有化版 + 混合云 documented |
| **腾讯 CodeBuddy** | Tencent | Free tier + published **专有云** per-seat price | Free (100 credits); Pro **$10/mo**; Team **$40/seat/mo**; SaaS企业版 **¥198/seat/mo**; 专有云 **¥316/seat/mo** (100 min) | No | **Partial** — isolated tenancy (专有云), not offline |
| **Huawei CodeArts (码道)** | Huawei | Large-legacy-codebase understanding + HarmonyOS models; **CodeArts Snap is retired** | **¥0 / ¥98 / ¥198 / ¥498** per mo; credit-based since 2026-09-04 | No | **Partial** — requires Huawei Cloud; private path = Huawei Cloud Stack |
| **CodeFuse** | Ant Group | Only vendor with genuinely public flagship weights + code-search/repo-level models | **No public pricing** | Yes (weights public, **License: other**) | Technically self-hostable; `UNVERIFIED` as a supported offering |
| **aiXcoder** | 硅心科技 | **Strongest local story**: 内网-only agent + **CodeWiki codebase-analysis agent** + own 7B/4B open models | **No public pricing** (pricing pages 404); funnel is POC → 私有化上线 | Agents proprietary; **models open** (aiXcoder-7B 2,270★, aiXapply-4B) | **Yes — strongest**: *"全程在内网运行"*, *"端到端私有化"*, 国产芯片 |

---

### Chinese tools are privacy/on-prem driven — and it is a real differentiator, with a spectacular recent counterexample

**Yes, and it is structural, not marketing spin.** Three independent lines of primary evidence:

1. **Vendors sell deployment topology as the product.** Qoder CN's enterprise VPC tier (¥199/seat/month, 50-seat minimum) exists purely to satisfy *"银行、保险、政务"* data-compliance buyers, and its marketing headline is *"全链路在国内云上部署"* (`https://docs.qoder.cn/`, HTTP 200).
2. **There is a free local-inference path.** CodeGeeX documents Ollama-based local mode with *"no need to login"* and enterprise 私有化部署 where *"数据不会流出"* (HTTP 200, above).
3. **US tools are structurally cloud-only by comparison** — Copilot/Cursor/Claude Code all require shipping code to a vendor endpoint. That gap is real and it is why Chinese enterprise deals are won on deployment topology.

**The regulatory driver, and its operative clause.** 《生成式人工智能服务管理暂行办法》 (国家互联网信息办公室等七部门令第15号, passed 2023-05-23, **effective 2023-08-15**) — `https://www.cac.gov.cn/2023-07/13/c_1690898327029107.htm` and `https://www.gov.cn/zhengce/zhengceku/202307/content_6891752.htm` (PRIMARY government text). **Article 2 explicitly carves internal enterprise use out of the regime:**
> *"行业组织、企业、教育和科研机构、公共文化机构、有关专业机构等研发、应用生成式人工智能技术，**未向境内公众提供生成式人工智能服务的，不适用本办法的规定**。"*

And **Article 11** constrains retention: *"提供者对使用者的输入信息和使用记录应当依法履行保护义务，不得收集非必要个人信息，**不得非法留存能够识别使用者身份的输入信息和使用记录**…"*

**This is a concrete, citable procurement incentive:** an internal-only on-prem deployment sits *outside* the 生成式AI filing/备案 regime entirely — which is exactly why banks, SOEs and defence buyers (aiXcoder's and Comate's target customers) buy on-prem rather than public-cloud assistants. `UNVERIFIED: the 《数据出境安全评估办法》 text and its specific thresholds — not fetched; do not cite a threshold.`

**Vendor vocabulary is the tell:** across the eight Chinese vendors surveyed, **every one** advertises some isolation option — Trae *"数据不出域"*; Gitee *"私有化部署"/"信创一体机"*; Comate *"私有化版"/"模型私有化部署"*; CodeBuddy *"专有云"*; Huawei *"数据本地存储"*; Qoder CN *"VPC 私有部署"*; aiXcoder *"全程在内网运行"/"端到端私有化"*. **Zero** US vendors in the comparison set do this on their security pages:
- **GitHub Copilot** — air-gapped support is **brand new and explicitly pre-GA**: GitHub's changelog, **2026-09-08**, says admins can configure **Copilot CLI** to work with GHES *"for enterprises that operate in disconnected or air-gapped environments… **This capability is in technical preview and is subject to change**"* (`https://github.blog/changelog/2026-09-08-github-enterprise-server-3-22-is-now-generally-available/`, PRIMARY). Note the scope: Copilot **CLI** only.
- **Cursor** — **no on-prem**, and an explicitly China-excluding infrastructure posture: *"Cursor is a global product. **Cursor does not use or maintain any infrastructure in China.** We do not use any companies headquartered in China as subprocessors…"* (`https://cursor.com/security`, last updated 2026-08-25). Its privacy answer is **Privacy Mode**, a retention setting against a cloud backend. `UNVERIFIED: the exact scope of Cursor's "Self-Hosted Machines" — https://cursor.com/docs/cloud-agents/self-hosted-machines returned HTTP 404.`
- **Claude Code** — distributed via third-party clouds only (Bedrock / Claude Platform on AWS / Google Cloud Agent Platform / Microsoft Foundry), i.e. a *choice of cloud*, not a customer-datacenter install (`https://docs.anthropic.com/en/docs/claude-code/security`, nav only).

**Do not overstate it — and note that "私有化" is four different things.** In Chinese vendor marketing the term spans (1) an appliance/datacenter install, (2) **isolated tenancy in the vendor's own cloud** ("专有云/专属版", e.g. CodeBuddy ¥316/seat at 100 seats min; Huawei requiring Huawei Cloud), (3) an on-prem gateway with cloud inference, and (4) BYO-model. **Only (1) and (4) actually keep code off the vendor's infrastructure.** Several advertised "private" options are therefore (2), and Trae's own two pages contradict each other outright. Adding to that: private-deployment pricing is **quote-gated at every single vendor** (Comate 私有化 = *"个性化报价"*; Qoder CN VPC = *"联系商务获取方案与报价"*; aiXcoder = no pricing page at all).

**But the strongest single datapoint cuts the other way.** On **2026-09-18**, Zhipu's AI coding tool **ZCode** was publicly accused of uploading developers' code — and Zhipu **apologised and confirmed the mechanism**. Per IT之家: the cause was ZCode's *"代码库索引"* (codebase-indexing) feature, which exists to power checkpoint restore, history rollback **and `Repo Wiki`（代码仓库知识库）**; *"Repo Wiki 功能在生成 Wiki 页面（知识库页面）时，可能会触发仓库数据上传…由于该功能**上线初期默认开启**，导致部分用户受到影响"* (`https://www.ithome.com/0/100/4310.htm` HTTP 200, 2026-09-18). The remediation is unusually well documented: a patch on 2026-09-19, then on **2026-09-21** Zhipu announced it would **open-source ZCode** and hired two third parties to audit it. 36Kr, citing 界面新闻: **CAICT (中国信通院)** verified that *"the involved zcode-prod Alibaba Cloud OSS bucket currently has zero data on the cloud"*, and **NSFOCUS (绿盟科技)** found *"the updated ZCode v3.14.0 client has completed full rectification, **the Repo Wiki entry and the corresponding generation link have been removed**, and no functional paths that can trigger local repository snapshots or file exfiltration have been found"* (`https://eu.36kr.com/en/p/3992798380833792` HTTP 200). Zhipu also committed to *"zero data retention"* on its MaaS platform (北京日报 via Sina, `https://k.sina.cn/article_1893892941_70e2834d020023mv0.html?from=society` HTTP 200, 2026-09-21), while conceding that Batch/File APIs and legal-retention rules can still keep data *"30 天及以上"*.
`UNVERIFIED: a headline claims one developer had "42,411 files packed and 564 upload attempts" (mixed-news.com). The page returns HTTP 403 and I could not fetch it, so I do not assert those numbers.`

**What this means for Fieldguide:** a Chinese vendor with the loudest sovereignty narrative leaked local code to its own cloud **by default, via exactly the feature Fieldguide is built around** (building a repo index / repo wiki). "Local-first" is not a differentiated *feature* in this market — it is a **trust claim you either verify or lose on**. That is an opportunity, but it is a credibility story, not a feature checklist story.

---

## Part B — PKM / knowledge-tool overlap

### Obsidian — the sync target

**(a) Differentiated capability.** Local-first Markdown files in a folder you own, with a graph view, over a plugin ecosystem large enough to be a platform. Site copy: *"Your thoughts are yours. Obsidian stores notes privately on your device, so you can access them quickly, even offline. **No one else can read them, not even us.**"* and *"Obsidian uses open file formats, so you're never locked in."* (`https://obsidian.md/` HTTP 200).

**(b) Pricing with concrete numbers** (`https://obsidian.md/pricing` HTTP 200, fetched 2026-09-22):
- App: **free**, *"Free without limits. No sign-up required. No strings attached."*
- **Sync**: **$4** USD/user/month billed annually (**$5** monthly) — end-to-end encryption, version history, shared-vault collaboration.
- **Publish**: **$8** USD/site/month billed annually (**$10** monthly).
- **Catalyst**: **$25** USD one-time (early beta access, community badge).
- **Commercial license**: **$50** USD/user/year — **and it is now OPTIONAL.** *"Do I have to pay for commercial use? **No.** You are not required to pay for a commercial license, however if you are using Obsidian for work in an organization we encourage you to purchase a commercial license to keep Obsidian independent and 100% user-supported."* (pricing page FAQ, HTTP 200).
- The change is documented: *"Obsidian is now free for work"*, kepano, **February 20, 2025** — *"Starting today, the Obsidian Commercial license is optional. Anyone can use Obsidian for work, for free."* (`https://obsidian.md/blog/free-for-work/` HTTP 200).

**(c) Open source vs proprietary; local vs cloud.** **Proprietary but local-first** — the app is closed source, the *data* is plain-text Markdown on your disk, and cloud services (Sync/Publish) are strictly optional add-ons. This is the single most important structural fact for Fieldguide: **Obsidian's business model is "free local app, paid optional cloud."** Fieldguide syncing into Obsidian gives Obsidian value and Fieldguide nothing.

**(d) Owner, ecosystem size, and published numbers.**
- Owner: **Obsidian (Dynalist Inc.)**, independently owned, *"100% user-supported"*, no ads, no tracking, no account required.
- **Plugin ecosystem (live counter, `https://obsidian.md/plugins` HTTP 200):** *"Browse **7,919 plugins** and **788 themes** built by the community."* Category counts include **AI 935**, Integrations 1,182, Files 1,111, Visualization 755, Automation 705.
- **Official blog, May 12 2026** — *"The future of Obsidian plugins"* (`https://obsidian.md/blog/future-of-plugins/` HTTP 200): Obsidian launched *Obsidian Community*, and states *"Since the Obsidian API release in 2020, **more than 4,000 plugins and themes** have been created by our amazing community. Incredibly, **Obsidian plugins have passed 120 million total downloads!**"* Note the two figures measure different things (the blog's "4,000+" counts GitHub-submitted projects; the live site's 7,919 counts everything listed), and both are vendor-published.
- **Organisation/user stats** (`https://obsidian.md/blog/free-for-work/` HTTP 200, **vendor claims**): *"People in over **10,000 organizations** use Obsidian for work… Some of the largest organizations in the world, including **Amazon and Google**, have thousands of employees using Obsidian every day."* Marketing also advertises paid plugins and a CLI (nav includes Canvas, Mobile, Web Clipper, **CLI**). **No revenue figure is published anywhere I could fetch** — `UNVERIFIED: searched "Obsidian revenue ARR users statistics" ; the vendor publishes plugin/download/organisation counts but no revenue.`

---

### Notion — the counter-model (cloud-only, seat-priced, enterprise-gated privacy)

**(a) Differentiated capability.** An all-in-one cloud workspace, and for engineering the relevant framing is **centralised engineering docs and onboarding** rather than code understanding. Notion sells against this directly: the pricing page's own product nav leads with **Knowledge Base** ("Centralize your knowledge"), **Enterprise Search** ("Find answers instantly") and **Agents** ("Automate busywork"), and Business-tier features include **Premium connections** — *"Connect to GitHub, Asana & more"* (`https://www.notion.com/pricing`, HTTP 200).

**(b) Pricing — concrete numbers** (fetched 2026-09-22, USD, monthly mode; *"Save up to 20% with yearly"*):
| Tier | Price |
|---|---|
| Free | **$0** per member/month |
| Plus | **$10** per member/month |
| Business (Recommended) | **$20** per member/month |
| Enterprise | **Custom pricing** — "Contact Sales" |
Enterprise is where privacy features live: *"When using Notion AI, our LLM providers utilize **zero data retention** for Enterprise plan workspaces"*, plus SAML SSO, SCIM, audit log, private teamspaces, domain verification and DLP/SIEM connections. Note Business includes a *"Trial of Notion AI"* — AI is metered/upsold, not bundled.

**(c) Open source vs proprietary; local vs cloud.** **Proprietary, cloud-only.** There is no self-hosted or offline Notion. The strongest privacy guarantee available is a **contractual** one (zero data retention with LLM providers) available **only on Enterprise** — a useful contrast with the Chinese 私有化 norm and with Fieldguide's pitch.

**(d) Owner / strategic role.** Notion Labs. Strategic role relative to Fieldguide: Notion is where engineering docs *already* live in many teams, so Fieldguide's realistic relationship is "generates the artifact, Notion/Obsidian stores it," not head-on competition.

**How Notion is actually used for engineering onboarding — and the quote that names Fieldguide's wedge.** Notion's engineering template category shows **`1,123 Templates`**, broken into `Tech Spec 64`, `Sprint Planning Meeting 65`, `Scrum Board 112`, `Kanban 88`, `Engineering Tasks 191`, **`Eng Knowledge Base 21`** (`https://www.notion.com/templates/category/engineering`, HTTP 200). More usefully, a tagged customer story (`Use cases: Wiki, Employee Onboarding`) contains the best single articulation of the job:
> *"**If you're new to the codebase, reading our tech team's wiki is the best way to understand our approach and standards, and learn why past decisions got made.**"* — William Fong, Co-founder & CTO, Boxed (`https://www.notion.com/customers/boxed`, HTTP 200)

**Read that against Fieldguide:** the incumbent workflow for codebase onboarding is *a human writes a wiki, and the newcomer reads it.* That is the manual process Fieldguide automates — and the reason the wedge is real, but also why Fieldguide must beat a wiki, not beat Notion. `UNVERIFIED: a dedicated Notion "engineering" product/landing page — https://www.notion.com/engineering and /engineering-teams return HTTP 401 (auth-gated) from this environment; /use-case/engineering and /product/engineering aborted.`

---

### Anki — the SRS incumbent, and its pricing model is the whole point

**(a) Differentiated capability.** Spaced-repetition scheduling that works — *"Rate your recall with the most suitable option and Anki will schedule the next review for **when you're most likely to forget** the information."* Scale claim: *"Anki can handle decks of **100,000+ cards** with no problems."* (`https://apps.ankiweb.net/`, HTTP 200.)

**(b) Pricing / platforms — concrete numbers, and the model is the lesson:**
- **Desktop (Windows/macOS/Linux): free.** *"The free computer version is available for all major platforms."* Current version **26.09.2**.
- **AnkiWeb sync: free.** *"The free AnkiWeb synchronization service lets you sync your cards across devices."*
- **AnkiDroid (Android): free**, and community-maintained — *"AnkiDroid for Android is free and developed by contributors."*
- **AnkiMobile (official iOS): the paid one.** *"AnkiMobile is the official iOS app and **all purchases help fund Anki's development**."* Price **$24.99 one-time (lifetime)** per the official Anki forum (*"AnkiMobile ($24.99/Lifetime, one time only) Official Anki developed app"*, `https://forums.ankiweb.net/t/why-is-this-app-this-expensive-in-app-store/67593`, fetched HTTP 200 — **official forum, community-authored answer, medium confidence for the figure**; I could not get a price from the App Store page, which resolved to a locale-generic "Today" page, so `UNVERIFIED via Apple as primary`).
- **Open source:** yes — *"open source — If you know how to code you could help maintain Anki or create new add-ons/features."* Repo `ankitects/anki`: **31,422 stars** (2026-09-22). Trademark holder: **Ankitects Pty Ltd**.
- **The business-model lesson:** Anki funds a *free* desktop/Android/sync product with **a one-time paid iOS app** — monetising platform convenience, not the algorithm. It is the closest existing analogue to "free local-first tool, paid convenience tier."

**(c) Does any dev tool do SRS for code? — Partially, and the honest answer is uncomfortable for Fieldguide.**
`UNVERIFIED / PARTIALLY REFUTED: I set out to establish that SRS-on-a-codebase is unserved. It is not served at scale, but it IS attempted, for free:`
- **`jerryjiao/ai-study-kit`** — **0 stars**, **MIT**. *"对 AI 说一句「我想学 X」，教练先和你对齐考点，再出题、产课，带你练到会…**错题按考点讲透，复习自动排队**，进度跨设备同步。免费开源"* — i.e. courses + flashcards + **an SRS review queue** + wrong-answer analysis + cross-device progress + explicit **interview-prep** positioning (*"面试备战（八股文 / 系统设计）"*). It ships as a Claude Code / `zcode` / Cursor plugin (`https://raw.githubusercontent.com/jerryjiao/ai-study-kit/main/README.md`, HTTP 200). **This is Fieldguide's entire learning loop, free, MIT — with 0 stars.**
- **`rox1694125-bit/magic-memory`** — **3 stars**, MIT. *"An AI concept-learning coach: intuition-first teaching + spaced-repetition flashcards. Understand AND remember. Portable across Claude Code, Codex, and any agent."*
- **`DavidMiserak/GoCard`** — **58 stars**. *"A lightweight file-based spaced repetition system (SRS) that uses plain Markdown files for flashcards. Perfect for developers who prefer text files, Git version control, and keyboard-driven interfaces."*
- **Academic angle:** an NCKU 2026 project poster titled *"Anti-Copilot: 以多代理協作與間隔重複將 IDE 卡關訊號轉化為適應性程式學習器徑"* (multi-agent collaboration + spaced repetition, turning IDE stuck-signals into an adaptive programming learning path) — `https://www.csie.ncku.edu.tw/php/csie_project/data/csie/2026/asset/poster/E-11.pdf` returns HTTP 200 (2.8 MB PDF). **Title-only evidence: I verified the document exists but did not extract its text.**

**Read this carefully:** SRS-for-code is **unclaimed at scale AND unvalidated**. That is *not* the same as "proven opportunity." The absence of a winner is genuine whitespace; the presence of free MIT attempts with ~0 stars is evidence that **nobody has yet demonstrated demand**. Treat the SRS wedge as a hypothesis to test with users, not a moat you already own.

---

### Foam / Dendron / Quartz / Logseq / Roam — "Obsidian but for X" has repeatedly not become a business

**All star counts fetched 2026-09-22 from `github.com/<owner>/<repo>` HTML; none archived.**

| Tool | Stars | Licence | What it is |
|---|---|---|---|
| **Logseq** | **45,013** | **AGPL-3.0** | Open-source local-first outliner/graph PKM. |
| **Foam** | **17,409** | custom (parsed as "Foam is…", not a standard SPDX id) | *"A personal knowledge management and sharing system for **VSCode**."* |
| **Quartz** | **13,279** | **MIT** | *"a fast, batteries-included static-site generator that transforms Markdown content into fully functional websites"* — the standard Obsidian-publish substitute. |
| **Dendron** | **7,468** | **Apache-2.0** | *"The personal knowledge management (PKM) tool that grows as you do!"* |
| `obsidianmd/obsidian-releases` | 21,772 | — | Community plugin/theme list (context for the ecosystem size). |

**The pattern worth noticing:** *"Obsidian, but built on VS Code / but hierarchical / but a static site"* has been attempted at least four times, each attracted 7k–45k stars, and **none of them became the Obsidian for anything** — Logseq is AGPL and community-funded, Foam is a VS Code extension, Dendron is best known for entering maintenance. **Reimplementing the notes/graph substrate is the losing move.** Fieldguide should not build a vault; it should write into one.

**Logseq — pricing verified (donation tiers, not SaaS).** Logseq's own site is a JS shell, but its funding page is readable: `https://opencollective.com/logseq` (HTTP 200) prints the free-tier policy verbatim — *"Both the desktop and web app don't and will not require a commercial license for both personal usage and company usage…"* — plus tiers **Backers `$5 USD / month`** (listed contributions **+ 12,148**), **Sponsors `$15 USD / month`** (+ 11,020), **Bronze Sponsors `$100 USD / month`** (+ 6), **Silver Sponsors `$250 USD / month`**. So Logseq monetises by **donation tiers that gate early access** (the $5/$15 tiers include *"Early access to insider builds… exclusive access to Logseq DB"*), **not** a published Sync price — `UNVERIFIED: a standalone Logseq Sync monthly price; none is published.` GitHub: **45,013★, AGPL-3.0, not archived, `pushed=2026-09-22`** (same day as this research — actively maintained).
**The strategic event worth knowing:** Logseq **split in April 2026** into **"Logseq OG"** (file-based Markdown graphs, new repo `logseq/og`, *"will continue to be maintained. It will receive security and Electron… upgrades, but no new features"*) and a **new SQLite-backed DB version** for sync/collaboration, because — in their words — *"Logseq's DB graphs live in SQLite. That's great for queries and structure, but it makes it harder to use the rest of your tooling — backups, grep, version control, other markdown editors — against your notes."* They had to build a **"Markdown Mirror"** projection to get plain files back (`https://logseq.io/p/e3YDyX5AYr`, dated 2026-04-24, HTTP 200; `https://discuss.logseq.com/t/whats-new-with-logseq-db-may-16th-2026/35020`, HTTP 200). **This is the clearest evidence available that moving a local-first tool off plain Markdown is a costly mistake — and a direct vindication of Fieldguide's decision to stay Markdown/Obsidian-compatible.**

**Roam Research — pricing recovered from the app's own JS bundle (best available primary source).** Roam's marketing site is a client-rendered SPA (4,766 bytes, text = *"Roam Research – A note taking tool for networked thought."*); `/pricing` and `/help` both return **404**. Prices were extracted from Roam's own shipped bundle `https://roamresearch.com/js/compiled/main.js` (HTTP 200, 2,979,076 bytes, fetched 2026-09-22), whose pricing component contains adjacent string literals: plan **"Pro"** = **`$15` `/ month`** and **`$180 / year`** (a second variant **`$165` `/ year`** / **`$13.75 / month`**); plan **"Believer"** = **`$500` `/ 5 years`** (sub-label `$8.33 / month, $100 / year`). Trial: *"You'll be charged after 31 days"*. **Closed-source, cloud-only** — no on-prem option in the pricing component. `UNVERIFIED: Roam user numbers, revenue, layoffs or a verified decline — no primary source publishes any, and the available search results are aggregators/SEO pages (PitchBook, CB Insights, etc.) which are explicitly LOW-CONFIDENCE and unused here.` The verifiable structural fact: **Roam's pricing looks unchanged from its 2020 launch while its nearest open-source rival (Logseq, 45,013★, AGPL-3.0) is free** — the same "free local wins" dynamic that threatens any paid desktop knowledge tool.

---

### The "Obsidian for codebases" question — answered, and the answer is uncomfortable

**It already exists. Several times over. And the most complete one has 120,422 stars.**

#### graphify — `Graphify-Labs/graphify` (= `safishamsi/graphify`)

- **Stars: 120,422** (fetched 2026-09-22; confirmed three ways — `title="120,422"`, `"stargazerCount":120422`, and `aria-label="120422 users starred this repository"`). **License: Apache-2.0.** Not archived.
- **What it does — this is Fieldguide's headline feature, verbatim:** official description *"Turn **any codebase**, with its docs, SQL schemas, configs, and PDFs, into a **queryable knowledge graph**. A `/graphify` skill for Claude Code, Cursor, Codex, and Gemini CLI: **local deterministic AST parsing**…"* (repo og:description, HTTP 200).
- **It outputs an Obsidian vault.** The documented output tree is `graphify-out/` containing `graph.html` (interactive graph — click nodes, search, filter by community), **`obsidian/` ("open as Obsidian vault")**, `wiki/` (Wikipedia-style articles), `GRAPH_REPORT.md` ("god nodes, surprising connections, **suggested questions**"), `graph.json` (persistent graph — "query weeks later without re-reading"), `cache/` (SHA256, incremental). (`https://raw.githubusercontent.com/Graphify-Labs/graphify/main/README.md` HTTP 200.)
- **It does the arXiv bridge too:** `/graphify add https://arxiv.org/abs/1706.03762` — *"fetch a paper, save, update graph"*; and *"**Surprising connections** … Code-paper edges rank higher than code-code."* Plus `--watch` auto-sync, a post-commit git hook (`graphify hook install`), an MCP stdio server, and GraphML/SVG/Neo4j exports. It claims a **71.5×** token-reduction benchmark (vendor claim).
- **Commercial viability: YES — this is not a hobby project, it is a YC-funded company occupying Fieldguide's exact position.** `graphify` is the distribution wedge for **Graphify Labs**, which is in **Y Combinator Summer 2026**. YC's company page describes it as: *"**On-device Knowledge Graph engine for Enterprise Software**… Graphify is a Knowledge Graph control plane for enterprise software. The open-source tool has **116K+ GitHub stars and 6.5M+ downloads**, and is used in production by engineers at **Shopify, Datadog, JP Morgan, American Express, Harvey, Automation Anywhere, and Vanguard**… The graph updates itself as the code changes and keeps context instead of forgetting it… **It runs entirely inside your perimeter, fully air-gapped on-premise or self-hosted in your own cloud, so no code or data ever leaves your environment.**"* (`https://www.ycombinator.com/companies/graphify-labs`, HTTP 200). Founder/CEO **Safi Shamsi**, YC S26.
  The YC launch post adds the traction numbers and — critically — **names Fieldguide's job-to-be-done**: *"**108K+ GitHub stars**: one of the top five open-source projects ever from a YC company, and the first to cross 100K⭐ mid-batch; **5M+ downloads** of the open-source engine; **6,000+ signups on the platform in its first weeks**"*, and *"It groups the code into **communities, the real subsystems, so teams can plan, onboard, and understand the arc**…"* Its enterprise layer *"reviews every pull request and formally verifies each code change"* (`https://www.ycombinator.com/launches/SvA-graphify-labs-knowledge-graph-engine-for-enterprises`, HTTP 200). The company announcement is `https://github.com/Graphify-Labs/graphify/discussions/983` (HTTP 200). Site: `https://www.graphify.com/`.
  **Read this against Fieldguide's pitch literally:** "on-device / air-gapped / self-hosted, nothing leaves your environment" + "knowledge graph of the whole codebase" + "helps you onboard and understand" + "works inside Claude Code/Cursor via MCP" — every clause is Fieldguide's positioning, shipped, funded, and in production at JP Morgan and Amex. *(Adoption and customer claims are vendor/YC-published, not independently audited.)*
- **Adjacent monetisation in the same ecosystem:** `lucasrosati/claude-code-memory-setup` (**991 stars, MIT**) packages *"Obsidian + Graphify"* for *"persistent memory, **codebase knowledge graphs**"*.

**Verdict on the specific claim in the brief:** Fieldguide's *"build an interactive knowledge graph of a codebase, bridge arXiv papers to code nodes, and optionally sync into Obsidian as cards"* is, as a capability bundle, **already shipped, free, Apache-2.0, by a 120k-star project that is now a funded YC company selling the air-gapped on-prem version to enterprises** — minus the spaced-repetition/progress layer.

#### GitNexus — `abhigyanpatwari/GitNexus`

- **Stars: 47,515** (fetched 2026-09-22). **License: PolyForm Noncommercial 1.0.0** — source-available, **not** open source for commercial use. Not archived.
- **Zero-server, local-first by name:** *"GitNexus: The **Zero-Server** Code Intelligence Engine"*, and *"The context engine for **Enterprise Codebases**. **Indexes any codebase into a knowledge graph** — every dependency, call chain, cluster, and execution flow — then exposes it through **smart MCP tools** so AI agents never miss code."* It positions itself directly against the free cloud tools: *"Like DeepWiki, but deeper. DeepWiki helps you *understand* code. GitNexus lets you *analyze* it — a knowledge graph tracks every relationship, not just descriptions."* (README, HTTP 200.)
- **Commercial viability: the strongest signal in this whole report.** A **non-commercial** licence plus an "Enterprise Codebases" pitch plus an official Web UI, npm package and Discord is the textbook shape of an **open-core / dual-licence commercial play** — i.e. someone is already monetising exactly Fieldguide's graph engine.

#### codebase-to-course — the guided-tour + progress + quiz layer, free

- **`zarazhangrui/codebase-to-course`: 5,581 stars** (fetched 2026-09-22). Description: *"A Claude Code skill that turns any codebase into a beautiful, interactive single-page HTML course for non-technical vibe coders."*
- **Correction to the brief:** the brief cites **`oil-oil/codebase-to-course`**. That repo has **1 star** and its page says **"forked from"** — it is a **fork**. The original, with **5,581 stars**, is `zarazhangrui/codebase-to-course` (by Zara Zhang). Cite the right repo or the evidence reads as a strawman.
- **Feature overlap is near-total with Fieldguide's "guided tours":** *"Scroll-based modules with **progress tracking** and keyboard navigation"*, *"Code ↔ Plain English translations"*, *"Animated visualizations — data flow animations, group chat between components, **architecture diagrams**"*, *"**Interactive quizzes** that test *application* not memorization ('You want to add favorites — which files change?')"*, glossary tooltips, and a metric on the same axis as Fieldguide's interview questions. Output is *"a single HTML file — no dependencies, no setup, **works offline**"*. (README, HTTP 200.)
- Its design philosophy directly overlaps Fieldguide's *"turn an unfamiliar repository into your own project"* pitch: *"**Build first, understand later.** This inverts traditional CS education… **build something → experience it working → now understand how it works.**"* The target audience is named as *"vibe coders"* — people who ship with AI and don't understand the code.
- **Commercial viability: none found.** No licence file detected, no pricing, no company — a single-author Claude Code skill.

#### The wider cluster is far bigger than it looks: **542 repositories**, and two more with 44,000+ stars

A GitHub repository search for `codebase knowledge graph` returns **`total_count=542`** (fetched 2026-09-22). The head of that distribution, sorted by stars, is a wall of well-licensed competitors *(all star counts and licences as of 2026-09-22; descriptions verbatim)*:

| Tool | Repo | Stars | Licence | Description |
|---|---|---|---|---|
| **Graphify** | `Graphify-Labs/graphify` | **120,422** | Apache-2.0 | *"Turn any codebase… into a queryable knowledge graph… local deterministic AST parsing"* |
| **codebase-memory-mcp** | `DeusData/codebase-memory-mcp` | **44,139** | **MIT** | *"High-performance code intelligence MCP server. Indexes codebases into a **persistent knowledge graph** — average repo in milliseconds. **158 languages**, sub-ms queries, **99% fewer tokens**. Single static binary, zero dependencies."* |
| code-graph-rag | `vitali87/code-graph-rag` | 5,167 | MIT | *"The ultimate RAG for your monorepo. Query, understand, and edit multi-language codebases with the power of AI and knowledge graphs"* |
| SocratiCode | `giancarloerra/SocratiCode` | 3,318 | AGPL-3.0 | *"Enterprise-grade (40m+ LOC) codebase intelligence, zero-setup, **local & private** Plugin/Skill/Extension or MCP: hybrid semantic search, polyglot dependency graphs, symbol-level impact analysis & call-flow, **interactive HTML viewer**… Cloud in beta."* |
| **lat.md** | **`vercel-labs/lat.md`** | **1,986** | **MIT** | *"Agent Lattice: a **knowledge graph for your codebase, written in markdown**."* — **a Vercel Labs project** |
| Prometheus | `EuniAI/Prometheus` | 1,128 | GPL-3.0 | *"A Knowledge-Graph-Driven AI Agent that maps, understands, and repairs complex codebases"* |
| claude-code-memory-setup | `lucasrosati/...` | 991 | MIT | Obsidian + Graphify codebase knowledge graphs |
| axon | `harshkedia177/axon` | 814 | none | *"Graph-powered code intelligence engine — indexes codebases into a knowledge graph, exposed via MCP tools"* |
| octocode | `Muvon/octocode` | 477 | Apache-2.0 | *"Structural code intelligence for AI agents — semantic search, knowledge graphs… in one Rust binary."* |
| **google-surf-mcp** | `HarimxChoi/google-surf-mcp` | 290 | MIT | *"Turn Google Search, **Papers**, and Codebases into an Automatic **Local** Knowledge Graph for AI Agents."* — **the closest existing analogue to Fieldguide's arXiv-to-code linking** |
| **graphmind** | `aouicher/graphmind` | 212 | MIT | *"**Local-first** code intelligence for AI assistants. Turns your codebase into a knowledge graph your AI can query, navigate, and remember. 25 MCP tools."* |
| opentrace | `opentrace/opentrace` | 107 | Apache-2.0 | *"maps system architecture, code structure, and service relationships giving you a **visual, queryable map**"* |
| **obsidian-sync-skill** | `CzhJing/obsidian-sync-skill` | **0** | MIT | *"Obsidian 同步助手…自动分析项目代码库,创建本地LLM-wiki"* — codebase → **Obsidian** architecture graph, with a *"graph first, source code second"* rule |

**Three things to take from this table:**
1. **The category is validated demand with the wrong interface for Fieldguide.** Nearly every project is aimed at *feeding an AI agent* or *reducing tokens* — not at helping a human learn. `graphmind` (*"Local-first"*, 212★) and `SocratiCode` (*"local & private"*, 3,318★) are the only ones claiming local-first + visual positioning, and **neither is a desktop app with human pedagogy (tours, SRS, papers)**.
2. **`vercel-labs/lat.md` is the "a big company might just do this" signal** — Vercel Labs shipping an MIT-licensed, markdown-native codebase knowledge graph means the substrate is being commoditised by infrastructure vendors, not just hobbyists.
3. **The demand signal for "codebase → Obsidian graph" is genuinely unconsumed:** `obsidian-sync-skill` does exactly that and has **0 stars**; `mrjw717/obsidian-code-graph` does the graph-in-vault version and has **9 stars**; `lucasrosati/claude-code-memory-setup` (991★) is the only one with real traction, and it is a Claude Code config, not a product. **This is whitespace — but whitespace with three failed/ignored attempts already in it.**

#### Real "Obsidian for codebases" plugins exist — but are not commercially validated

- **`mrjw717/obsidian-code-graph`** — **9 stars**, 0BSD licence. *"Code Graph turns your vault into a navigable knowledge graph of your codebase. It parses source files with **tree-sitter**, extracts typed relationships (imports, calls, inherits, implements, uses-type, contains), and renders them as a **force-directed graph** you can explore, filter, and drill into — right next to your Obsidian notes."* Also does symbol-level nodes, TODO/FIXME heat colouring, and a docs protocol (`@see`, `@tested-by`, `@adr`). **This is literally "Obsidian for codebases", shipped as an Obsidian plugin — and it has 9 stars**, i.e. almost nobody wants it in this form. That is arguably the single most useful negative datapoint in this report.
- **`topoteretes/cognee`** — **30,910 stars**, Apache-2.0. *"the open-source AI memory platform for agents… **self-hosted knowledge graph engine**."* Local-first memory/graph, but agent-memory-framed rather than human-learning-framed.
- **`yamadashy/repomix`** — **28,459 stars** (licence field parsed as "…This project is…", i.e. a custom/`u003e` wrapper — not confirmed as a standard SPDX id). Packs a repo for LLM consumption: adjacent, not identical.

---

### Cloud incumbents that already own "understand any repo" — DeepWiki and Google Code Wiki

These are not Chinese and not PKM, but they are the two products that most directly delete the *"I don't understand this repo"* job Fieldguide is selling, so they belong in the verdict.

**DeepWiki (Cognition / Devin).** Launched **2025-05-05**. Official: *"we're launching DeepWiki, the **free public version** of Devin Wiki and Devin Search. Visit the DeepWiki for any repo by replacing github.com with deepwiki.com in the URL. **We've already indexed over 50,000 of the top public GitHub repos**… Add any public repo for free at deepwiki.com. **For private repos, sign up for a Devin account.**"* (`https://cognition.com/blog/deepwiki` HTTP 200.) So: free for public repos, funnel-to-Devin for private. Its homepage live-indexes well-known repos with star counts (e.g. `microsoft/vscode` 192.6k, `huggingface/transformers` 166.2k) — `https://deepwiki.com/` HTTP 200. Zhipu's own i18n lists `deepwiki` as a Zread keyword, i.e. Zread is explicitly positioned against it.

**Google Code Wiki.** Launched in **public preview on 2025-11-13** by Google Cloud (`https://developers.googleblog.com/en/introducing-code-wiki-accelerating-your-code-understanding/` HTTP 200). It is a near-feature-for-feature overlap with Fieldguide's core:
- *"maintains a **continuously updated, structured wiki** for every repository"* — regenerated after every change;
- *"The entire, always-current wiki serves as the knowledge base for an **integrated chat**… You're not talking to a generic model, but to one that **knows your repo end-to-end**"* (Gemini-powered) — Fieldguide's graph-grounded Q&A coach;
- *"Every wiki section and chat answer is **hyper-linked directly to the relevant code files and definitions**"* — Fieldguide's graph anchoring;
- *"automatically generates always-current **architecture, class, and sequence diagrams**"* — Fieldguide's layers/architecture views;
- onboarding framing: *"**New contributors can make their first commit on Day 1**, while senior developers can understand new libraries in minutes, not days."*
- **And it is coming local:** *"We're building a **Gemini CLI extension** for Code Wiki so teams can **run the same system locally and securely on internal repositories.**"*

That last sentence is the most consequential line in this report for positioning: **Google has publicly committed to a local, on-prem path for repo-understanding.** "Local-first" alone will not be a moat even against the hyperscalers, let alone against 120k-star open-source.

---

## Implications

1. **Honest verdict: most of Fieldguide's feature list is already commoditised — and the strongest competitors are funded projects doing the *same* local-first pitch.** A GitHub search for `codebase knowledge graph` returns **542 repositories**. `graphify` (120,422★, Apache-2.0) does codebase→queryable knowledge graph, arXiv→graph→code edges, Obsidian-vault export, interactive graph HTML, suggested questions, auto-sync and MCP — and it is the distribution wedge for **Graphify Labs, YC Summer 2026**, whose YC page literally sells *"On-device Knowledge Graph engine for Enterprise Software"* that *"runs entirely inside your perimeter, fully air-gapped on-premise or self-hosted in your own cloud, so no code or data ever leaves your environment"*, with claimed production use at **Shopify, Datadog, JP Morgan, American Express and Vanguard** and *"6,000+ signups on the platform in its first weeks"*. `DeusData/codebase-memory-mcp` (44,139★, **MIT**) indexes codebases into a *"persistent knowledge graph"* in 158 languages with a single static binary. **Vercel Labs** ships `lat.md` (1,986★, MIT) — *"a knowledge graph for your codebase, written in markdown."* `codebase-to-course` (5,581★) does guided tours, progress tracking, architecture visuals and quizzes. Chinese vendors do repo Q&A for ¥59/month or free. **The PM's instinct is correct, and the "local-first / on-prem" axis is already taken by a better-funded team.**
2. **The learning *loop* is the least-served layer — but be honest that it is unclaimed AND unvalidated.** Every commodity tool above generates understanding *artifacts* (wikis, graphs, courses). None I verified closes the loop with **spaced repetition, retention scheduling, and mastery tracking** — codebase-to-course has "progress tracking" (scroll position), not SRS, and none of the ten Chinese vendors does it at all. **However**, free MIT attempts already exist and nobody uses them: `jerryjiao/ai-study-kit` (**0 stars**) already ships courses + flashcards + an SRS review queue + cross-device progress + interview-prep framing as a Claude Code plugin; `rox1694125-bit/magic-memory` has **3 stars**; `DavidMiserak/GoCard` has **58 stars**. So SRS-on-a-codebase is genuine whitespace, not a proven market — it is a **hypothesis to test with users**, and its low traction is itself evidence that demand must be demonstrated, not assumed.
3. **Kill "sync to Obsidian" as a value proposition and reframe it as distribution — and stay on plain Markdown.** Obsidian is free, the commercial licence is now optional, and it has 7,919 plugins and 935 AI plugins; the vault is plain Markdown. Obsidian gains, Fieldguide gains nothing defensively — but a good export is cheap distribution into a 10,000-organisation installed base. **The Logseq counter-example proves the point:** in April 2026 Logseq moved its graphs into SQLite and immediately had to build a *"Markdown Mirror"* back-projection because — in the vendor's own words — SQLite *"makes it harder to use the rest of your tooling — backups, grep, version control, other markdown editors — against your notes."* Staying Markdown-native is correct. Treat Obsidian as a **channel**, not a feature.
4. **"Local-first" is a trust claim to be verified, not a feature to be listed.** The ZCode incident (2026-09-18→21) is the sharpest evidence available: a "sovereignty" vendor shipped codebase indexing **default-on** and uploaded repo data to power a `Repo Wiki`; it took an apology, a hotfix, a forced open-sourcing, two third-party audits and removal of the feature to recover. Fieldguide should ship an auditable no-egress default, a local-model path, and a public data-flow statement — and lead marketing with that, because Chinese enterprise buyers already pay ¥199/seat/month for it.
5. **Expect "local-first" to stop being differentiating within ~2 quarters — it already isn't.** Google's Code Wiki Gemini CLI extension is explicitly *"run the same system locally and securely on internal repositories"*; Graphify Labs already ships *"fully air-gapped on-premise"* today; CodeGeeX4-ALL-9B does repository-level Q&A locally via Ollama with *"no need to login"* (Apache-2.0 code, research-only weights); aiXcoder's CodeAgent runs *"全程在内网运行"*. Build the moat on the learning loop and the private-corpus workflow, not on "it runs on your machine."
6. **Price anchoring is brutal and worth internalising.** Free (Zread, CodeGeeX plugins, DeepWiki public, graphify, Code Wiki preview), ¥59/month individual Pro (Qoder CN), ¥99–199/seat/month enterprise (Qoder CN), $18/month GLM Coding Plan. A desktop app must justify itself against **zero** for the comprehension features and against **~¥60/month** for AI depth.
7. **The commercial signal to copy is Graphify Labs's, and it tells you what to avoid.** Graphify Labs (YC S26) monetises **the enterprise control plane around an Apache-2.0 core** — open-source the graph engine for distribution, then sell air-gapped on-prem deployment plus formal PR verification to regulated enterprises. GitNexus (47,515★) does the closer variant: a **PolyForm Noncommercial** licence on a *"Zero-Server Code Intelligence Engine"* for *"Enterprise Codebases"* (open-core/dual-licence). Both mean **the enterprise on-prem knowledge-graph niche is already claimed by two funded/source-available players.** Fieldguide cannot win it by being "also local-first"; it would have to win on the learning loop, which neither of them does.
8. **The most useful negative datapoint: `mrjw717/obsidian-code-graph` has 9 stars.** "Put a code graph in my Obsidian vault" is technically solved and demonstrably unwanted in that form. Do not build Fieldguide as an Obsidian plugin; build a workbench that *exports* to Obsidian.
9. **Fight on the onboarding/on-call moment, not on documentation generation.** Google Code Wiki's own pitch — *"New contributors can make their first commit on Day 1"* — and codebase-to-course's *"vibe coders… steer AI coding tools better, detect when AI is wrong, debug when AI gets stuck"* both aim at the same user. Fieldguide's SRS + interview-question angle is the only lever that turns "I read the docs" into "I can be held accountable in a review," which is what an engineer being onboarded actually fears.
10. **Feature-by-feature commoditisation scorecard (honest — and the answer is "most of them"):** codebase knowledge graph — **commoditised, 542 repos, head at 120,422★ and 44,139★** (graphify, codebase-memory-mcp, GitNexus 47,515★, cognee 30,910★). Architecture/layer views — **commoditised** (Google Code Wiki auto-generates architecture/class/sequence diagrams; graphify; SocratiCode's *"interactive HTML viewer"*). Repo Q&A grounded in the repo — **commoditised and free** (Zread, DeepWiki, Code Wiki, Qoder CN from ¥59/mo). arXiv→code linking — **commoditised** (graphify `add <arxiv-url>` + code-paper edge ranking; `google-surf-mcp` 290★ turns *"Google Search, Papers, and Codebases into an Automatic Local Knowledge Graph"*). Markdown/Obsidian-native codebase graph — **commoditised** (graphify emits an Obsidian vault; **Vercel Labs' `lat.md`** is *"a knowledge graph for your codebase, written in markdown"*). Guided tours/progress/quizzes — **commoditised** (codebase-to-course 5,581★). Codebase→wiki docs on your own repo, on-prem — **commoditised** (Zread CLI; Google Code Wiki's planned local Gemini CLI extension; **aiXcoder CodeWiki**: *"代码库分析与文档智能体…随代码变更实时更新，企业内网共享"*). What remains genuinely uncommoditised: **a durable, locally-owned *learning* artifact — SRS-scheduled mastery with interview-accountability on a live codebase.** The sub-research's sharper framing: every Chinese vendor, including the 私有化 ones, treats codebase understanding as a **transient context window** or a generated document, and every Western OSS project in the 542-repo cluster aims it at **an AI agent's token budget**, never at a human's memory. That distinction — not "on-prem" — is the claim worth testing.

---

### Verification / fetch log

**Fetched successfully (HTTP 200) and used above:**

| URL | What it establishes |
|---|---|
| `https://zread.ai` | Zread features, "Subscription"=repo tracking, Zread CLI for local repos, notes tool, meta keywords |
| `https://zread.ai/subscription` | Client-rendered "Subscribe a repo to tracking its updates" |
| `https://docs.z.ai/devpack/mcp/zread-mcp-server` | Zread MCP is exclusive to GLM Coding Plan users |
| `https://docs.z.ai/devpack/overview.md` | "Starting at just 18 USD per month"; Lite/Pro/Max credits 2,000/12,000/28,000 |
| `https://docs.z.ai/llms.txt`, `https://z.ai/subscribe` | "Plans from $18/month" |
| `https://docs.z.ai/guides/overview/pricing.md` | GLM model token prices (USD) |
| `https://docs.z.ai/devpack/notice/usage-revision.md` | Credits migration, published 2026-07-30 |
| `https://www.pingwest.com/w/306654` | Zread official launch with GLM-4.5, 2025-08-05 |
| `https://www.chinaz.com/ainews/19852.shtml` | Zread.AI launch reported 2025-07-22, DeepWiki comparison |
| `https://www.chinaz.com/ainews/20222.shtml` | Zhipu chose GLM-4.5 as Zread's base model |
| `https://www.aihub.cn/tools/coding/zread/` (LOW-CONFIDENCE aggregator) | "free to use, no login, no registration" |
| `https://www.alibabacloud.com/help/zh/lingma/billing-description` | Full Qoder CN price table in RMB; rename date; credits |
| `https://www.alibabacloud.com/zh/product/lingma` | Alibaba CTO 34% AI-code-generation vendor claim |
| `https://lingma.aliyun.com/` | "企业免费开通 个人免费使用"; 百万开发者 vendor claim; Gartner claim |
| `https://docs.qoder.cn/` | Rename 2026-05-20; 国产大模型/国内部署; VPC; Repo Wiki; product family |
| `https://raw.githubusercontent.com/zai-org/CodeGeeX4/main/README.md` | 9B model does repository-level Q&A; Apache-2.0 code; research-only weights |
| `https://raw.githubusercontent.com/zai-org/CodeGeeX4/main/LICENSE` | Verbatim Apache License 2.0 |
| `https://raw.githubusercontent.com/zai-org/CodeGeeX4/main/guides/Local_mode_guideline.md` | Local mode via Ollama, "no need to login" |
| `https://raw.githubusercontent.com/zai-org/CodeGeeX/main/README.md` | CodeGeeX lineage, KDD 2023, model download page |
| `https://github.com/zai-org/CodeGeeX`, `.../CodeGeeX4` | Stars 8,807 / 2,593; not archived |
| `https://www.w3cschool.cn/codegeex/product-related.html` (third-party mirror of Zhipu's wiki) | "IDE插件市场的 CodeGeeX 都是免费使用的"; 私有化部署, data does not leave |
| `https://www.ithome.com/0/100/4310.htm` | ZCode 代码库索引 caused uploads; Repo Wiki; default-on; apology 2026-09-18 |
| `https://eu.36kr.com/en/p/3992798380833792` | ZCode to be open-sourced; CAICT + NSFOCUS audit findings; Repo Wiki entry removed |
| `https://k.sina.cn/article_1893892941_70e2834d020023mv0.html?from=society` | 北京日报: open-sourcing, third-party audit, zero-data-retention, 30-day caveat |
| `https://www.jjckb.cn/20260901/511a6bc8f7f84993ae650efdee76830f/c.html` | Zhipu: tokens +40×, inference cost −80%, H1 revenue > all of 2025 |
| `https://obsidian.md/pricing` | Sync $4/$5, Publish $8/$10, Catalyst $25, Commercial $50 & optional |
| `https://obsidian.md/blog/free-for-work/` | Free for work since 2025-02-20; 10,000+ orgs (vendor claim) |
| `https://obsidian.md/` | Local-first pitch, "not even us", open formats |
| `https://obsidian.md/plugins` | **7,919 plugins**, 788 themes, AI category 935 |
| `https://obsidian.md/blog/future-of-plugins/` | 4,000+ plugins/themes; **120 million** total plugin downloads |
| `https://raw.githubusercontent.com/Graphify-Labs/graphify/main/README.md` | Obsidian vault output, arXiv ingestion, suggested questions, watch/hook/MCP |
| `https://github.com/Graphify-Labs/graphify` (+`safishamsi/graphify`) | **120,422★**, Apache-2.0, og:description |
| `https://raw.githubusercontent.com/abhigyanpatwari/GitNexus/main/README.md` | Zero-Server; knowledge graph; "Like DeepWiki, but deeper" |
| `https://github.com/abhigyanpatwari/GitNexus` | **47,515★**, PolyForm Noncommercial |
| `https://raw.githubusercontent.com/zarazhangrui/codebase-to-course/main/README.md` | Modules, progress tracking, quizzes, offline single HTML |
| `https://github.com/zarazhangrui/codebase-to-course` | **5,581★** (the real original) |
| `https://github.com/oil-oil/codebase-to-course` | **1★**, "forked from" — it is a fork |
| `https://raw.githubusercontent.com/mrjw717/obsidian-code-graph/main/README.md` | tree-sitter code graph inside Obsidian |
| `https://github.com/mrjw717/obsidian-code-graph` | **9★**, 0BSD |
| `https://github.com/topoteretes/cognee` | **30,910★**, Apache-2.0, self-hosted graph engine |
| `https://github.com/yamadashy/repomix` | **28,459★** |
| `https://github.com/lucasrosati/claude-code-memory-setup` | **991★**, MIT, Obsidian + Graphify codebase knowledge graph |
| `https://cognition.com/blog/deepwiki` | DeepWiki launch 2025-05-05; free public; 50,000+ repos indexed |
| `https://deepwiki.com/` | Live repo index |
| `https://developers.googleblog.com/en/introducing-code-wiki-accelerating-your-code-understanding/` | Code Wiki preview 2025-11-13; features; **local Gemini CLI extension planned** |
| `https://www.notion.com/pricing` | Free $0 / Plus $10 / Business $20 / Enterprise custom; zero-data-retention is Enterprise-only |
| `https://apps.ankiweb.net/` | Desktop free, AnkiWeb free, AnkiDroid free, AnkiMobile paid; open source; v26.09.2 |
| `https://forums.ankiweb.net/t/why-is-this-app-this-expensive-in-app-store/67593` | AnkiMobile "$24.99/Lifetime, one time only" (official forum, community answer) |
| `https://github.com/foambubble/foam` | 17,409★ |
| `https://github.com/dendronhq/dendron` | 7,468★, Apache-2.0 |
| `https://github.com/jackyzha0/quartz` | 13,279★, MIT |
| `https://github.com/logseq/logseq` | 45,013★, AGPL-3.0 |
| `https://github.com/ankitects/anki` | 31,422★ |
| `https://github.com/obsidianmd/obsidian-releases` | 21,772★ |
| `https://github.com/jerryjiao/ai-study-kit` + README | **0★**, MIT, SRS review queue + interview prep as a Claude Code plugin |
| `https://github.com/rox1694125-bit/magic-memory` | **3★**, MIT, spaced-repetition flashcards agent skill |
| `https://github.com/DavidMiserak/GoCard` | **58★**, Markdown-file SRS for developers |
| `https://www.csie.ncku.edu.tw/php/csie_project/data/csie/2026/asset/poster/E-11.pdf` | Anti-Copilot: multi-agent + spaced repetition from IDE stuck-signals (HTTP 200, 2.8 MB PDF; title-only evidence) |
| `https://www.trae.com.cn/pricing` | Trae CN ¥0/¥49/¥99/¥239/¥699 + 积分 table (independently fetched, cross-validates the sub-research) |
| `https://www.trae.ai/pricing` | Trae USD $0/$20/$60/$200 |
| `https://www.ycombinator.com/companies/graphify-labs` | **Graphify Labs, YC S26** — "On-device Knowledge Graph engine for Enterprise Software"; 116K+ stars; named enterprise users; air-gapped on-prem |
| `https://www.ycombinator.com/launches/SvA-graphify-labs-knowledge-graph-engine-for-enterprises` | 108K+ stars, 5M+ downloads, 6,000+ platform signups (vendor claims) |
| `https://github.com/Graphify-Labs/graphify/discussions/983` | "graphify is joining Y Combinator S26" |
| `https://opencollective.com/logseq` | Logseq $5/$15/$100/$250 monthly tiers; free-tier policy verbatim |
| `https://logseq.io/p/e3YDyX5AYr` | Logseq OG / DB split, 2026-04-24 |
| `https://discuss.logseq.com/t/whats-new-with-logseq-db-may-16th-2026/35020` | SQLite pitfall + "Markdown Mirror" |
| `https://roamresearch.com/js/compiled/main.js` | Roam pricing literals: Pro `$15 / month`, `$180 / year`; Believer `$500 / 5 years` |
| `https://www.notion.com/customers/boxed` | CTO quote: onboarding = reading the tech team's wiki |
| `https://www.notion.com/templates/category/engineering` | 1,123 engineering templates, Eng Knowledge Base 21 |
| `https://github.com/DeusData/codebase-memory-mcp` | **44,139★**, MIT, persistent knowledge graph MCP |
| `https://github.com/vercel-labs/lat.md` | **1,986★**, MIT, Vercel Labs markdown-native code graph |
| `https://github.com/aouicher/graphmind` | 212★, MIT, "local-first code intelligence" |
| `https://github.com/HarimxChoi/google-surf-mcp` | 290★, MIT, papers+codebases → local knowledge graph |
| `https://github.com/vitali87/code-graph-rag` / `giancarloerra/SocratiCode` | 5,167★ MIT / 3,318★ AGPL-3.0 |
| `https://github.com/CzhJing/obsidian-sync-skill` | **0★**, MIT, codebase → Obsidian architecture graph |
| `https://raw.githubusercontent.com/abhigyanpatwari/GitNexus/main/LICENSE` | Confirms PolyForm Noncommercial 1.0.0 |

**Fetch failures / unverified — explicitly NOT relied upon:**

- `FETCH FAILED`: `https://zread.ai/pricing`, `https://zread.ai/zh` (connection reset) — hence "Zread has no pricing page" is **not** asserted; only "the surfaces I fetched have none."
- `FETCH FAILED`: `https://docs.qoder.cn/enterprise/vpc` (connection reset).
- `FETCH FAILED (403)` and therefore **not asserted**: `https://mixed-news.com/en/zai-zcode-packed-42411-files-564-upload-attempts/` — the "42,411 files / 564 upload attempts" figures are unverified.
- `FETCH FAILED (403)`: GitHub REST API (`api.github.com/repos/...`) — all star counts were therefore scraped from HTML and triple-cross-checked instead.
- `EMPTY JS SHELL (HTTP 200, no content)`: `https://codegeex.cn`; `https://deepwiki.com/pricing`; `https://codewiki.google/` and `/about`; `https://logseq.com/` and `/pricing`; `https://roamresearch.com/` — Code Wiki, Logseq and Roam pricing/limits could not be determined from these pages.
- `FETCH FAILED (404)`: `https://roamresearch.com/pricing`, `https://roamresearch.com/api/pricing`, `https://docs.ankiweb.net/docs/manual.html` (correct path is `https://docs.ankiweb.net/`).
- `UNVERIFIED`: Zread-specific adoption/user/index counts.
- `UNVERIFIED`: Obsidian revenue/ARR figures.
- `UNVERIFIED`: whether codebase-to-course (`zarazhangrui`) has any financial model — no licence file, pricing, or company found.
- `UNVERIFIED`: Google Code Wiki pricing (public preview; no price page retrieved).
- `UNVERIFIED`: **AnkiMobile's price from Apple as a primary source** — the App Store URL resolved to a locale-generic "Today" page and a `"price":28` field that is not attributable to this app. The **$24.99** figure rests on the official Anki forum (community-authored answer), **not** on Apple or an Anki pricing page.
- `UNVERIFIED`: **Logseq Sync standalone monthly price** — none published; access is gated behind the $5/$15 Open Collective tiers.
- `UNVERIFIED`: **Roam Research decline** (user numbers, revenue, layoffs) — no primary source; only LOW-CONFIDENCE aggregators exist and none were used. Roam's *pricing* was recovered from its own JS bundle, not from any aggregator.
- `UNVERIFIED`: a dedicated Notion "engineering" landing page — `/engineering` and `/engineering-teams` return HTTP 401 (auth-gated).
- `UNVERIFIED`: Roam's public-repo stars — `Roam-Research/roam-js` could not be fetched (connection aborted twice).
- `UNVERIFIED`: Dendron maintenance/"sunset"; whether any dev tool markets SRS for code as a *product* (only free agent-skill attempts were found).

**Source structure:** this document is the consolidated deliverable. Two raw sub-research files sit alongside it for audit:
- `docs/research/_partA2_raw.md` — ByteDance Trae/MarsCode, Gitee AI, Baidu Comate, Tencent CodeBuddy, Huawei CodeArts, CodeFuse, aiXcoder; includes its own complete fetch log and **22 explicit `UNVERIFIED:` items**, plus environment quirks (`r.jina.ai` returns 403; `huaweicloud.com` HTML resets TLS — use `.md` doc variants).
- `docs/research/_partB_raw.md` — the wider PKM and codebase-graph inventory (the 542-repo cluster), Logseq/Roam pricing recovery, and a **49-item `UNVERIFIED:` list**.
