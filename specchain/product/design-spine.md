# Design Spine: The One User Journey

**Purpose:** Define the end-to-end user flow that exercises every seam between capabilities. This is the walking skeleton (Cockburn, 2004) — the thinnest possible implementation through all architectural layers. Nothing gets built until this flow is validated.

**Methodology:** The walking skeleton is standard practice for greenfield projects with architectural uncertainty. Build the thinnest slice that touches every layer, then widen from a working core. This prevents the common failure mode of modular development: each module is internally consistent but the assembled product has no coherent user flow.

---

## The Scenario

**Shopper:** Alex, mid-30s. Two shopping sessions, one week apart, same store.

**Session 1:** Shopping for a new couch for the living room. Exploring styles, comparing materials, imagining how it fits the space. This is a considered purchase — $1,500-$3,000 range.

**Session 2 (one week later):** Shopping for dorm room furniture for their kid heading to college. Completely different intent — budget-constrained, checklist-driven, compact dimensions, functional over aesthetic.

**The critical test:** After Session 1, the system has a model of Alex as a home furniture shopper with premium taste. In Session 2, does the store keep pushing oversized sectionals and mid-century credenzas? Or does it recognize that the context has changed and adapt?

**Store:** Demo BigCommerce catalog with home furniture and furnishings.

**Why this scenario:**
- Tests persona shift within a single user across sessions (not just single-session refinement)
- Same product category (furniture), different intent (home vs. dorm)
- Exercises price sensitivity as a modifier ($2,500 budget vs. $400 budget)
- Surfaces the "stale persona" problem — what happens when the system's model is wrong?
- Universally relatable — everyone has bought furniture

---

## Act 1: The Couch (New Visitor, Exploratory Shopping)

### State 1: Cold Start Landing (URL: `/`)

**Who:** Alex, first-time visitor. No account, no history. Arrived from a Google search: "modern living room furniture."

**Signals available:**
- Referrer: Google organic (not a deal site, not a brand link)
- Search query: "modern living room furniture" (exploratory, lifestyle-oriented)
- Device: desktop, Saturday morning
- No UTM, no account cookie

**Persona inference:** Gatherer (0.8 confidence). Exploratory search + weekend + desktop = browsing mode, not buying mode.

**What Alex sees:**
- Standard storefront shell — logo, nav bar (Living Room, Bedroom, Dining, Office, Outdoor), search bar, cart icon (0), account link
- Hero section with lifestyle imagery of a styled living room
- Below the fold: "Trending Styles" editorial section, featured categories
- No AI indicators. No "personalized for you." Just a clean furniture store.

**Under the hood:**
- SvelteKit `+page.server.ts` reads referrer, sets initial persona signal in server session
- No generative UI yet — canonical baseline
- Page is SSR, cached at the edge, SEO-optimized with JSON-LD product schema

**Seams exercised:** Baseline storefront, persona seeding from search query

**Transition:** Alex clicks "Living Room" in nav, or searches "sectional sofa"

---

### State 2: Category Page — Gatherer Layout (URL: `/category/living-room?intent=gatherer`)

**What Alex sees:**
- Same shell (nav, search, cart, footer — identical to State 1)
- Content area renders a **Gatherer layout**:
  - Magazine-style hero: full-width lifestyle image of a styled living room, editorial headline ("The Living Room Edit")
  - Products shown as large editorial cards — each with a room-scene photo, not just a product cutout
  - "Shop by Style" section: Modern | Mid-Century | Scandinavian | Industrial
  - Products interspersed with editorial content ("How to choose the right sectional for your space")
  - Generous white space, 2-column grid, lifestyle-forward
- Subtle refinement entry point at bottom: "Need help narrowing it down?"

**Under the hood:**
- `/api/generate` called with persona=Gatherer, category=living-room
- Cache check: `gatherer:living-room` → cache HIT (pre-generated variant)
- Layout JSON served from cache (<50ms)
- Products from BC Storefront GraphQL, sorted by persona-fit score (Gatherer = high visual appeal, lifestyle context)
- Layout validated: CTA present on every card, prices visible, contrast passing

**Seams exercised:** Generative content area + enriched product data + cache strategy

