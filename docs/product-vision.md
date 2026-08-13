# Aisles — Product Vision

**Version**: 0.2.0
**Last Updated**: 2026-04-06
**Audience**: Product, Business Stakeholders, Developers

## Mission

Make AI personalization invisible to the shopper and visible to the business user.

A shopper on an Aisles-powered storefront should never notice that the experience is personalized. They see a store that feels right for them — organized the way they browse, showing the depth of detail they care about, with the copy that speaks to their moment. The adaptation is silent.

The business user — a merchandiser, brand manager, or growth lead — sees exactly the opposite. The Observe dashboard shows every signal, every inference rule that fired, every probability shift, and every layout decision. They understand why the store is behaving the way it is, and they have controls to influence it.

This tension — invisible to the shopper, transparent to the operator — is the product's core design principle.

Transparency is only meaningful if the system's behavior is *explainable*, and explainability is only possible because the AI operates under a formal correctness invariant: every layout the AI produces must be an element of a finite, typed set of valid configurations defined in code. This invariant (`∀I, ∀P, f(I, P) → S ∈ V`) is what makes the Observe dashboard possible — you can surface "which component the AI chose and why" only if the components come from a known vocabulary. Without the vocabulary constraint, the system would be a black box even to its own operators. See `docs/decisions/004-vocabulary-constraint-invariant.md` for the full rationale and enforcement.

## Current merchant-boundary capability

The generic layout engine is not the whole product boundary. For an external
reference storefront, Aisles now resolves authority through organization, brand,
route, surface, and zone policy. The Kibble implementation covers Preserve on
Home, product listing, search, and error surfaces. Product detail is limited to
development review. Cart, account, subscriptions, and the three canonical
checkout phase routes use source-native unavailable shells, so preserving their
anatomy never becomes a claim that the commerce service works. The bare
`/checkout` path remains the canonical source's 404.

The Kibble contract records 28 zone families as 36 exact expanded identities.
Eleven identities use content-backed native adapters; 25 are Trusted Hidden. A
15-route × three-viewport Kibble harness and a 90-cell Bealls internal regression
harness protect contract and screenshot mechanics. They do not establish approved
visual parity, deployed behavior, or functional commerce. Cold-review repairs,
human route approval, runtime policy writes and audit storage,
migration/deployment/live-provider verification, and Bealls external-reference
contracts remain open.

### Speed Over Accuracy: The Fail-Fast Principle

A slightly wrong layout served in 100ms is recoverable. A perfect layout served in 8 seconds is a bounce.

The inference engine is a continuous loop, not a one-shot decision. Every signal flush is a correction opportunity. Every refinement chat message is an explicit override. The gatherer-default cold start is a "safe wrong answer" that loads instantly and self-corrects as behavioral signals accumulate.

This principle governs trade-off decisions across the architecture:

- **Caching**: Serve stale-but-fast over fresh-but-slow. The Redis layout cache (1-hour TTL) means most visitors see a pre-generated layout, even if their persona has drifted since the layout was cached.
- **Streaming**: The SSE layout endpoint gets the editorial header visible in ~1 second before the grid is ready. Partial content beats waiting for complete content.
- **Data quality**: Enrichment quality is a background loop, not a rendering gate. Serve what you have. If enrichment data is missing or low-confidence for a product, commerce features silently degrade rather than blocking the layout.
- **Inference**: The base prior (`gatherer: 0.3`) ensures that even a session with zero signals gets a functional, exploration-friendly layout. The engine does not wait for behavioral signals before rendering — it renders immediately from request-time signals and refines as behavior accumulates.

The recoverable wrong answer is always preferable to the delayed right answer. The refinement chat, the continuous signal loop, and the session arc model (Phase 5) are all mechanisms for self-correction — they assume the first render was imperfect and provide pathways to improve it without the shopper ever noticing.

---

## Three-Brand Demo

Aisles ships with three built-in configurations that demonstrate the current generic renderer across furniture, electronics, and outdoor goods. The same inference rules, layout engine, and AI pipeline serve those configurations without modification.

| Brand | Domain | Positioning |
|---|---|---|
| **Haven** | DTC home furniture | Warm, editorial. Emphasizes lifestyle storytelling and aesthetic discovery. |
| **Volt** | Consumer audio & electronics | Technical, spec-forward. Emphasizes performance data and compatibility. |
| **Ember** | Outdoor lifestyle & fire | Rugged, seasonal. Emphasizes activity fit and weather-appropriate bundling. |

The configurations share no product data, no BC channel, and no visual identity. They do share the inference engine, the layout component vocabulary, the enrichment pipeline, and the prompt construction logic. `src/lib/brand/config.ts` is current renderer configuration, not a complete merchant design contract.

This supports reuse for brands designed around the shared renderer. It does not establish that an unrelated merchant can keep an existing storefront through theme configuration alone. Kibble is the current external-reference case: Preserve covers Home, product listing, catalog-display-only product detail, search, and error surfaces; and cart, account, subscriptions, and the three canonical checkout phase routes are source-native unavailable shells. The bare `/checkout` path remains the canonical source's 404. The contract and regression harnesses cover route anatomy, zone authority, provenance, and screenshot mechanics. Visual acceptance, runtime policy writes and audit storage, migration/deployment/live-provider verification, and Bealls external-reference contracts remain incomplete. The boundary and remaining work are described in the [organization, brand, and composition autonomy plan](organization-brand-autonomy-plan.md) and its [Kibble boundary retrospective](retrospective-kibble-reference-boundary.md).

