# Spec: Layout Transition Animations

**Version**: 0.1.0
**Last Updated**: 2026-04-09
**Audience**: Developers, Design
**Status**: Design — not yet implemented

## Problem

The current layout rendering has two states: skeleton pulse (loading) and full layout (loaded). The transition between them is a hard swap — the skeleton disappears and the layout appears instantly. The only signal that personalization is happening is a small "Personalizing..." pill fixed at the bottom-left of the viewport.

This binary transition fails to communicate the intelligence of the system. The AI is assembling a custom layout from a component vocabulary — selecting section types, ordering products, writing copy. The shopper should feel that assembly happening, not experience a loading spinner followed by a reveal.

## Design Direction

The layout already streams sections progressively via SSE. The category page receives partial `aiLayout` updates as sections generate. The rendering just doesn't show the progression — it swaps the whole layout object silently. All animation work is client-side, in `LayoutRenderer.svelte` and the category page component.

The animation should convey: "The store is assembling itself for you."

---

## Three Levels of Implementation

### Level 1: Section Fade-In (Low Effort)

Each section fades and slides up as it arrives in the stream. Sections that haven't arrived yet remain as skeleton placeholders.

**How it works:**

1. The category page renders a fixed number of skeleton slots (e.g., 4) immediately
2. As each section arrives in the SSE stream, the skeleton slot for that position crossfades to the real component
3. The transition uses Svelte's built-in `transition:` directive or CSS transitions

**Svelte implementation sketch:**

```svelte
{#each aiLayout.sections as section, i (section.component + i)}
  <div
    class="transition-all duration-500 ease-out"
    class:opacity-0={!section}
    class:translate-y-4={!section}
    class:opacity-100={section}
    class:translate-y-0={section}
  >
    <!-- render section component -->
  </div>
{/each}

{#each Array(Math.max(0, expectedSections - (aiLayout?.sections?.length ?? 0))) as _}
  <div class="animate-pulse">
    <!-- skeleton placeholder -->
  </div>
{/each}
```

**Alternatively, using Svelte transitions:**

```svelte
{#each aiLayout.sections as section, i (section.component + i)}
  <div in:fly={{ y: 16, duration: 400, delay: i * 100 }}>
    <!-- render section component -->
  </div>
{/each}
```

**What the shopper sees:** Sections materialize from top to bottom with a staggered fade-in. The editorial header appears first, then the hero product, then the grid. Skeleton placeholders pulse below the rendered sections until they are replaced.

**Effort:** Small. Requires adding Svelte transition directives to `LayoutRenderer.svelte` and changing the category page to render skeleton slots alongside arrived sections rather than showing one or the other.

---

### Level 2: Skeleton-to-Content Morph (Medium Effort)

The skeleton isn't a generic pulse — it's shaped like the component vocabulary. As the stream reveals each section's type, the skeleton morphs into the real component.

**How it works:**

1. On layout request, render type-aware skeleton slots that approximate the visual shape of each component type
2. The stream's first partial payload may include section types before full content is ready
3. As each section resolves, the skeleton for that slot crossfades to the real component with a smooth height transition

**Component-shaped skeletons:**

| Component | Skeleton Shape |
|---|---|
| `editorial-header` | Wide text block (eyebrow line, headline bar, body lines) |
| `hero-product` | Large image placeholder + text block to the right |
| `product-grid` | Grid of square placeholders matching the column count |
| `category-header` | Narrow bar with title placeholder and filter dots |

**The morph transition:**

```svelte
{#each aiLayout.sections as section, i (section.component + i)}
  <div class="transition-all duration-600 ease-out">
    {#if section.__resolved}
      <div in:fade={{ duration: 300 }}>
        <!-- real component -->
      </div>
    {:else}
      <ComponentSkeleton type={section.component} />
    {/if}
  </div>
{/each}
```

**What the shopper sees:** The page starts with recognizable component shapes pulsing in place. As the AI decides each section, the skeleton dissolves and the real content fades in. The height may shift slightly as real content replaces the approximation — use `auto-animate` or explicit height transitions to smooth this.

**Effort:** Medium. Requires a `ComponentSkeleton` component that accepts a `type` prop, and modifications to the SSE stream to emit section types before full content when possible.

---

### Level 3: Persona Shift Swap (Higher Effort)

When inference detects a persona shift mid-session (`PersonaShift.detected === true`) and triggers a layout refresh, the *existing* layout components animate out while the *new* layout components animate in. The shopper sees the page reorganize itself.

**How it works:**

1. When `fetchLayout()` is called due to a persona shift (not initial load), store the current `aiLayout` as `previousLayout`
2. Animate each section of `previousLayout` out (fade + slight scale down)
3. As new sections stream in, animate them in (fade + slide up)
4. If a section type persists across both layouts (e.g., both have a `product-grid`), crossfade the content within the same container rather than removing and re-adding

