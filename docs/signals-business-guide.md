# Aisles Personalization — Business Guide

**Version**: 1.0.0
**Last Updated**: 2026-04-09
**Audience**: Merchandisers, Business Analysts, Store Managers

## What This Guide Covers

Aisles uses a real-time personalization system to show each shopper a category page layout tailored to how they appear to be shopping. This guide explains what the system watches, how it makes decisions, what you can control, and how to interpret what you see in the monitoring tools.

No technical background is required.

---

## The Four Shopper Personas

The system classifies every visitor into one of four shopping styles. Most shoppers are not purely one type — the system tracks a mix, and the layout reflects the dominant style.

| Persona | Plain-English Description | Real Shopper Example |
|---|---|---|
| **Gatherer** | Exploring without a specific goal. Wants inspiration and aesthetics. Not ready to buy. | Someone browsing "living room furniture" on a Sunday afternoon, saving ideas for a future renovation. |
| **Hunter** | Knows exactly what they want. Efficiency matters. Price and specs over storytelling. | Someone who searched "under $200 desk" and arrived from a deal aggregator. They want to find it, confirm the price, and check out. |
| **Researcher** | Methodical. Comparing multiple options. Reads specs, reviews, and dimensions before deciding. | Someone who came from Wirecutter, has opened six product pages, and keeps going back to the grid to compare. |
| **Gifter** | Shopping for someone else. Wants curated options, broad appeal, and safe price points. | Someone who searched "birthday gift for her" or arrived via a Mother's Day email campaign. |

---

## What Signals the System Watches

The system observes shopper behavior across five categories of signals.

### What You Searched

| Signal | What It Indicates |
|---|---|
| Search includes words like "cheap," "deal," "budget," "under $," "sale," "clearance" | Hunter — price-driven shopper |
| Search includes words like "review," "compare," "vs," "specs," "dimensions," "material" | Researcher — evaluating options carefully |
| Search includes words like "gift," "birthday," "anniversary," "for him," "for her," "housewarming" | Gifter — shopping for someone else |
| Search includes words like "browse," "inspiration," "modern," "aesthetic," "cozy," "explore" | Gatherer — looking for ideas |

### Where You Came From

| Traffic Source | What It Indicates |
|---|---|
| Pinterest, Instagram, Houzz | Gatherer — arrived via visual inspiration |
| Slickdeals, RetailMeNot, Honey, Google Shopping | Hunter — actively deal-seeking |
| Wirecutter, Consumer Reports, Reddit | Researcher — did homework before arriving |
| Email campaign tagged with "gift," "holiday," "Mother's Day" | Gifter — campaign-driven |
| Email campaign tagged with "sale," "clearance," "promo" | Hunter — responded to a price offer |

### How You Browse

| Behavior | What It Indicates |
|---|---|
| Visited 3 or more different product categories in one session | Gatherer — wide, exploratory browsing |
| Stayed in one category but viewed it multiple times | Hunter — focused intent, narrowing down |
| Went back to the category grid 2 or more times after viewing products | Researcher — actively comparing |
| Scrolled to the bottom of a category page | Gatherer or researcher — thorough, not skimming |
| Using a desktop on a weekday between 9 AM and 5 PM | Mild researcher signal — deliberate, work-hours browsing |
| Using a mobile phone late at night (after 8 PM) | Mild hunter signal — evening impulse browsing |

### What You Do With Products

| Behavior | What It Indicates |
|---|---|
| Added 2 or more items to cart in one session | Hunter — decisive, goal-oriented |
| Viewed 4 or more product detail pages | Researcher — thorough evaluation |
| Spent 15 seconds or more reading a product page | Researcher — reading carefully, not impulsive |
| Quickly scanned many products (average under 8 seconds per page) | Hunter — scanning for something specific |
| Sent messages to the AI refinement assistant | Researcher (3+ messages) or Hunter (1–2 messages) |

### Warning Signs

These signals tell the system a shopper is not finding what they need, and adjust accordingly.

| Behavior | What It Indicates |
|---|---|
| Bounced off 2 or more product pages in under 3 seconds | The hunter label should be dialed back — a hunter who found the right product would not keep bouncing |
| Removed items from the cart | Reconsidering — shifts the system toward researcher and price-sensitivity |

---

## How the System Decides Which Persona You Are

Rather than assigning a single label immediately, the system builds a **probability score** for each of the four personas throughout the session. Think of it like four confidence meters running in parallel.

At the start of every session, the system begins with a slight lean toward Gatherer. This is intentional — showing an exploratory layout to an unknown visitor is a safer default than assuming they are ready to buy.

As signals arrive, the meters adjust. Each signal adds evidence toward one or more personas. Stronger signals (like a search query or an explicit URL parameter) move the meters more than weaker signals (like the time of day). When the session ends, whichever persona has the highest score determines the layout.

A few important properties of how this works:

- **Signals add up.** Three moderate signals pointing to Researcher can outweigh one strong signal pointing to Hunter.
- **The system does not commit.** It keeps all four meters active until the session ends. New behavior can shift the outcome.
- **Ambiguous sessions get blended layouts.** If Hunter is at 55% and Researcher is at 40%, the layout mixes efficiency cues with comparison-friendly features, rather than going all-in on either style.
- **No signal is discarded.** Even signals that did not shift the outcome are visible in the monitoring panel for debugging.

---

## What Happens When the Persona Changes Mid-Session

If a shopper arrived as a Gatherer (from Pinterest, no specific search) and then typed "compare desk vs standing desk" into the search bar, the system detects a **persona shift**.

Shift detection requires two conditions:
1. The newly inferred persona must differ from what was recorded in the shopper's previous session or the session's starting inference.
2. The new persona must be winning by a meaningful margin (not a near-tie).

When a shift is detected, the system records:
- What the previous persona was
- What triggered the change (the search query, a campaign link, or the referrer)

This information is visible in the Observe dashboard. The layout does not automatically regenerate on every signal update — regeneration is controlled separately — but the inference result is always current.

---

## What Merchandisers Can Control

The AI makes layout decisions, but merchandisers can set rules that constrain or override those decisions. Rules are applied after inference and before the layout is generated.

| Rule Type | What It Does | Example |
|---|---|---|
| **Pin** | Forces a specific product into a fixed position in the layout | Pin the new seasonal collection hero product to position 1 for all visitors |
| **Exclude** | Prevents a product from appearing in AI-generated layouts | Exclude a product that is out of stock or being discontinued |
| **Boost** | Increases the likelihood the AI selects a product for prominent placement | Boost the high-margin items during a promotion period |
| **Seasonal** | Applies a rule only during a date range | Show winter coats prominently from November through January |

These rules are layered on top of the AI's inference — the AI still chooses layout structure, component arrangement, and editorial copy, but it operates within the constraints the merchandiser has set.

---

## How to Read the Dev Mode Panel

When you access the storefront with dev mode enabled, a panel appears at the bottom of the page showing the current inference state. Here is what each section means.

| Panel Section | What It Shows |
|---|---|
| **Persona badges** | The four personas with their current probability percentages. The leading persona is highlighted. |
| **Confidence** | The gap in percentage points between the top persona and the second-place persona. A low confidence (under 15%) means the layout is blending two styles. |
| **Rule matches** | Which signals fired this session and what each one contributed. Each entry shows the rule name, its weight, and a plain-English reason (e.g., "Search 'dorm desk' matches deal/budget keywords"). |
| **Modifier gauges** | Three sliders showing Price Sensitivity, Urgency, and Store Familiarity. These are computed separately from the persona scores and are informational only. |
| **Shift indicator** | Appears when the inferred persona differs from the previous session's stored persona. Shows what triggered the change. |

---

## How to Read the Observe Dashboard

The `/observe` page provides a real-time view of inference across sessions. It is intended for monitoring and debugging, not for live merchandising decisions.

| Dashboard Element | What It Means |
|---|---|
| **Session timeline** | The sequence of signals received for a session, in order. Each entry shows the signal type, when it arrived, and what inference change (if any) it caused. |
| **Current inference card** | The most recent `PersonaInference` result for the selected session: primary persona, probability vector, confidence, and all fired rules. |
| **Shift events** | Highlighted entries where a persona change was detected mid-session. |

Use the Observe dashboard when a shopper reports that the layout felt wrong for their intent, or when you want to verify that a campaign's UTM tags are being detected correctly.

---

## FAQ

**Why was this visitor labeled a Gatherer?**

Check the rule matches in the dev panel or Observe dashboard. Common reasons: no search query was present, the referrer was a social platform (Pinterest, Instagram), or the shopper browsed multiple categories without adding anything to cart. Gatherer is also the default when signals are sparse — a cold-start visitor with no referrer, no search, and a short session will default to Gatherer.

**Can I override the AI's persona assignment for a specific visitor?**

Yes, indirectly. Any URL can include `?intent=hunter` (or any of the four persona names). This is the strongest signal in the system — it overrides nearly everything else. It is useful for campaigns where you know the audience's intent precisely. It is not intended for permanent use on live storefront links.

**What if the AI is wrong about a visitor's persona?**

The system will self-correct as more signals arrive during the session. A Gatherer label on page load can shift to Researcher after the shopper performs two searches and views six product pages. If you notice systematic misclassification for a specific traffic source or campaign type, check whether the UTM tags on those campaigns match the patterns the system recognizes. Contact the development team to add new keyword patterns or referrer domains if needed.

**Does the system remember returning shoppers?**

Yes. The persona from the most recent session is stored in a browser cookie (30-day lifetime). On return visits, the system gives a mild boost to the previously observed persona as a continuity signal — but current-session behavior can override it.

**Does the system use any personally identifiable information?**

No. The system operates on anonymous session signals only: search queries, referrer URLs, UTM parameters, device type, and in-session behavioral events. There is no account linking, no cross-device tracking, and no data shared with third parties.

---

## Related Documentation

- `docs/signals-and-inference.md` — technical reference for developers
- `docs/observe.md` — Observe dashboard setup and usage
- `docs/development.md` — developer debugging guide