---

## Business User Personas

Aisles is designed for three business user types. Each has different goals and interacts with different parts of the system.

### Merchandiser

The merchandiser is responsible for what appears on category pages and in what order. Their pain: the default BC sort order is based on creation date or manual ranking. It does not adapt to shopper intent.

With Aisles, the merchandiser runs the enrichment pipeline after adding products. The enrichment scores each product on four persona-fit dimensions (gatherer, hunter, researcher, gifter) and tags it with semantic intent labels. The AI layout engine uses these scores to present high-fit products first. The merchandiser sees the scores in the Observe dashboard's product enrichment panel.

Future: the admin layer (BC marketplace app) will let the merchandiser override persona-fit scores for specific products and pin items to specific positions within a persona layout.

### Brand Manager

The brand manager is responsible for voice, visual identity, and the narrative the store tells. Their pain: AI-generated copy often sounds generic.

The brand config's `prompt.voiceGuidance` field feeds into every layout generation prompt. Haven's voice guidance instructs the model to write "warm, editorial, magazine-like" copy; Volt's instructs it to be "precise and performance-focused." The brand manager owns this field.

Future: the admin layer will expose voice guidance as an editable text field. The brand manager will be able to test changes against live categories without a code deployment.

### Growth Lead

The growth lead is responsible for acquisition and conversion. Their pain: they can see UTM campaign performance in analytics but cannot see how incoming traffic intent maps to layout decisions.

The Observe dashboard exposes per-session signal attribution. A `utm_campaign=holiday-gift` tag on an inbound URL triggers the `utm-gift-campaign` inference rule, shifting the persona toward gifter, which produces a layout with editorial gift framing and curated price tiers. The growth lead can verify this chain without opening the codebase.

Future: the admin layer will surface aggregate intent distributions — what percentage of sessions from a given UTM source land as hunter vs. gifter — so growth leads can calibrate campaign messaging against layout outcomes.

---

## The Admin Layer

The BC marketplace app (tracked separately in `docs/aisles-admin.md`) is the business-user control plane for Aisles. It runs as a BigCommerce embedded app and is the channel through which non-technical users interact with the system.

Planned controls:
- **Brand voice editor**: edit `voiceGuidance` without a code deploy
- **Persona-fit overrides**: pin a product to a persona or suppress it from specific layouts
- **Rule weight tuning**: increase or decrease the influence of specific inference rules per channel
- **Cache invalidation**: force fresh layout generation for a category after merchandising changes
- **Observe access**: view the real-time Observe dashboard from within the BC admin

The admin app is the product's primary commercial surface. The inference engine and layout pipeline are the technology; the admin app is what a merchant buys.

---

## Competitive Positioning

### vs. Amazon's "Frequently Bought Together"

Amazon's recommendation engine is statistical: it identifies items that appear together in purchase histories across millions of orders. "Customers who bought X also bought Y." The correlation is real but the reasoning is opaque. If no one has ever bought two items together, there is no signal.

Aisles uses reasoning-based compatibility. The enrichment pipeline calls Claude Sonnet to evaluate each product against four persona archetypes. The model reasons about material, use case, price tier, and aesthetic fit — not co-purchase frequency. A new product with zero sales history gets correct persona scores on day one.

The distinction matters most for new brands and niche catalogs where statistical co-purchase data does not exist. This is exactly the BigCommerce merchant profile.

### vs. Rule-Based Personalization Platforms (Nosto, Dynamic Yield)

Existing personalization platforms for BC merchants are rule-based: "if the shopper is on mobile and in the furniture category, show the bestsellers widget." Rules require manual maintenance, do not compose well, and change what fills a slot rather than what slots exist.

Aisles infers intent continuously and uses that intent to drive the entire layout — not a single widget, but the number of columns, the presence or absence of editorial copy, the sort order, and the call-to-action pattern. Layout-level personalization requires an AI that understands composition, not rules that swap products.

### vs. Behamics (behavioral-science overlay platforms)

*Assessed 2026-07-30 against behamics.com, fetched in-session. Company facts from public profiles; the "patented AI" claim on their site is theirs and was not verified against a patent register.*

