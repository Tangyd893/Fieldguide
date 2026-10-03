# Fieldguide — Competitive & Product Research

**Question asked:** the product feels "too single-feature / too ordinary / unappealing to users". What actually differentiates in this space, with evidence?

**Research date:** 2026-09-22 (all fetches made on this date; the brief asked for "2024–2025" and most sources are 2024–2025, but two decisive 2026 events are flagged as such).
**Method & confidence:** findings below were gathered by direct HTTP fetch of vendor pages, GitHub repos, primary blog posts, SEC-adjacent filings, the Hacker News API and Wayback/Crossref APIs — not from search-result titles. Every claim links to a source. Claims that could not be verified are marked **UNVERIFIED** in §8. Star counts and prices are point-in-time and move fast.

---

## §0. The short answer

**Fieldguide does not have a feature problem, and it does not have a "too single-feature" problem. It has a positioning and distribution problem, and the positioning it has chosen is one that developers demonstrably do not respond to.**

Five independent research strands (Western landscape, Chinese market, PKM overlap, user pain, adoption mechanics, market/willingness-to-pay) converged on the same conclusion, which is itself worth saying plainly:

1. **Every one of Fieldguide's five pillars is already commoditised** — the knowledge graph, architecture/layer views, grounded repo Q&A, guided tours, and the arXiv↔code bridge are each shipped free by someone with better distribution (§1, §2). Both Google and Cognition give the whole thing away as a funnel to something else. **And the closest competitor is not a hobby project: `graphify` (120,422★, Apache-2.0) is the open-source wedge for Graphify Labs, a YC Summer 2026 company that already sells an air-gapped on-prem enterprise layer — in the exact words "no code or data ever leaves your environment" — with claimed production users including Shopify, Datadog, JP Morgan and American Express, and 6,000+ platform signups in its first weeks (§1.1b).** Their enterprise product is **PR-level formal verification of AI changes** — the same position this report recommends Fieldguide take.
2. **The framing "understand an unfamiliar codebase" reliably fails to attract developer attention** — Show HN posts in this exact category score **2–7 points and ~0 comments**, including one from `graphify`, which now has 120k stars. The only breakout in the category was free, zero-install, and public (§4.5).
3. **The one layer nobody has taken is the learning loop** — spaced repetition, retention scheduling, comprehension quizzes and mastery/interview accountability *on a live codebase*. Every commodity tool produces understanding *artifacts* (wikis, graphs, courses); none closes the loop. That is the only genuinely uncontested wedge found — backed by the strongest demand signals in the research: **comprehension is ~2× the pain of writing code** (*"understanding other people's code"* named a top challenge by **31.6%** vs *"writing code"* at **15.6%**, JetBrains 2025 microdata, stable across two surveys); **42.9%** of developers would still do code understanding **themselves** rather than delegate it to AI (vs 34.4% who would delegate — comprehension is the *least* AI-delegated activity); **61.3%** say they'd still seek a human specifically *"when I want to fully understand something"* (Stack Overflow 2025, n = 31,476, verified directly); and the only controlled experiment found (**83% vs 57%** quiz scores for expert-curated tours over AI-only, Lacy/FSE 2026, adopted at Beko — §4b). Caveats: the SRS evidence is strong for *recall* and weak for *transfer* (§5.7), and SRS **monetises at only ~$6–10/month** — so it belongs inside the product as a retention mechanism, not as the positioning or the price anchor.
4. **"AI explains your repo" is measurably insufficient — and that 26-point gap is Fieldguide's opening.** Lacy's result shows expert-curated tours beat AI-generated ones on comprehension by 26 points, and the top critique of the closest look-alike product (Doculearn) was that generic docs miss the `why` — the project-specific "secret sauce" (§4.6, §4b). **The moat is grounding in the team's own expert rationale, not a bigger context window.**

**Three caveats, and the third is the sharpest.** First, the *need* for comprehension is well-evidenced and rising under AI — but the *willingness to pay for it as a standalone product* is not: every adjacent business either died, was absorbed, or pivoted to review/compliance/agent-context (§5.6). Second, **the onboarding durations everyone markets with ("3–6 months") are unsourced vendor folklore with phantom citations** — the defensible number is **6–7 months to plateau, up to 12 months** (FSE 2010, measured). **But note the one figure that genuinely supports this category: DORA 2023 found new hires on teams with well-written documentation are 130% as productive as those on teams with poor documentation — a large lever, though not new-hire-specific and not experimental (§5.4, §6.4).** Third — and this one is about the *strategy*, not the features — **Sourcegraph already ran Fieldguide's exact play and abandoned it publicly**: a free local desktop app for code comprehension, positioned as a funnel to cloud, whose own published success metrics were only **downloads and trial starts** with no CI or PR surface. **It got 1 point on Hacker News, and Cody Free/Pro were deleted in July 2025** (§4.5b). Fieldguide is proposing a go-to-market that a funded competitor already tried and killed.

---

## §1. Landscape (2024–2026): who does what, and the one thing each does best

### 1.1 The four products that already own Fieldguide's core loop

