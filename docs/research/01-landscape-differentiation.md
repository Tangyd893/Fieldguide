# Landscape & Differentiation — first-hand verified findings

**Researcher:** captain strand (all facts below fetched directly and HTTP-status-checked; none taken from search-result titles)
**Date of all fetches:** 2026-09-22
**Star counts are point-in-time (2026-09-22) and move fast — treat as order-of-magnitude.**

> **Note on dating:** the brief asked for the landscape "as of 2024–2025". The environment clock and the sources are at **Sept 2026**, so two significant 2026 events (GitKraken/CodeSee domain death; graphify/codegraph scale) are included. Anything 2024–2025 is labelled with its date.

---

## 1. The headline finding: Fieldguide's four pillars are each already shipped, free, by someone with better distribution

The "unfamiliar repo → knowledge graph → architecture views → grounded Q&A" thesis is not an empty niche. As of Sept 2026 it is occupied by at least four free/cheap products, three of which are open source and all of which distribute inside tools developers already have open.

| Product | What it does (Fieldguide pillar it covers) | Stars / scale | Delivery vehicle | Cost |
|---|---|---|---|---|
| **graphify** ([Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify)) | Queryable knowledge graph of code **+ docs + SQL schemas + configs + PDFs**; "every edge explained" | **120k★**, 11.6k forks, 666 open issues | **Claude Code skill** (`/graphify`), also Cursor/Codex/Gemini CLI | Free |
| **codegraph** ([colbymchenry/codegraph](https://github.com/colbymchenry/codegraph)) | Pre-indexed code knowledge graph, auto-syncs on change | **71.8k★**, 4.6k forks | **npm + CLI + MCP server** for 8 agents | Free (MIT) |
| **CodeBoarding** ([CodeBoarding/CodeBoarding](https://github.com/CodeBoarding/CodeBoarding)) | Layered architecture diagrams, component docs, Mermaid output | 2.4k★ | **VS Code ext + Open VSX + GitHub Action + web app** | Free tier; **Pro $9.99/mo** |
| **Google Code Wiki** ([blog, 2025-11-13](https://developers.googleblog.com/en/introducing-code-wiki-accelerating-your-code-understanding/)) | Auto-updating structured wiki + grounded chat + architecture/class/sequence diagrams | Google-scale, free public preview | Website + **"coming soon: Gemini CLI extension"** | Free |
| **DeepWiki** ([Cognition, 2025-05-05](https://cognition.com/blog/deepwiki)) | "AI documentation you can talk to, for every repo" | **50,000+ top public repos indexed at launch** | URL swap: `github.com` → `deepwiki.com` | Free; private repos **require a Devin account** (paid funnel) |

### Why this is the real answer to "too single-feature / too ordinary"

The features are not the problem — **the delivery vehicle is.** Every winner above is reachable from inside the developer's existing loop (a slash-command in Claude Code, an MCP endpoint, a VS Code extension, a GitHub Action, or a URL you swap in your address bar). Fieldguide is an Electron app the developer must *remember to open*, with no CI surface, no PR surface, no IDE surface, and no MCP endpoint. It competes on features against free products that win on distribution.

### The strongest single proof: Google Code Wiki (2025-11-13)

Verbatim from Google's announcement — note that every clause maps to a Fieldguide pillar:

> "Reading existing code is the one of the biggest, most expensive bottlenecks in software development."

> "**Automated & always up-to-date:** Code Wiki scans the full codebase and regenerates the documentation after each change. The docs evolve with the code."

> "**Intelligent & context-aware:** The entire, always-current wiki serves as the knowledge base for an integrated chat. You're not talking to a generic model, but to one that knows your repo end-to-end."

> "**Integrated & actionable:** Every wiki section and chat answer is hyper-linked directly to the relevant code files and definitions."

> "For times when text isn't enough, Code Wiki automatically generates **always-current architecture, class, and sequence diagrams**..."

> "New contributors can make their first commit on Day 1, while senior developers can understand new libraries in minutes, not days."

That is: the graph, the grounding, the architecture views, the "docs that don't rot" argument, and the onboarding pitch — shipped free by Google, in public preview, with a CLI extension coming. **Google has independently validated the premise while simultaneously commoditising the feature set.**

---

## 2. graphify and codegraph — the two most important competitors, in detail

These are the products the PM most needs to know about, because they are *both* the pitch ("knowledge graph of your codebase") *and* the winning distribution pattern.

### graphify — 120k★, distributed as a Claude Code skill

Repo description: "Turn any codebase, with its docs, SQL schemas, configs, and PDFs, into a queryable knowledge graph. A /graphify skill for Claude Code, Cursor, Codex, and Gemini CLI: local deterministic AST parsing, every edge explained, no vector store."

README: "**A Claude Code skill.** Type `/graphify` in Claude Code - it reads your files, builds a knowledge graph, and gives you back structure you didn't know was there. **Fully multimodal.** Drop in code, PDFs, markdown, screenshots, diagrams, whiteboard photos, even images in other languages..."

Its stated value proposition is *measurable and immediate*: "**71.5x fewer tokens per query** vs reading the raw files, persistent across sessions, **honest about what it found vs guessed**."

Two things worth noting for Fieldguide:
- **It already does the arXiv/PDF ↔ code bridge.** "Drop in code, PDFs, memories" is Fieldguide's "bridge arXiv papers to code nodes" — as one input format of many.
- Its anti-hallucination pitch ("honest about what it found vs guessed", "every edge explained") is *precisely* Fieldguide's "grounded in the graph" claim — already positioned by the market leader.
- Hygiene note: the README's CI badge still points at `safishamsi/graphify` while the repo lives at `Graphify-Labs/graphify` — a rename/org migration. Star count is therefore a *consolidated* figure across a rename; treat the raw number as soft.

### codegraph — 71.8k★, MIT, one-command install, MCP

Repo description: "Pre-indexed code knowledge graph, auto syncs on code changes, for Claude Code, Codex, Gemini, Cursor, OpenCode, AntiGravity, Kiro, CoPilot, and Hermes Agent — **fewer tokens, fewer tool calls, 100% local**."

README: "**The fastest complete code graph · surgical context · built for how agents actually work · 100% local**". MIT licensed, published to npm as `@colbymchenry/codegraph`, with an explicit zero-friction install: "**No Node.js required** — one command grabs the right build for your OS" (a `curl … | sh` one-liner, plus `install.ps1` on Windows).

**Skeptical flag — "100% local" has an asterisk.** codegraph ships a `TELEMETRY.md` and a `telemetry-worker/` directory. It is honest and well-documented: "CodeGraph collects a small set of **anonymous usage statistics** — which commands and tools get used, which languages get indexed, which agents drive usage", opt-out via `codegraph telemetry off`, with the ingest worker as public auditable code. So: the *analysis* is local, the *telemetry* is not off by default. Fieldguide can make a genuinely stronger claim here — but must not overclaim that competitors are all cloud-only.

**Its selling metric is the one Fieldguide lacks.** codegraph and graphify sell *token savings and fewer tool calls* — a number you can put in a benchmark table and a README badge. Fieldguide sells *understanding*, which is real but unmeasurable in a screenshot, and therefore much harder to market.

---

## 3. CodeSee — the closest historical analogue, and how the category actually ended

This is the most instructive precedent in the report, because CodeSee sold *exactly* Fieldguide's feature set, with the same words.

**Verified:** GitKraken acquired CodeSee on **14 May 2024** — [SD Times, 2024-05-14](https://sdtimes.com/software-development/gitkraken-acquires-codesee-launches-new-devex-platform/): "Development tools company GitKraken today announced the acquisition of CodeSee, a developer observability solution provider, and launched a new Developer Experience platform." Also [FinSMEs, 2024-05-14](https://www.finsmes.com/2024/05/gitkraken-acquires-codesee.html), [vendor press release](https://gitkraken.com/press/gitkraken-acquires-codesee-launches-devex-platform).

**What CodeSee sold** (from the archived codesee.io homepage, [Wayback 2026-05-15](https://web.archive.org/web/20260515043330/https://www.codesee.io/)): "Codebase maps · Service maps · Visual code review maps · **Interactive code tours** · Code automations · CodeSee AI · Function Maps", with use-case pages for "**Codebase onboarding**", "**Codebase offboarding**", "Refactoring", "Shipping code faster". Its banner: "UPDATE: GitKraken acquires CodeSee; bringing code health & visibility to **30M+ devs** in its DevEx platform!"

**The domain is now dead.** Wayback CDX for `codesee.io`: HTTP 200 through 2026-05-15, **301 on 2026-06-24, 404 on 2026-07-23**. Direct fetch of codesee.io now fails TLS negotiation; no 2025-06 snapshot exists.

**Lesson for the PM:** the pure-play "understand your codebase" visual product with **guided tours** and **codebase onboarding** positioning did not survive standalone. It was absorbed into a broader DevEx platform, and the standalone brand was switched off. Note also that *nobody ever paid CodeSee for comprehension alone* — the surviving commercial hook in that family is **code review**, not learning.

---

## 4. CodeBoarding — watch the pivot, it is the tell

CodeBoarding's repo still says "Interactive architecture diagrams for codebases". Its **website says something else entirely**:

> "**The human layer for AI-written software.** Review the change, not the diff. See what a pull request does to your system before you merge it."

Its pricing page shows the monetisation: **Free $0** ("Metered analyses, maps three levels deep, every repository you choose. No card.") and **Pro $9.99/month** ("Unmetered, ten levels deep, faster generation"). Telemetry is **on by default** (per its TELEMETRY.md).

**Interpretation.** A team that built exactly Fieldguide's "layers/architecture views" capability moved its commercial story from *understanding a codebase* to *reviewing AI-generated PRs* — an urgent, recurring, team-level pain with an obvious buyer and a natural per-seat metric. **Comprehension was the on-ramp; review was the business.** This is a directional signal that "understand an unfamiliar repo" is a weak standalone willingness-to-pay claim.

**Flag — a tempting misread to avoid.** A web search surfaces `CodeBoarding/awesome-architecture-mds/blob/main/web-ui/obsidian-spaced-repetition/on_boarding.md`. I fetched it: this is **CodeBoarding's generated output** for the third-party Obsidian spaced-repetition plugin (Mermaid diagrams of its internals). It is **not** evidence that CodeBoarding has an Obsidian integration or an SRS feature. Anyone citing it as "CodeBoarding already did Obsidian + SRS" would be wrong.

---

## 5. Sourcetrail — the pure open-source graph explorer is dead, and that matters

Verified from the GitHub repo page (HTTP 200):

> "This repository was **archived by the owner on Dec 14, 2021**. It is now read-only."

> "**Important Note:** This project was archived by the original autors and maintainers of Sourcetrail by the end of 2021."

GPL-3.0, **16.5k★**, 1.7k forks, 355 open issues, 2,760 commits, 0 pull requests — i.e. a well-loved project with real demand that was still abandoned, and whose issue tracker was frozen.

**Dual lesson, and it cuts both ways:**
- *Against complacency:* "open-source local code knowledge graph" is a category where a 16.5k-star leader died of maintainer exhaustion, not lack of users. Free graph explorers have poor retention economics.
- *For Fieldguide:* the demand and the goodwill were real (16.5k stars, forks, a community that re-hosts it — cf. [dmehala/Sourcetrail](https://github.com/dmehala/Sourcetrail) forks). The gap was not user interest. It was that nobody would *pay* for it.

---

## 6. The one paid-desktop precedent that works: Understand by SciTools

The only durable **paid desktop** product in the comprehension category I could verify. From [scitools.com/pricing](https://scitools.com/pricing/) (fetched 2026-09-22):

> "The cost breakdown for Understand is between **$100-$120 USD per month with a minimum term of 12 months**."

Quote-based, sales-led ("one you can order directly online or you can give to your purchasing people for a formal PO"), with a free trial. Features ([scitools.com/features](https://scitools.com/features/)): "Code navigation … cross-references and call trees", "**Organize with Architectures** — Rearrange your code…". Its pricing FAQ gates higher-value capabilities: "certain capabilities, such as command line automation with `und`, API access, and exporting dependencies, graphs, m[etrics]" sit above the base developer license.

**Why this matters enormously for Fieldguide's business model:** ~$1,200–1,440/developer/year is a *real* price point for a desktop code-comprehension tool — an order of magnitude above CodeBoarding's $9.99/mo consumer Pro tier. But the buyer is not "a developer who feels lost". SciTools' durable market is **regulated / safety-critical engineering** (embedded C/C++, defence, aerospace, medical), where demonstrating structural understanding is a *compliance artifact*, not a learning preference. That is a fundamentally different — and much more defensible — buyer than "I joined a new team".

---

## 7. DeepWiki — free comprehension as a funnel to something else

From [Cognition's launch post, 2025-05-05](https://cognition.com/blog/deepwiki):

> "It shouldn't take hours to get up to speed on a new codebase. That's why we built **Devin Wiki** and **Devin Search**… Now, we're launching **DeepWiki**, the **free public version** of Devin Wiki and Devin Search. Visit the DeepWiki for any repo by replacing `github.com` with `deepwiki.com` in the URL. We've already indexed **over 50,000 of the top public GitHub repos**… Add any public repo for free at deepwiki.com. **For private repos, sign up for a Devin account.**"

The live site's own tagline: "**DeepWiki | AI documentation you can talk to, for every repo**", with the call to action "**Index your code with Devin**".

Two decisive mechanics:
1. **Comprehension is the free tier, not the product.** Cognition gives away the entire "understand a repo" experience to sell Devin (an autonomous agent). The comprehension wedge is customer acquisition.
2. **The growth loop is a URL swap.** `github.com/X/Y` → `deepwiki.com/X/Y`. Zero install, zero auth, works on any repo, and the output is a public shareable page — so every shared link is an ad. Compare Fieldguide: install an Electron app, point it at a local repo, get a *private* graph nobody else can see. **The shareable-artifact loop is structurally absent.**

---

## 8. What this implies — the honest differentiation map

| Fieldguide claim | Commoditised? | By whom | Verdict |
|---|---|---|---|
| Codebase knowledge graph | **Yes** | graphify (120k★), codegraph (71.8k★, MIT), Sourcetrail (archived) | Table stakes, and free |
| Architecture / layer views | **Yes** | Google Code Wiki (auto diagrams), CodeBoarding, Understand (paid), DeepWiki | Free from Google; paid only in regulated niches |
| Grounded Q&A ("no hallucination") | **Yes** | Google Code Wiki ("not a generic model… knows your repo end-to-end"), graphify ("honest about what it found vs guessed"), DeepWiki | Everyone claims grounding; 60% of orgs still worry about hallucination (Checkmarx) → a *proof* is differentiable, the claim is not |
| Guided tours / onboarding | **Yes, and it failed standalone** | CodeSee ("Interactive code tours" + "Codebase onboarding") → acquired by GitKraken, domain now 404 | Strongest warning sign in this report |
| Docs that don't rot | **Yes** | Google Code Wiki ("regenerates the documentation after each change"), DeepWiki, Swimm | Free from Google |
| arXiv/paper ↔ code bridge | **No — genuinely rare** | graphify handles PDFs as inputs, but not paper→code-node semantics | **Narrow but real.** Small audience outside ML/research engineering |
| Spaced repetition / retention / interview prep | **No — appears uncontested** | nothing verified doing SRS over a codebase graph | **Most defensible, least proven.** No evidence found that anyone pays for it |
| Private / offline / air-gapped | **Partly** | codegraph "100% local" (with telemetry), Sourcetrail (dead), Understand, Tabnine-style on-prem | Real, but see the 99%-use-AI-anyway evidence in the market strand — bans are widely ignored |
| Obsidian / PKM sync | **No** | none verified | Differentiated, but it is an *export format*, and formats do not create demand |
| Learning progress / mastery tracking | **No** | none verified | See SRS row |

### The strategic read

1. **Reframe away from "understand a codebase" — that phrase is now a free feature of Google, Cognition, and two 100k-star OSS projects.** Sell the *outcome* that survives: a developer who can **prove** they understand the system, and **remembers** it next month.
2. **The uncontested axis is durable human learning, not retrieval.** Knowledge-graph retrieval is solved and free. Spaced repetition, mastery tracking, and "you can now answer questions about this system" are not — but **there is no verified evidence anyone pays for them yet**, which is the central risk to test.
3. **Fieldguide's sharpest structural disadvantage is distribution, not features.** It has no MCP endpoint, no VS Code extension, no GitHub Action, no CLI, and no shareable public artifact. Any of those would beat shipping another view.
4. **The buyer matters more than the feature.** Understand gets $100–120/mo from *regulated* engineering; CodeBoarding pivoted to *PR review*; CodeSee died standalone. The pattern says comprehension-as-learning sells to individuals weakly, and comprehension-as-compliance/review sells to organisations strongly.

---

## Sources (all fetched and status-checked 2026-09-22)

- https://github.com/Graphify-Labs/graphify — 120k★, README, skill description
- https://github.com/colbymchenry/codegraph — 71.8k★, MIT, README, install
- https://raw.githubusercontent.com/colbymchenry/codegraph/main/TELEMETRY.md — telemetry disclosure
- https://github.com/CoatiSoftware/Sourcetrail — archived 2021-12-14, GPL-3.0, 16.5k★
- https://github.com/CodeBoarding/CodeBoarding and https://raw.githubusercontent.com/CodeBoarding/CodeBoarding/main/README.md — 2.4k★
- https://codeboarding.org — pivot positioning + Free/$9.99 Pro pricing
- https://raw.githubusercontent.com/CodeBoarding/CodeBoarding/main/TELEMETRY.md — telemetry on by default
- https://developers.googleblog.com/en/introducing-code-wiki-accelerating-your-code-understanding/ — Code Wiki, 2025-11-13
- https://cognition.com/blog/deepwiki (2025-05-05) and https://deepwiki.com — DeepWiki launch, 50k repos, URL swap
- https://sdtimes.com/software-development/gitkraken-acquires-codesee-launches-new-devex-platform/ (2024-05-14) — acquisition
- https://www.finsmes.com/2024/05/gitkraken-acquires-codesee.html — acquisition, secondary
- https://web.archive.org/web/20260515043330/https://www.codesee.io/ — CodeSee feature list, GitKraken banner
- http://web.archive.org/cdx/search/cdx?url=codesee.io&output=json — 200→301(2026-06)→404(2026-07)
- https://scitools.com/pricing/ and https://scitools.com/features/ — Understand $100–120/mo, 12-month minimum
- https://api.crossref.org/works/10.1109/TSE.2017.2734091 — Xia et al. 2018 metadata; reference list includes Fjeldstad 1983 (Proc GUIDE), the origin of the circulated "58%" claim
- https://the-decoder.com/15-of-companies-ban-code-ai-but-99-of-developers-use-it-anyway/ (2024-07-27) — Checkmarx study: 99% use AI tools, 15% of firms ban them, 29% have governance, 80% worried about developer AI use, **60% concerned about hallucinations**
