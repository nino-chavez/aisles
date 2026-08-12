
/**
 * Generation-contract version. BUMP THIS whenever COMPONENT_GUIDE,
 * PERSONA_DEFINITIONS, or the layout schema changes — it is part of the
 * layout cache key, and without a bump a rules change deploys to a site that
 * keeps serving compositions generated under the old rules until the TTL
 * happens to expire.
 */
export const PROMPT_VERSION = 'v4';

/**
 * Cap on products sent into a layout prompt, shared with catalog loading so
 * a cross-category surface (home) doesn't overfetch past what the prompt
 * will use — prompt size drives both cost and the grammar budget.
 */
export const MAX_LAYOUT_PRODUCTS = 15;

/**
 * Build the system prompt for layout generation.
 * The AI receives persona definitions, component vocabulary, and product summaries.
 * It returns a Layout schema that the renderer interprets.
 */

const PERSONA_DEFINITIONS: Record<string, string> = {
	gatherer: `GATHERER persona — an exploratory, inspiration-driven shopper.
They browse at a leisurely pace, relying on visual cues and editorial storytelling.
They want to discover, be inspired, and imagine how pieces fit their space.

Layout principles:
- Lead with an editorial header (eyebrow + headline + body copy)
- Feature one hero product with a large lifestyle image and detailed specs
- Use a 2-column editorial grid with landscape (4:3) images
- Show product descriptions — the story matters
- No quick-add buttons — this shopper wants to browse, not rush
- Copy should be warm, editorial, magazine-like (think shelter magazine)
- Order products by visual appeal and narrative flow, not price
- New vocabulary: prefer "editorial-hero" over "hero-product" for the opening visual; "category-tile-grid" (2-3 columns) or "cluster-chip-row" for thematic browsing; skip "lifestyle-price-hero" and "service-callouts-grid" — price-led and trust-strip elements break the editorial mood`,

	hunter: `HUNTER persona — a goal-oriented, efficiency-driven shopper.
They know what they need and want to find it fast. Price and specs matter most.
The interface should get out of the way.

Layout principles:
- Lead with a compact category header showing count and sort/filter controls
- Use a dense 3-4 column grid with square images
- Show specs inline (material, dimensions — the facts)
- Show quick-add buttons on every card
- No editorial copy — no hero product, no lifestyle stories
- Sort products by price (low to high) by default
- Copy should be minimal and functional
- New vocabulary: "product-carousel" only as a secondary "more like this" rail after the grid, never the lead; "service-callouts-grid" for shipping/returns trust signals; skip "editorial-hero", "cluster-chip-row", and "category-tile-grid" — this shopper wants the grid, not more browsing surfaces`,

	researcher: `RESEARCHER persona — a methodical, evidence-driven shopper.
They compare options systematically, reading specs, reviews, and expert opinions.
They want data to make an informed decision, not inspiration or speed.

Layout principles:
- Lead with a category header showing count, sort by rating, and filter controls
- Use a 2-3 column grid with square images
- Show full specs inline on every card (material, dimensions, weight, features)
- Show product descriptions — detail matters
- No quick-add buttons — they're not ready to buy yet, they're evaluating
- No editorial fluff — factual, structured, comparison-friendly
- Order products by relevance to query, then by rating/review count
- Copy should be informative and precise
- New vocabulary: skip hero-style and thematic-browsing components entirely ("editorial-hero", "lifestyle-price-hero", "cluster-chip-row", "category-tile-grid") — they add narrative or navigation, not comparison data. "service-callouts-grid" only if a callout states a fact (e.g. return window), never a marketing line`,

	gifter: `GIFTER persona — shopping for someone else, often with a budget and occasion.
They need guidance on what makes a good gift, price tiers, and giftability.
They want curation and confidence that the recipient will love it.

Layout principles:
- Lead with an editorial header framing the gift context (occasion, recipient type)
- Feature one hero product as the "top pick" with a clear value proposition
- Use a 2-3 column grid with landscape images (gifts should look appealing)
- Show product descriptions focused on why it makes a great gift
- Show quick-add buttons — gifters decide faster once convinced
- Group or call out price tiers ("Under $100", "Splurge-worthy")
- Copy should be warm, reassuring, and focused on the recipient's experience
- Order products by giftability score (universal appeal, presentation, value)
- New vocabulary: "lifestyle-price-hero" works well as the "top pick" in place of "hero-product" when price/value is the hook; "cluster-chip-row" for named gift themes ("Under $50", "For Her"); "category-tile-grid" (2-3 columns) for occasion browsing`,
};

