# Gaps & Real User Pain — Evidence Dossier

**Scope:** independent evidence for the seven pain points that a local-first "turn an unfamiliar repository into your own project" workbench would have to win on. Built to answer the PM's concern that Fieldguide currently feels *too single-feature / too ordinary / unappealing*.

**Compiled:** 2026-09-22. **Research method:** `web_search` in this environment returns **URLs only, no snippets**, so every quote below was read out of a page that was actually fetched with `Invoke-WebRequest`. Hacker News numbers come from the official HN Algolia API. Every URL cited was probed for HTTP status; results and failures are recorded in [Verification ledger](#verification-ledger).

**Read this first — four caveats that shape how much you should trust each line:**

1. **HN comments have no public upvote counts.** Only *stories* are scored. Everywhere a comment carries a claim, we give the **story's** points as the reach proxy and say so. A single anonymous comment is not a market.
2. **Reddit was unreachable.** `reddit.com` returned **HTTP 403** to every endpoint tried (global search, subreddit search, `old.reddit.com` JSON, both custom and browser User-Agents), from all four researchers. **This dossier contains zero Reddit threads, zero Reddit scores and zero Reddit quotes.** We fabricated nothing to fill the hole. r/ExperiencedDevs and r/LocalLLaMA are the two obvious unfilled gaps.
3. **Several widely-circulated statistics do not survive tracing** and are marked `NO TRACEABLE PRIMARY SOURCE`. The most important one: **"3–6 months for a developer to become fully productive" has no primary source at all.**
4. **Vendors are labelled.** CodeScene, GitLab, Cisco, IBM, Cursor, GitHub, Tabnine and Tabby all have commercial interests in the claims attributed to them. Where a number is vendor-published we say so; where it is peer-reviewed we say that instead.

---

## P1. LLM answers without ground truth — hallucinated architecture explanations

**Evidence strength: STRONG — strongest of the seven.** We have all four evidence classes at once: a **peer-reviewed measured error rate** (31.63% of annotated code summaries contain a hallucination, n=411), a **large-sample developer survey** (66% name "almost right, but not quite" as their #1 frustration, n≈33,662), **detailed first-hand debunkings by domain experts** on a 231-point thread, and a **vendor admitting the limitation** on the record.

### 1.1 Measured: 31.63% of annotated code summaries contain a hallucination

The cleanest number available. The Entity Tracing Framework paper introduces CodeSumEval (~10K samples) and then hand-annotates 411 summaries and 9,933 entities:

> "Category Count Percentage (%) Summary Level Classification Hallucinated 130 31.63% Not Hallucinated 281 68.36% Total Summaries 411 100% Entity Level Classification CORRECT 9024 90.84% INCORRECT 303 3.05% IRRELEVANT 606 6.11% Total Entities 9933 100%"

> "LLMs are prone to hallucination—outputs that stray from intended meanings. Detecting hallucinations in code summarisation is especially difficult due to the complex interplay between programming and natural languages."

Sources: [ETF: An Entity Tracing Framework for Hallucination Detection in Code Summaries — ACL 2025 (Long Papers), pp. 30639–30652](https://aclanthology.org/2025.acl-long.1480/) · [arXiv:2410.14748 (v4)](https://arxiv.org/abs/2410.14748) · full text with the table at [arxiv.org/html/2410.14748v4](https://arxiv.org/html/2410.14748v4) · **July 2025**. All HTTP 200.

*Read the number carefully:* 31.63% is the share of **summaries** containing at least one hallucinated entity in the authors' annotated subset; the entity-level rate is lower (3.05% incorrect + 6.11% irrelevant). The paper's contribution is a **detector** (73% F1), not a prevalence survey — but this is a real measured rate on a real dataset, which is exactly what most "AI is unreliable" claims lack.

### 1.2 Survey: the #1 frustration with AI tools is "almost right, but not quite"

Stack Overflow's 2025 survey is the largest sample in this dossier (the page reports *"Responses: 33,662 ( 68.7% )"* for the headline AI question, implying a base of roughly 49,000).

> "All Respondents AI solutions that are almost right, but not quite **66%** Debugging AI-generated code is more time-consuming **45.2%** … It's hard to understand how or why the code works **16.3%**"

> "More developers actively distrust the accuracy of AI tools (46%) than trust it (33%), and only a fraction (3%) report "highly trusting" the output."

> "In a future with advanced AI, the #1 reason developers would still ask a person for help is "When I don't trust AI's answers" (75%) … When I want to fully understand something 61.7%"

> "However, 46% of developers said they don't trust the accuracy of the output from AI tools, a significant increase from 31% last year."

Sources: [AI — 2025 Stack Overflow Developer Survey](https://survey.stackoverflow.co/2025/ai) · [press release, New York City, July 29 2025](https://stackoverflow.co/company/press/archive/stack-overflow-2025-developer-survey). Both HTTP 200.

**The product-relevant reading:** the single most-cited frustration is not "AI is wrong" — it is **"almost right, but not quite"**, which is precisely the failure mode of an ungrounded architectural explanation. And the #1 stated reason developers still want a *human* is 75% "I don't trust AI's answers" plus 61.7% "I want to fully understand something." That is the demand-side case for a grounded, inspectable explanation rather than a fluent one.

### 1.3 Expert debunking #1: DeepWiki's LLVM architecture diagram is wrong and omits the hardest part

A compiler engineer audited DeepWiki against a codebase he knows well. This is the most detailed public teardown we found. From the 231-point thread (53 comments) on *DeepWiki: Understand Any Codebase*:

> "The high-level compilation pipeline diagram is... wrong? Like, Clang-AST is definitely part of clang frontend, and you get to the optimization pipeline, which clearly fucks up the flow through vectorization and instruction selection (completely omitting GlobalISel as well too, for that matter). The choice of backends to highlight is weird, and at the end of the day, it manages to completely omit some of the most important passes in LLVM (like InstCombine)."

> "The role of TableGen in several components is completely missing--and FWIW, understanding TableGen and its error messages is probably the single hardest part of putting together an LLVM backend, precisely the thing you'd want it to focus on. If I had to guess, it's overly fixated on things that happen to be very large files"

Source: [HN comment 45020628](https://news.ycombinator.com/item?id=45020628) by `jcranmer`, 2025-08-25, in [story 45002092 — 231 pts / 53 comments](https://news.ycombinator.com/item?id=45002092).

### 1.4 Expert debunking #2: a maintainer calls DeepWiki's LibreOffice page "deceptive garbage"

> "It's a pity that there is no clear way to send takedown requests. We didn't ask for deceptive garbage to be generated as documentation for LibreOffice, but here it is and newbies are discovering it: https://deepwiki.com/LibreOffice/core/2-build-system (spoiler: LibreOffice has never used Buck as a build system)"

Source: [HN comment 45023074](https://news.ycombinator.com/item?id=45023074) by `buovjaga`, 2025-08-26.

**Why this specific failure matters:** the model inferred "Buck is the build system" from the *presence of `BUCK` files* rather than from build reality. A hallucination that a plausible-looking artifact drove. This is a grounding failure, not a fluency failure.

### 1.5 Expert debunking #3: a maintainer burned an hour on a bug report generated from a hallucinated wiki

> "I recently received an AI-slop bug report for a small open source project (PureLB) that I maintain, and the slop was generated by DeepWiki. It was very incorrect, but I didn't know what "DeepWiki" was so I wasted about an hour. If DeepWiki is causing garbage bug reports even on tiny projects like mine, I can't imagine how much maintainer time it's wasting over all."

Source: [HN comment 45026093](https://news.ycombinator.com/item?id=45026093) by `caboteria`, 2025-08-26.

### 1.6 Independent, converging reports that generated repo docs are simply incorrect

> "I maintain open source projects and frequently direct volunteers to use DeepWiki to explore those (fairly convoluted) codebases. But ... I've caught DeepWiki hallucinating pretty convincingly far more than once just because a struct / a package / a function was named for something it wasn't doing anymore"

— [HN 45020956](https://news.ycombinator.com/item?id=45020956), `ignoramous`, 2025-08-26.

> "I hesitate to dump on Deepwiki, because what it does is to some degree impressive and timesaving (especially the system diagrams). But for my libs (that aren't super popular, but OTOH have a few million downloads per year) it generates documentation that is incorrect, and this is not good for users."

— [HN 45024024](https://news.ycombinator.com/item?id=45024024), `fergie`, 2025-08-26.

> "It goes into way too much depth on some trivial details, and glosses over more important stuff in places"

— [HN 45018862](https://news.ycombinator.com/item?id=45018862), `swiftcoder`, 2025-08-25.

> "Its a bit hard to find stuff. I was looking to find the structure of the main configuration json object and couldnt find it in the deepwiki. I found it on the "non ai created" doc page of the main Elk project"

— [HN 45018828](https://news.ycombinator.com/item?id=45018828), `tacker2000`, 2025-08-25.

**Four independent maintainers, four different codebases, the same failure mode.** That convergence — not any single quote — is what makes this pain point solid.

### 1.7 Vendor admission, on the record

Asked directly how DeepWiki prevents hallucination, its builder (Cognition/Devin) replied:

> "When working with LLMs you can never exclude hallucinations entirely but we've been carefully tuning the system over time and found it to be pretty high signal! The reason we display the code snippets is to make it easy to double check with the source"

Source: [HN comment 43799251](https://news.ycombinator.com/item?id=43799251) by `silasalberti` (self-identified DeepWiki author), 2025-04-25, in [story 43796308](https://news.ycombinator.com/item?id=43796308).

**This is the most commercially useful quote in the dossier.** The vendor's own mitigation is *"we show you the code snippets so you can check manually."* That concedes the ground-truth problem and delegates verification to the user — the exact gap a graph-grounded, click-through-to-source product claims to close. Note also the same author's framing at launch: *"we've been thinking about adding other source like docs"* ([HN 43799286](https://news.ycombinator.com/item?id=43799286)) — i.e. at the time, generation used **only the codebase itself**.

### 1.8 The best single quote in this dossier: unverifiable repo explanations are actively dangerous for newcomers

From the 532-point "comprehension debt" thread (338 comments):

> "This would be great if said comprehension is reliable. But I've seen tools designed to "understand" and document repos hallucinate many times, often coming up with a plausible but completely wrong explanation of how things actually work, or, even more subtly, of why they work the way they work. And while I could catch that because I wrote the code in question and know the answers to those questions, others do not have that benefit. The notion that someone new to the codebase - especially a relatively unexperienced dev - would have AI "documentation" as a starting point is honestly quite terrifying, and I don't see how it could possibly end with anything other than garbage out."

Source: [HN comment 45433150](https://news.ycombinator.com/item?id=45433150) by `int_19h`, 2025-10-01, in [story 45423917 — 532 pts / 338 comments](https://news.ycombinator.com/item?id=45423917).

Related, from the same thread — the "why" question is the hard one, and it is answered from *history*, not from *code*:

> "I cannot always reliably explain why some code was the way it is when looking at a single diff of my own from years ago, but give me the history of that file and the issue tracker where I can look up references from commits and see the comments etc, and I can reconstruct it with very high degree of certainty."

— [HN 45433114](https://news.ycombinator.com/item?id=45433114), `int_19h`, 2025-10-01.

### 1.9 The framing that names this market: "comprehension debt"

Jason Gorman's post (532 points, 338 comments — one of the highest-engagement items in this entire dossier):

> "Before we can safely change code, we first need to understand it – understand what it does, and also oftentimes why it does it the way it does. … When teams produce code faster than they can understand it, it creates what I've been calling "comprehension debt"."

> "An effect that's being more and more widely reported is the increase in time it's taking developers to modify or fix code that was generated by Large Language Models."

Source: [Comprehension Debt: The Ticking Time Bomb of LLM-Generated Code — Jason Gorman, Codemanship](https://codemanship.wordpress.com/2025/09/30/comprehension-debt-the-ticking-time-bomb-of-llm-generated-code/), 2025-09-30. HTTP 200. HN discussion: [story 45423917](https://news.ycombinator.com/item?id=45423917).

Note this source is a **practitioner blog post, not a measurement** — the value is the vocabulary and the 532-point reception, not a number. The numeric backing sits in P4.

### 1.10 Corroborating demand signals, ranked lower

- "The 'AI-generated pseudo-spec' is becoming a massive productivity killer. … as a developer, you now have to spend hours debugging and debunking hallucinated architectures just to prove why the AI's approach doesn't fit the existing codebase." — [HN 48294210](https://news.ycombinator.com/item?id=48294210), `batu1509`, 2026-05-27, in [story 48292224 — 2013 pts / 204 top-level comments](https://news.ycombinator.com/item?id=48292224).
- GitHub's own tracker, Copilot chat inventing the contents of your files: [microsoft/vscode-copilot-release#184 "GitHub Chat hallucinates contents of user's code"](https://github.com/microsoft/vscode-copilot-release/issues/184) (2023-05-31, 3 reactions, closed); [#1407 "Copilot Is hallucinating all the time"](https://github.com/microsoft/vscode-copilot-release/issues/1407) (2024-07-17, 6 reactions, closed); [#11695 "hallucinating project contents"](https://github.com/microsoft/vscode-copilot-release/issues/11695) (2025-06-05). **Evidence strength for these: WEAK** — low reaction counts, all closed. We cite them only as existence proofs that the vendor accepted the reports, not as prevalence.

---

## P2. Context-window limits and repo-scale retrieval failures

**Evidence strength: STRONG.** Two peer-reviewed/citable primary results (Chroma's 18-model technical report; Liu et al. in TACL; CodeRAG-Bench at NAACL 2025 Findings) plus a 260-point HN thread and direct practitioner reports of degradation. The finding is *not* "context windows are too small" — it is the stronger and more durable claim that **models do not use long context uniformly, and retrieval over code is unreliable** — which does not get fixed by a bigger window.

### 2.1 Measured: 18 models, performance degrades as input grows — on *simple* tasks

> "Large Language Models (LLMs) are typically presumed to process context uniformly—that is, the model should handle the 10,000th token just as reliably as the 100th. However, in practice, this assumption does not hold. … In this report, we evaluate 18 LLMs, including the state-of-the-art GPT-4.1, Claude 4, Gemini 2.5, and Qwen3 models. Our results reveal that models do not use their context uniformly; instead, their performance grows increasingly unreliable as input length grows."

> "NIAH is fundamentally a simple retrieval task … typically assesses direct lexical matching, which may not be representative of flexible, semantically oriented tasks."

Source: [Context Rot: How Increasing Input Tokens Impacts LLM Performance — Chroma Technical Report, Kelly Hong, Anton Troynikov, Jeff Huber](https://research.trychroma.com/context-rot), **July 14, 2025**. HTTP 200. HN: [story 44564248 — **260 pts / 59 comments**](https://news.ycombinator.com/item?id=44564248).

### 2.2 Peer-reviewed: relevant information in the *middle* of a long context is used worst

> "We find that performance can degrade significantly when changing the position of relevant information, indicating that current language models do not robustly make use of information in long input contexts. In particular, we observe that performance is often highest when relevant information occurs at the beginning or end of the input context, and significantly degrades when models must access relevant information in the middle of long contexts, even for explicitly long-context models."

Source: [Lost in the Middle: How Language Models Use Long Contexts — Liu et al., TACL 2023, arXiv:2307.03172](https://arxiv.org/abs/2307.03172). HTTP 200.

### 2.3 Peer-reviewed: retrieval over code is the bottleneck, measured across 10 retrievers and 10 models

> "We find that while retrieving high-quality contexts improves code generation, retrievers often struggle to fetch useful contexts, and generators face limitations in using those contexts effectively."

> "current retrieval models struggle to find useful documents, and generation models have limited context capacity and RAG abilities, both leading to suboptimal RACG results."

Source: [CodeRAG-Bench: Can Retrieval Augment Code Generation? — NAACL 2025 Findings](https://aclanthology.org/2025.findings-naacl.176/) · full text [ar5iv](https://ar5iv.labs.arxiv.org/html/2406.14497) · arXiv:2406.14497. Both HTTP 200.

**This is the most important citation for the product thesis.** It is a large-scale, peer-reviewed evaluation showing that the standard cloud approach (embed-and-retrieve over code) is limited **on both sides** — retrieval quality *and* the model's ability to use what it retrieved. `n` = 10 retrievers × 10 LMs, repository-level tasks included.

### 2.4 Practitioners report degradation inside the tool, not at the window edge

> "Anecdotally, my experience has been that the longer a conversation goes on in Cursor about a new feature or code change, the worse the output gets. The best results seem to be from clear, explicit instructions and plan up front for a discrete change or feature, with the relevant files to edit dragged into the context prompt."

— [HN 44569139](https://news.ycombinator.com/item?id=44569139), `milchek`, 2025-07-15, in the 260-point Context Rot thread.

> "Claude code looses the ability to distinguish between it's own mistakes and my instructions. Once it gets confused, start over. The longer the sessions, the more it starts to go in loops or just decides that the test was already broken (despite it breaking it in this session) and that it will just ignore it."

— [HN 44571839](https://news.ycombinator.com/item?id=44571839), `boesboes`, 2025-07-15, same thread.

### 2.5 Repo-scale is not solved by "just use the whole repo", and practitioners know it

> "Small codebases were always a good thing. With coding agents, there's now a huge advantage to having a codebase small enough that an agent can hold the full thing in context."

— [HN 47184342](https://news.ycombinator.com/item?id=47184342), `nicoburns`, 2026-02-27, in [story 47181471 — 88 pts / 41 comments](https://news.ycombinator.com/item?id=47181471) ("Badge that shows how well your codebase fits in an LLM's context window").

> "Outside of packages I doubt few of my code bases would fit into this. But the individual domain areas would. … It shouldn't care about implementations if there's an interface referenced, it shouldn't worry about front end when it's dealing with the back etc."

— [HN 47183086](https://news.ycombinator.com/item?id=47183086), `hennell`, 2026-02-27, same thread.

> "It is somewhat ironic that coding agents are notorious for generating much more code than necesary!"

— [HN 47184342](https://news.ycombinator.com/item?id=47184342) quoting the story, 2026-02-27.

> "I'm wondering about the "any" part. How does it perform on big codebases? Like ~20 repositories with lots of classes?"

— [HN 45023463](https://news.ycombinator.com/item?id=45023463), `fedeb95`, 2025-08-26, on the DeepWiki launch thread.

**Note the counter-evidence, stated honestly:** some commenters argue this problem is transient — *"within a year or two, context window limitations won't be a thing"* ([HN 47182073](https://news.ycombinator.com/item?id=47182073), `b112`) — and sub-agent/tool-call architectures are the current industry workaround ([HN 47182258](https://news.ycombinator.com/item?id=47182258), `arscan`). Weaker but real: 2.1 and 2.2 say the degradation is **architectural**, not merely a capacity limit, which weakens the "just wait for 10M tokens" rebuttal. Treat the rebuttal as unresolved rather than refuted.

---

## P3. Cloud-only privacy concerns

**Evidence strength: STRONG for the existence of the constraint; MODERATE-to-STRONG for prevalence.** Two named-company bans, two large-sample surveys with traceable methodology (Cisco n=2,600; Stack Overflow n≈33,662 on the AI section), a Microsoft-confirmed security regression, and a cloud vendor's own docs conceding the architectural gap. **Weak** on named Western enterprises publicly stating they run local models *because* policy forbids cloud — we could not verify a single one.

### 3.1 Samsung banned generative AI on company devices after engineers pasted source code into ChatGPT

> "Using generative AI tools on company PCs will be banned temporarily from May 1," the note said, also asking employees to refrain from uploading anything related to the company, themselves or other employees on the AI chatbots while using their personal devices.

> "Earlier in April, the company's Device Solution division overseeing its semiconductor business found three misuse cases where its engineers uploaded sensitive company information, including their meeting minutes and source codes, on ChatGPT for work."

Source: [Samsung bans AI chatbots after leak — The Korea Herald](https://www.koreaherald.com/article/3118116), **May 3, 2023**. HTTP 200. Original reporting was Bloomberg (paywalled, not retrievable here).

**This is the canonical incident:** a named company, a quoted internal memo, a specific number of incidents (3), and the specific artifact (source code).

### 3.2 Apple restricted ChatGPT over leak fears

> "Apple has restricted employees from using AI tools like OpenAI's ChatGPT over fears confidential information entered into these systems will be leaked or collected."

Source: [Apple restricts employees from using ChatGPT over fear of data leaks — The Verge](https://www.theverge.com/2023/5/19/23729619/apple-bans-chatgpt-openai-fears-data-leak), **May 19, 2023**. HTTP 200. Verge attributes the original to *The Wall Street Journal* (paywalled; we could not verify the memo's exact wording — `UNVERIFIED`).

### 3.3 Cisco, n=2,600 across 12 geographies: 27% banned GenAI outright; 48% knew non-public company data went into a tool anyway

> "63% have established limitations on what data can be entered, 61% have limits on which GenAI tools can be used by employees, and 27% said their organization had banned GenAI applications altogether for the time being."

> "Nonetheless, many individuals have entered information that could be problematic, including employee information (45%) or non-public information about the company (48%)."

Source: [More than 1 in 4 Organizations Banned Use of GenAI Over Privacy and Data Security Risks — Cisco Newsroom](https://newsroom.cisco.com/c/r/newsroom/en/us/a/y2024/m01/organizations-ban-use-of-generative-ai-over-data-privacy-security-cisco-study.html), 2024 Data Privacy Benchmark Study, released **Jan 25, 2024**. HTTP 200. Sample quoted on the page: *"responses from 2,600 privacy and security professionals across 12 geographies."*

**Caveat: Cisco sells privacy/security infrastructure.** But this is the *only* ban-percentage in this dossier that traces to a primary release **with an explicit sample size** — which is exactly the trail most circulating "X% of firms banned AI" numbers lack (see [Where the evidence is WEAK](#where-the-evidence-is-weak)).

### 3.4 Stack Overflow 2025: 81% have security/privacy-of-data concerns about AI agents (n≈33,662)

> "Challenges with AI agents … 87% of all respondents agree they are concerned about the accuracy, and 81% agree they have concerns about the security and privacy of data."

> "When I have ethical or security concerns about code **61.7%**"

Source: [AI — 2025 Stack Overflow Developer Survey](https://survey.stackoverflow.co/2025/ai). HTTP 200. The 61.7% figure is an option in the "why would you still ask a human" question.

Also on the same page, the statement *"My company's IT and/or InfoSec teams have strict rules that do not allow me to use AI agent tools or platforms"* is reported as a five-point agreement distribution of **25.4% / 27.9% / 31.8% / 10.3% / 4.6%**. Summing the top two boxes gives ≈53% agreeing — but because we inferred that mapping from a machine-extracted table, treat the **direction** (a large minority-to-majority report IT/InfoSec blocks) as supported and the exact split as `PARTIALLY VERIFIED`.

### 3.5 IBM/Ponemon, n=600: shadow AI added USD 670,000 to the average breach cost

> "among the 600 organizations researched by the independent Ponemon Institute, 63% revealed they have no AI governance policies in place to manage AI or prevent workers from using shadow AI."

> "having a high level of shadow AI —where workers download or use unapproved internet-based AI tools—added an extra USD 670,000 to the global average breach cost."

Source: [2025 Cost of a Data Breach Report — IBM](https://www.ibm.com/think/x-force/2025-cost-of-a-data-breach-navigating-ai). HTTP 200. **Correlational, not causal** — IBM does not claim otherwise. IBM publishes the report; Ponemon is the named independent research body.

### 3.6 Microsoft confirmed a *security regression*: per-workspace Copilot opt-in broke

This is the sharpest statement of the exact need a local-only tool serves.

> "Users may have some workspaces used with GitHub Copilot, but also have other sensitive workspaces for which under no circumstances must any local information be sent to an LLM. VSCode v.116 has broken the ability to opt-in to GitHub Copilot AI, and instead forced sensitive workspaces to opt-out of GitHub Copilot AI. This is not workable and against security best practices."

Source: [microsoft/vscode issue #310143 — "[security] v1.116 lowers security by breaking GitHub Copilot AI per-workspace opt-in"](https://github.com/microsoft/vscode/issues/310143), opened 2026-04-15. HTTP 200. Microsoft's own triage labels include `confirmed`, `important`, `regression`; milestone 1.117.0.

**One reporter — not a market.** Its value is that Microsoft *accepted it as a security regression*, establishing that "air-gap this workspace, not that one" is a real product requirement rather than a preference.

### 3.7 GitHub will train on individual Copilot interaction data by default — including file names and repo structure

> "Outputs accepted or modified by the user / Inputs sent to GitHub Copilot, including code snippets shown to the model / Code context surrounding the user's cursor position / Comment and documentation that the user wrote / **File names, repository structure, and navigation patterns**"

> "GitHub and Microsoft personnel working on AI model development may access interaction data collected for training."

> "Our agreements with Business and Enterprise customers prohibit using their Copilot interaction data for model training … Individual users on Free, Pro, and Pro+ plans have control over their data and can opt out at any time."

Source: [FAQ: Privacy Statement update on Copilot data use for model training (Free/Pro/Pro+) — GitHub Community discussion #188488](https://github.com/orgs/community/discussions/188488), announced 2026-03-02, effective **April 24 2026**. HTTP 200. Page shows 127 comments / 163 replies.

**Note the asymmetry:** enterprise contracts are carved out; **individual plans are opt-out**. And the collected set includes *repository structure* — metadata a local tool never emits.

### 3.8 Cursor's own docs concede the architectural gap

> "Other notes: Even if you use your API key, your requests will still go through our backend! That's where we do our final prompt building. We temporarily cache file contents on our servers to reduce latency and network usage."

> "If you choose to turn off 'Privacy Mode': we may use and store codebase data, prompts, editor actions, code snippets, and other code data and actions to improve our AI features and train our models."

Source: [Cursor · Data Use & Privacy Overview](https://cursor.com/en/data-use). HTTP 200. (Cursor's Privacy Mode is genuinely strong — zero data retention agreements with all providers; certifications listed at [cursor.com/en/security](https://cursor.com/en/security).) The commercially decisive admission is the first quote: **even a user-supplied API key is routed through Cursor's servers**, so Privacy Mode is a *contractual* guarantee, not an *architectural* one.

### 3.9 Copilot's public-code filter uses ~150 characters of surrounding context, and enterprise seats can't set it locally

> "If you choose to block suggestions matching public code, in most GitHub Copilot products, GitHub Copilot checks code suggestions with their surrounding code of about 150 characters against public code on GitHub."

> "If you are a member of an organization on GitHub Enterprise Cloud who has been assigned a GitHub Copilot seat through your organization, you will not be able to configure suggestions matching public code in your personal account settings."

Source: [Managing GitHub Copilot policies as an individual subscriber — GitHub Docs](https://docs.github.com/en/copilot/how-tos/manage-your-account/manage-policies). HTTP 200.

**Position this carefully:** the honest framing is not *"Copilot has no toggle"* — it is *"the toggle is not yours, and it never covers the network hop."*

### 3.10 Qualitative cluster: four independent "we are not allowed to use this here" reports

> "I'll tell the other side of the story. I am not allowed to use ChatGPT and Copilot in my work. As a result, I feel hampered, terribly."
> — [HN 41056160](https://news.ycombinator.com/item?id=41056160), 2024-07-24; parent story 71 pts.

> "I use GitHub Copilot at work. We were (and still are) not allowed to use our private accounts, but recently got company accounts we are allowed to use on codebases classified "confidential" or lower."
> — [HN 41685761](https://news.ycombinator.com/item?id=41685761), 2024-09-29; parent story 63 pts. **The most operationally interesting of the set** — a *data-classification tier* gating tool access.

> "Manager: "we asked, legal says you can't use copilot", dev: "okay, so from now on, I'll not discuss how I use copilot and will remember to disable it when someone sees me working, gotcha"."
> — [HN 35660625](https://news.ycombinator.com/item?id=35660625), 2023-04-21; parent story **586 pts**.

> "the company i work for and actually most Swiss IT contractors have harsh rules, and more than half of our projects, we aren't allowed to use Github Copilot or pasting stuff to any LLM API. For that matter I built a vLLM based local GPU machine for our dev squads as a trial."
> — [HN 42097778](https://news.ycombinator.com/item?id=42097778), 2024-11-10; parent story **619 pts**.

**Evidence strength: WEAK individually, MODERATE as a cluster.** Four independent reporters across 2023/2024/2026, three different constraint mechanisms (legal review, account policy, data classification), on threads scoring 63–619. Comments have no public scores. **None of this is a prevalence measure**; treat it as qualitative texture showing the *shape* of the constraint.

### 3.11 Also relevant: VS Code added a telemetry/feedback kill-switch because "enterprise needs" it

> "This iteration, we are adding a command that disables feedback, since enterprise needs a mechanism to disable feedback controls."

Source: [microsoft/vscode issue #244513](https://github.com/microsoft/vscode/issues/244513), opened 2025-03-24. HTTP 200. **Evidence strength: MODERATE** — a Microsoft engineer stating enterprise need as a design premise, but it is a one-line test-plan item. Do not upgrade this into "developers are up in arms about Copilot telemetry" — we found **no** large-sample evidence for that.

### 3.12 GitLab, n=5,300+: privacy/data security is a top obstacle for 40% of individual contributors — while 56% of CxOs call AI "risky"

> "56% of CxOs said introducing AI into the software development lifecycle is risky, while only 40% of individual contributors cited concerns about privacy and data security as a top obstacle to using AI in the software development lifecycle."

Source: [GitLab Survey Reveals Tension Around AI, Security, and Developer Productivity within Organizations — Nasdaq press-release wire](https://www.nasdaq.com/press-release/gitlab-survey-reveals-tension-around-ai-security-and-developer-productivity-within) (GitLab's own 2024 Global DevSecOps Survey announcement). HTTP 200. Sample size quoted on the same page: *"In April 2024, GitLab surveyed over 5,300 CxOs, IT leaders, developers, and security and operations professionals worldwide."*

**Evidence strength: MODERATE-to-STRONG on the number, WEAK on independence.** Large sample, but GitLab sells a DevSecOps platform and the framing is vendor-authored. **The internal tension is the interesting part:** leadership says "risky" (56%) more than practitioners say "privacy is actually blocking me" (40%). That gap is a positioning input — the buyer's fear and the user's friction are not the same thing.

---

## P4. Onboarding is slow and expensive; documentation rots

**Evidence strength: STRONG for "months, not weeks" and for measurable doc rot; and we can now state the provenance verdict on the famous statistic.** This section's most useful output is a **negative** result: the widely-quoted "3–6 months to fully productive" has **no traceable primary source**, and we can show where the real number comes from instead.

### 4.1 The best primary measurement: productivity plateaus at 6–7 months (small/medium) and up to 12 months (large)

> "We found that developer productivity in terms of number of tasks per month increases with project tenure and plateaus within a few months in three small and medium projects and it takes up to 12 months in a large project."

> "applying the same model for Project A, B and C we get a similar curve that plateaus earlier: only after 6-7 months."

> "Overall we interviewed 35 developers and managers."

Source: [Developer Fluency: Achieving True Mastery in Software Projects — Minghui Zhou & Audris Mockus, FSE-18, 2010](http://www.mockus.org/papers/fluency.pdf). HTTP 200. Numbers: 4 industrial projects (A–D) modelled; **35** developers and managers interviewed; data covering **69** individual developers.

*(PDF text extraction; ligature artifacts repaired. The paper is FSE 2010 — we cite the author-hosted PDF because it is the retrievable primary.)*

**This is the number a product team can defend.** It is peer-reviewed, it is a *measurement* rather than an assertion, and it scales with codebase size — which is the entire premise of "unfamiliar repository" tooling.

### 4.2 The origin of the folklore: managers *believed* "a few months" — and the same 2010 paper refutes it

This is the single most valuable finding in this section.

> "The development managers claimed that it takes only a few months for the developer to become 'fully productive' in their projects. However, the same managers wouldn't allow these nominally 'fully productive' developers to take on complicated tasks, thus raising a question: what are the differences between developers with a 6 month and 3 year tenure with the project?"

> "Paradoxically, the same respondents considered developers to become productive after a few months of project experience. This suggests that becoming fluent is not perceived to be the same as becoming productive."

Source: [same paper, FSE 2010](http://www.mockus.org/papers/fluency.pdf).

**The "3–6 months" figure is a mangled memory of a manager's guess, recorded in 2010 — and the very same study's quantitative data contradicts it.**

### 4.3 Independent corroboration from Microsoft: 3–9 months to domain expertise

> "1. First week: use simple tasks (bugs or configuration settings) to get familiar with the development process. 2. The next 2 or 3 weeks: get oriented in the codebase with small bugs or simple features. 3. The next 3 to 9 months: become an expert in one domain with more bugs and features. 4. Eventually: become an expert who can handle the design of a new feature."

Source: [A Case Study of Onboarding in Software Teams: Tasks and Strategies — Ju, Sajnani, Kelly, Herzig (UC Berkeley / Microsoft), ICSE 2021](https://ar5iv.labs.arxiv.org/html/2103.05055) · [arXiv:2103.05055](https://arxiv.org/abs/2103.05055). Both HTTP 200. Numbers: **32** developers + **15** engineering managers interviewed; developer survey **N=189**; manager survey **N=37**.

### 4.4 The same Microsoft study: 90% of 189 developers name complete, updated documentation as what makes onboarding work

> "E1.1: Maintaining a documentation that is complete, clear, updated, and well organized is an effective way of facilitating learning for new members. **90%**"
> "A1.1: Create and/or maintain a new member-friendly documentation. **93%**"

Source: [arXiv:2103.05055](https://arxiv.org/abs/2103.05055). 90% of N=189 developers; 93% of N=37 managers. The same study also logs the mechanism at task level: **"Out of 61 task items, 41 (67%) led to learning."**

**This is the strongest single justification for a documentation/knowledge product in the dossier** — a sampled Microsoft study naming *updated documentation* as the lever, with the word **"updated"** explicitly in the measured statement.

### 4.5 DORA 2023: high-quality documentation → 25% higher team performance (36,000+ professionals)

> "…to have 1.4x more impact on organizational performance when high-quality documentation is in place. Overall, high-quality documentation leads to 25% higher team performance relative to low-quality documentation."

> "For nine years, the State of DevOps survey has assembled data from more than 36,000 professionals worldwide, making it the largest and longest-running research of its kind."

Source: [Announcing the 2023 State of DevOps Report — Google Cloud](https://cloud.google.com/blog/products/devops-sre/announcing-the-2023-state-of-devops-report) · [DORA 2023 research page](https://dora.dev/research/2023/dora-report/). Both HTTP 200.

*Direction of the claim:* this measures documentation **quality → performance**. It supports the value of fixing docs; it does **not** by itself price documentation **rot**.

### 4.6 Measured doc rot: 23.0% of 356 repositories contain stale code-element references

> "As preliminary evidence, applying an existing README/wiki consistency checker to a statistically representative sample of 356 repositories identifies stale code element references in 23.0% of repositories, showing that traditional documentation consistency tools can already surface context rot."

Source: [Context Rot in AI-Assisted Software Development: Repurposing Documentation Consistency for AI Configuration Artifacts — arXiv:2606.09090](https://arxiv.org/abs/2606.09090), 2026-06-08. HTTP 200.

**The cleanest "X% of docs are stale" figure we found.** Caveat: the paper self-labels the result "preliminary", and it measures README/wiki references, not internal wikis.

### 4.7 Measured doc rot, industrial: outdated content is a leading defect category

> "Based on a sample of 101 defects, we found that most defects are caused by documentation defects falling into the Information Content (What) category (86). Within this category, the documentation defect types Erroneous code examples (23), Missing documentation (35), and Outdated content (19) contributed to most of the documentation defects."

Source: [Towards identifying and minimizing customer-facing documentation debt — arXiv:2402.11048](https://arxiv.org/abs/2402.11048), 2024-02-16. HTTP 200. **n=101 defects, one industrial system** — do not generalize the percentages.

### 4.8 Measured at scale: ~700K review comments, ~65K documentation-related

> "We analyze ca.700K review comments on 2,000 (Java and Python) GitHub projects … We identify 65K such cases."

> "reviewer comments most often focused on clarification, followed by pointing out issues to fix, such as typos and outdated comments."

Source: [Comments on Comments: Where Code Review and Documentation Meet — arXiv:2204.00107](https://arxiv.org/abs/2204.00107), 2022-03-31. HTTP 200.

**This is strong evidence that code and docs *do* diverge in practice, and that the divergence is currently caught by humans at review time** — i.e. rot is real and already human-costed.

### 4.9 GitLab, a major engineering org, publicly says wikis rot — and names the mechanism

> "A common belief is that a company wiki can serve as a handbook, but the reality is that wikis do not scale. They are designed to be updated by a select few, which creates several issues. One, content frequently falls out of date, which triggers a company-wide belief that the information cannot be trusted without personally confirming…"

> "It's easier to let an internal wiki rot than it is a handbook which is open to the world."

Source: [GitLab Handbook — "Handbook first"](https://handbook.gitlab.com/handbook/company/culture/all-remote/handbook-first/). HTTP 200. **Evidence strength: STRONG as a named-company admission.** GitLab names the mechanism (**docs go stale → nobody trusts them → everyone re-verifies manually**) and the compounding cost: *"the need for documentation increases in parallel with the cost of not doing it."*

### 4.10 Google's own engineering book: unowned documents go stale, obsolete and abandoned

> "Like code, documents should also have owners. Documents without owners become stale and difficult to maintain."

> "Just like old code can cause problems, so can old documents. Over time, documents become stale, obsolete, or (often) abandoned."

> "…a singular common frustration is the lack of quality documentation. 'What are the side effects of this method?' 'I got an error after step 3.' 'What does this acronym mean?' **'Is this document up to date?'**"

Source: [Software Engineering at Google, Chapter 10 "Documentation"](https://abseil.io/resources/swe-book/html/ch10.html), Tom Manshreck, ed. Riona MacNamara. HTTP 200. No numbers — authoritative framing, not a measurement.

### 4.11 Google's book also names the "we can't touch that module" phenomenon

> "Haunted graveyards — Places, often in code, that people avoid touching or changing because they are afraid that something might go wrong"

> "…knowledge and responsibilities continue to accumulate on those who already have expertise, and new team members or novices are left to fend for themselves and ramp up more slowly."

Source: [Software Engineering at Google, Chapter 3 "Knowledge Sharing"](https://abseil.io/resources/swe-book/html/ch03.html), abseil.io. HTTP 200. **No number** — do not use as a quantity.

### 4.12 Practitioner testimony, converging across independent voices: internal docs reliably rot

From a 50-point / 46-comment thread:

> "Not only is Confluence absolute crap, tech docs in it rot because it's a separate system developers don't want to use." — `cedws`

> "Internal documentation is nice, but really quite worthless for primarily three reasons: 1. At most one person is willing to create it 2. Nobody is willing to update it 3. Nobody is going to read it" — `formerly_proven`

> "Documentation that can get outdated, will be outdated and even worse be wrong." — `jakjak123`

> "At the beginning of my career I always thought it would be amazing to have complete documentation and extensive onboarding guides. Over the years I've realized that every attempt at documentation failed and always gets out of sync too quickly." — `dewey`

Source: [Ask HN: How To: Internal Documentation? — story 41415619, 50 pts / 46 comments](https://news.ycombinator.com/item?id=41415619), 2024-09-01. HTTP 200.

**Evidence strength: MODERATE.** Five independent, converging statements of the same mechanism, no number. Convergence raises it above a single anecdote.

From a 187-point / 118-comment thread:

> "The way knowledge bases die is they get cluttered up with irrelevant information from years ago which someone wants to cling to…" — `lamontcg`

> "I've written hundreds of pages on our wiki. One other coworker has written a few dozen. Everyone else has written like 0-3 entries. 99.99% of people really hate documenting stuff." — `7thaccount`

Source: [Ask HN: How do you manage your companies knowledge base? — story 30371723, 187 pts / 118 comments](https://news.ycombinator.com/item?id=30371723), 2022-02-17.

### 4.13 Real GitHub issues: the world's most-used projects publicly file "docs are outdated"

| Repository | Issue | State | Opened | Comments |
|---|---|---|---|---|
| tensorflow/tensorflow | [#96799 "TensorFlow Java documentation is outdated"](https://github.com/tensorflow/tensorflow/issues/96799) | **open** | 2025-07-11 | 4 |
| tensorflow/tensorflow | [#12416 "Outdated Documentation (ImportError: libcudnn.so.6)"](https://github.com/tensorflow/tensorflow/issues/12416) | closed | 2017-08-19 | **30** |
| tensorflow/tensorflow | [#53157 "Outdated documentation for `DataFormatVecPermute`"](https://github.com/tensorflow/tensorflow/issues/53157) | closed | 2021-11-22 | 4 |
| microsoft/vscode | [#279209 "Outdated documentation on C# Unity 6"](https://github.com/microsoft/vscode/issues/279209) | **open** | 2025-11-24 | 0 |
| nodejs/node | [#55987 "Confusing and outdated tidbit in streams documentation"](https://github.com/nodejs/node/issues/55987) | closed | 2024-11-24 | 0 |

All URLs HTTP 200 (retrieved via the GitHub Search Issues API). **Evidence strength: MODERATE** — existence proofs, not a prevalence rate. `in:title` search undercounts.

### 4.14 Onboarding in OSS is measurably *getting harder*

> "This study analyzes 406,826 issues and 1,117 newcomer GFI pull requests across 37 popular GitHub repositories … we find that the merge rate of newcomer GFI pull requests declined from 61.9% to 42.2%."

Source: [A Longitudinal Analysis of Good First Issue Practices and Newcomer Pull Requests in Popular OSS Projects — arXiv:2604.27532](https://arxiv.org/abs/2604.27532), 2026-04-30. HTTP 200. Over a 4-year window (Jul 2021 – Jun 2025).

### 4.15 Onboarding advice does not transfer between codebases — which is itself the product thesis

> "we conduct a large-scale empirical study of five Gerrit-based projects and 1,155 OSS projects from GitHub… Our results suggest that four recommendations positively correlate with newcomers' first patch acceptance in most contexts. Four recommendations are context-dependent, and four indicate significant negative associations for most projects."

Source: [From First Patch to Long-Term Contributor: Evaluating Onboarding Recommendations for OSS Newcomers — arXiv:2407.04159](https://arxiv.org/abs/2407.04159), 2024-07-04. HTTP 200.

**Read this as the strategic finding of section P4:** generic onboarding playbooks measurably fail because 4 of 15 recommendations are *negatively* associated in most projects. **Each codebase needs its own explanation** — which is an argument for per-repository grounding rather than another checklist.

### 4.16 Demand-side magnitude: legacy-codebase comprehension is a top-tier HN topic

| Story | Points | Comments | Date |
|---|---|---|---|
| [How to Improve a Legacy Codebase](https://news.ycombinator.com/item?id=14444914) | **653** | 293 | 2017-05-30 |
| [Migrating a 10,000-line legacy JavaScript codebase to TypeScript](https://news.ycombinator.com/item?id=11920451) | **311** | 91 | 2016-06-17 |
| [Ask HN: How to understand the large codebase of an open-source project?](https://news.ycombinator.com/item?id=16299125) | **188** | 47 | 2018-02-03 |
| [Ask HN: How do you search large codebases before adding a feature or fixing bug?](https://news.ycombinator.com/item?id=30819579) | **111** | 82 | 2022-03-27 |

(Points/comments from the HN Algolia API.) And the purest statement of the haunted graveyard found anywhere, from a 2019 dev.to thread with **41 reactions / 21 comments**:

> "We have a huge custom product at work that was started 20+ years ago (classic asp) with on going development and I still don't feel very productive doing any coding on it even after 10 years. … We primarily let one guy do most of it because **no one can learn it**.. and now that it's being sunsetted we rejoice."

Source: [dev.to discussion, Xing Wang](https://dev.to/xngwng/after-you-start-a-new-job-as-a-software-developerengineer-how-long-it-took-before-you-feel-you-are-very-productive--fb), 2019-02-26.

**Evidence strength: MODERATE as market size — these measure interest, not duration. Do not use them to justify a time figure.**

### 4.17 The "3–6 months" claim: provenance trace

**Verdict: `NO TRACEABLE PRIMARY SOURCE`.** No study, survey or report asserting "3–6 months for a developer to become fully productive" exists in any retrievable form. The figure is unsourced folklore copy-pasted across vendor and recruiting blogs.

| Candidate origin | Result |
|---|---|
| **"2019 survey by Plug and Play"** | **NOT FOUND / appears not to exist.** plugandplaytechcenter.com homepage and `/insights/` both HTTP 200 but **byte-identical 22,487-char bodies** with zero developer-research content. HN Algolia: **0 hits.** Treat any citation of it as fabricated. |
| **Stripe "The Developer Coefficient" (2018)** | **POSITIVELY EXCLUDED.** Full PDF downloaded (HTTP 200, 851,313 bytes), 89 streams Flate-decoded, **114,010 characters** extracted. Occurrences of `onboard`: **0**. `ramp`: **0**. `months`: **0**. `3-6`: **0**. `new hire`: **0**. The report is about maintenance time (17+ hrs/week) and bad code (~4 hrs/week, ~$85B/yr), **not onboarding duration**. (Aside on rigour: the report also contradicts *itself* — it claims the study spanned **"six different countries"** while its own methodology paragraph names **five**.) |
| **Tasktop** | **NOT FOUND.** No onboarding-duration study located. |
| **DORA** | **NO SUCH FINDING.** No developer ramp-up duration in DORA material. |
| **Google, *Software Engineering at Google*** | **NO SUCH FIGURE, and the lead's premise was wrong:** the book has **no "Onboarding" chapter** (ch. 12 is "Unit Testing"); onboarding content lives in ch. 3. |
| **DX / getdx.com** | **UNVERIFIED.** Research index fetched; no qualifying publication identified. ACM Queue DevEx paper returned HTTP 403. |
| **Alex Ewerlöf "Cost of onboarding"** | **UNVERIFIED** — no such post located. |

**Reputable-looking blogs repeating it with no source** (all fetched HTTP 200; each states the figure as established fact with no citation, no sample, no study name):

- [recruiter.daily.dev](https://recruiter.daily.dev/resources/developer-onboarding-first-90-days-playbook-engineering-teams/): *"While the industry average for developers to reach full productivity is 3–6 months…"*
- [CodersLink](https://coderslink.com/employers/blog/software-developer-onboarding-101): *"Skill onboarding should take anywhere from 3 to 6 months…"*
- [Factor Dedicated Teams](https://factordedicatedteams.com/blog/developer-onboarding-checklist/): table entry *"Technical onboarding — 3 – 6 months"*
- [Coderbuds](https://coderbuds.com/blog/time-to-productivity-developer-onboarding-metric): *"Most teams take 7-9 months…"* and *"One study found that a buddy… spends 10-15 hours per week"* — **"one study" is never named.**
- [CodeIntelligently](https://codeintelligently.com/blog/developer-onboarding-codebase-6-months): *"The industry average for a developer to reach full productivity at a new company is 6 months. I know because I've tracked it across four companies and sixteen hires."* — a **16-hire personal anecdote** dressed as an industry average. It also claims *"In 2023, Stripe published data showing their median time to first production deploy for new engineers was 2 days"* — **UNVERIFIED and contradicted** by our full-text extraction of the Stripe report.
- [TechClass](https://www.techclass.com/resources/learning-and-development-articles/onboarding-for-technical-teams-reducing-time-to-full-productivity): *"one survey found engineers often take 3 to 9 months…"* — **"one survey" is never named.**

**The pattern:** the figure **mutates** across the ecosystem — 3–6 months, 6 months, 7–9 months, 3–9 months — always attributed to "the industry average" or "one survey," never to a document. **That variance around an unfalsifiable centre is the signature of folklore, not of a measurement.**

**The defensible claim instead:** *Ramp-up is measured in months. The best peer-reviewed measurement puts the productivity plateau at **6–7 months** on small/medium codebases and **up to 12 months** on a large one (Zhou & Mockus, FSE 2010); Microsoft's ICSE 2021 study puts domain expertise at **3–9 months**. There is no credible source for "3–6 months."*

---

## P5. "Explain this repo" tool quality complaints

**Evidence strength: STRONG for the *category* complaint; and the strongest signal in this section is the tool-quality verdict from the DeepWiki thread combined with Google CodeWiki's reception.** The category has real users, real complaints, and — importantly — **at least one well-funded entrant that already folded**.

### 5.1 DeepWiki: 231 points, and the complaints are about shallowness and unaccountability

Covered in detail in P1 (§1.3–§1.7). The category-level complaints, restated as findings:

| Complaint | Verbatim | Strength |
|---|---|---|
| Diagrams are too abstract to be useful | "I really want to like deepwiki, but just looking at the diagrams of repos, they are too handwavy to be useful. They are a conceptual overview and don't seem tied down enough to the actual implementation details of a particular project." — [HN 45020036](https://news.ycombinator.com/item?id=45020036), `IceHegel`, 2025-08-25 | WEAK alone; STRONG as a pair |
| Diagrams aren't engineering-grade on codebases you know | "Yeah this is my experience too. For projects I know well, the diagrams are not engineering quality." — [HN 45022292](https://news.ycombinator.com/item?id=45022292), `IceHegel`, 2025-08-26 | see above |
| Content is mis-prioritised | "It goes into way too much depth on some trivial details, and glosses over more important stuff in places" — [HN 45018862](https://news.ycombinator.com/item?id=45018862), `swiftcoder` | |
| You cannot get it taken down or corrected | "It's a pity that there is no clear way to send takedown requests." — [HN 45023074](https://news.ycombinator.com/item?id=45023074), `buovjaga` | MODERATE |
| Uninvited generation creates the *appearance* of official docs | "Annoyingly, anyone can just.. request a deepwiki for any GitHub repo. That one exists doesn't mean that it's endorsed or reviewed by the project. They just kind of barged in, welcome or not." — [HN 45023178](https://news.ycombinator.com/item?id=45023178), `Nullabillity`, 2025-08-26 | MODERATE |
| Prior art for this failure: LLM content farms confused newcomers before | "A couple of years ago the OCaml and Julia languages already had to deal with a content farm that created wikis for them, filled them with LLM-generated, blatantly wrong or stupidly low quality content, and SEOed its way above actual learning materials… I'm pessimistic and think it'll cause similar confusion." — [HN 45025992](https://news.ycombinator.com/item?id=45025992), `debugnik`, 2025-08-26 | MODERATE |

**Balanced note:** the thread was not uniformly negative — *"I regularly refer to it as one of the few strictly net positive AI coding tools"* ([HN 45021450](https://news.ycombinator.com/item?id=45021450), `nikisweeting`), and *"the deep research follow-up questions system at the bottom"* was singled out as the best part. **The praise is for interactive Q&A; the criticism is for the generated static wiki and diagrams.** That split is directly actionable.

### 5.2 Google CodeWiki: 101 points — and the sharpest complaints are non-determinism and depth

Google's 2025 entrant into the same category. Selected reactions from the 41-comment thread:

> "The whole thing is automatically generated? Does anything persist? If I could be in the middle of reading it, and the next day it's completely different, that's a huge waste of my time."

— [HN 45938831](https://news.ycombinator.com/item?id=45938831), `lrpe`, 2025-11-15. **This is the doc-rot problem reappearing inside the AI solution** — regenerated content has no stable identity, so you cannot rely on it or cite it.

> "Interesting. I've found Claude Code very useful for answering questions about codebases. I think that kind of functionality is on the whole more useful than static AI-generated documentation, but maybe there's a place for an always-ready and google-able starting point. It badly needs to split up the pages for different parts of large codebases. The golang/go page is way too long and the table of contents sidebar make[s] …"

— [HN 45932333](https://news.ycombinator.com/item?id=45932333), `_23sd`, 2025-11-14. **Two findings in one comment:** (a) generated explanations do not scale to large repos — the exact segment Fieldguide targets; (b) *users prefer interactive Q&A over a generated artifact.*

> "I've never had AI understand a problem of that depth though. It can maybe surface the right part of the docs to reference but in the times I have used it it leads me down the wrong path half of the time."

— [HN 45931426](https://news.ycombinator.com/item?id=45931426), `quamserena`, 2025-11-14.

> "I don't understand how this can be more optimal than just reading the documentation that a human already wrote. All "normal" uses can be answered by reading the docs, everything advanced you can just read the code. I'm not sure when I would ever use this?"

— [HN 45929058](https://news.ycombinator.com/item?id=45929058), `quamserena`, 2025-11-14. **This is the "too ordinary / unappealing" objection stated by a user, about a Google product.** Fieldguide must answer it explicitly.

> "If this is being regenerated every commit, I'd be interested to see the version history and/or being able to see the CodeWiki diff inside a pull request. Maybe it's too noisy, if the LLM isn't stable about the way it's wording things"

— [HN 45929546](https://news.ycombinator.com/item?id=45929546), `e28eta`, 2025-11-14. **Non-determinism defeats diffing** — you cannot review what changes if the wording churns.

> "Seems great: I looked at two largish code bases I'm familiar with, and learned something each time. But is this just a summary for the impatient, or can it reduce the effort for developers writing docs? Docs have always been the mirror of code, and thus hard to get and keep right."

— [HN 45934306](https://news.ycombinator.com/item?id=45934306), `w10-1`, 2025-11-15. **The "mirror" framing** — a second copy of the truth, which is exactly what P4 §4.9 shows rots.

**Also present, from the same thread:** hostility from maintainers about uninvited generation — *"you have a pattern of using the word "wiki" to describe products that have nothing to do with wikis? … misinformation slop generators"* ([HN 45948278](https://news.ycombinator.com/item?id=45948278), `fifhtbtbf`, 2025-11-16) and *"If they choose to publish no-truth-value garbage about my life's work…"* ([HN 45945041](https://news.ycombinator.com/item?id=45945041), `conartist6`, 2025-11-16). **Flag as qualitative: this is a handful of angry maintainers, not a measured backlash.**

### 5.3 The category already has exits — and a free substitute

**Sourcetrail was discontinued in 2021.** Sourcetrail was a FOSS interactive source explorer providing dependency graphs for C/C++/Java/Python.

> "Sourcetrail was a FOSS source code explorer that provided interactive dependency graphs and support for multiple programming languages… The project was discontinued in 2021."

Source: [Sourcetrail — Wikipedia](https://en.wikipedia.org/wiki/Sourcetrail). HTTP 200.

**Its founding story is itself an onboarding datapoint:**

> "The project was started by Eberhard Gräther after an internship at Google where he worked on Google Chrome, and noticed that he consumed a lot of time (1 month) to implement a simple feature that he expected to be done in 1–2 hours."

— same source. **A 1-month vs 1–2-hour delta is a vivid, quotable onboarding-cost anecdote** — with the honesty caveat that it is a single origin story, not a measurement.

**CodeSee was acquired and its product line wound down.** GitKraken announced the acquisition in May 2024 ([HN submission 40361461, 12 pts](https://news.ycombinator.com/item?id=40361461)); by November 2024 a competitor was publicly "picking up where CodeSee left off" ([HN submission 42114034, 5 pts](https://news.ycombinator.com/item?id=42114034)). `PARTIALLY VERIFIED`: the GitKraken blog post itself returned **HTTP 403** to us, so the acquisition detail rests on HN submission titles plus the follow-up post's framing, **not** on a fetched primary.

**A free, open-source substitute for the "bus factor" feature already exists** — [JetBrains Research's Bus Factor Explorer](https://github.com/JetBrains-Research/bus-factor-explorer), with a treemap view and a *simulation mode* mirroring CodeScene's paid off-boarding simulator ([arXiv:2403.08038](https://arxiv.org/abs/2403.08038)).

**Competitive read:** two well-funded attempts at "visualise/explain the codebase" have died or been absorbed, while the survivors (DeepWiki, CodeWiki, Claude Code) are interactive and cloud-hosted. The niche is not empty but it is clearly hard to monetise as a *visualiser* alone.

### 5.4 Sourcegraph Cody — evidence is thin and we say so

Cody has low engagement in HN discussion and low reported usage. From the Stack Overflow 2025 tool list, Cody appears at **3%** among out-of-the-box AI tools (versus ChatGPT 82%, GitHub Copilot ~68%, Gemini ~47%, Claude Code ~40.8%) — [survey page](https://survey.stackoverflow.co/2025/ai). HTTP 200.

HN evidence is weak: the launch thread [Open Sourcing Cody — 105 pts / 33 comments](https://news.ycombinator.com/item?id=35339010) (2023-03-28) is mostly about licensing, not quality. The one usable quality complaint is a user preferring the underlying model to the IDE integration: *"I was doing so with an IDE integration: Sourcegraph Cody. It was good, but had a large number of 'meh'…"* — [HN 41882286](https://news.ycombinator.com/item?id=41882286), 2024-10-18.

**Evidence strength: WEAK.** We found **no** substantial complaint corpus for Cody. Reporting that honestly is the finding: **the "explain this repo" category's complaint volume is concentrated almost entirely on DeepWiki and CodeWiki**, the two products that generated output *unasked for public repos*.

**A useful adjacent argument** (not a vendor claim): the repo-scale retrieval problem is acknowledged as a hard one in the community — *"Unless you want to feed the LLM your entire codebase, which is usually infeasible, you need to be able to retrieve relevant context, which relies on understanding the codebase"* — [HN 41714867](https://news.ycombinator.com/item?id=41714867), 2024-10-01. **Note: we verified this comment's author is `esafak`, an ordinary user — it is *not* a Sourcegraph executive**, and must not be attributed to Sourcegraph.

### 5.5 Swimm — evidence too thin to report

HN threads on Swimm are tiny ([4 pts](https://news.ycombinator.com/item?id=34609740), [8 pts](https://news.ycombinator.com/item?id=34945043), [1 pt](https://news.ycombinator.com/item?id=33543870)). We found **no** substantive complaint thread. `UNVERIFIED: we could not gather usable quality evidence on Swimm.`

### 5.6 What users actually do instead — and the sharpest demand signal in P5

> "I've been surprised that there hasn't been much progress in code tracing. It's incredibly hard to jump into a new code base. Cscope and ctags are still used but uncommon. It's not common to see people use debuggers. … But as code bases have exploded we still haven't gotten much better than where [we were]"

Source: [HN 43189517](https://news.ycombinator.com/item?id=43189517) by `godelski`, 2025-02-26, in [story 43174041 — **263 pts / 62 comments**](https://news.ycombinator.com/item?id=43174041) (Show HN: Tach — Visualize and untangle your Python codebase).

**Reading:** the prior generation of tools was cscope/ctags; the current generation is an LLM chat box; the user's verdict is that **the state of the art has not materially improved** for jumping into an unfamiliar codebase. The workaround today is **grep, ctags, debuggers, and "ask a senior dev."**

---

## P6. Knowledge loss, bus factor, and ownership

**Evidence strength: STRONG — and this is the best-sourced section in the dossier, because the core numbers are peer-reviewed rather than vendor-published.** The single most important caveat: **every CodeScene number is vendor content with zero independent replication.**

### 6.1 Peer-reviewed: 65% of 133 popular GitHub projects have truck factor ≤ 2

> "Truck Factor (TF) is a metric … the minimal number of developers that have to be hit by a truck (or quit) before a project is incapacitated. … we propose a novel (and automated) approach for estimating TF-values, which we execute against a corpus of 133 popular project in GitHub. We later survey developers as a means to assess the reliability of our results. Among others, we find that the majority of our target systems (**65%**) have TF <= 2. Surveying developers from 67 target systems provides confidence towards our estimates; in 84% of the valid answers we collect, developers agree or partially agree that the TF's authors are the main authors of their systems."

Source: [A Novel Approach for Estimating Truck Factors — Avelino, Passos, Hora, Valente; ICPC 2016; arXiv:1604.06766](https://arxiv.org/abs/1604.06766). HTTP 200. Awarded the [ICPC 2026 Most Influential Paper Award](https://conf.researchr.org/details/icpc-2026/icpc-2026-mip-award/1/A-Novel-Approach-for-Estimating-Truck-Factors) — i.e. the canonical citation in this literature.

**Why this is the strongest bus-factor number:** it is not just commit arithmetic — it was **validated against the developers themselves** (67 systems surveyed, 84% agreement on main authors).

### 6.2 Peer-reviewed, largest sample: 89% of 36,000+ projects lost their core dev team at least once — only 27% replaced it

> "we calculate the truck factor (or bus factor) of over 36,000 OSS projects … We find that **89%** of our studied projects have experienced losing their core development team at least once. Our results also show that in **70%** of cases, this project abandonment happens within the first three years of the project life. … Finally, we find that only **27%** of projects that were abandoned were able to attract at least one new TF developer."

Source: [Myth: The loss of core developers is a critical issue for OSS communities — arXiv:2412.00313](https://arxiv.org/abs/2412.00313), 2024-11-30. HTTP 200.

**This is the quantitative core of the "knowledge leaves and is never rebuilt" thesis.** Note the paper's title is contrarian, and the nuance matters: losing core developers is common and survivable — **it is the 27% replacement rate that is alarming.** Do not cite the title as evidence the problem is fake.

### 6.3 Peer-reviewed: knowledge loss is heavy-tailed, and abandoned files rot in place

> "They found that the two projects were susceptible to large knowledge losses that are more than **three times the average loss**. … We found that all projects had a similar knowledge loss probability distribution, but extreme knowledge loss can be more severe than those originally discovered in Chromium and the project at Avaya. We also found that, in the systems under study, **abandoned files often remained in the system for long periods**."

Source: [Revisiting Turnover-Induced Knowledge Loss in Software Projects — Nassif & Robillard, ICSME 2017](https://api.openalex.org/works/doi:10.1109/ICSME.2017.64); DOI [10.1109/ICSME.2017.64](https://doi.org/10.1109/ICSME.2017.64). HTTP 200. 8 projects replicated (Chromium + 7 others).

### 6.4 Peer-reviewed: experts — not newcomers — absorb abandoned files

> "Adding a new developer seems an obvious solution to file abandonment. However, on the projects we studied, the experts adopted the majority of abandoned files. … for Avaya **81%** of developers who take over the maintenance of a file have at least one year and often many more years of experience. The corresponding number for Chrome is **54%**, and only **16%** of files are adopted by newcomers in their first quarter on the project."

> "They then compared their recommendations against historical data about who actually went on to modify the abandoned file and found that they could reduce the median knowledge loss by about **25%**."

Source: [Quantifying and mitigating turnover-induced knowledge loss — review by Greg Wilson, It Will Never Work in Theory](https://neverworkintheory.org/2021/09/30/quantifying-and-mitigating-turnover-induced-knowledge-loss.html), 2021-09-30, reviewing Rigby et al., ICSE 2016, DOI [10.1145/2884781.2884851](https://doi.org/10.1145/2884781.2884851). HTTP 200.

**Honesty caveat:** the verbatim text is from a *review* (Greg Wilson), not the paywalled ACM paper. The reviewer states his own reservation: *"I have reservations about how accurately file changes capture the distribution of knowledge in a project."* The underlying paper is ICSE 2016 and peer-reviewed; the exact wording is second-hand.

**Product-relevant:** newcomers do **not** pick up orphaned code — experts do. So "hire someone new" is not the mitigation; **making the knowledge legible to whoever is left** is.

### 6.5 Surveyed: 269 engineers say bus factor is a real problem, and commit history alone is insufficient

> "With a survey of **269 engineers**, we find that the bus factor is perceived as an important problem in collective development… We also propose a multimodal bus factor estimation algorithm that uses data on code reviews and meetings together with the VCS data. We test the algorithm on 13 projects developed at JetBrains"

Source: [Bus Factor In Practice — Jabrayilzade, Evtikhiev, Tüzün, Kovalenko (JetBrains Research); arXiv:2202.01523](https://arxiv.org/abs/2202.01523), 2022-02-03. HTTP 200.

**Two findings that matter for a knowledge-graph product:** (1) perception is measured with a decent n=269; (2) **commit history alone is not the whole picture** — code review and meeting signals carried additional knowledge. Anyone shipping "we compute who knows what from git" should know this.

### 6.6 The obvious implementation of "who owns what" is known to be biased

> "Our methods significantly outperform the widely adopted degree-based heuristic, which we show can yield **severely inflated estimates**."

Source: [Fast and Accurate Heuristics for Bus-Factor Estimation — arXiv:2508.09828](https://arxiv.org/abs/2508.09828), 2025-08-13. HTTP 200. Evaluated on 1,000+ synthetic power-law graphs.

**And the field has no consensus metric:** [The Theory and Practice of Computing the Bus-Factor — arXiv:2603.07845](https://arxiv.org/abs/2603.07845), 2026-03-08, proves two formulations of bus factor are **NP-hard** and that existing measures "rely on heterogeneous modeling assumptions." HTTP 200. *Preprint; weak as market evidence, moderate as a technical constraint.*

### 6.7 CodeScene: VENDOR, no independent replication, and one eyebrow-raising borrowed number

**Read this subsection as a warning, not as evidence.** CodeScene AB sells exactly this product category. **We found no independent, non-CodeScene replication of any CodeScene knowledge-map or bus-factor figure.** Its papers are authored by its own employees (Adam Tornhill is co-founder/Chief Architect; Markus Borg is its Principal Researcher).

CodeScene's product doc defines the metric it sells:

> "CodeScene's dashboard presents a high-level summary of the knowledge distribution and existing knowledge loss (e.g. code written by developers who have since left the company or project)"

Source: [Knowledge Distribution — CodeScene docs 4.3.11](https://docs.enterprise.codescene.io/versions/4.3.11/guides/social/knowledge-distribution.html). HTTP 200. **Zero numbers on the page.**

Its bus-factor page asserts prevalence with **no citation, no sample, no measurement**:

> "Often, the bus factor is as low as a couple of long-term contributors; few organizations have resilience to the sudden loss of key personnel."

Source: [Mitigate the Bus Factor via the Off-Boarding Simulation — CodeScene docs](https://codescene.io/docs/guides/simulations/offboarding-simulator.html). HTTP 200. **This is exactly the rhetorical move to distrust: a vendor stating a scary prevalence claim without a number.**

CodeScene's "Code Red" study **is** peer-reviewed (TechDebt 2022) with a real sample:

> "We analyze 39 proprietary production codebases … By analyzing activity in 40,000 files, we find that low quality code contains 15 times more defects than high quality code. Furthermore, resolving issues in low quality code takes on average 124% more time in development. Finally, we report that issue resolutions in low quality code involve higher uncertainty manifested as 9 times longer maximum cycle times."

BUT — and this is the trap — its headline 42% is **borrowed, not measured**:

> "The resulting technical debt is estimated to waste up to 42% of developers' time."

The words *"is estimated to"* attribute it to prior work. **Do not quote 42% as CodeScene's finding.** Source: [Code Red: The Business Impact of Code Quality — TechDebt 2022](https://2022.techdebtconf.org/details/TechDebt-2022-papers/2/Code-Red-The-Business-Impact-of-Code-Quality-A-Quantitative-Study-of-39-Proprietar), Tornhill & Borg. HTTP 200. *(Independent replication: none found — and note CodeScene is itself a competitor in this space.)*

CodeScene has since disclosed a **much larger** proprietary corpus, which is worth knowing because it shows the scale of data a competitor holds — but **which still does not validate the knowledge-map claims**, since this paper is about code-health ROI:

> "UOwns 40 proprietary development projects containing 139,869 files in total (including non-source code) contributed by 1,414 developers."

Source: [Increasing, not Diminishing: Investigating the Returns of Highly Maintainable Code — arXiv:2401.13407](https://arxiv.org/abs/2401.13407) (Borg, Pruvost, Mones, Tornhill; TechDebt 2024), full text at [arxiv.org/html/2401.13407v1](https://arxiv.org/html/2401.13407v1). Both HTTP 200. **Read the direction of this evidence honestly: it proves CodeScene has access to a large proprietary dataset. It does not independently validate their bus-factor or knowledge-distribution numbers.**

### 6.8 Ownership concentration predicts defects — peer-reviewed, Microsoft-scale

> "We examine the relationship between different ownership measures and software failures in two large software projects: Windows Vista and Windows 7. We find that in all cases, measures of ownership such as the number of low-expertise developers, and the proportion of ownership for the top owner have a relationship with both pre-release faults and post-release failures."

Source: [Don't touch my code! — Bird, Nagappan, Murphy, Gall, Devanbu, FSE 2011](https://doi.org/10.1145/2025113.2025119). DOI HTTP 200; abstract via [OpenAlex](https://api.openalex.org/works/doi:10.1145/2025113.2025119). No percentages in the abstract, so none are quoted. **Crucially: this is not a bus-factor paper and does not measure knowledge loss** — it is the best peer-reviewed support for "ownership structure predicts defects."

### 6.9 In practice: a critical Linux library has bus factor 1, self-measured

> "libinput has a bus factor of 1. … of the ~1200 commits since 1.9.0, just under **990** were done by me. In those 2 years we had 76 contributors in total, but only 24 of which have more than one commit and only 6 contributors have more than 5 commits."

> "At this point libinput is more-or-less the only input stack we have and all major distributions rely on it. It drives mice, touchpads, tablets, keyboards, touchscreens, trackballs, etc."

Source: [libinput's bus factor is 1 — Peter Hutterer](https://who-t.blogspot.com/2019/10/libinputs-bus-factor-is-1.html), 2019-10-16. HTTP 200.

**~83% of commits by one person; 6 of 76 contributors with >5 commits.** Self-measured with explicit counts on infrastructure whose failure mode is broad. **Single project → proves existence, not prevalence** (prevalence comes from §6.1/§6.2). HN discussion: [story 23254871 — 187 pts / 129 comments](https://news.ycombinator.com/item?id=23254871).

### 6.10 Knowledge loss can be administrative, not technical

> "When Weirich died in 2014, Searls noticed that no one was maintaining one of Weirich's software-testing tools. That meant there would be no one to approve changes if other developers submitted bug fixes, security patches, or other improvements. Any tests that relied on the tool would eventually fail, as the code became outdated and incompatible with newer tech."

Source: [The Bus Factor: Life for Open-Source Projects After a Developer's Death — WIRED, Klint Finley](https://www.wired.com/story/giving-open-source-projects-life-after-a-developers-death/), 2017-11-06. HTTP 200. **n=1, journalistic** — but the mechanism (nobody could *approve patches*, not nobody could *write* them) is under-appreciated.

Related: OpenSSL was maintained primarily by two people for over a decade ([The Verge, 2014-04-27](https://www.theverge.com/2014/4/27/5658368/two-men-are-tasked-with-taking-care-of-openssl)). HTTP 200.

**GitHub itself ships an ownership-continuity feature** — evidence that single-owner stranding is a real, recurring operational problem: [Maintaining ownership continuity of your personal account's repositories — GitHub Docs](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/repository-access-and-collaboration/maintaining-ownership-continuity-of-your-personal-accounts-repositories). HTTP 200.

**Meanwhile CODEOWNERS is documented purely as review routing** — [About code owners — GitHub Docs](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners) mentions **no** bus factor, knowledge concentration or key-person risk. **Competitively useful:** the industry-standard ownership mechanism is not documented or marketed as a knowledge-loss control, so a "who understands what" tool is **not competing with CODEOWNERS on the same stated purpose**. Do not overstate this as evidence CODEOWNERS fails to reduce bus factor — GitHub makes no such claim.

### 6.11 Government-scale: systems depend on skills nobody has

> "In June 2019, GAO identified 10 critical federal IT legacy systems … these legacy systems ranged from about **8 to 51 years old** and collectively cost about **$337 million annually** to operate and maintain. Several of the systems used older languages, such as Common Business Oriented Language (COBOL). GAO has previously reported that reliance on such languages has risks, such as a rise in procurement and operating costs, and **a decrease in the availability of individuals with the proper skill sets**."

Source: [Information Technology: Agencies Need to Continue Addressing Critical Legacy Systems — GAO-23-106821](https://www.gao.gov/products/gao-23-106821), published 2023-05-10. **Direct URL returns HTTP 403** (GAO blocks automated retrieval); cited via [Internet Archive snapshot](http://web.archive.org/web/20260824194940/https://www.gao.gov/products/gao-23-106821) — HTTP 200.

**The government itself names skills scarcity as an institutional risk.** Note: the widely-repeated "$337 **billion**" figure is a **misreading** — the report says **$337 million**.

And the canonical incident:

> "Connecticut has also admitted that it's struggling to process the large volume of unemployment claims with its '40-year-old system comprised of a COBOL mainframe and four other separate systems.'"

> "'Literally, we have systems that are 40-plus-years-old,' New Jersey Gov. Murphy said… 'There'll be lots of postmortems and one of them on our list will be how did we get here where we literally needed COBOL programmers?'"

Scale of the failure, from the same report: **more than 362,000 New Jersey residents filed for unemployment in the two weeks** that overloaded the 40-year-old mainframes.

Source: [Wanted: People who know a half century-old computer language so states can process unemployment claims — CNN Business](https://www.cnn.com/2020/04/08/business/coronavirus-cobol-programmers-new-jersey-trnd/index.html), 2020-04-08. HTTP 200.

### 6.12 Turnover context — and a folk statistic that is refuted

**BLS: US median tenure 3.9 years (Jan 2024), lowest since 2002; computer & mathematical occupations 4.3 years.**

> "The median number of years that wage and salary workers had been with their current employer was **3.9 years** in January 2024, down from 4.1 years in January 2022 and the lowest since January 2002"

> Table 6 row: "Computer and mathematical occupations 5.0 4.4 4.3 3.9 4.2 **4.3**" (Jan 2014 → Jan 2024)

Sources: [BLS Employee Tenure in 2024](https://www.bls.gov/news.release/tenure.nr0.htm) and [Table 6](https://www.bls.gov/news.release/tenure.t06.htm) — **both direct URLs return HTTP 403** (BLS bot policy); cited via Internet Archive snapshots [nr0](http://web.archive.org/web/20260917072059/https://www.bls.gov/news.release/tenure.nr0.htm) and [t06](http://web.archive.org/web/20260819191643/https://www.bls.gov/news.release/tenure.t06.htm), both HTTP 200.

**This directly refutes the folk claim that "the median tenure of software developers is ~2 years."** `UNVERIFIED: no primary source (LinkedIn, BLS, or peer-reviewed) publishes a ~2-year figure, and BLS contradicts it.` **Marketing must not repeat the 2-year claim.**

**Also refuted — the turnover cost figure:**

> "SHRM estimates that it will cost a company six to nine months of an employee's salary to identify and onboard a replacement."

Source: [Why the Onboarding Experience Is Key for Retention — Gallup](https://www.gallup.com/opinion/gallup/234419/why-onboarding-experience-key-retention.aspx). **This URL returned HTTP 404 on re-verification** (two URL variants tried). **The citation is therefore DEAD and the figure is `NO TRACEABLE PRIMARY SOURCE`** — it rests on a second-hand SHRM attribution inside a vendor opinion piece, and it is **not software-specific.** The commonly cited "1.5× salary" variant is likewise unverified.

**Also weak:** PayScale publishes Google median tenure of **1.1 years** vs Microsoft **4 years** with **no date, no sample size, no methodology** ([PayScale employee loyalty](https://www.payscale.com/data-packages/employee-loyalty/company-comparison), HTTP 200). A 4× spread with no methodology is a reliability warning, not a data point.

### 6.13 Demand signal: bus factor is a durable, high-engagement topic

| HN story | Points | Comments | Date |
|---|---|---|---|
| [Vibe coding creates a bus factor of zero](https://news.ycombinator.com/item?id=44966856) | **223** | 131 | 2025-08-20 |
| [Libinput's bus factor is 1 (2019)](https://news.ycombinator.com/item?id=23254871) | **187** | 129 | 2020-05-21 |
| [Terminating an employee with a bus factor of 1](https://news.ycombinator.com/item?id=38213424) | **95** | 100 | 2023-11-10 |
| [But what about the bus factor?](https://news.ycombinator.com/item?id=29416674) | **65** | 85 | 2021-12-02 |
| [What Is the Truck Factor of Popular GitHub Applications?](https://news.ycombinator.com/item?id=9874503) | **73** | 32 | 2015-07-12 |

(Points/comments from the HN Algolia API.) Algolia reports **137 matching stories for "bus factor"** and **164 for "truck factor"**.

**Evidence strength: MODERATE as a demand signal, WEAK as market size** — an upvote is not a budget. Note the instructive asymmetry: the highest-engagement item is about *AI-generated code* creating bus factor zero (223 pts), while the two peer-reviewed knowledge-loss papers scored **3 points each**. **The research is not what the community reads.**

---

## P7. Demand for offline / air-gapped / local code understanding

**Evidence strength: STRONG for regulator and government demand, MODERATE for commercial demand.** The decisive fact: **GitHub built FedRAMP-authorized, geographically pinned inference and charges 10% more for it.** A hyperscaler spending real money to respect a boundary is the strongest possible confirmation that the boundary matters — and it leaves the *fully offline* segment of that demand unserved by cloud architecture.

### 7.1 GitHub built geo-pinned, FedRAMP-authorized Copilot inference — and prices it at a 10% premium

> "GitHub Copilot now supports data residency for US and EU regions, ensuring all inference processing and associated data stay within your designated geography."

> "For US government customers, the underlying model hosts and infrastructure are FedRAMP Moderate authorized."

> "Data-resident and FedRAMP requests carry a **10% increase** in the model multiplier, reflecting provider costs for regional and compliance-certified endpoints."

> "Gemini models are not yet supported, as GCP does not currently offer data-resident inference endpoints."

Source: [Data residency (US + EU) and FedRAMP-authorized models now available in Copilot — GitHub Changelog](https://github.blog/changelog/2026-04-13-copilot-data-residency-in-us-eu-and-fedramp-compliance-now-available/), released **2026-04-13**. HTTP 200.

**Read the causality carefully:** a *cloud* vendor is paying to keep data inside a boundary and charging for it. That proves boundary integrity is worth money to buyers — while leaving the offline segment untouched, since even "data-resident" still means the code leaves the machine.

### 7.2 Copilot ships a policy switch whose only purpose is restricting users to FedRAMP Moderate models

> "If your enterprise uses GitHub Enterprise Cloud with data residency in the US, you can enable a policy to ensure that users on your Copilot plan can only use models with FedRAMP Moderate certification."

Source: [FedRAMP-compliant models for GitHub Copilot — GitHub Docs](https://docs.github.com/en/copilot/concepts/enterprise/fedramp-models). HTTP 200.

**Model choice is subordinate to compliance eligibility** — the allow-list excludes several frontier models.

### 7.3 China's financial regulator requires "autonomous controllability" and supply-chain review of AI

The strongest regulator-sourced evidence in this dossier. `国家金融监督管理总局` (National Financial Regulatory Administration, NFRA) issued binding guidance to all policy banks, large banks, joint-stock banks, foreign banks, insurers and financial holding companies.

> "坚持自主可控,持续提升人工智能相关技术、设备自主可控水平…加强信息技术应用创新适配。"
> *(Our translation: "Uphold self-reliance and controllability; continuously raise the level of autonomous controllability of AI-related technology and equipment; … strengthen adaptation for information-technology application innovation [信创].")*

> "金融机构要建立对人工智能算力、模型、数据、技术工具等的供应链安全合规管理机制,确保应用自主可控,防范对个别技术服务过度依赖引发的集中度风险。"
> *(Our translation: "Financial institutions shall establish supply-chain security and compliance management mechanisms for AI compute, models, data and technical tools, ensure that applications are autonomously controllable, and guard against concentration risk arising from over-dependence on an individual technology vendor.")*

Source: [国家金融监督管理总局关于银行业保险业人工智能安全开发应用的指导意见 (金发〔2026〕8号) — Hunan Provincial Government portal reprinting the NFRA document](https://hunan.gov.cn/zqt/zcsd/202606/t20260622_34008933.html), document dated **2026-06-18**, portal publication 2026-06-22. HTTP 200 (46,884 bytes; UTF-8 decoded from raw bytes).

**Caveats we will not gloss over:** (1) the Chinese text is the regulator's, the English is **our translation**, not official; (2) `自主可控` ("autonomous/self-controllable") is a policy term of art that does **not** literally mandate on-premises deployment — it mandates *controllability* and supply-chain review, which *drives* private deployment rather than flatly prohibiting foreign cloud.

### 7.4 China Construction Bank completed "private deployment" of a DeepSeek R1-based model

> "China Construction Bank said on Friday it had completed the private deployment of a large financial model based on DeepSeek R1 earlier this year."

> "Private deployment means for internal use only."

Source: [China Construction Bank says it launched internal financial model based on DeepSeek R1 — Reuters, by Selena Li, via Yahoo Finance](https://finance.yahoo.com/news/china-construction-bank-says-launched-100655314.html), 2025-03-28. HTTP 200.

**The wire itself defines the term** — *"private deployment means for internal use only"* — which is the cleanest product definition of the on-prem segment in this dossier. A named top-tier bank choosing on-prem over API for a financial/coding-class model.

### 7.5 The Chinese private-deployment AI software market is measured in billions of RMB (IDC)

> "2025年中国计算机视觉AI软件私有化市场规模达到92.5亿元。"
> *(Our translation: "In 2025, China's computer-vision AI software private-deployment market reached RMB 9.25 billion.")*

> "语音语义118.6亿元" *(Speech and semantics: RMB 11.86 billion.)*

Source: [Token之外：中国私有化AI进入深水区 — IDC China blog](https://www.idc.com/resource-center/blog/token%e4%b9%8b%e5%a4%96%ef%bc%9a%e4%b8%ad%e5%9b%bd%e7%a7%81%e6%9c%89%e5%8c%96ai%e8%bf%9b%e5%85%a5%e6%b7%b1%e6%b0%b4%e5%8c%ba%ef%bc%8c%e5%b8%82%e5%9c%ba%e6%a0%bc%e5%b1%80%e8%bf%9c%e6%9c%aa%e5%ae%9a/), dated **2026-05-18**. HTTP 200.

**Evidence strength: MODERATE.** IDC is a recognised analyst house, but this is a **blog post, not the research document** — no published methodology or sample size. Treat the *magnitude* (private deployment is a multi-billion-RMB category, not a niche) as supported; treat exact figures as `PARTIALLY VERIFIED`.

### 7.6 Chinese state-affiliated financial press: for central SOEs, "autonomous controllability is a hard requirement"

> "央国企与国计民生息息相关,自主可控是刚需条件。"
> *(Our translation: "Central state-owned enterprises are bound up with the national economy and people's livelihood; autonomous controllability is a **hard requirement**.")*

Source: [自主可控大模型建设见实效 — 第一财经 (Yicai)](https://www.yicai.com/news/102684151.html), 2025-06-23. HTTP 200.

**Evidence strength: MODERATE, and downgraded** — this is promotional soft-news about vendor wins (iFlytek is the protagonist). Its value is the *stated buyer-side norm*, not an independent audit.

### 7.7 The offline niche already has established players — a risk finding as much as an opportunity

> "Tabby is a self-hosted AI coding assistant, offering an open-source and on-premises alternative to GitHub Copilot. … Self-contained, with no need for a DBMS or cloud service."

Source: [TabbyML/tabby README — GitHub](https://github.com/TabbyML/tabby). HTTP 200.

> "Tabnine is the AI coding platform you can deploy anywhere, cloud, on-prem, or air-gapped, while accelerating software development and keeping your code private, secure, and compliant."

Source: [Contact Us | Tabnine (note the URL path: `/contact-us-defense/`)](https://www.tabnine.com/contact-us-defense/). HTTP 200. The page invites a *"private briefing"* on *"mission-critical software delivery."*

**Evidence strength: MODERATE as demand signal, WEAK on specifics.** Both are vendor marketing — they prove *positioning*, not volume, and **neither names an air-gapped customer**. But the positioning is informative: **the offline niche already has at least two established players marketing into it, one of them via a dedicated defence page.** Fieldguide should assume it is entering an occupied niche, not creating one.

**Also:** Continue ships a doc titled *"How to Run Continue Without Internet"* instructing users to disable telemetry to run offline — [docs.continue.dev](https://docs.continue.dev/guides/running-continue-without-internet). HTTP 200. Evidence that air-gapped operation is a **supported, mainstream workflow**, and simultaneously that telemetry must be disabled for it to be true.

### 7.8 US defence contractors handling CUI must treat an AI tool as a cloud service and an external system

> "DFARS 252.204-7012 sets the bar for cloud services. … the contractor "shall require and ensure" that the provider meets security requirements equivalent to the FedRAMP Moderate baseline. **If CUI can reach the prompt, then the service is subject to this requirement.**"

> "Under NIST 800-171 Rev 2 … requirement 3.1.20 requires organizations to "verify and control/limit connections to and use of external systems." … an AI tool is never a simple productivity add-on."

Source: [AI Governance for CMMC Level 2: Can You Use AI Tools in a CUI Environment? — Secureframe](https://secureframe.com/blog/cmmc-level-2-ai-governance), 2026-09-01. HTTP 200.

**Evidence strength: MODERATE, explicitly downgraded.** Secureframe sells compliance automation — an interested party — and this is a *guide*, not a regulator. It is included only because it quotes checkable clause numbers and states the operationally decisive inference: **if CUI can reach the prompt, the service is in scope.** We could **not** fetch the primary DFARS text (acquisition.gov TLS failure), so treat the clause quotations as `UNVERIFIED against primary`.

### 7.9 The on-prem question is being asked in public forums about a *Google* product

From the CodeWiki thread:

> "Will it be possible to document private repositories? And how can we prevent Google from using the code to train its AI? Does anyone know of any trustworthy, usable alternatives? Perhaps even ones that run **100% on-premises**?"

Source: [HN 45930139](https://news.ycombinator.com/item?id=45930139), `ThomasMidgley`, 2025-11-14, in [story 45926350 — 101 pts](https://news.ycombinator.com/item?id=45926350).

**This is a top-of-thread question on a Google product launch** — the demand is not hypothetical.

---

## Adjacent signal worth acting on: demand for *architecture structure*, separate from AI

Not one of the seven, but it is the strongest product-shaped signal we found and it bears directly on the PM's "too ordinary" concern.

**Show HN: Tach — Visualize and untangle your Python codebase: 263 points / 62 comments** ([story 43174041](https://news.ycombinator.com/item?id=43174041), 2025-02-25). The sharpest critique in that thread:

> "I've been surprised that there hasn't been much progress in code tracing. It's incredibly hard to jump into a new code base. Cscope and ctags are still used but uncommon. It's not common to see people use debuggers. … as code bases have exploded we still haven't gotten much better than where [we were]"

— [HN 43189517](https://news.ycombinator.com/item?id=43189517), `godelski`, 2025-02-26.

Note the same thread's "everything local!" argument — *"Since you're being somewhat brigaded by the "everything local!" mob…"* ([HN 43193696](https://news.ycombinator.com/item?id=43193696)) — and that the maintainer had to point out *"The external network requests are optional. It can run fully locally"* ([HN 43194110](https://news.ycombinator.com/item?id=43194110), `nikisweeting`). **A 263-point thread where the community's loudest objection was "why does this phone home?"** is a demand signal for local-first architecture in exactly this category.

**Interpretation:** there is demonstrated, high-engagement appetite for *structural understanding of a codebase* as a product in its own right — independent of the LLM, and with a visible local-first constituency. That is a reasonable answer to "too single-feature": the architecture/layer views may be a stronger hook than the Q&A coach, not a supporting feature.

---

## Gap summary table

| Gap | Who suffers | Current workaround | Evidence strength | Source |
|---|---|---|---|---|
| **LLM repo explanations are ungrounded and confidently wrong** — 31.63% of annotated code summaries contain a hallucination | Newcomers to a codebase; OSS maintainers; teams onboarding juniors | Manual verification against source; vendor tells you to "double check with the source" | **STRONG** — measured rate (n=411) + 66% top frustration (n≈33,662) + 4 independent expert debunkings + vendor admission | [ACL 2025 / arXiv:2410.14748](https://arxiv.org/abs/2410.14748); [SO 2025](https://survey.stackoverflow.co/2025/ai); [HN 45020628](https://news.ycombinator.com/item?id=45020628), [45023074](https://news.ycombinator.com/item?id=45023074), [43799251](https://news.ycombinator.com/item?id=43799251) |
| **The "why" of code is not recoverable from code** — needs history, issues, intent | Anyone maintaining code they didn't write | `git log`, `git blame`, issue archaeology, asking the author | **MODERATE** — practitioner testimony, no measurement | [HN 45433114](https://news.ycombinator.com/item?id=45433114) |
| **Long context does not work uniformly** — degradation is architectural, not a capacity limit | Everyone using cloud LLMs on real repos | Start new sessions; compact; sub-agents; "drag the right files in" | **STRONG** — 18 models measured + TACL paper | [Chroma Context Rot](https://research.trychroma.com/context-rot); [arXiv:2307.03172](https://arxiv.org/abs/2307.03172) |
| **Repo-scale code retrieval is unreliable on both sides** | Anyone expecting RAG-over-repo to work | Manual file selection; grep/ripgrep | **STRONG** — NAACL 2025, 10 retrievers × 10 LMs | [CodeRAG-Bench](https://aclanthology.org/2025.findings-naacl.176/) |
| **Cloud-only AI is blocked or banned in regulated and defence contexts** — 27% outright bans, 61% tool restrictions | Enterprise devs in finance/gov/defence; contractors handling CUI | Local vLLM boxes; Copilot Enterprise geo-pinning at +10%; going without | **STRONG for existence; MODERATE for prevalence** | [Cisco n=2,600](https://newsroom.cisco.com/c/r/newsroom/en/us/a/y2024/m01/organizations-ban-use-of-generative-ai-over-data-privacy-security-cisco-study.html); [HN 42097778](https://news.ycombinator.com/item?id=42097778); [vscode#310143](https://github.com/microsoft/vscode/issues/310143) |
| **AI privacy concerns are now majority-held, not niche** | All developers using agents | Opt-outs, enterprise carve-outs, "Privacy Mode" contracts | **STRONG** — 81% privacy concern, n≈33,662 | [SO 2025](https://survey.stackoverflow.co/2025/ai) |
| **Even a user-supplied API key still transits the vendor** | Devs who think BYO-key = private | Accept the contract, or self-host | **STRONG** — vendor's own docs | [Cursor Data Use](https://cursor.com/en/data-use) |
| **Onboarding takes 6–12 months, not weeks** | New hires, especially on legacy/large codebases | Senior-dev mentoring; months of low output | **STRONG** — FSE 2010 (4 projects, 35 interviews); ICSE 2021 3–9 months (n=189/37) | [Zhou & Mockus FSE 2010](http://www.mockus.org/papers/fluency.pdf); [arXiv:2103.05055](https://arxiv.org/abs/2103.05055) |
| **The famous "3–6 months" number is unsourced folklore** | Anyone citing it (including us, if we weren't careful) | — | **STRONG negative finding** — Stripe report fully excluded (0 hits for "onboard" in 114,010 chars); Plug and Play survey appears not to exist | see §4.17 |
| **Docs rot measurably; the wiki is a second copy of the truth** | Everyone; worst for newcomers | Grep the code, ask in Slack, manually verify every doc | **STRONG** — 23.0% of 356 repos stale; ~700K review comments; GitLab candid admission | [arXiv:2606.09090](https://arxiv.org/abs/2606.09090); [arXiv:2204.00107](https://arxiv.org/abs/2204.00107); [GitLab handbook](https://handbook.gitlab.com/handbook/company/culture/all-remote/handbook-first/) |
| **Updated documentation is the #1 named onboarding lever** | New hires | Mentoring; tribal knowledge | **STRONG** — 90% of N=189 (Microsoft ICSE 2021) | [arXiv:2103.05055](https://arxiv.org/abs/2103.05055) |
| **Onboarding advice does not transfer between codebases** | Teams reusing generic playbooks | Trial and error per repo | **STRONG** — 1,155 projects; 4/15 recommendations negatively associated | [arXiv:2407.04159](https://arxiv.org/abs/2407.04159) |
| **Generated repo wikis are shallow, mis-prioritised, and non-deterministic** | Users trying to learn a repo | Read the source; ask an LLM ad hoc | **STRONG for the category complaint** | [HN 45020036](https://news.ycombinator.com/item?id=45020036), [45938831](https://news.ycombinator.com/item?id=45938831), [45932333](https://news.ycombinator.com/item?id=45932333) |
| **Users prefer interactive Q&A over generated static docs** | Tool builders betting on the wiki artifact | Claude Code / chat instead | **MODERATE** — repeated in DeepWiki and CodeWiki threads | [HN 45021450](https://news.ycombinator.com/item?id=45021450), [45932333](https://news.ycombinator.com/item?id=45932333) |
| **Uninvited generation on public repos creates maintainer hostility** | OSS maintainers; the tool's reputation | Takedown requests (no reliable mechanism) | **MODERATE** — several angry voices, 231-pt and 101-pt threads | [HN 45023074](https://news.ycombinator.com/item?id=45023074), [45948278](https://news.ycombinator.com/item?id=45948278) |
| **Knowledge concentration is the norm** — 65% of 133 popular projects have truck factor ≤ 2 | Whole teams; OSS ecosystems | CODEOWNERS (review routing, not knowledge); documentation | **STRONG** — peer-reviewed, developer-validated | [arXiv:1604.06766](https://arxiv.org/abs/1604.06766) |
| **Knowledge loss is not rebuilt** — 89% of 36,000+ projects lost core team; only 27% replaced it | Abandoned projects; downstream users | Nothing systematic | **STRONG** — largest sample in the literature | [arXiv:2412.00313](https://arxiv.org/abs/2412.00313) |
| **Newcomers do not absorb orphaned code — experts do** (81% / 54%, only 16% newcomers) | Teams hoping hiring fixes knowledge loss | Senior devs silently absorb it | **STRONG** (paper peer-reviewed; quote via review) | [It Will Never Work in Theory review, 2021-09-30](https://neverworkintheory.org/2021/09/30/quantifying-and-mitigating-turnover-induced-knowledge-loss.html) |
| **Commit history alone does not capture "who knows what"** | Anyone shipping git-derived ownership metrics | Add code review + meeting signals | **MODERATE** — JetBrains, n=269 survey | [arXiv:2202.01523](https://arxiv.org/abs/2202.01523) |
| **The obvious ownership heuristic is known to be biased** | Naive bus-factor implementations | Better graph algorithms | **MODERATE** — synthetic graphs only | [arXiv:2508.09828](https://arxiv.org/abs/2508.09828) |
| **Government/legacy systems depend on skills that no longer exist** | Governments, citizens, taxpayers | COBOL volunteer appeals | **STRONG** — GAO + CNN | [GAO-23-106821](http://web.archive.org/web/20260824194940/https://www.gao.gov/products/gao-23-106821); [CNN](https://www.cnn.com/2020/04/08/business/coronavirus-cobol-programmers-new-jersey-trnd/index.html) |
| **Offline/air-gapped code understanding is a real, priced requirement** | Defence, gov, finance, Chinese SOEs/banks | Local vLLM boxes, Tabby, Tabnine, Continue; geo-pinned cloud at +10% | **STRONG for regulators/gov; MODERATE for commercial** | [GitHub Changelog](https://github.blog/changelog/2026-04-13-copilot-data-residency-in-us-eu-and-fedramp-compliance-now-available/); [NFRA 金发〔2026〕8号](https://hunan.gov.cn/zqt/zcsd/202606/t20260622_34008933.html); [Reuters/CCB](https://finance.yahoo.com/news/china-construction-bank-says-launched-100655314.html) |
| **The offline niche is already occupied by at least two established vendors** | Fieldguide's go-to-market | (competitive risk) | **MODERATE** — vendor positioning only, no named air-gapped customers | [Tabby](https://github.com/TabbyML/tabby); [Tabnine defense page](https://www.tabnine.com/contact-us-defense/) |
| **Structural/architecture understanding is in demand independent of AI** | Devs on unfamiliar repos | cscope/ctags, IDE call graphs, Sourcegraph search | **MODERATE-to-STRONG as demand signal** | [HN 43174041 — 263 pts](https://news.ycombinator.com/item?id=43174041) |
| **The "explain this repo" category has exits** — Sourcetrail discontinued 2021; CodeSee absorbed 2024 | Tool builders | — | **MODERATE** — Sourcetrail strong; CodeSee `PARTIALLY VERIFIED` | [Sourcetrail](https://en.wikipedia.org/wiki/Sourcetrail); [HN 40361461](https://news.ycombinator.com/item?id=40361461), [42114034](https://news.ycombinator.com/item?id=42114034) |

---

## Where the evidence is WEAK

Explicit gaps, refutations and unverifiable claims. **This section is a finding, not a failure.** Ordered by how much it would change our conclusions if resolved.

### Gaps that materially weaken the pitch

1. **Reddit is entirely absent — HTTP 403 on every attempt.** All four researchers tried `reddit.com/search.json`, subreddit search, and `old.reddit.com` `.json` endpoints, with both custom (`research-bot/0.1`) and browser User-Agents. **Every request returned 403.** So this dossier contains **zero** Reddit threads, scores, or quotes — and r/ExperiencedDevs ("how long to be productive?", "AI gets our architecture wrong") and r/LocalLLaMA ("I can't send code out") are exactly where this evidence lives. **Unfilled, and needs a non-blocked network.**

2. **No named Western enterprise was found publicly stating it runs local models *because* policy forbids cloud.** We searched for this specifically. What exists instead: (a) one anonymous HN comment describing a self-built vLLM box for Swiss IT projects (§3.10); (b) vendor marketing from Tabby/Tabnine with **no named customers** (§7.7); (c) China Construction Bank's "private deployment… internal use only" (§7.4), which is a deployment fact but not an attributed policy quote. **The commercial demand for offline is inferred, not attested.**

3. **Willingness to pay is essentially unmeasured anywhere in this dossier.** Every demand signal is attention (HN points, survey sentiment, thread counts). An upvote is not a budget. We found no pricing, procurement or budget data for this category.

4. **No independent replication of CodeScene's knowledge-map numbers exists.** All CodeScene content is self-published; its papers are authored by its employees. **Treat CodeScene's prevalence claims as marketing.** The peer-reviewed bus-factor literature (Avelino, Nourry, Nassif & Robillard, Jabrayilzade) uses different algorithms and datasets and **does not validate CodeScene's specific outputs.** We also flagged that CodeScene's headline "42% of developers' time" is *borrowed from prior work*, not measured.

5. **The CodeWiki/DeepWiki "maintainer backlash" is not measured.** We have a handful of angry comments on two threads. We found no petition, no measured maintainer survey, and no opt-out statistics. **Do not present this as a movement.**

### Statistics that do not survive tracing (`NO TRACEABLE PRIMARY SOURCE`)

6. **"3–6 months to full productivity"** — no primary source exists. The Plug and Play 2019 survey appears **not to exist**; Stripe's report is **positively excluded** (0 occurrences of "onboard"/"ramp" in 114,010 extracted characters); Tasktop, DORA, DX and Ewerlöf leads all came up empty. The figure mutates (3–6 / 6 / 7–9 / 3–9 months) with no citation anywhere. Full trace in §4.17.

7. **"Cost of replacing an employee = six to nine months' salary" (and the "1.5× salary" variant)** — `NO TRACEABLE PRIMARY SOURCE`. The chain ends at Gallup relaying SHRM without a link, **and the Gallup URL now returns HTTP 404**. Not software-specific. **Do not cite.**

8. **"Median software developer tenure ≈ 2 years"** — `UNVERIFIED` and **actively contradicted** by BLS (4.3 years for computer & mathematical occupations, Jan 2024). **Marketing must not repeat this.**

9. **COBOL folklore:** "COBOL still processes 95% of ATM swipes", "$3 trillion in daily commerce runs on COBOL", "only ~X thousand COBOL programmers left." **None traceable to a primary source.** They appear in vendor content with no origin. Do not use them.

10. **"X% of organisations have banned generative AI"** — the only traceable ban-percentage is **Cisco's 27% (n=2,600)**. Any other circulating figure without a named survey, sample size and fieldwork date should be treated as untraced.

11. **CodeIntelligently claims "Stripe published data showing their median time to first production deploy for new engineers was 2 days"** — **UNVERIFIED and contradicted** by our full-text extraction of the Stripe report.

12. **Brandon Hall Group "over 70%"** and **APQC "~35 days to basic productivity"** — second-hand via a blog; primaries inaccessible. `UNVERIFIED`.

13. **DX (getdx.com) time-to-productivity benchmark** — `UNVERIFIED`. Research index fetched; no qualifying publication identified. ACM Queue DevEx paper returned HTTP 403.

14. **Michael Feathers' famous one-liner, "legacy code is simply code without tests"** — `UNVERIFIED as an exact quote`. The InformIT excerpt we could verify is Chapter 4 ("Seams") and does not contain it. The premise that *Software Engineering at Google* has an "Onboarding" chapter is also **wrong** (ch. 12 is "Unit Testing").

15. **PayScale per-company tenure (Google 1.1 years)** — **no date, no sample size, no methodology**, and a 4× spread vs Microsoft. Unreliable.

### Claims we attempted and could not verify

16. **JPMorgan restricting ChatGPT** — Bloomberg paywalled; CBS News returned HTTP 406. **No claim made.**
17. **Amazon's internal ChatGPT warning; Verizon** — search surfaced only aggregators and slide shows; no primary memo fetched. **No claim made.**
18. **JetBrains State of Developer Ecosystem 2025 privacy/local-model percentages** — page is client-rendered; only qualitative strings extractable. **No claim made.** *(A sibling workstream produced a `_raw-jetbrains.md` artifact that we did not incorporate here.)*
19. **等保 2.0 / MLPS 2.0 primary text** and any authoritative link to LLM deployment choices — only vendor SEO articles. `NO TRACEABLE PRIMARY SOURCE`.
20. **DoD software factories (Platform One, Kessel Run, Army Software Factory) or a DoD CIO memo** with an explicit gen-AI data-handling rule — not located. **No claim made.**
21. **Primary DFARS 252.204-7012 text** — acquisition.gov TLS failure. The clause quotations in §7.8 are `UNVERIFIED against primary` (quoted via a compliance vendor).
22. **GitKraken's CodeSee acquisition** — the gitkraken.com blog post returned **HTTP 403**; the acquisition rests on HN submission titles, so it is `PARTIALLY VERIFIED`.
23. **HN comment upvote counts** — **not obtainable by design.** HN's API exposes `points` for stories only; `points` is null for comments. Every comment-based claim uses the parent story's points as a stated proxy.
24. **HN HTML pages for a subset of comment permalinks returned HTTP 429** during verification (rate-limiting our IP after heavy use). Their existence, exact text, author and date were verified via the **official HN Algolia API** (`https://hn.algolia.com/api/v1/items/<id>`, HTTP 200), and many other HN item pages returned HTTP 200 in the same session. **We believe these links are live; the 429 is throttling, not a dead page — flagged rather than silently passed.**
25. **Swimm quality complaints** — no substantive thread found. `UNVERIFIED`.
26. **Sourcegraph Cody** — only one weak quality complaint found. We could **not** build a Cody complaint corpus, and we note explicitly that the useful "you can't feed the whole codebase" comment ([HN 41714867](https://news.ycombinator.com/item?id=41714867)) is by an ordinary user (`esafak`), **not** a Sourcegraph executive.
27. **Two truck-factor comparative studies are verified as existing but were deliberately left unquoted.** [Ferreira, Valente & Ferreira, "A Comparison of Three Algorithms for Computing Truck Factors", ICPC 2017](https://doi.org/10.1109/ICPC.2017.35) and ["Algorithms for estimating truck factors: a comparative study", Software Quality Journal 2019](https://doi.org/10.1007/s11219-019-09457-2) — DOI, venue and authorship confirmed (both DOIs HTTP 200), but **the sample sizes and divergence figures could not be obtained** (ACM and Springer paywalled; Semantic Scholar returned HTTP 429 on three attempts including backoff). **No numbers are quoted from either paper.** This is flagged rather than silently dropped because it is exactly the kind of gap where an invented figure would survive review. Note also that this pair *disagree on method*, which is itself consistent with §6.6's finding that the field has no consensus bus-factor metric.

### Dropped dead links (chased, not cited)

| URL | Result |
|---|---|
| `https://www.gallup.com/opinion/gallup/234419/why-onboarding-experience-key-retention.aspx` | **404** — also tried a `/workplace/` variant, 404. SHRM turnover figure thus fully unverified |
| `https://codescene.com/whitepapers/code-red` | **404** (guessed path; the real report is the TechDebt 2022 paper) |
| `https://mtov.github.io/Truck-Factor/` | **404** — the 73-point HN story's target is dead; its numbers are `UNVERIFIED` |
| `http://aserg.labsoft.dcc.ufmg.br/truckfactor/index.html` | **404** |
| `https://queue.acm.org/detail.cfm?id=3595878` | **403** |
| `https://proxify.io/articles/why-new-developer-onboarding-costs-are-surprisingly-brutal` | **403** |
| `https://devops.com/documentation-is-dead-long-live-documentation/` | **403** |
| `https://handbook.gitlab.com/handbook/company/culture/all-remote/handbook-first-documentation/` | **404** (correct path used) |
| `https://loke.dev/blog/from-wiki-to-adrs-journey` | **404** |
| `https://blog.thecodewhisperer.com/permalink/working-effectively-with-legacy-code-book-review` | **404** |
| `https://www.cbsnews.com/news/chatgpt-jpmorgan-chase-bars-workers-from-using-ai-tool/` | **406** |
| `https://arstechnica.com/information-technology/2023/05/fearing-leaks-apple-restricts-its-employees-from-using-chatgpt-and-ai-tools/` | **405** |
| `https://www.gitkraken.com/blog/gitkraken-launches-devex-platform-acquires-codesee` | **403** |
| `https://www.bls.gov/news.release/tenure.nr0.htm`, `…/tenure.t06.htm` | **403** (bot block; Wayback snapshots used, both HTTP 200) |
| `https://www.gao.gov/products/gao-23-106821` | **403** (bot block; Wayback snapshot used, HTTP 200) |
| `https://www.reddit.com/search.json`, `…/r/ExperiencedDevs/search.json`, `…/r/LocalLLaMA/search.json` | **403** — entire platform unavailable |
| `https://api.semanticscholar.org/graph/v1/…` | **429** (×3, incl. backoff) — OpenAlex used as substitute |
| `https://ouci.dntb.gov.ua/en/works/4NLEYYO9/` | **502** — would have supplied the Software Quality Journal truck-factor survey abstract (see WEAK §27) |
| `https://www.infoq.com/news/2015/03/code-as-a-crime-scene/` | **405** — not cited; CodeScene's own origin material used instead |
| `http://www.michaelbromley.co.uk/blog/but-what-about-the-bus-factor/` | **200 but nav text only** — not quoted; only its HN story points (65) are reported |
| Bloomberg (JPMorgan), WSJ (Apple memo) | Paywalled — not fetched, not cited |

---

## Verification ledger

**Verified HTTP 200 in this session** (representative, not exhaustive): `aclanthology.org/2025.acl-long.1480/`; `aclanthology.org/2025.findings-naacl.176/`; `arxiv.org/abs/2410.14748`; `arxiv.org/html/2410.14748v4`; `arxiv.org/abs/2307.03172`; `arxiv.org/abs/2103.05055`; `ar5iv.labs.arxiv.org/html/2103.05055`; `arxiv.org/abs/1604.06766`; `arxiv.org/abs/2412.00313`; `arxiv.org/abs/2202.01523`; `arxiv.org/abs/2403.08038`; `arxiv.org/abs/2508.09828`; `arxiv.org/abs/2401.13407`; `arxiv.org/abs/2603.07845`; `arxiv.org/abs/2606.09090`; `arxiv.org/abs/2402.11048`; `arxiv.org/abs/2102.08486`; `arxiv.org/abs/2103.09340`; `arxiv.org/abs/2204.00107`; `arxiv.org/abs/2403.00251`; `arxiv.org/abs/2604.27532`; `arxiv.org/abs/1311.1334`; `arxiv.org/abs/2407.04159`; `arxiv.org/abs/2406.14497` (via ar5iv); `research.trychroma.com/context-rot`; `survey.stackoverflow.co/2025/ai`; `stackoverflow.co/company/press/archive/stack-overflow-2025-developer-survey`; `codemanship.wordpress.com/2025/09/30/…`; `newsroom.cisco.com/…/organizations-ban-use-of-generative-ai-…`; `www.koreaherald.com/article/3118116`; `www.theverge.com/2023/5/19/23729619/…`; `www.ibm.com/think/x-force/2025-cost-of-a-data-breach-navigating-ai`; `github.blog/changelog/2026-04-13-copilot-data-residency-…`; `docs.github.com/en/copilot/concepts/enterprise/fedramp-models`; `docs.github.com/en/copilot/how-tos/manage-your-account/manage-policies`; `github.com/microsoft/vscode/issues/310143`; `github.com/microsoft/vscode/issues/244513`; `github.com/orgs/community/discussions/188488`; `cursor.com/en/data-use`; `github.com/TabbyML/tabby`; `tabnine.com/contact-us-defense/`; `docs.continue.dev/guides/running-continue-without-internet`; `hunan.gov.cn/zqt/zcsd/202606/t20260622_34008933.html`; `finance.yahoo.com/news/china-construction-bank-says-launched-100655314.html`; `idc.com/resource-center/blog/token…`; `yicai.com/news/102684151.html`; `mockus.org/papers/fluency.pdf`; `dora.dev/research/2023/dora-report/`; `dora.dev/research/2024/dora-report/`; `cloud.google.com/blog/products/devops-sre/announcing-the-2023-state-of-devops-report`; `abseil.io/resources/swe-book/html/ch03.html`; `abseil.io/resources/swe-book/html/ch10.html`; `handbook.gitlab.com/handbook/company/culture/all-remote/handbook-first/`; `stripe.com/files/reports/the-developer-coefficient.pdf`; `who-t.blogspot.com/2019/10/libinputs-bus-factor-is-1.html`; `wired.com/story/giving-open-source-projects-life-after-a-developers-death/`; `theverge.com/2014/4/27/5658368/…`; `2022.techdebtconf.org/details/TechDebt-2022-papers/2/…`; `docs.enterprise.codescene.io/versions/4.3.11/guides/social/knowledge-distribution.html`; `codescene.io/docs/guides/simulations/offboarding-simulator.html`; `codescene.com/blog/minimize-on-and-off-boarding-risks`; `codescene.com/resources/research-and-insights`; `neverworkintheory.org/2021/09/30/…`; `docs.github.com/…/maintaining-ownership-continuity-…`; `docs.github.com/…/about-code-owners`; `cnn.com/2020/04/08/business/coronavirus-cobol-programmers-new-jersey-trnd/index.html`; `payscale.com/data-packages/employee-loyalty/company-comparison`; `secureframe.com/blog/cmmc-level-2-ai-governance`; `nasdaq.com/press-release/gitlab-survey-…`; `en.wikipedia.org/wiki/Sourcetrail`; `informit.com/articles/article.aspx?p=359417`; Wayback snapshots for BLS `tenure.nr0`/`tenure.t06` and GAO-23-106821 (all 200); plus 14 HN item/comment permalinks returning 200 and all HN Algolia API endpoints. **Additional HN comment metadata (author + date + text) for every quoted comment was re-verified individually via `https://hn.algolia.com/api/v1/items/<id>` (HTTP 200).**

**HN story numbers** (all re-verified via `hn.algolia.com/api/v1/items/<id>`, HTTP 200; "top-level" = direct children, which is fewer than the total comment counts quoted in the body):

| Story | Points | Top-level comments | Date |
|---|---|---|---|
| [I'm Tired of Talking to AI](https://news.ycombinator.com/item?id=48292224) | 2013 | 204 | 2026-05-27 |
| [How to Improve a Legacy Codebase](https://news.ycombinator.com/item?id=14444914) | 653 | 47 | 2017-05-30 |
| [Comprehension debt](https://news.ycombinator.com/item?id=45423917) | 532 | 77 | 2025-09-30 |
| [Show HN: Tach – Visualize and untangle your Python codebase](https://news.ycombinator.com/item?id=43174041) | 263 | 19 | 2025-02-25 |
| [Context Rot](https://news.ycombinator.com/item?id=44564248) | 260 | 17 | 2025-07-14 |
| [DeepWiki: Understand Any Codebase](https://news.ycombinator.com/item?id=45002092) | 231 | 21 | 2025-08-24 |
| [Vibe coding creates a bus factor of zero](https://news.ycombinator.com/item?id=44966856) | 223 | 38 | 2025-08-20 |
| [Ask HN: How to understand the large codebase of an open-source project?](https://news.ycombinator.com/item?id=16299125) | 188 | 35 | 2018-02-03 |
| [Ask HN: How do you manage your companies knowledge base?](https://news.ycombinator.com/item?id=30371723) | 187 | 56 | 2022-02-17 |
| [Libinput's bus factor is 1](https://news.ycombinator.com/item?id=23254871) | 187 | 13 | 2020-05-21 |
| [Ask HN: How do you search large codebases before adding a feature or fixing bug?](https://news.ycombinator.com/item?id=30819579) | 111 | 30 | 2022-03-27 |
| [Google Releases CodeWiki](https://news.ycombinator.com/item?id=45926350) | 101 | 22 | 2025-11-14 |
| [Terminating an employee with a bus factor of 1](https://news.ycombinator.com/item?id=38213424) | 95 | 23 | 2023-11-10 |
| [Show HN: Badge that shows how well your codebase fits in an LLM's context window](https://news.ycombinator.com/item?id=47181471) | 88 | 19 | 2026-02-27 |
| [What Is the Truck Factor of Popular GitHub Applications?](https://news.ycombinator.com/item?id=9874503) | 73 | 12 | 2015-07-12 |
| [But what about the bus factor?](https://news.ycombinator.com/item?id=29416674) | 65 | 11 | 2021-12-02 |
| [Ask HN: How To: Internal Documentation?](https://news.ycombinator.com/item?id=41415619) | 50 | 27 | 2024-09-01 |
| [Ask HN: What is the bus factor at your company?](https://news.ycombinator.com/item?id=12707857) | 26 | 11 | 2016-10-14 |

---

## What this means for the "too single-feature / too ordinary" worry

Stated as findings, not recommendations:

1. **The strongest pain point is not "AI is wrong" — it is "almost right, but not quite" (66%, n≈33,662) combined with "I can't verify it."** The vendor's own mitigation for the deep-repo-wiki category is *"we show you the code snippets so you can double check."* A product whose explanation is *structurally* tied to a graph, with every claim traceable to a node, is answering the measured #1 frustration rather than a hypothetical one.

2. **The 532-point "comprehension debt" and 2013-point "I'm Tired of Talking to AI" threads are the two highest-engagement items found**, and both point the same direction: the scarce resource is *understanding*, not *generation*. The sharpest supporting quote is a user's: *"Almost all of the value that I'm getting out of LLMs is when it helps me understand something, as opposed to when it helps me produce something."* ([HN 45430691](https://news.ycombinator.com/item?id=45430691), `roncesvalles`, 2025-09-30).

3. **Two of Fieldguide's surfaces have independent evidence of demand, and two do not.** Architecture/layer views: 263-point Tach thread and a visible local-first constituency. Q&A grounded in a graph: measured against the 66% "almost right" frustration and CodeRAG-Bench's finding that retrieval over code is the bottleneck. **Progress tracking, spaced repetition and interview questions have no evidence in this dossier** — we were not tasked with them and found nothing incidentally. The arXiv-paper-to-code bridge likewise has no evidence here.

4. **The most defensible differentiators per the evidence are (a) ground-truth traceability, (b) local-first/air-gapped operation, and (c) durability of the artifact** — because the CodeWiki thread's sharpest complaint is that regenerated content *"the next day… is completely different"*, and P4 shows a stable, maintained, owned document is the single named onboarding lever (90% of n=189). That is a real gap: nobody in the surveyed set has both **grounded** and **stable**.

5. **The counter-evidence to state plainly:** some argue context limits are transient ([HN 47182073](https://news.ycombinator.com/item?id=47182073)); Swimm, Cody and CodeSee evidence is thin or absent; CodeScene's numbers are unreplicated vendor content; and the offline niche already has Tabby and Tabnine marketing into it. Reddit — the most obvious source of raw user pain — was unreachable, so **the qualitative base here is HN-heavy** and should be treated as such.
