export const KIBBLE_HOME_PRESENTATION_POLICY = {
	policyVersion: 'kibble-home-presentation-assist-v2',
	zoneIds: ['home.hero', 'home.featured-row.1', 'home.editorial-strip'],
	capabilities: ['rank_products', 'select_copy_variant', 'select_component_variant', 'reorder_zones'],
} as const;

export const KIBBLE_PLP_PRESENTATION_POLICY = {
	policyVersion: 'kibble-plp-presentation-assist-v2',
	zoneIds: ['plp.editorial-header', 'plp.product-ranking', 'plp.marketing-block'],
	capabilities: ['rank_products', 'select_copy_variant', 'toggle_zone'],
} as const;

export const KIBBLE_PDP_PRESENTATION_POLICY = {
	policyVersion: 'kibble-pdp-presentation-assist-v2',
	zoneIds: ['pdp.related', 'pdp.below-description'],
	capabilities: ['rank_products', 'select_copy_variant', 'toggle_zone'],
} as const;

export const KIBBLE_SEARCH_PRESENTATION_POLICY = {
	policyVersion: 'kibble-search-empty-presentation-assist-v1',
	zoneIds: ['search.empty-state'],
	capabilities: ['select_copy_variant'],
	latitude: 'narrow',
} as const;

export const KIBBLE_CART_PRESENTATION_POLICY = {
	policyVersion: 'kibble-cart-empty-presentation-assist-v1',
	zoneIds: ['cart.empty-state'],
	capabilities: ['select_copy_variant'],
	latitude: 'narrower',
} as const;

export const KIBBLE_CHECKOUT_PRESENTATION_POLICY = {
	policyVersion: 'kibble-checkout-assurance-assist-v1',
	zoneIds: ['checkout.assurance-strip'],
	capabilities: ['select_copy_variant'],
	latitude: 'narrowest',
} as const;

const HOME_HERO_VARIANTS = {
	'merchant-baseline': {
		eyebrow: 'The brands on your shelf · kept in view',
		headline: 'The brands worth trusting, organized around your routine.',
		body: 'Open Farm, Native Pet, Wild One, and Finn — organized around food, wellness, care, gear, and repeat-purchase routines.',
	},
	'visit-fast-path': {
		eyebrow: 'A clearer path through the catalog',
		headline: 'Start with the shelf that fits this visit.',
		body: 'Explore current products across dog food, wellness, treats, care, gear, and bundles.',
	},
	'compare-with-context': {
		eyebrow: 'Shop with the full shelf in view',
		headline: 'Compare what matters, then keep the routine moving.',
		body: 'Browse current catalog options across food, wellness, care, gear, and bundles.',
	},
} as const;

const HOME_FEATURED_VARIANTS = {
	'merchant-baseline': { eyebrow: 'Catalog', title: 'Featured', browseAllLabel: 'Browse Dog Food' },
	'visit-start': { eyebrow: 'For this visit', title: 'A shelf to start with', browseAllLabel: 'Browse all dog food' },
	'compare-current': { eyebrow: 'Current catalog', title: 'Compare these first', browseAllLabel: 'See the full dog food shelf' },
} as const;

const HOME_CATALOG_VARIANTS = {
	'merchant-baseline': { eyebrow: 'Browse', title: 'Shop by category' },
	'routine-builder': { eyebrow: 'The routine', title: 'Build out the rest of the routine' },
	'compare-categories': { eyebrow: 'Browse', title: 'Compare the catalog by category' },
} as const;

const HOME_CATALOG_COMPONENTS = {
	'four-column': { columns: 4 as const, label: 'Four-column category grid' },
	'two-column': { columns: 2 as const, label: 'Two-column category grid' },
} as const;

const HOME_SECTION_ORDERS = {
	'featured-then-catalog': { order: ['featured', 'catalog'] as const, label: 'Featured shelf → category browse' },
	'catalog-then-featured': { order: ['catalog', 'featured'] as const, label: 'Category browse → featured shelf' },
} as const;

const PLP_HEADER_VARIANTS = {
	'merchant-baseline': { eyebrow: 'Catalog', headlinePrefix: '', bodySuffix: '' },
	'guided-start': { eyebrow: 'For this visit', headlinePrefix: 'Start with ', bodySuffix: ' · AI selected a starting order' },
	'compare-first': { eyebrow: 'Compare', headlinePrefix: '', bodySuffix: ' · arranged to compare first' },
} as const;

