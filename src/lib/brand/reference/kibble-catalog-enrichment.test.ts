import { describe, expect, it } from 'vitest';
import {
	KIBBLE_CATALOG_ENTITY_IDS,
	KIBBLE_CATALOG_ENRICHMENT_SOURCE,
	KIBBLE_AISLES_CAPABILITY_DEMOS,
	KIBBLE_AISLES_PDP_PROOF,
	KIBBLE_FIXED_COMMERCE_FACTS,
	KIBBLE_CANONICAL_STOREFRONT_REGISTRY_ENTITY_IDS,
	KIBBLE_CATALOG_SOURCE_CATEGORY_IDS,
	KIBBLE_CATEGORY_JOB_PROFILES,
	KIBBLE_ONE_TIME_ONLY_ENTITY_IDS,
	KIBBLE_SOURCE_CAPABILITIES_OUTSIDE_KIBBLE,
	KIBBLE_SUBSCRIPTION_CAPABILITY_DEMOS,
	KIBBLE_SUBSCRIPTION_CAPABILITY_PRODUCT_IDS,
	KIBBLE_SUBSCRIPTION_CAPABILITY_SURFACES,
	buildKibbleMerchantCapabilityCoverage,
	getKibbleCatalogCapabilities,
	getKibbleCatalogCategorySlug,
	getKibbleCatalogCategorySlugFromName,
	getKibbleCatalogSignals,
	isKibblePinnedOfferPriceConsistent,
	kibbleCatalogCapabilityCount,
	kibbleCatalogCoverage,
	materializeKibbleSubscriptionOffers,
} from './kibble-catalog-enrichment';
import { KIBBLE_REFERENCE_CONTRACT } from './kibble';
import { KIBBLE_PRESERVE_MANIFEST } from './kibble-manifest';
import {
	KIBBLE_CART_PRESENTATION_POLICY,
	KIBBLE_CHECKOUT_PRESENTATION_POLICY,
	KIBBLE_HOME_PRESENTATION_POLICY,
	KIBBLE_PDP_PRESENTATION_POLICY,
	KIBBLE_PLP_PRESENTATION_POLICY,
	KIBBLE_SEARCH_PRESENTATION_POLICY,
} from './kibble-presentation-decisions';
import { KIBBLE_HOME_RULE_CAPABILITIES } from './kibble-home-decision';

