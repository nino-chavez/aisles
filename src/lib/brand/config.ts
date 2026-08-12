/**
 * Brand configuration — the single source of truth for multi-brand support.
 *
 * Selected via BRAND_ID env var (defaults to "haven").
 * Everything brand-specific — name, tagline, colors, fonts, category mapping,
 * prompt context, voice — comes from here.
 */

export interface BrandConfig {
	id: string;
	name: string;
	tagline: string;
	domain: string;
	footerNote: string;

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
	haven: {
		id: 'haven',
		name: 'Haven',
		tagline: 'Furniture for how you actually live',
		domain: 'DTC home furniture',
		footerNote: 'Haven is a demo storefront powered by Aisles',

		bc: {
			channelId: 1,
			categoryPrefix: 'Haven',
		},

		categories: {
			'living-room': { bcName: 'Haven Living Room', displayName: 'Living Room' },
			'office': { bcName: 'Haven Office', displayName: 'Office' },
			'bedroom': { bcName: 'Bedroom', displayName: 'Bedroom' },
			'dining': { bcName: 'Dining', displayName: 'Dining' },
			'outdoor': { bcName: 'Outdoor', displayName: 'Outdoor' },
			'kids': { bcName: 'Kids', displayName: 'Kids' },
		},

		theme: {
			primary: '#a3522d',
			secondary: '#8a4425',
			accent: '#2c6e63',
			surfaceBg: '#faf9f7',
			surfaceFg: '#231f1a',
			surfaceCard: '#ffffff',
			surfaceCardFg: '#353129',
			surfaceMuted: '#f5f3f0',
			surfaceMutedFg: '#6b6459',
			surfaceBorder: '#ebe8e3',
			fontDisplay: "'DM Serif Display', Georgia, serif",
			fontBody: "'DM Sans', system-ui, sans-serif",
			fontMono: "'JetBrains Mono', Menlo, monospace",
		},

		googleFontsUrl: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&family=JetBrains+Mono:wght@400;500&display=swap',

		homepage: {
			heroHeadline: 'Furniture for how you actually live',
			heroBody: 'Pieces that hold up to real life. Pet-friendly fabrics, washable covers, frames that don\'t creak at year five. Design you can see; quality you can feel.',
			editorialHeadline: 'The kind of sofa people rearrange the room around',
			editorialBody: 'Top-grain leather that softens with use. Kiln-dried hardwood frames with double-doweled joints. Built to look better in year three than year one.',
			valueProps: [
				{ title: 'Free shipping over $500', body: 'White-glove delivery on large items. Threshold delivery on everything else. No surprises at checkout.' },
				{ title: '30-day returns', body: 'Live with it for a month. If it doesn\'t work in your space, send it back. We\'ll arrange the pickup.' },
				{ title: '5-year warranty', body: 'Every piece warranted against defects in materials and workmanship. Real coverage, not fine-print exclusions.' },
			],
		},

		prompt: {
			storeName: 'Haven',
			storeDescription: 'a mid-market DTC furniture store — design-forward, approachable, livable',
			productDomain: 'furniture',
			personaDefinitions: {
				gatherer: 'Exploratory, inspiration-driven. Browsing aesthetics, lifestyle imagery, editorial storytelling. Wants to see full rooms, curated collections. Think: flipping through a shelter magazine.',
				hunter: 'Goal-oriented, efficiency-driven. Knows what they need, compares on price/specs, wants quick navigation and clear pricing. Think: "dorm room desk under $300."',
				researcher: 'Methodical, evidence-driven. Reads every spec, compares materials, checks dimensions. Wants side-by-side comparisons and detailed product info. Think: spending 20 minutes on one desk.',
				gifter: 'Shopping for someone else. Needs gift-appropriate price points, universal appeal, easy returns. Think: housewarming present, graduation gift.',
			},
			voiceGuidance: 'Warm and editorial. Lead with story, not specs. "Solid walnut with a waterfall edge" beats "high-quality wood table." No tech-speak, no fake urgency, no superlatives.',
		},

		incentives: {
			freeShippingThresholdMinor: 50000,
			loyalty: {
				programId: 'haven-rewards',
				programName: 'Haven Rewards',
				unit: 'points',
				tiers: [
					{ name: 'Resident', unitsRequired: 0 },
					{ name: 'Host', unitsRequired: 2500 },
					{ name: 'Patron', unitsRequired: 10000 },
				],
			},
		},

	},