const PDP_RELATED_COPY_VARIANTS = {
	'merchant-baseline': 'You may also like',
	'continue-routine': 'Continue the routine',
	'compare-related': 'Compare related options',
} as const;

const SEARCH_EMPTY_COPY_VARIANTS = {
	'merchant-baseline': {
		eyebrow: 'No matches',
		headline: 'Nothing matched that search',
		body: 'Try a different keyword, or browse all categories.',
	},
	'broaden-search': {
		eyebrow: 'Try a broader path',
		headline: 'Search by routine instead.',
		body: 'Try food, wellness, treats, care, gear, or bundles to reopen the current catalog.',
	},
	'category-recovery': {
		eyebrow: 'Keep browsing',
		headline: 'The catalog still has a way forward.',
		body: 'Start from a category, then narrow the shelf with another search.',
	},
} as const;

const CART_EMPTY_COPY_VARIANTS = {
	'merchant-baseline': {
		eyebrow: 'Commerce boundary',
		headline: 'No cart was loaded.',
		body: 'This demo can adapt presentation, but it does not create, price, or change a cart.',
	},
	'return-to-routine': {
		eyebrow: 'Continue from the catalog',
		headline: 'Build the routine before checkout.',
		body: 'Return to the merchant-owned catalog to compare food, wellness, care, and gear.',
	},
	'compare-first': {
		eyebrow: 'Compare first',
		headline: 'Keep product facts in view.',
		body: 'Review current names, prices, and product details before a connected cart takes over.',
	},
} as const;

const CHECKOUT_ASSURANCE_VARIANTS = {
	'merchant-baseline': {
		columns: 3 as const,
		callouts: [
			{ icon: 'secure', label: 'Commerce-owned checkout', body: 'Payment and order state stay with the connected commerce service.' },
			{ icon: 'quality', label: 'Presentation only', body: 'AI may choose this approved reassurance set; it cannot place an order.' },
			{ icon: 'support', label: 'No invented transaction', body: 'This preview does not imitate totals, payment, or confirmation.' },
		],
	},
	'trust-first': {
		columns: 3 as const,
		callouts: [
			{ icon: 'secure', label: 'Checkout stays protected', body: 'Payment fields and purchase authorization remain commerce-owned.' },
			{ icon: 'returns', label: 'Policy stays merchant-owned', body: 'The model cannot alter returns, shipping, or purchase terms.' },
			{ icon: 'support', label: 'Presentation is bounded', body: 'Only this approved assurance set can change in the demo.' },
		],
	},
	'continuity': {
		columns: 3 as const,
		callouts: [
			{ icon: 'quality', label: 'Adaptive presentation', body: 'The page can respond to intent without taking over the transaction.' },
			{ icon: 'secure', label: 'Fixed purchase boundary', body: 'Payment, totals, and order creation stay outside the model call.' },
			{ icon: 'support', label: 'Approved choices only', body: 'The provider returns an allow-listed assurance ID, not raw checkout copy.' },
		],
	},
} as const;

export const KIBBLE_MARKETING_BLOCKS = {
	none: null,
	'routine-builder': {
		eyebrow: 'Build the routine',
		headline: 'Explore what comes next.',
		body: 'Browse current food, wellness, care, and gear options from the merchant catalog.',
	},
	'compare-current': {
		eyebrow: 'Compare the current shelf',
		headline: 'Keep product facts in view.',
		body: 'Names, prices, images, and destinations remain catalog-owned while the presentation adapts.',
	},
} as const;

export type KibbleHomePresentationDecision = {
	heroCopyVariantId: keyof typeof HOME_HERO_VARIANTS;
	featuredCopyVariantId: keyof typeof HOME_FEATURED_VARIANTS;
	catalogCopyVariantId: keyof typeof HOME_CATALOG_VARIANTS;
	catalogComponentVariantId: keyof typeof HOME_CATALOG_COMPONENTS;
	sectionOrderId: keyof typeof HOME_SECTION_ORDERS;
};

export type KibbleHomePresentationContext = {
	hero: { eyebrow: string; headline: string; body: string };
	featuredCopy: { eyebrow: string; title: string; browseAllLabel: string };
	catalogCopy: { eyebrow: string; title: string };
};

