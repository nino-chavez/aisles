import { describe, expect, it } from 'vitest';
import {
	KIBBLE_ALTERNATIVE_GROUPS,
	KIBBLE_CAPABILITY_MANIFEST_ALIGNMENT,
	KIBBLE_CATALOG_DERIVED_ALTERNATIVE_EDGES,
	KIBBLE_CATEGORY_SHOPPER_JOBS,
	KIBBLE_CATEGORY_SIGNAL_GUARD,
	KIBBLE_DERIVED_COMPLEMENT_EDGES,
	KIBBLE_MERCHANT_AUTHORED_ROUTINE_EDGES,
	KIBBLE_MERCHANDISING_EDGES,
	KIBBLE_MERCHANDISING_GRAPH_SOURCES,
	KIBBLE_MERCHANDISING_PRODUCTS,
	KIBBLE_PINNED_OFFER_WITHOUT_PROVIDER_PLAN_IDS,
	KIBBLE_PRODUCT_COVERAGE_DECISION,
	KIBBLE_PROVIDER_MONTHLY_PLAN_PRODUCT_IDS,
	KIBBLE_ROUTINE_SETS,
	KIBBLE_SUBSCRIPTION_SCENARIOS,
	assertKibbleMerchandisingGraph,
	getKibbleCatalogPurchaseEvidence,
	getKibbleCategorySiblingFallbackCandidates,
	getKibbleMerchandisingCandidates,
	getKibbleMerchandisingProduct,
	getKibbleProductsForShopperJob,
	getKibbleSubscriptionScenario,
	kibbleMerchandisingGraphCoverage,
	type KibbleEmbeddedRoutineMember,
	type KibbleProductId,
} from './kibble-merchandising-graph';
import {
	KIBBLE_CATALOG_ENTITY_IDS,
	KIBBLE_CANONICAL_STOREFRONT_REGISTRY_ENTITY_IDS,
	getKibbleCatalogCapabilities,
} from './kibble-catalog-enrichment';

const EXPECTED_SOURCE_MAPPINGS = [
	[3023, 'openfarm-goodgut-grass-fed-beef-dog-kibble', 325],
	[3024, 'openfarm-goodgut-harvest-chicken-dog-kibble', 325],
	[3025, 'openfarm-goodgut-wild-caught-salmon-dog-kibble', 325],
	[3026, 'openfarm-rawmix-great-plains-ancient-grains-dog-kibble', 325],
	[3027, 'openfarm-epic-blend-salmon-superfood-grain-free-dog-kibble', 325],
	[3028, 'openfarm-air-dried-chicken-dog-food', 325],
	[3029, 'openfarm-harvest-chicken-hearty-stew-wet-dog-food', 325],
	[3030, 'openfarm-rustic-stew-variety-pack-for-dogs', 325],
	[3031, 'openfarm-goodbowl-variety-pack-for-dogs', 325],
	[3032, 'openfarm-salmon-cod-topper-for-dogs', 325],
	[3033, 'nativepet-power-poop', 326],
	[3034, 'nativepet-hip-joint-mobility-care-chews', 326],
	[3035, 'nativepet-advanced-calm-chews', 326],
	[3036, 'nativepet-sockeye-salmon-oil', 326],
	[3037, 'nativepet-probiotics', 326],
	[3038, 'finn-multivitamin', 326],
	[3039, 'finn-hip-and-joint', 326],
	[3040, 'finn-calming-aid', 326],
	[3041, 'finn-digestive-probiotics', 326],
	[3042, 'finn-plaque-patrol-dental-chews-large', 327],
	[3043, 'finn-bone-broth-plus', 327],
	[3044, 'wildone-organic-baked-dog-treats', 327],
	[3045, 'nativepet-yak-chews', 327],
	[3046, 'finn-fur-hero', 328],
	[3047, 'maxbone-smellin-good-body-and-coat-spray', 328],
	[3048, 'finn-paw-hero', 328],
	[3049, 'wildone-tennis-tumble-dog-puzzle-toy', 329],
	[3050, 'wildone-dog-toy-set', 329],
	[3051, 'maxbone-maxbone-tether-toy', 329],
	[3052, 'wildone-bolt-bite-chew-toy', 329],
	[3053, 'wildone-cushioned-dog-harness', 330],
	[3054, 'wildone-waterproof-dog-leash', 330],
	[3055, 'wildone-quick-release-dog-collar', 330],
	[3056, 'wildone-travel-bowl-duo', 330],
	[3057, 'maxbone-go-everywhere-pet-backpack', 330],
	[3058, 'wildone-pet-travel-carrier', 330],
	[3059, 'maxbone-davos-bed', 331],
	[3060, 'maxbone-unwind-lounger-chill-grey', 331],
	[3061, 'maxbone-easy-fit-jacket', 331],
	[3062, 'maxbone-puffer-jacket', 331],
	[3063, 'wildone-dog-bowl-and-placemat-kit', 331],
	[3064, 'puppy-starter-kit', 332],
	[3065, 'essential-bundle', 332],
	[3066, 'advanced-bundle', 332],
	[3067, 'starter-bundle', 332],
	[3068, 'senior-pet-growth-bundle', 332],
	[3069, 'treat-snack-power-set', 332],
	[3070, 'gift-bundle', 332],
	[3071, 'surf-turf-limited-reserve', 332],
] as const;