	volt: {
		id: 'volt',
		name: 'Volt',
		tagline: 'Sound that moves with you',
		domain: 'consumer audio & electronics',
		footerNote: 'Volt is a demo storefront powered by Aisles',

		bc: {
			channelId: 1846321,
			categoryPrefix: 'Volt',
		},

		categories: {
			'headphones': { bcName: 'Volt Headphones', displayName: 'Headphones' },
			'earbuds': { bcName: 'Volt Earbuds', displayName: 'Earbuds' },
			'speakers': { bcName: 'Volt Speakers', displayName: 'Speakers' },
			'gaming': { bcName: 'Volt Gaming', displayName: 'Gaming' },
		},

		theme: {
			primary: '#6d28d9',
			secondary: '#5b21b6',
			accent: '#06b6d4',
			surfaceBg: '#0a0a0a',
			surfaceFg: '#f5f5f5',
			surfaceCard: '#171717',
			surfaceCardFg: '#e5e5e5',
			surfaceMuted: '#1a1a1a',
			surfaceMutedFg: '#a3a3a3',
			surfaceBorder: '#262626',
			fontDisplay: "'Space Grotesk', system-ui, sans-serif",
			fontBody: "'Inter', system-ui, sans-serif",
			fontMono: "'JetBrains Mono', Menlo, monospace",
		},

		googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap',

		homepage: {
			heroHeadline: 'Sound that moves with you',
			heroBody: 'Headphones, earbuds, speakers, and gaming audio — engineered for how you actually listen. Real specs, honest reviews, no marketing fluff.',
			editorialHeadline: 'Your ears deserve better than "good enough"',
			editorialBody: '40mm custom drivers. 35-hour battery life. LDAC codec support. We lead with the specs because the specs speak for themselves.',
			valueProps: [
				{ title: 'Free shipping', body: 'Every order ships free. No minimum, no catch. Standard delivery in 3-5 days, express available at checkout.' },
				{ title: '30-day trial', body: 'Listen for a month. If the sound isn\'t right for you, return them — no restocking fees, no questions.' },
				{ title: '2-year warranty', body: 'Every product covered against defects. Drivers, batteries, Bluetooth modules — if it breaks, we replace it.' },
			],
		},

		prompt: {
			storeName: 'Volt',
			storeDescription: 'a DTC audio and electronics brand — bold, technical, performance-driven',
			productDomain: 'audio electronics',
			personaDefinitions: {
				gatherer: 'Exploring options, not sure what they need. Wants to see popular picks, staff favorites, lifestyle imagery with products in use. Think: "I need new headphones but haven\'t decided what kind."',
				hunter: 'Knows exactly what they want. Comparing prices, checking specs, looking for deals. Wants filters, quick-add, and clear pricing. Think: "ANC headphones under $150, best battery life."',
				researcher: 'Deep-diving specs. Comparing driver sizes, frequency response, codec support, battery benchmarks. Wants side-by-side comparisons and technical detail. Think: "LDAC vs aptX Adaptive for my DAC setup."',
				gifter: 'Buying audio gear as a gift. Needs approachable products with universal appeal, good unboxing experience, safe price points. Think: "wireless earbuds for my teenager."',
			},
			voiceGuidance: 'Direct and technical. Lead with specs and performance. "40mm custom drivers, 30-hour battery, LDAC support" beats "amazing sound quality." No fluff, no lifestyle filler. Respect the audiophile.',
		},

		incentives: {
			freeShippingThresholdMinor: 0,
			loyalty: {
				programId: 'volt-club',
				programName: 'Volt Club',
				unit: 'watts',
				tiers: [
					{ name: 'Amp', unitsRequired: 0 },
					{ name: 'Driver', unitsRequired: 5000 },
					{ name: 'Studio', unitsRequired: 20000 },
				],
			},
		},

	},