[Behamics](https://behamics.com/) (St. Gallen + New York, founded 2019, ~30 staff) is the closest operating comparable to the Aisles inference layer, and the most useful evidence that the underlying bet is real. Their Signals product classifies live sessions by whether a visitor is "exploring, comparing, deciding, hesitating, price-sensitive, or likely to need support next" and exposes that as a shared intent layer for downstream activation. That vocabulary maps nearly one-to-one onto the Aisles persona set plus its behavioral modifiers — gatherer/researcher/hunter alongside `priceSensitivity`, `urgency`, `familiarity` — arrived at independently.

**What the convergence means.** Real-time behavioral intent inference is a validated, monetized category, and it is no longer a differentiator. The 31-rule engine is the part of Aisles the market has already commoditized. Positioning that leads with inference sophistication will not survive contact with a buyer who has seen Behamics.

**Where the two genuinely diverge:**

| | Behamics | Aisles |
|---|---|---|
| Deployment | One line of JavaScript, platform-agnostic, runs isolated from the site | Replaces the storefront (SvelteKit + BigCommerce Storefront GraphQL) |
| Buyer + cost to adopt | CMO or head of e-commerce signs a pilot; no engineering migration | CTO approves a replatform |
| Unit of change | Selection and ordering inside a fixed template — Prime Shots (listing image choice), Smart Slide (carousel order), Visual Flow (PDP image order), Cart Clarity (cart sort), Product Guard (suppression) — plus overlay interventions | Page structure — which components exist, column count, presence of editorial copy, CTA pattern |
| AI approach | Predictive/causal ML, self-learning from session data | LLM generation constrained by a typed vocabulary (`∀I, ∀P · f(I,P) → S ∈ V`) |
| Operator surface | Incrementality proof — randomized control and holdout groups | Explainability — Observe shows which rules fired and why |
| Commercial model | Performance-based pricing, enabled by the holdout measurement | BC marketplace app; pricing undefined |

Note that Behamics' Automations *do* mutate composition at the DOM level. The difference is depth, not kind: they reorder and suppress within a template the merchant already owns; Aisles decides what the template is. That is a narrower gap than "they only inject widgets," and the narrower version is the one that holds up.

**The gap this exposes.** Behamics can charge on performance because they measure against randomized control and holdout groups — their published Signals figures carry the footnote "75% of Controlled Tests Showed a Positive Impact… median relative uplift versus control." Observe answers *why the system did what it did*; it does not answer *did this make money*. A merchandiser asks the second question. ADR-005 already specifies a holdout cohort and an eval harness (`docs/decisions/005-recommendation-architecture.md`, both still unchecked); nothing in `src/` implements them. Closing that is small relative to what is already built and is the line between a demo and a sellable product.

**The yardstick.** Behamics' own published uplift figures — read off the counter target values in their page markup, not the animated display — run single-digit medians with high teens as a stated ceiling:

| Product | Claimed uplift | Stated basis |
|---|---|---|
| Nudge | +12% revenue, +10% conversion, +5% AOV | none stated |
| Signals | +5% incremental revenue, +4% conversion | median vs. randomized control or holdout |
| Signals — Intent | +10% conversion, +18% engagement, −15% drop-offs | "results up to" — a ceiling, not a median |
| Diagnostic | +4% revenue, +6% conversion, −10% bounce | none stated |
| Merchandise | +4% revenue, +6% conversion, −10% bounce | none stated; identical figures to Diagnostic |

Only the Signals row carries a methodology. Diagnostic and Merchandise publish the same three numbers under the same three labels, which reads as platform-level figures presented per product. Seven years and ~30 people to reach that. The category monetizes but has not produced a winner — which is the honest read on the opportunity in both directions.

**Open check.** The page-structure differentiator rests on Nosto and Dynamic Yield still being template-bound in 2026, which this assessment did not re-verify. Behamics cannot falsify it — as a JavaScript overlay it has no access to the render pipeline. Nosto or Dynamic Yield shipping generative composition would.

**This repo is not the strongest instance of the concept.** `~/Workspace/dev/wip/bealls-aisles` composes eight canonical retail surfaces from a 36-block vocabulary across six surface-specific schemas, under a graduated composition-latitude model (`docs/architecture/engine/composition-taxonomy.md`) — wide on home, medium on listings, narrow on PDP, near-fixed at checkout. `~/Workspace/dev/wip/aisles-admin` is a working seven-tab BigCommerce embedded control plane. This repo is 4 blocks on the category page: the original proof of the invariant, not the frontier. Any competitive comparison should be drawn against `bealls-aisles`, and its latitude model — not the inference engine — is the transferable asset.

**Calibrated once, against real traffic, and it found three inverted rules.** In May 2026 a seven-week anonymized BigQuery extract from Sleep Country (29,870 events, 11,629 sessions) became the first external ground truth the persona engine faced. Ten of 28 rules were testable; the rest consume signals the privacy filter stripped. Three of the ten pointed the wrong way on a single category hop from off-price apparel to sleep retail:

| Rule | Designed to indicate | Real sessions |
|---|---|---|
| `referrer-social` | gatherer (social = inspiration) | 99.6% hunter |
| `in-session-search` (hunter half) | hunter (search = refining) | 1.4% hunter, 95.0% researcher |
| `single-category-focus` | hunter (staying put = decisive) | 0% hunter, 81% researcher |

That produced **per-brand rule gating** — inference branches its adjustment vectors on `brandId` — plus referrer-keyed cold-start priors. Both are reusable ideas, not Sleep Country patches. See ADR-011 and `docs/handoff/sleepcountry-bigquery-transfer.md` on branch `worktree-spike-cloudflare-portkey` (unmerged; `main` has none of it).

**Caveat, carried from ADR-011:** the fingerprinter shares low-level signals with the rules it scored, so precision figures are internal-consistency checks, not external validation. The directional finding survives; the absolute numbers do not.

**Live defect:** `@bcss/persona-core` was extracted from Aisles 0.3.0 before the calibration. No per-brand gating, no referrer priors, all three wrong-direction rules intact. Pointed at a non-apparel vertical, that is a real bug.

Keep two questions distinct — conflating them muddies the ask:

| Question | Apparatus | Evidence |
|---|---|---|
| Is the persona guess right? | built | one external test; 3 of 10 rules corrected |
| Does the generated layout make money? | not built | none |

The second needs a holdout that exists in none of the three repos.

The full assessment for stakeholders is `docs/memos/aisles-competitive-position.html`.

---

## Products as Content: The Feed Model

A category page is a For You page. Products are the content tiles.

This is not an analogy — it is a structural claim about how the Aisles architecture works. The inference engine, the signal pipeline, and the persona-driven layout system implement the same mechanisms that streaming platforms use to curate personalized feeds. The difference is the domain (commerce instead of media) and the terminal action (checkout instead of continued engagement).

### The Structural Mapping

| Streaming Feed | Commerce Equivalent | Aisles Implementation |
|---|---|---|
| Video/song tile | Product card | `product-grid` items, `hero-product` |
| FYP algorithm | Inference engine + persona-fit sort | `infer()` + `loadCategoryProducts()` sort by persona-fit |
| Skip/swipe | Quick bounce (< 3s dwell) | `quick-bounce-pattern` rule, weight 0.6 |
| Full watch | Long dwell (15s+) | `long-product-dwell` rule, weight 0.6 |
| Save to playlist | Add to cart | `rapid-cart-adds` rule, weight 0.7 |
| Genre/mood filter | Category + refinement chat | Category routing + `refine.message` signal |
| Thumbnail A/B test | Persona-driven card presentation | Same product renders as hero (gatherer) or compact card (hunter) |
| "For You" row | Modular CLP sections | AI selects `editorial-header` vs. `category-header` based on persona |
| Autoplay next | Cross-sell suggestion | `cross-sell-strip` component (see `docs/specs/intent-driven-commerce.md`) |

### Why This Framing Matters

**It changes what "browse" means.** In a traditional store, browsing is aimless navigation through a taxonomy. In a feed, browsing is a signal-rich activity where every pause, scroll, and skip updates the model. Aisles already treats browsing this way — `interact.scroll_depth`, `interact.dwell_time`, and `nav.back` are all engagement signals that streaming platforms pioneered.

**It reframes the cold-start problem.** A streaming feed with no history defaults to trending/popular content. Aisles defaults to the gatherer persona — the most exploration-friendly layout. Both are "safe wrong answers" that self-correct as signals accumulate. The fail-fast principle applies identically.

**It explains the component vocabulary.** The current eleven layout section types — `editorial-header`, `hero-product`, `product-grid`, `category-header`, `editorial-hero`, `lifestyle-price-hero`, `image-gallery`, `product-carousel`, `category-tile-grid`, `service-callouts-grid`, and `cluster-chip-row` — are not page templates. Generation receives a narrower subset for each persona. The AI acts as a feed algorithm, selecting which permitted section types to display and in what order, just as TikTok's FYP selects which content format (short clip, live stream, carousel) to serve.

### The Critical Difference: Time-to-Decision, Not Time-on-Platform

Streaming feeds optimize for engagement — more time on platform equals more value. Commerce feeds must optimize for *time-to-confident-decision* — the shopper should reach a purchase decision or a deliberate exit as efficiently as possible.

This means the feed should behave differently by persona:

- **Hunter feed**: Collapses rapidly. Dense grid, minimal editorial, quick-add buttons. The feed should feel like it has 3-4 "right answers" and nothing else. Time-to-decision: seconds.
- **Gatherer feed**: Expands and breathes. Editorial headers, hero products, lifestyle imagery. The feed should feel infinite and browsable. Time-to-decision: minutes (or multiple sessions).
- **Researcher feed**: Deepens rather than widens. Spec tables, comparison blocks, detailed descriptions. The feed narrows to the products being evaluated. Time-to-decision: one focused session.
- **Gifter feed**: Curates to a safe middle. Universal-appeal products at accessible price points, gift framing copy. The feed should feel like a concierge selected 8-10 options. Time-to-decision: one session.

The layout engine already produces these patterns through persona-specific component selection and column density. The feed model makes the intent explicit: a hunter's page should feel *short*; a gatherer's page should feel *rich*.

### The Amazon Inspire Lesson: Don't Force Discovery on Utility

Amazon Inspire — a TikTok-style shopping feed launched in late 2022 — was shut down in early 2025. The failure is instructive because Amazon had every advantage (massive catalog, purchase data, scale) and still could not make the feed model work.

The root cause was **intent misalignment**: Amazon's core customer base arrives with a utilitarian, high-intent mindset. They want to find a specific item quickly, not scroll a video feed for entertainment. Bolting a discovery experience onto a utility-first platform created friction rather than removing it. Amazon subsequently redirected users toward Rufus, its conversational AI assistant — suggesting that for high-intent shoppers, agentic conversation outperforms visual feeds.

TikTok Shop succeeds where Inspire failed because commerce is parasitic on the entertainment experience. Users arrive to watch content; the commerce is incidental. The product wins on how compellingly a creator presents it, not on search relevance.

**What this means for Aisles**: The four-persona model is the architectural defense against the Inspire failure. A hunter should never receive a gatherer's discovery feed — that is literally the mistake Amazon made. The inference engine exists to detect intent and match it to the right feed format:

- **Gatherer** → discovery feed (editorial, expansive, exploratory). This is the persona where the "For You" model fully applies.
- **Hunter** → utility interface (dense grid, sort/filter, quick-add). This is a search-first experience that should feel like efficient retrieval, not media consumption.
- **Researcher** → comparison tool (spec tables, side-by-side, detailed descriptions). This is closer to a B2B procurement interface than a content feed.
- **Gifter** → curated selection (concierge-style, limited options, gift framing). This is a guided experience with intentional constraints.

The feed model is not universal. It applies fully to gatherers, partially to gifters, and barely at all to hunters and researchers. The inference engine's job is to detect which model the shopper needs and deliver it — not to default to discovery for everyone.

### Digital Pacing: Feed Length as a Persona Variable

Streaming platforms control engagement through pacing — the intentional design of content density and endpoint visibility to match the user's cognitive bandwidth. In commerce, pacing determines whether the feed feels infinite (gatherer) or finite (hunter).

The ASOS model demonstrates effective commerce pacing: 72 products per view with a "Load More" button rather than true infinite scroll. This provides continuity without the cognitive overload of an endless feed, and each batch gets a unique URL (solving the SEO problem of dynamic infinite scroll).

Aisles should implement persona-specific pacing:

| Persona | Feed Behavior | Product Count | Endpoint Signal |
|---|---|---|---|
| **Gatherer** | Continuous scroll with editorial breaks | 24+ products, load-more | "Keep exploring" — no hard end |
| **Hunter** | Dense grid with visible count | 8-12 products, all visible | "Showing 8 of 24" — progress indicator |
| **Researcher** | Paginated comparison view | 6-8 products per view | Page numbers — stable backtracking |
| **Gifter** | Curated finite set | 8-10 products, no load-more | "Our picks for you" — deliberate limit |

The key insight from cognitive load research: approximately 42% of users abandon purchases due to cognitive overload from dense, unstructured information streams. The hunter's dense grid avoids this by being *short* and focused. The gatherer's infinite scroll avoids it by being *paced* with editorial breaks that provide natural rest points — the digital equivalent of finishing an aisle in a physical store.

**Decision closure** is the mechanism: each persona needs a different "I'm done with this section" signal. Hunters need explicit progress ("3 of 12 viewed"). Gatherers need natural break points (editorial blocks between product rows). Researchers need page boundaries they can navigate back to. Gifters need the confidence that a small curated set is sufficient.

This is not yet implemented in the layout engine. The current `product-grid` component renders all products in a single block. Persona-specific pacing requires the layout prompt to control product count and endpoint behavior, and may require a new component (`load-more-trigger` or `pagination-bar`) in the vocabulary.

### Funnel Compression: Discovery as Transaction

Traditional marketing follows a linear path: awareness, consideration, conversion. Discovery commerce collapses these stages into a single interaction. A shopper discovers a product in their feed, consumes the associated content (editorial copy, specs, lifestyle imagery), and adds to cart — all within the same page view.

Aisles already implements funnel compression through the layout engine. A gatherer's `editorial-header` creates awareness; the `hero-product` drives consideration; the `product-grid` with quick-add enables conversion — all in a single scroll. The refinement chat compresses the funnel further: a shopper can discover, evaluate, and narrow their options through a multi-turn conversation without navigating to a separate search or filter interface.

The deeper implication is for **semantic enrichment**. If products are content in a discovery feed, they need "vibe-coded" attributes — not just technical specs. The enrichment pipeline's semantic tags (`"statement-piece"`, `"dorm-friendly"`, `"cozy"`) are the commerce equivalent of Netflix's mood tags. Whether a shopper searches for "puffy sleeves," "balloon sleeves," or "statement sleeves," enriched data should connect these varied expressions to the same product taxonomy.

The current enrichment pipeline produces semantic tags, but they are consumed only by the layout prompt (for copy generation) and persona-fit scoring. A future search implementation should use these tags for semantic matching — connecting natural language intent to products through meaning, not keywords.

### The Agentic Future: Beyond the Visual Feed

The visual feed may be a transitional form. Amazon's pivot from Inspire (visual feed) to Rufus (conversational AI) suggests that for high-intent shoppers, dialogue outperforms scrolling. Research indicates 58% of consumers now prefer AI assistants over search engines for product recommendations.

Aisles is positioned for this transition. The refinement chat is already an early-stage conversational agent that modifies the layout through natural-language constraints. The progression:

1. **Today**: Visual feed (persona-driven layout) + refinement chat (constraint stacking)
2. **Near-term**: Conversational discovery where the chat can proactively surface products, not just filter them
3. **Future**: The visual feed becomes a *rendering surface* for the conversational agent's selections — the shopper tells the agent what they need, and the feed reorganizes in response

This aligns with the Prism north star (`specchain/product/north-star.md`): the agentic orchestration layer is the durable differentiation, and the visual feed is one rendering mode among several.

### The Creative Asset Challenge

If products are content, the brand needs enough creative variation to make each persona's feed feel authentic rather than mechanical. A single product photo shown to all four personas breaks the illusion. Streaming platforms solve this with thumbnail variants — Netflix serves different artwork per user segment for the same film.

The Aisles equivalent is persona-specific product presentation:

- **Today**: The AI writes different copy per persona (editorial for gatherer, spec-forward for researcher). Product images are static — the same photo appears in all layouts.
- **Future**: The enrichment pipeline could tag products with multiple image assets (lifestyle shot, detail shot, in-context shot, white-background shot). The layout engine selects the image variant that matches the persona: lifestyle for gatherer, detail for researcher, white-background for hunter.

This is not yet implemented but is the natural next step. Without image variation, the "feed" metaphor is half-realized — the structure adapts but the visual content does not.

---

## What Streaming Platforms Teach Us

Aisles draws explicit inspiration from the personalization systems built by Netflix, Spotify, and Hulu. These are not analogies — they are the most rigorous deployed examples of behavioral personalization at scale. The signal expansion work (see `docs/signals-and-inference.md` and `docs/specs/behavioral-signals.md`) is directly motivated by what these platforms learned.

### Behavior Beats Declared Intent (Netflix)

Netflix does not ask users what they want to watch. It measures what they actually do: watch completion percentage, skip rate during playback, time-of-day viewing patterns, device context, and whether a title was rewatched. Declared preferences (star ratings) were retired because they reflected what users thought they should like, not what they actually engaged with.

For Aisles, this means search queries and UTM tags — the declared signals the current engine uses — are less informative than behavioral signals: how long did the shopper dwell on a product card, did they scroll past it quickly, did they open the refinement chat and then close it without acting?

### Negative Signals Are the Most Informative (Spotify)

Spotify's recommendation system treats a skip as more informative than a play. If a user skips a track in the first ten seconds, that is strong negative feedback. If they let it play to completion, that is weak positive feedback. The asymmetry is intentional: skips reveal preference boundaries; plays confirm existing taste.

For Aisles, the equivalent is: a shopper who removes an item from their cart, scrolls quickly past a product category, or closes the refinement chat without adding anything — these are strong negative signals about what this persona is not. The planned negative signal expansion (`bounce detection`, `cart removal`, `chat abandonment`) directly mirrors Spotify's skip model.

### Continuous Embeddings, Not Fixed Categories (All Three)

Netflix, Spotify, and Hulu all moved away from human-curated genre categories toward continuous embedding spaces. A film is not "action" or "drama" — it is a vector in a high-dimensional space, and users are also vectors. Recommendation is nearest-neighbor lookup in that space.

Aisles takes the same approach at the product level. Each product gets a persona-fit score that is a continuous 0.0–1.0 value, not a binary "for gatherers" flag. A sofa with a gatherer score of 0.91 and a hunter score of 0.42 can appear in both layouts — prominently in a gatherer layout, briefly in a hunter layout. There is no hard exclusion.

### Explore vs. Exploit Tradeoff

All three platforms balance showing content the user is predicted to like (exploit) with showing content that might expand their taste or discover new preferences (explore). Pure exploitation leads to filter bubbles; pure exploration feels random.

Aisles does not yet implement explicit explore/exploit balancing, but the base prior (`gatherer: 0.3, hunter: 0.2, researcher: 0.2, gifter: 0.1`) is a structural expression of this tradeoff. On a cold-start session with no signals, the system defaults to the gatherer persona — the most exploration-friendly layout — rather than a uniform distribution. This is a deliberate choice: browsing is safer than efficiency-mode as a default.

### Session Context: Device, Time, and History

Netflix serves different thumbnails on a phone at 11pm than on a TV on Saturday morning. The same user, the same title, different context. The presentation adapts to the moment.

Aisles implements this via the `mobile-evening-impulse` rule (mobile + late evening → mild hunter boost + urgency) and `desktop-weekday-deliberate` (desktop + business hours → researcher boost). These are coarse proxies for what the streaming platforms do with much richer context. The session arc modeling phase (Phase 5 of the behavioral signal expansion) will build toward tracking persona trajectories across a session rather than inferring a static snapshot per page load.

### Presentation Personalization (Netflix Thumbnail Selection)

Netflix runs A/B tests on thumbnail artwork per user segment. A thriller with an action-oriented thumbnail is shown to users whose viewing history skews action-forward; the same film gets a character-portrait thumbnail for users who engage with character dramas. Same content, different presentation optimized per user.

The Aisles equivalent is already in production: the same product appears as a hero with a lifestyle description in a gatherer layout, and as a compact card with specs only in a hunter layout. The `PERSONA_DEFINITIONS` in `src/lib/server/layout-prompt.ts` encode these presentation rules. The AI selects components and writes copy that matches the presentation style for the inferred persona.

---

## What Social Feed Platforms Teach Us

The streaming platform lessons above focus on content consumption — sessions measured in minutes, with a single content stream. Social feed platforms (TikTok, YouTube, Instagram) operate at a different timescale and interaction density. Their feeds process hundreds of micro-decisions per session, making them the closest deployed analogs to an e-commerce browsing session where a shopper scans dozens of product cards in rapid succession.

These platforms have transitioned from simple "systems of record" (showing what you follow) to "systems of intelligence" (anticipating what you want). They utilize a hyper-personalization stack that processes real-time behavioral signals to create a "segment of one" experience — the same architectural goal as Aisles.

### The Behavioral Skip Model (TikTok)

TikTok's "For You" Page (FYP) is the industry benchmark for behavioral modeling. It prioritizes what you actually do over what you say you like.

- **Negative signals as primary drivers.** TikTok treats a "skip" (swiping away in the first few seconds) as a much stronger signal than a full watch. This "skip model" allows the algorithm to quickly map the boundaries of your interests. The asymmetry is deliberate: rejections reveal preference boundaries faster than confirmations.
- **Continuous embeddings.** Instead of placing users in broad categories (e.g., "Gamer"), TikTok treats every user and every video as a vector in a high-dimensional mathematical space. Recommendation is nearest-neighbor lookup in that space.
- **Engagement loops.** The system uses continuous feedback to reinforce and refine your preference vector with every interaction, creating a loop of co-created value that tightens with each session.

**What this validates in Aisles**: The negative signal expansion (Phase 3 — `quick-bounce-pattern`, `cart-removal-indecision`) directly mirrors TikTok's skip model. The probability vector approach, where each shopper is a continuous distribution rather than a hard label, is the Aisles equivalent of TikTok's embedding space.

**What this challenges in Aisles**: See "Implementation Considerations" below — negative signal weight asymmetry and continuous vs. discrete persona modeling.

### Contextual Awareness and Serendipity (YouTube)

YouTube's feed focuses on the "moment" and deliberately breaking the filter bubble.

- **Contextual format modeling.** YouTube serves different content based on device and time of day. The algorithm predicts shorter, trending clips on a mobile phone late at night, but longer-form "deliberate" content on a TV during the weekend. Critically, this is not just a ranking change — it changes the *format* of the content served, not just the selection.
- **Serendipity by design.** To prevent the echo chamber effect, YouTube deliberately blends personalized picks with trending or exploratory content, encouraging discovery outside established patterns. This is an explicit implementation of the explore/exploit tradeoff.
- **Watch completion as intent proxy.** Similar to Netflix, YouTube prioritizes watch completion percentage as a key signal. Partial completion signals exploration; near-complete signals engagement.

**What this validates in Aisles**: The `mobile-evening-impulse` and `desktop-weekday-deliberate` rules implement contextual awareness. The `gatherer: 0.3` cold-start prior functions as a structural serendipity mechanism. Dwell time signals (`longDwellCount`, `quickBounceCount`) serve as watch-completion proxies.

**What this challenges in Aisles**: See "Implementation Considerations" below — device-aware format hints in layout generation.

### Modular UX and Attention Management (Instagram Reels)

Instagram Reels uses a modular, adaptive interface to manage the "attention economy."

- **Real-time signal ingestion.** The feed monitors clicks, scrolls, and dwell time through perceptive data pipelines, rearranging the content hierarchy in sub-second latency.
- **Modular component ranking.** The interface is not a fixed page but a collection of modular UI blocks. A ranking system determines which reels, ads, or suggested posts to display based on real-time intent.
- **Aesthetic vs. utility adaptation.** For discovery-based feeds, the system prioritizes high-aesthetic content (analogous to our gatherer persona) unless search history indicates specific product intent (analogous to hunter or researcher).

**What this validates in Aisles**: The layout engine's component vocabulary — where the AI selects from hero blocks, dense grids, spec tables, and editorial sections — is structurally identical to Instagram's modular block ranking. The emitter's 5-second flush cycle with immediate flush for high-priority events mirrors the real-time ingestion pipeline. The persona-driven aesthetic/utility axis (gatherer = editorial, hunter = dense grid) directly maps to Instagram's aesthetic vs. utility adaptation.

### Algorithmic Mechanisms Comparison

| Platform | Primary Signal | Core UX Objective | Strategy to Avoid Stagnation |
|---|---|---|---|
| **TikTok** | Swipes/Skips (Negative) | Intent Anticipation | Continuous Vector Shifts |
| **YouTube** | Watch Time & Context | Minimized Time to Value | Serendipity by Design |
| **Instagram** | Dwell Time & Interaction | Attention Management | Modular UX Adaptation |
| **Aisles** | Behavioral Signal Mix | Persona-Driven Layout | Gatherer-Biased Cold Start |

---

## Implementation Considerations

The streaming and social feed platform analysis surfaces three areas where Aisles should evolve. These are not bugs — the current architecture supports all three changes — but they represent weight tuning, prompt enrichment, and philosophical decisions that should be made deliberately.

### 1. Negative Signal Weight Asymmetry

**The pattern**: TikTok and Spotify both weight negative signals (skips, swipe-aways) more heavily than positive signals (watches, saves). The reasoning is that rejections reveal preference boundaries faster than confirmations. A user who listens to a full song may be passively tolerating it; a user who skips after 3 seconds is actively rejecting it.

**Current state**: In `src/lib/signals/inference.ts`, negative rules have the same or lower weight as their positive counterparts:

| Rule | Weight | Signal Type |
|---|---|---|
| `long-product-dwell` (positive) | 0.6 | Engagement confirmation |
| `quick-bounce-pattern` (negative) | 0.6 | Engagement rejection |
| `rapid-cart-adds` (positive) | 0.7 | Purchase intent |
| `cart-removal-indecision` (negative) | 0.7 | Purchase reconsideration |

**Consideration**: If the TikTok/Spotify model is correct, negative signals should outweigh their positive counterparts. A possible rebalance:

- `quick-bounce-pattern`: 0.6 → **0.8** (bouncing is a stronger signal than dwelling)
- `cart-removal-indecision`: 0.7 → **0.85** (removing from cart is more informative than adding)

**Risk**: Over-weighting negative signals can cause the persona to oscillate too quickly. A shopper who bounces off one product because they accidentally tapped it should not have their entire session recharacterized. The current `quickBounceCount >= 2` threshold mitigates this — the rule requires a *pattern* of bounces, not a single event — but the higher weight amplifies the effect when the threshold is met.

**Recommendation**: Test the asymmetry with a modest bump (0.7 for bounce, 0.8 for cart removal) before going to full TikTok-level asymmetry. Monitor the Observe dashboard's shift detection rate — if shifts increase by more than 30% after the weight change, the asymmetry is too aggressive.

### 2. Device-Aware Format Hints in Layout Generation

**The pattern**: YouTube does not just change *which* content appears on different devices — it changes the *format*. Short-form clips on mobile at night; long-form documentaries on TV on weekends. The device context affects presentation structure, not just content ranking.

**Current state**: The `mobile-evening-impulse` and `desktop-weekday-deliberate` rules adjust persona weights based on device and time, but the layout prompt does not receive `deviceType` as a direct input. The AI infers format from the persona label alone. This means a hunter on mobile and a hunter on desktop get the same layout structure — the AI has no signal to prefer compact cards over wide spec tables.

**Proposed change**: Pass `deviceType` to `buildLayoutPrompt()` and add a format hint to the prompt template:

```
DEVICE CONTEXT: mobile
FORMAT GUIDANCE: Prefer vertically-stacked components. Use compact product cards
over wide spec tables. Limit editorial blocks to 2 sentences. Prioritize tap
targets over hover interactions.
```

```
DEVICE CONTEXT: desktop
FORMAT GUIDANCE: Use the full component vocabulary. Wide spec tables and
side-by-side comparisons are appropriate. Editorial blocks can be longer-form.
Grid layouts can use 3-4 columns.
```

**Where to change**: `src/lib/server/layout-prompt.ts` — add a `deviceType` parameter to `buildLayoutPrompt()` and a conditional format guidance block in the prompt template. No new signals, no new rules, no schema changes.

**Risk**: Low. The format hint is advisory — the AI can blend it with persona guidance. A researcher on mobile should still see specs, but in a vertically-stacked layout rather than a wide comparison table.

### 3. Continuous vs. Discrete Persona Modeling

**The pattern**: TikTok does not use personas at all. Every user is a point in a continuous embedding space that drifts with each interaction. There are no "types" — only positions in a mathematical space.

**Current state**: Aisles uses four discrete persona labels (gatherer, hunter, researcher, gifter) with a continuous probability distribution over them. This is a hybrid approach — the probability vector provides continuity, but the final layout prompt still collapses to a `primary` label when confidence is high (>= 0.3). The Phase 4 blended layout work partially addresses this by passing probabilities to the prompt for low-confidence sessions.

**The tension**: Discrete personas are legible to business users. A merchandiser understands "this session is a hunter" far better than "this session is at position [0.12, 0.61, 0.22, 0.05] in persona space." The Observe dashboard, the admin layer, and the entire business-user experience depend on named personas.

**Recommendation**: Do not move to a fully continuous model. The four-persona framework is a product feature, not a technical limitation — it makes the system explainable to non-technical business users. Instead, continue deepening the probability vector's influence on layout generation:

- Phase 4 (already planned): Pass full probabilities to the prompt for low-confidence sessions.
- Future: Always pass probabilities, even in high-confidence sessions. Let the AI blend secondary persona elements (e.g., a strong hunter session with a 25%+ researcher score gets a specs section even in a hunter-first layout). The `primary` label remains the headline in Observe; the probability vector is the fine-grained control.

This preserves the business legibility of named personas while capturing the continuous-space benefits that TikTok demonstrates.

---

## Related Documentation

- `docs/architecture.md` — system architecture and data flow
- `docs/signals-and-inference.md` — signal types and inference rules in detail
- `docs/specs/behavioral-signals.md` — implementation spec for signal expansion
- `docs/multi-brand.md` — brand configuration and setup
- `docs/aisles-admin.md` — BC marketplace admin app (planned)
- `docs/observe.md` — Observe dashboard for business users and demos
