# Spec: Funnel Compression — Intent-Driven Commerce in the Feed Model

**Version**: 0.2.0
**Last Updated**: 2026-04-09
**Audience**: Product, Developers, Technical Stakeholders
**Status**: Design — not yet implemented

## Purpose

In the "Products as Content" feed model (see `docs/product-vision.md`), the purchase funnel — awareness, consideration, conversion — collapses into a single continuous experience. The category page is a For You page. Products are content tiles. The inference engine detects intent in real time. Every element of the commerce experience should respond to that intent.

The current Aisles implementation uses inference output to drive layout generation only. This spec extends inference reach across the **entire funnel** — from product discovery through checkout — identifying eight categories of funnel compression, each with persona-specific behavior.

Promotions and incentives are one category. Trust acceleration, information completeness, decision confidence, friction removal, cart continuity, post-add momentum, gifting flow, and contextual reassurance are the others. Each category has its own conversion impact, and each one behaves differently depending on the detected persona.

---

## The Funnel Compression Framework

In a traditional storefront, the shopper progresses through discrete stages: browse → evaluate → decide → checkout. Each stage is a separate page or interaction, and each transition is a potential drop-off.

In a feed model, these stages happen simultaneously within the same scroll. The layout engine already compresses the funnel structurally — an `editorial-header` creates awareness, a `hero-product` drives consideration, a `product-grid` with quick-add enables conversion, all in one page view. But the commerce *features* that support each stage are still missing or static.

The framework below maps eight categories of commerce enhancement to the four personas. Each cell answers: "What does this persona need at this funnel stage to move toward checkout?"

| Category | Gatherer | Hunter | Researcher | Gifter |
|---|---|---|---|---|
| **Trust** | Editorial curation, "Editor's pick" | Price guarantees, return policy | Expert reviews, verified specs | Gift recipient satisfaction signals |
| **Information** | Lifestyle context, styling ideas | Total cost (price + shipping) | Full specs, comparison data | Delivery timeline, gift wrapping |
| **Confidence** | Mood/vibe alignment | Best deal confirmation | Spec-level comparison | "Safe choice" reassurance |
| **Friction** | Save to collection, easy return | Buy Now, express checkout | Side-by-side, then one-click | Gift-specific checkout flow |
| **Incentives** | Free shipping threshold nudge | Instant coupon, budget alternatives | Premium alternative justification | Gift bundle pricing |
| **Cart** | "Keep browsing" encouragement | Quick checkout path | "Review your comparison" | Gift message, wrapping options |
| **Post-add** | Aesthetic cross-sells | Practical accessories | Compatible upgrades | Gift accessories, cards |
| **Reassurance** | Style guarantee, easy returns | Price match, lowest price signal | Warranty, durability data | Gift receipt, easy exchange |

---

## Category 1: Trust Acceleration

### The Problem

Zero reviews, ratings, or social proof exist in the current implementation. Trust is the #1 conversion factor for considered purchases (furniture, electronics, outdoor gear — exactly the three Aisles verticals). A shopper who doesn't trust the product or the store abandons regardless of how good the layout is.

### Persona-Specific Trust Signals

Trust is not generic. Different personas need different evidence to feel confident.

| Persona | Trust Signal | Why It Works |
|---|---|---|
| **Gatherer** | "Editor's Pick," curated collection badge, lifestyle photography credits | Gatherers trust editorial authority and aesthetic curation |
| **Hunter** | Star rating + review count, price-match guarantee, return policy prominence | Hunters trust volume signals and financial safety nets |
| **Researcher** | Expert review excerpts (Wirecutter, ConsumerReports), verified spec accuracy, material certifications | Researchers trust third-party expertise and verifiable data |
| **Gifter** | "Popular gift" badge, recipient satisfaction rate, gift return policy | Gifters trust social validation and safety-net policies |

### Feed Integration

In the feed model, trust signals are **embedded in the product tile**, not isolated on a separate PDP. The product card component should render persona-appropriate trust signals inline:

