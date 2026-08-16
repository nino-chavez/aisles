/**
 * Brand configuration — the single source of truth for multi-brand support.
 *
 * Selected via BRAND_ID env var (defaults to "kibble").
 * Everything brand-specific — name, tagline, colors, fonts, category mapping,
 * prompt context, voice — comes from here.
 */

export interface BrandConfig {
	/** Trusted merchant boundary. Standalone demo brands do not share an organization. */
	organizationId: string;
	id: string;
	name: string;
	tagline: string;
	domain: string;
	footerNote: string;

	/**
	 * What the catalog's photography actually is. `lifestyle` imagery survives
	 * an edge-to-edge crop with text over it; a `packshot` catalog — product on
	 * a flat sweep — does not, because the crop cuts the product and the
	 * overlay lands on the label. Hero sections read this to choose between
	 * filling the frame and sitting the product inside it.
	 */
	imagery?: 'lifestyle' | 'packshot';

	/**
	 * Operating mode. `content` brands have no online catalog, so surfaces that
	 * assume products (PDP, and the merchandised half of home) resolve to
	 * nothing rather than to an empty grid. Defaults to `storefront`.
	 */
	mode?: 'storefront' | 'content';

	/** BigCommerce channel config */
	bc: {
		channelId: number;
		categoryPrefix: string;
	};

	/** Category slug → BC category name + display name */
	categories: Record<string, { bcName: string; displayName: string }>;

	/** CSS theme tokens (injected into :root) */
	theme: {
		primary: string;
		secondary: string;
		accent: string;
		surfaceBg: string;
		surfaceFg: string;
		surfaceCard: string;
		surfaceCardFg: string;
		surfaceMuted: string;
		surfaceMutedFg: string;
		surfaceBorder: string;
		fontDisplay: string;
		fontBody: string;
		fontMono: string;
		/**
		 * Display-type weight and tracking. Brand-owned because the display
		 * faces disagree: a geometric sans carries 800 at hero size, a serif
		 * has no such weight and looks broken asking for one.
		 */
		fontWeightDisplay: string;
		headingTracking: string;
		/**
		 * `mono` renders prices, percentages, and cadences in the mono face with
		 * tabular figures — the type signal that reads "engine", not "plugin".
		 * `body` keeps numerals in the body face.
		 */
		numericStyle: 'mono' | 'body';
	};

	/** Google Fonts import URL */
	googleFontsUrl: string;

	/** Homepage content — brand-specific editorial copy */
	homepage: {
		heroHeadline: string;
		heroBody: string;
		editorialHeadline: string;
		editorialBody: string;
		valueProps: Array<{ title: string; body: string }>;
	};

	/** LLM prompt context — injected into layout/refine/enrichment prompts */
	prompt: {
		storeName: string;
		storeDescription: string;
		productDomain: string;
		personaDefinitions: Record<string, string>;
		voiceGuidance: string;
	};

	/** Incentives config — consumed by the UIP evaluator. Optional; brands without loyalty omit it. */
	incentives?: BrandIncentivesConfig;
}

export interface BrandIncentivesConfig {
	/** Cart subtotal (minor units / cents) at which free shipping kicks in. Null = no threshold promo. */
	freeShippingThresholdMinor?: number | null;
	/** Loyalty program shape. Omit if brand has no points program. */
	loyalty?: {
		programId: string;
		programName: string;
		/** Unit label, e.g. "points", "sparks", "embers". */
		unit: string;
		/** Ordered tiers from lowest to highest. First is the entry tier. */
		tiers?: Array<{ name: string; unitsRequired: number }>;
	};
}

