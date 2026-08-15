# Aisles — Multi-Brand Setup Guide

**Version**: 0.1.0
**Last Updated**: 2026-04-06
**Audience**: Developers, Platform Operators

## Overview

A single Aisles codebase serves multiple current configurations. Brand selection is controlled by the `BRAND_ID` environment variable. Each deployed configuration gets its own Cloudflare Pages project, BigCommerce channel, and visual inputs, but shares the current application code, AI logic, and infrastructure patterns.

This guide describes configuration for Aisles's existing generic renderer. It is not an external-merchant onboarding recipe. Related brands inside an integrated merchant organization can reuse shared commerce and composition patterns. Kibble is the separate external-reference case: Preserve covers Home, product listing, catalog presentation, search, error, and cart surfaces. The Kibble cart has a separate server-gated BigCommerce sandbox adapter for optionless one-time purchase and hosted-checkout handoff; its committed deployment mode is off. Account, orders, Auto-Refill, and the three canonical checkout phase routes remain source-native unavailable shells. Bare `/checkout` remains the canonical source's 404. Its 28 zone families resolve to 36 exact identities, with 11 content-backed native adapters and 25 Trusted Hidden terminals. The 15-route × three-viewport Kibble harness and the 90-cell Bealls internal harness are mechanical regression evidence, not visual approval or complete-commerce evidence. See the [canonical autonomy plan](organization-brand-autonomy-plan.md) and [Kibble boundary retrospective](retrospective-kibble-reference-boundary.md).

Kibble is the active local reference configuration. Haven, Volt, and Ember remain reference configurations in the same codebase. This guide does not verify any deployment.

| Brand | Product domain | Configuration state |
|---|---|---|
| Kibble | Pet supplies and Auto-Refill | `aisles-kibble` project configuration; deployment not verified here |
| Haven | DTC home furniture | Reference configuration |
| Volt | Consumer audio and electronics | Reference configuration |
| Ember | Outdoor lifestyle and fire | Reference configuration |

---

## How Brand Selection Works

At runtime, `getBrand()` in `src/lib/brand/config.ts` reads the environment:

```typescript
const brandId =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BRAND_ID) ||
  (typeof process !== 'undefined' && process.env?.BRAND_ID) ||
  'haven';
```

- **Cloudflare Pages Functions (server-side)**: reads `BRAND_ID`
- **Vite/client-side**: reads `VITE_BRAND_ID` (must be prefixed for Vite to expose it)
- **Node scripts** (enrichment, seeding): reads `BRAND_ID` from `process.env`

Unrecognized brand IDs fall back to `haven`.

---

## The BrandConfig Interface

Every brand is defined by this TypeScript interface in `src/lib/brand/config.ts`:

```typescript
interface BrandConfig {
  id: string;          // Machine identifier, matches the BRAND_ID value
  name: string;        // Display name ("Haven", "Volt", "Ember")
  tagline: string;     // Short tagline shown in the nav and footer
  domain: string;      // Product domain label ("DTC home furniture")
  footerNote: string;  // Footer attribution line

  bc: {
    channelId: number;      // BigCommerce channel ID
    categoryPrefix: string; // Prefix to filter BC categories by brand
  };

  categories: Record<string, {
    bcName: string;      // Exact BC category name to query
    displayName: string; // Human-readable display name
  }>;

  theme: {
    primary: string;       // CSS hex — primary accent color
    secondary: string;     // CSS hex — hover/pressed states
    accent: string;        // CSS hex — secondary accent
    surfaceBg: string;     // CSS hex — page background
    surfaceFg: string;     // CSS hex — primary text
    surfaceCard: string;   // CSS hex — card background
    surfaceCardFg: string; // CSS hex — card text
    surfaceMuted: string;  // CSS hex — muted surface
    surfaceMutedFg: string;// CSS hex — muted text
    surfaceBorder: string; // CSS hex — border color
    fontDisplay: string;   // CSS font-family string for headings
    fontBody: string;      // CSS font-family string for body text
    fontMono: string;      // CSS font-family string for monospace
  };

  googleFontsUrl: string;  // Full Google Fonts @import URL

  prompt: {
    storeName: string;          // Used in LLM prompts
    storeDescription: string;   // Brand description injected into prompts
    productDomain: string;      // e.g., "furniture", "audio electronics"
    personaDefinitions: Record<'gatherer'|'hunter'|'researcher'|'gifter', string>;
    voiceGuidance: string;      // Writing style instructions for the AI
  };
}
```

The `theme` object is injected as CSS custom properties on `:root` at page load, so its colors and fonts apply globally to the existing shared components. It does not represent component anatomy, page recipes, responsive chrome, or other requirements for preserving an external reference storefront.