const COMPONENT_GUIDE = `You have 11 components to work with, grouped by what they're for.

Single-product spotlights (a detail-page idiom — never the lead or only section on a browse page):

1. "hero-product" — A large featured product with image, name, description, specs, and price.
   Use for: Gatherer and Gifter layouts to highlight one standout product. Not for Hunter or Researcher.

2. "editorial-hero" — A full-width lifestyle image (16:7) with a headline, optional eyebrow/body copy, and a link to one product. No price shown.
   Use for: Gatherer as an opening visual to set editorial tone. Not for Hunter or Researcher.

3. "lifestyle-price-hero" — A full-width lifestyle image with a bold price/savings overlay and a CTA button.
   Use for: Gifter as the "top pick" hero, or Hunter as a deal-led opener. Not for Gatherer (no price hook) or Researcher.

4. "image-gallery" — A single product's image with a thumbnail rail (the catalog supplies one image per product, so thumbnails repeat it — treat this as a zoomed detail view, not a page opener).
   Use for: any persona, sparingly, after the shopper has already seen the product grid. Never as the first section.

Browsing surfaces (a category page must lead with one of these):

5. "product-grid" — A grid of product cards. Configurable:
   - columns: 2 (editorial), 3 (moderate), 4 (dense)
   - imageRatio: "landscape" (4:3, editorial) or "square" (compact)
   - showDescription: true for editorial/research, false for dense
   - showSpecs: true to show material/dimensions line
   - showQuickAdd: true for Hunter and Gifter, false for Gatherer and Researcher

6. "product-carousel" — A horizontally scrolling row of 3-10 product cards with a title.
   Use for: a secondary rail below the primary grid ("You Might Also Like", "More to Explore") — never as the only browsing surface.

7. "category-tile-grid" — A grid of 2-5 columns linking to themed product groupings, image-led with a caption.
   Use for: Gatherer and Gifter to invite exploration by theme. Sparing or unused for Hunter and Researcher, who want the product list, not more browsing.

Structural / header:

8. "editorial-header" — A section with eyebrow text (small caps label), a headline, and body copy.
   Use for: Gatherer layouts to set the editorial tone. Gifter layouts to frame the occasion. Not for Hunter or Researcher.

9. "category-header" — A compact title bar with optional product count, sort, and filter controls.
   Use for: Hunter and Researcher layouts as the leading section. Can be used for any persona as a subtle header.

Trust / navigation strips:

10. "service-callouts-grid" — A strip of 3-4 icon callouts (shipping, returns, rewards, store, gift, quality, secure, support) with label and optional body text. Icon must be one of the eight fixed keys.
    Use for: Hunter and Gifter, where logistics/trust reduce friction. Skip for Gatherer (breaks editorial mood). Use sparingly for Researcher (they want specs, not marketing).

11. "cluster-chip-row" — A row of 3-8 themed link chips ("VACATION READY", "UNDER $50"), each pointing at one representative product.
    Use for: Gatherer and Gifter, above the grid, for thematic/occasion discovery. Skip for Hunter and Researcher — chips slow down a shopper who already knows what they want.

COMPOSITION RULES:

Surface fit — this is a browse/category page, not a product detail page.
- "hero-product", "editorial-hero", "lifestyle-price-hero", and "image-gallery" each spotlight ONE product at large scale. They are a detail-page idiom borrowed for a single highlight. A layout may use at most one of them, and never as the page's only section.
- Every layout must include at least one browsing section — "product-grid", "product-carousel", or "category-tile-grid" (enforced by the schema, not optional).

Scale — no single image may dominate the viewport.
- At most one single-product hero-style section per layout (see Surface fit above).
- "editorial-hero" and "lifestyle-price-hero" are the widest media elements available. Use one as an opener, immediately followed by a multi-product section — never let a hero stand alone as the whole page.

Density per persona:
- Gatherer: 2-column editorial grid, landscape images. "category-tile-grid" at 2-3 columns for thematic browsing. "product-carousel" only as a short (3-5) supplementary rail below the grid, never the lead.
- Hunter: dense 3-4 column grid, square images. "category-tile-grid" at 4-5 columns if used at all. "product-carousel" only as a "more like this" rail after the grid, never the primary browsing surface.
- Researcher: 2-3 column grid, square images, full specs. Tile grids and carousels are low priority — this shopper wants the comparison grid, not more browsing surfaces.
- Gifter: 2-3 column grid, landscape images. "category-tile-grid" at 2-3 columns for occasion/theme browsing (e.g. "Under $100", "For Her"). "cluster-chip-row" works well for named gift themes.

Page shape:
- Every layout has 2-8 sections (enforced by the schema).
- No two adjacent sections use the same component — vary the rhythm (enforced by the schema).
- Every layout must include at least one browsing section (enforced by the schema, see Surface fit above).
- Every product must appear in at least one section.
- Every product must be purchasable (price always visible somewhere it's shown).

Proof elements — when price/savings/service signals help versus when they're noise:
- "lifestyle-price-hero" leads with price as the hook — use for Hunter and Gifter, where price drives the decision. Never for Gatherer, whose hero is "editorial-hero" (story, not price).
- "service-callouts-grid" reduces purchase friction — use for Hunter and Gifter. Skip for Gatherer. Use sparingly for Researcher.
- Price/savings copy in "lifestyle-price-hero" priceLabel must be built from the real price/salePrice given for that product — never invent a number or percentage.

RULES:
- Products are pre-sorted by relevance to this persona (highest fit first). Respect this order unless the layout demands otherwise.
- If a product has a persona-fit score, use it: high-fit products should be featured prominently (hero, top of grid); low-fit products go later.
- Sections are rendered top to bottom in the order you specify
- Use the product IDs exactly as provided — do not invent IDs
- Images and links are resolved from the product ID you provide — never write a raw image URL or href; the renderer fills in the asset and route from the catalog
- The "reasoning" field should explain your layout choices in 1-2 sentences`;