```
Gatherer card:  [Lifestyle image] "Editor's Pick" badge + editorial pull-quote
Hunter card:    [Product image] ★★★★☆ (142 reviews) + "Free returns"
Researcher card: [Detail image] "Wirecutter Recommended" + key spec highlight
Gifter card:    [Gift-styled image] "Popular gift" + "Easy returns for recipients"
```

### What's Needed

**From BigCommerce**: Product reviews and ratings are available via the Storefront GraphQL API (`reviews` field on product queries). Currently not fetched. Enable the query and pass review data to both the layout prompt and the card components.

**From Enrichment Pipeline**: New fields:

| Field | Type | Source |
|---|---|---|
| `editorialBadge` | `string \| null` | Merchant-set or LLM-inferred ("Editor's Pick", "Best Value", "Most Popular") |
| `expertMentions` | `{ source: string, quote: string, url: string }[]` | LLM web search during enrichment (optional, high effort) |
| `trustSignals` | `string[]` | LLM-extracted from description ("certified organic", "10-year warranty", "handcrafted") |

**New Component**:

| Component | Purpose | Props |
|---|---|---|
| `trust-badge` | Inline trust signal on product cards | `type` (editorial/rating/expert/gift), `content`, `persona` |

### Priority: **P0**

Trust signals have the highest conversion impact per unit of effort. Fetching reviews from BC and displaying star ratings on product cards is a small change with outsized effect.

---

## Category 2: Information Completeness

### The Problem

Unknown costs are the #1 cause of cart abandonment (48% of abandonments per Baymard Institute). Aisles shows "Shipping and taxes calculated at checkout" — which means the shopper discovers the true cost only after committing to the checkout flow. In a feed model, every product tile should carry enough information that the shopper never needs to leave the feed to answer basic questions.

### What Information Is Missing

| Information | Current State | Impact on Abandonment |
|---|---|---|
| Shipping cost | Hidden until checkout | **Critical** — 48% of abandonments cite extra costs |
| Delivery estimate | Not shown anywhere | **High** — "When will I get it?" is a top-3 purchase question |
| Stock status | Not fetched from BC | **High** — prevents add-to-cart of unavailable items |
| Return policy | Not surfaced in feed or PDP | **Medium** — reduces perceived risk |
| Product variants | Not implemented (no size/color selection) | **High** — can't purchase configurable products |

### Persona-Specific Information Priority

| Persona | Primary Information Need | Feed Placement |
|---|---|---|
| **Gatherer** | "Can I picture this in my home?" — lifestyle context, dimensions in room scale | Editorial copy, lifestyle image captions |
| **Hunter** | "What's the total cost?" — price + shipping + tax estimate | Prominent on card, total-cost callout |
| **Researcher** | "How does this compare on specs?" — full spec sheet, material detail | Spec rows on card, expandable detail |
| **Gifter** | "Will it arrive in time?" — delivery estimate, gift wrapping availability | Delivery badge on card, gift options |

### What's Needed

**From BigCommerce**:
- Inventory status: `inventory.isInStock`, `inventory.aggregated.availableToSell` — available in Storefront GraphQL, not currently fetched
- Shipping estimates: BC's shipping quote API can provide estimates given a destination. For feed-level display, use a default destination (geo-IP or stored preference) and show "Estimated delivery: [date]"
- Product variants: `variants` and `options` fields in Storefront GraphQL — required for size/color/material selection

**New Components**:

| Component | Purpose | Props |
|---|---|---|
| `stock-badge` | Inline stock status on product cards | `status` (in-stock/low-stock/out-of-stock), `quantity` |
| `delivery-estimate` | Estimated delivery date on cards and PDP | `estimatedDate`, `shippingMethod`, `isFree` |
| `variant-selector` | Size/color/material picker on PDP and modal | `options`, `variants`, `selectedVariant` |
| `free-shipping-bar` | Progress bar toward free shipping threshold | `currentTotal`, `threshold`, `remaining` |

### Priority: **P0**

Stock status and shipping estimates prevent the two most common abandonment triggers. Variant selection is required for the store to function as a real commerce site.

---

## Category 3: Decision Confidence

### The Problem