describe('Kibble merchant merchandising graph', () => {
	it('registers every exact source product once', () => {
		expect(KIBBLE_MERCHANDISING_PRODUCTS).toHaveLength(49);
		expect(new Set(KIBBLE_MERCHANDISING_PRODUCTS.map(({ entityId }) => entityId)).size).toBe(49);
		expect([...KIBBLE_MERCHANDISING_PRODUCTS.map(({ entityId }) => entityId)].sort((a, b) => a - b))
			.toEqual([...KIBBLE_CATALOG_ENTITY_IDS].sort((a, b) => a - b));
		expect(KIBBLE_MERCHANDISING_PRODUCTS.map(({ entityId, sourceKey, sourceCategoryId }) => [entityId, sourceKey, sourceCategoryId]))
			.toEqual(EXPECTED_SOURCE_MAPPINGS);
		expect(new Set(KIBBLE_MERCHANDISING_PRODUCTS.map(({ sku }) => sku)).size).toBe(49);
		expect(() => assertKibbleMerchandisingGraph()).not.toThrow();
	});

	it('keeps product roles, need states, comparison dimensions, and shopper jobs category-specific', () => {
		expect(KIBBLE_CATEGORY_SHOPPER_JOBS).toHaveLength(35);
		for (const product of KIBBLE_MERCHANDISING_PRODUCTS) {
			expect(product.role).toBeTruthy();
			expect(product.needStates.length).toBeGreaterThan(0);
			expect(product.comparisonDimensions.length).toBeGreaterThan(0);
			expect(product.shopperJobIds.length).toBeGreaterThan(0);
		}
		for (const job of KIBBLE_CATEGORY_SHOPPER_JOBS) {
			const candidates = getKibbleProductsForShopperJob(job.id);
			expect(candidates.length, job.id).toBeGreaterThan(0);
			expect(candidates.every(({ shopperJobIds }) => shopperJobIds.includes(job.id))).toBe(true);
		}
		expect(getKibbleProductsForShopperJob('supplements.mobility-routine').map(({ entityId }) => entityId)).toEqual([3034, 3039]);
		expect(getKibbleProductsForShopperJob('bundles.puppy-start').map(({ entityId }) => entityId)).toEqual([3064]);
		expect(KIBBLE_CATEGORY_SIGNAL_GUARD.finding).toContain('Three of ten');
		expect(KIBBLE_CATEGORY_SIGNAL_GUARD.application).toContain('category');
		expect(KIBBLE_CATEGORY_SIGNAL_GUARD.merchantOutcomeProof).toBe('not-measured');
	});

	it('models all eight merchant-authored routines without inventing missing catalog products', () => {
		expect(KIBBLE_ROUTINE_SETS).toHaveLength(8);
		expect(KIBBLE_ROUTINE_SETS.map(({ bundleProductId }) => bundleProductId).sort((a, b) => a - b)).toEqual([3064, 3065, 3066, 3067, 3068, 3069, 3070, 3071]);
		expect(KIBBLE_ROUTINE_SETS.filter(({ subscribable }) => subscribable).map(({ bundleProductId }) => bundleProductId).sort((a, b) => a - b)).toEqual([3064, 3065, 3066, 3067, 3068, 3069]);
		const embedded = KIBBLE_ROUTINE_SETS.flatMap(({ members }) => members)
			.filter((member): member is KibbleEmbeddedRoutineMember => member.kind === 'embedded-bundle-component');
		expect(embedded).toHaveLength(3);
		expect(embedded.map(({ name }) => name)).toEqual([
			'Chicken & Salmon Freeze Dried Raw Morsels for Puppies',
			'Senior Daily',
			'Surf & Turf Air Dried Recipe for Dogs',
		]);
		for (const member of embedded) {
			expect(member.catalogProductId).toBeNull();
			expect(member.boundary).toContain('do not invent a SKU');
		}
	});

	it('makes edge authority and provenance explicit', () => {
		expect(KIBBLE_MERCHANT_AUTHORED_ROUTINE_EDGES).toHaveLength(27);
		expect(KIBBLE_DERIVED_COMPLEMENT_EDGES).toHaveLength(34);
		expect(KIBBLE_ALTERNATIVE_GROUPS).toHaveLength(8);
		expect(KIBBLE_CATALOG_DERIVED_ALTERNATIVE_EDGES).toHaveLength(14);
		expect(KIBBLE_MERCHANDISING_EDGES).toHaveLength(75);
		expect(KIBBLE_MERCHANT_AUTHORED_ROUTINE_EDGES.every(({ authority, kind }) => authority === 'merchant-authored' && kind === 'routine-member')).toBe(true);
		expect(KIBBLE_DERIVED_COMPLEMENT_EDGES.every(({ authority }) => authority === 'derived-from-merchant-authored-routine')).toBe(true);
		expect(KIBBLE_CATALOG_DERIVED_ALTERNATIVE_EDGES.every(({ authority }) => authority === 'merchant-catalog-derived')).toBe(true);
		for (const edge of KIBBLE_MERCHANDISING_EDGES) {
			expect(edge.provenance.sourcePath).toBeTruthy();
			expect(edge.provenance.sourceSha256).toMatch(/^[0-9a-f]{64}$/);
			expect(edge.provenance.sourceLocator).toBeTruthy();
			expect(edge.provenance.interpretation).toBeTruthy();
		}
	});

	it('returns graph candidates without relabeling category siblings as merchant relations', () => {
		const graphCandidates = getKibbleMerchandisingCandidates(3023);
		expect(graphCandidates.map(({ product }) => product.entityId)).toEqual(expect.arrayContaining([3024, 3025, 3030, 3042, 3043, 3045, 3051, 3065, 3070]));
		expect(graphCandidates.every(({ candidateSource }) => candidateSource === 'merchant_merchandising_graph')).toBe(true);

		const fallback = getKibbleCategorySiblingFallbackCandidates(3049);
		expect(fallback.map(({ product }) => product.entityId)).toEqual([3050, 3051, 3052]);
		for (const candidate of fallback) {
			expect(candidate.candidateSource).toBe('category_sibling');
			expect(candidate.relationAuthority).toBe('fallback-only');
			expect(candidate.relationKind).toBeNull();
			expect(candidate.disclosure).toContain('no merchant-authored');
		}
		expect(KIBBLE_MERCHANDISING_EDGES.some((edge) => 'candidateSource' in edge)).toBe(false);
	});

	it('separates 34 offer rows from 32 provider-plan-backed products', () => {
		const pinnedOfferIds = KIBBLE_MERCHANDISING_PRODUCTS
			.filter(({ entityId }) => getKibbleCatalogCapabilities(entityId)?.subscription)
			.map(({ entityId }) => entityId);
		expect(pinnedOfferIds).toHaveLength(34);
		expect(KIBBLE_PROVIDER_MONTHLY_PLAN_PRODUCT_IDS).toHaveLength(32);
		expect(KIBBLE_PINNED_OFFER_WITHOUT_PROVIDER_PLAN_IDS).toEqual([3070, 3071]);
		expect(pinnedOfferIds).toEqual(expect.arrayContaining([3070, 3071]));

		const providerPlans = KIBBLE_MERCHANDISING_PRODUCTS.flatMap(({ subscription }) => subscription.providerPlans);
		expect(providerPlans).toHaveLength(97);
		expect(getKibbleCatalogPurchaseEvidence(3023)?.providerPlans.map(({ planId }) => planId)).toEqual([
			'plan_kibble_openfarm-goodgut-grass-fed-beef-dog-kibble_1mo',
			'plan_kibble_openfarm-goodgut-grass-fed-beef-dog-kibble_2mo',
			'plan_kibble_openfarm-goodgut-grass-fed-beef-dog-kibble_3mo',
		]);
		expect(getKibbleCatalogPurchaseEvidence(3038)?.providerPlans.map(({ planId }) => planId)).toContain('plan_kibble_finn-multivitamin_annual');
		expect(getKibbleCatalogPurchaseEvidence(3070)).toBeNull();
		expect(getKibbleCatalogPurchaseEvidence(3071)).toBeNull();
		expect(getKibbleMerchandisingProduct(3070)?.subscription.contradiction).toContain('provider seed deletes');
	});

	it('keeps portal-only capability references out of PDP and catalog purchase evidence', () => {
		expect(KIBBLE_SUBSCRIPTION_SCENARIOS).toHaveLength(7);
		expect(KIBBLE_SUBSCRIPTION_SCENARIOS.filter(({ surface }) => surface === 'storefront')).toHaveLength(4);
		expect(KIBBLE_SUBSCRIPTION_SCENARIOS.filter(({ surface }) => surface === 'portal')).toHaveLength(3);
		for (const scenario of KIBBLE_SUBSCRIPTION_SCENARIOS) {
			expect(scenario.candidates.length, scenario.id).toBeGreaterThan(0);
			if (scenario.surface === 'portal') {
				expect(scenario.candidates.every(({ catalogPurchaseAllowed }) => !catalogPurchaseAllowed), scenario.id).toBe(true);
			}
		}
		expect(getKibbleSubscriptionScenario('subscribe-and-save')?.candidates).toHaveLength(32);
		expect(getKibbleSubscriptionScenario('free-trial')?.candidates.map(({ productId }) => productId)).toEqual([3035]);
		expect(getKibbleSubscriptionScenario('intro-offer')?.candidates.map(({ productId }) => productId)).toEqual([3023]);
		expect(getKibbleSubscriptionScenario('annual')?.candidates.map(({ productId }) => productId)).toEqual([3038]);
		expect(getKibbleSubscriptionScenario('prepaid')?.candidates).toEqual([
			expect.objectContaining({ productId: 3066, providerPlanIds: ['plan_kibble_advanced-bundle_3mo'], catalogPurchaseAllowed: false }),
		]);
		expect(getKibbleSubscriptionScenario('gift')?.candidates).toEqual([
			expect.objectContaining({ productId: 3035, providerPlanIds: ['plan_kibble_nativepet-advanced-calm-chews_1mo'], catalogPurchaseAllowed: false }),
		]);
		expect(getKibbleSubscriptionScenario('build-a-box')?.candidates.map(({ productId }) => productId)).toEqual([3023, 3024, 3025, 3026, 3027, 3028]);

		expect(getKibbleCatalogPurchaseEvidence(3035)?.capabilityIds).toEqual(['subscribe-and-save', 'free-trial']);
		expect(getKibbleCatalogPurchaseEvidence(3066)?.capabilityIds).toEqual(['subscribe-and-save']);
		for (const productId of KIBBLE_CATALOG_ENTITY_IDS) {
			const capabilities = getKibbleCatalogPurchaseEvidence(productId)?.capabilityIds ?? [];
			expect(capabilities).not.toContain('prepaid');
			expect(capabilities).not.toContain('gift');
			expect(capabilities).not.toContain('build-a-box');
		}
	});

	it('keeps presentation authority and not-claimed source models outside product semantics', () => {
		expect(KIBBLE_CAPABILITY_MANIFEST_ALIGNMENT.presentationCapabilityIds).toEqual([
			'select_products', 'rank_products', 'select_copy_variant', 'select_component_variant', 'toggle_zone', 'reorder_zones',
		]);
		expect(KIBBLE_CAPABILITY_MANIFEST_ALIGNMENT.sourceCapabilitiesOutsideKibble).toEqual([
			'bundle', 'membership', 'usage-based', 'curation', 'allotment', 'multi-actor', 'calendar-anchored',
		]);
		expect(KIBBLE_CAPABILITY_MANIFEST_ALIGNMENT.boundary).toContain('may not create product roles');
	});

	it('matches the canonical registry and reports the full coverage receipt', () => {
		expect(KIBBLE_MERCHANDISING_PRODUCTS.filter(({ canonicalRegistryListed }) => canonicalRegistryListed).map(({ entityId }) => entityId))
			.toEqual(KIBBLE_CANONICAL_STOREFRONT_REGISTRY_ENTITY_IDS);
		expect(kibbleMerchandisingGraphCoverage()).toEqual({
			products: 49,
			categories: 8,
			shopperJobs: 35,
			routineSets: 8,
			routineMembershipEdges: 27,
			complementEdges: 34,
			alternativeEdges: 14,
			embeddedRoutineComponents: 3,
			pinnedOfferRows: 34,
			providerPlanBackedProducts: 32,
			conflictedPinnedOfferRows: 2,
			canonicalRegistryProducts: 10,
			subscriptionScenarios: 7,
			storefrontSubscriptionScenarios: 4,
			portalSubscriptionScenarios: 3,
			aislesPresentationCapabilities: 6,
			sourceCapabilitiesOutsideKibble: 7,
		});
	});

	it('requires source evidence before adding any raw product', () => {
		expect(KIBBLE_PRODUCT_COVERAGE_DECISION.additionalProductsNeededNow).toBe(false);
		expect(KIBBLE_PRODUCT_COVERAGE_DECISION.reason).toContain('35 intended shopper jobs');
		expect(KIBBLE_PRODUCT_COVERAGE_DECISION.conditionalEvidenceForANewProduct).toEqual([
			expect.stringContaining('dedicated Build Your Box product'),
			expect.stringContaining('no matching product ID'),
		]);
		expect(KIBBLE_PRODUCT_COVERAGE_DECISION.falsifiers).toHaveLength(4);
	});

	it('pins every source used by the graph', () => {
		for (const source of Object.values(KIBBLE_MERCHANDISING_GRAPH_SOURCES)) {
			expect(source.path).toBeTruthy();
			expect(source.sha256).toMatch(/^[0-9a-f]{64}$/);
			expect(source.use).toBeTruthy();
		}
	});

	it('returns null for unknown products and capabilities', () => {
		expect(getKibbleMerchandisingProduct(999999)).toBeNull();
		expect(getKibbleCatalogPurchaseEvidence(999999)).toBeNull();
		expect(getKibbleSubscriptionScenario('gift')).not.toBeNull();
		expect(getKibbleCategorySiblingFallbackCandidates(999999 as KibbleProductId)).toEqual([]);
	});
});