export type KibblePlpPresentationDecision = {
	headerCopyVariantId: keyof typeof PLP_HEADER_VARIANTS;
	marketingBlockVariantId: keyof typeof KIBBLE_MARKETING_BLOCKS;
};

export type KibblePdpPresentationDecision = {
	relatedCopyVariantId: keyof typeof PDP_RELATED_COPY_VARIANTS;
	marketingBlockVariantId: keyof typeof KIBBLE_MARKETING_BLOCKS;
};

export type KibbleSearchPresentationDecision = { emptyCopyVariantId: keyof typeof SEARCH_EMPTY_COPY_VARIANTS };
export type KibbleCartPresentationDecision = { emptyCopyVariantId: keyof typeof CART_EMPTY_COPY_VARIANTS };
export type KibbleCheckoutPresentationDecision = { assuranceCopyVariantId: keyof typeof CHECKOUT_ASSURANCE_VARIANTS };

export type KibblePresentationSnapshot = {
	copy: Array<{ id: string; label: string; value: string }>;
	components: Array<{ id: string; label: string; value: string }>;
	sections: Array<{ id: string; label: string; value: string }>;
	marketingBlocks: Array<{ id: string; label: string; value: string }>;
};

export const KIBBLE_HOME_DEFAULT_PRESENTATION: KibbleHomePresentationDecision = {
	heroCopyVariantId: 'merchant-baseline',
	featuredCopyVariantId: 'merchant-baseline',
	catalogCopyVariantId: 'merchant-baseline',
	catalogComponentVariantId: 'four-column',
	sectionOrderId: 'featured-then-catalog',
};

export const KIBBLE_PLP_DEFAULT_PRESENTATION: KibblePlpPresentationDecision = {
	headerCopyVariantId: 'merchant-baseline',
	marketingBlockVariantId: 'none',
};

export const KIBBLE_PDP_DEFAULT_PRESENTATION: KibblePdpPresentationDecision = {
	relatedCopyVariantId: 'merchant-baseline',
	marketingBlockVariantId: 'none',
};

export const KIBBLE_SEARCH_DEFAULT_PRESENTATION: KibbleSearchPresentationDecision = { emptyCopyVariantId: 'merchant-baseline' };
export const KIBBLE_CART_DEFAULT_PRESENTATION: KibbleCartPresentationDecision = { emptyCopyVariantId: 'merchant-baseline' };
export const KIBBLE_CHECKOUT_DEFAULT_PRESENTATION: KibbleCheckoutPresentationDecision = { assuranceCopyVariantId: 'merchant-baseline' };

export function materializeKibbleHomePresentation(decision: KibbleHomePresentationDecision, context?: KibbleHomePresentationContext) {
	return {
		decision,
		hero: decision.heroCopyVariantId === 'merchant-baseline' && context ? context.hero : HOME_HERO_VARIANTS[decision.heroCopyVariantId],
		featuredCopy: decision.featuredCopyVariantId === 'merchant-baseline' && context ? context.featuredCopy : HOME_FEATURED_VARIANTS[decision.featuredCopyVariantId],
		catalogCopy: decision.catalogCopyVariantId === 'merchant-baseline' && context ? context.catalogCopy : HOME_CATALOG_VARIANTS[decision.catalogCopyVariantId],
		catalogComponent: HOME_CATALOG_COMPONENTS[decision.catalogComponentVariantId],
		sectionOrder: HOME_SECTION_ORDERS[decision.sectionOrderId],
	};
}

export function materializeKibblePlpPresentation(
	decision: KibblePlpPresentationDecision,
	context: { title: string; productCount: number; productSingular: string; productPlural: string },
) {
	const variant = PLP_HEADER_VARIANTS[decision.headerCopyVariantId];
	const countLabel = `${context.productCount} ${context.productCount === 1 ? context.productSingular : context.productPlural}`;
	return {
		decision,
		header: {
			eyebrow: variant.eyebrow,
			title: `${variant.headlinePrefix}${context.title}`,
			body: `${countLabel}${variant.bodySuffix}`,
		},
		marketingBlock: KIBBLE_MARKETING_BLOCKS[decision.marketingBlockVariantId],
	};
}

export function materializeKibblePdpPresentation(decision: KibblePdpPresentationDecision) {
	return {
		decision,
		relatedHeading: PDP_RELATED_COPY_VARIANTS[decision.relatedCopyVariantId],
		marketingBlock: KIBBLE_MARKETING_BLOCKS[decision.marketingBlockVariantId],
	};
}