The comparison table exists at `/compare` but is disconnected from the feed. A researcher comparing products must navigate away from the category page, breaking the feed experience. In the feed model, comparison should be a native section type, not a separate route.

### Persona-Specific Confidence Mechanisms

| Persona | Confidence Need | Feed Solution |
|---|---|---|
| **Gatherer** | "Does this match my vibe?" | Mood/aesthetic alignment signals in editorial copy |
| **Hunter** | "Is this the best deal?" | Price comparison against alternatives, "lowest price" badge |
| **Researcher** | "How does this compare on the specs I care about?" | Inline comparison block in the feed, expandable spec rows |
| **Gifter** | "Is this a safe choice?" | Gift popularity signals, return/exchange policy, universal appeal tag |

### What's Needed

**New Components**:

| Component | Purpose | Props |
|---|---|---|
| `inline-comparison` | Side-by-side spec comparison within the feed | `products` (2-3), `highlightedSpecs`, `persona` |
| `price-context` | "Lowest in category" or "X% below average" badge | `pricePosition`, `categoryAverage` |
| `confidence-nudge` | Persona-specific decision support copy | `persona`, `productId`, `nudgeType` |

**From Enrichment Pipeline**: New field:

| Field | Type | Source |
|---|---|---|
| `pricePosition` | `'lowest' \| 'below-avg' \| 'average' \| 'above-avg' \| 'highest'` | Computed from category price distribution |

**Feed-Native PDP**: Consider rendering the product detail page as a **modal overlay** on the category feed rather than a route change. This preserves feed context and scroll position. The shopper can close the modal and return to exactly where they were — solving the "backtracking paradox" identified in the feed research. Spotify and Netflix both use this pattern (detail overlay, not page navigation).

### Priority: **P1**

Inline comparison and the modal PDP are medium-effort but high-impact for researcher and hunter conversion.

---

## Category 4: Friction Removal

### The Problem

Every click between "I want this" and "I own this" is a funnel leak. Current friction points:

1. No "Buy Now" — only add-to-cart, then navigate to cart, then checkout
2. No express checkout (Apple Pay, Google Pay, Shop Pay)
3. No saved payment methods (no account system)
4. Checkout redirects to BigCommerce hosted checkout — full context switch
5. No quantity edit or remove in cart drawer

### Persona-Specific Friction Tolerance

| Persona | Friction Tolerance | Optimal Path |
|---|---|---|
| **Gatherer** | High — browsing is the goal, checkout is deferred | "Save to picks" is more important than "Buy Now" |
| **Hunter** | Very low — wants minimum clicks to purchase | "Buy Now" → express checkout → done |
| **Researcher** | Medium — wants control but not friction | "Add all compared items" → review cart → checkout |
| **Gifter** | Low — wants guided completion | "Gift this" → add message → select wrapping → checkout |

### What's Needed

**Quick Purchase Path**:

| Feature | Implementation | BC API |
|---|---|---|
| "Buy Now" button | Creates single-item cart + redirects to checkout | `POST /v3/carts` with `line_items` + redirect to checkout URL |
| Express checkout buttons | Apple Pay / Google Pay via BC Checkout SDK | Supported in embedded checkout, needs configuration |
| Cart quantity edit | Increment/decrement in cart drawer | `PUT /v3/carts/{id}/items/{itemId}` with updated `quantity` |
| Cart item remove | Remove button in cart drawer | `DELETE /v3/carts/{id}/items/{itemId}` |

**New Components**:

| Component | Purpose | Props |
|---|---|---|
| `buy-now-button` | Single-click purchase path | `productId`, `variantId` |
| `express-checkout` | Apple Pay / Google Pay buttons in cart drawer | `cartId`, `providers` |

### Priority: **P1** (cart edit/remove), **P2** (Buy Now, express checkout)

Cart edit and remove are table stakes — the cart drawer is broken without them. Buy Now and express checkout are conversion optimizations that depend on BC checkout SDK configuration.

---

## Category 5: Incentives and Promotions

### The Problem

No dynamic promotions exist. The inference engine produces `priceSensitivity` and `urgency` modifiers but nothing acts on them.