**The diff-aware transition:**

```svelte
<script>
  let previousSections = $state([]);
  let currentSections = $derived(aiLayout?.sections ?? []);

  // On layout change, capture outgoing sections
  $effect(() => {
    if (isUpgrading && aiLayout) {
      previousSections = [...aiLayout.sections];
    }
  });
</script>

{#each currentSections as section, i (section.component + i)}
  <div
    in:fly={{ y: 16, duration: 400 }}
    out:fade={{ duration: 200 }}
  >
    <!-- render section component -->
  </div>
{/each}
```

**What the shopper sees:** The editorial header dissolves as a category header appears. The 2-column grid contracts and re-expands as a 4-column grid. The hero product scales down and disappears while quick-add buttons fade in across the grid. The page breathes and reorganizes rather than jumping.

**Effort:** Higher. Requires tracking the previous layout, computing the diff between old and new section lists, and handling mixed transitions (some sections exit, some enter, some morph). Svelte's `{#key}` blocks and `crossfade` transitions can handle much of this, but edge cases (different section counts, height changes) need careful handling.

---

## The "Personalizing" Indicator

The current pill (`fixed bottom-20 left-6`) should remain as a subtle confirmation, but the animation itself becomes the primary feedback mechanism. The pill transitions from "Personalizing..." to "Personalized" with a brief checkmark animation when the layout is complete.

**Enhanced pill states:**

| State | Text | Visual |
|---|---|---|
| Streaming | "Personalizing..." | Pulsing accent dot |
| Complete | "Personalized" | Brief checkmark, then fade out after 2s |
| Persona shift | "Updating for you..." | Accent dot + subtle directional indicator |

---

## Connection to the Feed Model

The transition animations reinforce the "Products as Content" feed model (see `docs/product-vision.md`). In a streaming feed, content tiles don't appear all at once — they load progressively as the user scrolls or as the feed algorithm prepares them. The section-by-section fade-in mirrors this pattern and makes the category page feel like a living feed rather than a static page that was generated and delivered.

The persona shift swap (Level 3) is the commerce equivalent of a feed refresh — the content reorganizes because the algorithm learned something new about you. The animation communicates "the store is paying attention" without being intrusive.

---

## Digital Pacing: Feed Length Affects Transition Design

The "Products as Content" model introduces persona-specific pacing (see `docs/product-vision.md`, "Digital Pacing" section). Feed length varies by persona — a hunter sees 8-12 products in a dense grid; a gatherer scrolls through 24+ with editorial breaks. This affects how transitions should behave:

- **Hunter layouts** are short. All sections arrive quickly via the stream. The fade-in cascade (Level 1) completes in under 2 seconds. No progressive loading needed — the page feels "done" almost immediately.
- **Gatherer layouts** are longer. The fade-in cascade should pace itself — editorial breaks between product rows create natural rest points where the next section can appear as the shopper scrolls. Consider triggering section fade-in on scroll-into-viewport rather than on stream arrival, so sections above the fold appear immediately while below-fold sections animate in as the shopper reaches them.
- **Researcher layouts** are dense but paginated. Transitions should be minimal — researchers want stability, not animation. A simple fade with no slide is sufficient. Page transitions between comparison views should feel like flipping pages, not scrolling a feed.
- **Gifter layouts** are curated and finite. The fade-in cascade should feel deliberate — each product appearing as if it was hand-selected. Slightly longer stagger delays (150ms vs. 100ms) can reinforce the "concierge picked these for you" feeling.

---

## Implementation Priority

| Level | When to Build | Dependencies |
|---|---|---|
| **Level 1** | Now — low effort, high impact | Svelte transitions, existing SSE stream |
| **Level 2** | After Level 1 is validated | `ComponentSkeleton` component, SSE type-ahead |
| **Level 3** | After persona shift detection is in production use | Previous layout tracking, diff logic |

Level 1 should ship first. It transforms the loading experience from "wait → snap" to "wait → build" with minimal code. Levels 2 and 3 are refinements that depend on Level 1 feeling right.

---

## Related Documentation

- `src/lib/components/layouts/LayoutRenderer.svelte` — current rendering logic
- `src/lib/components/layouts/LayoutSkeleton.svelte` — current skeleton component
- `src/routes/category/[slug]/+page.svelte` — SSE consumption and layout state management
- `src/routes/api/layout/stream/+server.ts` — SSE streaming endpoint
- `docs/product-vision.md` — "Products as Content" feed model, design principles
- `docs/architecture.md` — layout generation pipeline