**Critical UX check:** Shell is identical to State 1. Alex's mental model is intact — this looks like a normal furniture site that happens to have great editorial content.

---

### State 3: Dev Mode — Persona Contrast (not shown to Alex)

**Dev mode toggle (`?dev=true`) shows same URL with different personas:**

| Persona | Layout | Key Difference |
|---------|--------|----------------|
| **Gatherer** (active) | Magazine-style, lifestyle photos, 2-col, editorial | Inspiration-driven |
| **Hunter** | Dense 4-col grid, price-first, quick-add buttons, no editorial | Efficiency-driven |
| **Researcher** | Spec cards, dimension tables, material comparisons, review scores | Evidence-driven |

**Why this matters:** Same URL, same products, same shell, three fundamentally different content areas. This is the thesis proven.

---

### State 4: Product Detail Page (URL: `/product/modern-sectional-sofa`)

**What Alex sees:**
- Same shell
- Deterministic PDP structure:
  - Product images (multiple angles, room scene + product-only)
  - Product title, price ($2,199), sale badge if applicable
  - Variant selectors (fabric, color, configuration — L-shape vs. U-shape)
  - "Add to Cart" — always above fold
  - Dimensions, materials, care instructions (from BC + enrichment)
  - Reviews section
- **Gatherer-specific additions** (30% adaptive zone):
  - "How it looks in a room" — styled room photos featuring this sofa
  - "Pairs well with" — curated coffee tables, rugs, throw pillows (editorial cross-sell)
  - Style tags: "Modern," "Minimalist," "Neutral palette"

**Under the hood:**
- PDP structure is deterministic — image, price, CTA, description always in the same position
- Gatherer-specific sections are conditional components
- No LLM call — data-driven from BC + Supabase enrichment

**Seams exercised:** PDP structure + enrichment data + persona-conditional components

**Transition:** Alex wants to compare a few options before deciding.

---

### State 5: Refinement — "Something in leather, under $3,000" (URL unchanged, chat opens)

**What Alex sees:**
- Floating pill expands to refinement panel (bottom-right on desktop)
- Quick-action pills: "Compare options" | "Different material" | "Under $2,000" | "More colors"
- Alex types: "I'm looking for something in leather, seats 4+, under $3,000"

**Under the hood:**
- Message sent to `/api/refine`
- Agent receives: persona=Gatherer, category=living-room, viewed product=modern-sectional
- New constraints: material=leather, seating>=4, price<3000
- Agent state stored in Upstash Redis session

---

### State 6: Layout Reshapes (URL: `/category/living-room?material=leather&seats=4&price_max=3000`)

**What Alex sees:**
- Content area re-renders with skeleton loading
- Now showing leather sofas and sectionals only, 4+ seats, under $3,000
- Layout still Gatherer-style (editorial cards, lifestyle photos) but filtered
- "3 options match" — a manageable set, not overwhelming
- Refinement pill shows active filters

**Under the hood:**
- Delta update — content area replaced, shell untouched
- URL reflects the filtering outcome (shareable, bookmarkable)
- Agent conversation state stays in server session
- Back button returns to unfiltered category view

**Seams exercised:** Conversational refinement + delta regeneration + URL state management

---

### State 7: Add to Cart + Checkout

**What Alex sees:**
- Adds a leather sectional ($2,499) to cart
- Cart drawer: product thumbnail, name, color, price, quantity
- Proceeds to checkout → BC Embedded Checkout (iframe)
- Standard checkout: address, shipping, payment, confirmation
- Order confirmed

**Under the hood:**
- BC GraphQL `addCartLineItems` mutation
- Checkout is BC-managed iframe — no Prism UI in checkout
- Order webhook fires → feedback loop captures: persona=Gatherer, layout=MagazineStyle, refinements=1, outcome=purchase, cart_value=$2499

**Seams exercised:** Cart integration + BC checkout handoff + feedback capture

---

## Act 2: The Return (Returning Visitor, Same Intent — Proving Memory Works)

### State 8: Return Visit — Continuity (URL: `/`, next day)

**Who:** Alex returns the next day. Account cookie present. The system has a session summary from yesterday: Gatherer persona, living room furniture, modern/leather preference, purchased a sectional.

