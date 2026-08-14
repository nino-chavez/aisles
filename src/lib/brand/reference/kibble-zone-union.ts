/**
 * Canonical cross-storefront zone union used by the Kibble Preserve gate.
 *
 * Snapshot source: bealls-aisles/src/lib/foundation/zones.ts
 * Source commit: 71e8750f9070fb788816f0464355f46ab63fb272
 * Source SHA-256: 60de21cd5643ddd18b7f73f3bc94942099a94bcf056b3d56005207a969ee106a
 *
 * Keep this independent of either runtime catalog. The contract parser compares
 * exact ordered values so a renamed, missing, or substituted zone fails closed.
 */
export const KIBBLE_CANONICAL_UNION_ZONE_IDS = [
	'home.hero',
	'home.featured-row',
	'home.editorial-strip',
	'home.brand-spotlight',
	'home.below-fold',
	'plp.banner',
	'plp.editorial-header',
	'plp.cluster-row',
	'plp.between-thirds',
	'plp.below-grid',
	'plp.empty-state',
	'pdp.below-description',
	'pdp.related',
	'pdp.cross-sell',
	'pdp.recently-viewed',
	'pdp.below-recs',
	'cart.above-checkout-cta',
	'cart.below-fold',
	'cart.empty-state',
	'checkout.assurance-strip',
	'checkout.last-chance-upsell',
	'search.empty-state',
	'search.zero-results-rescue',
	'account.welcome',
	'account.dashboard-pick',
	'locator.editorial-intro',
	'error-404.rescue',
	'error-empty.rescue',
] as const;

export type KibbleCanonicalUnionZoneId = typeof KIBBLE_CANONICAL_UNION_ZONE_IDS[number];

/**
 * Exact expanded Bealls snapshot identities. Indexed families stay distinct:
 * the six Home shelf positions and four account dashboard positions are not
 * collapsed back to their family labels.
 */
export const KIBBLE_CANONICAL_UNION_ZONE_INSTANCE_IDS = [
	'home.hero',
	'home.featured-row.1',
	'home.featured-row.2',
	'home.featured-row.3',
	'home.featured-row.4',
	'home.featured-row.5',
	'home.featured-row.6',
	'home.editorial-strip',
	'home.brand-spotlight',
	'home.below-fold',
	'plp.banner',
	'plp.editorial-header',
	'plp.cluster-row',
	'plp.between-thirds',
	'plp.below-grid',
	'plp.empty-state',
	'pdp.below-description',
	'pdp.related',
	'pdp.cross-sell',
	'pdp.recently-viewed',
	'pdp.below-recs',
	'cart.above-checkout-cta',
	'cart.below-fold',
	'cart.empty-state',
	'checkout.assurance-strip',
	'checkout.last-chance-upsell',
	'search.empty-state',
	'search.zero-results-rescue',
	'account.welcome',
	'account.dashboard-pick.1',
	'account.dashboard-pick.2',
	'account.dashboard-pick.3',
	'account.dashboard-pick.4',
	'locator.editorial-intro',
	'error-404.rescue',
	'error-empty.rescue',
] as const;

export type KibbleCanonicalUnionZoneInstanceId = typeof KIBBLE_CANONICAL_UNION_ZONE_INSTANCE_IDS[number];

/** Local Aisles identities that can use the current typed policy compiler. */
export const KIBBLE_LOCAL_ZONE_INSTANCE_IDS = [
	'home.hero',
	'home.featured-row.1',
	'home.featured-row.2',
	'home.featured-row.3',
	'home.editorial-strip',
	'home.below-fold',
	'plp.editorial-header',
	'plp.cluster-row',
	'plp.below-grid',
	'pdp.below-description',
	'pdp.related',
	'pdp.cross-sell',
	'pdp.recently-viewed',
	'cart.above-checkout-cta',
	'cart.empty-state',
	'checkout.assurance-strip',
	'checkout.last-chance-upsell',
	'search.empty-state',
	'error-404.rescue',
	'error-empty.rescue',
] as const;