### Features

This category was previously the entire scope of this spec. The five features are retained with their original signal chains and platform responsibilities:

1. **Dwell-time triggered incentives** — 15s+ dwell + high priceSensitivity → instant coupon or trust block
2. **Dynamic budget alternatives** — Hunter + high priceSensitivity → "Same quality, better price" section
3. **Higher quality upsells** — Researcher/Gatherer + low priceSensitivity → "Investment piece" elevation
4. **Intent-based cross-sells** — Add-to-cart → persona-aware complementary products
5. **Cart-removal retention** — Remove-from-cart → targeted discount, save-for-later, or alternatives

See the original feature definitions in this document's git history (v0.1.0) for full signal chains and platform responsibility breakdowns.

### Enrichment Pipeline Changes Required

| Field | Type | Computation | Consumed By |
|---|---|---|---|
| `priceTier` | `'budget' \| 'mid' \| 'premium'` | Price relative to category median | Budget/premium alternative selection |
| `maxDiscountPercent` | `number` (0-50) | Merchant-set or margin-derived | Caps discount depth |
| `discountable` | `boolean` | Merchant-set via admin rules | Gatekeeps coupon injection |
| `alternativeFor` | `{ productId: string, type: 'budget' \| 'premium', reason: string }[]` | LLM-computed during enrichment | Alternative strip — bidirectional |
| `crossSellFor` | `{ productId: string, reason: string, personaAffinity: Persona }[]` | LLM-computed during enrichment | Cross-sell strip — persona-aware |
| `durabilityIndicators` | `string[]` | LLM-extracted (warranty, material grade, construction) | Premium alternative justification copy |

### New Components

| Component | Trigger | Persona Context |
|---|---|---|
| `incentive-banner` | `longDwellCount >= 1` + `priceSensitivity > 0.5` | Researcher, Hunter |
| `alternative-strip` | `priceSensitivity` thresholds | Hunter (budget), Researcher/Gatherer (premium) |
| `cross-sell-strip` | `commerce.add_to_cart` | All — persona determines selection |
| `retention-prompt` | `commerce.remove_from_cart` | All — response varies by priceSensitivity |

### Priority: **P1** (alternatives, cross-sells), **P2** (dwell incentives, retention)

---

## Category 6: Cart Continuity

### The Problem

The cart is device-locked (cookie-based), has no "save for later" backend, and the picks tray is localStorage-only with an 8-item cap. In a feed model, the cart should feel like a playlist — always accumulating, always editable, always accessible across devices.

### Persona-Specific Cart Behavior

| Persona | Cart Expectation | Feed Behavior |
|---|---|---|
| **Gatherer** | Cart is aspirational — a collection of "maybes" | "Save to picks" is the primary CTA; "Add to cart" is secondary. Cart should tolerate 15+ items without pressure. |
| **Hunter** | Cart is transactional — add and checkout fast | Cart should show total cost prominently, surface express checkout, minimize browsing-back friction. |
| **Researcher** | Cart is a comparison workspace | Cart should allow notes per item, show spec summaries, enable "remove and replace" workflows. |
| **Gifter** | Cart is a gift list | Cart should support per-item gift messages, wrapping selection, and recipient information. |

### What's Needed

| Feature | Implementation | BC API |
|---|---|---|
| Cart edit (quantity) | Increment/decrement in drawer | `PUT /v3/carts/{id}/items/{itemId}` |
| Cart remove | Remove button per item | `DELETE /v3/carts/{id}/items/{itemId}` |
| Free shipping progress | Bar showing distance to threshold | Read from BC shipping settings or merchant config |
| Persistent picks (backend) | Move picks from localStorage to server-side session | Store in Redis alongside signal session |
| Cart cost summary | Subtotal + estimated shipping + estimated tax | BC cart response includes `base_amount`; shipping estimate requires separate call |

### New Components

| Component | Purpose | Props |
|---|---|---|
| `cart-item` | Enhanced cart drawer item with edit/remove/notes | `item`, `persona`, `showGiftOptions` |
| `free-shipping-bar` | Progress toward free shipping | `currentTotal`, `threshold` |
| `cart-summary` | Total cost breakdown with shipping estimate | `subtotal`, `shippingEstimate`, `taxEstimate` |

