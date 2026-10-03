# 02 — Western / global landscape (tools that "help you understand a codebase")

**Research date: 2026-09-22.** Every pricing figure below was read from the vendor's own page on this date unless explicitly attributed otherwise. Where a page could not be fetched I say so (`UNVERIFIED`) instead of guessing. Where a fact comes from a press release, TechCrunch, or the Wayback Machine rather than a live vendor page, it is labelled.

**Fetch method note:** `web_search` in this environment returns URLs only (no snippets), so all facts below were extracted from HTTP-fetched page content. Two classes of source needed workarounds: `sourcegraph.com` returns **HTTP 403** to this client (Cloudflare), so Sourcegraph facts come from the **Wayback Machine capture of the vendor's own page**; `crunchbase.com` returns **403** and `reuters.com` returns **401**, so those figures are marked unverified.

---

### 1. DeepWiki (Cognition / Devin)

**(a) The one differentiated capability.** Zero-setup, *conversational* auto-wiki for **any public GitHub repo** — you take a URL and swap `github.com` → `deepwiki.com`. Cognition's launch post frames exactly the problem Fieldguide targets: *"It shouldn't take hours to get up to speed on a new codebase. That's why we built Devin Wiki and Devin Search... Now, we're launching DeepWiki, the free public version of Devin Wiki and Devin Search."* The second differentiated piece is **DeepWiki MCP**, which makes that wiki reachable by *other* agents: *"The DeepWiki MCP server is a free, remote, no-authentication-required service that provides access to public repositories. Base Server URL: https://mcp.deepwiki.com/"* with tools `read_wiki_structure`, `read_wiki_contents` and an ask tool. ([launch post](https://cognition.com/blog/deepwiki), [DeepWiki docs](https://docs.devin.ai/work-with-devin/deepwiki), [DeepWiki MCP docs](https://docs.devin.ai/work-with-devin/deepwiki-mcp))

**(b) Pricing / business model.** *Vendor claim:* the public-repo product is **free** ("Add any public repo for free at deepwiki.com… For private repos, sign up for a Devin account"). Cognition's pricing page shows the commercial funnel: **Free $0, Pro $20/month, Max $200/month, Teams "$80 /month for team plan + $40/mo per full dev seat", Enterprise "Let's talk"** (accessed 2026-09-22). So DeepWiki is a **free top-of-funnel for Devin**, not a product with its own P&L. ([cognition.com/blog/deepwiki](https://cognition.com/blog/deepwiki), [devin.ai/pricing](https://devin.ai/pricing))