export type KibbleZoneTerminal = {
	instanceId: KibbleCanonicalUnionZoneInstanceId;
	familyId: string;
	origin: 'aisles' | 'bealls-aisles';
	surface: 'home' | 'plp' | 'pdp' | 'cart' | 'checkout' | 'search' | 'account' | 'locator' | 'error-404' | 'error-empty';
	terminal: 'kibble-native' | 'trusted-hidden';
	adapterId?: string;
	componentVariantId?: string;
};

const VISIBLE_ADAPTERS = {
	'home.hero': ['kibble.zone.home.hero', 'kibble.hero.zone-editorial-header'],
	'home.featured-row.1': ['kibble.zone.home.featured-row.primary', 'kibble.featured-grid.ranked-segment'],
	'home.featured-row.2': ['kibble.zone.home.featured-row.continuation-1', 'kibble.featured-grid.ranked-segment'],
	'home.featured-row.3': ['kibble.zone.home.featured-row.continuation-2', 'kibble.featured-grid.ranked-segment'],
	'home.editorial-strip': ['kibble.zone.home.editorial-strip', 'kibble.visual-module.editorial-strip'],
	'home.below-fold': ['kibble.zone.home.below-fold', 'kibble.service-proof.below-fold'],
	'plp.editorial-header': ['kibble.zone.plp.editorial-header', 'kibble.category-listing.editorial-header'],
	'pdp.related': ['kibble.zone.pdp.related', 'kibble.product-detail.related-products'],
	'search.empty-state': ['kibble.zone.search.empty-state', 'kibble.search.empty-state'],
	'cart.empty-state': ['kibble.zone.cart.empty-state', 'kibble.cart.reference-shell'],
	'checkout.assurance-strip': ['kibble.zone.checkout.assurance-strip', 'kibble.checkout.reference-shell'],
	'error-404.rescue': ['kibble.zone.error-404.rescue', 'kibble.error.rescue'],
	'error-empty.rescue': ['kibble.zone.error-empty.rescue', 'kibble.error.rescue'],
} as const satisfies Partial<Record<KibbleCanonicalUnionZoneInstanceId, readonly [string, string]>>;

const LOCAL_IDS = new Set<string>(KIBBLE_LOCAL_ZONE_INSTANCE_IDS);
const FAMILY_BY_INSTANCE = (instanceId: string): string =>
	instanceId.replace(/\.\d+$/, '');
const SURFACE_BY_FAMILY = (familyId: string): KibbleZoneTerminal['surface'] => {
	const prefix = familyId.split('.')[0];
	if (prefix === 'home' || prefix === 'plp' || prefix === 'pdp' || prefix === 'cart' || prefix === 'checkout' || prefix === 'search' || prefix === 'account') return prefix;
	if (prefix === 'locator') return 'locator';
	if (prefix === 'error-404') return 'error-404';
	if (prefix === 'error-empty') return 'error-empty';
	throw new Error(`Unknown Kibble zone surface for ${familyId}.`);
};

/**
 * One auditable terminal per exact union instance. External-origin schemas are
 * always trusted Hidden; a visible Kibble adapter exists only for a reviewed
 * local semantic correspondence and never changes the shared executor result.
 */
export const KIBBLE_ZONE_TERMINALS: readonly KibbleZoneTerminal[] = Object.freeze(
	KIBBLE_CANONICAL_UNION_ZONE_INSTANCE_IDS.map((instanceId) => {
		const familyId = FAMILY_BY_INSTANCE(instanceId);
		const adapter = VISIBLE_ADAPTERS[instanceId as keyof typeof VISIBLE_ADAPTERS];
		return Object.freeze({
			instanceId,
			familyId,
			origin: LOCAL_IDS.has(instanceId) ? 'aisles' as const : 'bealls-aisles' as const,
			surface: SURFACE_BY_FAMILY(familyId),
			terminal: adapter ? 'kibble-native' as const : 'trusted-hidden' as const,
			...(adapter ? { adapterId: adapter[0], componentVariantId: adapter[1] } : {}),
		});
	}),
);