### Priority: **P0** (cart edit/remove — currently broken), **P1** (cost summary, free shipping bar), **P2** (persistent picks, gifting)

---

## Category 7: Post-Add Momentum

### The Problem

After adding to cart, the cart drawer opens and shows the item. Nothing else happens. This is the highest-intent moment in the session — the shopper just committed to a product — and it's wasted. Every streaming platform capitalizes on the "just consumed" moment: Spotify queues the next song, Netflix autoplays the next episode, TikTok loads the next video.

### Persona-Specific Post-Add Actions

| Persona | Post-Add Action | Goal |
|---|---|---|
| **Gatherer** | "Complete the look" — aesthetic cross-sells from same collection | Increase AOV through lifestyle bundling |
| **Hunter** | "Quick checkout" CTA + essential accessories | Minimize time-to-checkout while capturing accessory revenue |
| **Researcher** | "You might also want" — compatible upgrades with spec justification | Upsell through technical compatibility |
| **Gifter** | "Add a gift message" + wrapping options + card selection | Complete the gift experience before checkout |

### What's Needed

The post-add moment should trigger a **drawer expansion** or **slide-in panel** with persona-specific content. This is not a page navigation — it's a contextual overlay that appears within the cart drawer.

**Signal**: `commerce.add_to_cart` (already immediate-flush)

**Response**: The signal flush response includes `CommerceAction` payloads that the client renders in the cart drawer:

```typescript
interface SignalFlushResponse {
  inference: PersonaInference;
  commerceActions?: CommerceAction[];
}

interface CommerceAction {
  type: 'cross-sell' | 'checkout-nudge' | 'gift-options' | 'shipping-info';
  component: string;
  props: Record<string, unknown>;
  ttl: number;  // seconds until this action expires
}
```

### New Components

| Component | Purpose | Props |
|---|---|---|
| `post-add-panel` | Expandable section in cart drawer | `actions` (CommerceAction[]), `persona` |
| `checkout-nudge` | "Ready to checkout?" with express options | `cartTotal`, `itemCount`, `shippingEstimate` |
| `gift-options-panel` | Gift message, wrapping, card selection | `productId`, `wrappingOptions`, `cardOptions` |

### Priority: **P1**

Post-add is the highest-leverage funnel moment. Cross-sells here convert at 3-5x the rate of in-feed cross-sells because intent is already confirmed.

---

## Category 8: Contextual Reassurance

### The Problem

A researcher dwelling on an expensive item for 20 seconds should see return policy and warranty information, not (only) a coupon. Reassurance compresses the funnel differently than incentives — it removes **fear** rather than adding **reward**. Fear of making the wrong choice is the dominant blocker for researchers and gifters.

### Persona-Specific Reassurance

| Persona | Primary Fear | Reassurance Signal |
|---|---|---|
| **Gatherer** | "Will this look right in my space?" | Style guarantee, easy returns, "See it in your room" (AR/photo future) |
| **Hunter** | "Am I overpaying?" | Price match policy, price history, "lowest price in 30 days" |
| **Researcher** | "Will this last?" | Warranty details, material certifications, durability data |
| **Gifter** | "What if they don't like it?" | Gift receipt, easy exchange, "100% returnable" |

### Signal-Driven Reassurance

Reassurance should appear based on behavioral signals, not statically:

| Signal | Reassurance Action |
|---|---|
| `longDwellCount >= 1` + `priceSensitivity <= 0.5` | Show warranty, return policy, durability indicators (not a coupon) |
| `cartRemovalCount >= 1` | Show "Easy returns — no questions asked" in retention prompt |
| `backNavigationCount >= 2` (comparison browsing) | Show "Still deciding? Here's our return policy" |
| `quickBounceCount >= 2` + return to same product | Show "This is our most popular in [category]" — social proof nudge |

### What's Needed

**From Enrichment Pipeline**:

| Field | Type | Source |
|---|---|---|
| `warrantyInfo` | `{ duration: string, coverage: string } \| null` | LLM-extracted from description or BC custom fields |
| `returnPolicy` | `string` | Merchant-set (store-level, not per-product) |
| `certifications` | `string[]` | LLM-extracted ("FSC Certified", "OEKO-TEX", "UL Listed") |

**New Components**:

| Component | Purpose | Props |
|---|---|---|
| `reassurance-block` | Contextual trust/policy information | `type` (warranty/returns/certification/social), `content`, `persona` |
| `social-proof-nudge` | "X people bought this" or "Popular in [category]" | `metric`, `value`, `timeframe` |

### Priority: **P1**

Reassurance has the highest impact for high-consideration purchases (Haven furniture, Volt electronics). It costs nothing (no margin impact like coupons) and directly addresses the fear that blocks conversion.

---

## Gifting Flow: A Cross-Cutting Concern

The gifter persona is unique because it needs features from **every** category above, but with a gift-specific lens. The current implementation detects gifters via inference rules (`search-gifter-keywords`, `utm-gift-campaign`) and generates gift-framing copy in the layout — but has zero gift-specific commerce features.

### What a Complete Gifting Flow Looks Like

```
Feed (persona = gifter)
  → Layout shows curated products with gift-appropriate copy
  → Product cards show "Popular gift" badge + delivery estimate
  → Add to cart
  → Post-add: gift message input, wrapping selection
  → Cart drawer shows per-item gift options
  → Checkout: gift receipt option, separate shipping address
```

### What's Missing

| Feature | Current State | What's Needed |
|---|---|---|
| Gift message | Not implemented | Text input per cart item, stored in BC order metadata |
| Gift wrapping | Not implemented | Options from merchant config, priced as line items |
| Gift receipt | Not implemented | BC supports gift receipts in order settings |
| Separate shipping | Not implemented | BC checkout handles multiple addresses natively |
| Gift budget filter | Not implemented | Price range filter in layout prompt for gifter persona |

### Priority: **P2**