export function materializeKibbleSearchPresentation(decision: KibbleSearchPresentationDecision, query: string) {
	const selected = SEARCH_EMPTY_COPY_VARIANTS[decision.emptyCopyVariantId];
	return {
		decision,
		copy: decision.emptyCopyVariantId === 'merchant-baseline' && query
			? { eyebrow: 'No matches', headline: `No products match “${query}”`, body: 'Try a different keyword, or browse all categories.' }
			: selected,
	};
}

export function materializeKibbleCartPresentation(decision: KibbleCartPresentationDecision) {
	return { decision, copy: CART_EMPTY_COPY_VARIANTS[decision.emptyCopyVariantId] };
}

export function materializeKibbleCheckoutPresentation(decision: KibbleCheckoutPresentationDecision) {
	return { decision, assurance: CHECKOUT_ASSURANCE_VARIANTS[decision.assuranceCopyVariantId] };
}

export function snapshotKibbleHomePresentation(
	presentation: ReturnType<typeof materializeKibbleHomePresentation>,
): KibblePresentationSnapshot {
	return {
		copy: [
			{ id: 'home.hero', label: 'Hero copy', value: joinCopy(presentation.hero.eyebrow, presentation.hero.headline, presentation.hero.body) },
			{ id: 'home.featured-row.1', label: 'Featured shelf copy', value: joinCopy(presentation.featuredCopy.eyebrow, presentation.featuredCopy.title, presentation.featuredCopy.browseAllLabel) },
			{ id: 'home.editorial-strip', label: 'Category module copy', value: joinCopy(presentation.catalogCopy.eyebrow, presentation.catalogCopy.title) },
		],
		components: [{ id: 'home.editorial-strip', label: 'Category module', value: presentation.catalogComponent.label }],
		sections: [{ id: 'home.featured-row.1', label: 'Home section order', value: presentation.sectionOrder.label }],
		marketingBlocks: [],
	};
}

export function snapshotKibblePlpPresentation(
	presentation: ReturnType<typeof materializeKibblePlpPresentation>,
): KibblePresentationSnapshot {
	return {
		copy: [{ id: 'plp.editorial-header', label: 'Category header copy', value: joinCopy(presentation.header.eyebrow, presentation.header.title, presentation.header.body) }],
		components: [],
		sections: [],
		marketingBlocks: [{ id: 'plp.marketing-block', label: 'Marketing block', value: presentation.marketingBlock?.headline ?? 'Not shown' }],
	};
}

export function snapshotKibblePdpPresentation(
	presentation: ReturnType<typeof materializeKibblePdpPresentation>,
): KibblePresentationSnapshot {
	return {
		copy: [{ id: 'pdp.related', label: 'Related-products heading', value: presentation.relatedHeading }],
		components: [],
		sections: [],
		marketingBlocks: [{ id: 'pdp.below-description', label: 'Marketing block', value: presentation.marketingBlock?.headline ?? 'Not shown' }],
	};
}

export function snapshotKibbleSearchPresentation(presentation: ReturnType<typeof materializeKibbleSearchPresentation>): KibblePresentationSnapshot {
	return { copy: [{ id: 'search.empty-state', label: 'Search recovery copy', value: joinCopy(presentation.copy.eyebrow, presentation.copy.headline, presentation.copy.body) }], components: [], sections: [], marketingBlocks: [] };
}

export function snapshotKibbleCartPresentation(presentation: ReturnType<typeof materializeKibbleCartPresentation>): KibblePresentationSnapshot {
	return { copy: [{ id: 'cart.empty-state', label: 'Cart recovery copy', value: joinCopy(presentation.copy.eyebrow, presentation.copy.headline, presentation.copy.body) }], components: [], sections: [], marketingBlocks: [] };
}

export function snapshotKibbleCheckoutPresentation(presentation: ReturnType<typeof materializeKibbleCheckoutPresentation>): KibblePresentationSnapshot {
	return { copy: [{ id: 'checkout.assurance-strip', label: 'Checkout assurance copy', value: presentation.assurance.callouts.map(({ label, body }) => `${label}: ${body}`).join(' / ') }], components: [], sections: [], marketingBlocks: [] };
}