const BRANDS: Record<string, BrandConfig> = {

	kibble: {
		organizationId: 'kibble-demo-merchant',
		id: 'kibble',
		imagery: 'packshot',
		name: 'Kibble & Co.',
		tagline: 'The good stuff, chosen for you — never running out',
		domain: 'pet supplies & Auto-Refill subscriptions',
		footerNote: 'Kibble & Co. is a fictional demo merchant. An independent demonstration by Nino Chavez — not a BigCommerce product.',

		bc: {
			// Kibble Co Storefront. Channel 1 belongs to the Stencil demo alone;
			// sharing it made every catalog change move both storefronts at once.
			channelId: 1853406,
			categoryPrefix: '',
		},

		categories: {
			'dog-food': { bcName: 'Dog Food', displayName: 'Dog Food' },
			'supplements': { bcName: 'Supplements & Wellness', displayName: 'Supplements & Wellness' },
			'treats': { bcName: 'Treats & Chews', displayName: 'Treats & Chews' },
			'grooming': { bcName: 'Grooming & Care', displayName: 'Grooming & Care' },
			'toys': { bcName: 'Toys', displayName: 'Toys' },
			'walk-gear': { bcName: 'Walk & Gear', displayName: 'Walk & Gear' },
			'beds-apparel': { bcName: 'Beds & Apparel', displayName: 'Beds & Apparel' },
			'bundles': { bcName: 'Bundles', displayName: 'Bundles' },
		},

		theme: {
			primary: '#3b5bd0',
			secondary: '#2f49b0',
			accent: '#37bfa2',
			surfaceBg: '#f3f6fc',
			surfaceFg: '#1e2150',
			surfaceCard: '#ffffff',
			surfaceCardFg: '#1e2150',
			surfaceMuted: '#e9eef7',
			surfaceMutedFg: '#5c6486',
			surfaceBorder: '#d6deee',
			fontDisplay: "'Plus Jakarta Sans', system-ui, sans-serif",
			fontBody: "'Plus Jakarta Sans', system-ui, sans-serif",
			fontWeightDisplay: '800',
			headingTracking: '-0.03em',
			numericStyle: 'mono',
			fontMono: "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace",
		},

		googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap',

		homepage: {
			heroHeadline: 'The good stuff, chosen for you — never running out',
			heroBody: 'Open Farm, Native Pet, Wild One, Finn — the independent pet brands worth trusting, kept in stock by Auto-Refill. Set a cadence, save 10-20% versus one-time, and skip, swap, or pause whenever you need to.',
			editorialHeadline: 'We don\'t list everything. We vouch for things.',
			editorialBody: 'Every brand on the shelf earned its place — real nutrition and gear brands, not a house label dressed up as choice. Auto-Refill runs the routine in the background so the bowl never sits empty.',
			valueProps: [
				{ title: 'Free US shipping', body: 'Every order ships free in the contiguous US. No minimum spend, no fine print.' },
				{ title: 'Auto-Refill saves 10-20%', body: 'Subscribe on any product page and set a cadence — every 1, 2, or 3 months. Skip, swap, or pause anytime, right from your account.' },
				{ title: '30-day guarantee', body: 'Not right for your pet? Send it back within 30 days. The guarantee stands whether you subscribe or buy once.' },
			],
		},

		prompt: {
			storeName: 'Kibble & Co.',
			storeDescription: 'a curated pet-supply retailer built around Auto-Refill subscriptions — independent nutrition and gear brands, kept in stock automatically',
			productDomain: 'pet food, treats, and supplies',
			personaDefinitions: {
				gatherer: 'Browsing without a fixed list yet — new pet, or just curious what everyone else feeds theirs. Wants curated picks, bundles, and brand stories. Think: "what\'s actually good for a new puppy?"',
				hunter: 'Knows exactly what to reorder or buy. Compares price and size, wants the fastest path to checkout, may be setting up Auto-Refill for the first time. Think: "the 24lb bag we already use, on a refill."',
				researcher: 'Reads every ingredient list before switching foods or supplements. Compares brands on formulation, sourcing, and vet guidance. Think: "grain-free vs. limited-ingredient for a dog with allergies."',
				gifter: 'Shopping for someone else\'s pet — a new puppy, a friend\'s dog. Wants gift-ready bundles, broad appeal, and easy returns. Think: "a starter kit for a friend\'s new puppy."',
			},
			voiceGuidance: 'Plain, warm, specific — like a curator who has handled every product on the shelf. Show the math ("$97 instead of $109, every 1, 2, or 3 months") instead of hype ("unbeatable savings"). Credit the brands we carry; never blur them into a house label. No baby talk, no exclamation points, no manufactured urgency.',
		},

		incentives: {
			freeShippingThresholdMinor: 0,
		},

	},
};

/** Get the active brand config based on BRAND_ID env var */
export function getBrand(): BrandConfig {
	// In SvelteKit, use import.meta.env; in Node scripts, use process.env
	const brandId =
		(typeof import.meta !== 'undefined' && import.meta.env?.VITE_BRAND_ID) ||
		(typeof process !== 'undefined' && process.env?.BRAND_ID) ||
		'kibble';

	return Object.prototype.hasOwnProperty.call(BRANDS, brandId) ? BRANDS[brandId] : BRANDS.kibble;
}

/** Get a brand by explicit ID */
export function getBrandById(id: string): BrandConfig | undefined {
	return Object.prototype.hasOwnProperty.call(BRANDS, id) ? BRANDS[id] : undefined;
}

/** All available brand IDs */
export const BRAND_IDS = Object.keys(BRANDS);