**What Alex sees:**
- Same shell, same storefront
- Landing page subtly reflects previous visit:
  - "Complete your living room" section: coffee tables, rugs, throw pillows that pair with the purchased sectional
  - Living Room category emphasized in the navigation or hero
  - Products weighted toward modern aesthetic and the $500-$1,500 range (complementary items, not another $2,500 sofa)
- No "welcome back Alex" banner. No "based on your purchase" label. The store just happens to show relevant things.

**Under the hood:**
- Server reads session cookie → retrieves cross-session preference summary from Upstash/Supabase
- Previous session: persona=Gatherer, purchased=leather-sectional, style=modern, price_range=premium
- Persona confidence: Gatherer (0.9) — high because returning user + matching context
- Cross-sell logic: query BC for products in living-room category with complementary tags, exclude sofas/sectionals (already purchased)
- Layout: Gatherer (magazine-style), but content is complementary picks, not the same browsing experience

**What this proves:** The system remembers. It doesn't treat every visit as a cold start. The model built in Act 1 carries forward correctly.

**Seams exercised:** Cross-session state retrieval + preference continuity + complementary product logic

**Critical UX check:** The continuity feels natural, not creepy. No "we tracked your purchase" language. The store just feels like it knows its inventory well.

**Transition:** Alex browses briefly, doesn't buy anything. Leaves. Returns a week later with a completely different need.

---

## Act 3: The Dorm Room (Returning Visitor, Different Intent — Proving Adaptation)

### State 9: Return Visit — Stale Model (URL: `/`, one week later)

**Who:** Alex returns. Account cookie still present. The system's model: "Gatherer persona, home furniture, premium taste, modern aesthetic, purchased leather sectional, browsed complementary items."

**New signals:**
- Alex searches: "dorm room desk"
- These two words conflict with everything the system "knows" about Alex

**What Alex sees:**
- Same storefront shell (nav, search, cart, footer)
- Search results appear...

**The critical moment — what SHOULD happen:**
- The system detects signal conflict: search="dorm room desk" vs. stored persona=Gatherer (home, premium)
- New signals override stale model: "dorm" = compact/budget, "desk" = functional/specific
- Persona shifts: Gatherer (0.2) → Hunter/Gifter hybrid (0.7). Budget sensitivity spikes.
- The system does NOT show oversized dining tables styled in a loft. It shows compact desks under $200.

**What SHOULD NOT happen:**
- "Based on your last visit, here are more modern sectionals!" — stale persona contamination
- Premium furniture with editorial lifestyle photos when the shopper clearly wants dorm basics
- Ignoring the search intent because the stored model says "Gatherer, premium"

---

### State 10: Category Page — Adapted Layout (URL: `/category/office?intent=hunter&context=dorm`)

**What Alex sees:**
- Same shell (unchanged)
- Content area renders a **Hunter layout** (not Gatherer):
  - Dense grid, 3-4 columns, product-forward (not lifestyle)
  - Price prominent on every card, sorted low-to-high by default
  - "Dorm Essentials" checklist header: Desk | Bed Frame | Storage | Lamp | Chair
  - Filter sidebar: "Compact / Dorm-Friendly" toggle, max dimensions filter
  - No magazine editorial, no "how it looks in a room" — functional, efficient, scannable
- Price sensitivity visible: "Budget Picks Under $100" section at top

**Under the hood:**
- Search query "dorm room desk" triggers persona re-evaluation
- Agent detects context shift: "dorm" keyword + budget products browsed = Hunter with high price sensitivity
- Previous Gatherer model deprioritized (not deleted — Alex might shop for home furniture again next month)
- Layout generated for Hunter persona with `priceSensitivity: 0.9` modifier
- Products sorted by: relevance to "dorm" semantic tag + price ascending

**Seams exercised:** Cross-session persona evolution + stale model recovery + price sensitivity modifier + semantic search ("dorm room desk" matches compact/budget products)

**Critical UX check:** The nav, cart, and checkout are still identical. The store didn't become a different website. It just recognized that today's shopping trip is different from last week's.

---

### State 11: PDP — Dorm Context (URL: `/product/compact-student-desk`)