**(c) OSS vs proprietary; local-first vs cloud.** DeepWiki itself is **proprietary and cloud-only** — no self-host option. The community clone **`asyncfuncAI/deepwiki-open`** (MIT, renamed "DeepWiki-Open 2.0 (Grok Wiki)") is the self-hostable/local-first answer: **18.0k stars, 2.0k forks, 249 commits**, with `Dockerfile`, `Dockerfile-ollama-local` and `Dockerfile-litellm` — i.e. it can run against a local Ollama model. Its README advertises a commercial spin-off at `grok-wiki.com` (I did **not** fetch that site — `UNVERIFIED`). ([deepwiki-open](https://github.com/asyncfuncAI/deepwiki-open))

**(d) Funding / status.** Cognition is extremely well capitalised and active: its blog records *"Do it all with Devin: Announcing our Series E — Cognition has raised over $2B at a $48B valuation, led by Andreessen Horowitz and Accel"* (09.08.26) after *"Cognition has raised over $1B at a $26B valuation, led by Lux Capital, General Catalyst, and 8VC"* (05.27.26), plus the Windsurf combination, "Devin Desktop" (06.02.26) and the acquisition of TierZero (07.20.26). DeepWiki is alive today — `deepwiki.com` served HTTP 200 with the header *"DeepWiki | AI documentation you can talk to, for every repo"* and an "Add repo" box. ([cognition.ai/blog](https://cognition.ai/blog), [deepwiki.com](https://deepwiki.com/))

**(e) Published usage numbers.** *Vendor claim only:* *"We've already indexed over 50,000 of the top public GitHub repos, from the Model Context Protocol to LangChain"* (May 2025). **No independently confirmed** usage or retention numbers found.

---

### 2. Sourcegraph

**(a) The one differentiated capability.** Enterprise **cross-repository code search + graph-backed "Deep Search"** at a scale nobody else matches, now explicitly repackaged for agents: the pricing page tagline is *"Give your engineers and agents deep codebase context"* — one platform to *"understand, oversee, and evolve the world's most complex codebases"*, with full **MCP server, API and CLI access**. Its public instance indexes 1M+ public repositories for free. ([archived vendor pricing page, captured 2026-09-14](http://web.archive.org/web/20260914111248/https://sourcegraph.com/pricing))

**(b) Pricing.** Only one plan is published: **"Enterprise plan… Starting at $16K Minimum annual contract. Includes credits for AI features; scales with team size."** No self-serve tier, no per-seat number. Self-hosted and single-tenant cloud deployment are included. ([same archived pricing page](http://web.archive.org/web/20260914111248/https://sourcegraph.com/pricing))

**(c) OSS vs proprietary; local-first.** Sourcegraph was historically partially open source; today the paid product is **proprietary and enterprise-only**, but it does support **self-hosted** deployment (which is "local" in the on-prem sense, not "local-first desktop"). `UNVERIFIED` for the current OSS status of the core repo — `github.com/sourcegraph/sourcegraph` was not fetched in this pass.

**(d) Funding / acquisition / spin-out status.** The decisive event: **Amp span out** — *"Why Sourcegraph and Amp Are Becoming Independent Companies", Quinn Slack & Dan Adler, December 2, 2025*: *"Sourcegraph and Amp are becoming two separate companies… Dan Adler will step into the role of CEO at Sourcegraph. Quinn Slack and Beyang Liu will remain on Sourcegraph's board and are founding Amp Inc."* ([archived vendor blog post](https://web.archive.org/web/20260305115143/https://sourcegraph.com/blog/why-sourcegraph-and-amp-are-becoming-independent-companies) — the live URL 403s to this client). Amp's own announcement adds: *"We're spinning out of Sourcegraph to become an independent research lab… Amp's traction spun us out of Sourcegraph. **Amp is profitable.**"* ([ampcode.com/news/amp-frontier-corporation](https://ampcode.com/news/amp-frontier-corporation), 2025-12-02). Funding history: **$125M Series D at a $2.625B valuation, led by Andreessen Horowitz, announced 2021-07-13** (TechCrunch, Ron Miller — secondary source, page fetched 200: [link](https://techcrunch.com/2021/07/13/sourcegraph-raises-125m-series-d-on-2-6b-valuation-for-universal-code-search-tool/)). **UNVERIFIED:** any post-2021 round, valuation, or revenue for Sourcegraph; also whether Cody still has any free/Pro tier — the current pricing page lists only the Enterprise plan, and the nav lists Cody alongside legacy products.

**(e) Usage numbers.** *Vendor claim:* "1M+ public repositories" searchable publicly. No retention numbers found.

---

### 3. CodeSee — **VERIFIED: acquired, then the standalone product went dark**

**(a) The one differentiated capability.** **Auto-syncing interactive codebase maps plus "Interactive code tours"** — narrated, ordered walkthroughs anchored to a live graph of the code, with *"Code Insights: annotations that persist as code changes"* and cross-repo **Service Maps**. This is the closest thing the West ever shipped to Fieldguide's core loop. ([archived vendor product nav, capture 2026-06-07](http://web.archive.org/web/20260607051927/https://www.codesee.io/))

**(b) Pricing (historical, from the archived vendor page).** Community **$0** (unlimited open source, 3 private-repo collaborators), **Business $69 / $29 per collaborator per month** (page renders both figures side by side; the list/effective split is ambiguous in the extracted text — flagged rather than interpreted), **Enterprise "Contact Us"** with *"Cross Repo Visibility with Service Maps, AI Platform Boosts, Function Level Visibility, On Prem option, Premium support"*. ([archived pricing page, capture 2025-02-21](http://web.archive.org/web/20250221073000/https://www.codesee.io/pricing))

**(c) OSS vs proprietary; local-first.** Proprietary SaaS; an **"On Prem option"** existed on the Enterprise tier. No OSS release.

**(d) Funding / acquisition / shutdown status — this is the headline.** **Acquired by GitKraken on 2024-05-14:** *"GitKraken, the leader in developer tooling, today announced it has acquired code health innovator, CodeSee"*, alongside a new "DevEx platform" said to reach *"30 million developers"*. ([GitKraken press release](https://gitkraken.com/press/gitkraken-acquires-codesee-launches-devex-platform), [GitKraken blog](https://gitkraken.com/blog/gitkraken-launches-devex-platform-acquires-codesee), both HTTP 200). **As of today (2026-09-22) `https://www.codesee.io/` and `/pricing` both return HTTP 404** — the standalone CodeSee marketing site is gone. The last Wayback capture of the marketing site is **2026-06-07** (and the capture list runs to "23 Jul 2026"), so the site disappeared between late July and late September 2026. **What survived:** (i) **CodeSee documentation is still live** at `docs.codesee.io` (HTTP 200 on 2026-09-22, no shutdown/EOL notice shown on the page fetched); (ii) GitKraken's current site nav still advertises a product literally named **"Codemaps"** under Code Flow Features. ([docs.codesee.io](https://docs.codesee.io/docs/uninstall-codesee-from-github-repos), [GitKraken blog nav](https://gitkraken.com/blog/gitkraken-launches-devex-platform-acquires-codesee)) **UNVERIFIED:** whether GitKraken formally sunset "Codemaps" — `gitkraken.com/codemaps` returns **HTTP 403** to this client (Cloudflare), and the Wayback availability API has **no capture** for that path.

**(e) Usage numbers.** *Vendor claim (via GitKraken press release):* the platform reaches "30 million developers" — a GitKraken-wide figure, **not** a CodeSee usage number. CodeSee's own site claimed *"Devs spend 60% of their time reading [code]"* (unsourced vendor framing). **No ARR, customer count, or retention figures were ever published.** Third-party funding totals for CodeSee could **not** be verified: `crunchbase.com/organization/codesee` → **403**; PitchBook profile is paywalled and was not fetched.

---

### 4. Swimm — **VERIFIED: pivoted away from "docs that don't lie"**

**(a) The one differentiated capability (original).** **Continuous documentation with verification tests** — docs coupled to code that *fail* when the code changes, deployed through CI and IDE plugins, plus *"Playlists"* (ordered collections of docs, links, videos, markdown) which is essentially a guided tour primitive. In 2023 the vendor's own title tag was *"Knowledge management and documentation for code | Swimm"* and the plan feature list included "Number of repositories", "verification tests", "Playlists" and "Auto-sync changes via pull request". ([archived vendor pricing page, capture 2023-06-03](http://web.archive.org/web/20230603123328/https://swimm.io/pricing/))

**(b) Pricing — then and now.** *2023 (archived vendor page):* **Free $0** (5 users, 1 private repo, 30 verification tests); **Small teams $390 per month billed annually** (25 seats, unlimited repos, 100 verification tests); **Enterprise Custom** (unlimited repos/tests, self-hosted Git support, SSO). *2026-09-22 (live page):* **no prices at all.** Pricing is now quoted per engagement: *"Pricing is based on the number of lines of code you want to understand"*, with project-based pricing for system integrators and support for on-prem, cloud and **air-gapped** deployments, SOC 2 + ISO 27001. ([swimm.io/pricing](https://swimm.io/pricing), [archived 2023 pricing](http://web.archive.org/web/20230603123328/https://swimm.io/pricing/))

**(c) OSS vs proprietary; local-first.** Proprietary, but deployment-flexible: *"Does Swimm support on-prem, cloud-based, and air-gapped deployments? Yes."* and *"Can I use my company's internal LLM instance? Yes… including… Azure OpenAI Service or OpenAI Enterprise."* That is a real local/private-LLM story. ([swimm.io/pricing](https://swimm.io/pricing))

**(d) Pivot + funding.** The pivot is **unambiguous and large**: the live homepage headline is now **"Agentic modernization, delivered"** — *"Our team combines static analysis for deterministic accuracy, GenAI for speed, and senior engineers to catch what tools miss"* — with a services/consulting menu of **.NET Migration, Java Migration, Monolith to Microservices, Mainframe Modernization, M&A Tech Due Diligence, Post-Acquisition Tech Integration, "Modernization Without the All-In Bet"**. "Context Layer" now appears as a *services* offering rather than a docs product. Vendor-claimed accolade: *"named a Gartner Cool Vendor for 2024 in AI-Augmented Development and Testing"*. ([swimm.io](https://swimm.io/)) Funding: **$27.6M Series A, announced 2021-11-08** (TechCrunch, secondary, page fetched 200: [link](https://techcrunch.com/2021/11/08/swimm-nabs-27-6m-series-a-to-include-up-to-date-documentation-in-every-release/)); total raised and current valuation **UNVERIFIED** (crunchbase → 403).

**(e) Usage numbers.** Only qualitative customer quotes (e.g. *"Knowledge discovery, especially for non-engineers, has improved significantly"* — Ryan McKenna, Principal engineer, RVO Health). **No published usage or retention numbers.**

---

### 5. CodeRabbit

**(a) The one differentiated capability.** **Independent, per-PR AI review with triage and cross-repo "learnings"** — i.e. it reviews *code as it changes* rather than explaining a codebase. Newer tier features edge toward comprehension: "Blast radius and architectural impact analysis" (Advanced) and "Learnings Loops with coding agents" (Essentials). ([coderabbit.ai/pricing](https://coderabbit.ai/pricing))

**(b) Pricing (vendor page, accessed 2026-09-22).** All plans: 14-day free trial, no credit card, annual saves 20%.
- **Essentials — $24 / developer / month** billed annually
- **Team — $48 / developer / month** billed annually
- **Advanced — $72 / developer / month** billed annually
- **Enterprise — Custom** (flexible deployment, dedicated support)
- On-demand: **Security Scan** (variable, usage-based) and **Agent at $0.40 per agent minute**.
([coderabbit.ai/pricing](https://coderabbit.ai/pricing))

**(c) OSS vs proprietary; local-first.** Proprietary SaaS. No local-first or on-prem desktop tier found on the pricing page. Enterprise includes "flexible deployment" (unspecified — `UNVERIFIED` whether that includes on-prem).

**(d) Funding.** **$60M Series B at a $550M valuation, 2025-09-16**, led by Scale Venture Partners with NVIDIA's NVentures; total funding then $88M (TechCrunch, fetched 200; also on the [vendor newsroom](https://www.coderabbit.ai/newsroom/coderabbit-series-b-60-million)). Then **"$143 million in a Series C funding round at a $1.5 billion valuation", 2026-08-12**, co-led by Atomico and Smash Capital, with BMW i Ventures and Datadog participating ([vendor newsroom](https://www.coderabbit.ai/newsroom/coderabbit-series-c-agentic-change-management), HTTP 200; corroborated by Business Wire). Live and growing, with a pivot toward "Agentic Change Management".

**(e) Published usage numbers — the best-documented in this set.** Per TechCrunch (2025-09-16), quoting founder Harjot Gill: the business *"has been growing 20% a month and is now making more than $15 million in annual recurring revenue (ARR)"*, and it was *"helping companies like Chegg, Groupon, and Mercury, along with over 8,000 other businesses"*. The vendor also announced *"more than $10 million of its actual direct cost to open source over the next year"* (2026-08-27). ([TechCrunch](https://techcrunch.com/2025/09/16/coderabbit-raises-60m-valuing-the-2-year-old-ai-code-review-startup-at-550m/), [coderabbit.ai/blog](https://coderabbit.ai/blog))

---

### 6. Cursor / GitHub Copilot

**(a) The differentiated capability — and an important reversal.** For Cursor, the differentiator is agentic *speed of search*, not a knowledge layer: the docs describe **"Instant Grep, a custom search engine that outperforms ripgrep on large codebases"**, and — critically for a local-first pitch — *"Instant Grep builds and queries its index on your machine. Cursor does not upload file paths or code to build a search index, **and it does not store embeddings of your codebase for search**."* Note that `cursor.com/docs/context/codebase-indexing` now **308-redirects** to `cursor.com/docs/agent/tools/search`, i.e. Cursor retired the embeddings-era codebase-indexing doc in favour of agent search. ([Cursor docs — Agent Search / Instant Grep](https://cursor.com/docs/agent/tools/search), verified via `curl -L`)

For Copilot, codebase Q&A is **productised table stakes**: *"Copilot improves responses by indexing your repositories"*, with "Semantic code search in Copilot Chat" and in the cloud agent, plus **Copilot Spaces** for curated context bundles. ([GitHub docs — Indexing repositories for GitHub Copilot](https://docs.github.com/en/copilot/concepts/context/repository-indexing))

**(b) Pricing (both pages accessed 2026-09-22).**
- **Cursor:** Hobby **Free**; Individual from **$20/mo** with offers listed for **Pro $20, Pro+ $60, Ultra $200**; **Teams $40 / user / mo**; Enterprise Custom. ([cursor.com/pricing](https://cursor.com/pricing))
- **Copilot:** Free **$0**; **Pro $10/month** (1,500 total monthly AI credits); **Pro+ $39/month** (7,000 credits); **Max $100/month** (20,000 credits); **Business $19 USD per granted seat per month** (1,900 credits/user/month); **Enterprise $39 USD per granted seat per month** (3,900 credits/user/month). ([github.com/features/copilot/plans](https://github.com/features/copilot/plans), [docs.github.com/en/copilot/get-started/plans](https://docs.github.com/en/copilot/get-started/plans))

**(c) OSS vs proprietary; local-first.** Both proprietary and cloud-first **as products**; Cursor's *search index* is emphatically on-device (quoted above), Copilot's semantic index is server-side on GitHub. Neither is a local-first *workbench*.

**(d) Funding / status.** Not researched in this pass — `UNVERIFIED` (out of scope for the differentiation question; both are large, live commercial products).

**(e) Usage numbers.** Not researched in this pass — `UNVERIFIED`.

---

### 7. Gource

**(a) The one differentiated capability.** An **animated, cinematic visualization of version-control history** — *"Software projects are displayed by Gource as an animated tree with the root directory of the project at its centre. Directories appear as branches with files as leaves. Developers can be seen working on the tree at the times they contributed"* — with built-in log support for Git, Mercurial, Bazaar and SVN. It is a **history/process visual**, not a comprehension tool. ([gource.io](https://gource.io/))

**(b) Pricing / business model.** **Free, GPL-3.0, donation-funded** (*"If you like Gource and would like to show your appreciation… please consider making a donation!"*). No commercial tier of any kind. ([gource.io](https://gource.io/), [GitHub repo](https://github.com/acaudwell/Gource))

**(c) OSS vs local-first.** **Fully open source (GPL-3.0) and fully local** — a native desktop app, Windows installer included (`gource-0.56.tar.gz`, `gource-0.53.win64-setup.exe`). This is the strongest existing proof that "local desktop + repo visualization" is not by itself a business.

**(d) Maintenance status / funding.** **Maintained, but at very low intensity by one author** (acaudwell). Stats read from GitHub on 2026-09-22: **13.1k stars, 793 forks, 927 commits, 110 open issues, 22 open PRs, GPL-3.0, no archived banner.** Latest release **gource-0.56 on 6 March 2026** (release notes: added `--author-time`, *"Fixed build with Boost 1.89.0"*, minimum Boost raised to 1.69); prior releases 0.55 (17 Jun), 0.54 (19 Jan), 0.53 (30 Apr), 0.52 (31 Mar), 0.51 (21 Nov). Commit history confirms a handful of commits in Jan 2026 and a version bump in Mar 2026 — i.e. **maintenance mode, not active development**. ([releases](https://github.com/acaudwell/Gource/releases), [commits](https://github.com/acaudwell/Gource/commits/master))

**(e) Who actually uses it / usage numbers.** **UNVERIFIED.** No published usage numbers exist. I attempted to establish real-world adoption only via the vendor's own "Contact… If you use Gource at work and are interested…" line on [gource.io](https://gource.io/) — no customer list or deployment count is published.

---

### 8. Sourcetrail — **VERIFIED archived; community fork is alive**

**(a) The one differentiated capability.** A **free, offline, cross-platform "source explorer"** that indexes C/C++/Java/Python and lets you navigate a *traversal graph* of declarations, references and call/override relations — built for exactly Fieldguide's stated job: *"helps you get productive on unfamiliar source code"*, and it works **free working offline** with an SDK (**SourcetrailDB**) for writing custom language extensions. ([archived vendor repo README](https://github.com/CoatiSoftware/Sourcetrail))

**(b) Pricing / business model.** **Free and open source (GPL-3.0)**, funded historically via **Patreon** (*"The open-source development and regular software releases are made possible entirely by the support of these awesome patrons!"*). No paid tier ever existed. ([repo](https://github.com/CoatiSoftware/Sourcetrail))

**(c) OSS vs local-first.** **GPL-3.0 and genuinely local-first**: a native Qt desktop app, "free working offline operating on Windows, macOS and Linux". The closest historical analogue to Fieldguide's desktop positioning.

**(d) Status — VERIFIED, with exact dates.** GitHub shows the banner: **"This repository was archived by the owner on Dec 14, 2021. It is now read-only."** The README states: *"Important Note: This project was archived by the original autors and maintainers of Sourcetrail by the end of 2021."* **Last release of the original: `2021.4.19`** (prior: 2021.1.30, 2020.4.35, …). Repo metrics at archive: **16.5k stars, 1.7k forks, 355 open issues, 0 open PRs.** ([repo](https://github.com/CoatiSoftware/Sourcetrail), [releases](https://github.com/CoatiSoftware/Sourcetrail/releases))

**Community forks DO continue — and are actively modernised.** The fork **`OpenSourceSourceTrail/Sourcetrail`** (public fork of CoatiSoftware/Sourcetrail, still GPL-3.0) shows **232 stars, 24 forks, 3,471 commits**, and a live release train: **3.0.0 (latest, released 5 Sep — 2026, since GitHub omits the year on recent releases), plus `LLVM/Clang 23.1.0` (27 Aug), `LLVM/Clang 22.1.8` (26 Aug), 2.1.0, 2.0.0, 1.1.0**. The repo now carries `AGENTS.md`, `CLAUDE.md` and a `conanfile.txt`, i.e. it is being developed with AI coding agents and modern toolchains — an up-to-date Clang 23 indexer is a non-trivial engineering investment for a "dead" project. ([fork repo](https://github.com/OpenSourceSourceTrail/Sourcetrail), [fork releases](https://github.com/OpenSourceSourceTrail/Sourcetrail/releases))

**(e) Usage numbers.** None published. Star/fork/issue counts are the only proxies (above).

---

### 9. Understand by SciTools

**(a) The one differentiated capability.** **Deterministic, deep static-analysis cross-references on a local desktop install** — dependency analysis, call trees, control-flow graphs, metrics, MISRA-style standards compliance, full API access, and a "virtual debugger" that steps through code. Crucially, SciTools has now bolted an LLM layer on top of that index: a product called **Onboard** — *"AI-powered code understanding built on the deep cross-reference analysis of SciTools Understand. Onboard helps developers quickly understand unfamiliar codebases, making it faster and easier to onboard new engineers"* — plus AI summaries on graph nodes. **This is a direct, paid, incumbent competitor to Fieldguide's core value proposition.** ([scitools.com](https://www.scitools.com/))

**(b) Pricing.** *Vendor page, accessed 2026-09-22:* **"The cost breakdown for Understand is between $100-$120 USD per month with a minimum term of 12 months."** Sold as an **annual subscription via a quotation request form** (no instant checkout), and prices vary by geography and licence count. A cheaper "developer license" deliberately excludes CLI automation (`und`), API access, and exporting dependencies/graphs/metrics/reports. ([scitools.com/pricing](https://www.scitools.com/pricing/))

**(c) OSS vs proprietary; local-first.** **Proprietary, paid, and local-first by design** — a Windows/macOS/Linux desktop application, with an Understand VS Code extension. Current release line **Understand 7.1**. ([scitools.com](https://www.scitools.com/))

**(d) Funding / status.** Privately held, long-lived (legacy government/defence customer base — the site cites the **Navy SBIR Transition Program** for MISRA/Navy SSP coding standards). No funding events found. **Actively shipping**: ongoing telemetry numbers and new AI/Onboard features.

**(e) Published usage numbers.** *Vendor claim:* **"Trusted by over 20,000 developers."** Sample customer name check: Dell (Chris Rhodes, Senior Software Engineer, quoted on the vendor site). No retention data.

---

### 10. CodeQL / GitHub code scanning — **distinction CONFIRMED (security, not comprehension)**

**(a) What it is for.** CodeQL is a **semantic code analysis engine for vulnerability discovery**: *"Discover vulnerabilities across a codebase with CodeQL, our industry-leading semantic code analysis engine. CodeQL lets you query code as though it were data. Write a query to find all variants of a vulnerability, eradicating it forever."* GitHub's docs place `Code scanning` under *"Security and code quality"* concepts, alongside secret scanning and supply-chain security. ([codeql.github.com](https://codeql.github.com/), [GitHub docs — About code scanning](https://docs.github.com/en/code-security/code-scanning/introduction-to-code-scanning/about-code-scanning))

**(b) Pricing.** *Vendor claim:* **"CodeQL is free for research and open source"**; for private repos it is bundled into **GitHub Advanced Security**, whose seat/tier pricing is not published on the pages fetched — **UNVERIFIED** (I did not fetch GitHub's Advanced Security pricing page in this pass).

**(c) OSS vs local-first.** The **CodeQL CLI and query packs are freely downloadable** and run locally (database creation via `codeql database create`; there is a CodeQL extension for VS Code), while GitHub-hosted code scanning is cloud. The query language/queries are open for research and OSS.

**(d) Funding / status.** Part of GitHub (Microsoft); very actively developed, with GitHub marketing its "Multi-repository variant analysis" and "Autofix" as flagship features. Originally a Semmle product acquired by GitHub — `UNVERIFIED` (not re-verified in this pass).

**(e) Usage numbers.** None published for CodeQL specifically in the pages fetched.

**Distinction verdict:** the *technology class* (semantic code DB + queryable graph) is the same class as Sourcetrail/Understand/Fieldguide, but the **product purpose is different**: CodeQL's output is *findings about defects*, not *explanation of the system for a human learner*. It competes with Fieldguide only indirectly (if Fieldguide pitched "find the bugs").

---

### 11. SonarQube and CodeScene

**SonarQube (Sonar)**
- **(a) Differentiated capability:** deterministic, rule-based **code quality/security verification gate in CI** across 40+ languages, with OWASP/MISRA compliance reporting — *"Code quality, security, and AI code review on one platform."* Purpose is *verification of new code*, not comprehension. ([sonarsource.com/plans-and-pricing](https://www.sonarsource.com/plans-and-pricing/))
- **(b) Pricing (vendor page, 2026-09-22):** Free tier *"never expires"*, allowing private projects **up to 50k LoC**. **Team plan starts at $34 monthly for analysis of up to 100k LOC** (plan card shows list/effective "$68 → $34 monthly"); other LOC increments available. **Enterprise: Custom pricing** ("Over 50 developers"). Self-managed **SonarQube Server** has three editions — *"Developer, Enterprise, and Data Center — each priced per instance, per year, based on your lines of code (LOC)."* Its AI code review product **Gitar**: *"$30 → $20 /user/mo, billed annually."* ([same page](https://www.sonarsource.com/plans-and-pricing/))
- **(c) OSS vs local-first:** SonarQube has a long-standing **open-source Community Edition lineage** (not re-verified in this pass — flag), and **SonarQube Server is fully self-managed/on-prem**; the IDE extension is free.
- **(d) Funding/status:** commercial vendor, actively shipping an *agent-oriented* portfolio — **Sonar Vortex** (*"New Context before the agent writes. Verification as it writes."*), SonarQube **Remediation Agent**, **Hunter Agent**, plus **MCP server** and plugins for Claude Code, Cursor, Codex and Copilot CLI. ([same page](https://www.sonarsource.com/plans-and-pricing/))
- **(e) Usage numbers:** not published on the pricing page; **UNVERIFIED** in this pass.

**CodeScene**
- **(a) Differentiated capability — the one genuinely distinctive analytics model:** **"Behavioral code analysis: Go beyond static code analysis"** — it mines *version-control history* (not just the current snapshot) to find **hotspots**, and scores them with **CodeHealth™**, a *"deterministic code quality score"* and *"peer-reviewed quality target, for humans and AI"*. It markets a comparison claim: *"SonarQube vs. CodeScene — Why CodeScene's CodeHealth™ is 6x more accurate"* (vendor claim). A CodeHealth™ **MCP server** is in early access so AI assistants can act on the same score. ([codescene.com/pricing](https://codescene.com/pricing))
- **(b) Pricing (vendor page, 2026-09-22):** **Standard €18** and **Pro €27**, both **"Billed yearly"** (yearly saves 10%; monthly and International/United States pricing variants exist), **Enterprise: "Talk to sales"**; **"Community Edition Free for open source projects"** and a **free developer package for students**. Deployment: *"On-prem (self managed)"* **or** **cloud-based** — a genuine either/or on the same plan. ([same page](https://codescene.com/pricing))
- **Pricing unit — verified from the vendor's own FAQ text:** *"CodeScene's license is based on the number of active authors. An active author is anyone who has committed code over the past three months to the codebases you want to analyze"*, and *"There's no limit on the number of active authors [who can log in]… The total cost of using CodeScene is based on how many active authors you have."* (Note: the plan cards show €18/€27 without restating "per active author" adjacent to the figure — the per-active-author basis comes from the FAQ text on the same page.)
- **(c/d/e) OSS/local-first/funding/usage:** proprietary, on-prem-capable, ISO 27001 certified, AWS partner, *"Leader on G2"* (vendor claim). No funding events or usage numbers found in this pass — **UNVERIFIED**.

---

### 12. Optional extras: Moderne / OpenRewrite, Structurizr / C4, Joern, NDepend (and CodeViz)

**Moderne / OpenRewrite**
- **(a) Differentiator:** **mass-scale, type-aware automated refactoring and impact analysis across an entire code estate**, built on a **"Lossless Semantic Tree"** and OpenRewrite recipes — it parses code into a type-attributed tree rather than text-matching, so transformations are semantically safe at hundreds-of-millions-of-LOC scale. Also sells **"Backpatch"** (mutualised security backports for the open-source supply chain). ([moderne.ai/pricing](https://www.moderne.ai/pricing))
- **(b) Pricing — the most expensive datapoints in this whole landscape:** *"Moderne Platform **Commercial $250K Typical**"* (up to ~1,000 developers, hybrid SaaS in your cloud region, one part-time forward-deployed engineer), **"Enterprise $2M Typical"**, **"Fully Managed Service $5M Typical"**; Backpatch Alliance **Member $2,000/mo**, Steering Committee $200K typical, Managed $1M typical. ([same page](https://www.moderne.ai/pricing))
- **(c) OSS/local-first:** the **OpenRewrite** recipes/libraries are open source (Apache-2.0 lineage — `UNVERIFIED` in this pass); the Moderne platform is proprietary, cloud-region or **on-prem with Moderne DX**.
- **(d/e):** Live, enterprise-only. No usage or funding numbers published on the pricing page.

**Structurizr / C4 model**
- **(a) Differentiator:** the **reference implementation of the C4 model**, authored by C4's creator Simon Brown, based on **"models as code"** — *"you write Structurizr DSL to create multiple software architecture diagrams from a single model."* This is the *inverse* of Fieldguide's approach: **intentional architecture people write down**, not architecture inferred from a codebase. ([structurizr.com](https://structurizr.com/))
- **(b) Pricing (vendor docs, 2026-09-22):** *"Using the Structurizr server via our prebuilt binaries requires a license. Pricing applies to each Structurizr server installation and is based upon the number of unique users in a one-year period"* — **1–20 users £300/month, 21–50 £600, 51–100 £900, 101–250 £1,200, 251–500 £1,500, 501–1000 £1,800, 1001+ £2,400**; *"Licenses are subscription based, billed annually, and will not auto-renew."* The DSL/local tooling is free; the **Lite and CLI tools are free**. ([docs.structurizr.com/server/pricing](https://docs.structurizr.com/server/pricing))
- **(c/d) Status — an important precedent:** *"The following products are end of life, replaced by the new consolidated tooling: Structurizr cloud service (no replacement); Structurizr Lite (replaced by local); Structurizr CLI (replaced by pull, push, export, etc.); Structurizr on-premises installation (replaced by server)."* Current binaries: **v2026.09.19**. The vendor is now leaning hard into AI: *"AI agents and LLMs excel at generating text! Structurizr's model-based consistency… make it the best choice for teams looking to generate C4 model software architecture diagrams with AI"*, plus a **Structurizr MCP server**. ([docs.structurizr.com/eol](https://docs.structurizr.com/eol), [structurizr.com](https://structurizr.com/))
- **(e):** No usage numbers published. Solo-founder business, Patreon + Discord community.

**Joern**
- **(a) Differentiator:** **"The Bug Hunter's Workbench"** — generates **code property graphs (CPGs)**, a graph representation spanning **source code, bytecode and binaries** across C/C++/Java/JS/Python/Kotlin, stored in a custom graph DB and *"mined using search queries formulated in a Scala-based domain-specific query language"* — *"developed with the goal of providing a useful tool for vulnerability discovery and research in static program analysis."* ([joernio/joern](https://github.com/joernio/joern))
- **(b/c) Pricing, licence, local-first:** **Free, open source, Apache-2.0, runs locally (CLI + console).** No commercial tier. Repo has `querydb`, `semanticcpg`, `dataflowengineoss` modules; no archived banner.
- **(d/e):** Academic/community project. **Usage numbers UNVERIFIED** (star count not read in this pass).

**NDepend**
- **(a) Differentiator:** **.NET-only static analysis in the IDE with C#-scriptable quality gates** — *"Quality Gates are customizable criteria written in C#, that must be verified before committing source or delivering the application"*; it imports Roslyn Analyzer and ReSharper inspection results and tracks new vs. unresolved vs. fixed against a baseline. New **NDepend MCP Server**: issues *"can be detected, browsed, and automatically fixed"* with Claude Code, Codex, VS Code+Copilot and JetBrains Junie. ([ndepend.com](https://www.ndepend.com/))
- **(b) Pricing:** **UNVERIFIED.** I tried `https://www.ndepend.com/pricing` and `https://www.ndepend.com/ndepend-pricing` — **both return HTTP 404.** The vendor claims 12,000+ companies and a 4.8/5 rating from 24 Visual Studio Marketplace reviews, but no price is published on the pages I could reach.
- **(c) OSS/local-first:** **proprietary, paid, local desktop** (Visual Studio integration + standalone `VisualNDepend.exe`), runs on Windows, macOS and Linux. Current: analyses .NET 10/9/8.
- **(e)** *Vendor claim:* *"More than 12 000 companies provide better .NET code with ndepend."* No retention data.

**CodeViz** — **not covered.** I did not research it in this pass; treat as a gap rather than a negative finding.

---

## Comparison table
*(All prices read from vendor pages on **2026-09-22** unless labelled archived/press.)*

| Tool | One differentiated capability | Pricing (2026-09-22) | OSS? | Local-first? | Funding / status | Source links |
|---|---|---|---|---|---|---|
| **DeepWiki** (Cognition) | Conversational auto-wiki for **any public repo** (`github.com`→`deepwiki.com`) + **free no-auth MCP server** for agents | Free for public repos; private needs Devin: Free $0 / Pro $20/mo / Max $200/mo / Teams $80 + $40 per dev seat | No (clone `deepwiki-open` is MIT) | No — cloud-only | Cognition: **>$2B at $48B valuation (Series E, 09.08.26)**; earlier >$1B at $26B; Windsurf + TierZero acquired. Vendor: **50,000+ repos indexed** | [launch](https://cognition.com/blog/deepwiki) · [docs](https://docs.devin.ai/work-with-devin/deepwiki) · [MCP](https://docs.devin.ai/work-with-devin/deepwiki-mcp) · [pricing](https://devin.ai/pricing) · [blog](https://cognition.ai/blog) · [site](https://deepwiki.com/) · [OSS clone](https://github.com/asyncfuncAI/deepwiki-open) |
| **Sourcegraph** | Enterprise cross-repo search + Deep Search, repackaged as **agent context** (MCP/API/CLI) | **Enterprise only: "Starting at $16K minimum annual contract"**, scales with team size, AI credits included | Coding/Docs partly OSS; product proprietary | Self-hosted/single-tenant cloud, **not desktop** | **Amp spun out 2025-12-02** (Amp Inc./Amp Frontier, "Amp is profitable"); Dan Adler now Sourcegraph CEO. $125M Series D at $2.625B (2021, TechCrunch) | [archived pricing](http://web.archive.org/web/20260914111248/https://sourcegraph.com/pricing) · [archived split post](https://web.archive.org/web/20260305115143/https://sourcegraph.com/blog/why-sourcegraph-and-amp-are-becoming-independent-companies) · [Amp](https://ampcode.com/news/amp-frontier-corporation) · [TC](https://techcrunch.com/2021/07/13/sourcegraph-raises-125m-series-d-on-2-6b-valuation-for-universal-code-search-tool/) |
| **CodeSee** | **Auto-syncing codebase maps + "Interactive code tours"** with annotations that persist as code changes | Historical: Community $0; Business **$69 / $29 per collaborator/mo**; Enterprise quote + On-Prem | No | Web SaaS (+Enterprise On-Prem) | **Acquired by GitKraken 2024-05-14**; **`codesee.io` now 404 (2026-09-22)**; docs site still up; GitKraken still lists "Codemaps" | [archived pricing](http://web.archive.org/web/20250221073000/https://www.codesee.io/pricing) · [archived site](http://web.archive.org/web/20260607051927/https://www.codesee.io/) · [press release](https://gitkraken.com/press/gitkraken-acquires-codesee-launches-devex-platform) · [blog](https://gitkraken.com/blog/gitkraken-launches-devex-platform-acquires-codesee) · [docs (live)](https://docs.codesee.io/docs/uninstall-codesee-from-github-repos) |
| **Swimm** | *Was:* docs coupled to code with **verification tests that fail on change** + Playlists. *Now:* "**Agentic modernization**" services | No published prices; **"based on the number of lines of code"**, project/engagement quoting. 2023: Free $0 / **$390 per month billed annually** (25 seats) / Enterprise | No | **On-prem, cloud and air-gapped**; bring-your-own LLM (incl. Azure OpenAI) | $27.6M Series A (2021-11-08, TechCrunch); **pivoted to services** (mainframe/.NET/Java migration, M&A DD); Gartner Cool Vendor 2024 (claim) | [live pricing](https://swimm.io/pricing) · [home](https://swimm.io/) · [archived 2023 pricing](http://web.archive.org/web/20230603123328/https://swimm.io/pricing/) · [TC](https://techcrunch.com/2021/11/08/swimm-nabs-27-6m-series-a-to-include-up-to-date-documentation-in-every-release/) |
| **CodeRabbit** | Per-PR **agentic AI review** + triage + cross-repo "learnings"; blast-radius/architectural impact on Advanced | **$24 / $48 / $72 per developer/mo** (annual; 20% off annual); Enterprise custom; Agent **$0.40/agent-minute** | No | No | **$60M Series B at $550M (2025-09-16)**; **$143M Series C at $1.5B (2026-08-12)**. Published: **>$15M ARR, 20%/month growth, 8,000+ businesses** (2025) | [pricing](https://coderabbit.ai/pricing) · [B](https://www.coderabbit.ai/newsroom/coderabbit-series-b-60-million) · [C](https://www.coderabbit.ai/newsroom/coderabbit-series-c-agentic-change-management) · [TC](https://techcrunch.com/2025/09/16/coderabbit-raises-60m-valuing-the-2-year-old-ai-code-review-startup-at-550m/) |
| **Cursor** | **Instant Grep** agent search ("outperforms ripgrep"), index built **on your machine, no codebase embeddings stored** | Hobby Free; Pro **$20/mo**, Pro+ **$60**, Ultra **$200**; Teams **$40/user/mo**; Enterprise custom | No | Index is local; product is cloud-first | Not researched (`UNVERIFIED`) | [pricing](https://cursor.com/pricing) · [Agent Search docs](https://cursor.com/docs/agent/tools/search) |
| **GitHub Copilot** | Codebase Q&A is standard: **repository indexing + semantic code search** in Chat, cloud agent and Spaces | Free $0; Pro **$10/mo**; Pro+ **$39**; Max **$100**; **Business $19/seat/mo**; **Enterprise $39/seat/mo** (AI-credit based) | No | No — server-side index | Not researched (`UNVERIFIED`) | [plans](https://github.com/features/copilot/plans) · [docs plans](https://docs.github.com/en/copilot/get-started/plans) · [indexing docs](https://docs.github.com/en/copilot/concepts/context/repository-indexing) |
| **Gource** | Animated **version-control history** visualization (tree/branches/leaves, developers over time) | **Free** (donations) | **Yes, GPL-3.0** | **Yes — native local app** | Solo maintainer, **maintenance mode**: last release **0.56 on 2026-03-06**; 13.1k★, 793 forks, 110 open issues | [site](https://gource.io/) · [repo](https://github.com/acaudwell/Gource) · [releases](https://github.com/acaudwell/Gource/releases) · [commits](https://github.com/acaudwell/Gource/commits/master) |
| **Sourcetrail** | Free **offline source explorer**: traversal graph of declarations/references/calls for C/C++/Java/Python + SourcetrailDB SDK | **Free** (was Patreon-funded) | **Yes, GPL-3.0** | **Yes — offline desktop** | **Original archived 2021-12-14; last release 2021.4.19.** Community fork `OpenSourceSourceTrail/Sourcetrail` **very active: 3.0.0 (5 Sep 2026), LLVM/Clang 23.1.0** | [original](https://github.com/CoatiSoftware/Sourcetrail) · [orig releases](https://github.com/CoatiSoftware/Sourcetrail/releases) · [fork](https://github.com/OpenSourceSourceTrail/Sourcetrail) · [fork releases](https://github.com/OpenSourceSourceTrail/Sourcetrail/releases) |
| **Understand** (SciTools) | Deterministic cross-reference/call-tree/metrics engine in a desktop IDE, **plus new "Onboard" AI onboarding product on top of it** | **$100–$120 USD per month, 12-month minimum**, sold by quotation | No | **Yes — local desktop app** | Long-lived private vendor; actively shipping **Understand 7.1**; Navy SBIR cited. Vendor: **"over 20,000 developers"** | [site](https://www.scitools.com/) · [pricing](https://www.scitools.com/pricing/) |
| **CodeQL / GitHub code scanning** | Semantic query engine for **vulnerability discovery** ("query code as though it were data") — **security, not comprehension** | Free for research & OSS; private = GitHub Advanced Security (price `UNVERIFIED`) | CLI/queries available freely (OSS terms) | CLI runs locally; hosted scanning is cloud | Part of GitHub/Microsoft; actively developed | [codeql.github.com](https://codeql.github.com/) · [code scanning docs](https://docs.github.com/en/code-security/code-scanning/introduction-to-code-scanning/about-code-scanning) |
| **SonarQube** (Sonar) | Deterministic **quality/security verification gate** in CI across 40+ languages | Free ≤50k LoC private; **Team from $34/mo (≤100k LOC)**; Enterprise custom; Server = per-instance/yr by LOC; **Gitar $20/user/mo** annual | Community Edition lineage (`UNVERIFIED` this pass) | **SonarQube Server is self-managed/on-prem** | Live; expanding agent portfolio (Vortex, Remediation/Hunter agents, MCP) | [plans & pricing](https://www.sonarsource.com/plans-and-pricing/) |
| **CodeScene** | **Behavioral code analysis** — hotspots from VCS history scored by deterministic **CodeHealth™**; **6x-more-accurate claim vs SonarQube** | **Standard €18 / Pro €27, billed yearly** (10% annual saving); Enterprise quote; Community Edition **free for OSS**; priced per **active author** | No (Community Edition free for OSS) | **On-prem or cloud, choice on the same plan** | Private, ISO 27001, AWS partner. `UNVERIFIED` funding/usage | [pricing](https://codescene.com/pricing) |
| **Moderne / OpenRewrite** | Type-aware **Lossless Semantic Tree** → mass-scale automated refactoring & impact analysis across whole estates | **Commercial $250K typical · Enterprise $2M typical · Fully Managed $5M typical**; Backpatch Member **$2,000/mo** | OpenRewrite recipes OSS (Apache-2.0, `UNVERIFIED`) | Hybrid SaaS in your cloud region, or **on-prem (Moderne DX)** | Live, enterprise-only | [pricing](https://www.moderne.ai/pricing) |
| **Structurizr / C4** | **"Models as code"** reference implementation of C4 by its author — many diagrams from one intentional model | Server licence **£300/mo (1–20 users) → £2,400/mo (1001+)**, per installation, billed annually; DSL/local free | DSL/tooling free; server binaries licensed | **Local + self-hosted server** | **Cloud service, Lite, CLI and on-prem installation all declared EOL**; vNext binaries **v2026.09.19**; pushing AI/MCP | [site](https://structurizr.com/) · [EOL](https://docs.structurizr.com/eol) · [server pricing](https://docs.structurizr.com/server/pricing) |
| **Joern** | **"Bug Hunter's Workbench"**: cross-language **code property graphs** (source/bytecode/binary) queried in a Scala DSL — for vulnerability research | **Free** | **Yes, Apache-2.0** | **Yes — local CLI/console** | Community/academic; actively maintained repo | [repo](https://github.com/joernio/joern) |
| **NDepend** | .NET static analysis with **C#-scriptable quality gates** + baseline diffing; new MCP server for auto-fix | **UNVERIFIED** — `/pricing` and `/ndepend-pricing` both 404 | No | **Yes — local desktop / VS extension** | Private vendor; vendor claims **12,000+ companies**; 4.8/5 (24 reviews) | [site](https://www.ndepend.com/) |
| **CodeViz** | — | — | — | — | **Not researched in this pass** | — |

---

## What is genuinely NOT differentiated / commoditised

This section is the direct answer to the PM's "too single-feature / too ordinary" complaint. Every capability below is shipped today by at least two Western vendors, most of them for free or as a bundled feature — so **none of them can be Fieldguide's pitch**:

1. **"LLM reads your repo and writes a wiki/docs/architecture summary."** Median feature as of 2026 — DeepWiki (free, vendor claims 50,000+ repos), the MIT `deepwiki-open` self-host clone, CodeScene's CodeHealth MCP, SciTools **Onboard**, Sonar **Vortex**, Copilot Spaces, Structurizr's AI/MCP push. **Not a differentiator; it is the entry fee.**
2. **"Ask your codebase questions in natural language."** GitHub Copilot does it via repository indexing + semantic search; Cursor via agent search/Instant Grep; Sourcegraph via Deep Search; DeepWiki via `ask`; CodeRabbit via agentic chat. Commoditised **at $10–20/user/month** (Copilot Pro $10, Cursor Pro $20).
3. **"Draw the dependency graph / call graph / layer diagram."** Shipped free by **Sourcetrail** (GPL, offline, 16.5k★, still forked and modernised to Clang 23) and **Understand** (paid, 20,000+ devs claimed), plus Joern CPGs, NDepend, Gource for history, and Mermaid/PlantUML for hand-drawn.
4. **"Architecture / layered views."** Structurizr owns the *authoritative* form (C4 reference implementation) from £300/month — and Fieldguide's inferred-from-code view is a weaker evidence class than an intentionally authored model, which is the opposite of a moat.
5. **"Hotspots / tech-debt / complexity scoring."** CodeScene (behavioral analysis + CodeHealth™) and SonarQube both do it deterministically, with published price points and CI integration.
6. **"Security scanning of the graph."** CodeQL, SonarQube, CodeRabbit Security Scan, GitHub code scanning — an entirely separate, crowded market. Do not drift here.
7. **"AI code review on every PR."** CodeRabbit at $24–72/dev/mo with >$15M ARR and 8,000+ businesses, plus Cursor Bugbot, Copilot code review, Sonar's Gitar ($20/user/mo), Sourcegraph. Saturated and consolidating.
8. **"Expose all of this to agents over MCP."** Every serious vendor now has one: DeepWiki MCP (free, no auth), Sourcegraph MCP, CodeScene CodeHealth MCP, NDepend MCP, Structurizr MCP, Sonar MCP, GitKraken MCP. Being MCP-reachable is **table stakes, not a feature**.
9. **"Local-first / offline / your code never leaves the machine."** *This is the most dangerous assumption to build a pitch on.* It is already true of: **Gource** (native, GPL), **Sourcetrail** (explicitly "free working offline", and its fork is more active than ever), **Understand** (local desktop, $100–120/mo), **Cursor's search index** (*"does not store embeddings of your codebase for search"*), **CodeScene** and **SonarQube Server** (on-prem options on the same plan), **Swimm** (on-prem/air-gapped) and **Sourcegraph** (self-hosted). **"Local-first" alone is not differentiation — it is a deployment checkbox that incumbents already tick.**
10. **"Auto-syncing maps that stay fresh as code changes."** CodeSee shipped precisely this (maps + persistent annotations + *Interactive code tours*) and still got acquired in May 2024 and had its marketing site go dark by late 2026 — at a $29–69/collaborator/month price point. **Auto-freshness of a code graph is commoditised AND was not, by itself, a viable standalone business.**

### What is actually still open (the negative space)

These are the only places in this survey where I found **no** Western incumbent occupying the position — treat each as a *hypothesis to test*, since absence of evidence in 17 vendor pages is not proof of absence in the market:

- **A learner-facing loop with retention mechanics.** **Nothing** in this landscape ships progress tracking, spaced repetition or interview-question drilling grounded in a codebase graph. Every vendor optimises for *task completion* (search, review, refactor, scan); none optimises for *you personally remembering the system next month*. **Swimm's "verification tests"** were the one serious attempt at "docs that don't lie" — and Swimm abandoned that framing and became a modernization services firm by 2026, which is evidence the *market* didn't pay for verification alone, not that the *need* is gone.
- **Guided tours anchored to a live graph.** CodeSee's "Interactive code tours" + "Code Insights" are the only Western shipping example, and they died with the standalone product. **Open lane — but read the price-point lesson above before assuming it's monetisable on its own.**
- **arXiv paper → code node bridging.** **Not found in any tool surveyed.** This looks genuinely unoccupied in the West.
- **Obsidian / local PKM sync of a code knowledge graph.** **Not found in any tool surveyed.** Also unoccupied — and it composes with the local-first story rather than repeating it.
- **"Proof of freshness" as a trust mechanism.** Every tool *regenerates* or *re-scores*; none *verifies* that a claim in the knowledge layer is still true after a commit (the Swimm idea, vacated).

### Commercial positioning implication

The verified price ladder is: **$0** (DeepWiki public, Sourcetrail, Gource, CodeQL for OSS) → **$10–20/user/mo** (Copilot Pro $10, Cursor Pro $20) → **$24–72/dev/mo** (CodeRabbit) → **$100–120/mo** (Understand) → **£300–2,400/mo per installation** (Structurizr server) → **$16K/yr minimum** (Sourcegraph) → **$250K–$5M typical deals** (Moderne). Fieldguide's plausible zone sits between Copilot Pro and CodeRabbit Essentials — where the buyer is an individual developer or small team, paying for **retention and time-to-productivity**, not for PR automation or estate-wide refactoring.

---

## Verification log (every URL above was fetched; anomalies stated)

**Fetched successfully (HTTP 200) on 2026-09-22:** all vendor pages, GitHub repo/release pages, archived Wayback captures, and the TechCrunch articles linked above.

**Could not fetch — facts marked UNVERIFIED rather than guessed:**
- `https://sourcegraph.com/*` (pricing, blog, docs, `/amp`) → **HTTP 403** (Cloudflare) for every path; Sourcegraph facts therefore come from the **Wayback capture of the vendor's own pricing page (2026-09-14)** and the archived split announcement.
- `https://www.crunchbase.com/organization/codesee` and `.../swimm` → **HTTP 403**. CodeSee's funding total is therefore **UNVERIFIED**. `pitchbook.com/profiles/company/458764-48` exists per search results but is paywalled and was **not** fetched.
- `https://www.reuters.com/technology/ai-code-review-platform-coderabbit-valued-15-billion-latest-funding-round-2026-08-12/` → **HTTP 401**. The $1.5B figure is nonetheless verified from **CodeRabbit's own newsroom page** and Business Wire, so it is *not* left as a Reuters-only claim.
- `https://www.gitkraken.com/codemaps` and `gitkraken.com/pricing` → **HTTP 403**; the Wayback availability API has **no capture** for `/codemaps`. "Codemaps" as a live GitKraken product name is verified only from GitKraken's own site navigation.
- `https://structurizr.com/pricing` → **404** (real pricing lives at `docs.structurizr.com/server/pricing`). `https://www.ndepend.com/pricing` and `/ndepend-pricing` → **404** — NDepend pricing is **UNVERIFIED**.
- `https://www.codesee.io/` and `/pricing` → **404** — but this is the *finding*, not a fetch failure.

**Low-quality sources deliberately excluded:** search results in this space are polluted by AI-generated "review 2026" farms and aggregator wikis (aiwiki.ai, synabot, aitoolhub, similar "best AI code review tools" listicles). None of those were used as evidence. Where a figure appears only in such sources (e.g. NDepend pricing, CodeSee funding), it is marked `UNVERIFIED` instead of cited.
