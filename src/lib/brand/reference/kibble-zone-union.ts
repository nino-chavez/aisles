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