**What Alex sees:**
- Same deterministic PDP structure (image, price, CTA — same positions as the sofa PDP)
- Product: Compact Student Desk, $129
- **Hunter-specific additions** (30% adaptive zone):
  - "Fits dorm rooms" dimension badge (48" x 24" — fits standard dorm)
  - "Complete the set" — matching bookshelf, desk lamp, chair (functional cross-sell, not editorial)
  - "Students also bought" social proof
  - No "how it looks in a room" editorial — replaced with practical specs

**Seams exercised:** PDP adapts its conditional zone to Hunter context without changing the deterministic structure

---

### State 12: Refinement — Budget Checklist (chat opens)

**What Alex sees:**
- Opens refinement: "I need a desk, a bed frame, and a storage unit. Budget is $400 total for everything."
- Agent responds with a curated bundle:
  - Compact desk: $129
  - Twin bed frame: $149  
  - 3-drawer storage: $89
  - Total: $367 (under budget)
- "Add all to cart" option

**Under the hood:**
- Agent recognizes multi-item shopping list pattern → switches to checklist mode
- Queries BC for each category with dimension/price constraints
- Builds a bundle recommendation (not a BC bundle product — just a curated set)
- Total calculated from live BC pricing — agent never fabricates prices

**Seams exercised:** Multi-item refinement + cross-category agent reasoning + agent-cart sync (all prices from BC)

---

### State 13: Dev Mode — The Full Story

**Dev mode overlay shows:**
```
Session History:
  Visit 1 (2026-03-28): Gatherer → Leather sectional purchased ($2,499)
  Visit 2 (2026-03-29): Gatherer (continuity) → Browsed complementary items, no purchase
  Visit 3 (2026-04-04): Persona shift detected
    Trigger: search "dorm room desk" conflicts with stored Gatherer model
    Resolution: Hunter (0.7) + price_sensitivity (0.9)
    Stored Gatherer model → deprioritized, not deleted

Current State:
  Persona: Hunter (0.7) / Gifter (0.3)
  Price sensitivity: 0.9 (dorm budget)
  Context: dorm furniture, multi-item checklist
  Constraints: budget=$400, compact dimensions, functional
  
Layout Decision: DenseGrid + ChecklistHeader
  Reason: Hunter persona + multi-item intent + budget constraint
  
Cache: MISS (novel context — first dorm query for this user)
T_composition: 156ms
Token cost: $0.006
```

**Seams exercised:** Full observability — cross-session story visible, persona evolution traceable, stale model recovery documented

---

### State 14: Checkout + Feedback Loop

**Checkout:** Same BC Embedded Checkout. Same experience as Session 1. Familiar, predictable.

**Feedback captured:**
- Same user, three sessions, two personas, two purchases
- Session 1: Gatherer, MagazineLayout, 1 refinement, $2,499 purchase
- Session 2: Gatherer (continuity), complementary browsing, no purchase
- Session 3: Hunter (adaptation), DenseGrid, 1 refinement (multi-item), $367 purchase
- Signal: persona shift within a single user is a real behavior pattern, not an error. The system correctly remembered (Act 2) AND correctly adapted (Act 3).

---

## Route Map

| Route | Type | AI Involvement |
|-------|------|---------------|
| `/` | Landing/Home | Persona seeding from signals |
| `/category/[slug]` | Category listing | **Generative content area** (persona-driven layout) |
| `/product/[slug]` | Product detail | Persona-conditional components (30% adaptive) |
| `/search` | Search results | Semantic search + persona-aware ranking |
| `/checkout` | Checkout | None (BC Embedded Checkout) |
| `/order/confirmation` | Post-purchase | None (feedback capture only) |

**Supporting UI (not routes):**
- Cart drawer (slide-in component, any page)
- Refinement panel (floating, category + product + search pages)
- Dev mode overlay (URL param toggle, any page)

The constraint isn't a route budget; it's that **every route shares the same shell, the same navigation, and the same cart.** The generative layer never breaks that contract.

---

## The Seam Map

