
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
- Order products by visual appeal and narrative flow, not price`,

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
- Copy should be minimal and functional`,

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
- Copy should be informative and precise`,

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
- Order products by giftability score (universal appeal, presentation, value)`,
};

const COMPONENT_GUIDE = `You have exactly 4 components to work with:

1. "editorial-header" — A section with eyebrow text (small caps label), a headline, and body copy.
   Use for: Gatherer layouts to set the editorial tone. Gifter layouts to frame the occasion. Not for Hunter or Researcher.

2. "hero-product" — A large featured product with image, name, description, specs, and price.
   Use for: Gatherer and Gifter layouts to highlight one standout product. Not for Hunter or Researcher.

3. "product-grid" — A grid of product cards. Configurable:
   - columns: 2 (editorial), 3 (moderate), 4 (dense)
   - imageRatio: "landscape" (4:3, editorial) or "square" (compact)
   - showDescription: true for editorial/research, false for dense
   - showSpecs: true to show material/dimensions line
   - showQuickAdd: true for Hunter and Gifter, false for Gatherer and Researcher

4. "category-header" — A compact title bar with optional product count, sort, and filter controls.
   Use for: Hunter and Researcher layouts as the leading section. Can be used for any persona as a subtle header.

RULES:
- Products are pre-sorted by relevance to this persona (highest fit first). Respect this order unless the layout demands otherwise.
- If a product has a persona-fit score, use it: high-fit products should be featured prominently (hero, top of grid); low-fit products go later.
- Every product must appear in at least one section
- Every product must be purchasable (price always visible)
- Use the product IDs exactly as provided — do not invent IDs
- Sections are rendered top to bottom in the order you specify
- Maximum 8 sections total
- The "reasoning" field should explain your layout choices in 1-2 sentences`;

interface PromptProduct {
	id: string;
	name: string;
	price: number;
	salePrice?: number;
	specs: Record<string, string>;
	personaFit?: { gatherer: number; hunter: number; researcher: number; gifter: number } | null;
}

import { getBrand } from '$lib/brand/config';

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

export function buildLayoutPrompt(
	persona: string,
	categoryName: string,
	products: PromptProduct[],
	picksContext?: string,
	rulesContext?: string,
	probabilities?: { gatherer: number; hunter: number; researcher: number; gifter: number },
	incentives?: IncentivesPromptContext,
): string {
	const brand = getBrand();
	const personaDef = PERSONA_DEFINITIONS[persona] || PERSONA_DEFINITIONS.gatherer;

	// Pre-filter to top 15 by persona-fit for layout efficiency.
	// The AI only selects 4-8 products; sending 50 wastes tokens.
	const MAX_LAYOUT_PRODUCTS = 15;
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

	return `You are a merchandising AI for ${brand.prompt.storeDescription} called ${brand.prompt.storeName}. Your job is to arrange a category page layout that serves the shopper's intent.

VOICE: ${brand.prompt.voiceGuidance}

PERSONA:
${personaDef}
${probabilities ? `
PROBABILITY VECTOR: gatherer ${Math.round(probabilities.gatherer * 100)}% | hunter ${Math.round(probabilities.hunter * 100)}% | researcher ${Math.round(probabilities.researcher * 100)}% | gifter ${Math.round(probabilities.gifter * 100)}%
The primary persona is ${persona}, but blend in elements from secondary personas if their score is above 25%. For example, if researcher is 30% alongside a hunter primary, show specs alongside the dense grid.` : ''}

CATEGORY: ${categoryName}

AVAILABLE PRODUCTS (${filtered.length} items, top by ${persona} fit):
${productSummaries}
${picksContext || ''}${rulesContext || ''}${formatIncentivesContext(incentives)}
${COMPONENT_GUIDE}

Generate a layout for this ${persona} shopper browsing the ${categoryName} category.`;
}