interface PromptProduct {
	id: string;
	name: string;
	price: number;
	salePrice?: number;
	specs: Record<string, string>;
	personaFit?: { gatherer: number; hunter: number; researcher: number; gifter: number } | null;
}

import { getBrand, type BrandConfig } from '$lib/brand/config';

export interface IncentivesPromptContext {
	/** Loyalty tier progress — "250 points from Gold tier". Omit if no loyalty state. */
	tierUnitsToNext?: number | null;
	tierCurrent?: string;
	tierNext?: string;
	/** Wallet spendable balance in minor units. */
	walletBalanceMinor?: number;
	walletUnit?: string;
	/** Applied promo codes the shopper brought into the session. */
	appliedCodes?: string[];
}

function formatIncentivesContext(ctx: IncentivesPromptContext | undefined): string {
	if (!ctx) return '';
	const lines: string[] = [];
	if (ctx.walletBalanceMinor && ctx.walletBalanceMinor > 0) {
		const unit = ctx.walletUnit ?? 'points';
		lines.push(`- Loyalty wallet: ${ctx.walletBalanceMinor} ${unit} available to spend`);
	}
	if (ctx.tierCurrent && ctx.tierNext && ctx.tierUnitsToNext != null && ctx.tierUnitsToNext > 0) {
		lines.push(
			`- Tier progress: ${ctx.tierUnitsToNext} ${ctx.walletUnit ?? 'points'} from ${ctx.tierNext} (currently ${ctx.tierCurrent})`,
		);
	}
	if (ctx.appliedCodes && ctx.appliedCodes.length > 0) {
		lines.push(`- Applied promo code(s): ${ctx.appliedCodes.join(', ')}`);
	}
	if (lines.length === 0) return '';
	return `
INCENTIVE STATE (shopper's current loyalty + promotion context — reference naturally in copy if it fits, do not force it):
${lines.join('\n')}
`;
}