describe('Kibble catalog capability projection', () => {
	it('accounts for every pinned BigCommerce catalog row', () => {
		expect(KIBBLE_CATALOG_ENTITY_IDS).toHaveLength(49);
		expect(kibbleCatalogCoverage()).toEqual({
			totalProducts: 49,
			pinnedOfferProducts: 34,
			withoutPinnedOfferProducts: 15,
			canonicalStorefrontRegistryProducts: 10,
			liveCapabilitiesInPinnedSnapshot: 7,
			sourceCapabilitiesOutsideKibble: 7,
		});
		expect(kibbleCatalogCapabilityCount()).toBe(34);
		expect(KIBBLE_ONE_TIME_ONLY_ENTITY_IDS).toEqual(Array.from({ length: 15 }, (_, index) => 3049 + index));
		expect(KIBBLE_CANONICAL_STOREFRONT_REGISTRY_ENTITY_IDS).toEqual([
			3023, 3024, 3025, 3026, 3027, 3028, 3029, 3035, 3038, 3039,
		]);
		expect(KIBBLE_REFERENCE_CONTRACT.merchantCapabilityManifest.sourceHashes).toEqual({
			eligibleProductsSha256: KIBBLE_CATALOG_ENRICHMENT_SOURCE.eligibleProductsSha256,
			canonicalRegistrySha256: KIBBLE_CATALOG_ENRICHMENT_SOURCE.capabilityRegistrySha256,
			marketingCapabilitiesSha256: KIBBLE_CATALOG_ENRICHMENT_SOURCE.marketingCapabilitiesSha256,
			demoStateSha256: KIBBLE_CATALOG_ENRICHMENT_SOURCE.demoStateSha256,
			seedOutputSha256: KIBBLE_CATALOG_ENRICHMENT_SOURCE.seedOutputSha256,
		});
	});

	it('keeps the capability matrix explicit about storefront versus portal ownership', () => {
		expect(KIBBLE_SUBSCRIPTION_CAPABILITY_PRODUCT_IDS).toEqual({
		'subscribe-and-save': 3023,
		'free-trial': 3035,
		'intro-offer': 3023,
		annual: 3038,
		prepaid: 3066,
		gift: 3035,
		'build-a-box': null,
	});
		expect(KIBBLE_SUBSCRIPTION_CAPABILITY_SURFACES).toMatchObject({
		'subscribe-and-save': 'storefront',
		'free-trial': 'storefront',
		'intro-offer': 'storefront',
		annual: 'storefront',
		prepaid: 'portal',
		gift: 'portal',
		'build-a-box': 'portal',
	});
	});

	it('materializes visible offer and capability labels only for eligible products', () => {
		const offers = materializeKibbleSubscriptionOffers([
			{ id: 'goodgut', entityId: 3023, price: 34.99 },
			{ id: 'calm-chews', entityId: 3035, price: 24.99 },
			{ id: 'harness', entityId: 3049, price: 48 },
		]);

		expect(offers.goodgut).toMatchObject({
			price: 29.74,
			savingsPercent: 15,
			label: 'Auto-Refill',
			capabilityLabels: ['Intro offer'],
			capabilityEvidence: [{ label: 'Intro offer', detail: expect.stringContaining('first-cycle offer') }],
		});
		expect(offers['calm-chews']).toMatchObject({
			capabilityLabels: ['Free trial'],
		});
		expect(offers['calm-chews'].capabilityLabels).not.toContain('Gift a subscription');
		expect(offers.harness).toBeUndefined();
		expect(getKibbleCatalogCapabilities(3049)).toBeNull();
		expect(materializeKibbleSubscriptionOffers([{ id: 'advanced-bundle', entityId: 3066, price: 129 }])['advanced-bundle']).toMatchObject({ price: 115, savingsPercent: 11, capabilityLabels: [] });
		expect(materializeKibbleSubscriptionOffers([{ id: 'stale-goodgut', entityId: 3023, price: 40 }])).toEqual({});
		expect(materializeKibbleSubscriptionOffers([{ id: 'sale-goodgut', entityId: 3023, price: 34.99, salePrice: 31.99 }])).toEqual({});
		expect(isKibblePinnedOfferPriceConsistent({ entityId: 3023, price: 34.99 }, { price: 29.74, savingsPercent: 15 })).toBe(true);
		expect(isKibblePinnedOfferPriceConsistent({ entityId: 3023, price: 34.99 }, { price: 28, savingsPercent: 20 })).toBe(false);
	});

	it('keeps storefront and portal capability evidence on their owning surfaces', () => {
		const freeTrialProducts = KIBBLE_CATALOG_ENTITY_IDS.filter((entityId) =>
			getKibbleCatalogCapabilities(entityId)?.subscription?.capabilities.includes('free-trial'),
		);
		expect(freeTrialProducts).toEqual([3035]);
		for (const entityId of KIBBLE_CATALOG_ENTITY_IDS) {
			const capabilities = getKibbleCatalogCapabilities(entityId)?.subscription?.capabilities ?? [];
			expect(capabilities).not.toContain('gift');
			expect(capabilities).not.toContain('prepaid');
			expect(capabilities).not.toContain('build-a-box');
		}
	});

	it('exposes safe capability signals to bounded server-side presentation decisions', () => {
		expect(getKibbleCatalogSignals(3023)).toEqual({
			productRole: 'consumable',
			offerProjection: 'pinned-auto-refill',
			canonicalRegistryStatus: 'listed',
			categorySlug: 'dog-food',
			categorySource: 'pinned-seed',
			categoryJob: 'Choose an everyday nutrition routine that fits the dog and household.',
			decisionDimensions: ['protein', 'life stage', 'food format', 'diet needs', 'replenishment'],
			subscriptionCapabilities: ['subscribe-and-save', 'intro-offer'],
			subscriptionSavingsPercent: 15,
			subscriptionCadenceMonths: [1, 2, 3],
		});
		expect(getKibbleCatalogSignals(3049)).toEqual({
			productRole: 'durable',
			offerProjection: 'none',
			canonicalRegistryStatus: 'not-listed',
			categorySlug: 'toys',
			categorySource: 'pinned-seed',
			categoryJob: 'Match enrichment and play style without treating a durable item like a refill.',
			decisionDimensions: ['play style', 'dog size', 'durability', 'supervision'],
			subscriptionCapabilities: [],
			subscriptionSavingsPercent: null,
			subscriptionCadenceMonths: null,
		});
		expect(getKibbleCatalogSignals(3023, 'Toys')).toMatchObject({
			productRole: 'durable',
			categorySlug: 'toys',
			categorySource: 'live-catalog-override',
			offerProjection: 'pinned-auto-refill',
		});
		expect(getKibbleCatalogSignals(3023, 'Dog Food', { price: 40 })).toMatchObject({
			offerProjection: 'suppressed-price-drift',
			subscriptionCapabilities: [],
			subscriptionSavingsPercent: null,
			subscriptionCadenceMonths: null,
		});
	});

	it('assigns every catalog row to one category job and one product role', () => {
		const profiles = new Set(Object.keys(KIBBLE_CATEGORY_JOB_PROFILES));
		const roles = KIBBLE_CATALOG_ENTITY_IDS.map((entityId) => getKibbleCatalogSignals(entityId).productRole);
		for (const entityId of KIBBLE_CATALOG_ENTITY_IDS) {
			const slug = getKibbleCatalogCategorySlug(entityId);
			expect(slug).not.toBeNull();
			expect(profiles.has(slug!)).toBe(true);
			expect(KIBBLE_CATALOG_SOURCE_CATEGORY_IDS[entityId]).toBe(KIBBLE_CATEGORY_JOB_PROFILES[slug!].sourceCategoryId);
		}
		expect(Object.values(KIBBLE_CATEGORY_JOB_PROFILES).map(({ sourceCategoryId }) => sourceCategoryId)).toEqual([325, 326, 327, 328, 329, 330, 331, 332]);
		for (const profile of Object.values(KIBBLE_CATEGORY_JOB_PROFILES)) {
			expect(getKibbleCatalogCategorySlugFromName(profile.sourceCategoryName)).toBe(profile.slug);
		}
		expect(roles.filter((role) => role === 'consumable')).toHaveLength(26);
		expect(roles.filter((role) => role === 'durable')).toHaveLength(15);
		expect(roles.filter((role) => role === 'bundle')).toHaveLength(8);
		expect(roles).not.toContain('unclassified');
	});

	it('defines a category job for every configured storefront category', () => {
		for (const category of KIBBLE_PRESERVE_MANIFEST.display.categories) {
			expect(KIBBLE_CATEGORY_JOB_PROFILES[category.configSlug]).toBeDefined();
		}
	});

	it('gives every live-in-snapshot subscription capability a local read-only review path', () => {
		expect(KIBBLE_SUBSCRIPTION_CAPABILITY_DEMOS).toHaveLength(7);
		expect(new Set(KIBBLE_SUBSCRIPTION_CAPABILITY_DEMOS.map(({ id }) => id)).size).toBe(7);
		for (const demo of KIBBLE_SUBSCRIPTION_CAPABILITY_DEMOS) {
			expect(demo.sourceStatus).toBe('live-in-pinned-snapshot');
			expect(demo.owner).toBe('subscription-service');
			expect(demo.demoHref).toMatch(/^\//);
			expect(demo.demoHref).not.toMatch(/^\/api\//);
		}
		assertContractedReviewPaths(KIBBLE_SUBSCRIPTION_CAPABILITY_DEMOS.map(({ demoHref }) => demoHref));
		expect(KIBBLE_SUBSCRIPTION_CAPABILITY_DEMOS.filter(({ sourceSurface }) => sourceSurface === 'storefront')).toHaveLength(4);
		expect(KIBBLE_SUBSCRIPTION_CAPABILITY_DEMOS.filter(({ sourceSurface }) => sourceSurface === 'portal')).toHaveLength(3);
		expect(KIBBLE_SUBSCRIPTION_CAPABILITY_DEMOS.every(({ demoHref }) => !demoHref.startsWith('/product/'))).toBe(true);
		expect(KIBBLE_SUBSCRIPTION_CAPABILITY_DEMOS.filter(({ reviewSource }) => reviewSource === 'capability-map')).toHaveLength(7);
	});

	it('keeps every configurable source model outside current Kibble intent explicit', () => {
		expect(KIBBLE_SOURCE_CAPABILITIES_OUTSIDE_KIBBLE).toHaveLength(7);
		expect(KIBBLE_SOURCE_CAPABILITIES_OUTSIDE_KIBBLE.map(({ id }) => id)).toEqual([
			'bundle', 'membership', 'usage-based', 'curation', 'allotment', 'multi-actor', 'calendar-anchored',
		]);
		for (const capability of KIBBLE_SOURCE_CAPABILITIES_OUTSIDE_KIBBLE) {
			expect(capability.disposition).toBe('not-claimed-for-kibble');
		}
	});

	it('covers every Kibble presentation capability that is actually enabled', () => {
		const policies = [
			KIBBLE_HOME_PRESENTATION_POLICY, KIBBLE_PLP_PRESENTATION_POLICY, KIBBLE_PDP_PRESENTATION_POLICY,
			KIBBLE_SEARCH_PRESENTATION_POLICY, KIBBLE_CART_PRESENTATION_POLICY, KIBBLE_CHECKOUT_PRESENTATION_POLICY,
		];
		const policySurfaces = ['home', 'plp', 'pdp', 'search', 'cart', 'checkout'] as const;
		const enabled = new Set([...KIBBLE_HOME_RULE_CAPABILITIES, ...policies.flatMap(({ capabilities }) => capabilities)]);
		const demonstrated = new Set(KIBBLE_AISLES_CAPABILITY_DEMOS.map(({ id }) => id));
		expect([...demonstrated].sort()).toEqual([...enabled].sort());
		expect(demonstrated.has('generate_bounded_copy' as never)).toBe(false);
		expect(demonstrated.has('select_page_recipe' as never)).toBe(false);
		expect(KIBBLE_AISLES_CAPABILITY_DEMOS.reduce((total, { proofs }) => total + proofs.length, 0)).toBe(14);
		for (const demo of KIBBLE_AISLES_CAPABILITY_DEMOS) {
			expect(demo.demoHref).toMatch(/^\//);
			expect(demo.fixedFacts).toEqual(KIBBLE_FIXED_COMMERCE_FACTS);
			const expectedSurfaces = policySurfaces.filter((surface, index) => policies[index].capabilities.includes(demo.id as never));
			if (KIBBLE_HOME_RULE_CAPABILITIES.includes(demo.id as never) && !expectedSurfaces.includes('home')) expectedSurfaces.unshift('home');
			expect([...demo.surfaces].sort()).toEqual([...expectedSurfaces].sort());
			expect(demo.proofs.map(({ route }) => route.surface).sort()).toEqual([...expectedSurfaces].sort());
			expect(new Set(demo.proofs.map(({ route }) => route.surface)).size).toBe(demo.proofs.length);
			expect(demo.proofs.some(({ route }) => route.href === demo.demoHref)).toBe(true);
			for (const proof of demo.proofs) {
				expect(proof.route.href).toMatch(/^\//);
				expect(proof.trigger.requiresUserAction).toBe(true);
				expect(proof.namedZoneInstances.length).toBeGreaterThan(0);
				expect(proof.namedZoneInstances).not.toContain(demo.id);
				expect(proof.candidatePrerequisites.length).toBeGreaterThan(0);
				expect(proof.before.observe.aiZones).toMatchObject({ kind: 'exact', value: 0 });
				expect(proof.before.observe.aiCalls).toMatchObject({ kind: 'exact', value: 0 });
				expect(proof.result.changed).not.toBe(proof.result.kept);
				expect(proof.failClosedReason.length).toBeGreaterThan(20);
				if (proof.trigger.execution === 'explicit-observe-model') expect(proof.result.observe.aiCalls).toMatchObject({ kind: 'range', min: 1, max: 2 });
				else expect(proof.result.observe.aiCalls).toMatchObject({ kind: 'exact', value: 0 });
			}
		}
		expect(KIBBLE_AISLES_CAPABILITY_DEMOS.find(({ id }) => id === 'toggle_zone')?.proofs).toEqual(expect.arrayContaining([
			expect.objectContaining({ route: { surface: 'plp', href: '/category/dog-food?sort=FEATURED&observe=true', stableProof: expect.any(String) }, namedZoneInstances: ['plp.marketing-block'] }),
			expect.objectContaining({ route: { surface: 'pdp', href: '/product/puppy-starter-kit?observe=true', stableProof: expect.any(String) }, namedZoneInstances: ['pdp.below-description'] }),
		]));
		expect(KIBBLE_AISLES_PDP_PROOF).toEqual({
			href: '/product/puppy-starter-kit?observe=true', slug: 'puppy-starter-kit', productEntityId: 3064,
			fixtureSha256: KIBBLE_REFERENCE_CONTRACT.source.fixtureSha256,
			candidateCount: 4, candidateSource: 'category_sibling', relationKind: null,
		});
		assertContractedReviewPaths(KIBBLE_AISLES_CAPABILITY_DEMOS.flatMap(({ proofs }) => proofs.map(({ route }) => route.href)));
	});

	it('preserves source drift and merchant-outcome gaps instead of flattening them', () => {
		const coverage = buildKibbleMerchantCapabilityCoverage();
		expect(coverage.version).toBe('kibble-merchant-capability-manifest-v1');
		expect(coverage.sourceRegistryNote).toContain('three PDP capabilities');
		expect(coverage.sourceRegistryNote).toContain('seven live capabilities');
		expect(coverage.sourceRegistryNote).toContain('34 product rows');
		expect(coverage.sourceRegistryNote).toContain('Gift is a direct source contradiction');
		expect(coverage.subscriptionCapabilities.find(({ id }) => id === 'gift')).toMatchObject({
			canonicalRegistryDisposition: 'absent',
			canonicalRegistryEvidence: expect.stringContaining('no gift_tokens table'),
		});
		expect(coverage.sourceCapabilitiesOutsideKibble).toHaveLength(7);
		expect(coverage.outcomeProof).toBe('not-measured');
		expect(coverage.commerceBoundary).toContain('transaction authorities');
		const manifestKeys = collectKeys(coverage);
		for (const forbidden of ['cartIntent', 'planId', 'paymentValue', 'customerIdentity', 'transactionAuthorization']) {
			expect(manifestKeys).not.toContain(forbidden);
		}
	});

	it('keeps source prices and savings within a display-safe range', () => {
		for (const entityId of KIBBLE_CATALOG_ENTITY_IDS) {
			const subscription = getKibbleCatalogCapabilities(entityId)?.subscription;
			if (!subscription) continue;
			expect(subscription.price).toBeGreaterThan(0);
			expect(subscription.savingsPercent).toBeGreaterThanOrEqual(0);
			expect(subscription.savingsPercent).toBeLessThanOrEqual(100);
			expect(subscription.cadenceMonths).toEqual([1, 2, 3]);
		}
	});
});

function assertContractedReviewPaths(hrefs: readonly string[]): void {
	const inventory = KIBBLE_REFERENCE_CONTRACT.routeInventory.map(({ path }) => path);
	for (const href of hrefs) {
		const pathname = new URL(href, 'https://kibble.test').pathname;
		expect(inventory.some((pattern) => routePatternMatches(pattern, pathname)), `${href} must resolve through routeInventory`).toBe(true);
	}
}

function routePatternMatches(pattern: string, pathname: string): boolean {
	const expected = pattern.split('/').filter(Boolean);
	const actual = pathname.split('/').filter(Boolean);
	return expected.length === actual.length && expected.every((segment, index) => /^\[[^\]]+\]$/.test(segment) || segment === actual[index]);
}

function collectKeys(value: unknown): string[] {
	if (Array.isArray(value)) return value.flatMap(collectKeys);
	if (value === null || typeof value !== 'object') return [];
	return Object.entries(value).flatMap(([key, nested]) => [key, ...collectKeys(nested)]);
}
