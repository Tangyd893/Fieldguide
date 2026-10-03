# Market Evidence: Is "codebase onboarding / comprehension" a willingness-to-pay market?

**Research date:** 2026 (page fetches verified live at time of writing)
**Method:** Primary-source retrieval via HTTP (`Invoke-WebRequest`). Every statistic below is tied to a URL that was actually fetched and whose HTTP status was verified. Where the Stack Overflow survey site embeds its full dataset as JSON, numbers were extracted from that embedded dataset, not from prose summaries.

**Reading conventions used throughout:**
- `PRIMARY` = retrieved from the publishing organisation's own page/report/dataset.
- `SECONDARY` = retrieved from a third party quoting the original.
- `VENDOR` = published by a company selling a product in the affected category — treat as self-interested.
- `UNVERIFIED` = could not be traced to a fetched source.

---

## 1. Time split: understanding existing code vs writing new code

### 1.1 The "58%" claim traces to a real, serious primary study — not folklore

The widely-miscited "~58% of developer time goes to program comprehension" figure traces to:

> **Xia, X., Bao, L., Lo, D., Xing, Z., Hassan, A. E., Li, S. — "Measuring Program Comprehension: A Large-Scale Field Study with Professionals."** *IEEE Transactions on Software Engineering*, vol. 44, pp. 951–976, 2018. Also published at **ICSE 2018** (DOI `10.1109/TSE.2017.2734091`; ICSE DOI `10.1145/3180155.3182538`).
> Verified abstract retrieved from the Semantic Scholar API record `https://api.semanticscholar.org/graph/v1/paper/DOI:10.1145/3180155.3182538` (200 OK). Landing pages verified: [IEEE Xplore 7997917](https://ieeexplore.ieee.org/document/7997917) (202, IEEE serves 202 to automated HEAD), [IEEE Computer Society CSDL](https://www.computer.org/csdl/proceedings-article/icse/2018/563801a584/13l5NWM1Hsv) (200).

**Exact finding, quoted verbatim from the abstract:**
> "Our study finds that on average developers spend **~ 58 percent** of their time on program comprehension activities, and that they frequently use web browsers and document editors to perform program comprehension activities."

**Methodology — this is NOT a survey and NOT a study of one developer:**
- Instrumented **cross-application** Human-Computer Interaction (HCI) telemetry, via the authors' `ActivitySpace` framework. Critically, it captures activity **outside the IDE** (browsers, document editors) — the abstract notes prior work "investigate[s] the program comprehension activities only within the IDEs."
- Activity classification into four categories — **navigation, editing, comprehension, other** — "follow[ing] Minelli et al.'s approach."
- **Sample: 7 real projects, 78 professional developers, 3,148 working hours.**
- It is a **field study** of practitioners in situ, not a lab experiment.

**Two secondary findings from the same abstract that matter commercially:**
> "senior developers spend significantly less percentages of time on program comprehension than junior developers."
(So the pain is concentrated in junior/onboarding developers — the exact cohort Fieldguide targets.)

**What the paper itself says about earlier "half of a developer's time" claims:**
> "Previous studies show that program comprehension takes up as much as half of a developer's time. However, most of these studies are performed in a controlled setting, or with a small number of participants."
This is the authors' own admission that the *pre-2018* literature was small and lab-bound. It also means the **older** "58%"/"50%" citations floating around (often attributed loosely to 1990s maintenance studies) are *not* the robust source — Xia et al. 2018 is, and it superseded them.

**Methodology ancestor:** Minelli, Mocci, Lanza — "I Know What You Did Last Summer — An Investigation of How Developers Spend Their Time," ICPC 2015 ([IEEE Xplore 7181430](https://ieeexplore.ieee.org/document/7181430), 202). It supplied the navigation/editing/comprehension taxonomy Xia et al. reused. *I could not retrieve this paper's numeric time split* — Semantic Scholar rate-limited (HTTP 429) and IEEE abstracts are not machine-readable here. Its exact percentages are `UNVERIFIED` in this document.

### 1.2 Important caveat on what "58%" actually measures

A critical secondary reading of the paper's tables states:

> "Comprehension took on average ~58%. In particular, take a look at the third column in the table: it says **Navigation accounts for 24% of the effort, and that is considered separately from the Comprehension effort!** ... comprehension is essentially measured as reading! The two are considered as mostly synonymous."
> — feenk (makers of Glamorous Toolkit), "Developers spend most of their time figuring the system out," via [Wayback Machine capture 2025-01-21](https://web.archive.org/web/20250121071040/https://lepiter.io/feenk/developers-spend-most-of-their-time-figuri-9q25taswlbzjc5rsufndeu0py/) (200 OK). **`SECONDARY` + `VENDOR`** — feenk sells a development environment positioned as the fix for exactly this problem.

**Implication if accurate:** "figuring out the system" = comprehension (~58%) **+** navigation (~24%) ≈ **82%** of time, with comprehension operationalised largely as *reading*. This makes the addressable slice of the problem *larger* than the headline number suggests. However, I could **not independently verify the 24% navigation figure** because the TSE paper's tables are paywalled (`dl.acm.org` returned **403** to automated requests — ACM blocks bots; the DOI is valid, only machine access failed). Treat "82%" as a **secondary, vendor-authored** reading, not a primary figure.

### 1.3 Citation lineage — who actually owns the "58%" number (and who does not)

The brief for this research guessed the 58% claim "goes back to work by Robert Fjeldstad / Jonathan Sillito / Thomas Ball & colleagues, ~1999–2009, and is widely miscited." The evidence says the guess is **partly wrong**, and it is worth correcting explicitly because the miscitation is the reason the number keeps getting doubted:

| Attribution | Verdict |
|---|---|
| **Xia, Bao, Lo, Xing, Hassan, Li (2018), *IEEE TSE*** | ✅ **This is the real source of "~58%."** Verified via publisher abstract. |
| **Thomas Ball** | ❌ **Not an author of the 58% study.** The author list is Xia, Bao, Lo, Xing, Hassan, Li. No Ball. Ball's well-known work is on software analytics/mining repositories — different lineage. |
| **Jonathan Sillito (2008)** | ⚠️ **Real paper, but the wrong kind of study for a time-share claim.** Sillito, Murphy & De Volder, *"Asking and Answering Questions during a Programming Change Task,"* IEEE TSE 34(4):434–451, 2008 — verified via Semantic Scholar (349 citations; DOI `10.1109/TSE.2008.26`). It is a **qualitative taxonomy of the questions programmers ask** during change tasks, not an instrumented measurement of time allocation. It supplies the *vocabulary* for what developers don't understand, not a percentage. Its sample size and design are **`UNVERIFIED`** here: the publisher elided the abstract from the API record, and the "open access" UBC link resolved to a 4.9 KB **HTML** page, not a PDF. |
| **Minelli, Mocci & Lanza (2015), ICPC** | ✅ Real, and structurally important: it supplied the **navigation / editing / comprehension / other** activity taxonomy that Xia et al. explicitly reused. Its own numeric time split is `UNVERIFIED` (IEEE abstract not machine-readable; Semantic Scholar rate-limited at HTTP 429). |
| **Fjeldstad & Hamlen (1983) / von Mayrhauser "half of a developer's time"** | ❌ **`UNVERIFIED` — could not trace to a primary source.** Searches surfaced only downstream citations, never the original measurement with a sample size. Treat any "studies since 1983 show…" framing as unsupported. Xia et al. themselves only say "Previous studies show that program comprehension takes up as much as half of a developer's time... most of these studies are performed in a controlled setting, or with a small number of participants" — i.e. they decline to cite one authoritative predecessor either. |

**Bottom line for the PM:** the 58% number is **not** folklore and **not** a study of one developer — it is a 78-developer, 3,148-hour cross-application field study from 2018. But it is **commonly mis-attributed** to Sillito/Fjeldstad/Ball, and those attributions do not survive checking. Cite Xia et al. 2018 or cite nothing.

---



### 1.4 Is 58% still defensible in 2024–2025? And has AI shifted the ratio?

**Honest bottom line: there is NO post-2023 study that re-measures the 58% split at comparable scale.** I searched for one and did not find one. Anyone citing a modern equivalent number is almost certainly re-citing Xia et al. 2018. The 58% figure remains the best available large-sample estimate, but it is **pre-generative-AI data** and should be cited with its 2018 vintage attached.

**What the AI-era evidence does show — and it points toward MORE comprehension/review load, not less:**

**(a) Peer-review-stage research (academic, primary):**
> **Xu, F., Medappa, P. K., Tunc, M. M., Vroegindeweij, M., Fransoo, J. C. — "AI-Assisted Programming Decreases the Productivity of Experienced Developers by Increasing the Technical Debt and Maintenance Burden."** arXiv [`2510.10165`](https://arxiv.org/abs/2510.10165) (verified 200; abstract retrieved via the arXiv API; presented at WITS 2025, CIST 2025, SCECR 2025, INFORMS 2024).
> Verbatim: "the added rework burden falls on the more experienced (core) developers, who **review 6.5% more code** after Copilot's introduction, but show a **19% drop in their original code productivity**."
> Also: "the increase in productivity is primarily driven by less-experienced (peripheral) developers"; "code written after the adoption of AI requires more rework to satisfy repository standards."

This is the single strongest quantified argument that **AI shifts senior-developer time from writing to reviewing/understanding**. It is OSS-repository activity analysis.

**(b) Large-scale economic evidence — AI multiplies code output but the gain dies at the shipping bottleneck (NBER, primary):**
> **Demirer, M., Musolff, L., Yang, L. — "Writing Code vs. Shipping Code: Productivity Effects Across Generations of AI Coding Tools."** NBER Working Paper **35275** (2026), DOI `10.3386/w35275`. [nber.org/papers/w35275](https://www.nber.org/papers/w35275) (200 OK; abstract retrieved).
> Verbatim: "using data on **more than 500,000 GitHub developers** combined with their AI usage telemetry. In a matched event study design, we find that autocomplete, interactive coding agents, and autonomous coding agents each significantly increase coding activity ('commits'), with respective cumulative effects of **30%, 180%, and 240%**. These gains, however, **attenuate sharply across the production hierarchy**: the 240% cumulative effect falls to **80% for the number of projects, and to 30% for actual releases.**"
> Also: "an estimated **elasticity of substitution of 0.23** between AI and human effort, which indicates **strong complementarities**"; and across four software marketplaces, "a sharp increase in the number of new apps but **no increase in total usage**."

**Why this matters for Fieldguide:** at 500,000+ developers this is the largest-sample evidence found in this entire research. It shows AI inflates *code production* 2–8×, but that output is throttled ~8× before it ships, with human effort a strong complement (elasticity 0.23) rather than a substitute. The constraint is therefore **human review/validation/understanding capacity** — not code generation. That is the structural argument for a comprehension tool. **Conflict-of-interest disclosure:** the NBER page states Mert Demirer and Leon Musolff "previously held a postdoctoral research position at Microsoft and now work as a paid research consultant for the company." Treat the direction of the finding as robust, the framing as industry-adjacent.

**(c) Practitioner-scale survey evidence (Stack Overflow, see §2):**
- **65.98%** (n=31,476) call "AI solutions that are almost right, but not quite" their **top** frustration (SO 2025).
- **45.22%** say "debugging AI-generated code is more time-consuming."
- **16.32%** explicitly say "it's hard to understand how or why the code works."
- **63.3%** of all respondents / **64.6%** of professional developers said AI tools **"lack context of [their] codebase"** (SO 2024, n=30,661).
- **66.2%** said they **"don't trust the output or answers"** (SO 2024).
- Only **30.9%** currently use AI for **"learning about a codebase,"** while **40.6%** are *interested* in doing so (SO 2024, n=35,978). Note this +9.7 pt gap is **smaller** than those for code review (+27.7 pt) and testing (+19.0 pt) — cite it as an under-served area, not as the largest gap.

**(d) 81% "more time in code review" claim — VENDOR, flag it:**
> "Around **81%** said they spend more time in code reviews since before the adoption of AI tools... More than one-quarter (**28%**) reported spending **30% longer** on these tasks on average."
> — [ITPro](https://www.itpro.com/software/development/ai-might-help-speed-up-software-development-but-81-percent-of-devs-now-spend-more-time-reviewing-code-and-its-creating-an-invisible-work-trend-thats-pushing-teams-to-the-limit) (200 OK), reporting research by **Harness**, a commercial CI/CD vendor. **`VENDOR` + `SECONDARY`.** I could **not** locate the Harness report's methodology page or sample size — the number is directional only and should not be quoted as independent evidence without that.

**Net verdict for §1:** The 58% figure is **traceable, primary, and methodologically respectable** (78 devs / 3,148 hours / cross-application telemetry) — so the "understanding code is a huge slice of developer time" premise is *defensible*. It is **not** defensible as a precise 2025 number, and it was **not** originally a study of one developer or an IDE-only telemetry capture. Separately, the AI-era evidence (6.5% more review for core devs; 66% frustrated by almost-right code; 64.6% saying AI lacks codebase context) supports the thesis that **comprehension and review load is rising, not falling**, which is directionally favourable to Fieldguide.

---

## 2. Stack Overflow Developer Survey (2024 and 2025)

Both editions are fully server-rendered; the official results site embeds the **entire dataset as inline JSON**, so the numbers below are extracted from the published dataset objects (question IDs shown), not from prose or press summaries.

### 2.1 Sample sizes and methodology

| Edition | Sample size | Countries | Source |
|---|---|---|---|
| 2024 | **65,437 responses** | 185 | [survey.stackoverflow.co/2024/methodology](https://survey.stackoverflow.co/2024/methodology) (200) |
| 2025 | **49,009 responses**; landing page says "over 49,000+" (15th year; 62 questions; 314 technologies) | 177 | [survey.stackoverflow.co/2025/methodology](https://survey.stackoverflow.co/2025/methodology) (200) for the exact 49,009; [survey.stackoverflow.co/2025/](https://survey.stackoverflow.co/2025/) (200) for the round figure |

**Recruitment bias (stated by Stack Overflow itself, 2024 methodology, verbatim):**
> "Respondents were recruited primarily through channels owned by Stack Overflow... Since respondents were recruited in this way, highly-engaged users on Stack Overflow were more likely to notice the prompts to take the survey."

This is a **self-selected, Stack-Overflow-engaged sample**, not a random sample of developers. It is the standard caveat on every figure below.

Note: per-question response counts are much lower than the headline totals (typically 24,000–36,000), because questions were optional and some were gated. Per-statistic `n` is given below.

### 2.2 The "almost right, but not quite" figure — FOUND, with a discrepancy worth knowing

**Primary dataset — SO 2025, question `AIFrustration`, n = 31,476** ([survey.stackoverflow.co/2025/ai](https://survey.stackoverflow.co/2025/ai), 200):
Question: *"When using AI tools, which of the following problems or frustrations have you encountered? Select all that apply."*

| Frustration | % | Count |
|---|---|---|
| **AI solutions that are almost right, but not quite** | **65.98%** | 20,768 |
| Debugging AI-generated code is more time-consuming | 45.22% | 14,232 |
| I don't use AI tools regularly | 23.54% | 7,409 |
| I've become less confident in my own problem-solving | 20.04% | 6,307 |
| **It's hard to understand how or why the code works** | **16.32%** | 5,136 |
| Other (write in) | 11.61% | 3,655 |
| I haven't encountered any problems | 3.96% | 1,245 |

**⚠️ Discrepancy flagged — the official blog post appears to have swapped two labels.** The [official Stack Overflow blog post](https://stackoverflow.blog/2025/12/29/developers-remain-willing-but-reluctant-to-use-ai-the-2025-developer-survey-results-are-here/) (200) states:
> "The number-one frustration, cited by **45%** of respondents, is dealing with 'AI solutions that are almost right, but not quite'... In fact, **66%** of developers say they are spending more time fixing 'almost-right' AI-generated code."

But the **published dataset** attaches **65.98% to "almost right, but not quite"** and **45.22% to "debugging AI-generated code is more time-consuming."** Both figures are real; the *labels* are reversed between the blog prose and the dataset. Press coverage (e.g. ADMIN Magazine's headline "66% of Developers Frustrated by AI Inaccuracy") inherits this ambiguity.

**Recommendation: cite 66% (65.98%, n=31,476) as the share naming "almost right, but not quite" as a frustration, sourced to the dataset, and cite 45% for the "debugging is more time-consuming" item.** This is the single most useful statistic for Fieldguide's positioning: the #1 AI complaint is *almost-right code that costs more time to verify than to have written* — which is precisely a comprehension problem.

Also note the item **"It's hard to understand how or why the code works" (16.32%)** — a direct, self-reported measurement of comprehension failure, and the closest thing to a modern comprehension metric in a large survey.

### 2.3 AI usage, trust, and the direction of travel

**SO 2024** ([survey.stackoverflow.co/2024/ai](https://survey.stackoverflow.co/2024/ai), 200):

| Metric | Value | n |
|---|---|---|
| Using or planning to use AI tools | 76% (up from 70%) | — |
| Currently using AI tools | 62% (vs 44% prior year) | 60,907 |
| Favorable / very favorable toward AI tools | 72% (down from 77%) | 45,873 |
| Trust AI output (highly + somewhat) | 43% (2.7% + 40.3%) | 37,302 |
| Distrust AI output (somewhat + highly) | 30.4% (22.5% + 7.9%) | 37,302 |
| Professional devs: AI bad/very bad at complex tasks | 44.8% (32.3% + 12.5%) | 28,645 |
| **AI tools "lack context of [my] codebase"** | **63.3% all / 64.6% professional** | 30,661 / 24,496 |
| "Don't trust the output or answers" | 66.2% all / 66.1% professional | 30,661 / 24,496 |
| "They create more work" | 12.9% all / 12.0% professional | 30,661 / 24,496 |

**AI use by workflow step (SO 2024, n = 35,978) — the codebase-learning gap:**

| Workflow step | Currently using | **Interested in using** | Not interested |
|---|---|---|---|
| Writing code | 82% | 9.2% | 5.9% |
| Search for answers | 67.5% | 17.6% | 8.1% |
| Debugging and getting help | 56.7% | 25.9% | 9.1% |
| Documenting code | 40.1% | 38.2% | 12.7% |
| **Learning about a codebase** | **30.9%** | **40.6%** | 18.7% |
| Testing code | 27.2% | 46.2% | 17.1% |
| Committing and reviewing code | 13.2% | 40.9% | 32.9% |

**Accurate reading of this table (corrected — do not overclaim):** "Learning about a codebase" is one of the **least-automated core engineering steps** at **30.9% current adoption**, and has a **+9.7 pt interest gap** (40.6% − 30.9%). But it does **not** have the largest gap: "Committing and reviewing code" has a **+27.7 pt** gap (13.2% → 40.9%) and "Testing code" **+19.0 pt** (27.2% → 46.2%). "Learning about a codebase" also carries the **highest explicit disinterest** of these steps at **18.7%**. The defensible claim is therefore: *codebase learning is a large, under-tooled slice of developer activity that a substantial minority actively want help with* — not that it is the single biggest demand signal. **This is the closest thing to a category-level demand signal found in this research; it is suggestive, not conclusive.**

**SO 2025** ([survey.stackoverflow.co/2025/ai](https://survey.stackoverflow.co/2025/ai), 200):

| Metric | Value | n | Source of record |
|---|---|---|---|
| Using or planning to use AI tools | 84% (up from 76%) | — | survey landing page |
| Using AI tools (daily + weekly + monthly) | 78.5% of which 47.09% **daily** | 33,662 | dataset `AISelect` |
| Professional devs using AI **daily** | 50.62% | 26,004 | dataset `AISel_prof` |
| "No, and I don't plan to" | 16.19% | 33,662 | dataset `AISelect` |
| Trust AI output (highly + somewhat) | 32.8% (3.13% + 29.64%) | 33,244 | dataset `AIAcc` |
| Distrust AI output (somewhat + highly) | 45.7% (26.08% + 19.63%) | 33,244 | dataset `AIAcc` |
| Would ask another **person** when they don't trust AI | 75% | — | blog post |
| Learned new techniques/language in past year | 69% (44% used AI tools, up from 37%) | — | blog post |
| Do **not** see AI as a job threat | 64% (down from 68%) | — | blog post |
| Say "vibe coding" is not part of professional work | 72% (+5% emphatic) | 26,564 | blog post / dataset `AIExplain` |
| Stack Overflow visits prompted by AI-related issues | 35% | — | blog post |

**⚠️ Second discrepancy flagged.** The blog post says "trust in the accuracy of AI has fallen from 40% in previous years to just **29%** this year." My computed all-options trust figure from dataset `AIAcc` is **32.8%** (3.13% + 29.64%). The blog's 29% corresponds to the **"Somewhat trust" option alone** (2024: 40.3% → 2025: 29.64%), not to the combined trust figure. Likewise the blog's "80% of developers now using them in their workflows" differs from the landing page's "84% using or planning to use." **Both blog and dataset numbers are cited above so the reader can see the seam.**

### 2.4 Onboarding specifically

Neither the 2024 nor the 2025 Stack Overflow survey contains a dedicated onboarding-time or "time to first productive commit" question as far as I could determine from the published question list (`qname` inventory extracted from the 2025 dataset: no onboarding-specific question). The nearest proxies are "Learning about a codebase" (use of AI for it) and "Speed up learning" as an expected AI benefit (**62.4%** of all respondents; **71%** for those learning to code vs **61%** for professional developers, SO 2024, n=36,894). **Onboarding time itself is not measured by Stack Overflow** — a notable evidence gap.

**Learning signals relevant to §7 (interview-prep / learning budgets), all from SO 2025** ([blog post](https://stackoverflow.blog/2025/12/29/developers-remain-willing-but-reluctant-to-use-ai-the-2025-developer-survey-results-are-here/) and [landing page](https://survey.stackoverflow.co/2025/), both 200):

| Metric | Value |
|---|---|
| Spent time in the last year learning new coding techniques or a new language | **69%** |
| Of those, learned with the help of AI-enabled tools | **44%** (up from 37% in 2024) |
| Learned to code specifically for AI in the last year | **36%** |
| Learning to code for AI in the workplace or on personal projects | **67%** |
| Learning to code for AI-enabled tools for their job / career | **"Over 36%"** |
| Not looking for a new job | 46% (but 75% of those in a role are "complacent" or "not happy at work") |
| Community platforms used: Stack Overflow / GitHub / YouTube | 84% / 67% / 61% |

**Interpretation for Fieldguide's SRS half:** ~69% of developers self-report *ongoing* learning activity, and roughly two-thirds of learning is now AI-assisted. That is a large population doing continuous learning — but note that Stack Overflow measures **time spent learning, not money spent**. **It contains no question about out-of-pocket spending on courses, books, or interview prep.** So this survey supports "developers invest time in learning" and **cannot** support any claim about their willingness to *pay*. Do not use these figures as a spending proxy.

---

## 3. JetBrains State of Developer Ecosystem / Developer Experience

*(Full tables, distributions and reproduction steps in `_raw-jetbrains.md`. **JetBrains is a `VENDOR`** — it sells IDEs and AI coding tools — so all figures are self-interested. **Strong methodological note: the researcher downloaded JetBrains' own respondent-level microdata (CC BY 4.0) for 2024 and 2025 and recomputed figures using JetBrains' `weight` column**, validating the method by reproducing JetBrains' published "66%" metric-distrust figure at 66.2%.)*

### 3.1 Sample sizes — verified, and the brief's assumption was wrong

| Year | Verified sample size | Scope |
|---|---|---|
| 2023 | **26,348** | 196 countries/regions, 544 questions |
| 2024 | **23,262** | 171 countries/regions, 672 questions |
| 2025 | **24,534** | 194 countries/regions, 585 questions |
| DXDP (2024+2025 pooled) | "over **6,000** developers and **2,000** technical decision makers"; "**between 146 and 6,144** responses to each question" | The State of Developer Experience & Productivity report |

**Correction:** the brief guessed "~26,000 for 2023 and similar for 2024." Verified: 2023 = 26,348, but **2024 = 23,262 — materially lower**. Row-count cross-check confirmed both (2025 CSV = 24,534 rows; 2024 CSV = 23,262 rows). These are **not longitudinal panels** — fresh cross-sections with different question sets, so year-over-year deltas mix real change with instrument change.

### 3.2 Three methodological traps that change how these numbers must be read

1. **The published reports are WEIGHTED; raw counts are not.** JetBrains' own README instructs readers to "apply the multiplier from the 'weight' column… Otherwise, the results will differ." Raw and published diverge materially — e.g. 2024 ChatGPT usage is **59.1% raw vs 69% published**. Always state which basis a figure uses. (Weighting is a three-stage procedure; JetBrains' methodology page states the final stage used the **dual method of Goldfarb and Idnani (1982, 1983)** to solve for optimal individual coefficients across 24,534 respondents.)
2. **Respondents saw only a random SUBSET of questions** (survey split). JetBrains' methodology, verbatim: *"each respondent was exposed to certain sections but not others… we randomized questions and sections."* The time-allocation question was answered by only **5,472 of 24,534 (22.3%)** — so "64.2% of developers" means 64.2% *of those asked*, not of all 24,534. **Every percentage below carries its true answered denominator.** Skipping this step is the most common way JetBrains figures get inflated.
3. **JetBrains self-discloses a responder bias — and corrects for it.** Under the heading **"Lingering bias"**, the methodology page states verbatim: *"Despite these measures, some bias is likely present, as JetBrains users might have been more willing, on average, to complete the survey. This year, we additionally corrected for that by **reducing their representation in the dataset by 10%**, i.e., multiplying their share of responses by 0.9."* A companion section, **"Sampling-bias reduction"**, notes the baseline dataset was drawn from *"external channels that are less biased toward JetBrains users, such as paid ads on X, Facebook, Instagram, Quora, and referrals."* This is unusually candid vendor disclosure and is worth crediting — but it also confirms a pro-JetBrains skew exists at the margin.

**Reproducibility — the microdata is public (CC BY 4.0).** JetBrains publishes respondent-level raw data, which is how the recomputes in this section were produced and independently validated (see below). Both files verified HTTP 200 at time of writing:
- 2025 — [`DevEco2025/RawData.zip`](https://resources.jetbrains.com/storage/products/research/DevEco2025/RawData.zip) (**98 MB**; 4,740 columns × 24,534 rows)
- 2024 — [`DevEco2024/RawData.zip`](https://resources.jetbrains.com/storage/products/research/DevEco2024/RawData.zip) (**87 MB**; 6,208 columns × 23,262 rows)

Row counts match the published sample sizes exactly, which cross-validates both. **Method validation:** a weighted recompute of the 2025 metric-distrust question returns **66.2%** against JetBrains' published **66%**. (2023 microdata was not obtainable — the equivalent URL returns **403**.)

### 3.3 The strongest on-theme finding: understanding code is ~2× the stated pain of writing code

| Claim | 2025 | 2024 |
|---|---|---|
| Cite **"Understanding other people's code"** as a top job challenge | **31.6%** | **28.6%** |
| Cite **"Writing code"** as a top job challenge | **15.6%** | **13.8%** |
| Answered the question (n) | 5,025 weighted | 3,749 |

**In two independent surveys, roughly twice as many developers name understanding other people's code as a top challenge than name writing code.** And it is the activity they least want to hand to AI:

| Activity | Would delegate to AI | **Would still do myself** |
|---|---|---|
| **Understanding code** | 34.4% | **42.9%** |
| **Code reviews** | 33.8% | **38.2%** |
| **Debugging** | 26.0% | **47.5%** |
| Boilerplate / repetitive code | **70.1%** | — |
| Writing code comments / documentation | **58.4%** | 23.2% |
| User documentation | 55.2% | — |
| Internal documentation | 48.4% | — |

**Interpretation:** the more a task touches *understanding*, the more developers insist on doing it themselves; documentation and boilerplate are the most delegated. For Fieldguide this cuts both ways — it confirms comprehension is a top-2 pain point and *not* something developers trust AI to do, but it also means a tool must **augment** human understanding rather than automate it away.

### 3.4 Time allocation

| Claim | Value | Year | Denominator |
|---|---|---|---|
| Spend **more than half** their working time on activities directly involving code | **64.2%** | 2025 | 5,025 weighted (20.5% of 24,534) |
| Same | **64.8%** | 2024 | 3,680 weighted (15.8% of 23,262) |
| Most common single bucket of time-on-code | **61–70%** (17.3% of answerers, both years) | 2024/25 | same |
| Spend **≤30%** of time on meetings/chats/email | **74.4%** | 2024 | 4,164 weighted |
| Spend **>half** their time in meetings/chats/email | ≈**5.9%** | 2024 | 4,164 |

**⚠️ Critical negative finding — JetBrains does NOT measure the read-vs-write split.** Its only question is the combined "activities directly involving code." The widely-quoted "developers spend **10× more time reading than writing code**" is **not a JetBrains statistic** — no trace was found in these sources. **Do not attribute it to JetBrains.** (2025 also dropped the meetings question entirely.)

### 3.5 AI adoption, trust, and self-reported savings

| Claim | Value | Year | Source/basis |
|---|---|---|---|
| Use at least one AI tool for coding | **85%** | 2025 | DXDP PDF, N=23,350 stated |
| ChatGPT tried / regularly used | 69% / 49% | 2024 | published |
| GitHub Copilot tried / regularly used | 40% / 26% | 2024 | published |
| ChatGPT / Copilot use | 77% / 46% | 2023 | published |
| Companies **completely prohibiting** third-party cloud AI | **11%**; almost 80% allow to some extent or have no policy | 2024 | published |
| "Quality of generated code" is **very important** | **85.8%** | 2025 | n=6,199 |
| **"Quality of the AI features' codebase context awareness" very important** | **71.5%** | 2025 | n=6,199 |
| "They have a limited understanding of complex code and logic" (barrier to AI use) | 19.6% | 2025 | n=2,559 |
| Disagree that AI will fully replace human developers | 59.8% (agree 11.0%) | 2025 | n=565 (small) |
| Report saving **≥8 hours/week** from AI | **18.5%** (2025) vs **8.6%** (2024) | 2024/25 | 4,099 / 1,427 answerers |
| Report saving **≥4 hours/week** | 37.9% | 2025 | 4,099 |
| Expect AI to speed up **learning** | 47% | 2025 | N=1,625 |
| Top area wanted from AI: writing boilerplate | 62%; #2 **understanding and fixing bugs 58%** | 2025 | DXDP PDF |

**⚠️ The "time saved" figures are self-reported**, the question asks how much time developers *think* they save, and the denominators are small and differently routed (4,099 vs 1,427). **Not an objective productivity delta.** The jump from 8.6% to 18.5% reporting ≥8h/week is as likely to reflect question/route change as real change.

### 3.6 Documentation

Documentation is among the **most willingly delegated** activities (58.4% code comments/docs, 55.2% user docs, 48.4% internal docs). "Never use AI to generate internal documentation": 27.7%; user documentation: 25.2%.

**Interpretation with care:** this is consistent with documentation being experienced as drudgery, but it is **not a direct measurement of documentation dissatisfaction** — JetBrains 2025 contains **no direct documentation-pain question**. This is an inference from delegation preference. One DXDP documentation-priority percentage remains **`UNVERIFIED`** because the PDF's label and percentage lists are in different orders.

### 3.7 JetBrains on onboarding — explicitly NOT measured

**Across 2023, 2024 and 2025, JetBrains asks no question that measures onboarding time, ramp-up time, or time-to-first-commit.** The nearest proxies: "Understanding other people's code" (31.6%) and "Setting up my work environment" as a challenge (9.5%). **Anyone citing JetBrains for "X weeks to onboard" is citing something JetBrains never measured.**

### 3.8 Budget ownership — the DevEx/productivity evidence

| Metric | Value | Basis |
|---|---|---|
| **Team leads** are responsible for productivity/experience measurement | **56%** | DXDP |
| Platform engineering teams responsible for DevEx | 22–23% | DXDP |
| Dedicated specialist roles | 22–25% | DXDP |
| Cite technical factors as moderate/significant DevEx impact | 89% (non-technical: 87%) | DevEx dataviz, "2,000+" for metrics subset |
| Say their satisfaction **is not measured at all** | 33% (+16% don't know = 49%) | DevEx dataviz |
| Don't believe productivity metrics reflect their contribution | 36% (+30% unsure = **66%** skeptical/unsure) | DevEx dataviz |
| Only **fully aware** how productivity data is used | 22% (32% mostly aware; **46% limited/no understanding**) | DevEx dataviz |
| Tool satisfaction measured at **irregular** intervals | **53% (2024) → 29% (2025)** | DevEx dataviz |
| Companies that do **not** measure DevEx/productivity | **30%** (>1,000 employees) / 34% (50–1,000) / **41%** (<50) | DevEx dataviz |
| **Tech managers' DevEx gaps:** not a company priority / **lack of budget for productivity tools** / processes / **insufficient training & development** | 27% / **24%** / 20% / **14%** | DXDP, **n=146 — small, directional** |

**The 24% vs 14% split is the key budget signal**: engineering leaders name *lack of tooling budget* as a bigger gap than *insufficient training*. See §6.2.

---

## 4. DORA / State of DevOps (2023–2025)

*(All three report PDFs were downloaded and text-extracted; full tables and page cites in `_raw-dora-onboarding.md`. PDFs cached in `docs/research/_pdfs/`. **`dora.dev` download links are JS-rendered** — the PDF URLs had to be recovered from fetched HTML. Both Google-hosted PDF URLs return **405 on HEAD but 200 on GET**, so a HEAD-based link checker will falsely report them dead.)*

### 4.1 Two citation traps that invalidate most DORA quoting

1. **"39,000 respondents" is the cumulative decade total, not the annual sample.** DORA 2024 verbatim: "This year, **nearly 3,000** working professionals… shared their experiences," and separately, "We've heard from **roughly 39,000** professionals." DORA 2023 has the identical structure (**nearly 3,000** that year; **more than 36,000** cumulative). DORA 2025: **nearly 5,000**.
2. **"AI improves throughput but degrades stability" is a 2025 statement, not 2024.** In 2024 DORA found AI hurt **both**. The 2024 report's own section heading (p.39) reads **"AI is hurting delivery performance."** The direction of the throughput effect **reversed** only in 2025.

### 4.2 DORA 2024 — AI's measured effects (n ≈ 3,000)

Verbatim (2024 PDF p.39–40), effects **per +25% increase in AI adoption**:
> "the effect on delivery throughput is small, but likely negative (an estimated **1.5% reduction** for every 25% increase in AI adoption)."
> "The negative impact on delivery stability is larger (an estimated **7.2% reduction** for every 25% increase in AI adoption)."

| Metric | Effect per +25% AI adoption | Source |
|---|---|---|
| Delivery **throughput** | **−1.5%** | 2024 PDF p.39–40 |
| Delivery **stability** | **−7.2%** | 2024 PDF p.39–40 |
| **Documentation quality** | **+7.5%** | Google Cloud blog announcing the 2024 report |
| Code quality | +3.4% | same |
| Code **review speed** | **+3.1%** | same |
| Approval speed | +1.3% | 2024 PDF p.37 |
| Code complexity | −1.8% | 2024 PDF p.37 |
| Burnout effect of AI adoption (corrected) | **−9.9%** | [dora.dev errata](https://dora.dev/research/2024/errata/) v.2024.2 |

Other 2024 figures: **75.9%** of respondents rely on AI for at least one daily responsibility; **39.2%** express little or no trust in AI-generated code (30.8% little, 8.4% none); **89%** use an internal developer platform.

**⚠️ Phrasing trap:** DORA 2024 says "7.2% **reduction** [in] delivery stability"; the 2025 report and most coverage say "7.2% **increase** in instability." Same direction, different wording. Anything citing a *positive* 1.5% throughput effect as the 2024 finding is wrong on both sign and year.

### 4.3 Platform engineering's full effect set (DORA 2024, n ≈ 3,000)

| Platform effect | Change |
|---|---|
| Individuals more productive | **+8%** (p.50) |
| Teams performed better | **+10%** (p.50) |
| Organizational performance | **+6%** (p.50) |
| Developer independence → productivity | **+5%** (p.51) |
| Dedicated platform team → team-level productivity | **+6%** (p.52) |
| **Required to "exclusively use the platform" → throughput** | **−6%** (p.53) |
| **Platform use → change stability** | **−14%** (p.54) |

DORA 2025 trajectory: **90%** adopted ≥1 platform; **76%** have ≥1 dedicated platform team; **29%** run multi-platform. High-quality platforms "amplify the effects of AI adoption on organizational performance," with a residual "small but credible increase in software delivery instability: a manageable tradeoff."

**DORA 2025's own AI figures** (2025 PDF pp.4, 25, 30, 67; n ≈ 5,000): **90%** of developers use AI at work; **>80%** report a productivity gain; **59%** report better code quality; **30%** express little or no trust in AI output. Note the tension with §4.2 — a majority self-report quality improvements in the same edition that still finds AI **increases delivery instability**.

**⚠️ Errata:** the printed 2025 PDF (p.70–71) contains the typo "in spite of the increase in **stability**" where it should read "**instability**." Anyone quoting that sentence reproduces the report's own error.

### 4.4 Documentation — the strongest *and* weakest DORA findings

**DORA 2023 found documentation quality AMPLIFIES everything else** (p.28) — with a genuinely striking multiplier:
- trunk-based development → organizational performance: **12.8×** amplification
- continuous delivery: **2.7×**; continuous integration: **2.4×**; AI contribution: **1.5×**; reliability practices: **1.4×**; loosely coupled architecture: **1.2×**

Also 2023: generative culture → **30% higher** org performance; user focus → **40% higher**; flexible infrastructure → **30% higher**.

**But DORA 2023 simultaneously found documentation has "No effect" on software delivery performance itself** (p.28). So documentation quality is a *multiplier of other capabilities*, not a direct delivery lever. **Present it that way** — a claim that "better docs = faster delivery" is not what DORA found.

**⚠️ And DORA 2025 has almost no documentation content** — 11 mentions versus 79 in 2023. The framing did not persist across editions; do not present it as an ongoing DORA finding.

### 4.5 The single most defensible onboarding-adjacent number from DORA

**DORA 2023 (p.55), verbatim, n ≈ 3,000:**
> "**New hires (<1 year of experience on team) score 8% lower on productivity** than experienced teammates (>1 year experience)."

This is a clean, primary, large-sample quantification of the onboarding gap. **It is the number to use.** DORA does not, however, measure onboarding *duration*.

---

## 5. Onboarding cost — what survives scrutiny

*(Full citation-chain forensics in `_raw-dora-onboarding.md` §2. This section exists specifically to separate the one defensible claim from the folklore.)*

### 5.1 Verdict table

| Claim | Verdict |
|---|---|
| "Onboarding costs **1–2% of revenue**" | ✅ **TRACES TO A REAL DOCUMENTARY TRAIL** — but terminates in an *unpublished corporate study*. See §5.2. |
| "It takes **3–6 months** for a new developer to become productive" | ❌ **UNSOURCED VENDOR FOLKLORE.** No primary study with a stated sample size supports this range. |
| "**6–9 months** to full productivity" | ❌ **UNVERIFIED.** No primary source located. |
| "**$240,000** to onboard/hire a developer" | ❌ **UNVERIFIED VENDOR ARITHMETIC.** |
| Google's 2001 "Training New Employees" / David Simms paper | ❌ **COULD NOT BE LOCATED.** Recommended against as an anchor. |
| Microsoft Research on developer ramp-up | ✅ **REAL** — but it says "**several weeks**", not 3–6 or 6–9 months. |

### 5.2 The one claim with a real chain — and its exact wording

**Chain:** vendor pages → **MIT Sloan Management Review, Winter 2005, p.35** → **"Mellon Learning Curve Research Study" (Mellon Financial Corp., 2003)**.

**Primary URL — verified HTTP 200:** [sloanreview.mit.edu/article/getting-new-hires-up-to-speed-quickly/](https://sloanreview.mit.edu/article/getting-new-hires-up-to-speed-quickly/) — the actual article, fetched and text-confirmed in this session.

Verbatim from the MIT SMR passage (retrieved directly from the live article):
> "A recent study by **Mellon Financial Corp.** found that lost productivity resulting from the learning curve for new hires and transfers was between **1% and 2.5% of total revenues**. On average, the time for new hires to achieve full productivity ranged from **eight weeks for clerical jobs to 20 weeks for professionals to more than 26 weeks for executives**."
> "These numbers are for external hires. **Internal transfers get up to speed about twice as fast.** See R. Williams, 'Mellon Learning Curve Research Study' (New York: Mellon Corp., 2003)."

**Three honest qualifications:**
1. The underlying study is **unpublished and proprietary** — no sample size, no methodology, no public document was locatable. **The chain terminates in an unverifiable corporate report, not a peer-reviewed study.**
2. **The popular "1–2%" is a laundering of the source's "1% and 2.5%"** — the top of the range is silently dropped.
3. It measures the learning curve for **new hires *and internal transfers***, not onboarding alone.

**A second misattribution in the same family, found by verifying this article.** The widely-cited **"$40K+ cost per hire (SHRM 2023)"** is **not** SHRM and **not** 2023. The real origin is this same MIT SMR article's endnote: verbatim, *"**Ten percent of companies report the average cost as more than $40,000.** See R. McNatt and L. Light, 'Job Turnover Tab,' **Business Week, April 20, 1998**, 8."* So the true source is a **1998 Business Week turnover tabulation** — and the construct is **turnover cost**, not onboarding cost. Vendor pages have re-labelled it "SHRM 2023."

**If a revenue-percentage cost is needed, the honest framing is the full quoted sentence above, attributed to Mellon 2003 via MIT SMR 2005, with the "unpublished/uncorroborated" caveat attached.**

### 5.3 What the real primary literature actually says about ramp-up time

| Source | Finding | Sample | Confidence |
|---|---|---|---|
| **Rastogi, Nagappan, Czerwonka et al., "Ramp-up Journey of New Hires"** (Microsoft, ISEC '17) | New hires "often take **several weeks** to reach the same productivity level as existing employees" | Data from **8 large, popular product teams at Microsoft**; time units **anonymised** | **Primary** (peer-reviewed). [Open copy](http://thomas-zimmermann.com/publications/files/rastogi-isec-2017.pdf) (200); ACM copy **403** |
| — **that paper's own source for "several weeks"** | endnote [2] = an **Accountemps / Robert Half press release** ("Survey Identifies Greatest Challenges When Starting a New Job") | — | ⚠️ **Not research.** The URL returns 200 but now serves a generic Robert Half newsroom index; the original release is not retrievable. |
| **DORA 2023** | New hires score **8% lower on productivity** | n ≈ 3,000 | **Primary** |
| **Ju et al. 2021** (ICSE, Microsoft) | Developers new to a codebase are "not productive for months" | **32 developer + 15 manager interviews; surveys n=189 and n=37** | Primary |

**Synthesis:** the best *empirical* statement about developer ramp-up duration is Microsoft's **"several weeks" (2017)** — and even that claim's own footnote points at a **staffing-agency press release**. The best *academic* statement is **"not productive for months"** (Ju et al. 2021). **Nothing in the primary literature supports the confident "3–6 months" or "6–9 months" ranges.** When a vendor quotes them without a citation, that is the tell.

### 5.4 Documented citation fabrication found in the wild

`hyring.com` was found presenting precise-sounding attributions — "**Stripe Engineering Blog, 2023**" for a "3-6 months" ramp-up period for mid-level software engineers, "**Gallup 2024 — 8.2 months**", "**University of Minnesota CUHRO**" — **none of which are retrievable**. This is a textbook case of citation fabrication in the onboarding-cost genre. It is a useful caution: the confident-sounding onboarding benchmark with a named source is *more* likely to be fabricated than the vague one.

### 5.5 The strongest business-case number found in this entire research: DORA 2023's 130%

DORA 2023 tested three hypotheses about what helps new hires ramp up, then reported the result on p.55–56. All verbatim, n ≈ 3,000:

The three hypothesized levers:
> "We hypothesized that organizations could help new hires in three ways: **Providing high-quality documentation.** Incorporating **artificial intelligence** into workflows, which has been shown in other research to be more helpful for inexperienced workers than experienced workers. Working together **in person**, which some have suggested could be particularly beneficial in the onboarding phase."

**The headline result — a directly quantified link between documentation quality and new-hire productivity:**
> "It's worth noting that **new hires on teams with well-written documentation (1 standard deviation above average) are 130% as productive as new hires on teams with poorly written documentation (1 standard deviation below average).**"

**⚠️ The honest counterweight in the same passage — read it before quoting 130%:**
> "these practices **do help new hires, but these practices do not help new hires more or less than everyone else**. In other words, **new hires don't get any special benefits from these practices.**"
> "We didn't see evidence of working together in person having a particular benefit to new hires."

So DORA's actual claim is narrower than it looks: high-quality documentation produces a **large productivity effect for everyone, including new hires** — but it is **not** a new-hire-specific lever. The 130% comparison is *between teams*, at ±1 SD of documentation quality; it is a cross-sectional association, not a causal experiment. DORA flags this itself:
> "our data is not experimental, and although we try to control for factors that could bias our results… it is difficult to draw sharp conclusions."

**Why this is the best number in the document anyway:** it is **primary, large-sample (n≈3,000), and quantified as a productivity ratio** — and it links exactly the variable Fieldguide manipulates (quality of understanding-supporting documentation/structure) to exactly the outcome buyers care about (new-hire output). It is far more defensible than any "3–6 months" or "$X per hire" claim. **Quote it with its ±1 SD framing and its cross-sectional caveat attached.**

DORA also found, on the same page, that **flexibility** (how/where/when new hires work) "seems to be a surer bet than forcing them to be in the office" — a side finding, but relevant context for the remote/hybrid onboarding debate.

### 5.6 What this means for Fieldguide's business case

**Do not build a business case on "onboarding takes 3–6 months and costs $X."** That claim cannot be defended under scrutiny and will be challenged by any informed buyer. The defensible framing is:

- **DORA 2023: new hires are 8% less productive** (primary, n ≈ 3,000) — the gap exists and is measured.
- **Mellon 2003 via MIT SMR 2005: lost productivity from the new-hire/transfer learning curve was 1%–2.5% of revenue, with 8/20/26+ weeks to full productivity by role** — clearly labelled as an unpublished corporate study.
- **Microsoft 2017: ramp-up is "several weeks"** across 8 large product teams.

---

## 6. Willingness to pay: price points and budget ownership

*(Full detail, verbatim excerpts and per-product fetch status in `_raw-pricing-budgets.md`. All prices below were read live from vendor pricing pages on 2026-09-22 and every listed URL was fetched; exceptions are flagged inline. Prices are **`PRIMARY`** — the vendor's own page — unless marked otherwise.)*

### 6.1 Verified price points

| Product | Price | Unit | Source | Notes |
|---|---|---|---|---|
| **Swimm** (closest to "docs for comprehension") | **No public price** — "Pricing is based on the number of lines of code you want to understand" | LOC, quote only | [swimm.io/pricing](https://swimm.io/pricing) (200) | Enterprise/quote-only. Total funding **$33.3M**, $27.6M led by Insight Partners, Nov 2021 ([Insight Partners](https://www.insightpartners.com/ideas/swimm-raises-27-6-million-to-repair-developers-love-hate-relationship-with-documentation/), 200) |
| **CodeScene** Standard / Pro | **€18 / €27** | active author / month, billed yearly | [codescene.com/pricing](https://codescene.com/pricing) (200) | "active author = anyone who has committed code over the past three months". Enterprise = "Talk to sales" |
| **SciTools Understand** | **$100–$120** | per month, annual subscription, 12-month minimum | [scitools.com/pricing](https://scitools.com/pricing) (200) | **The brief's expected "perpetual + maintenance" pricing could not be verified — apparently retired** |
| **SonarQube Cloud** Team | **$34** (list $68) | per month, up to 100k LOC | [sonarsource.com/plans-and-pricing](https://www.sonarsource.com/plans-and-pricing/) (200) | ⚠️ Same page's FAQ says "$32 per month (previously listed at $65)" — **the page contradicts itself; both quoted** |
| **SonarQube Server** | **No public price** | per instance, per year, **by LOC** | [sonarsource.com/plans-and-pricing/sonarqube-server/](https://www.sonarsource.com/plans-and-pricing/sonarqube-server/) (200) | Commercial support "starting at 5M LOC" |
| **Sourcegraph** | **"Starting at $16K"** minimum annual | enterprise only, scales with team size | [sourcegraph.com/pricing](https://sourcegraph.com/pricing) — **live page HTTP 403**; read via Wayback snapshot 2026-09-14 | **One plan only; no free/pro/team tier** — confirms the enterprise-only retreat |
| **CodeRabbit** Essentials / Team / Advanced | **$24 / $48 / $72** | per developer / month, billed annually | [coderabbit.ai/pricing](https://www.coderabbit.ai/pricing) (200) | Also $0.40/agent-minute. **>$15M ARR, $550M valuation, $60M round, "growing 20% a month"** — [TechCrunch 2025-09-16](https://techcrunch.com/2025/09/16/coderabbit-raises-60m-valuing-the-2-year-old-ai-code-review-startup-at-550m/) (200), secondary |
| **GitHub Copilot** Business / Enterprise | **$19 / $39** | per granted seat / month | [docs.github.com Copilot plans](https://docs.github.com/en/copilot/get-started/plans) (200) | Individual: Free $0 / Pro $10 / Pro+ $39 / Max $100 |
| **JetBrains** IDEA Ultimate | personal **$199→$159→$119** (yr 1/2/3+); commercial **$719** | per user / year | [jetbrains.com/store](https://www.jetbrains.com/store/) (200) | All Products Pack: personal $299→$239→$179; commercial $979 |
| **Notion** Plus / Business | **$10 / $20** | per member / month | [notion.com/pricing](https://www.notion.com/pricing) (200) | Enterprise = "Contact Sales" |
| **Snyk** Team | **$25** starting | teams up to 10 devs / month | [snyk.io/plans](https://snyk.io/plans/) (200) | Enterprise = contact sales; credit-based (1 credit = $1) |
| **Sourcery** Pro / Team | **$12 / $24** | per seat / month | [sourcery.ai/pricing](https://www.sourcery.ai/pricing) (200) | Enterprise = "Talk to us" |
| **Graphite** Starter / Team | **$20 / $40** | per user / month, billed annually | [graphite.dev/pricing](https://graphite.dev/pricing) (200) | $52M Series B led by Accel (TechCrunch, secondary) |
| **DX (getdx.com)** | **No public price** — every CTA is "Get a demo" | — | [getdx.com/pricing/](https://getdx.com/pricing/) (200) | Enterprise-only, quote-based |
| **Onboard.io** | $25 / $300 / $1,000 per month | **plan-level, not per seat** | [onboard.io/pricing](https://onboard.io/pricing/) (200) | ⚠️ **CUSTOMER onboarding, not developer onboarding** — not a comparable |

**The credible per-seat band for developer tooling is ~$10–$72 per developer per month.** The products positioned *closest* to codebase comprehension (Swimm, DX, SonarQube Server, CodeScene Enterprise, Sourcegraph) publish the *least* pricing — they are sold top-down on annual contracts. **LOC-based pricing is the established mechanism** for codebase-scale tools (Swimm, SonarQube Cloud and Server), which matters for how Fieldguide meters value.

### 6.2 Budget ownership — who actually signs

Three independent sources converge on the same answer: **a centrally-funded platform / DevEx / Engineering-Enablement team under an engineering leader.** Not L&D, not HR.

- **Gartner (analyst's own page, fetched via Wayback; gartner.com returns 403 to bots):** "By 2026, **80% of large software engineering organizations will establish platform engineering teams** to provide reusable services, components and tools via platforms for application delivery." — [Gartner, platform engineering](https://www.gartner.com/en/experts/top-tech-trends-unpacked-series/platform-engineering-empowers-developers) (Wayback snapshot 2026-02-08, 200).
- **Microsoft Learn (primary):** such teams "might be called DevOps, Engineering Enablement, Developer Experience (DevEx or DevX), Shared Tools, a Center of Excellence, or even Platform. **They're funded centrally and treated as cost centers.**" — [learn.microsoft.com/platform-engineering/investment](https://learn.microsoft.com/en-us/platform-engineering/investment) (200).
- **JetBrains 2025 (primary vendor research; N between 146 and 6,144 per question):** "**56% of respondents say team leads are responsible** for productivity and experience measurements, rather than specialists like developer productivity engineers or HR pros." — [DXDP.pdf](https://resources.jetbrains.com/storage/products/research/DXDP.pdf) (200). Platform engineering teams were named by only 22–23%; dedicated specialist roles 22–25%.
- **The clincher against an L&D budget** — JetBrains asked tech managers (N=**146**, 2024 — small, directional) to rank their orgs' DevEx gaps:
  - 27% "developer productivity and experience are not a priority for the company"
  - **24% "lack of investment and budget for tools that enhance developer productivity"**
  - 20% inefficient processes/policies; 14% cost-saving focus
  - **"Insufficient training, mentoring, and professional development for developers" — only 14%.**

**Interpretation:** the budget line that funds developer-productivity tooling is an **engineering tooling line, not a training line**. A tool pitched as "learning" competes for the 14% training gap; the same tool pitched as "productivity/platform investment" competes for the 24% tooling-budget gap. **Fieldguide's packaging should not lead with "learning."**

### 6.3 Bottom-up vs top-down

- **Stack Overflow (its own B2B-marketing research page):** "**62% of developers** shared that they have some, to a great deal of influence over technology purchases in their organizations." — [stackoverflow.co/advertising/.../insight-3](https://stackoverflow.co/advertising/resources/stack-overflow-developer-survey-for-b2b-tech-marketers/insight-3/) (200). ⚠️ "some, to a great deal of" is an extremely wide band, self-reported, and published to sell ads. **Directional only.**
- In the SO 2025 dataset itself (`PurchaseInfluence`, n=37,341): 19.84% "influenced the purchase of a substantial addition to the tech stack"; 52.62% answered "No."
- **Gartner (primary, PDF):** in enterprise purchases "the product user has **limited influence** on the buying decision," and "engineering, marketing, sales, customer success and finance are generally involved." Methodology: 4,082 respondents, Oct–Dec 2023, orgs ≥100 employees, US/France/Germany/Singapore — **respondents were deliberately required to *not* be involved in procurement**, so this measures *influence*, not buying authority. [Gartner doc G00805575](https://emt.gartnerweb.com/ngw/globalassets/en/doc/documents/805575-how-product-led-should-your-go-to-market-strategy-be.pdf) (200).

**Reading:** developers drive *awareness and endorsement*, procurement and engineering leadership drive the *decision*. A product-led self-serve motion is a wedge, not the revenue engine, at these price points.

### 6.4 The cost of the problem (useful for a business case — modelled, not measured)

> **DX + Atlassian, *State of Developer Experience Report 2024*** (primary PDF, [getdx.com/uploads/state-of-devex-report.pdf](https://getdx.com/uploads/state-of-devex-report.pdf), 200):
> "For an organization with **500 developers, losing 8 hours per week costs roughly $6.9 million** over the course of a year."
> "**Inefficient documentation is a major hindrance for 41% of developers** in our survey."
> Methodology: "Wakefield Research surveyed 1,250 engineering leaders in the US, Germany, France, and Australia"; "DX surveyed 900 developers around the world."

⚠️ The $6.9M figure is **modelled**, built on the Stack Overflow 2023 average developer salary cited in the report's own footnote — not a measured outcome. **DX sells a developer-productivity measurement platform**, so it is `VENDOR` and has an interest in a large number. Use it as an illustrative frame, never as a finding.

### 6.5 The cautionary datapoints: CodeSee is dead, and Swimm pivoted away

**CodeSee — the closest direct competitor to Fieldguide's positioning (interactive codebase knowledge graph for onboarding) — was acquired by GitKraken on 14 May 2024** and never scaled standalone. Verified: GitKraken press release ["GitKraken … today announced it has acquired code health innovator, CodeSee"](https://gitkraken.com/press/gitkraken-acquires-codesee-launches-devex-platform) (200 when fetched, dated 14 May 2024); `https://www.codesee.io/` → **HTTP 404**; `https://codesee.io` → **TLS handshake failure**. **Stepsize** was likewise acquired by ClickUp ([stepsize.com](https://stepsize.com/), 200: "Stepsize has been acquired by ClickUp").

**Swimm — the other closest analogue — has repositioned away from developer onboarding entirely.** Verified by direct fetch of [swimm.io](https://swimm.io/) and [swimm.io/pricing](https://swimm.io/pricing) (both 200). Its site now leads with **"De-Risk Legacy Modernization"**, "Whether you're looking to modernize your **mainframe** or generate code documentation with AI," "Gain agility in your **mainframe** development," and a **services-led model** ("Our team combines static analysis for deterministic accuracy, GenAI for speed, and **senior engineers** to catch what tools miss"; "Each starts with an **Assessment** that locks scope, risks, and success criteria"). Its "Knowledge Base" product is now explicitly positioned as infrastructure **for AI agents, not for humans**:
> "Build the validated knowledge base **your AI tools need to understand your codebase. Copilot, Cursor, Claude Code, internal agents, MCP servers.**"

Swimm has raised **$33.3M** total (per its lead investor, Insight Partners). So the two best-funded attempts at this exact positioning both moved on: one exited to a platform, the other shifted to **enterprise legacy-modernization services** and to selling **context to AI coding agents** rather than onboarding to people.

**This is the single most important counterweight in this document, and it cuts two ways.** It shows codebase-comprehension-for-onboarding is hard to sustain as a standalone product — but it also reveals **where the money actually went**: Swimm's pivot means the validated "codebase knowledge base" is now being sold as **AI-agent context infrastructure (MCP servers, Cursor/Copilot grounding)**, which is a far better-funded budget line than "developer onboarding" — and which directly matches Fieldguide's own LLM-grounding-in-the-graph design. Any market-size optimism must still explain why Fieldguide succeeds where CodeSee did not; but the Swimm pivot suggests the **value is real and the buyer moved**, from "help my developers understand" to "ground my AI in my codebase." That is a repositioning option worth taking seriously — and it is corroborated independently by SO 2024's finding that **64.6% of professional developers say AI tools lack their codebase's context.**

*(The strategy inference above is my reading, not evidence. Label it as such in any deck.)*

---

## 7. The learning / interview-prep market

*(Full 60-row table, verbatim excerpts and extraction-gap disclosures in `_raw-learning-market.md`. **The best evidence here is SEC-filed**, which makes this the hardest-numbered section in the document. Obstacles: **LeetCode is Cloudflare-403 on every path** — pricing recovered only via a Wayback snapshot; ByteByteGo, Educative and current LeetCode pricing are **JS-rendered**, disclosed rather than estimated.)*

### 7.1 The single most important structural finding: the market splits into two different budget pools

**Pool A — broad upskilling: enterprise-funded, and the enterprise share is RISING.**

| Company | Metric | Value | Source |
|---|---|---|---|
| **Pluralsight** | Total revenue FY2020 | **$391.9M** | [SEC 10-K](https://www.sec.gov/Archives/edgar/data/1725579/000172557921000010/ps-20201231.htm) (primary) |
| **Pluralsight** | **Revenue from business customers** | **$343.8M = 87.7%** of total | same |
| **Pluralsight** | B2B share trajectory | **81.1% (FY18) → 85.8% (FY19) → 87.7% (FY20)** — *rising* | derived from 10-K |
| **Pluralsight** | Business customers / business users | **17,599** customers; **1.9M+** users (vs ~980,000 at end-2019) | same |
| **Pluralsight** | Subscription share of revenue; net loss; status | ~96%; **−$164.1M**; went private 2020-12-11 | same |
| **Udemy** | Total revenue FY2025 | **$789.844M** | [SEC 10-K](https://www.sec.gov/Archives/edgar/data/1607939/000160793926000034/udmy-20251231.htm) (primary) |
| **Udemy** | **Enterprise share of revenue** | **66% (FY25) / 63% (FY24) / 58% (FY23)** — *rising* | same |
| **Udemy** | Consumer segment revenue FY2025 | **$265.770M — DOWN 9%** from $292.107M | same |
| **Udemy** | Udemy Business customers | 17,029 / 17,096 / 15,726 (FY25/24/23) | same |
| **Coursera** | Total / Consumer / Enterprise FY2025 | **$757.5M (+9%)** / $502.2M / **$255.3M** | [SEC 10-K](https://www.sec.gov/Archives/edgar/data/1651562/000165156226000015/cour-20251231.htm) (primary) |
| **Coursera** | FY2023 comparison | $635.8M / $416.2M / $219.6M | same |
| **Coursera** | **Consumer is still the MAJORITY** | **66.3% consumer vs 33.7% enterprise (FY2025)**; ~flat vs 65.5% in FY2023 | derived from 10-K |
| **Pluralsight** | Consumer share trajectory | **18.9% → 14.2% → 12.3%** (FY18→FY20) — the cleanest evidence of the B2B shift | derived from 10-K |
| **O'Reilly** | Individual tiers: /month, /3 months, /year; **Team (2–25 members)** priced **/member** | **$129 (3 months), $499 (year)** confirmed in the archived page; the reported **$49/mo was not independently recaptured** | [archived pricing page](https://web.archive.org/web/20260618161311/https://www.oreilly.com/online-learning/pricing.html) (200) — `PRIMARY` via archive |
| **Coursera Plus** (consumer, for comparison) | **$59/mo or $399/yr** | Reported by the learning-market research; **not independently recaptured** | `SECONDARY` |

Verbatim: *"Revenue from our Enterprise segment represented 66%, 63%, and 58% of total revenue during the fiscal years ended December 31, 2025, 2024, and 2023 respectively."* (Udemy)

**This is the decisive number set — with one exception that cuts against the pattern.** Pluralsight and Udemy both show enterprise revenue rising and consumer declining (Udemy consumer revenue is actively shrinking, **−9% YoY**; Pluralsight's consumer share fell **18.9% → 14.2% → 12.3%** across FY2018–20).

**⚠️ But Coursera is the counter-example, and it breaks the generalisation.** Coursera's **Consumer segment is still the MAJORITY of its revenue**: **$502.2M = 66.3%** versus Enterprise **$255.3M = 33.7%** (FY2025) — and that share is essentially **flat** against FY2023 ($416.2M / $635.8M = **65.5%**), not shrinking. So "developer-learning money is overwhelmingly B2B" is true of **corporate upskilling platforms** (Pluralsight, Udemy Business) but **not** of consumer-scale course marketplaces. **Do not generalise from Pluralsight and Udemy alone**, and do not claim Coursera's consumer share is declining — the verified figures show it stable at ~66%.

**Pool B — interview prep: consumer out-of-pocket, self-serve, no published enterprise SKU.**

| Product | Price | Unit |
|---|---|---|
| **LeetCode** Premium | **$35/mo, $159/yr** (≈$13.25/mo effective annual; **previously $299/yr**) | per user (Wayback snapshot 2024-01-01; site is Cloudflare-403) |
| **Coursera Plus** (consumer) | **$59/mo or $399/yr** | per user — `SECONDARY`, not independently recaptured |
| **DesignGurus** (owns Grokking) | **$123/mo** or $373/yr | per user |
| **ByteByteGo** | **$150/yr or $15/mo** | per user (founder's Feb-2023 launch post only — current page is JS-rendered) |
| **AnkiHub** (Anki ecosystem) | **Free, then $6 / $10 / $450 lifetime** | per user |

**None of these vendors discloses an enterprise revenue share, and no interview-prep vendor has SEC-grade disclosure at all.** The consumer conclusion therefore rests on **pricing and distribution structure** (self-serve, $6–$159/yr, no enterprise SKU published, no sales-gated pricing) — **not** on disclosed revenue.

### 7.2 The nuance that changes the go-to-market: consumer-initiated, employer-REIMBURSED

Verbatim from ByteByteGo's founder post:
> "What will it cost? $150 per year, or $15/month. **Many subscribers use their company's learning budget to cover the cost of this.**"

The company even **ships an email template for subscribers to ask their manager to pay**. So interview prep is **consumer-*initiated*, employer-*reimbursed***. Modelling it as B2B misses the go-to-market (self-serve signup); modelling it as pure out-of-pocket **under-counts the reimbursement**. Any pricing/packaging decision should account for both.

### 7.3 Spaced repetition (SRS) — strong in medicine, and built on a FREE tool

- **94%** Anki adoption among first-year students at one US medical school (**Cureus 2025, PMID 41322734**); **82%** at another, with **51%** calling it their primary study method (**PMID 41939075**). *(Peer-reviewed.)*
- A **systematic review of 11 studies** found high-frequency Anki users outscoring minimal users by **4–13 points on USMLE Step 1** (**PMID 42183420**).
- Contrast: **25.2%** adoption in Jordan (**PMID 41862940**) — showing this is a **US-exam-driven** phenomenon, not a general property of SRS.
- **But Anki is free** — "The free computer version is available for all major platforms" ([apps.ankiweb.net](https://apps.ankiweb.net/)). The paid layer (**AnkiHub free / $6 / $10 / $450 lifetime**) is an *optional convenience tier* on top of a free core. **No verifiable corporate/enterprise SRS deployment numbers were found.**

**⚠️ Caution:** SRS has *better-documented efficacy in medicine than in software*, yet the tool that captured that market **monetizes at only $6–10/month**. This is a caution **against treating SRS itself as a monetizable wedge** — in Fieldguide it should be a retention/engagement feature, not the value proposition buyers pay for.

### 7.4 The evidence gap that matters most

**No survey exists that measures out-of-pocket interview-prep *spending*.** The closest Stack Overflow 2024 figure — **39.5%** of professional developers write code outside work for professional development or self-paced learning (n=54,466) — measures **unpaid time, not dollars**. So the consumer-vs-enterprise split for interview prep has **no direct survey evidence**; it is inferred from pricing structure. Flag this whenever the consumer opportunity is sized.

---

## 8. Market size for developer tools / DevEx

*(Full retrieval log, verbatim excerpts and blocked-URL table in `_raw-market-size.md`. **Important access caveat: `gartner.com` returns HTTP 403 to all automated fetches**, so Gartner rows below were read from **Wayback snapshots of Gartner's own pages** — the content is Gartner's, the transport is an archive. Labelled `PRIMARY (via Wayback)`.)*

### 8.1 The headline negative finding — read this first

**No analyst in this research set publishes a dollar market size for "developer tools", "DevEx", "internal developer platforms", or "codebase comprehension / onboarding" as a standalone category.** Gartner's and IDC's public evidence for this space is **adoption percentages only**. IDC's *Worldwide DevOps Software Tools Forecast 2024–2028* (doc `US52541124`) could not be retrieved — the abstract 404s and reseller paths are blocked (403 / connection reset), so **IDC's DevOps-software-tools dollar sizing is unverified**.

RedMonk publishes no developer-tools TAM, and their own 2017 words are a warning worth quoting directly:
> "**Market size prediction for example is generally guesswork, and often hilariously wrong**, part of an industry investment machine that runs on vanity metrics." — James Governor, [RedMonk](https://redmonk.com/jgovernor/just-how-many-darned-developers-are-there-in-the-world-github-is-puzzled/) (200)

a16z's famous "$3 trillion" is **explicitly self-labelled an estimate** ("Based on anecdotal evidence we estimate…"), and it measures *GDP contribution*, not a purchasable market:
> "Based on dozens of conversations… we estimate that a simple AI coding assistant today increases productivity of a developer by about 20%… a best-of-breed deployment of AI can at least double developer productivity resulting in a **GDP contribution of $3 trillion per year**." — [a16z, "The Trillion Dollar AI Software Development Stack"](https://a16z.com/the-trillion-dollar-ai-software-development-stack/) (200). `Medium` confidence — not survey-based.

**Consequence: any TAM for Fieldguide must be built bottom-up, and the attach rate has no analyst source.** Do not put an analyst-attributed TAM in a deck, because there isn't one.

### 8.2 Gartner — platform engineering and AI assistants (adoption, not dollars)

| Prediction | Number | Year published | Source |
|---|---|---|---|
| Large software engineering orgs will establish platform engineering teams | **80% by 2026**, up from 45% in 2022 | press release 2022 | [Gartner platform engineering](https://www.gartner.com/en/infrastructure-and-it-operations-leaders/topics/platform-engineering), `PRIMARY (via Wayback)` |
| Platform engineering principles will influence I&O tech decisions | **>50% by 2027**, from <20% | page archived 2026 | same |
| Large orgs will embrace platform engineering to scale DevOps in hybrid cloud | **80% by 2027**, from <30% in 2023 | page archived 2026 | same |
| Enterprise software engineers using AI code assistants | **75% by 2028** (from <10% in early 2023) | **2024** | [Gartner press release 2024-04-11](https://www.gartner.com/en/newsroom/press-releases/2024-04-11-gartner-says-75-percent-of-enterprise-software-engineers-will-use-ai-code-assistants-by-2028) |
| Organizations piloting/deploying AI code assistants | **63%** (Gartner survey of **598** respondents, Q3 2023) | 2024 | same |
| Enterprise software engineers using AI code assistants — **revised upward** | **90% by 2028** (from <14% in early 2024) | **2025** | [Gartner press release 2025-07-01](https://www.gartner.com/en/newsroom/press-releases/2025-07-01-gartner-identifies-the-top-strategic-trends-in-software-engineering-for-2025-and-beyond) |
| Orgs with platform teams adding GenAI to their internal developer platform | **70% by 2027** | 2025 | same |
| Software engineering teams actively building LLM-based features | **≥55% by 2027** | 2025 | same |

**Note the revision:** Gartner moved its own AI-code-assistant forecast from **75% → 90% by 2028** in a single year. Analyst predictions in this category are volatile; treat the *direction* as the signal, not the point estimate.

### 8.3 IDC

| Claim | Number | Source |
|---|---|---|
| Developers leveraging cloud-native developer portals / cloud dev environments (platform engineering shift) | **70% by 2027** | IDC FutureScape: Worldwide Developer and DevOps 2025 Predictions, Doc **#US52623424**, Oct 2024 — [idc.com](https://mfe-prod.idc.com/research/viewtoc.jsp?containerId=US52623424) (200); **doc itself is paywalled (~$7,500)**, so wording is verified but detail is not |
| Worldwide AI spending | **$632B by 2028**, CAGR **29.0%** (2024–2028) | [IDC press release 2024-08-19](https://www.idc.com/resource-center/press-releases/worldwide-spending-on-artificial-intelligence-forecast-to-reach-632-billion-in-2028-according-to-a-new-idc-spending-guide/) (200) |
| Generative AI spending | **$202B** = 32% of AI spend; CAGR **59.2%** | same |

⚠️ **These are total AI spend, NOT developer tools.** They must not be cited as a developer-tooling TAM.

### 8.4 Developer population — sources disagree by ~3.8×, so TAM swings >2×

| Source | Figure | What it actually counts | Confidence |
|---|---|---|---|
| **GitHub Octoverse 2025** | **>180 million** (+36M in the year, +23% YoY) | **accounts** on GitHub | High (but **unsuitable as a TAM denominator**) |
| **Microsoft FY25 Q2 earnings** | **150 million** developers, "up 50% over the past two years" | developers on GitHub | **High** (first-party earnings) |
| **SlashData (May 2025)** | **47.2 million** active developers | active developers, bottom-up survey model (29 survey waves, >10,000 devs each) | **High** for the claim |
| **JetBrains (2024 revised model)** | **19.6 million** professional developers | professionals only — note this was **13.4M under the 2023 methodology**, a **46% jump from a pure methodology change** | High, but volatile |

**Do not mix these.** A defensible bottom-up range for a `$X/seat/month` model is **JetBrains' ~19.6M professional developers (floor)** to **SlashData's ~47.2M active developers (ceiling)** — a >2× spread that is entirely a definitional artifact. **GitHub's 180M is an account count and must not be used.**

### 8.5 Microsoft first-party earnings — the only hard revenue data in this category

These are **`PRIMARY`** (Microsoft investor-relations prepared remarks) and are the best-verified commercial numbers found anywhere in this research:

| Metric | Figure | Quarter | Source |
|---|---|---|---|
| Organizations adopting GitHub Copilot | **">77,000 organizations"**, **+180% YoY** | FY24 Q4 | [Microsoft FY24 Q4](https://www.microsoft.com/en-us/investor/events/fy-2024/earnings-fy-2024-q4) |
| GitHub annual revenue run rate | **"$2 billion"** | FY24 Q4 | same |
| Copilot share of GitHub revenue growth | **"over 40%"** | FY24 Q4 | same |
| Copilot Enterprise customers | **+55% quarter-over-quarter** | FY25 Q1 | [Microsoft FY25 Q1](https://www.microsoft.com/en-us/investor/events/fy-2025/earnings-fy-2025-q1) |
| GitHub Copilot users | **"over 15 million… up over 4X year-over-year"** | FY25 Q3 | [Microsoft FY25 Q3](https://www.microsoft.com/en-us/investor/events/fy-2025/earnings-fy-2025-q3) |
| Copilot Code Review Agent | **">8 million pull requests"** reviewed | FY25 Q3 | same |

**Interpretation:** GitHub alone is a **$2B run-rate** business and Copilot drove **>40% of its growth**. Combined with the §6 price band ($19–$39/seat for Copilot Business/Enterprise), this is direct proof that **engineering organisations pay real money per seat for developer tooling at enterprise scale.** That is the strongest single willingness-to-pay datapoint in this document — with the caveat that it is for *code generation*, not comprehension.

**Don't confuse two Copilot user counts that circulate.** The first-party **">15 million GitHub Copilot users, up over 4X year-over-year"** (Microsoft FY25 Q3, Apr 2025) is a *point-in-time* count. Separately, **"more than 20 million"** (July 2025) is **all-time users** — a GitHub spokesperson confirmed to TechCrunch that the figure "represents 'all-time users,'" and Microsoft's Nadella gave it on an earnings call ([TechCrunch 2025-07-30](https://techcrunch.com/2025/07/30/github-copilot-crosses-20-million-all-time-users/), 200 — verified; **primary Microsoft transcript not located**, so treat as `SECONDARY`). The two numbers are not comparable and the 20M is *not* a superseding update of the 15M.

---

---

## Numbers table

| Claim | Number | Source | Year | Sample size | Primary or secondary? | Confidence |
|---|---|---|---|---|---|---|
| Time spent on program comprehension | ~58% of developer time | Xia, Bao, Lo, Xing, Hassan, Li, *IEEE TSE* 44:951–976 | 2018 | 7 projects, **78 professional developers, 3,148 working hours** | **Primary** (peer-reviewed field study) | **High** for what it measured; pre-AI vintage |
| Senior devs spend less time on comprehension than juniors | "significantly less" (no % in abstract) | same | 2018 | 78 devs | Primary | Medium (direction only) |
| Pre-2018 comprehension studies were small/lab-bound | "controlled setting, or with a small number of participants" | same (authors' own words) | 2018 | — | Primary | High |
| Comprehension ≈ reading; navigation counted separately at 24% | 58% comprehension + 24% navigation | feenk (Glamorous Toolkit) via Wayback | 2025 capture | — | **Secondary + VENDOR** | **Low** — paywalled table, ACM 403 |
| Core devs review more code after Copilot | **+6.5%** code reviewed | Xu et al., arXiv 2510.10165 | 2026 (v3) / WITS 2025 | OSS repository activity analysis | **Primary** (working paper) | Medium-high |
| Core devs' own code productivity after Copilot | **−19%** | same | 2026 | same | Primary | Medium-high |
| AI effect on commits: autocomplete / interactive agents / autonomous agents | **+30% / +180% / +240%** | Demirer, Musolff, Yang, NBER WP 35275 | 2026 | **500,000+ GitHub developers** + AI telemetry | **Primary** (NBER) | **High** |
| Same effect attenuated to projects / releases | **+80% / +30%** | same | 2026 | 500,000+ | Primary | **High** |
| Elasticity of substitution AI↔human effort | **0.23** (strong complementarity) | same | 2026 | 500,000+ | Primary | Medium-high |
| Sillito et al. study is a question taxonomy, not a time measurement | n/a (no % of time reported) | Sillito, Murphy, De Volder, *IEEE TSE* 34(4):434–451 | 2008 | **UNVERIFIED** | Primary (metadata verified via Semantic Scholar; 349 citations) | Design confirmed; sample size unverified |
| SO survey sample size | **65,437** responses, 185 countries | survey.stackoverflow.co/2024/methodology | 2024 | 65,437 | **Primary** | High |
| SO survey sample size | **over 49,000+** responses, 177 countries | survey.stackoverflow.co/2025/ | 2025 | 49,000+ | **Primary** | High |
| **Top AI frustration: "almost right, but not quite"** | **65.98%** (20,768) | SO 2025 dataset `AIFrustration` | 2025 | **31,476** | **Primary** (dataset) | **High** |
| Debugging AI-generated code more time-consuming | 45.22% (14,232) | same | 2025 | 31,476 | Primary | High |
| "Hard to understand how or why the code works" | **16.32%** (5,136) | same | 2025 | 31,476 | Primary | High |
| Blog post swaps the 45%/66% labels | 45% ↔ 66% | SO blog vs dataset | 2025 | — | Primary (both) | **High confidence in the discrepancy** |
| AI tools "lack context of codebase" | **63.3%** all / **64.6%** professional | SO 2024 dataset | 2024 | 30,661 / 24,496 | **Primary** | **High** |
| Don't trust AI output | 66.2% all / 66.1% professional | SO 2024 | 2024 | 30,661 / 24,496 | Primary | High |
| Currently use AI for "learning about a codebase" | **30.9%** | SO 2024 | 2024 | 35,978 | **Primary** | High |
| **Interested** in AI for "learning about a codebase" | **40.6%** | SO 2024 | 2024 | 35,978 | **Primary** | **High** |
| Trust in AI accuracy (combined) | 43% (2024) → 32.8% (2025) | SO datasets | 2024/25 | 37,302 / 33,244 | Primary | High |
| AI favorability | 72% (2024) → 60% (2025) | SO blog | 2024/25 | — | Primary (org's own post) | Medium |
| Using/planning AI tools | 76% (2024) → 84% (2025) | SO landing pages | 2024/25 | — | Primary | High |
| Professional devs using AI daily | 50.62% | SO 2025 `AISel_prof` | 2025 | 26,004 | Primary | High |
| Would ask a human when distrusting AI | 75% | SO blog | 2025 | — | Primary (org's own post) | Medium |
| More time in code review since AI adoption | **81%**; 28% report 30% longer | Harness via ITPro | 2025 | **NOT FOUND** | **VENDOR + secondary** | **Low** |
| Developers using ≥1 AI tool for coding | **85%** | JetBrains DevEx & Productivity dataviz | 2025 (Apr–Jun) | full report sample (n not published per-stat) | **VENDOR primary** | Medium |
| Team leads own DevEx/productivity measurement | **56%** of ICs | JetBrains DevEx dataviz | 2025 | "2,000+" for metrics subset | **VENDOR primary** | Medium |
| Platform engineering teams own DevEx | 22–23% | JetBrains DevEx dataviz | 2025 | same | VENDOR primary | Medium |
| Large companies not measuring DevEx/productivity | 30% | JetBrains DevEx dataviz | 2025 | same | VENDOR primary | Medium |
| **"Understanding other people's code" a top job challenge** | **31.6%** (2025) / **28.6%** (2024) | JetBrains DevEco microdata | 2024/25 | 5,025 weighted / 3,749 | **VENDOR primary microdata** | **High** |
| "Writing code" a top job challenge | **15.6%** (2025) / **13.8%** (2024) | same | 2024/25 | same | VENDOR primary microdata | **High** |
| Would still do **code understanding** themselves, not delegate to AI | **42.9%** (vs 34.4% delegate) | same | 2025 | 2,068 weighted | VENDOR primary microdata | High |
| Would still do **code reviews** themselves | 38.2% (vs 33.8%) | same | 2025 | 9,426 weighted | VENDOR primary microdata | High |
| JetBrains sample sizes | 26,348 (2023) / **23,262** (2024) / 24,534 (2025) | JetBrains methodology pages | 2023–25 | — | VENDOR primary | High |
| Time on activities directly involving code >50% of working time | 64.2% (2025) / 64.8% (2024) | JetBrains microdata | 2024/25 | 5,025 / 3,680 weighted | VENDOR primary microdata | High |
| **JetBrains measures read-vs-write split or onboarding time?** | **NO — neither exists** | JetBrains 2023–25 question inventories | 2023–25 | — | — | **High (negative finding)** |
| **DORA 2024: throughput per +25% AI adoption** | **−1.5%** | DORA 2024 report PDF p.39–40 | 2024 | **nearly 3,000** | **Primary** | **High** |
| **DORA 2024: delivery stability per +25% AI adoption** | **−7.2%** | same | 2024 | nearly 3,000 | **Primary** | **High** |
| DORA 2025: throughput direction | **positive (reversed from 2024)**; instability still negative | DORA 2025 PDF | 2025 | nearly 5,000 | Primary | High (direction) |
| DORA 2024: documentation quality per +25% AI adoption | **+7.5%**; code quality +3.4%; review speed +3.1% | Google Cloud blog on 2024 report | 2024 | nearly 3,000 | Primary (vendor blog) | High |
| **DORA 2023: new-hire productivity gap** | **8% lower** | DORA 2023 PDF p.55 | 2023 | nearly 3,000 | **Primary** | **High** |
| **DORA 2023: new hires on well-documented teams vs poorly documented** | **130% as productive** (at ±1 SD of documentation quality) | DORA 2023 PDF p.56 | 2023 | nearly 3,000 | **Primary** | **High** (cross-sectional, not experimental) |
| DORA 2023: do documentation/AI/in-person help new hires *specially*? | **No — "new hires don't get any special benefits from these practices"** | DORA 2023 PDF p.56 | 2023 | nearly 3,000 | **Primary** | **High (important counterweight)** |
| DORA 2025: AI at work / productivity gain / better code quality / little-or-no trust | **90% / >80% / 59% / 30%** | DORA 2025 PDF pp.4, 25, 30, 67 | 2025 | nearly 5,000 | **Primary** | High |
| DORA 2023: documentation amplification of trunk-based dev | **12.8×**; CD 2.7×; CI 2.4× | DORA 2023 PDF p.28 | 2023 | nearly 3,000 | Primary | High |
| DORA 2023: documentation effect on delivery performance itself | **"No effect"** | same p.28 | 2023 | nearly 3,000 | Primary | **High** |
| DORA 2024: using an internal developer platform | 89% | DORA 2024 PDF p.49–50 | 2024 | nearly 3,000 | Primary | High |
| DORA 2024: platform effects | individuals +8%, teams +10%, org +6%; **−6% throughput if exclusive**, **−14% change stability** | DORA 2024 PDF pp.50–54 | 2024 | nearly 3,000 | Primary | High |
| DORA 2024: little/no trust in AI-generated code | 39.2% (corrected) | DORA 2024 PDF p.6/23 + errata | 2024 | nearly 3,000 | Primary | High |
| **"39,000 DORA respondents"** | **WRONG — that's the cumulative decade total; single-year n ≈ 3,000** | DORA 2024 PDF p.91 | 2024 | — | Primary | **High (as a correction)** |
| "Onboarding costs 1–2% of revenue" | traces to **Mellon Financial Corp. "Mellon Learning Curve Research Study" (2003)** via MIT SMR 2005 p.35; true range **1%–2.5%** | MIT SMR Winter 2005 | 2003/2005 | **none published** | **Secondary → unpublished corporate study** | Low-medium (real chain, unverifiable origin) |
| Time to full productivity by role (Mellon) | **8 weeks** clerical / **20 weeks** professionals / **26+ weeks** executives; internal transfers ~2× faster | MIT SMR Winter 2005 p.35 | 2003/2005 | none published | Secondary → unpublished | Low-medium |
| **"3–6 months to become productive"** | **UNSOURCED VENDOR FOLKLORE** | — | — | none | — | **Rejected** |
| **"$240,000 to onboard a developer"** | **UNVERIFIED VENDOR ARITHMETIC** | — | — | none | — | **Rejected** |
| Microsoft ramp-up research (real) | new hires take **"several weeks"** | Rastogi et al., ISEC '17 | 2017 | **8 large Microsoft product teams**; time units anonymised | **Primary** | Medium-high (its own footnote is a staffing-agency press release) |
| **Credible per-seat band for developer tooling** | **~$10–$72 / dev / month** | Synthesis of 13 vendor pages | 2026-09-22 | — | Primary (vendor pages) | **High** |
| CodeScene Standard / Pro | €18 / €27 per active author/month | codescene.com/pricing | 2026-09-22 | — | Primary | High |
| CodeRabbit Essentials / Team / Advanced | $24 / $48 / $72 per dev/month (annual) | coderabbit.ai/pricing | 2026-09-22 | — | Primary | High |
| GitHub Copilot Business / Enterprise | **$19 / $39** per seat/month | docs.github.com | 2026-09-22 | — | Primary | High |
| Swimm (closest positioning) | **No public price** — LOC-based, quote only | swimm.io/pricing | 2026-09-22 | — | Primary | High (as a negative finding) |
| Sourcegraph | **"Starting at $16K"** min annual; one plan only, no free tier | sourcegraph.com/pricing — **live 403**, via Wayback 2026-09-14 | 2026-09-22 | — | Primary (archived) | Medium-high |
| SciTools Understand | $100–$120 / month, annual, 12-month min | scitools.com/pricing | 2026-09-22 | — | Primary | High |
| **CodeSee (closest direct competitor)** | **Acquired by GitKraken 2024-05-14; site now 404** | gitkraken.com press release; codesee.io 404 | 2024 | — | Primary | **High** |
| Gartner: platform engineering teams in large SW eng orgs | **80% by 2026** (from 45% in 2022) | Gartner | pred. 2022 | — | **PRIMARY (via Wayback)** | High |
| Gartner: enterprise engineers using AI code assistants | **75% by 2028** (2024) → **90% by 2028** (2025 revision) | Gartner press releases | 2024 / 2025 | 598 respondents for the 63% survey | PRIMARY (via Wayback) | High |
| IDC: developers using cloud-native developer portals | 70% by 2027 | IDC Doc #US52623424 | 2024 | paywalled | PRIMARY (abstract only) | Medium-high |
| **Analyst dollar TAM for dev tools / DevEx / comprehension** | **NONE PUBLISHED** | Gartner/IDC/RedMonk | — | — | — | **High (as a negative finding)** |
| GitHub annual revenue run rate | **$2 billion**; Copilot = **>40%** of GitHub's growth | Microsoft FY24 Q4 earnings | 2024 | — | **PRIMARY (first-party)** | **High** |
| GitHub Copilot users | **>15M, up >4× YoY** (FY25 Q3); >77,000 orgs, +180% YoY (FY24 Q4) | Microsoft earnings | 2025 / 2024 | — | **PRIMARY (first-party)** | **High** |
| Developer population — spread across sources | GitHub **180M+** accounts / SlashData **47.2M** active / JetBrains **19.6M** professional | GitHub, SlashData, JetBrains | 2025 / 2024 | — | PRIMARY (each) | High each; **~3.8× disagreement** |
| DX/Atlassian modelled cost of lost time | **$6.9M/yr for 500 devs** (8 hrs/week lost) | getdx.com report PDF | 2024 | 1,250 eng leaders + 900 devs | **VENDOR, modelled** | **Low** |
| Inefficient documentation a "major hindrance" | 41% of developers | same DX/Atlassian report | 2024 | 900 devs | VENDOR | Low-medium |
| Developers with some-to-great purchase influence | 62% | Stack Overflow B2B page | 2025 | 49,009 (survey) | Primary (vendor marketing) | Low |

---

## Verdict: is this a willingness-to-pay market?

**Yes — but as an enterprise engineering-tooling purchase. The SRS/interview-prep half is the weakest part of the pitch.**

**(a) Enterprise / team budgets — MOST DEFENSIBLE.** The only pool with audited, first-party revenue. GitHub is a **$2B annual run-rate** business, Copilot drove **>40% of its growth**, **>15M Copilot users** and **>77,000 organisations (+180% YoY)** — at **$19–$39/seat**. Across 13 vendor pages the credible band is **~$10–$72/dev/month**. The buyer is consistent: a **centrally-funded platform/DevEx/Engineering-Enablement team under an engineering leader** (Gartner's 80%-by-2026 platform-team prediction; Microsoft's "funded centrally, treated as cost centers"; JetBrains' **56% "team leads own it"**). Critically, engineering leaders rank **lack of tooling budget (24%) above insufficient training (14%)** — a tooling line, not an L&D line.

The demand signal is sharp: **~2× more developers name "understanding other people's code" as a top challenge (31.6%) than "writing code" (15.6%)**, and it is the activity they **least** want to delegate to AI (42.9% keep it). **64.6%** say AI tools lack their codebase's context. NBER (500,000+ developers): AI inflates commits **+240%**, releases **+30%** — the constraint is human review. DORA 2023: new hires on well-documented teams are **130% as productive** as those on poorly documented ones.

**Counterweight:** CodeSee — the closest rival — was **acquired by GitKraken in 2024**, and **Swimm ($33.3M raised) has pivoted to mainframe-modernization services and to selling codebase context to *AI agents* — explicitly not to human onboarding.** Vendors closest to comprehension publish the least pricing. Fieldguide must explain why it wins where CodeSee did not — though Swimm's pivot hints the value is real and the **buyer moved to AI-grounding**, not developer learning.

**(b) Individual-developer budgets — WEAK, essentially unproven.** No evidence was found of developers paying out of pocket for *codebase comprehension*. Existing individual products are productivity tools (Copilot Pro $10). **"Prohibitive pricing" is the #1 turn-off for personal-project tooling** (SO 2025). Do not lead with a prosumer motion.

**(c) Interview-prep / learning — consumer-initiated, employer-reimbursed, thin ARPU.** LeetCode **$35/mo**, ByteByteGo **$150/yr** — and ByteByteGo's founder states *"Many subscribers use their company's learning budget to cover the cost of this."* Corporate upskilling money is B2B and rising (Udemy Enterprise **66%** from 58%; Pluralsight **87.7%**; Udemy consumer **−9%**) — **but Coursera is still 66% consumer**, so that pattern does not generalise. SRS is proven in medicine (**94%/82%** Anki adoption) yet monetizes at **$6–10/mo**.

**Which pays: (a), decisively.** Lead with team onboarding/ramp-up, priced per-seat (~$15–40) or LOC-based (the established mechanism), sold to platform/DevEx/engineering leadership. Keep SRS as retention, not positioning.

---

## Statistics I could NOT verify

**Explicitly rejected — do not use these anywhere:**

| Claim | Status |
|---|---|
| "It takes **3–6 months** for a new developer to become productive" | **UNSOURCED VENDOR FOLKLORE.** No primary study with a sample size. |
| "**6–9 months** to full productivity" | **UNVERIFIED.** No primary source located. |
| "**$240,000** to onboard/hire a developer"; "$165,000–$240,000" | **UNVERIFIED VENDOR ARITHMETIC** — a vendor multiplying phantom "Forbes" salary percentages. The cited Forbes article/DOL dataset could not be located. |
| Google 2001 "Training New Employees" / **David Simms** paper | **COULD NOT BE LOCATED.** Do not use as an anchor. |
| "50%/125%/200% of salary" cost of losing junior/mid/executive | **UNVERIFIED** — attributed to "Forbes" with no title, URL, date or study. |
| "**$40K+ per hire (SHRM 2023)**" | **MISATTRIBUTED.** Real origin is MIT SMR 2005 endnote → **"Job Turnover Tab," *Business Week*, April 20, 1998**. Not SHRM, not 2023, and it measures **turnover** cost, not onboarding. |
| "8.2 months median ramp (HBR 2023 / Gallup 2024)"; "50% productivity in Month 1 (Gallup 2024)"; "Brandon Hall +70%"; "structured onboarding → 50% faster"; "€8,000–15,000/hire" | **UNVERIFIED** — no retrievable primary source for any. |
| Bauer et al. 2007 ("70 newcomer samples") | **Read only via a third-party aggregator** — PubMed returned an **HTTP 203 cookie wall**. |
| Sim & Holt 1998 (ICSE, "ramp-up problem") | **Flagged as UNREAD** — listed by Rastogi et al. but not fetched. |
| "3–9 months" ramp; "hyring.com" fig | **UNVERIFIED** (see the fabrication row above). |
| "Developers spend **10× more time reading than writing code**" | **NOT a JetBrains statistic and no trace found in JetBrains 2023–2025.** Commonly misattributed. |
| **"58% comprehension" as a 2024–2025 figure** | No post-2023 replication exists. Cite only as **Xia et al. 2018**. |
| Thomas Ball as an author of the 58% study | **WRONG** — the author list is Xia, Bao, Lo, Xing, Hassan, Li. |
| "Fjeldstad & Hamlen 1983" / "von Mayrhauser" as the origin of "half of a developer's time" | **UNVERIFIED** — only downstream citations found, never a primary measurement. |
| 58% comprehension **+ 24% navigation ≈ 82%** | **Secondary + vendor** (feenk). The 24% could not be verified — the TSE tables are paywalled (ACM returned **403**). |
| Harness: "**81%** spend more time in code review since AI adoption"; "28% report 30% longer" | **VENDOR + secondary.** The Harness report's methodology page and sample size **could not be located.** |
| SciTools Understand "perpetual + maintenance" pricing | **Apparently retired** — the live page shows only annual subscription ($100–120/mo, 12-month minimum). |
| "GitHub Copilot saves **40% of onboarding time**" | **NOT FOUND** on any page fetched. |
| CodeRabbit **$1.5B** valuation (Reuters) | **HTTP 401 (paywalled)** — headline only. **Do not cite.** |
| CodeScene funding / ARR | Only paywalled aggregators (PitchBook/Owler/Tracxn). No primary source. |
| SonarSource / Sourcegraph / Snyk revenue | **Not verified.** |
| Any **analyst dollar TAM** for developer tools / DevEx / IDP / codebase comprehension | **DOES NOT EXIST in public analyst material.** Gartner's & IDC's public evidence is adoption percentages only. IDC's DevOps Software Tools Forecast (`US52541124`) is **404/gated**. |
| Gartner Magic Quadrant for AI Code Assistants (2025) | Paywalled client document; only GitHub's blog summary was obtainable. |
| Evans Data developer population | `evansdata.com` failed TLS; only RedMonk's 2017 citation of a 2016 figure survives. |
| IDC China AI-coding market (Alibaba 47.6% share) | Surfaced only via secondary Chinese aggregators. |
| DX/Atlassian "**$6.9M/year** for 500 devs" | **VENDOR-modelled estimate**, not a measured outcome (built on an assumed salary; DX sells productivity measurement). |
| DXDP "improving documentation" percentage | **UNVERIFIED** — the PDF's label and percentage lists are in different orders. |
| **Survey/market data on out-of-pocket interview-prep spending** | **NO SUCH SURVEY EXISTS.** SO's 39.5% measures unpaid *time*, not dollars. |
| ByteByteGo / Educative / current LeetCode pricing | **JS-rendered**; LeetCode is **Cloudflare-403** — pricing recovered only via a Wayback snapshot (2024-01-01). ByteByteGo pricing is the Feb-2023 launch price only. |
| ByteByteGo revenue estimate (~$2M/yr) | **LOW-CONFIDENCE secondary estimate** (13,360 × $150). |
| Minelli et al. 2015 (ICPC) numeric time split | **UNVERIFIED** — IEEE abstract not machine-readable; Semantic Scholar rate-limited (HTTP 429). |
| **Sillito et al. 2008** sample size / study design | **UNVERIFIED** — publisher elided the abstract; the UBC "open access" link returned a 4.9 KB HTML page, not a PDF. (Paper and its nature as a question-taxonomy study *are* verified.) |

**URLs that failed verification (excluded or flagged inline):**
`dl.acm.org/doi/abs/10.1109/TSE.2017.2734091` → **403** (ACM blocks bots; DOI valid) · `sourcegraph.com/pricing` → **403** (used a Wayback snapshot) · `gitclear.com` 2025 AI code-quality report → **403** (dropped; not cited) · `scilit.net` → **403** · `codesee.io` → **404 / TLS failure** (product dead — itself a finding) · `onboard.io` → 200 but is **customer** onboarding, not developer onboarding · `giiresearch.com`, `marketresearch.com`, `evansdata.com`, `my.idc.com` → blocked or 404 · `dora.dev` download links → JS-rendered (PDF URLs recovered from HTML) · Google-hosted DORA PDFs → **405 on HEAD, 200 on GET** (a HEAD-based link checker falsely reports these broken) · `.../2024-dora-report.pdf` → **404** (a widely-cited wrong URL).

**⚠️ Re-verification note on the SEC filings (§7) — read before publishing.** The Pluralsight, Udemy and Coursera revenue figures in §7.1 were extracted by a parallel researcher from the SEC EDGAR filings linked there, with verbatim excerpts. **On final re-verification from this session, `sec.gov` returned HTTP 403 to automated requests even with a browser user-agent** (SEC blocks clients it does not recognise). The figures are *reported as retrieved*, not re-confirmed live. **Spot-check these three filings manually before they go into any deck** — they carry more decision weight than any other numbers in this document.

**Also note:** the GitKraken press release (`gitkraken.com/press/gitkraken-acquires-codesee-launches-devex-platform`) returned **200 when first fetched** (per the responsible researcher, dated 14 May 2024) but failed on **TLS/connection error** at re-verification. The CodeSee acquisition itself is independently corroborated by the dead domain (`codesee.io` → 404 / TLS failure), and the `gitkraken.com/press/` path should be retried manually.

**Every other URL in this document verified HTTP 200 at time of writing**, with the four exceptions flagged inline above (`dl.acm.org` 403, `sourcegraph.com/pricing` 403 via Wayback, `gitclear.com` 403 — dropped, Sillito's UBC "open access" link resolving to HTML).

**Disclosure on partial content:** the JetBrains 2025 section pages render all numbers as bare `%` placeholders and could not be read; Stack Overflow's results site and JetBrains pages are partially JS-rendered (the SO embedded dataset, however, *is* fully machine-readable and was used). Gartner rows come from Wayback snapshots of Gartner's own pages because `gartner.com` returns 403 to all automated fetches.