	ember: {
		id: 'ember',
		name: 'Ember',
		tagline: 'Gather around something real',
		domain: 'outdoor lifestyle & fire',
		footerNote: 'Ember is a demo storefront powered by Aisles',

		bc: {
			channelId: 1846324,
			categoryPrefix: 'Ember',
		},

		categories: {
			'fire-pits': { bcName: 'Ember Fire Pits', displayName: 'Fire Pits' },
			'camp-stoves': { bcName: 'Ember Camp Stoves', displayName: 'Camp Stoves' },
			'grills': { bcName: 'Ember Grills', displayName: 'Grills' },
			'accessories': { bcName: 'Ember Accessories', displayName: 'Accessories' },
		},

		theme: {
			primary: '#c2410c',
			secondary: '#9a3412',
			accent: '#65a30d',
			surfaceBg: '#faf5f0',
			surfaceFg: '#1c1917',
			surfaceCard: '#ffffff',
			surfaceCardFg: '#292524',
			surfaceMuted: '#f5ebe0',
			surfaceMutedFg: '#78716c',
			surfaceBorder: '#e7e0d8',
			fontDisplay: "'Libre Baskerville', Georgia, serif",
			fontBody: "'Source Sans 3', system-ui, sans-serif",
			fontMono: "'JetBrains Mono', Menlo, monospace",
		},

		googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&family=Source+Sans+3:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap',

		homepage: {
			heroHeadline: 'Gather around something real',
			heroBody: 'Fire pits, camp stoves, grills, and everything you need to bring people together outdoors. Smokeless burns, real materials, built for the backyard you actually use.',
			editorialHeadline: 'The backyard upgrade nobody regrets',
			editorialBody: 'Double-wall stainless steel. Secondary combustion that burns off smoke before it reaches your eyes. 19 inches of fire that fits six chairs around it.',
			valueProps: [
				{ title: 'Free shipping on fire pits', body: 'Every fire pit ships free to the lower 48. Stoves and accessories ship free over $100. No surprises.' },
				{ title: 'Season-proof guarantee', body: 'Leave it outside year-round. Our stainless and corten steel are built for rain, snow, and sun. No cover required (but we sell one).' },
				{ title: 'Lifetime burn warranty', body: 'The burn chamber is warrantied for life. If the airflow system fails, we replace the unit. Period.' },
			],
		},

		prompt: {
			storeName: 'Ember',
			storeDescription: 'an outdoor lifestyle brand centered on fire, gathering, and the backyard experience',
			productDomain: 'outdoor fire and cooking products',
			personaDefinitions: {
				gatherer: 'Dreaming about the backyard they want. Browsing fire pit setups, patio inspiration, seasonal entertaining ideas. Think: scrolling Instagram patio accounts.',
				hunter: 'Buying for a specific occasion — Memorial Day cookout, camping trip, new patio. Compares fuel types, portability, price. Think: "best portable fire pit under $200 for camping."',
				researcher: 'Deep in specs. BTU output, fuel efficiency, burn time, material durability, assembly complexity. Reads every review. Think: "stainless vs corten steel for a permanent fire pit."',
				gifter: 'Fire pit as a housewarming or holiday gift. Needs impressive presentation, reasonable shipping, and broad appeal. Think: "something impressive for my brother\'s new house."',
			},
			voiceGuidance: 'Warm and rugged. Evocative but honest. "Double-wall stainless, smokeless burn, 19-inch diameter — fits six chairs around it" beats "the ultimate outdoor experience." Seasonal urgency is real (spring/summer), not manufactured.',
		},

		incentives: {
			freeShippingThresholdMinor: 10000,
			loyalty: {
				programId: 'ember-circle',
				programName: 'Ember Circle',
				unit: 'embers',
				tiers: [
					{ name: 'Spark', unitsRequired: 0 },
					{ name: 'Flame', unitsRequired: 1500 },
					{ name: 'Blaze', unitsRequired: 6000 },
				],
			},
		},

	},

	kibble: {
		id: 'kibble',
		name: 'Kibble & Co.',
		tagline: 'The good stuff, chosen for you — never running out',
		domain: 'pet supplies & Auto-Refill subscriptions',
		footerNote: 'Kibble & Co. is a fictional demo merchant. An independent demonstration by Nino Chavez — not a BigCommerce product.',

		bc: {
			channelId: 1,
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
		'haven';

	return BRANDS[brandId] || BRANDS.haven;
}

/** Get a brand by explicit ID */
export function getBrandById(id: string): BrandConfig | undefined {
	return BRANDS[id];
}

/** All available brand IDs */
export const BRAND_IDS = Object.keys(BRANDS);