Gifting features are high-value for seasonal conversion (holiday, Mother's Day, wedding) but lower priority than the universal funnel fixes (trust, information, cart basics).

---

## The Feed-Native PDP Question

The research on streaming feed UX identifies the "backtracking paradox" as a major friction point: shoppers lose their place in the feed when they navigate to a product detail page. Streaming platforms solve this with **modal overlays** — Netflix shows movie details in an expandable panel, Spotify shows album details in a slide-over. The user never leaves the feed.

### Proposal: PDP as Modal

Replace the current route-based PDP (`/product/[slug]`) with a modal overlay that renders on top of the category feed. The shopper clicks a product card, the PDP slides in as a panel, and closing it returns to the exact scroll position.

**Benefits**:
- Preserves feed context and scroll position
- Reduces navigation friction (no route change, no back-button confusion)
- Enables "browse next" — swipe to the adjacent product without returning to the grid
- Keeps behavioral signals flowing (the feed is still mounted, dwell/scroll tracking continues)

**Challenges**:
- URL must still update for shareability and SEO (`history.pushState` without full navigation)
- PDP content (images, specs, reviews, variants) must load within the modal without a server round-trip for the route
- Accessibility: focus management, screen reader announcements for modal open/close
- Mobile: full-screen modal vs. sheet vs. slide-over

**Implementation**: SvelteKit supports shallow routing via `pushState` and `replaceState` in `$app/navigation`. The PDP data can be fetched client-side via a lightweight API endpoint while the feed remains mounted.

### Priority: **P2**

High UX impact but significant implementation effort. Depends on the category page being stable first.

---

## Complete Component Vocabulary Extension

All new components introduced across the eight categories:

| Component | Category | Trigger | Priority |
|---|---|---|---|
| `trust-badge` | Trust | Static per product (from enrichment) | P0 |
| `stock-badge` | Information | Static per product (from BC inventory) | P0 |
| `delivery-estimate` | Information | Static per product (from shipping API) | P0 |
| `variant-selector` | Information | PDP interaction | P0 |
| `free-shipping-bar` | Cart / Information | Cart total vs. threshold | P1 |
| `cart-item` (enhanced) | Cart | Cart drawer render | P0 |
| `cart-summary` | Cart | Cart drawer render | P1 |
| `inline-comparison` | Confidence | Researcher persona, 2+ products viewed | P1 |
| `price-context` | Confidence | Static per product (from enrichment) | P1 |
| `incentive-banner` | Incentives | Dwell + priceSensitivity | P2 |
| `alternative-strip` | Incentives | priceSensitivity thresholds | P1 |
| `cross-sell-strip` | Incentives / Post-add | Add-to-cart event | P1 |
| `retention-prompt` | Incentives | Remove-from-cart event | P2 |
| `post-add-panel` | Post-add | Add-to-cart event | P1 |
| `checkout-nudge` | Friction | Cart open, Hunter persona | P1 |
| `buy-now-button` | Friction | PDP, Hunter persona | P2 |
| `reassurance-block` | Reassurance | Dwell + low priceSensitivity | P1 |
| `social-proof-nudge` | Reassurance | Bounce pattern + return | P1 |
| `gift-options-panel` | Gifting | Gifter persona, add-to-cart | P2 |
| `confidence-nudge` | Confidence | Persona-specific, behavioral | P2 |

### Component Injection Model

These components fall into two injection categories:

**Layout-integrated components** (rendered by the AI as part of the generated layout):
- `trust-badge`, `stock-badge`, `delivery-estimate`, `price-context`, `inline-comparison`, `alternative-strip`, `reassurance-block`, `social-proof-nudge`
- These are part of the product card or layout section. The layout prompt should instruct the AI on when to include them based on persona.

**Event-driven components** (injected by the client in response to signal events):
- `incentive-banner`, `cross-sell-strip`, `retention-prompt`, `post-add-panel`, `checkout-nudge`, `gift-options-panel`, `confidence-nudge`
- These appear in response to behavioral triggers. They are not part of the AI-generated layout — they are deterministic (signal + modifier threshold → action).

This separation keeps the AI focused on layout composition while commerce interventions remain predictable and testable.

---

## Complete Enrichment Pipeline Changes

All new fields across all eight categories:

| Field | Type | Category | Priority |
|---|---|---|---|
| `editorialBadge` | `string \| null` | Trust | P0 |
| `trustSignals` | `string[]` | Trust | P0 |
| `expertMentions` | `{ source, quote, url }[]` | Trust | P3 |
| `priceTier` | `'budget' \| 'mid' \| 'premium'` | Incentives | P1 |
| `pricePosition` | `'lowest' \| 'below-avg' \| 'average' \| 'above-avg' \| 'highest'` | Confidence | P1 |
| `alternativeFor` | `{ productId, type, reason }[]` | Incentives | P1 |
| `crossSellFor` | `{ productId, reason, personaAffinity }[]` | Incentives | P1 |
| `durabilityIndicators` | `string[]` | Incentives / Reassurance | P1 |
| `warrantyInfo` | `{ duration, coverage } \| null` | Reassurance | P1 |
| `certifications` | `string[]` | Reassurance | P1 |
| `maxDiscountPercent` | `number` | Incentives | P2 |
| `discountable` | `boolean` | Incentives | P2 |

---

## The CommerceAction Response Extension

Event-driven components require the signal flush response to carry commerce action payloads:

```typescript
interface SignalFlushResponse {
  inference: PersonaInference;
  commerceActions?: CommerceAction[];
}

interface CommerceAction {
  type: 'incentive' | 'cross-sell' | 'retention' | 'checkout-nudge'
       | 'reassurance' | 'gift-options' | 'post-add' | 'trust';
  component: string;
  props: Record<string, unknown>;
  ttl: number;  // seconds until this action expires
  persona: Persona;  // which persona triggered this
}
```

The client-side handler for `aisles-inference-update` events extends to render `CommerceAction` components in the appropriate container (feed overlay, cart drawer, or PDP modal).

---

## The Latency Requirements

| Action | Trigger | Acceptable Latency | Location |
|---|---|---|---|
| Trust badges, stock status | Page load | Part of initial render | Product card |
| Delivery estimate | Page load or geo-IP resolution | < 1s | Product card |
| Inline comparison | Researcher persona detected | Part of layout generation | Feed section |
| Cross-sell / post-add | Add-to-cart (immediate flush) | < 1s | Cart drawer |
| Retention prompt | Remove-from-cart (immediate flush) | < 500ms | Cart drawer |
| Dwell incentive | 15s dwell + next flush | < 2s after flush | Feed overlay |
| Reassurance block | Dwell + next flush | < 2s after flush | PDP or feed overlay |
| Checkout nudge | Cart open | Immediate (client-side logic) | Cart drawer |

---

## The Data Quality Principle

> Data quality is a background loop, not a rendering gate. See "Speed Over Accuracy: The Fail-Fast Principle" in `docs/product-vision.md`.

Every feature in this spec follows the same degradation pattern:

- **Data present and confident**: Render the full component with persona-specific content
- **Data present but low confidence**: Render a simplified version (star rating without review excerpts, stock badge without quantity)
- **Data missing**: Silently skip the component. No placeholder, no error state. The base layout is unaffected.

Missing data should never produce a wrong recommendation and should never block a render.

---

## Implementation Priority Summary

### P0 — Table Stakes (the store doesn't function without these)

1. Cart edit and remove (currently broken)
2. Reviews and star ratings on product cards (trust signal #1)
3. Stock status badges (prevents overselling)
4. Variant selection on PDP (can't buy configurable products)
5. Shipping/delivery estimates on cards and PDP

### P1 — Funnel Compression (directly increases conversion)

6. Post-add momentum panel in cart drawer
7. Reassurance blocks (warranty, returns, certifications)
8. Free shipping progress bar
9. Cart cost summary (subtotal + shipping + tax estimate)
10. Alternative strips (budget and premium)
11. Cross-sell suggestions (persona-aware)
12. Inline comparison for researchers
13. Checkout nudge for hunters
14. Price context badges

### P2 — Differentiation (proves the Aisles thesis)

15. Dwell-time triggered incentives
16. Cart-removal retention
17. Buy Now quick purchase path
18. Feed-native PDP modal
19. Gift options flow
20. Express checkout buttons
21. Social proof nudges

### P3 — Future Depth

22. Expert review integration
23. Price history / "lowest in 30 days"
24. AR/photo room visualization
25. Competitive price intelligence via Feedonomics

---

## Research Gaps

The following areas need additional research before features can be fully specified:

1. **Cart abandonment benchmarks by vertical**: Baymard Institute data is aggregate. What are the specific abandonment drivers for furniture (Haven), electronics (Volt), and outdoor (Ember)?

2. **Express checkout conversion lift**: What is the measured impact of Apple Pay / Google Pay buttons on BC stores? Is the BC Checkout SDK integration stable enough for production?

3. **Social proof effectiveness by persona**: Do star ratings move the needle equally for all four personas, or do researchers weight expert reviews over consumer ratings?

4. **Feed-native PDP patterns in commerce**: Which e-commerce sites successfully use modal/overlay PDPs? What are the accessibility and SEO trade-offs in practice?

5. **Gift commerce conversion data**: What percentage of e-commerce revenue is gift purchases? Does gift-specific UX (wrapping, messages) measurably increase conversion or AOV?

---

## Related Documentation

- `docs/signals-and-inference.md` — signal types, inference rules, and modifier system
- `docs/specs/behavioral-signals.md` — behavioral signal expansion (provides the triggers)
- `docs/specs/layout-transitions.md` — layout transition animations
- `docs/architecture.md` — system architecture and data flow
- `docs/product-vision.md` — strategic context, feed model, funnel compression
- `docs/fractal-interface-evaluation.md` — hyper-personalization research and trade-offs
- `docs/decisions/001-enrichment-vs-feedonomics.md` — enrichment pipeline vs. Feedonomics
- `docs/specs/aisles-admin.md` — merchandising rules and admin controls
- `specchain/product/north-star.md` — aspirational platform capabilities