The `prompt` fields are injected into every AI call — layout generation, refinement, and enrichment — so the AI produces brand-appropriate copy and persona definitions that match the product domain.

---

## How to Add a Current Generic-Renderer Configuration

### Step 1: Create the BigCommerce Channel

1. In the BigCommerce control panel, go to **Channel Manager** and create a new channel
2. Note the channel ID (visible in the URL when you open the channel settings)
3. Create the category structure under this channel. Categories must be named with a brand prefix that matches what you'll set in `categoryPrefix` (e.g., `Newbrand Living Room`, `Newbrand Bedroom`)
4. Generate a Storefront API token for this channel (Storefront API tokens are channel-specific)
5. Add products to the channel's categories

### Step 2: Add Brand Identity Files

Copy one of the existing brand JSON files in `brands/` as a reference:

```
brands/newbrand.json
```

The brand JSON captures the extended identity — persona audiences, color system, typography scale, voice guidelines, creative brief. It is not currently consumed at runtime (the `src/lib/brand/config.ts` values are), but serves as the source of truth for the brand design system and can be used for brand validation tooling.

### Step 3: Add the Brand Config

Open `src/lib/brand/config.ts` and add a new entry to the `BRANDS` object:

```typescript
const BRANDS: Record<string, BrandConfig> = {
  // ... existing brands ...

  newbrand: {
    id: 'newbrand',
    name: 'New Brand',
    tagline: 'Your brand tagline here',
    domain: 'your product domain',
    footerNote: 'New Brand is a demo storefront powered by Aisles',

    bc: {
      channelId: 1234567,   // Your BC channel ID
      categoryPrefix: 'Newbrand',
    },

    categories: {
      'category-slug': { bcName: 'Newbrand Category Name', displayName: 'Category Name' },
      // Add one entry per category the brand will display
    },

    theme: {
      primary: '#hex',
      secondary: '#hex',
      accent: '#hex',
      surfaceBg: '#hex',
      surfaceFg: '#hex',
      surfaceCard: '#hex',
      surfaceCardFg: '#hex',
      surfaceMuted: '#hex',
      surfaceMutedFg: '#hex',
      surfaceBorder: '#hex',
      fontDisplay: "'Font Name', fallback, generic",
      fontBody: "'Font Name', system-ui, sans-serif",
      fontMono: "'JetBrains Mono', Menlo, monospace",
    },

    googleFontsUrl: 'https://fonts.googleapis.com/css2?family=...',

    prompt: {
      storeName: 'New Brand',
      storeDescription: 'a [description] — [adjectives], [values]',
      productDomain: 'your products',
      personaDefinitions: {
        gatherer: 'What does browsing look like for this product domain?',
        hunter: 'What does goal-oriented shopping look like here?',
        researcher: 'What does deep-dive comparison look like here?',
        gifter: 'What does gift shopping look like for this domain?',
      },
      voiceGuidance: 'Describe the writing tone, what to lead with, what to avoid.',
    },
  },
};
```

**Persona definitions matter.** The AI uses these verbatim when building layout prompts. Write them as behavior descriptions, not character sketches. Reference the existing brands for calibration:

- Haven gatherer: "Exploratory, inspiration-driven. Browsing aesthetics, lifestyle imagery..."
- Volt hunter: "Knows exactly what they want. Comparing prices, checking specs..."
- Ember gifter: "Fire pit as a housewarming or holiday gift. Needs impressive presentation..."

**Voice guidance matters equally.** This is the single line that most shapes AI copy quality. Be prescriptive about what to lead with and what to avoid.

### Step 4: Run the Enrichment Pipeline

Enrichment is channel-specific. Set the environment variables for the new channel and run:

```bash
BRAND_ID=newbrand \
BIGCOMMERCE_STORE_HASH=your_store_hash \
BIGCOMMERCE_STOREFRONT_TOKEN=your_channel_token \
BIGCOMMERCE_CHANNEL_ID=1234567 \
DATABASE_URL=your_supabase_postgres_url \
ANTHROPIC_API_KEY=your_key \
OPENROUTER_API_KEY=your_key \
npx tsx src/lib/server/enrichment/enrich.ts
```

This scores all products in the channel for persona-fit and generates semantic tags. Layout generation will work without enrichment, but products will appear in default BigCommerce order and receive no persona-aware sorting.

### Step 5: Create a Cloudflare Pages Project

1. In Cloudflare Pages, create a project connected to the same Git repository.
2. Set the root directory to the repository root (not a subdirectory — this is a single-app repo)
3. Set the following environment variables:

**Required**

| Variable | Value |
|---|---|
| `BRAND_ID` | `newbrand` |
| `VITE_BRAND_ID` | `newbrand` |
| `BIGCOMMERCE_STORE_HASH` | Your BC store hash |
| `BIGCOMMERCE_STOREFRONT_TOKEN` | Channel-specific storefront token |
| `BIGCOMMERCE_CHANNEL_ID` | Your BC channel ID |
| `KV_REST_API_URL` | Upstash Redis REST URL |
| `KV_REST_API_TOKEN` | Upstash Redis REST token |
| `HYPERDRIVE` binding | Supabase Postgres connection for Cloudflare Pages Functions |

**For AI generation** (Cloudflare AI Gateway is optional):

| Variable | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API credential |
| `CF_AI_GATEWAY_URL` | Optional Cloudflare AI Gateway Anthropic endpoint |

4. Bind Hyperdrive to the Pages project. Use `DATABASE_URL` only for local development and Node scripts; do not expose it to browser code.
5. Deploy. The first deploy will warm the cache on demand (first visitor per persona+category triggers generation).

6. Optionally run cache warming after deploy:

```bash
npx tsx scripts/warm-cache.ts newbrand
```

This requires adding your brand to the `BRANDS` map in `scripts/warm-cache.ts`.

---

## Category Mapping

The `categories` field in the brand config maps URL slugs to BigCommerce category names:

```typescript
categories: {
  'living-room': { bcName: 'Haven Living Room', displayName: 'Living Room' },
  'office':      { bcName: 'Haven Office',      displayName: 'Office' },
}
```

- **Key** (e.g., `living-room`): the URL slug used in `/category/[slug]` routes
- **`bcName`**: the exact `name` of the category in BigCommerce (case-sensitive)
- **`displayName`**: shown in the storefront navigation and page titles

If a slug in the URL does not match any key in the `categories` map, the category page returns a 404. If the `bcName` does not match any category in BigCommerce, the category page also returns a 404.

---

## BigCommerce Multi-Channel Configuration

Each brand requires its own BC channel to isolate product catalogs and storefront tokens.

**Channel types**: Use the "Storefront" channel type (not a headless channel) for full GraphQL Storefront API support.

**Storefront tokens**: Generate a token scoped to the channel in **Settings > API Accounts > Storefront API Tokens**. Each channel's token only works for that channel's GraphQL endpoint.

**GraphQL endpoint**: The endpoint URL depends on the channel ID:
- Channel 1 (default): `https://store-{STORE_HASH}.mybigcommerce.com/graphql`
- Other channels: `https://store-{STORE_HASH}-{CHANNEL_ID}.mybigcommerce.com/graphql`

The enrichment script (`enrich.ts`) handles this automatically based on `BIGCOMMERCE_CHANNEL_ID`.

**Category trees**: BigCommerce channels share the global product catalog but can have independent category trees. Create a channel-specific category tree in **Products > Categories**, filter by channel, and assign products to the new tree.

---

## Brand Visual Identity

Theme tokens are injected into `:root` as CSS custom properties. The page layout reads these via `var(--...)`. You do not need to create brand-specific CSS files.

The Google Fonts URL is injected as a `<link rel="stylesheet">` in the document `<head>`. Include all weights used by the theme fonts. JetBrains Mono is used by all brands for monospace/code contexts and should always be included.

For dark-background brands (like Volt), ensure surface tokens provide sufficient contrast:
- `surfaceBg` + `surfaceFg` contrast ratio should meet WCAG AA (4.5:1 for body text)
- `surfaceCard` + `surfaceCardFg` contrast ratio should meet WCAG AA
- `surfaceMuted` + `surfaceMutedFg` is typically relaxed (large text / secondary context)

---

## Shared Infrastructure

All brands can share the same Upstash Redis instance and Supabase Postgres database. Deployed requests use Cloudflare Hyperdrive; local scripts use `DATABASE_URL`. Cache keys are namespaced:

- Layout cache: `aisles:layout:{persona}:{categorySlug}`
- Session store: `aisles:session:{sessionId}`
- Enrichment data: `enriched_products` table, keyed by `(brand_id, bc_entity_id)`

Product entity IDs are scoped by `brand_id` in Postgres, so two brands can use the same BigCommerce ID safely. Category slugs can still overlap in shared cache keys; use brand-prefixed category names and avoid overlapping slugs until cache keys also carry the brand.

If you need strict isolation, use separate Upstash and Supabase instances per brand and bind the appropriate Hyperdrive configuration per Pages project.