```
                    Baseline Shell (deterministic)
                    ┌────────────────────────────────────┐
                    │  Nav  │  Search  │  Cart  │  Footer  │
                    ├────────────────────────────────────┤
Landing             │  Canonical baseline (no AI)         │
                    ├────────────────────────────────────┤
Category            │  ┌─ Generative Layout ────────────┐│
                    │  │  Enriched product data          ││
                    │  │  Trend badges (optional)        ││
                    │  │  Persona-specific components    ││
                    │  └────────────────────────────────┘│
                    ├────────────────────────────────────┤
PDP                 │  Deterministic + persona extras     │
                    ├────────────────────────────────────┤
Checkout            │  BC Embedded (iframe)               │
                    └────────────────────────────────────┘

Refinement ──── floats over any page, reshapes content area
Observability ── overlay on any page via ?dev=true
Design tokens ── generated by pipeline, consumed by all states
```

---

## State Persistence Model

Two types of state, two persistence strategies:

**Deterministic state → URL params** (shareable, bookmarkable, back-button friendly):

| State | Persisted in | Example |
|-------|-------------|---------|
| Category / page | URL path | `/category/living-room` |
| Sort, filters | URL params | `?sort=price&material=leather` |
| Persona (current) | URL param + cookie | `?intent=hunter` |
| Dev mode | URL param | `?dev=true` |
| Cart | BC cart ID in cookie | BC-managed |

**Agent state → server-side session** (cross-session, conversational):

| State | Persisted in | Lifetime |
|-------|-------------|----------|
| Conversation history (current session) | Upstash Redis | 30 min TTL |
| Accumulated constraints (current) | Upstash Redis | 30 min TTL |
| Persona confidence scores | Upstash Redis | 30 min TTL |
| User preference history (cross-session) | Upstash Redis or Supabase | 30 days |
| Previous session summaries | Supabase | Persistent (anonymized) |

The URL reflects the *outcome* of agent reasoning. The session stores *why*. Cross-session history (previous persona models) persists longer than single-session state, enabling the stale-model-recovery that Act 2 demonstrates.

---

## Walking Skeleton Scope

The walking skeleton implements Acts 1 and 2 with maximum cuts:

| Element | Walking Skeleton | Full Build |
|---------|-----------------|------------|
| Personas | Gatherer + Hunter (2 only) | All 4 + price sensitivity + mindset modifiers |
| Categories | 2 categories (living room, office/dorm) | Full BC catalog |
| Products | 30 products (15 per category) | Full catalog |
| Cross-session | Cookie-based returning user | Account-based with preference history |
| Refinement | 3 constraint types (material, price, dimensions) | Full natural language |
| Persona shift | Keyword-based detection ("dorm" triggers re-evaluation) | Behavioral inference + keyword + session analysis |
| Trends | Mocked (hardcoded badges) | Live Tavily |
| Enrichment | Manual persona-fit scores on 30 products | LLM pipeline across full catalog |
| Dev mode | Basic overlay (persona + layout decision) | Full Langfuse integration |
| Design tokens | brand-forge generated (done) | Same |
| Checkout | BC Embedded Checkout | Same |
| Cache | Simple key-value (persona:category) | Upstash persona-aware TTL |

**Two personas. Two categories. Thirty products. Three sessions. The full arc.** Then widen.

---

## Revised Build Sequence

```
Phase 0: Design Spine ← (this document)
Phase 1: Walking Skeleton
         Act 1 — Gatherer browsing couches, refinement, purchase
         Act 2 — Same user returns next day, system shows continuity
         Act 3 — Same user returns a week later for dorm furniture, persona shift, Hunter layout
Phase 2: Widen Personas (add Researcher, Gifter layouts)
Phase 3: Widen Catalog (full BC catalog, enrichment pipeline, cache)
Phase 4: Enrich (trends, full refinement NLP, observability dashboard)
Phase 5: Polish (accessibility audit, performance optimization, documentation)
```

This replaces the 7-epic parallel structure with a sequential widening from a working core.

Phase 1 proves three things:
- **Act 1:** The store can detect intent and generate an appropriate layout (the basics)
- **Act 2:** The store remembers you and serves continuity (memory works)
- **Act 3:** The store adapts when you change, not stereotypes you based on history (intelligence works)
