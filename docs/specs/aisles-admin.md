# Spec: Aisles Admin — BigCommerce Marketplace App

## Purpose

A BigCommerce marketplace app that gives merchandisers, brand managers, and growth leads control over the Aisles AI personalization engine. Lives in the BC admin panel as an embedded iframe app, separate from the storefront deployment.

## Architecture

```
┌─────────────────────────────────┐
│  BigCommerce Admin Panel         │
│  ├─ Products, Orders, etc.       │
│  └─ Apps → Aisles ──────────────┼──→  aisles-admin (Next.js on Vercel)
└─────────────────────────────────┘     │
                                         ├─ OAuth flow (install/load/uninstall)
                                         ├─ Session JWT in partitioned cookies
                                         ├─ BigDesign UI for admin interface
                                         │
                                         ▼
                                    Shared Neon Postgres
                                    ├─ merchandising_rules (admin writes, storefront reads)
                                    ├─ generation_logs (storefront writes, admin reads)
                                    ├─ enriched_products (pipeline writes, both read)
                                         │
                                         ▼
┌─────────────────────────────────┐
│  Aisles Storefront (SvelteKit)   │
│  Reads merchandising_rules at    │
│  layout generation time          │
└─────────────────────────────────┘
```

**Key principle**: The admin writes rules. The storefront reads them. They share a database but never share a deployment.

## Repo & Deployment

- **Repo**: github.com/nino-chavez/aisles-admin (private)
- **Framework**: Next.js 15 (App Router)
- **Deployment**: Vercel (separate project from the storefront)
- **Database**: Shared Neon Postgres (same `DATABASE_URL` as the storefront)
- **Auth store**: Upstash Redis (store credentials)
- **UI**: BigDesign (BigCommerce's design system)

## Business User Personas

### 1. Merchandiser / E-commerce Manager

The person who currently logs into BC admin and manually arranges category pages.

**Needs**:
- See what the AI is doing in plain language
- Pin specific products as hero/featured for a persona
- Exclude products from personas or categories
- Set seasonal overrides ("gift-focused layouts in November")
- Clear the layout cache when rules change

### 2. Brand / Marketing Manager

Controls campaigns, promotions, and brand voice.

**Needs**:
- Edit brand voice guidance without touching code
- Launch campaigns that influence persona behavior
- Preview what each persona sees before publishing
- A/B test persona strategies

### 3. Analytics / Growth Lead

Measures whether AI personalization is working.

**Needs**:
- Persona distribution (% visitors per persona)
- Cost per session vs revenue attribution
- Cache hit rate and cost savings
- Which inference rules fire most

## Features

### Tab 1: Merchandising Rules

CRUD interface for rules that override AI defaults. Rules are stored in `merchandising_rules` table and read by the storefront at layout generation time.

**Rule types**:

| Type | Description | Example |
|------|-------------|---------|
| `pin` | Force a product into a specific layout position for a persona | "Show Holiday Sofa as hero for Gifters in Living Room" |
| `exclude` | Hide a product from a persona's layouts | "Never show clearance items to Gatherers" |
| `boost` | Increase a category's priority for a persona | "Boost Outdoor for all personas May-September" |
| `seasonal` | Time-bound override that auto-activates/expires | "Black Friday: deals-first layout Nov 28 - Dec 2" |

**Schema** (`merchandising_rules` table):
```sql
CREATE TABLE merchandising_rules (
  id            SERIAL PRIMARY KEY,
  store_hash    TEXT NOT NULL,
  rule_type     TEXT NOT NULL CHECK (rule_type IN ('pin', 'exclude', 'boost', 'seasonal')),
  persona       TEXT,           -- null = all personas
  category_slug TEXT,           -- null = all categories
  product_id    TEXT,           -- for pin/exclude rules
  config        JSONB NOT NULL, -- rule-specific config (position, priority, etc.)
  active        BOOLEAN DEFAULT true,
  starts_at     TIMESTAMPTZ,    -- for seasonal rules
  expires_at    TIMESTAMPTZ,
  created_by    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
```

**Storefront integration**: The layout prompt builder queries active rules for the current persona + category and injects them as constraints:
```
MERCHANDISING RULES (from the store admin):
- PIN: "Holiday Sofa" must appear as hero product
- EXCLUDE: Do not include "Clearance Ottoman" in this layout
- BOOST: Prioritize products from "Outdoor" category
```

### Tab 2: Persona Analytics

Reads from `generation_logs` to show:

- **Persona distribution**: pie chart of primary personas across sessions
- **Cost by persona**: which persona costs the most to serve (gifter layouts are more complex?)
- **Cache hit rate**: overall and per-persona
- **Daily cost trend**: line chart of AI spend over time
- **Top categories**: which categories generate the most AI calls

API: `GET /stores/{storeHash}/api/analytics?days=7`

### Tab 3: Layout Preview

"Show me what a Hunter sees on the Headphones page."

- Persona selector (Gatherer / Hunter / Researcher / Gifter)
- Category selector (from the store's categories)
- Iframe that loads the storefront with `?intent={persona}` to force a specific persona view
- Side-by-side comparison: "This is what Gatherer sees vs what Hunter sees"

### Tab 4: AI Cost Dashboard

- Today's cost, this week, this month
- Cost breakdown by type (layout / refine / suggest / enrichment)
- Cache savings estimate ("Cache prevented $X.XX in AI calls today")
- Model usage (Haiku vs Sonnet fallback count)

## Storefront Integration

The storefront needs to read merchandising rules at layout generation time. This requires:

1. **New query in the storefront** (`src/lib/server/rules.ts`):
   ```typescript
   export async function getActiveRules(storeHash: string, persona: string, categorySlug: string) {
     const sql = getDb();
     return sql`
       SELECT * FROM merchandising_rules
       WHERE store_hash = ${storeHash}
         AND active = true
         AND (persona IS NULL OR persona = ${persona})
         AND (category_slug IS NULL OR category_slug = ${categorySlug})
         AND (expires_at IS NULL OR expires_at > NOW())
         AND (starts_at IS NULL OR starts_at <= NOW())
       ORDER BY rule_type, created_at DESC
     `;
   }
   ```

2. **Inject rules into layout prompt** (in `buildLayoutPrompt`):
   ```
   MERCHANDISING RULES:
   - PIN hero: "product-id-123" (set by admin)
   - EXCLUDE: "product-id-456" (set by admin)
   ```

3. **Store hash identification**: The storefront needs a `STORE_HASH` env var so it can query rules for its own store.

## Build Sequence

1. ~~Scaffold: Next.js + BC auth + BigDesign~~ (done)
2. ~~Rules API: CRUD for merchandising_rules~~ (done)
3. ~~Analytics API: reads from generation_logs~~ (done)
4. Register in BC Developer Portal (manual — need callback URLs)
5. Wire rules into storefront layout prompt
6. Build the Rules UI with BigDesign form components
7. Build the Analytics dashboard with real data
8. Build the Layout Preview iframe
9. Build the Cost dashboard
10. Deploy and test end-to-end

## BigCommerce App Registration

Register at https://devtools.bigcommerce.com/my/apps:

- **Auth Callback**: `https://aisles-admin.vercel.app/api/auth`
- **Load Callback**: `https://aisles-admin.vercel.app/api/load`
- **Uninstall Callback**: `https://aisles-admin.vercel.app/api/uninstall`
- **Remove User Callback**: `https://aisles-admin.vercel.app/api/remove-user`

**Required OAuth Scopes**:
- `store_v2_products` (read products for rule targeting)
- `store_v2_content` (read categories)
- `store_v2_orders` (read orders for analytics attribution)