export function parseKibbleHomePresentationDecision(value: unknown): KibbleHomePresentationDecision | null {
	if (!hasExactKeys(value, ['heroCopyVariantId', 'featuredCopyVariantId', 'catalogCopyVariantId', 'catalogComponentVariantId', 'sectionOrderId'])) return null;
	return hasOwn(HOME_HERO_VARIANTS, value.heroCopyVariantId)
		&& hasOwn(HOME_FEATURED_VARIANTS, value.featuredCopyVariantId)
		&& hasOwn(HOME_CATALOG_VARIANTS, value.catalogCopyVariantId)
		&& hasOwn(HOME_CATALOG_COMPONENTS, value.catalogComponentVariantId)
		&& hasOwn(HOME_SECTION_ORDERS, value.sectionOrderId)
		? value as KibbleHomePresentationDecision : null;
}

export function parseKibblePlpPresentationDecision(value: unknown): KibblePlpPresentationDecision | null {
	if (!hasExactKeys(value, ['headerCopyVariantId', 'marketingBlockVariantId'])) return null;
	return hasOwn(PLP_HEADER_VARIANTS, value.headerCopyVariantId) && hasOwn(KIBBLE_MARKETING_BLOCKS, value.marketingBlockVariantId)
		? value as KibblePlpPresentationDecision : null;
}

export function parseKibblePdpPresentationDecision(value: unknown): KibblePdpPresentationDecision | null {
	if (!hasExactKeys(value, ['relatedCopyVariantId', 'marketingBlockVariantId'])) return null;
	return hasOwn(PDP_RELATED_COPY_VARIANTS, value.relatedCopyVariantId) && hasOwn(KIBBLE_MARKETING_BLOCKS, value.marketingBlockVariantId)
		? value as KibblePdpPresentationDecision : null;
}

export function parseKibbleSearchPresentationDecision(value: unknown): KibbleSearchPresentationDecision | null {
	return hasExactKeys(value, ['emptyCopyVariantId']) && hasOwn(SEARCH_EMPTY_COPY_VARIANTS, value.emptyCopyVariantId) ? value as KibbleSearchPresentationDecision : null;
}

export function parseKibbleCartPresentationDecision(value: unknown): KibbleCartPresentationDecision | null {
	return hasExactKeys(value, ['emptyCopyVariantId']) && hasOwn(CART_EMPTY_COPY_VARIANTS, value.emptyCopyVariantId) ? value as KibbleCartPresentationDecision : null;
}

export function parseKibbleCheckoutPresentationDecision(value: unknown): KibbleCheckoutPresentationDecision | null {
	return hasExactKeys(value, ['assuranceCopyVariantId']) && hasOwn(CHECKOUT_ASSURANCE_VARIANTS, value.assuranceCopyVariantId) ? value as KibbleCheckoutPresentationDecision : null;
}


export function kibbleHomePresentationPromptOptions(context?: KibbleHomePresentationContext): string[] {
	const heroVariants = context ? { ...HOME_HERO_VARIANTS, 'merchant-baseline': context.hero } : HOME_HERO_VARIANTS;
	const featuredVariants = context ? { ...HOME_FEATURED_VARIANTS, 'merchant-baseline': context.featuredCopy } : HOME_FEATURED_VARIANTS;
	const catalogVariants = context ? { ...HOME_CATALOG_VARIANTS, 'merchant-baseline': context.catalogCopy } : HOME_CATALOG_VARIANTS;
	return [
		`heroCopyVariantId: ${describeCopyOptions(heroVariants)}`,
		`featuredCopyVariantId: ${describeCopyOptions(featuredVariants)}`,
		`catalogCopyVariantId: ${describeCopyOptions(catalogVariants)}`,
		`catalogComponentVariantId: ${Object.keys(HOME_CATALOG_COMPONENTS).join(' | ')}`,
		`sectionOrderId: ${Object.keys(HOME_SECTION_ORDERS).join(' | ')}`,
	];
}

export function kibblePlpPresentationPromptOptions(): string[] {
	return [
		`headerCopyVariantId: ${describeCopyOptions(PLP_HEADER_VARIANTS)}`,
		`marketingBlockVariantId: ${describeMarketingOptions()}`,
	];
}