| Product | The ONE differentiated capability | Pricing / model | OSS? | Local-first? | Status | Source |
|---|---|---|---|---|---|---|
| **graphify** ⚠️ **the venture-backed leader** (`Graphify-Labs/graphify`; [YC listing](https://www.ycombinator.com/companies/graphify-labs)) | Codebase **+ docs + SQL + configs + PDFs → one queryable knowledge graph**; "every edge explained, no vector store"; deterministic local AST parsing — **plus an enterprise layer that reviews every PR and "formally verifies each code change"** | **OSS free (Apache-2.0) → paid enterprise control plane** | Yes | **"runs entirely inside your perimeter, fully air-gapped on-premise or self-hosted"** | **120,422★**; **YC Summer 2026**; claims **116K+ stars / 6.5M+ downloads**, production users **Shopify, Datadog, JP Morgan, American Express, Harvey, Vanguard**, and **6,000+ platform signups in its first weeks** | [repo](https://github.com/Graphify-Labs/graphify) |
| **codegraph** (`colbymchenry/codegraph`) | "**The fastest complete code graph · surgical context**" for 8 different agents; sells **token savings** | **Free**, MIT (`@colbymchenry/codegraph` on npm) | Yes | Analysis local, **telemetry on by default** | **71.8k★** | [repo](https://github.com/colbymchenry/codegraph) |
| **codebase-memory-mcp** (`DeusData`) | "Indexes codebases into a **persistent knowledge graph** — average repo in milliseconds. **158 languages**, sub-ms queries, **99% fewer tokens**. Single static binary, zero dependencies" | Free | Yes | Local | **44,144★** | [repo](https://github.com/DeusData/codebase-memory-mcp) |
| **Google Code Wiki** | Auto-regenerating wiki + Gemini chat + auto architecture/class/sequence diagrams, all hyperlinked to code | **Free public preview** (Google Cloud) | No | **"coming soon: Gemini CLI extension … run the same system locally and securely on internal repositories"** | Launched 2025-11-13 | [blog](https://developers.googleblog.com/en/introducing-code-wiki-accelerating-your-code-understanding/) |
| **DeepWiki** (Cognition) | "AI documentation you can talk to, for every repo"; free public wikis for **50,000+ top GitHub repos** | **Free for public repos; private repos require a paid Devin account** | No (community clones exist) | No | Launched 2025-05-05 | [blog](https://cognition.com/blog/deepwiki), [site](https://deepwiki.com) |

**The uncomfortable overlap, stated precisely.** graphify's official description is: *"Turn **any codebase**, with its docs, SQL schemas, configs, and PDFs, into a **queryable knowledge graph**."* Its README adds that the output tree contains **`obsidian/` ("open as Obsidian vault")**, and that it supports **`/graphify add https://arxiv.org/abs/1706.03762`** — *"fetch a paper, save, update graph"* — with *"code-paper edges rank higher than code-code"* ([README](https://raw.githubusercontent.com/Graphify-Labs/graphify/main/README.md)).

That is Fieldguide's "knowledge graph + arXiv paper bridge + Obsidian sync", free, Apache-2.0, in a 120k-star project, distributed as a `/graphify` slash-command inside Claude Code, Cursor, Codex and Gemini CLI. What it does **not** have is spaced repetition, mastery tracking or interview questions.

### 1.1b ⚠️ The single most important competitive fact in this report: graphify is a **YC-backed company**, not a hobby project

**I initially got this wrong and am correcting it explicitly.** graphify is the open-source wedge for **Graphify Labs, Y Combinator Summer 2026** (San Francisco) — a funded company selling *"a Knowledge Graph **control plane** for enterprise software"* ([YC listing](https://www.ycombinator.com/companies/graphify-labs)). Verbatim from YC:

> *"The open-source tool has **116K+ GitHub stars and 6.5M+ downloads**, and is used in production by engineers at **Shopify, Datadog, JP Morgan, American Express, Harvey, Automation Anywhere, and Vanguard**. On top of that graph, our **enterprise layer reviews every pull request and formally verifies each code change: it proves the new behavior matches the old, or hands back the exact input that breaks it**… The graph updates itself as the code changes and keeps context instead of forgetting it, so your whole team and their coding agents work from one shared, always-current view of the codebase… **It runs entirely inside your perimeter, fully air-gapped on-premise or self-hosted in your own cloud, so no code or data ever leaves your environment."*

Founder/CEO **Safi Shamsi** (YC S26) built it to 116K stars and **6.5M PyPI downloads in about five months**; the launch post reports **6,000+ platform signups in its first weeks** and calls it *"one of the top five open-source projects ever from a YC company."* ([launch](https://www.ycombinator.com/launches/SvA-graphify-labs-knowledge-graph-engine-for-enterprises))

**Four consequences, and they are severe for Fieldguide's current pitch:**

1. **My earlier framing of graphify as "a beloved free tool that monetises nothing" was wrong, and so is the comforting lesson it implied.** The correct lesson is the opposite: **the winning play in this category is an OSS wedge → paid enterprise verification layer** — the same shape as GitNexus's noncommercial licence, now confirmed at scale and with funding.
2. **"Air-gapped, local-first" is not an available position.** It is already occupied, **marketed in those exact words**, by a YC company with a 116K-star distribution engine and Fortune-100 production logos. My §2.2 conclusion that local-first is table stakes now has a flagship example — and it is *Fieldguide's competitor*, not Google.
3. **Graphify Labs' enterprise wedge is the AI-verification positioning this report independently recommends (§6.3)** — *"no one can be sure an AI's change didn't quietly break something"* — arrived at by a better-resourced team with far more distribution. The recommendation remains correct; **the window is closing.**
4. **Their launch diagnosis is Fieldguide's diagnosis, verbatim in substance:** *"AI writes more code than any team can read, and a lot of it is slop. That leaves two hard problems: **no one can hold the whole codebase in their head**, and no one can be sure an AI's change didn't quietly break something."* Fieldguide does not need to convince the market the problem exists; it needs a *different* answer to it.

**Note on the number:** YC's listing says **116K+ stars** while the repo page reported **120,422** on the same day — different snapshot times or rounding; both are ">100K" and the discrepancy does not change any conclusion.

**Also verified — the crowding is measurable and large.** A GitHub search for `codebase knowledge graph` returns **542 repositories** (reported by the China/PKM strand; I could not re-run the search API, which was rate-limited to 0/60 all session — treat the count as indicative). Beyond the leaders: **`vercel-labs/lat.md` (1,986★, MIT)** — *"Agent Lattice: a knowledge graph for your codebase, written in markdown"* — from **Vercel Labs**, i.e. a well-funded infrastructure vendor is now shipping a markdown codebase-graph too.

### 1.2 The commercial near-misses and the one that died

| Product | One differentiated capability | Pricing | OSS/local | Status |
|---|---|---|---|---|
| **CodeSee** | Codebase maps + **"Interactive code tours"** + use-case pages for **"Codebase onboarding" / "Codebase offboarding"** | Was commercial/SaaS | Cloud | **Acquired by GitKraken 2024-05-14; domain now dead** |
| **CodeBoarding** | Layered architecture diagrams + component docs + Mermaid output, from static analysis + LLM | **Free $0 / Pro $9.99 per month** | OSS (2.4k★) + VS Code ext + GitHub Action | **Pivoted**: site now says "**The human layer for AI-written software. Review the change, not the diff.**" |
| **Understand by SciTools** | Paid desktop code comprehension: cross-references, call trees, "**Organize with Architectures**" | **$100–$120 USD per month, 12-month minimum**, sales-led quote | Proprietary, desktop | Alive, long-running (sells into regulated engineering) |
| **Sourcetrail** | Free open-source interactive source explorer — the original "code graph" desktop app | Free (GPL-3.0) | Yes, local | Original **archived 2021-12-14**, 16.5k★ — **but fork `OpenSourceSourceTrail/Sourcetrail` is active (3.0.0 released 2026-09-05, LLVM/Clang 23 indexer)** |
| **GitNexus** | "**Zero-Server** Code Intelligence Engine… indexes any codebase into a knowledge graph… exposes it through **smart MCP tools**"; explicitly "Like DeepWiki, but deeper" | PolyForm **Noncommercial** licence → textbook open-core/dual-licence play | Source-available, local | 47,515★ — **the clearest commercialisation signal in the set** |

Sources: [CodeSee archive](https://web.archive.org/web/20260515043330/https://www.codesee.io/), [SD Times acquisition](https://sdtimes.com/software-development/gitkraken-acquires-codesee-launches-new-devex-platform/) (fetched, 200), [FinSMEs](https://www.finsmes.com/2024/05/gitkraken-acquires-codesee.html) (fetched, 200), **[GitKraken's own press release](https://gitkraken.com/press/gitkraken-acquires-codesee-launches-devex-platform) — URL exists but returns 403 to automated fetches, so it is cited as the *origin* of the claim, not as a verified source; the acquisition rests on the two independent trade reports above**, [CodeBoarding repo](https://github.com/CodeBoarding/CodeBoarding), [codeboarding.org](https://codeboarding.org), [SciTools pricing](https://scitools.com/pricing/), [SciTools features](https://scitools.com/features/), [Sourcetrail](https://github.com/CoatiSoftware/Sourcetrail), [GitNexus](https://github.com/abhigyanpatwari/GitNexus).

**Two facts to sit with.** First, **CodeSee sold exactly Fieldguide's pitch** — codebase maps, guided tours, the words "codebase onboarding" — and it did not survive standalone: it was absorbed into GitKraken's DevEx platform, and `codesee.io` **and its `/pricing` page** both served 200 until May 2026, **301 in June 2026, and 404 by July 2026** (Wayback CDX, verified). Its historical list price was **Community $0 / Business $69, or $29 per collaborator per month** — i.e. the category's proven self-serve ceiling is well under Understand's $100–120, and it still did not sustain a standalone business. **Nuance, so I don't overclaim a shutdown:** `docs.codesee.io` is still live with **no EOL notice**, and GitKraken's own navigation **still sells a product literally named "Codemaps"** (`gitkraken.com/codemaps` returns 403 with no Wayback capture). So what is *verified* is that the **standalone CodeSee brand went dark**; a **formal sunset of the product is UNVERIFIED** — the capability most likely lives on inside GitKraken.
Second, **Sourcetrail** proves the demand was real (16.5k stars, forks, community rehosts) while proving the *original* had no business behind it — abandoned rather than acquired. Note that its community **fork is now thriving** (`OpenSourceSourceTrail/Sourcetrail`: **3,471 commits, v3.0.0 released 2026-09-05, LLVM/Clang 23.1.0 indexer builds**, GPL-3.0, fully offline), so "the free local code graph is dead" is only true of the original — **the fork is a live, maintained, $0 competitor.**

### 1.3 The rest of the category, and what each is actually for

**A note on how crowded "read my repo and explain it" now is:** the capability is being bundled into adjacent products as a feature rather than sold as a product. Verified entrants include **SciTools Onboard** (*"AI-powered code understanding… helps developers quickly understand unfamiliar codebases"* — a **direct paid incumbent in exactly Fieldguide's lane**), **Sonar Vortex**, **CodeScene's CodeHealth MCP**, **GitHub Copilot Spaces**, **NDepend**, **Joern** (code property graphs), **Structurizr** (authoritative C4 architecture — note its **cloud service, Lite, CLI and on-prem installation were all declared EOL**, with vNext binaries shipping 2026-09-19) and **Moderne/OpenRewrite** ($250K–5M enterprise deals) — plus a free MIT self-host clone of DeepWiki (`deepwiki-open`, 18.0k★). **"LLM reads your repo and writes docs/architecture summary" is the entry fee in 2026, not a differentiator.**

| Tool | What it actually is | Pricing | OSS / local |
|---|---|---|---|
| **Sourcegraph** (Cody, Batch Changes) | Code search at scale; Cody moved **enterprise-only** | Enterprise contracts | Proprietary |
| **CodeRabbit** | AI **code review** in the PR (not comprehension) | Per-seat SaaS | Proprietary |
| **Cursor / GitHub Copilot** | Codebase indexing & `@codebase` Q&A **inside the editor** | $20–40/user/mo; Business/Enterprise tiers | Proprietary; Copilot air-gap is **technical preview, Copilot CLI only** ([GitHub changelog 2026-09-08](https://github.blog/changelog/2026-09-08-github-enterprise-server-3-22-is-now-generally-available/)) |
| **Gource** | Animated commit-history visualisation — a *demo* tool, not comprehension | Free | OSS |
| **CodeQL / GitHub code scanning** | **Security** analysis (vulnerability queries), not comprehension | Free for public / GHAS paid | Proprietary engine |
| **SonarQube** | Static quality gates in CI | Free CE + paid | OSS core |
| **CodeScene** | **Behavioural** code analysis: mines VCS *history* for hotspots, scored by deterministic **CodeHealth™**, plus ownership/knowledge maps | **Standard €18 / Pro €27 per *active author* per month** (billed yearly); Community free for OSS; **on-prem or cloud on the same plan** | Proprietary; on-prem option |
| **cognee** / **repomix** | Agent memory graph (30,910★) / repo packer for LLMs (28,459★) | Free | OSS |
| **codebase-to-course** (`zarazhangrui`) | Claude Code skill → interactive HTML **course** with **progress tracking**, code↔English translations, animated data-flow, **architecture diagrams** and **interactive quizzes**; output is a single offline HTML file | Free | OSS, **5,581★** |
| **Zread** (Zhipu) | Repo → interactive **Guide** + Q&A + contributor graph; now a **CLI for local repos** | Free; **MCP server exclusive to paid GLM Coding Plan from $18/mo** | Proprietary, cloud |
| **Qoder CN** (Alibaba, **renamed from 通义灵码 on 2026-05-20**) | Repo Q&A + `Repo Wiki` + agentic "Quest", sold on **data-locality** | **¥59 / ¥169** individual; **¥99 / ¥149 / ¥199 per seat·month**; **Enterprise VPC ¥199 with 50-seat minimum** | Proprietary; VPC private deployment |
| **CodeGeeX** (Tsinghua → Zhipu) | **Repository-level Q&A in a 9B model that runs locally**; official Ollama "local mode … no need to login" | Free | Code Apache-2.0; **weights research-only**; genuine private deployment |
| **Trae / MarsCode** (ByteDance) | AI IDE; enterprise on-prem claims | ¥0/¥49/¥99/¥239/¥699 (CN); $0/$20/$60/$200 (intl) | Proprietary; **vendor pages contradict each other on whether data leaves customer servers** |
| **aiXcoder** | "**全程在内网运行**", end-to-end private deployment incl. domestic chips; open 7B weights | No public pricing page | Open weights; strongest documented on-prem |
| **Tencent CodeBuddy** | Enterprise edition | **¥316 per seat·month, 100-seat minimum** | "专有云" tenancy, **no offline SKU found** |
| **Baidu Comate** | Enterprise private edition | "个性化报价" (quote-gated) | 私有化 line documented |
| **Huawei CodeArts** | Agentic coding on Huawei Cloud Stack | Tiered | Requires Huawei Cloud |

Sources for the Chinese set: [zread.ai](https://zread.ai), [Zread MCP docs](https://docs.z.ai/devpack/mcp/zread-mcp-server), [docs.qoder.cn](https://docs.qoder.cn/), [Alibaba Cloud billing doc](https://www.alibabacloud.com/help/zh/lingma/billing-description), [CodeGeeX4 README](https://raw.githubusercontent.com/zai-org/CodeGeeX4/main/README.md), [CodeGeeX4 local-mode guide](https://raw.githubusercontent.com/zai-org/CodeGeeX4/main/guides/Local_mode_guideline.md), [trae.cn pricing](https://www.trae.cn/pricing), [aixcoder.com](https://aixcoder.com/), [CodeBuddy enterprise pricing](https://www.codebuddy.cn/docs/ide/Codebuddy-enterprise-edition/Codebuddy-enterprise-edition-Pricing), [Baidu Comate docs](https://cloud.baidu.com/doc/COMATE/s/rlnvnio4a).

### 1.4 The PKM / Obsidian question, answered honestly

- **Obsidian is free and its commercial licence became optional on 2025-02-20** — *"Starting today, the Obsidian Commercial license is optional. Anyone can use Obsidian for work, for free."* ([blog](https://obsidian.md/blog/free-for-work/), [pricing](https://obsidian.md/pricing)). Paid add-ons: **Sync $4/user/mo** annual, **Publish $8/site/mo** annual, **Catalyst $25** one-time. Scale: **7,919 plugins and 788 themes** ([plugins page](https://obsidian.md/plugins)); *"Obsidian plugins have passed **120 million** total downloads"* and *"People in over **10,000 organizations** use Obsidian for work"* ([blog, 2026-05-12](https://obsidian.md/blog/future-of-plugins/)) — vendor claims.
- **Therefore "syncs to Obsidian" is not a value proposition, it is a distribution channel.** Obsidian's model is *free local app, paid optional cloud*; a plugin gives Fieldguide reach into a 10,000-organisation installed base and gives Obsidian the value. It should be treated as a channel with a cost of maintenance, not as a headline feature.
- **The decisive negative datapoint:** `mrjw717/obsidian-code-graph` — *"Code Graph turns your vault into a navigable knowledge graph of your codebase"*, tree-sitter parsing, typed relationships, force-directed graph — has **9 stars**. "Put a code graph in my Obsidian vault" is fully solved and demonstrably unwanted in that form.

---

## §2. Differentiation, pricing and openness — the roll-up

**Nobody in this category can differentiate on "we build a graph".** The honest roll-up:

| Capability | Differentiated? | Evidence |
|---|---|---|
| Codebase knowledge graph | **No — commoditised** (542 repos in a GitHub search for the phrase) | graphify **120,422★ → YC-backed enterprise layer**, codegraph 71.8k★, GitNexus 47.5k★, codebase-memory-mcp 44,144★, cognee 30.9k★, vercel-labs/lat.md 1,986★, Sourcetrail (fork alive) |
| Architecture / layer views | **No** | Google Code Wiki auto-generates them; CodeBoarding free tier; Understand charges for them |
| Grounded repo Q&A | **No — and free** | Google Code Wiki ("not a generic model, but one that knows your repo end-to-end"), DeepWiki, Zread, Qoder CN |
| Guided tours / onboarding courses | **No** | codebase-to-course (5,581★) has progress tracking, translations, quizzes; CodeSee sold exactly this and was absorbed |
| Docs that don't rot | **No — free from Google** | Code Wiki regenerates after every change |
| arXiv/paper ↔ code bridge | **Rare, narrow** | graphify does `add <arxiv-url>` with code-paper edge ranking; audience ≈ ML/research engineering |
| Obsidian export | **No** | graphify outputs an Obsidian vault |
| **Spaced repetition / mastery / interview accountability** | **Yes — nothing found** | no verified tool does SRS over a codebase graph |
| Offline / air-gapped | **Partly, and shrinking** | Chinese 私有化 is real but mostly isolated tenancy (§2.2); Google is building a *local* Code Wiki CLI; GitHub shipped a preview air-gapped Copilot CLI |

### 2.1 The pricing reality check

Fieldguide must justify itself against:

| Benchmark | Price |
|---|---|
| graphify, codegraph, DeepWiki (public), Google Code Wiki preview, codebase-to-course, CodeGeeX | **$0** |
| CodeBoarding Pro (nearest paid comprehension tool) | **$9.99/month** |
| Zread MCP / GLM Coding Plan | **from $18/month** |
| Qoder CN (Alibaba) individual / enterprise seat | **¥59–¥169/mo** / **¥99–¥199 per seat·mo** |
| CodeBuddy 专有云 | **¥316 per seat·mo, 100-seat minimum** |
| **Understand by SciTools (paid desktop comprehension)** | **$100–$120/mo, 12-month minimum** |

**The industry's established per-seat band is ~$10–$72 per developer per month** — verified against live pricing pages on 2026-09-22:

| Comparable tool | Price per developer / month | Source |
|---|---|---|
| GitHub Copilot Business / Enterprise | **$19 / $39** | [GitHub plans](https://docs.github.com/en/copilot/get-started/plans) |
| CodeRabbit Essentials / Team / Advanced | **$24 / $48 / $72** (annual billing) | [CodeRabbit pricing](https://www.coderabbit.ai/pricing) |
| Graphite Starter / Team | **$20 / $40** | [Graphite pricing](https://graphite.dev/pricing) |
| Snyk Team | **$25** (teams ≤10) | [Snyk plans](https://snyk.io/plans/) |
| Sourcery Pro / Team | **$12 / $24** | [Sourcery pricing](https://www.sourcery.ai/pricing) |
| Notion Plus / Business | **$10 / $20** | [Notion pricing](https://www.notion.com/pricing) |
| JetBrains IntelliJ IDEA Ultimate (commercial) | **$719/year** (~$60/mo) | [JetBrains store](https://www.jetbrains.com/store/) |
| **Sourcegraph — enterprise only** | **"Starting at $16K"** minimum annual contract, **no Free/Pro/Team tier** | [sourcegraph.com/pricing](https://sourcegraph.com/pricing) (fetched via Wayback 2026-09-14; live page returns 403) |

**The full verified price ladder in this space:** **$0** (DeepWiki public, Sourcetrail, Gource, CodeQL for OSS, graphify, codegraph) → **€18–27/author/mo** (CodeScene) → **$10–20/user/mo** (Copilot Pro $10, Cursor Pro $20) → **$24–72/dev/mo** (CodeRabbit) → **$100–120/mo** (Understand) → **£300–2,400/mo per installation** (Structurizr's *now-EOL* server tier) → **$16K/yr minimum** (Sourcegraph, enterprise-only, no self-serve) → **$250K–5M typical deals** (Moderne). **Fieldguide's plausible zone sits between Copilot Pro and CodeRabbit Essentials**, where the buyer is an individual developer or small team paying for retention and time-to-productivity.

**A structural pattern worth internalising: the vendors positioned *most* like "codebase comprehension" publish the *least* pricing.** Swimm, DX, SonarQube Server, CodeScene Enterprise and Sourcegraph all sell on quotes/LOC/annual contracts rather than self-serve per seat. Comprehension/onboarding tooling is **overwhelmingly sold top-down on annual contracts** — which is the opposite motion to a downloadable desktop app.

**The single most important business observation in this report:** the *only* durable paid-desktop price point in code comprehension is ~**$1,200–1,440/developer/year** (Understand), an order of magnitude above everything else here — **and its buyer is not "a confused new joiner".** Understand's durable market is regulated/safety-critical engineering (embedded C/C++, defence, aerospace, medical), where structural understanding is a **compliance artifact**. Meanwhile CodeBoarding — which had Fieldguide's architecture-view feature — moved its commercial story to **PR review**, and CodeSee — which had Fieldguide's guided-tour feature — did not survive standalone.

The pattern across all three: **comprehension-as-learning sells weakly to individuals; comprehension-as-proof sells strongly to organisations.** Fieldguide should pick which of those it is.

### 2.2 The local-first claim needs surgical precision

Chinese vendors are genuinely more on-prem-driven — **every one** of eight vendors surveyed advertises some isolation/deployment option ("数据不出域", "私有化部署", "专有云", "VPC 私有部署", "全程在内网运行"), versus effectively none of the US comparison set's security pages. But this is **procurement/regulatory fit, not superior privacy architecture**, and it is thinner than the marketing suggests:

- Several "private" tiers are **isolated tenancy inside the vendor's own cloud**, not on-prem: CodeBuddy 专有云 (100-seat min), Huawei (requires Huawei Cloud), Trae (its own two vendor pages **contradict each other** on whether data stays on customer servers).
- Private tiers are **quote-gated with no published price** (Comate "个性化报价", Qoder CN "联系商务", aiXcoder none at all) — you cannot self-serve.
- The US side is moving: GitHub shipped an **air-gapped Copilot CLI** path in Sept 2026 (technical preview), and Google committed to a **local Code Wiki CLI** for internal repos.
- **And the sharpest cautionary tale in the whole report (§3.5).**

**Additional finding that weakens the local-first moat further:** local execution is *already* the norm among serious incumbents, not a differentiator. **Cursor builds its search index on-device and explicitly states it stores no codebase embeddings**, and Sourcetrail, Understand, Gource, CodeScene, SonarQube Server, Swimm and Sourcegraph all already offer local/offline/self-hosted paths of some kind (see `02-western-landscape.md` for per-vendor evidence). Combined with Google's announced local Code Wiki CLI and GitHub's air-gapped Copilot CLI preview, **"runs on your machine" is table stakes by 2026, not a wedge.** The defensible version of the claim is narrower and must be *proven*: **egress off by default, auditable, with no hidden telemetry** — precisely what codegraph does *not* do (telemetry on by default, §1.1) and what Zhipu got catastrophically wrong (§3.5).

---

## §3. What is NOT well served — gaps with evidence

### 3.1 Ground truth: the strongest single market signal is "almost right, but not quite"

Stack Overflow Developer Survey 2025, question `AIFrustration`, **n = 31,476 (64.2%)** — **I verified these figures directly against the live page**, not via a summary ([source](https://survey.stackoverflow.co/2025/ai)):

| Frustration | % |
|---|---|
| **AI solutions that are almost right, but not quite** | **66%** |
| **Debugging AI-generated code is more time-consuming** | **45.2%** |
| I don't use AI tools regularly | 23.5% |
| I've become less confident in my own problem-solving | 20% |
| **It's hard to understand how or why the code works** | **16.3%** |
| Other (write-in) | 11.6% |
| I haven't encountered any problems | 4% |

⚠️ **Discrepancy note (now resolved in the dataset's favour):** the SO *page* and the published dataset both attach **66% to "almost right"** and **45% to "debugging"**. Only the [Dec 2025 blog post](https://stackoverflow.blog/2025/12/29/developers-remain-willing-but-reluctant-to-use-ai-the-2025-developer-survey-results-are-here/) states it the other way round ("cited by 45%… In fact, 66%… spending more time fixing"). **Treat the page/dataset as authoritative and the blog post as the outlier.**

**Why this matters for Fieldguide:** the #1 AI complaint is *output that looks right and costs more to verify than to have written*. That is a comprehension failure, not a generation failure. It is the best available evidence that "verify and understand what the AI produced" is the actual pain of 2025–2026 — a materially better wedge than "onboard onto a legacy repo".

**And the same survey contains the strongest single demand signal for comprehension found in this entire report.** Asked *"in a future with advanced AI, in which situations would you still want to ask another **person** for help?"* ([same page](https://survey.stackoverflow.co/2025/ai), n = 31,476):

| Situation | % |
|---|---|
| When I don't trust AI's answers | **75.3%** |
| When I have ethical or security concerns about code | 61.7% |
| **When I want to fully understand something** | **61.3%** |
| When I want to learn best practices | 58.1% |
| When I'm stuck and can't explain the problem | 54.6% |
| When I need help fixing complex or unfamiliar code | 49.8% |

**61.3% of developers say that even in a future where AI does most coding, they would still seek out a human specifically to *fully understand something*.** That is the cleanest available evidence that demand for genuine comprehension — as opposed to generated explanation — *survives* AI rather than being replaced by it. Only 4.3% said they don't think they'll need help from people anymore.



**Corroborating, from Stack Overflow 2024** ([source](https://survey.stackoverflow.co/2024/ai), n = 30,661):
- **63.3%** of all / **64.6%** of professional developers say AI tools **lack context of their codebase**
- **66.2%** say they **don't trust the output or answers**

And from a **Checkmarx** global study (via [The Decoder, 2024-07-27](https://the-decoder.com/15-of-companies-ban-code-ai-but-99-of-developers-use-it-anyway/)): **99%** of development teams use AI coding tools; **15%** of surveyed companies explicitly banned them; only **29%** have any governance; **80%** worry about developer AI use; **60% are specifically concerned about hallucinations**.

### 3.2 Hallucinated architecture — the DeepWiki evidence is abundant and public

The most-upvoted thread in this category is **"DeepWiki: Understand Any Codebase", 231 points, 53 comments, 2025-08-24** ([HN](https://news.ycombinator.com/item?id=45002092)). The comments are the best available field report on LLM architecture explanation, and they are sharply critical:

- On **LLVM**: *"the results ranged from incomplete to just plain incorrect… The high-level compilation pipeline diagram is… **wrong**?"* — [jcranmer](https://news.ycombinator.com/item?id=45002092)
- *"just looking at the diagrams of repos, they are **too handwavy to be useful**. They are a conceptual overview and don't seem tied down enough to the actual implementation details"* … *"For projects I know well, **the diagrams are not engineering quality**."* — IceHegel
- On **LibreOffice**: *"We didn't ask for deceptive garbage to be generated as documentation… newbies are discovering it"* — buovjaga (the specific claim was then partially corrected by other commenters, which is itself instructive: the LLM **over-weighted a peripheral build file**, Buck, as if it were the main system — a *proportion* error, not a fabrication).
- *"for my libs… it generates documentation that is **incorrect**, and this is not good for users"* — fergie
- *"I recently received an **AI-slop bug report**… generated by DeepWiki. It was very incorrect, but I didn't know what 'DeepWiki' was so I **wasted about an hour**."* — caboteria ([linked issue](https://gitlab.com/purelb/purelb/-/issues/147))

**The single best articulation of the problem** — from the 532-point "comprehension debt" thread, and it is exactly the case for a grounded, verifiable knowledge layer:

> *"I've seen tools designed to 'understand' and document repos **hallucinate many times, often coming up with a plausible but completely wrong explanation of how things actually work**… while I could catch that because I wrote the code in question… **others do not have that benefit.**"*
> — `int_19h`, [HN 45433150](https://news.ycombinator.com/item?id=45433150), 2025-10-01 (in [story 45423917](https://news.ycombinator.com/item?id=45423917))

**And the vendor concedes the limitation on the record.** DeepWiki's own builder, when challenged:

> *"you can never exclude hallucinations entirely… **The reason we display the code snippets is to make it easy to double check with the source.**"*
> — [HN 43799251](https://news.ycombinator.com/item?id=43799251)

That is the category leader admitting that its mitigation for hallucination is **the user manually verifying each claim against source** — i.e. the product exports the verification burden to the reader. This is the strongest available evidence that "grounded" claims are unproven in practice, and it is the gap Fieldguide would have to close *demonstrably*, not rhetorically.

**Three more gaps fall straight out of this evidence:**

- **The "why" is missing, not the "what".** *"It would be nice if it could also read github issues etc if they were available, so it could have **more context about the decisions that were made**."* — 1317. No tool surveyed reconstructs **design rationale** (why this structure, what was rejected, what the constraints were). That is precisely what makes onboarding slow and what docs rot fastest — and it is a genuinely open gap.
- **Provenance/authenticity is broken.** *"anyone can just request a deepwiki for any GitHub repo… That one exists doesn't mean that it's endorsed or reviewed by the project."* — Nullabillity; *"So in the end people will believe that these are the official docs…"* — tacker2000. There is no way for a repo owner to distinguish generated from human documentation. Precedent: *"the OCaml and Julia languages already had to deal with a content farm that created wikis… filled with LLM-generated, blatantly wrong or stupidly low quality content, and SEOed its way above actual learning materials"* — debugnik.
- **⚠️ Nothing is both grounded AND stable.** The sharpest complaint against **Google Code Wiki** (101-pt HN thread) is **non-determinism**: regenerated content *"the next day… is completely different."* Every tool in this space either regenerates (unstable, unverifiable over time) or is static (rots). **No surveyed tool offers a knowledge layer that is simultaneously anchored to code and stable enough to cite, review, or sign off** — which is the natural home for the "proof of freshness" gap (§7) and, notably, would be a *deterministic* rather than generative property.

**What actually worked, per the same thread:** the highest praise went to the *interactive follow-up* system, not the diagrams — *"The auto-overviews and diagrams are great, but where it truly shines is the **'deep research' follow-up questions system**"* — nikisweeting. And the valued output was a **portable artifact**: *"you can ask DeepWiki to provide a Markdown cheat sheet… You can then **drop that summary directly into Claude Code or Cursor** as structured context"*.

### 3.3 Context-window / repo-scale failure, and the measured hallucination rate

**There is now a measured hallucination rate** — the thing most "AI is unreliable" claims lack. From the Entity Tracing Framework paper (ACL 2025 Long Papers, [ACL Anthology](https://aclanthology.org/2025.acl-long.1480/), [arXiv 2410.14748v4](https://arxiv.org/html/2410.14748v4)), which hand-annotated **411 code summaries and 9,933 entities**:

> *"Hallucinated 130 — **31.63%**; Not Hallucinated 281 — 68.36%; Total Summaries 411."*
> Entity level: CORRECT 9,024 (**90.84%**), INCORRECT 303 (**3.05%**), IRRELEVANT 606 (**6.11%**).

**Read it carefully — do not overclaim:** 31.63% is the share of **summaries containing at least one hallucinated entity**; the entity-level error rate is much lower (3.05% incorrect). The paper's contribution is a **detector** (73% F1), not a prevalence survey. But it is a real measured rate on a real dataset, and it substantiates the complaint pattern in §3.2.

**On repo-scale retrieval**, the evidence is stronger than I initially credited: peer-reviewed work finds (a) performance degrades as input grows even on *simple* tasks (18 models), (b) relevant information in the *middle* of a long context is used worst, and (c) **retrieval over code is itself the bottleneck** (measured across 10 retrievers and 10 models — see CodeRAG-Bench, cited in `04-gaps-and-pain.md`). Combined with self-report (**63.3% / 64.6%** say AI tools lack codebase context, SO 2024), "context windows are too small" is now **quantitatively supported**, not merely directional.

### 3.4 Local-first demand — real, priced, but weaker than it looks

**The strongest evidence that sovereignty is a *priced* requirement, not a preference:** GitHub built **geo-pinned, FedRAMP-authorized Copilot inference** and sells it at a **~10% price premium**, and ships a policy switch whose only purpose is restricting users to FedRAMP Moderate models. A vendor does not build that and charge more for it unless buyers pay for it. Similarly, **GitLab's 8th annual Global DevSecOps Report** (surveyed **April 2024**, published 2024-06-25, **5,300+ CxOs, IT leaders, developers and security/ops professionals** — fetched and verified directly via the [Nasdaq press-release wire](https://www.nasdaq.com/press-release/gitlab-survey-reveals-tension-around-ai-security-and-developer-productivity-within)):

> *"**56% of CxOs** said introducing AI into the software development lifecycle **is risky**, while **only 40% of individual contributors** cited concerns about privacy and data security as a top obstacle to using AI… **35% of CxOs** identified the **lack of an appropriate skill set** to employ AI or interpret AI output as an obstacle, but only **26% of individual contributors**"* did. Also: *"only **26%** of respondents report implementing AI"* and *"Global CxOs (**69%**) say they are shipping software at least twice as fast as a year ago."*

**⚠️ This is the most strategically useful datapoint in the privacy cluster, and for an uncomfortable reason: the buyer's fear and the user's friction are not the same thing.** Executives rate AI *risk* (56%) and the *skills gap* (35%) materially higher than practitioners report actually being blocked (40% and 26%). Since **the buyer releases the budget and the user experiences the friction**, a product framed around *executive* concerns — governance, verifiable comprehension, auditable skill coverage — is likely to be funded more readily than one framed around the developer's own annoyance. (Independence caveat: GitLab sells a DevSecOps platform, so treat the framing as vendor-interested; the sample size and wording are solid, the *interpretation* is mine.) In China, the driver is regulatory: the *生成式人工智能服务管理暂行办法* (effective 2023-08-15) **carves internal-only enterprise use out of the filing regime entirely**, which is a concrete procurement incentive to buy on-prem rather than a public-cloud assistant. Full ledger in `04-gaps-and-pain.md` (P7) and `03-china-and-pkm.md`.

**But the behavioural evidence cuts the other way:** **99% of teams use AI coding tools while 15% of companies ban them** (Checkmarx, §3.1) — developers **route around bans**. Cisco's survey (**n = 2,600, 12 geographies**) found **27% banned GenAI outright** yet **48% knew non-public company data had gone into a tool anyway**; IBM/Ponemon (**n = 600**) put **shadow AI's addition to the average breach cost at ~USD 670,000**. So the ban does not create a buyer — it creates a **shadow user**. §3.5 shows why this still matters.

- **Direct user demand exists:** in the DeepWiki thread — *"What if I don't trust this third party with my code? are there any open source/local way to run this?"* — lelouch9099 ([HN](https://news.ycombinator.com/item?id=45002092)).
- **And it shows up as the loudest objection in an adjacent category.** On the **263-point Tach thread** (architecture/layer enforcement — independent demand for layer views, which is a Fieldguide surface), the community's most prominent objection was *"**why does this phone home?**"* — i.e. a tool whose value proposition was architecture visibility drew its strongest criticism for network egress rather than for its features.
- **The defensible version of this claim is auditable no-egress, not "local".** See §3.5 and §2.2.

### 3.5 The ZCode incident — the cautionary tale that is *exactly* Fieldguide's feature

On **2026-09-18** Zhipu's coding tool **ZCode** was publicly accused of secretly uploading developers' code. Zhipu apologised the same day. Per [IT之家](https://www.ithome.com/0/100/4310.htm) (2026-09-18, verified directly):

- The cause was ZCode's **"代码库索引" (codebase-indexing)** feature, which exists to support checkpoint restore and **`Repo Wiki`（代码仓库知识库）**.
- *"Repo Wiki 功能在生成 Wiki 页面（知识库页面）时，**可能会触发仓库数据上传**"* — generating the wiki page could trigger repo data upload.
- *"由于该功能**上线初期默认开启**，导致部分用户受到影响"* — **it was enabled by default at launch.**

Per [36Kr / 界面新闻](https://eu.36kr.com/en/p/3992798380833792) (2026-09-21, verified directly): the upload mechanism was *"enabled by default, and users cannot find the corresponding off switch in the client settings interface"*, and the encryption public key was *server-issued*. Remediation: patch on 09-19; Zhipu committed to **open-source ZCode** and invited two third parties — **CAICT (中国信通院)** confirmed the OSS bucket *"has zero data on the cloud"*; **NSFOCUS (绿盟科技)** confirmed the bucket and all objects were deleted and that **ZCode v3.14.0 removed the Repo Wiki entry and generation link**, with no remaining path that could snapshot or exfiltrate a local repo. Zhipu then committed to zero data retention on MaaS.

**Why this is the most valuable single case study for Fieldguide:** a vendor whose entire brand was *domestic data sovereignty* shipped **a repo-indexing feature that built a repo wiki** — Fieldguide's core loop — with **default-on upload and no off switch**, and it took an apology, a hotfix, forced open-sourcing, two third-party audits and deleting the feature to recover. **"Local-first" is therefore not a feature to list; it is a trust claim that must be auditable, default-off for egress, and provable.** Also note the strategic implication: Zhipu concluded the fix was to **open-source the client** — a live, current precedent for how a local-first workbench earns credibility.

### 3.6 Doc rot and onboarding cost — the folklore, traced; and one finding that undercuts the whole category

Google's framing is vendor-side confirmation of the pain: *"Reading existing code is **one of the biggest, most expensive bottlenecks** in software development"* ([Code Wiki](https://developers.googleblog.com/en/introducing-code-wiki-accelerating-your-code-understanding/)).

**But the onboarding numbers everyone quotes are not real.** A full provenance trace (`_raw-dora-onboarding.md`) shows:

- **"It takes 3–6 months for a new developer to be productive" — UNSOURCED VENDOR FOLKLORE.** No primary study with a stated sample size supports it. The claim chain terminates in pages carrying **"phantom citations" — precision without retrievability**. Concretely, `hyring.com` attributes *"3–6 months"* to a **"Stripe Engineering Blog, 2023"** post that could not be located, and *"8.2 months median (Harvard Business Review 2023 / Gallup 2024)"* that could not be located either; the same page is internally incoherent (8.2 months median vs a 3–6 month role table, no population or definition). Likewise **"6–9 months"**, **"$240,000 per developer"**, **"$165–240K recruitment-mistake cost"**, **"50/125/200% of salary"** (attributed to Forbes), **"30% of first-year salary, per US Department of Labor"** — **all UNVERIFIED**, sources not locatable.
- **The real primary anchors — and there IS a defensible measured number:**
  - **⭐ Zhou & Mockus, "Developer Fluency: Achieving True Mastery in Software Projects", FSE 2010** ([author-hosted PDF](http://www.mockus.org/papers/fluency.pdf)) — a *measurement*, not an assertion: *"developer productivity in terms of number of tasks per month increases with project tenure and **plateaus within a few months in three small and medium projects and it takes up to 12 months in a large project**… applying the same model for Project A, B and C we get a similar curve that **plateaus earlier: only after 6-7 months**."* Method: 4 industrial projects modelled, **35 developers and managers interviewed**, data covering **69** developers. **This is the number a product team can defend** — it is peer-reviewed, it is measured, and it scales with codebase size, which is the entire premise of "unfamiliar repository" tooling. **It is also longer than the folklore, which makes the business case better, not worse.**
  - **The actual origin of "3–6 months" — a manager's guess, in that same paper.** *"The development managers claimed that it takes only a few months for the developer to become 'fully productive' in their projects. However, **the same managers wouldn't allow these nominally 'fully productive' developers to take on complicated tasks**… Paradoxically, the same respondents considered developers to become productive after a few months… This suggests that **becoming fluent is not perceived to be the same as becoming productive**."* So the popular range is a **mangled memory of a manager's self-report from 2010 that the same study's own quantitative data contradicts** — a much sharper finding than "unsourced".
  - **Ju, Sajnani, Kelly & Herzig, "A Case Study of Onboarding in Software Teams"** (Microsoft, ICSE 2021, [arXiv 2103.05055](https://ar5iv.labs.arxiv.org/html/2103.05055)): a staged model ending *"the next **3 to 9 months**: become an expert in one domain"* — i.e. **domain expertise**, a different thing from general productivity. Method: **32 developer + 15 manager interviews, developer survey N=189, manager survey N=37**.
  - **Rastogi et al.** (Microsoft, ISEC '17, [open copy](http://thomas-zimmermann.com/publications/files/rastogi-isec-2017.pdf)): *"new hires often take **several weeks** to reach the same productivity level as existing employees"* — 8 large Microsoft product teams, though time units are **anonymised**, and the paper's own citation for "several weeks" is a **staffing-agency press release**.
- **The "onboarding costs 1–2% of revenue" claim** traces to an **unpublished 2003 Mellon Financial Corp. study** reported in *MIT Sloan Management Review* (2005). The original figure was **1%–2.5%**, and it covered the learning curve for **new hires *and transfers*** — the popular version quietly drops both the top of the range and the transfers.

**⚠️ The DORA 2023 finding that most shapes this category — and it is both the best news and the sharpest constraint in this report.** I verified the following from the report's own extracted PDF text (p.55–56, n ≈ 3,000), and both halves are in the **same passage**:

> *"these practices **do help new hires, but these practices do not help new hires more or less than everyone else**. In other words, **new hires don't get any special benefits from these practices**."*
> *"If you're looking to help new hires **and everyone else**, high quality documentation is a great place to start given the substantiality and clarity of its effect on productivity. It's worth noting that **new hires on teams with well-written documentation (1 standard deviation above average) are 130% as productive as new hires on teams with poorly written documentation (1 standard deviation below average).**"*

**So the correct reading is not "documentation doesn't help" — it is that documentation quality is a very large lever (130%) that helps *everyone*, not new hires specifically.** Two caveats DORA states itself, and which must travel with the 130% figure or it will not survive a competent challenge: (i) it is a **cross-sectional ±1 standard deviation comparison, not an experiment** — *"our data is not experimental… it is difficult to draw sharp conclusions"*; and (ii) the effect is **not new-hire-specific**.

DORA does **not** publish a "time to first contribution" metric at all; its only ramp-up-specific number is a **productivity *gap*, not a duration** — the 2023 report's **8% new-hire productivity gap (n≈3,000)**. See §5.4 and §6.4.

**So the honest position is:** the *pain* is real and now **quantified** — **6–7 months** to a productivity plateau in small/medium projects and **up to 12 months** in a large one (FSE 2010, measured), with **3–9 months to domain expertise** (ICSE 2021, Microsoft). The *specific ranges everyone markets with* ("3–6 months") are a **mangled memory of a manager's guess from the same 2010 paper whose data contradicts it**. And — the real caution — **DORA's test of documentation as a new-hire ramp lever specifically was null**, even though DORA separately finds documentation quality strongly associated with team performance (§5.4). The conclusion is not "onboarding can't be improved"; it is **"don't promise faster ramp without measuring it, because the default promise has no supporting effect size."**

**The one measurable proxy that does exist:** only **30.9%** of developers currently use AI for *"learning about a codebase"*, while **40.6% are interested** — a +9.7 pt gap (SO 2024, n = 35,978, [source](https://survey.stackoverflow.co/2024/ai)). **Read this honestly:** it is a real under-served area, but it is **not** the largest gap — code review (+27.7 pt) and testing (+19.0 pt) are bigger — and codebase learning carries the **highest explicit disinterest** of the steps measured (**18.7%**). It is a suggestive, not conclusive, demand signal.

### 3.7 Knowledge loss / bus factor — the structural reason comprehension matters

The original brief asked about knowledge loss; here is the peer-reviewed base, which is stronger than most of the material in this report:

- **Truck factor ≤ 2 in 65% of 133 popular GitHub projects** (ICPC 2016, [arXiv 1604.06766](https://arxiv.org/abs/1604.06766)) — developer-validated.
- **89% of 36,000+ projects lost their core development team at least once, and only 27% of those replaced it** ([arXiv 2412.00313](https://arxiv.org/abs/2412.00313)).
- **Newcomers adopt only 16% of orphaned files — experienced developers absorb them instead**, i.e. abandoned code concentrates on the people who are already busiest. Knowledge loss is also heavy-tailed, and abandoned files rot in place.
- **In practice:** Libinput self-measured a **bus factor of 1** ([187-pt HN thread](https://news.ycombinator.com/item?id=23254871)); a 95-pt thread discusses *"Terminating an employee with a bus factor of 1"*; and at government scale, **more than 362,000 New Jersey residents filed for unemployment in two weeks**, overloading 40-year-old mainframes whose skills had been lost.
- **Caveat — vendor content:** CodeScene's knowledge-map and "code red" findings are **unreplicated vendor material**, and its frequently-quoted "42%" is *borrowed from prior work rather than measured by them*. Their most concrete claim is that "code red" modules show **"9 times longer maximum cycle times"**, but it lacks independent replication. Their disclosed corpus — **40 proprietary projects, 139,869 files, 1,414 developers** ([arXiv 2401.13407](https://arxiv.org/abs/2401.13407), TechDebt 2024) — proves they hold a large proprietary dataset; it does **not** validate the knowledge-map numbers, since that paper concerns code-health ROI. Two truck-factor comparative studies were confirmed to exist (ICPC 2017 DOI, Software Quality Journal 2019) but their **sample sizes were unobtainable**, so **no figures are quoted from either**.

**Why this matters for positioning:** knowledge loss is the *organisational* form of the comprehension problem, and it is well-quantified — which makes it a far better executive-facing framing than "onboarding is slow" (which DORA failed to substantiate, §5.4). **"Your bus factor is 1–2, and 89% of projects lose their core team with only 27% replacing it"** is a defensible, citable business case.

---

## §4. What actually makes developer tools spread

### 4.1 The winning mechanism in this exact category is *distribution inside something already open*

Every product that scaled did so by **not** being a destination app:

| Tool | Vehicle | Consequence |
|---|---|---|
| **DeepWiki** | **URL swap**: replace `github.com` with `deepwiki.com` ([Cognition](https://cognition.com/blog/deepwiki)) | Zero install, zero auth, public shareable page; 50,000+ repos indexed at launch |
| **graphify** | **Claude Code skill** (`/graphify`) + Cursor/Codex/Gemini CLI — **then a paid enterprise layer** | 120,422★ open-source wedge for **YC S26 Graphify Labs**; 116K+ stars / 6.5M+ downloads claimed, 6,000+ platform signups |
| **codegraph** | **npm one-liner** (`curl -fsSL …/install.sh \| sh`, plus `install.ps1`) + **MCP server** for 8 agents; "*No Node.js required*" | 71.8k★ |
| **CodeBoarding** | **VS Code extension + Open VSX + GitHub Action** | Reaches devs in-editor and in-CI without them choosing a new app |
| **Zread** | **MCP server**, gated to GLM Coding Plan subscribers | Free comprehension as a funnel to a paid model subscription |
| **Google Code Wiki** | Public website now; **Gemini CLI extension** announced | Platform-scale distribution |

**The consistent pattern: comprehension is the free top-of-funnel; the paid product is the workflow (Devin agent, GLM plan, CodeBoarding PR review).** Four of six monetise something *other than* comprehension.

### 4.2 Free, open and zero-friction beats better and paid — but stars do not predict revenue

- graphify is **Apache-2.0, 120,422★** — a free OSS wedge for a **YC-funded** enterprise layer (§1.1b); codegraph is **MIT**; codebase-to-course is a single-author skill with 5,581★. In this category, free OSS is not the low end — it is the **state of the art**, and it sets the price expectation at zero. **But note the correct lesson (corrected — see §1.1b): the OSS leaders here are not unmonetised charities.** They are wedges for enterprise layers (Graphify Labs) or deliberately noncommercial open-core plays (GitNexus).
- One-command install is the norm: codegraph advertises *"No Node.js required — one command grabs the right build for your OS."* The **audited distribution channels** are large: the **VS Code Marketplace** carries **100,000+ extensions** with top extensions at **237.8M installs**, and the official **MCP SDK alone runs ~40.3M npm downloads/week** ([audited]).
- **⚠️ But the OSS→commercial link is far weaker than the star counts suggest — this is the most important counterweight in this section:**
  - **Stars do not predict revenue.** Every large published ARR in this set had a 35k–110k-star OSS core (Grafana $400M→$600M; Sentry 100,000 orgs / $100M ARR; Supabase ~10M developers) — **but Aider (49k★) and Continue (36k★) publish no commercial numbers at all.**
  - **Revoking a free tier destroys the asset rather than monetising it.** Sourcegraph's removal of OSS/free tiers produced **444-point and 424-point** HN backlashes.
  - **The famous "1–3% OSS→paid conversion" has no primary source.** A consultancy cites an unlinked "OpenView Partners"; Elastic's "~1%" is second-hand. **Treat it as folklore.** The only dataset with a disclosed sample (ChartMogul/ProductLed, 200 B2B products, median 8% free→paid) is a survey of vendor self-reports and is not dev-tool-specific.
  - **No k-factor, viral coefficient, or referral attribution exists publicly for any developer tool.** The shareable-artifact mechanism is real, universal, and **unmeasured** — so adopt it for its mechanics, not for a modelled growth rate.

### 4.3 Measurable outcomes beat unmeasurable ones — and Fieldguide sells the unmeasurable

codegraph and graphify sell **"fewer tokens, fewer tool calls"** and **"71.5× fewer tokens per query"** — numbers you can put in a README badge. Fieldguide sells *understanding*, which is real, valuable, and **impossible to put in a benchmark table**. This is a marketing handicap as much as a product one: the competitors can prove their value in a screenshot, and Fieldguide cannot.

**This is fixable, and the mechanism is "time to first value".** The best-documented activation numbers in dev tooling come from exactly Fieldguide's problem — pointing a tool at something unfamiliar. PostHog's setup wizard moved **paid conversion from 2.6% to 14.2%**, **time-to-first-event from 3.8h to 1.9h**, **within-an-hour activation from 67% to 94%**, and advertised *"two hours of work in just 8 minutes"* ([PostHog](https://posthog.com/newsletter/context-engineering)). **Caveat: every one of those is self-reported by the vendor**, and no neutral study links install-step-count to conversion anywhere in this research.

Fieldguide's equivalent, and it is cheap: **one command or one "open this folder" that renders a graph plus a guided tour of a repo the user has never seen — before any account, config, API key, or indexing wait.** Note that a real competitor already stumbles here: in the DeepWiki thread a user reported *"its been like over 10 minutes, and still nothing"* on an uncommented source project ([HN](https://news.ycombinator.com/item?id=45002092)).

### 4.4 Integration surfaces Fieldguide structurally lacks — and a ~10× asymmetry that quantifies the cost

Against CodeBoarding (VS Code + Open VSX + GitHub Action), DeepWiki (URL + MCP), graphify/codegraph (agent skill + MCP), Zread (MCP), Google (CLI extension):
**Fieldguide has no MCP endpoint, no editor extension, no GitHub App/Action, no CLI, and no shareable public artifact.** Its graph is local and private, so *every* output is unshareable — which structurally removes the viral loop that drove DeepWiki.

**The size of that penalty, measured — CodeRabbit:** its PR-surface business reached **2M repos / 13M PRs** (self-reported; independently echoed as ~1M repos, and **30M+ PRs / 2M reviews per week** by Aug 2026) with revenue **5× YoY at ~$143M / $1.5B valuation** — while its own **IDE extension had just 189,730 installs**. **The PR surface outperformed the IDE surface by roughly an order of magnitude.** Fieldguide has neither surface, and is a *desktop app* on top of that.

**What Fieldguide can and cannot do about it** (`05-adoption-mechanics.md`): it has **no PR-comment surface, no CI loop, no default-on org distribution, no server-side artifact to auto-publish for every repo in the world, and no package-manager-native one-liner** in the way `npx`/`brew`/a Marketplace extension are. Any growth hook that assumes Fieldguide emits content *inside someone else's pull request* or *inside a hosted service* should be discarded rather than adapted. The reachable surfaces are exactly two: **an MCP server** (§2/§6.4) and **a VS Code extension** as a low-friction front door onto the graph.

### 4.5 Direct evidence that the *positioning* does not attract developer attention

Querying the Hacker News Algolia API for this category produces a stark result — **the framing itself reliably fails**:

| Show HN / post | Points | Comments | Date |
|---|---|---|---|
| **DeepWiki: Understand Any Codebase** | **231** | 53 | 2025-08-24 |
| Show HN: Codeflow – understand a codebase with PowerPoint-like tutorials | **101** | 46 | 2020-02-04 |
| **Google Releases CodeWiki** | **101** | 22 | 2025-11-14 |
| Show HN: badge showing how well your codebase fits an LLM's context window | 88 | 19 | 2026-02-27 |
| Show HN: tool to understand new codebases faster | 7 | 0 | 2025-04-22 |
| Show HN: **Codebase Knowledge Graph Builder** | 4 | 0 | 2025-04-22 |
| Show HN: We help engineers understand codebases with **interactive missions** | 4 | 1 | 2026-03-09 |
| **Show HN: Understand Anything – a codebase knowledge graph for onboarding** | **3** | 3 | 2026-04-26 |
| **Show HN: CodeKnow – Turn any codebase into a knowledge graph** | **3** | **0** | 2026-09-08 |
| **Graphify: Codebase Knowledge Graph** | **2** | **0** | 2026-07-29 |
| Show HN: Lucidcode – A Copilot to Understand Codebases | 6 | 3 | 2024-09-10 |
| Why is there a lack of tooling that helps understand large codebases? | 6 | 0 | 2020-02-28 |

Sources: [HN Algolia API](https://hn.algolia.com/api/v1/search?query=understand%20codebase&tags=story); threads [45002092](https://news.ycombinator.com/item?id=45002092), [47908512](https://news.ycombinator.com/item?id=47908512), [49610402](https://news.ycombinator.com/item?id=49610402), [49094378](https://news.ycombinator.com/item?id=49094378), [22238821](https://news.ycombinator.com/item?id=22238821).

**Interpretation (and note the honesty required here):** these are single data points with self-selected audiences, and HN under-weights many things. But the pattern is consistent and striking — **"codebase knowledge graph" as a phrase scores 2–4 points and zero comments**, including from `graphify`, which went on to 120k stars under a *different* pitch (token savings inside an agent). The categories that got traction were **free + zero-install + public** (DeepWiki, 231 pts; Google CodeWiki, 101 pts) and, in 2020, **tutorials** (Codeflow, 101 pts) — note that *tutorials* beat *graphs* by 25×.

**Important counterweight — the underlying *pain* does get huge engagement, just never under a graph/tool framing:**

| Thread | Points | Comments |
|---|---|---|
| "I'm Tired of Talking to AI" | **2,013** | — |
| **"comprehension debt"** | **532** | — |
| Tach (architecture/layer enforcement) | 263 | — |
| Libinput's bus factor is 1 | 187 | 13 |
| Ask HN: how do you search large codebases before adding a feature? | 111 | 30 |
| Ask HN: How To: Internal Documentation? | 50 | 27 |

Sources and full ledger: `04-gaps-and-pain.md`. **This distinction is the crux of the PM's problem:** the *problem* ("comprehension debt", 532 points) draws enormous attention, while the *tool framing* ("codebase knowledge graph", 2–4 points) draws almost none. Developers engage with the **symptom in their own words**, not with the **category name** — and the sharpest supporting quote found in the whole research is a user's own:

> *"Almost all of the value that I'm getting out of LLMs is when it helps me **understand** something, as opposed to when it helps me **produce** something."* — `roncesvalles`, [HN 45430691](https://news.ycombinator.com/item?id=45430691), 2025-09-30

### 4.5b ⚠️ The most important precedent in this report: **Sourcegraph App already ran Fieldguide's exact play — and abandoned it publicly**

This is the closest thing to a controlled experiment on Fieldguide's *strategy*, not just its features. Sourcegraph — a well-funded company — shipped a **free local desktop app** for code comprehension whose documented purpose was to be a funnel to a paid cloud product. From **Sourcegraph's own public handbook FAQ**, verbatim:

> *"it gets **individual devs** up and running with a Cody-supported Sourcegraph instance quickly, easily, and **for free**"* → *"They use **Sourcegraph App** locally on their code → They **upgrade to a Cloud trial**"*

**And its published success metrics were only: downloads, trial starts, and CTA activity — with no CI or PR surface at all.** Exactly Fieldguide's shape and exactly Fieldguide's funnel logic. The outcome:

- **The launch got 1 point on Hacker News.**
- **Cody Free and Cody Pro were deleted on 2025-07-23.**
- Sourcegraph's wider trajectory is a three-stage collapse: OSS positioning dropped to proprietary **unannounced** (HN **444 pts**), repo made private (**424 pts**), free tiers killed. **OSS traction did not convert, and revoking it destroyed the asset.**

**What this means:** Fieldguide is not proposing a novel go-to-market — it is proposing **one that a funded competitor tried, measured in exactly the same weak way (downloads and trial starts), failed to convert, and shut down.** Any plan that rests on "individual devs adopt the free local app, then upgrade" must explain why it works now when it did not for Sourcegraph, and must name a metric better than downloads.

**Related cautionary cases:** **Atom** was retired by GitHub *toward the cloud* ([1,320-pt HN thread](https://news.ycombinator.com/item?id=23270293)) — a beloved free desktop editor whose standalone economics did not survive; and **Postman's forced accounts** (365-pt thread) drove users to **Bruno** — the documented churn drivers that matter are **forced accounts** and **install friction**, not missing features.

**On install friction specifically** — a material risk for an unsigned Electron app: a 398-pt thread captures it as *"code signing… notarizing ($99 a year)… just not worth it"*, and Electron's own documentation acknowledges the signing/notarisation burden. **Fieldguide's Windows installer must be signed and run immediately on a clone**, because this is a documented drop-off point, not a theoretical one. On conversion, the only dataset with a disclosed sample is **ChartMogul/ProductLed: 200 B2B products, median free→paid 8%, card-required trials 30%** — **not dev-tool-specific**, so treat it as a rough prior only.

### 4.5c The constructive counterpart: **Bruno** proves the local-first desktop shape *can* spread fast

If Sourcegraph App is the warning, **Bruno** is the evidence that a local-first, Git-native desktop tool can grow quickly with real numbers:

- **MAU ~250k (Jan 2025) → 600k+ (Dec 2025)**, with **250k new users in a single month** at peak; GitHub stars **26k → 40k** in the same year; 78 releases ([Bruno 2025 recap](https://blog.usebruno.com/bruno-2025-from-idea-to-daily-driver), **self-reported**).
- **47,110 stars** and an **HN launch of 1,538 points** — the **audited** half.

**But note why it worked, because the mechanism is the lesson: Bruno's wedge was a competitor's behaviour change, not a marketplace.** Postman forced accounts (365-pt thread); Bruno was local, Git-native and account-free. It did not win by being a better API client with more features — it won by **removing a behaviour users were actively angry about**. That is the shape of hook Fieldguide can actually use: identify an imposition the incumbents have created (cloud-only wikis, default-on telemetry, forced accounts, unverifiable AI explanations) and be the tool that removes it.

**Audited distribution channel sizes, for calibration** (all late-Sept-2026): VS Code Marketplace `ms-python.python` **237,828,381 installs** and GitHub Copilot **74,618,185**; Microsoft reports **50M monthly active developers and 100,000+ extensions**; the MCP SDK does **40,301,962 npm downloads/week** and `modelcontextprotocol/servers` has **90,546 stars**; Homebrew `gh` **170,720/30d**. **The channels are enormous — but note that this is also why "list it in a marketplace" is not a strategy:** the Marketplace already contains 100,000+ extensions competing for the same installs.

### 4.6 The single most instructive case study: **Doculearn** — Fieldguide's exact pitch, launched four times, 1–2 points each time

If the PM wants one empirical answer to "is our positioning appealing?", this is it. **Doculearn** ("AI-powered documentation that understands your codebase") is, feature-for-feature and word-for-word, Fieldguide's pitch. Its founder's own framing:

> *"We're generating code faster than ever with AI assistants (Copilot, Claude Code, etc.), but documentation can't keep up. Traditional tools work file-by-file. When you're onboarding someone or doing a handover, they need to understand **"how does this entire system work?"** not just "what does this [file do]"… understanding how a complex system actually works requires analyzing the entire codebase—**dependencies, architecture, design decisions**, and all."*
> — "williamai_", founder, [HN 45549285](https://news.ycombinator.com/item?id=45549285)

**Its launch record on Hacker News:**

| Post | Points | Comments | Date |
|---|---|---|---|
| Doculearn – AI-powered documentation that understands your codebase | **2** | 5 | 2025-10-11 |
| Doculearn: SoftLaunch on Product Hunt | **1** | 1 | 2025-10-31 |
| Doculearn – An Intelligent Productivity Platform | **1** | 1 | 2025-12-16 |
| Show HN: Doculearn – **How much of your Gen-AI code do you understand?** | **1** | 0 | 2025-12-27 |

Four attempts across three months, **maximum 2 points**. The founder's final post used the sharpest possible framing — *"How much of your Gen-AI code do you understand?"*, which is precisely the AI-verification wedge this report recommends — and it scored **1 point, 0 comments**. The thread also shows the founder asking for Product Hunt upvotes, and `doculearnapp.com` now **fails to connect** (though I could not confirm the domain's status independently — Wayback CDX returned 503).

**And the critique in that thread is the most valuable single comment found in this entire research:**

> *"I'm sure you know **all of this is already possible by prompting in a tool like Cursor**. Agents can already write comprehensive and integrated doc, as you are no doubt doing behind the scenes. **If you're creating the prompt, how can the doc include any of the 'secret sauce' that makes their app special? This is the most important stuff to document, the `why` as well as the `how`. Won't your generic doc always be missing that aspect?**"*
> — "dtagames", [same thread](https://news.ycombinator.com/item?id=45549285)

This independently confirms, from a practitioner with no knowledge of this research, both of my §3.2 findings: (a) generic generated docs are **already commoditised** — "already possible by prompting Cursor"; and (b) the thing that matters and that generic generation **structurally cannot produce** is the **`why`, the project-specific "secret sauce"**. The founder's rebuttal — *"we're generating Documentation for the entire codebase, at scale… a code that's 2 GB large… our system inputs and processes the whole project at once"* — defends the **commoditised** axis (whole-repo scale) rather than the defensible one (project-specific rationale). Note the response he received: advice to put that scale claim on the site as a punchier headline. **That is the trap, in one exchange.**

### 4.7 Counter-evidence: what does **not** drive adoption

- **Being a dashboard/destination you must remember to open** — the structural failure mode of a desktop workbench with no CI, PR, editor or MCP surface.
- **Requiring behaviour change** — DeepWiki required none (a URL swap); Fieldguide requires installing an app, pointing it at a repo, and building a graph before delivering value.
- **Selling comprehension to individuals at a positive price** — every free competitor above sets the anchor at $0; the only paid comprehension tiers that survive are enterprise/compliance (Understand) or bundled into a bigger workflow (Devin, GLM, CodeBoarding PR review).

---

## §4b. The strongest experimental evidence in this report: expert-curated tours + quizzes beat AI-only by 26 points

Everything above is market and behavioural evidence. This is the one **controlled experimental result** found, and it should shape the roadmap more than any competitor analysis.

> **Lacy — "Simulating Expert Mentoring for Software Onboarding with Code Tours"**, **FSE 2026 Industry Papers** ([conference listing](https://conf.researchr.org/details/fse-2026/fse-2026-industry-papers/17/LACY-Simulating-Expert-Mentoring-for-Software-Onboarding-with-Code-Tours), [full text](https://ar5iv.labs.arxiv.org/html/2603.25391), arXiv 2603.25391). Deployed at **Beko**, with a replication package released.

Verbatim from the abstract:

> *"Every software organization faces the onboarding challenge: helping newcomers navigate complex codebases, compensate for insufficient documentation, and comprehend code they did not author. **Expert walkthroughs are among the most effective forms of support, yet they are expensive, repetitive, and do not scale.** We present Lacy, a hybrid human-AI onboarding system that captures expert mentoring in reusable code tours—to our knowledge, the first hybrid approach combining AI-generated content with **expert curation** in code tours… Supporting features include **Voice-to-Tour capture, comprehension quizzes, podcasts, and a dashboard**. We deployed Lacy on Beko's production environment and conducted a controlled study on a legacy finance system (**30K+ LOC**). **Learners using expert-guided tours achieved 83% quiz scores versus 57% for AI-only tours**, preferred tours over traditional self-study, and reported they would need fewer expert consultations. Experts found tour creation less burdensome than live walkthroughs. **Beko has since adopted Lacy for organizational onboarding."**

**Four things this changes:**

1. **It is a hard, measured outcome — which solves Fieldguide's biggest marketing handicap (§4.3).** "83% vs 57% on comprehension quizzes" is a number you can put on a slide. Fieldguide presently has no such number, because it sells unmeasurable "understanding". **Comprehension quizzes are the measurement instrument that turns the value proposition into a metric.**
2. **It is direct evidence that AI-only explanation is not enough — a 26-point comprehension gap.** This is the quantified version of everything in §3.2: users *know* the AI-generated diagrams are "not engineering quality"; here is the measured comprehension cost. **AI-only tours are the commoditised thing (DeepWiki, Code Wiki, graphify, Doculearn); expert curation is what produces the learning.**
3. **It validates the learning-loop thesis with independent academic evidence.** Lacy ships *comprehension quizzes* and a *dashboard* and measured improvement — while nobody in the commercial landscape (§1–2) ships quizzes or retention mechanics at all. This is the only experimental support found for the wedge recommended in §6.2.
4. **The winning ingredient is expert knowledge, not bigger context.** Fieldguide's current pitch is "the LLM is grounded in the graph" — a *machine*-grounding story. Lacy's result suggests the stronger story is **grounding in the team's own experts' `why`** — which is exactly the gap the Doculearn critic identified (§4.6) and the design-rationale gap in §3.2. **One tool captures expert rationale; the other generates plausible summaries. The 26-point gap is between those two things.**

**Caveats — do not overclaim:** this is a **single-company industry deployment** (Beko) on **one legacy finance system (~30K LOC)**, and quiz scores are a *proxy* for comprehension, not a measure of on-the-job performance. The sample specifics beyond "30K+ LOC" were not verifiable from the abstract. It has not been independently replicated. Treat the direction (curation ≫ AI-only) as well-supported and the magnitude (26 points) as study-specific.

*Note the interesting tension with §5.4:* DORA found documentation quality had **no differential effect** on new-hire ramp, while Lacy found expert-curated tours substantially improved **quiz scores**. These are not contradictory — they measure different things (org-level delivery outcomes vs individual comprehension) — but together they say something important: **comprehension tools can demonstrably improve comprehension while still failing to move organisational delivery metrics.** Fieldguide must decide which of those two it claims.

---

## §5. Is codebase comprehension a real willingness-to-pay market?

### 5.1 The central statistic is real — and it is not folklore

The widely-cited "~58% of developer time goes to understanding code" traces to a **serious primary study**, not an unsourced blog claim:

> **Xia, Bao, Lo, Xing, Hassan, Li — "Measuring Program Comprehension: A Large-Scale Field Study with Professionals", *IEEE TSE* 44(10):951–976, 2018** (also ICSE 2018). DOI `10.1109/TSE.2017.2734091`. Verified via [Crossref](https://api.crossref.org/works/10.1109/TSE.2017.2734091) (279 citations) and the [Semantic Scholar API](https://api.semanticscholar.org/graph/v1/paper/DOI:10.1145/3180155.3182538).

Verbatim from the abstract: *"Our study finds that on average developers spend **~58 percent** of their time on program comprehension activities, and that they frequently use web browsers and document editors to perform program comprehension activities."*

**Methodology — this is not a survey, and not one developer:** instrumented **cross-application** HCI telemetry via the authors' `ActivitySpace` framework (explicitly capturing activity **outside the IDE**), activities classified into navigation / editing / comprehension / other, across **7 real projects, 78 professional developers, and 3,148 working hours**.

Two findings from the same abstract that matter commercially:
- *"senior developers spend **significantly less** percentages of time on program comprehension than junior developers"* → **the pain is concentrated in junior/onboarding developers — exactly Fieldguide's user.**
- *"they frequently use **web browsers and document editors**"* → the comprehension workflow already lives **outside the IDE**, which supports a non-IDE workbench (and an Obsidian-style note surface) rather than an IDE plugin.

**Where the folklore came from — and a precision correction.** Xia et al.'s own reference list credits **Fjeldstad, "Application program maintenance study: Report to our respondents", *Proc. GUIDE*, 1983** as an ancestor; I confirmed that citation exists **in the paper's reference list via the Crossref record** ([Crossref](https://api.crossref.org/works/10.1109/TSE.2017.2734091)). **But the underlying 1983 measurement is not retrievable** — the *citation* is verifiable, the *number* is not. So state it as "an ancestor cited by the authors", **not** as a traceable primary source. Similarly, the older "half of a developer's time" lineage sometimes attributed to **von Mayrhauser** is **untraceable to a primary measurement**. Two misattributions to avoid: **Thomas Ball was NOT an author** of the 58% study (it is Xia, Bao, Lo, Xing, Hassan, Li), and the 58% figure is **often dated to the 1990s when the credible measurement is 2018**. Cite the 58% only as **Xia et al. 2018**, with its pre-generative-AI vintage attached.

### 5.2 But the number is not defensible as a 2025 figure

- **No post-2023 study re-measures the split at comparable scale.** Anyone quoting a modern equivalent is almost certainly re-citing Xia et al. 2018. The 58% is the best available large-sample estimate and should always be cited with its 2018 vintage.
- A **secondary, vendor-authored** reading argues the true "figuring the system out" share is higher — ~58% comprehension **plus ~24% navigation ≈ 82%** — because navigation is separated out. I could not verify this: the TSE tables are paywalled and **ACM returned HTTP 403**. Treat 82% as **low-confidence, vendor-sourced** ([feenk via Wayback](https://web.archive.org/web/20250121071040/https://lepiter.io/feenk/developers-spend-most-of-their-time-figuri-9q25taswlbzjc5rsufndeu0py/)).
- **Direction of travel under AI is toward MORE comprehension, not less — and the largest-sample study confirms it.** Two independent results point the same way:
  - **NBER Working Paper 35275** (Demirer, Musolff, Yang) — **500,000+ GitHub developers**, the largest sample found in this research: AI adoption produced **commits +240% but releases only +30%**, core developers **review +6.5% more code** while their own code productivity dropped **−19%**, with an elasticity of substitution of **0.23**. **Human review is the binding constraint**, not code production.
  - Xu et al., [arXiv 2510.10165](https://arxiv.org/abs/2510.10165) — the same review-increase / productivity-decrease pattern on a smaller sample, independently.
  Combined with SO 2025's **65.98%** "almost right" frustration, the review/verify/understand load is rising, and the bottleneck has moved downstream of generation.

### 5.3 Stack Overflow survey: the numbers that matter

| Metric | Value | n | Year | Source |
|---|---|---|---|---|
| Sample size | **65,437** (185 countries) | — | 2024 | [methodology](https://survey.stackoverflow.co/2024/methodology) |
| Sample size | **49,000+** (177 countries) | — | 2025 | [2025 survey](https://survey.stackoverflow.co/2025/) |
| **"Almost right, but not quite" (#1 frustration)** | **65.98%** | **31,476** | 2025 | [AI section](https://survey.stackoverflow.co/2025/ai) |
| Debugging AI code more time-consuming | 45.22% | 31,476 | 2025 | same |
| **"Hard to understand how or why the code works"** | **16.32%** | 31,476 | 2025 | same |
| AI tools **lack context of my codebase** | **63.3% all / 64.6% professional** | 30,661 / 24,496 | 2024 | [AI section](https://survey.stackoverflow.co/2024/ai) |
| Don't trust AI output | 66.2% / 66.1% | 30,661 / 24,496 | 2024 | same |
| Trust in AI accuracy (combined) | 43% → **32.8%** | 37,302 / 33,244 | 2024→25 | same |
| Using/planning to use AI | 76% → 84% | — | 2024→25 | same |
| **Use AI for "learning about a codebase"** | **30.9%** (40.6% *interested*) | 35,978 | 2024 | same |

**Standard caveat, stated by Stack Overflow itself:** *"Respondents were recruited primarily through channels owned by Stack Overflow… highly-engaged users on Stack Overflow were more likely to notice the prompts."* Self-selected sample.

### 5.4 JetBrains and DORA

JetBrains *State of Developer Experience & Productivity 2025* (Apr–Jun 2025, [dataviz](https://lp.jetbrains.com/devex-productivity-report-full-2025-dataviz/), [PDF](https://resources.jetbrains.com/storage/products/research/DXDP.pdf)) — **vendor-published**:

- **⭐ The single best "comprehension beats writing" number in this report — recomputed from JetBrains' own raw respondent microdata, not taken from their prose:** *"Understanding other people's code"* is a top challenge for **31.6% (2025) / 28.6% (2024)**, versus *"writing code"* at **15.6% / 13.8%**. **Comprehension is roughly 2× the pain of writing, and the ratio is stable across two consecutive surveys.** This is a much better headline than the 2018 58% figure, because it is current, it is a direct comparison, and it is a *problem statement* rather than a time-allocation estimate. **Reproducibility — the microdata sources, both fetched (HTTP 200):** DevEco 2025 `RawData.zip` (**98 MB, 4,740 columns × 24,534 rows**) and DevEco 2024 `RawData.zip` (**87 MB, 6,208 columns × 23,262 rows**); row counts matching the published samples is the cross-validation. Weighting used the dual method of **Goldfarb & Idnani (1982/1983)**. **JetBrains' 2023 microdata returns 403** and could not be checked.
- **⚠️ And JetBrains discloses its own responder bias — unusually candid, and material:** under its own headings *"Lingering bias"* and *"Sampling-bias reduction"* it states that it **reduces JetBrains-user representation by 10% (× 0.9)** to offset over-representation, while conceding *"Despite these measures, some bias is likely present, as JetBrains users **might have been more willing, on average, to complete** the survey."* **Credit them for correcting it, and treat the residual pro-JetBrains skew as real.** (I quote the live wording verbatim — an earlier draft of the underlying research paraphrased this sentence and presented the paraphrase as a quotation, which is exactly the near-miss failure mode this report's method notes exist to catch.)
- **⭐ And comprehension is the least AI-delegated activity:** **42.9%** say they would still do code understanding themselves rather than delegate to AI (vs **34.4%** who would delegate). For comparison, would-delegate is higher for debugging (47.5%) and code review (38.2%). **Developers want to keep understanding for themselves** — which is direct demand-side support for a *human learning* product rather than an AI-delegation product, and it is the best evidence found for the "learning loop, not retrieval" thesis (§6.2).
- **85%** of developers use at least one AI tool for coding; top *expected* benefit is **"speed up learning" (47%)**.
- **Budget ownership:** team leads are the primary drivers of DevEx/productivity measurement (**56%** of ICs), while dedicated platform-engineering teams are cited by only **22–23%**. Fewer than a third of large companies measure DevEx at all (**30%** of >1,000-employee firms).
- **It is a tooling line, not a training line:** engineering leaders rank **lack of tooling budget (24%) above insufficient training (14%)** as their constraint.
- **Implication:** in most organisations the buyer is a **line engineering manager**, not a formal DevEx department or L&D — which argues for a manager-legible outcome (ramp time, review quality) over a developer-legible one (a nice graph).

**DORA 2023 / 2024 / 2025 — verified findings, including one that cuts against this product:**

- **DORA does not publish a "time to first contribution" or "months to productivity" metric.** The only ramp-up-relevant figure is the 2023 report's **8% new-hire productivity gap (n≈3,000)** — a *gap*, not a duration.
- **✅ DORA 2023's documentation finding is the single best positive business-case number in this research — and it is a 130% effect.** Verbatim from the report's own PDF (p.55–56, n ≈ 3,000): *"**new hires on teams with well-written documentation (1 standard deviation above average) are 130% as productive as new hires on teams with poorly written documentation (1 standard deviation below average)**"*, framed as *"high quality documentation is a great place to start given the substantiality and clarity of its effect on productivity."* DORA 2023 separately reports that **high-quality documentation leads to 25% higher team performance** and *"1.4x more impact on organizational performance"*, over *"more than 36,000 professionals."* ([Google Cloud announcement](https://cloud.google.com/blog/products/devops-sre/announcing-the-2023-state-of-devops-report), [DORA 2023](https://dora.dev/research/2023/dora-report/)). **Two caveats that must travel with the 130%, stated by DORA itself:** it is a **cross-sectional ±1 SD comparison, not an experiment** (*"our data is not experimental… it is difficult to draw sharp conclusions"*), and the effect is **not new-hire-specific**.
- **⚠️ But DORA's new-hire-specific test was null — and this is the same finding, not a contradiction.** From the very same passage: *"these practices **do help new hires, but these practices do not help new hires more or less than everyone else**. In other words, **new hires don't get any special benefits from these practices**"* — true for documentation, AI in workflows, and in-person work alike. **So documentation/knowledge quality is a large *general* productivity lever with no *differential* onboarding effect.** The pair means **Fieldguide should attach to the 130% documentation-quality→productivity relationship (for which there is evidence) and must NOT promise faster onboarding (for which there is not).**
- **And a second, independent result points the other way again — in Fieldguide's favour:** in the Microsoft onboarding study (ICSE 2021), **90% of 189 developers** agreed that *"maintaining a documentation that is complete, clear, **updated**, and well organized is an effective way of facilitating learning for new members"* (and **93% of 37 managers** agreed on creating/maintaining new-member-friendly documentation). *"Updated"* is explicitly in the measured statement — which is precisely what a **continuously regenerated graph-anchored knowledge layer** is for, and what static docs cannot do. The same study measured the mechanism at task level: **"Out of 61 task items, 41 (67%) led to learning."** ([arXiv 2103.05055](https://ar5iv.labs.arxiv.org/html/2103.05055))
- **⚠️ CORRECTION to an earlier draft of this report:** I had written that **DORA 2024** produced the "AI improves throughput but degrades stability" finding. **That is wrong.** DORA **2024**'s actual result was *negative on both*: **−1.5% throughput and −7.2% stability per +25% AI adoption**, under the heading *"AI is hurting delivery performance."* The **reversal** — throughput turning positive while instability persisted — is the **2025** report. Cite the 2024 finding as "AI hurt both throughput and stability," and the 2025 finding as "throughput recovered, instability did not." ([DORA 2024 PDF](https://dora.dev/research/2024/dora-report/), p.39–40)
- **DORA 2025**: *"AI's primary role in software development is that of an **amplifier**. It magnifies the strengths of high-performing organizations and the dysfunctions of struggling ones."* Headline figures: **90%** use AI at work, **>80%** report a productivity gain, **59%** report better code quality, **30%** report little or no trust. **⚠️ Note the internal tension, and don't resolve it in the product's favour:** a large majority *self-report* quality gains in the same edition that still finds AI **increases delivery instability** (DORA 2024's −7.2% stability per +25% adoption). Self-reported quality improvement and measured instability are not the same claim. The "amplifier" framing also implies **AI comprehension tools amplify whatever comprehension practice already exists**, which favours incumbents with institutional habits.

### 5.5 Market size, growth and funding (verified)

**Analyst forecasts** — note that none of them sizes "codebase comprehension" specifically; all figures below are for adjacent categories. Do not present them as a TAM for Fieldguide.

| Claim | Figure | Source | Confidence |
|---|---|---|---|
| Enterprise software engineers using AI code assistants | **90% by 2028**, up from **<14% in early 2024** (Gartner 2025); earlier forecast was 75% by 2028, up from <10% in early 2023 | [Gartner, 2025-07-01](https://www.gartner.com/en/newsroom/press-releases/2025-07-01-gartner-identifies-the-top-strategic-trends-in-software-engineering-for-2025-and-beyond) | High (analyst, via archived page) |
| Large orgs establishing platform engineering teams | **80% by 2026**, up from 45% in 2022 | [Gartner platform engineering](https://www.gartner.com/en/infrastructure-and-it-operations-leaders/topics/platform-engineering) | High |
| Worldwide AI spending | **$632B by 2028**, CAGR **29.0%** (2024–28); GenAI **$202B**, CAGR **59.2%** | [IDC](https://www.idc.com/resource-center/press-releases/worldwide-spending-on-artificial-intelligence-forecast-to-reach-632-billion-in-2028-according-to-a-new-idc-spending-guide/) | High — **but this is total AI spend, not developer tools** |
| Developers on GitHub | **180M+** (Octoverse 2025, +36M in a year) | [GitHub Octoverse 2025](https://github.blog/news-insights/octoverse/octoverse-a-new-developer-joins-github-every-second-as-ai-leads-typescript-to-1/) | High |
| Professional developers worldwide | **13.4M (2023)** → **19.6M (2024 revised model)** — a **46% jump from a methodology change**, not real growth | [JetBrains](https://blog.jetbrains.com/research/2025/01/global-developer-population-2024/) | High, with the caveat shown |

**⚠️ And no analyst publishes a dollar TAM for this category — do not invent one.** Gartner's and IDC's *public* evidence is **adoption percentages only**; IDC's DevOps-tools forecast is gated/404. As RedMonk puts it, *"Market size prediction is generally guesswork, and often hilariously wrong."* **Any TAM for "codebase comprehension" must be built bottom-up, and the attach rate has no source at all.** Treat any vendor-supplied TAM in this space as marketing.

**Funding — what investors are actually paying for in this neighbourhood:**

| Company | Funding / scale | Source |
|---|---|---|
| **CodeRabbit** (AI code review) | **$60M Series B at a $550M valuation**, **>$15M ARR**, *"growing 20% a month"*, **8,000+ businesses** (Sept 2025); subsequently **$143M Series C at a $1.5B valuation** (verified on **CodeRabbit's own newsroom**, 2026-08-12 — *vendor-published*) | [TechCrunch, 2025-09-16](https://techcrunch.com/2025/09/16/coderabbit-raises-60m-valuing-the-2-year-old-ai-code-review-startup-at-550m/) |
| **Cognition** (Devin, DeepWiki) | **>$2B raised at a $48B valuation** (Series E, 2026-08-09) — i.e. DeepWiki, the free comprehension product, is a customer-acquisition surface for a company priced at $48B | `02-western-landscape.md` |
| **Graphite** (AI code review) | **$52M Series B** led by Accel | same TechCrunch article |
| **Swimm** (docs that don't lie) | **$33.3M total**; **$27.6M** led by Insight Partners (Nov 2021). **Verified two pivots away from developer onboarding:** 2023 pricing was **$390/mo for 25 seats** with doc *verification tests*; by 2026 the site leads with **"De-Risk Legacy Modernization"** and **mainframe** work, a **services-led** model (*"senior engineers to catch what tools miss"*, scoped by an **Assessment**), and — most tellingly — sells its knowledge base as infrastructure **for AI agents rather than humans**: *"Build the validated knowledge base **your AI tools need to understand your codebase. Copilot, Cursor, Claude Code, internal agents, MCP servers.**"* | [Insight Partners](https://www.insightpartners.com/ideas/swimm-raises-27-6-million-to-repair-developers-love-hate-relationship-with-documentation/), [swimm.io](https://swimm.io) |
| **GitHub Copilot scale** | **>77,000 organizations** adopted, **+180% YoY**; GitHub at a **$2B revenue run rate**; Copilot drove **>40% of GitHub's revenue growth** (Microsoft FY24 Q4). **⚠️ Do not compare Copilot user counts across sources:** "**>15 million** users, up over 4X YoY" (Microsoft FY25 Q3, Apr 2025) is a **point-in-time** count, whereas "**more than 20 million**" (July 2025) is **all-time users** per a GitHub spokesperson to [TechCrunch](https://techcrunch.com/2025/07/30/github-copilot-crosses-20-million-all-time-users/). The second is **not** a superseding update of the first — reading "15M in April → 20M in July" as ~33% quarterly growth is **wrong** | [Microsoft FY24 Q4](https://www.microsoft.com/en-us/investor/events/fy-2024/earnings-fy-2024-q4) |

**Read this honestly:** the venture money and the revenue in this neighbourhood are in **AI code review** (CodeRabbit, Graphite) — not in comprehension, not in documentation. **And both best-funded attempts at this exact positioning have now moved on:** CodeSee exited to GitKraken (§1.2), while **Swimm raised $33.3M for "docs that don't lie" and pivoted twice** — first to *"Agentic modernization"*, and now to **mainframe-modernization services plus selling codebase context to AI agents** (see the table above). The docs-comprehension thesis did not hold as a standalone business in either case.

### 5.5b The repositioning option both failures point to: sell the graph as **agent context**, not as human comprehension

This is the most actionable inference in the report, and I am flagging it as **inference, not evidence**. What *is* evidenced:

1. **Swimm — a $33.3M-funded company in exactly Fieldguide's lane — now sells its knowledge base for AI agents rather than humans:** *"Build the validated knowledge base **your AI tools need to understand your codebase. Copilot, Cursor, Claude Code, internal agents, MCP servers.**"* (verified, [swimm.io](https://swimm.io)).
2. **The demand signal for that framing is the strongest single number in this research:** **64.6%** of professional developers say AI tools **"lack context of my codebase"** (SO 2024, n = 24,496), and **63.3%** overall — versus a much weaker **30.9%** current usage / **40.6%** interest for AI-assisted *"learning about a codebase"* (§3.6).
3. **GitNexus and codegraph already sell exactly this framing** (a graph as "surgical context" to cut tokens and tool calls for agents), and **Graphify Labs' enterprise layer is the same thesis funded** (§1.1b).

**The strategic implication — two-sided pricing from one graph:** sell (a) human onboarding and ramp-up to engineering leadership (the defensible budget per §5.6a), **and** (b) the same graph as **grounding/context infrastructure for AI agents** over MCP. The second leg is arguably the stronger wedge because it rides the **AI tooling budget**, which is growing and well-funded, instead of competing for a "learning" line that has no verified buyer.

**⚠️ Note how this refines §6.5 rather than contradicting it.** Shipping an MCP server *for reach* is hygiene — every serious vendor has one, so its absence disqualifies Fieldguide. But **selling MCP-served context as a product** is a different thing: it is a **funded budget line** that the closest competitor's money has already moved into. Fieldguide cannot differentiate on *having* an MCP server; it can differentiate on *what the graph knows* that agents otherwise get wrong — which is the design-rationale and provenance gap (§3.2, §7).

### 5.6 Verdict: which budget actually pays

Three candidate budgets, honestly assessed:

**(a) Enterprise / team budget — most defensible, but not for "learning".** Evidence: Understand sustains **$100–120/mo per developer**, 12-month minimum, sold by quote — and its market is **regulated/safety-critical engineering** where understanding is a compliance artifact. Qoder CN sells VPC deployment at **¥199/seat·mo with a 50-seat minimum** on data-safety grounds. CodeBuddy sells 专有云 at **¥316/seat·mo, 100-seat minimum**. The established per-seat band for dev tooling is **~$10–$72/dev/month** (Copilot, CodeRabbit, Graphite, Snyk, Sourcery, Notion). **These buyers pay for auditability, sovereignty and review safety — not for spaced repetition.** A comprehension tool can reach this budget only by attaching to a compliance or review outcome. And note the motion mismatch: the closest analogue vendors sell **top-down on annual contracts**, not self-serve.

**(b) Individual-developer budget — essentially unproven.** The anchor is $0 (graphify, codegraph, DeepWiki public, Code Wiki preview), with the paid alternatives at **$9.99/mo** (CodeBoarding Pro) and **¥59/mo** (Qoder CN). There is **no evidence found of out-of-pocket developer spending on codebase comprehension**. And the relevant sentiment data is hostile: **"prohibitive pricing" is the #1 turn-off** for tooling used on personal projects (SO 2025, `TechOppose_Personal`). **This is Fieldguide's most dangerous budget to target.**

**(c) Interview-prep / learning budget — consumer-*initiated* but employer-*reimbursed*, with thin ARPU.** Real price points: **LeetCode $35/mo, $159/yr — and a $299/yr tier (≈$13.25/mo effective annually)**; **DesignGurus $123/mo**; **ByteByteGo $150/yr**; **Coursera Plus $59/mo or $399/yr** (`SECONDARY`); **O'Reilly** dual individual/team tiers (I verified **$129** and **$499** and the tier structure in an archived page; the reported **$49/mo could not be independently recaptured** and is not quoted). But the decisive detail is who actually pays: ByteByteGo's founder states *"Many subscribers use their **company's learning budget** to cover the cost of this."* So this budget is **consumer-initiated and employer-funded** — a *governed* budget wearing consumer clothes — and it is thin: SRS in its best-evidenced domain monetises at only **~$6–10/mo** (§5.7). **No survey measures out-of-pocket interview-prep spending at all** — SO's 39.5% figure is unpaid *time*, not dollars.

**I verified the key SEC datapoint directly** (the market strand flagged it for manual spot-check, then self-corrected a claim about it). From **Coursera's FY2025 10-K** (filed 2026-02-23, accession `0001651562-26-000015`, fetched from `sec.gov` — segment note reproduced in `06-market-evidence.md`):

| Year | Consumer | Enterprise | Total | **Consumer share** |
|---|---|---|---|---|
| 2023 | $416.2M | $219.6M | $635.8M | **65.5%** |
| 2024 | $455.8M | $238.9M | $694.7M | 65.6% |
| 2025 | **$502.2M** | $255.3M | **$757.5M** | **66.3%** |

**Two things follow, and the second corrects a natural assumption:**
1. Coursera has exactly **two reportable segments — Consumer and Enterprise** — and **Consumer is ~66% of revenue**, i.e. individuals, not employers, are the larger payer at consumer scale.
2. **The consumer share is flat-to-marginally-*up*, and consumer is growing *faster* than enterprise: Consumer +10% YoY in both 2024 and 2025, Enterprise +9% then +7%.** So "developer-learning money is overwhelmingly B2B" **does not generalise from corporate-upskilling vendors to consumer-scale marketplaces.** Any argument that Fieldguide must be enterprise-only is not supported by this data.

**Caveats:** Coursera is general education/upskilling, **not developer-specific interview prep**, and it is a marketplace with content partners — so this establishes that individuals pay for learning at scale, not that they pay for *codebase* learning or for SRS over a private repo. **And the picture is genuinely mixed, not a clean win for consumer:** **Udemy's Enterprise segment is now 66% of revenue, up from 58%, with consumer down ~9% YoY**, and **Pluralsight is 87.7% business** (consumer share falling 18.9% → 12.3%) — both from SEC filings. So **corporate upskilling platforms are decisively B2B while consumer-scale marketplaces are not**, and Fieldguide should not generalise from either alone. Also note **Udemy no longer appears in SEC's ticker file**, consistent with its 2025 take-private.

**Bottom line:** the premise is well-founded (§5.1), the pain is rising under AI (§5.3), and money exists in all three budgets. The enterprise budget is largest and most defensible but pays for **compliance/verification, not learning**; the consumer learning budget is **verified to be real and growing faster than enterprise at marketplace scale** (§5.6c) but is spent on *generic* skills; and the individual dev-tool budget is anchored at **$0** by free competitors. **Fieldguide's current positioning — a comprehension workbench — sits across the weakest combination: it asks individuals to pay for a tool they can get free, without attaching to the enterprise compliance outcome that actually commands $100+/dev/month.**

### 5.7 The critical caveat on the recommended wedge (SRS)

Since §2 identifies spaced repetition as the only uncontested layer, it must be de-risked. The cognitive-science evidence is **strong for retention and weak for transfer**, and this materially constrains the design:

> *"Both quiz formats improved performance on **definition questions**; however, **quizzing benefits were less robust on novel application questions**. Multiple-choice quizzes did not improve novel application performance and short-answer quizzes only did so when definition questions preceded application questions… Furthermore, **spaced review did not improve performance on either question type**. These findings present limitations of retrieval practice and distributed practice."*
> — Uner, *"Does the Combination of Spacing and Testing Promote Transfer Beyond Either Strategy Alone?"*, [WUSTL](https://openscholarship.wustl.edu/art_sci_etds/2540/)

**Design implication, stated bluntly:** if Fieldguide's SRS deck asks *"what does module X do?"*, it will produce fluent recall and **no transfer to real work** — and it will look like a flashcard app. To be defensible, the cards must be **application/decision questions of the form "you need to add feature F — which files change and why?"** That is exactly the question `codebase-to-course` already asks: *"Interactive quizzes that test **application** not memorization ('You want to add favorites — which files change?')"* ([README](https://github.com/zarazhangrui/codebase-to-course)). Fieldguide would be adding scheduling and mastery over that question type — not inventing a new one.

*(The general claim that practice testing and distributed practice rank as high-utility techniques is from Dunlosky et al. 2013, "Improving Students' Learning With Effective Learning Techniques", [APS](https://dev.psychologicalscience.org/publications/journals/pspi/learning-techniques.html), DOI 10.1177/1529100612453266 — I could not fetch the full text to verify the specific utility ratings, so treat that citation as **partially verified**.)*

**⚠️ And a monetisation reality check that tempers the whole wedge — SRS works but is hard to charge for, and my earlier wording here overclaimed.** Spaced repetition has its strongest real-world *usage* evidence in **medicine**: Anki adoption runs high (**94% / 82%** across studies) and Anki-based study is **associated** with better exam outcomes. **However — and this is a correction to my own earlier draft — the studies I could verify are *observational and cross-sectional*, not experiments.** The three PMIDs that resolve are *"Utilization Patterns and Perceptions of a Spaced Repetition Flashcard Program, Anki, Among First-Year Medical Students"* (PMID **41322734**, 2025), *"Wellness and Work: Anki, Study Habits, and Exam Outcomes in First-Year Medical Students"* (PMID **41939075**, 2026), and *"Using Anki and its association with recall and study practices among medical students in Jordanian universities: a cross-sectional study"* (PMID **41862940**, 2026) — all verified via Europe PMC. Note the words *"association"* and *"cross-sectional"*: **these establish usage patterns and correlation, not causal score gains.** I therefore withdraw my earlier characterisation of "4–13 point USMLE score gains" as *"genuinely large, replicated effects"* — treat score-gain figures as **associational**, pending an experimental source. **A fourth PMID supplied for this set (42183420) does not resolve in Europe PMC** and is not cited.

**On monetisation:** Anki itself is free; **AnkiHub's tiers are free / $6 / $10 per month / $450 lifetime** — i.e. single-digit dollars on a free core. **So the correct conclusion is that SRS should be a *retention mechanism inside* the product, not the product's positioning or its price anchor.** A tool that presents itself as "spaced repetition for code" inherits a ~$6–10/month ceiling and a free competitor — exactly the trap §2.1 describes.

---

## §6. What this means for Fieldguide — the honest strategic read

1. **Stop selling "understanding an unfamiliar codebase."** That exact phrase is a free feature of Google, Cognition and two 100k-star OSS projects, and on Hacker News it scores 2–4 points. The PM's instinct that the product is "ordinary" is correct — but the fix is not more features, it is a different promise. **And confront §4.5b first: Sourcegraph App was a free local desktop comprehension app whose only success metrics were downloads and trial starts. It got 1 HN point and was shut down. If Fieldguide's plan is "free local app → individuals adopt → upgrade to paid", that plan has already been run and failed, and it needs a metric better than downloads to justify repeating it.**
2. **The one uncontested layer is the learning loop — and it has experimental support but NO demand evidence.** Knowledge-graph retrieval is solved and free. **Spaced repetition + mastery + comprehension quizzes + "you can answer questions about this system"** over a *live, changing* codebase is shipped by **nobody** verified — while the one controlled study in this space (Lacy, FSE 2026) measured **83% vs 57% quiz scores for expert-curated tours over AI-only tours** at a real company, and that company adopted it (§4b). Make the learning loop the headline, and make **quiz performance the headline metric** — it is Fieldguide's only route to a provable claim. (Build the questions as *application* problems, not recall — §5.7.)
   **⚠️ State the risk plainly:** an exhaustive seven-area gap search (**1,054 lines, ~146 blockquotes**) found **zero evidence of demand for progress tracking, spaced repetition or interview questions grounded in a codebase** — the researchers were not looking for it and found nothing incidentally either (see `04-gaps-and-pain.md`, §"What this means"). This wedge is **differentiated and unvalidated**. It is the strongest *positioning* available and simultaneously the least *proven* — which makes it the single most important thing to test with real users before building more of it.
3. **The best-evidenced pain is AI verification, not legacy onboarding.** The #1 AI frustration is *almost-right output* (**66%**), **63.3%** say AI lacks codebase context, **66.2%** don't trust it, core developers now review **6.5% more code** while producing **19% less**, and **61.3%** say they'd still seek a human specifically *"when I want to fully understand something"*. "Prove you understand what the agent wrote, before you merge it" is a sharper, more urgent, more team-level claim than "onboard onto this repo" — **and it avoids DORA's null result on documentation-vs-ramp entirely**, because the outcome being sold is review confidence, not onboarding speed.
4. **Do not build the business case on "faster onboarding" — build it on documentation quality.** This is a sharpening of my earlier advice, because the evidence turned out to contain both halves at once. The popular durations are a mangled manager's guess (§3.6), and **DORA's new-hire-specific test was null** — *"new hires don't get any special benefits from these practices."* **But the same passage yields the single best positive number in this research: new hires on teams with well-written documentation (±1 SD) are 130% as productive** (§5.4). **The correct pitch is therefore "knowledge quality is a 130% productivity lever for the whole team", not "we speed up onboarding"** — and the 130% must always travel with its two DORA-stated caveats (cross-sectional, not an experiment; not new-hire-specific) or it will not survive scrutiny. This also finally gives Fieldguide a defensible outcome metric to sell against: **documentation/knowledge quality**, which is what it actually improves.
5. **Fix distribution before adding features — but do not mistake MCP *reach* for differentiation.** Fieldguide has no MCP endpoint, no editor extension, no CLI, no CI/PR surface and no shareable artifact, so it cannot use any mechanism that has actually worked here (§4.1, §4.4). Adding them is **hygiene, not a moat**: every serious vendor already ships an MCP server (DeepWiki MCP — free and unauthenticated, Sourcegraph, CodeScene CodeHealth, NDepend, Structurizr, Sonar, GitKraken), so **being MCP-reachable is table stakes by 2026**. Ship it because its absence disqualifies Fieldguide from consideration, not because it differentiates. **⚠️ But note the distinction (§5.5b): MCP-served context sold *as a product* is a funded budget line** — it is where Swimm's money went — even though merely *having* an MCP server differentiates nothing.
6. **Make the output the artifact — this is the answer to "too single-feature."** The single best-evidenced and best-fitting growth mechanism for Fieldguide is to turn **one repository into one shareable, URL-addressable, publishable artifact** (an interactive graph / layer view / guided tour) that carries a back-link and **auto-refreshes when embedded** — the DeepWiki loop, documented in its own README (*"Make a badge for your README that links to your repo's DeepWiki. We auto-refresh DeepWikis if their repo has a badge"*) and the reason it reached 50,000+ repos. The product then sells what *other people see*, not a feature list the user has to be told about. **Crucially this must be public and linkable — a purely local graph has zero viral surface**, so if privacy is the brand, the shareable artifact must be an explicit, per-repo, user-initiated export rather than a default. Combine it with an MCP server so the same graph answers questions inside the editor already open. Per the adoption research this is *"the single highest-value change in product shape (not just marketing)"* — while being honest that **no dev tool publishes a viral coefficient**, so adopt it for its mechanics, not a forecast.
7. **Copy Bruno's wedge logic, not its feature list.** Bruno went **~250k MAU (Jan 2025) → 600k+ (Dec 2025)** with a **1,538-point HN launch**, not by being a better API client but by removing an imposition users were angry about (Postman's forced accounts). **Fieldguide's equivalent impositions are abundant and documented: cloud-only repo wikis, default-on telemetry (codegraph), default-on code upload (Zhipu's ZCode), forced accounts, and unverifiable AI explanations whose own vendor says you must check the source yourself.** Pick one, remove it, and lead with that — rather than adding a view.
8. **Make "local-first" auditable, because the category just got burned.** Zhipu shipped a default-on, no-off-switch repo-wiki uploader while marketing data sovereignty (§3.5). Ship **egress off by default**, a published data-flow statement, a visible audit page, and a local-model path — and open-source the parts that make the claim checkable. This is Fieldguide's most credible *trust* asset; it is not a feature-list item. **Also sign and notarise the Windows installer:** install friction (*"code signing… just not worth it"*, 398-pt HN thread) is a documented drop-off point for desktop tools, and an unsigned Electron app triggers SmartScreen before the user has seen any value.
9. **Pick a buyer — and consider two-sided pricing from the same graph.** Learn-from-Understand: **$100–120/mo** is achievable, but only against a compliance/review outcome, not a learning preference. **Learn-from-Graphify Labs (the most important one): an OSS wedge at 100K+ stars, then a paid enterprise layer that sells PR-level formal verification of AI changes to enterprises that need air-gapped deployment — with Fortune-100 logos.** Learn-from-CodeBoarding: architecture views did not monetise; **PR review did**. Learn-from-CodeSee: the pure-play onboarding product with guided tours was absorbed and its brand switched off. Learn-from-GitNexus: the same open-core shape, noncommercial licence, enterprise pitch. **Learn-from-Sourcegraph App: the free-local-app-as-funnel play was tried and killed (§4.5b) — do not repeat it without a better metric.**
   **And the option both failures point to (§5.5b):** Swimm, a $33.3M-funded company in this exact lane, now sells its knowledge base **to AI agents rather than humans** — *"Build the validated knowledge base your AI tools need to understand your codebase. Copilot, Cursor, Claude Code, internal agents, MCP servers."* The matching demand signal is the strongest single number in this research: **64.6% of professional developers say AI tools lack their codebase's context**. So the same graph could be sold **twice** — human onboarding/ramp to engineering leadership, **and** grounding/context infrastructure for agents, which rides the growing **AI tooling budget** instead of competing for a learning line with no verified buyer.
10. **Sell to the buyer's fear, not the user's annoyance.** Verified asymmetry (GitLab, n=5,300+): executives rate AI *risk* at **56%** and the *skills gap* at **35%**, while practitioners report actually being blocked at only **40%** and **26%** (§3.4). **The buyer releases the budget; the user experiences the friction.** A pitch framed around governance, verifiable comprehension and auditable skill coverage — the executive's concerns — will be funded more readily than one framed around the developer's own irritation with bad AI explanations.
11. **Exploit the four genuine content gaps found:** (i) **design rationale** — no tool reconstructs *why* the architecture is the way it is, and one of the top DeepWiki commenters asked for exactly that; (ii) **provenance** — nobody can distinguish generated from human-authored docs, and maintainers are actively angry about it; (iii) **expert curation** — Lacy shows curated tours beat AI-only by 26 points, and the top critique of the closest look-alike was that generic docs miss the project's "secret sauce"; (iv) **"proof of freshness" / grounded-and-stable** — nobody verifies that a knowledge claim is still true after a commit, and nothing is both code-grounded and deterministic across regeneration. All four are defensible, and none of them is a graph.
12. **Demote Obsidian from a value proposition to a channel** (§1.4), and note the negative signal: "code graph in my Obsidian vault" has **9 stars**.

---

## §7. Differentiated-capability scorecard (the one-line answer to the PM)

| Claim | Differentiated? | Strongest competitor taking it | 
|---|---|---|
| Knowledge graph of a repo | ❌ | graphify 120k★, Apache-2.0, free |
| Architecture / layer views | ❌ | Google Code Wiki (free, auto-generated) |
| Grounded repo Q&A | ❌ | Code Wiki, DeepWiki, Zread, Qoder CN |
| Guided tours | ❌ | codebase-to-course 5,581★, free |
| arXiv → code nodes | ⚠️ rare | graphify `/graphify add <arxiv-url>` |
| Obsidian export | ❌ | graphify outputs an Obsidian vault |
| Offline / no-egress | ⚠️ temporary | Chinese 私有化; Google's local CLI coming |
| **Spaced repetition + mastery + interview accountability over a live repo** | ✅ **nothing found — and no demand evidence either** | — |
| **Design-rationale capture ("why")** | ✅ **nothing found** | — |
| **Provenance / human-vs-generated doc trust** | ✅ **nothing found** | — |
| **"Proof of freshness": verifying a knowledge-layer claim is still true after a commit** | ✅ **nothing found** | the Swimm "verification tests" idea, vacated when Swimm pivoted |
| **A knowledge layer that is both code-grounded AND stable** (deterministic across regeneration) | ✅ **nothing found** | Code Wiki's sharpest complaint is that regenerated content is *"completely different"* the next day; everything else either regenerates or rots |
| **Design-rationale capture and custodian-verified architecture** | ✅ **nothing found** | the audit-trail angle: nobody records *who* confirmed a claim about the system, or when |
| **Comprehension quizzes / measured comprehension as the product metric** | ✅ **nothing commercial** | only the academic Lacy system (FSE 2026) does it — and it beat AI-only tours by 26 points (§4b) |
| **Expert-rationale curation ("the secret sauce")** | ✅ **nothing found** | the #1 critique of the closest look-alike product, Doculearn (§4.6) |

**One more structural point that argues against Fieldguide's architecture views as a moat:** Structurizr owns the *authoritative* form of architecture description (it is the C4 reference implementation), and a deliberately-authored model is a **stronger evidence class** than a graph *inferred* from code. An inferred architecture view can never be more trustworthy than the authored one — so competing there means competing on the weaker side of an evidence hierarchy. **Caveat: Structurizr's own commercial cloud/Lite/CLI/on-prem offerings were declared EOL in 2026**, so the *hosted* form of authored architecture has just retreated — which arguably reopens a little room, though the authored-vs-inferred evidence asymmetry still holds.

**Recommendation:** the defensible product is not "a knowledge-graph workbench with Q&A". It is **"the tool that makes you accountable for understanding your codebase — curated by your own experts, verified by quizzes, retained over time, and running entirely on your machine."** The graph is the mechanism; **the expert `why` and the measured learning loop are the product** (§4b).

**The one-sentence version for the PM:** Fieldguide is not too single-feature — it is aimed at a feature Google now gives away. Point it at the thing Google structurally cannot generate (your team's project-specific rationale) and give it the thing nobody ships (measured, retained comprehension).

---

## §8. Claims I could NOT verify (do not repeat these as fact)

1. **Onboarding duration ("3–6 months", "6–9 months" to productivity)** — **traced and found to be unsourced vendor folklore** (§3.6). The circulating citations (Stripe Engineering Blog 2023, HBR 2023, Gallup 2024 "8.2 months", University of Minnesota CUHRO, Brandon Hall) could not be located and carry the signature of phantom citations. **Neither SO 2024 nor SO 2025 measures onboarding time at all.** Use instead: DORA 2023's **8% new-hire productivity gap (n≈3,000)**, Microsoft's **"several weeks"** (ISEC '17, 8 product teams — itself sourced to a staffing-agency press release), or Ju et al. 2021's **"not productive for months"** (ICSE 2021; 32 dev + 15 manager interviews, surveys N=189/N=37).
2. **Onboarding cost in dollars** — "$240,000/developer", "$165–240K recruitment mistake", "50/125/200% of salary (Forbes)", "30% of first-year salary (US Dept of Labor)" — **all UNVERIFIED**; no underlying document located. **And a documented misattribution to correct: "$40K+ cost per hire (SHRM 2023)" is neither SHRM nor 2023.** Its real origin is an endnote in the 2005 MIT SMR article pointing to **R. McNatt & L. Light, "Job Turnover Tab," *Business Week*, 20 April 1998** — and it measures **turnover, not onboarding**. Vendor pages relabelled it "SHRM 2023": a 25-year drift with a fabricated attribution. The only traceable *revenue* claim remains a 2003 **unpublished** Mellon Financial study reported in MIT SMR (2005): **1%–2.5% of revenue**, covering new hires **and transfers**.
3. **"58% comprehension + 24% navigation ≈ 82%"** — secondary, vendor-authored (feenk); the underlying TSE tables are paywalled and ACM returned **403**.
4. **"81% of devs spend more time in code review; 28% report 30% longer"** — attributed to **Harness** (a CI/CD vendor) via ITPro; the report's methodology page and sample size could not be located. **VENDOR + secondary, low confidence.**
5. **"42,411 files packed and 564 upload attempts"** in the ZCode incident — source page returned **403**; not asserted.
6. **DORA 2023–2025 specific figures** — verified in §5.4 and `_raw-dora-onboarding.md`. **Note the corrected framing:** DORA **2024** found AI hurt **both** throughput (−1.5%) and stability (−7.2%) per +25% adoption; the "throughput recovered, stability did not" reversal is **2025**. An earlier draft of this report had that backwards. DORA's PDFs should be re-read before quoting exact coefficients, since that report has published errata.
7. **Premise correction from the research brief:** **DBngin is not discontinued** — Build 92 shipped 2026-09-04 and its repo is not archived. There is no sunset announcement to cite.
8. **Zread adoption numbers** (users, repos indexed, traffic) — no vendor-published figure found; Zhipu publishes only group-level MaaS token growth.
9. **Obsidian revenue/ARR** — the vendor publishes plugin/download/organisation counts but **no revenue figure**.
10. **Cursor "Self-Hosted Machines" scope** — the docs URL returned **404**; do not claim on-prem Cursor.
11. **CodeGeeX model-licence terms for commercial use** — weights are explicitly *"open for academic research"* with a registration form for commercial use; not OSI open source.
12. **Trae's data-residency posture** — two ByteDance-owned pages **contradict each other**; cite both or neither.
13. **Dunlosky et al. 2013 utility ratings** — cited via the APS landing page; the full text was not retrievable, so the specific "high utility" ratings are partially verified.
14. **Hacker News point counts** are single data points from a self-selected audience; used here as a *pattern*, not as a measurement.
15. **No k-factor, viral coefficient or referral attribution exists publicly for any developer tool.** The shareable-artifact mechanism is real and universal but **unmeasured** — cite its mechanics, never a modelled growth rate.
16. **No vendor attributes revenue, retention or growth quantitatively to being an MCP server.** DeepWiki shipped a real MCP server and published zero numbers.
17. **No measured free→paid conversion dataset exists for developer tools**, and none for desktop dev tools. The **OSS→paid "1–3%" figure has no primary source** (a consultancy citing an unlinked "OpenView Partners"; Elastic's "~1%" is second-hand) — **folklore**. The only dataset with a disclosed sample is **ChartMogul/ProductLed: 200 B2B products, median free→paid 8%, card-required trials 30%** — **not dev-tool-specific**.
18. **No neutral or audited study links install-step count to conversion rate**, and PostHog's activation figures (14.2% vs 2.6% conversion, etc.) are **vendor self-reported**. There is **no dev-tool-specific activation benchmark**.
19. **CodeRabbit's GitHub star count could not be retrieved** — every `github.com/coderabbitai/*` page aborted TLS from this environment while other GitHub pages scraped normally, so no star figure is cited for it. Also: the **GitHub REST API was rate-limited to 0/60** for the whole session, so all star counts here come from HTML scrapes and **drift daily** — every audited figure in this report is a **late-September-2026 point-in-time reading**.
20. **CodeScene knowledge-map and "code red" numbers** are **vendor-published with no independent replication**; its larger corpus (40 projects / 139,869 files / 1,414 developers) proves dataset scale, not the validity of its findings. Two truck-factor studies were confirmed to exist (DOI/authorship) but their **sample sizes were unobtainable**, so no figures are quoted for them.
21. **Reddit contributed nothing** to this research — every attempt returned **403**. Community sentiment here rests on Hacker News, GitHub issues, vendor forums and academic sources.
22. **Explicit research gaps (treat as gaps, not negative findings):** **CodeViz was not researched at all**; **NDepend pricing** could not be found (both candidate URLs 404); **CodeSee's total funding** (Crunchbase 403, PitchBook paywalled); **Sourcegraph post-2021 funding** and whether Cody retains any free tier; **Gource's real-world adoption** (no published numbers); **CodeRabbit's star count** (TLS blocked, above); and no figure exists for **GitHub Marketplace install/reach** (a community request for install statistics is unanswered). The **542-repo count** for `codebase knowledge graph` is reported by a strand and was **not independently re-run** (the GitHub search API was rate-limited to 0/60 all session) — treat as indicative.
23. **⚠️ A claim in an earlier draft of this report was wrong and is corrected in §1.1b:** graphify was initially described as having *"no company"* and *"no pricing page"*. It is in fact the OSS wedge for **YC S26 Graphify Labs**, which sells a paid enterprise layer. The correction is the most consequential single finding in the research, so it is flagged rather than quietly edited. **Lesson: "I found no pricing page" is not evidence that no business exists** — the absence of a price on the OSS artefact said nothing about the company behind it.
24. **The SRS wedge has free attempts with no traction.** Beyond the absence of commercial SRS-over-codebase tools, there are existing free projects doing exactly this and going nowhere: `ai-study-kit` (**0★** — already ships an SRS review queue plus interview prep), `magic-memory` (3★), `GoCard` (58★). Combined with §6.2's warning, this is **the strongest available evidence against the recommended wedge's demand** — the differentiation is real, the demand is unproven, and the graveyard is not empty.
25. **Willingness to pay is genuinely unmeasured.** Every demand signal in this research is **attention, not budget**. In particular, **no named Western enterprise publicly states it runs local models *because* policy forbids cloud** — the only supporting item is a single anonymous HN comment (a Swiss IT worker self-building a vLLM box). Chinese 私有化 is priced and named; Western local-first demand is inferred. Do not claim verified enterprise willingness to pay for offline in the West.
26. **Statistics that are refuted or untraceable — do not use:** "median developer tenure ≈ 2 years" (**BLS says 4.3 years**); "replacing an employee costs 6–9 months' salary" (the Gallup citation now **404s**; the trail ends at SHRM); the COBOL folklore set ("95% of ATM swipes", "$3T moved daily") — **refuted**; any "% of orgs banned AI" beyond Cisco's traceable **27%**. Also **`NO TRACEABLE PRIMARY SOURCE`**: Stripe's onboarding report (0 hits for `onboard`/`ramp` in 114,010 extracted characters — and it claims "six countries" while its own methodology names five), a "Plug and Play" onboarding survey that appears not to exist, and DORA/Tasktop/DX/Ewerlöf onboarding figures.
27. **Hacker News comment-level upvotes do not exist** — only stories are scored. Every comment-based claim in this report uses the **parent story's point count as a stated proxy**, not a per-comment score. Do not treat a quoted comment as "upvoted".
28. **The CodeSee acquisition figure is `PARTIALLY VERIFIED`:** GitKraken's own press-release page returns **403** to automated fetches, so the acquisition is sourced to **SD Times and FinSMEs (both fetched, 200)** rather than the vendor's own statement.
29. **Sourcegraph Cody and Swimm have no complaint corpus** — there is no usable evidence base for either's user sentiment, which is why this report says little about them despite both being named in the original brief.
30. **"Developers spend 10× more time reading than writing code" is NOT a JetBrains statistic** — it does not appear in JetBrains 2023–2025. **JetBrains never measures onboarding time, and never measures a read-vs-write split.** Likewise **Stack Overflow has no onboarding-time question** in either 2024 or 2025. If someone cites either body for a read/write ratio or an onboarding duration, ask for the question ID.
31. **LeetCode, ByteByteGo and Educative pricing** were partly recovered via Wayback (LeetCode is Cloudflare-403 to automated fetches) or from JS-rendered pages, so those three price points are **lower-confidence** than the vendor pricing in §2.1 (which was read from live pages).
32. **SciTools' perpetual + maintenance licensing appears retired** — only the annual subscription ($100–120/mo, 12-month minimum) is published; the support FAQ URL 404s. Do not describe Understand as available perpetually without re-checking.
33. **⚠️ A near-miss quotation was caught during audit — the failure mode this report exists to guard against.** One strand reported the JetBrains responder-bias sentence as a verbatim quote reading *"Some bias may remain, as JetBrains users could have been more likely to respond."* The **actual live text** is: *"Despite these measures, some bias is likely present, as JetBrains users might have been more willing, on average, to complete the survey."* Close in meaning, **wrong as a quotation**. I quote the real wording (§5.4). It was the only such error found across five research streams, and it sat in a low-stakes sentence — which is precisely why quotes are re-verified against the source rather than trusted from a summary. **A plausible near-quote will survive casual review; only fetching the page catches it.**
34. **⚠️ A supplied PMID did not resolve, and I checked before citing — the discipline this report asks of its readers.** Four medical-SRS studies were supplied with PMIDs; I verified each against **Europe PMC**. Three resolve (41322734, 41939075, 41862940); **PMID 42183420 returns no result and is not cited.** More importantly, the three that do resolve are **observational / cross-sectional** — one is titled *"…a cross-sectional study"* — so they support **association, not causation**. This forced a **correction to my own §5.7**: I had written that Anki "produces 4–13 point USMLE score gains — genuinely large, replicated effects," which overclaims. Score-gain figures are now labelled **associational, pending an experimental source**. **Lesson: a citation supplied by someone else, however specific-looking, is a claim to verify, not a fact to carry.**

---

## §9. Source files

Detailed working notes, including fetch logs and per-URL HTTP statuses, are in `docs/research/`:

- `01-landscape-differentiation.md` — landscape, CodeSee/Sourcetrail forensics, competitor details
- `02-western-landscape.md` — 17 Western tools with per-tool pricing, licence, funding/status and a URL-by-URL verification log
- `03-china-and-pkm.md` — Chinese-market tools, on-prem/local-deployment matrix, Obsidian/PKM overlap (~95 KB, 45 explicit UNVERIFIED disclosures)
- `04-gaps-and-pain.md` — **the evidence dossier**: 7 pain areas (hallucination, context limits, privacy, onboarding/doc rot, tool-quality complaints, knowledge loss/bus factor, offline demand); ~1,054 lines, ~146 blockquotes, 235 source links, 15 UNVERIFIED / 6 no-traceable-source flags, 19-row dead-link table
- `05-adoption-mechanics.md` — 8 adoption mechanisms, 92 verified links, ranked hooks, and an explicit note that **stars do not predict revenue**
- `06-market-evidence.md` — survey/filing evidence, numbers table with sample sizes and confidence
- `_raw-dora-onboarding.md` — DORA 2023/2024/2025 findings and the full provenance trace of onboarding-duration claims
- `_raw-pricing-budgets.md`, `_raw-market-size.md`, `_raw-jetbrains.md` — pricing band, analyst forecasts, JetBrains data

**Three method notes that matter for trusting this report.** (1) **The verification ledger is not evidence of coverage** — a formal three-round audit recovered **nine verified claims that had been "URL verified, claim dropped"**: the source resolved, but the claim, caveat or honesty flag it supported never reached the body text. Four of nine were this exact pattern. Ten of them would have passed any link check. The sharper lesson, and the one to carry into any similar synthesis: **the summary a subagent writes for you is a better audit instrument than the artifact it leaves on disk**, because the summary is already prioritised — so anything present there but absent from your own synthesis is a real omission. Diffing summaries against the final text caught every drop; no link checker would have. **Inline quotes are stronger evidence than resolved links.** (2) **Point-in-time**: every star count, install count and price here is a late-September-2026 reading and drifts daily. (3) **Access blockers**: PowerShell script execution is disabled on this host (inline every function); Sourcegraph (403), Crunchbase (403), ACM (403), Reuters (401), Reddit (403), InfoQ (405, "method not allowed"), `sec.gov` for re-verification (403), `ouci.dntb.gov.ua` (502) and IEEE Xplore (empty 202) block automated fetches — use Wayback, Crossref, Semantic Scholar, the arXiv API or the EDGAR full-text archive instead. The GitHub REST API was rate-limited to **0/60** for the entire session, so stars come from HTML scrapes.