/**
 * Home-surface framing — replaces the CATEGORY line for the storefront home
 * page. Tells the model it's composing an entry surface (no category
 * context, shopper may have no goal yet) and feeds the merchant's own
 * homepage copy as source material, not text to copy verbatim.
 */
function formatHomeFraming(brand: BrandConfig): string {
	const valueProps = brand.homepage.valueProps.map((v) => `${v.title} — ${v.body}`).join('\n- ');
	return `SURFACE: This is the STOREFRONT HOME PAGE, not a category page. It is the entry surface — the shopper has not picked a category and may not have a specific goal yet. The layout must give a route INTO the catalog (categories or themed groupings), not just a flat product list. Persona density rules still apply.

MERCHANT POSITIONING (source material to draw from — do not copy verbatim):
- Hero: "${brand.homepage.heroHeadline}" — ${brand.homepage.heroBody}
- Editorial: "${brand.homepage.editorialHeadline}" — ${brand.homepage.editorialBody}
- ${valueProps}`;
}

export function buildLayoutPrompt(
	persona: string,
	categoryName: string,
	products: PromptProduct[],
	picksContext?: string,
	rulesContext?: string,
	probabilities?: { gatherer: number; hunter: number; researcher: number; gifter: number },
	incentives?: IncentivesPromptContext,
	isHome = false,
): string {
	const brand = getBrand();
	const personaDef = PERSONA_DEFINITIONS[persona] || PERSONA_DEFINITIONS.gatherer;

	// Pre-filter to top MAX_LAYOUT_PRODUCTS by persona-fit for layout
	// efficiency. The AI only selects 4-8 products; sending 50 wastes tokens.
	const filtered = products.length > MAX_LAYOUT_PRODUCTS
		? [...products]
			.sort((a, b) => {
				const fitA = a.personaFit?.[persona as keyof NonNullable<typeof a.personaFit>] ?? 0.5;
				const fitB = b.personaFit?.[persona as keyof NonNullable<typeof b.personaFit>] ?? 0.5;
				return fitB - fitA;
			})
			.slice(0, MAX_LAYOUT_PRODUCTS)
		: products;

	const productSummaries = filtered.map((p) => {
		const specs = Object.entries(p.specs)
			.slice(0, 3)
			.map(([k, v]) => `${k}: ${v}`)
			.join(', ');
		const price = p.salePrice
			? `$${p.salePrice} (sale from $${p.price})`
			: `$${p.price}`;
		const fit = p.personaFit
			? ` | ${persona}-fit: ${(p.personaFit[persona as keyof typeof p.personaFit] * 100).toFixed(0)}%`
			: '';
		return `- ID: "${p.id}" | ${p.name} | ${price} | ${specs}${fit}`;
	}).join('\n');

	return `You are a merchandising AI for ${brand.prompt.storeDescription} called ${brand.prompt.storeName}. Your job is to arrange a ${isHome ? 'storefront home page' : 'category page'} layout that serves the shopper's intent.

VOICE: ${brand.prompt.voiceGuidance}

PERSONA:
${personaDef}
${probabilities ? `
PROBABILITY VECTOR: gatherer ${Math.round(probabilities.gatherer * 100)}% | hunter ${Math.round(probabilities.hunter * 100)}% | researcher ${Math.round(probabilities.researcher * 100)}% | gifter ${Math.round(probabilities.gifter * 100)}%
The primary persona is ${persona}, but blend in elements from secondary personas if their score is above 25%. For example, if researcher is 30% alongside a hunter primary, show specs alongside the dense grid.` : ''}

${isHome ? formatHomeFraming(brand) : `CATEGORY: ${categoryName}`}

AVAILABLE PRODUCTS (${filtered.length} items, top by ${persona} fit):
${productSummaries}
${picksContext || ''}${rulesContext || ''}${formatIncentivesContext(incentives)}
${COMPONENT_GUIDE}

Generate a layout for this ${persona} shopper ${isHome ? `landing on the ${categoryName} home page` : `browsing the ${categoryName} category`}.`;
}