export function kibblePdpPresentationPromptOptions(): string[] {
	return [
		`relatedCopyVariantId: ${Object.entries(PDP_RELATED_COPY_VARIANTS).map(([id, copy]) => id + '=' + copy).join(' | ')}`,
		`marketingBlockVariantId: ${describeMarketingOptions()}`,
	];
}

export function kibbleSearchPresentationPromptOptions(): string[] {
	return [`emptyCopyVariantId: ${describeCopyOptions(SEARCH_EMPTY_COPY_VARIANTS)}`];
}

export function kibbleCartPresentationPromptOptions(): string[] {
	return [`emptyCopyVariantId: ${describeCopyOptions(CART_EMPTY_COPY_VARIANTS)}`];
}

export function kibbleCheckoutPresentationPromptOptions(): string[] {
	return [`assuranceCopyVariantId: ${Object.entries(CHECKOUT_ASSURANCE_VARIANTS).map(([id, value]) => `${id}=${value.callouts.map(({ label }) => label).join(' / ')}`).join(' | ')}`];
}

export const KIBBLE_HOME_PRESENTATION_IDS = {
	heroCopyVariantIds: Object.keys(HOME_HERO_VARIANTS) as Array<keyof typeof HOME_HERO_VARIANTS>,
	featuredCopyVariantIds: Object.keys(HOME_FEATURED_VARIANTS) as Array<keyof typeof HOME_FEATURED_VARIANTS>,
	catalogCopyVariantIds: Object.keys(HOME_CATALOG_VARIANTS) as Array<keyof typeof HOME_CATALOG_VARIANTS>,
	catalogComponentVariantIds: Object.keys(HOME_CATALOG_COMPONENTS) as Array<keyof typeof HOME_CATALOG_COMPONENTS>,
	sectionOrderIds: Object.keys(HOME_SECTION_ORDERS) as Array<keyof typeof HOME_SECTION_ORDERS>,
} as const;

export const KIBBLE_PLP_PRESENTATION_IDS = {
	headerCopyVariantIds: Object.keys(PLP_HEADER_VARIANTS) as Array<keyof typeof PLP_HEADER_VARIANTS>,
	marketingBlockVariantIds: Object.keys(KIBBLE_MARKETING_BLOCKS) as Array<keyof typeof KIBBLE_MARKETING_BLOCKS>,
} as const;

export const KIBBLE_PDP_PRESENTATION_IDS = {
	relatedCopyVariantIds: Object.keys(PDP_RELATED_COPY_VARIANTS) as Array<keyof typeof PDP_RELATED_COPY_VARIANTS>,
	marketingBlockVariantIds: Object.keys(KIBBLE_MARKETING_BLOCKS) as Array<keyof typeof KIBBLE_MARKETING_BLOCKS>,
} as const;

export const KIBBLE_SEARCH_PRESENTATION_IDS = { emptyCopyVariantIds: Object.keys(SEARCH_EMPTY_COPY_VARIANTS) as Array<keyof typeof SEARCH_EMPTY_COPY_VARIANTS> } as const;
export const KIBBLE_CART_PRESENTATION_IDS = { emptyCopyVariantIds: Object.keys(CART_EMPTY_COPY_VARIANTS) as Array<keyof typeof CART_EMPTY_COPY_VARIANTS> } as const;
export const KIBBLE_CHECKOUT_PRESENTATION_IDS = { assuranceCopyVariantIds: Object.keys(CHECKOUT_ASSURANCE_VARIANTS) as Array<keyof typeof CHECKOUT_ASSURANCE_VARIANTS> } as const;

function hasExactKeys(value: unknown, keys: readonly string[]): value is Record<string, string> {
	return !!value && typeof value === 'object' && !Array.isArray(value)
		&& Object.keys(value).length === keys.length
		&& keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function hasOwn<T extends object>(record: T, value: unknown): value is keyof T {
	return typeof value === 'string' && Object.prototype.hasOwnProperty.call(record, value);
}

function joinCopy(...values: string[]): string { return values.join(' / '); }
function describeCopyOptions(record: Record<string, Record<string, string>>): string {
	return Object.entries(record).map(([id, copy]) => id + '=' + Object.values(copy).join(' / ')).join(' | ');
}
function describeMarketingOptions(): string {
	return Object.entries(KIBBLE_MARKETING_BLOCKS).map(([id, block]) => id + '=' + (block?.headline ?? 'not shown')).join(' | ');
}
