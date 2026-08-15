import { describe, expect, it } from 'vitest';
import {
	KIBBLE_PDP_BUNDLE_PROJECTION_SHA256,
	KIBBLE_PDP_ADAPTED_SOURCE_FILES,
	KIBBLE_PDP_EXCLUDED_DEPENDENCIES,
	KIBBLE_PDP_EXTERNAL_DEPENDENCIES,
	KIBBLE_PDP_SOURCE_ROOTS,
	KIBBLE_REFERENCE_CONTRACT,
	KIBBLE_SEARCH_SOURCE_CLOSURE,
	KIBBLE_CART_SOURCE_CLOSURE,
	KIBBLE_ACCOUNT_SOURCE_CLOSURE,
	KIBBLE_CHECKOUT_SOURCE_CLOSURE,
	KIBBLE_SUBSCRIPTIONS_SOURCE_CLOSURE,
	KibbleReferenceContractSchema,
} from './kibble';
import { KIBBLE_PLP_GRAPHQL_SORT } from './kibble-plp';
import { KIBBLE_CANONICAL_UNION_ZONE_IDS } from './kibble-zone-union';

type MutableContract = ReturnType<typeof structuredClone<typeof KIBBLE_REFERENCE_CONTRACT>>;

function cloneContract(): MutableContract {
	return structuredClone(KIBBLE_REFERENCE_CONTRACT);
}

function remove(path: Array<string | number>): unknown {
	const candidate: unknown = cloneContract();
	let cursor: unknown = candidate;
	for (const key of path.slice(0, -1)) {
		if (cursor === null || typeof cursor !== 'object') throw new Error('Invalid test path');
		cursor = (cursor as Record<string | number, unknown>)[key];
	}
	if (cursor === null || typeof cursor !== 'object') throw new Error('Invalid test path');
	delete (cursor as Record<string | number, unknown>)[path.at(-1)!];
	return candidate;
}

function contrast(foreground: string, background: string): number {
	const luminance = (hex: string) => {
		const channels = hex.slice(1).match(/.{2}/g)!.map((value) => Number.parseInt(value, 16) / 255);
		const [r, g, b] = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
		return 0.2126 * r + 0.7152 * g + 0.0722 * b;
	};
	const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
	return (values[0] + 0.05) / (values[1] + 0.05);
}

describe('Kibble reference contract', () => {
	it('pins the approved source revision and locked Shelf-Native artifacts', () => {
		expect(KIBBLE_REFERENCE_CONTRACT.version).toBe('1.9.0');
		expect(KIBBLE_REFERENCE_CONTRACT.source).toEqual({
			repository: 'bc-subscriptions', remote: 'git@github.com:nino-chavez/bc-subscriptions.git',
			commit: 'ef122b8e17b9eb0b327c9d42491c44a61577ead4', referenceContractVersion: '1.5.0', applicationPath: 'apps/storefront-svelte',
			brandKitPath: 'scripts/kibble-demo/data/brand/brand-kit.md', tokensPath: 'scripts/kibble-demo/data/brand/tokens.css',
			fixturePath: 'scripts/kibble-demo/data/seed-output.json', fixtureSha256: '833824a875f1fbe83a5d1d9164f521aa38e64e3902d22623a6af1b8cad84fe49',
			canonicalBoundary: expect.stringContaining('pinned storefront source'),
		});
		expect(KIBBLE_REFERENCE_CONTRACT.merchantCapabilityManifest).toMatchObject({
			version: 'kibble-merchant-capability-manifest-v1',
			mode: 'display-only-no-commerce-authority',
			outcomeProof: 'not-measured',
			sourceHashes: {
				eligibleProductsSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
				canonicalRegistrySha256: expect.stringMatching(/^[0-9a-f]{64}$/),
				marketingCapabilitiesSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
				demoStateSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
				seedOutputSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
			},
		});
	});

	it.each([
		['source commit', ['source', 'commit']],
		['source contract version', ['source', 'referenceContractVersion']],
		['merchant capability manifest', ['merchantCapabilityManifest']],
		['semantic action token', ['tokens', 'colors', 'action']],
		['full component variants', ['components', 0, 'variants']],
		['home recipe anatomy', ['recipes', 'home', 'orderedAnatomy']],
		['PLP page size', ['recipes', 'plp', 'pageSize']],
		['PLP sort choices', ['recipes', 'plp', 'sortChoices']],
		['PDP catalog-only recipe', ['recipes', 'pdp']],
	] as const)('rejects a contract missing %s', (_label, path) => {
		expect(KibbleReferenceContractSchema.safeParse(remove([...path])).success).toBe(false);
	});

	it('requires the exact unique chrome anatomy and root-layout owner', () => {
		expect(KIBBLE_REFERENCE_CONTRACT.chrome.required).toEqual([
			'autorefill-status-bar', 'merchant-wordmark', 'catalog-navigation', 'search-control',
			'account-control', 'cart-control', 'mobile-drawer', 'merchant-footer',
		]);
		const candidate = cloneContract();
		(candidate.chrome.required as unknown as string[])[6] = 'cart-control';
		expect(KibbleReferenceContractSchema.safeParse(candidate).success).toBe(false);
	});

	it('defines fail-closed optional commerce destinations and named actions', () => {
		expect(KIBBLE_REFERENCE_CONTRACT.adapter).toMatchObject({
			links: { optional: ['account', 'cart', 'saved-picks'] }, failClosed: true,
		});
		expect(KIBBLE_REFERENCE_CONTRACT.adapter.actions.allowed).toContain('open-cart-drawer');
	});

	it('locks the semantic palette instead of accepting generic brand aliases', () => {
		expect(KIBBLE_REFERENCE_CONTRACT.tokens.colors).toMatchObject({ identity: '#1e2150', action: '#3b5bd0', autoRefill: '#37bfa2' });
		expect(KIBBLE_REFERENCE_CONTRACT.ownership.forbiddenAtRuntime).toContain('inventing CSS');
	});

	it('keeps both PDP stock states at WCAG AA contrast on the surface', () => {
		const { identity, mutedText, surface } = KIBBLE_REFERENCE_CONTRACT.tokens.colors;
		expect(contrast(identity, surface)).toBeGreaterThanOrEqual(4.5);
		expect(contrast(mutedText, surface)).toBeGreaterThanOrEqual(4.5);
	});

	it('separates root chrome from the home component anatomy', () => {
		const anatomy = KIBBLE_REFERENCE_CONTRACT.recipes.home.orderedAnatomy;
		expect(KIBBLE_REFERENCE_CONTRACT.recipes.home.acceptance).toBe('pending-parity');
		expect(KIBBLE_REFERENCE_CONTRACT.recipes.plp.acceptance).toBe('approved');
		expect(KIBBLE_REFERENCE_CONTRACT.chrome.mobileDrawerBreakpointPx).toBe(1024);
		expect(anatomy.map(({ slot, owner }) => ({ slot, owner }))).toEqual([
			{ slot: 'merchant-chrome', owner: 'root-layout' },
			{ slot: 'opening-merchandising', owner: 'home-recipe' },
			{ slot: 'ranked-products', owner: 'home-recipe' },
			{ slot: 'catalog-entry', owner: 'home-recipe' },
			{ slot: 'service-proof', owner: 'home-recipe' },
			{ slot: 'merchant-footer', owner: 'root-layout' },
		]);
		expect(KIBBLE_REFERENCE_CONTRACT.recipes.home.rootLayoutChrome).toBe('kibble.header');
		expect(KIBBLE_REFERENCE_CONTRACT.recipes.home.rootLayoutFooter).toBe('kibble.footer');
		expect(anatomy[0].variantId).toBe('kibble.header.responsive-chrome');
		const header = KIBBLE_REFERENCE_CONTRACT.components.find(({ id }) => id === 'kibble.header')!;
		expect(header.variants).toHaveLength(1);
		expect(header.variants[0].cssVariantIds).toEqual(['kc.header.desktop', 'kc.header.mobile-drawer']);
	});

	it('rejects recipe slots that name unregistered components or full variants', () => {
		const badComponent = cloneContract();
		badComponent.recipes.home.orderedAnatomy[0].component = 'kibble.unknown';
		expect(KibbleReferenceContractSchema.safeParse(badComponent).success).toBe(false);
		const badVariant = cloneContract();
		badVariant.recipes.home.orderedAnatomy[1].variantId = 'kibble.hero.invented';
		expect(KibbleReferenceContractSchema.safeParse(badVariant).success).toBe(false);
	});

	it.each([
		['CSS variant', 'cssVariantIds', 'kc.unknown'],
		['asset slot', 'assetSlots', 'unknown.image'],
		['link target', 'linkTargets', 'unknown-link'],
		['action target', 'actionTargets', 'unknown-action'],
	] as const)('rejects an unregistered %s', (_label, field, value) => {
		const candidate = cloneContract();
		candidate.components[0].variants[0][field].push(value);
		expect(KibbleReferenceContractSchema.safeParse(candidate).success).toBe(false);
	});

	it('rejects duplicate full variants, fields, and bounded copy definitions', () => {
		const duplicateVariant = cloneContract();
		duplicateVariant.components[1].variants[0].id = duplicateVariant.components[0].variants[0].id;
		expect(KibbleReferenceContractSchema.safeParse(duplicateVariant).success).toBe(false);
		const duplicateField = cloneContract();
		duplicateField.components[0].variants[0].dynamicPropFields.push('brandName');
		expect(KibbleReferenceContractSchema.safeParse(duplicateField).success).toBe(false);
		const duplicateCopy = cloneContract();
		duplicateCopy.components[1].variants[0].copyFields.push(duplicateCopy.components[1].variants[0].copyFields[0]);
		expect(KibbleReferenceContractSchema.safeParse(duplicateCopy).success).toBe(false);
		const duplicateRegistry = cloneContract();
		duplicateRegistry.registry.linkTargets[1] = duplicateRegistry.registry.linkTargets[0];
		expect(KibbleReferenceContractSchema.safeParse(duplicateRegistry).success).toBe(false);
	});

	it('requires bounded copy source classes for factual hero and header fields', () => {
		const hero = KIBBLE_REFERENCE_CONTRACT.components.find(({ id }) => id === 'kibble.hero')!;
		const headline = hero.variants[0].copyFields.find(({ field }) => field === 'headline');
		expect(headline).toEqual({ field: 'headline', maxLength: 88, sourceClasses: ['reference-copy'] });
		const header = KIBBLE_REFERENCE_CONTRACT.components.find(({ id }) => id === 'kibble.header')!;
		const status = header.variants[0].copyFields.find(({ field }) => field === 'statusItems[].label');
		expect(status?.sourceClasses).toEqual(['computed-fact']);
	});

	it('registers every Preserve route renderer and its complete variant', () => {
		const renderers = new Map(KIBBLE_REFERENCE_CONTRACT.components.map((component) => [component.implementation, component]));
		expect(KIBBLE_REFERENCE_CONTRACT.recipes.home.implementation).toBe('KibbleHomeReference.svelte');
		for (const recipe of [KIBBLE_REFERENCE_CONTRACT.recipes.plp, KIBBLE_REFERENCE_CONTRACT.recipes.pdp, KIBBLE_REFERENCE_CONTRACT.recipes.error]) {
			expect(renderers.has(recipe.implementation)).toBe(true);
		}
		const plp = renderers.get('KibbleCategoryReference.svelte')!;
		expect(plp.variants.map(({ id }) => id)).toContain(KIBBLE_REFERENCE_CONTRACT.recipes.plp.variantId);
		const error = renderers.get('KibbleErrorReference.svelte')!;
		expect(error.variants.map(({ id }) => id)).toContain(KIBBLE_REFERENCE_CONTRACT.recipes.error.variantId);
		const pdp = renderers.get('KibbleProductDetailReference.svelte')!;
		expect(pdp.variants.map(({ id }) => id)).toContain(KIBBLE_REFERENCE_CONTRACT.recipes.pdp.variantId);
	});

	it('contracts the merchant enrichment props on each rendered surface', () => {
		const variants = new Map(KIBBLE_REFERENCE_CONTRACT.components.map((component) => [component.id, component.variants[0]]));
		expect(variants.get('kibble.category-listing')?.dynamicPropFields).toContain('categoryGuide');
		expect(variants.get('kibble.product-detail')?.dynamicPropFields).toContain('autoRefill');
		expect(variants.get('kibble.subscriptions')?.dynamicPropFields).toContain('capabilityCoverage');
		expect(variants.get('kibble.product-detail')?.copyFields.map(({ field }) => field)).toContain('autoRefill.capabilityEvidence[].detail');
	});

	it('pins the full PLP request and rendering contract', () => {
		expect(KIBBLE_REFERENCE_CONTRACT.recipes.plp).toMatchObject({
			source: { commit: 'ef122b8e17b9eb0b327c9d42491c44a61577ead4' },
			orderedAnatomy: ['breadcrumbs', 'category-header', 'merchant-category-guide', 'sort-control', 'product-grid', 'cursor-continuation'],
			defaultSort: 'FEATURED', pageSize: 24,
			pagination: { strategy: 'forward-cursor', cursorParam: 'after', actionLabel: 'Load more' },
			productCards: 'links-to-catalog-display-only-pdp', modelLayoutRequest: false,
		});
		expect(KIBBLE_REFERENCE_CONTRACT.recipes.plp.sortChoices).toEqual([
			{ value: 'FEATURED', label: 'Featured' },
			{ value: 'NEWEST', label: 'Newest' },
			{ value: 'BEST_SELLING', label: 'Best selling' },
			{ value: 'A_TO_Z', label: 'A to Z' },
			{ value: 'Z_TO_A', label: 'Z to A' },
			{ value: 'LOWEST_PRICE', label: 'Price: low to high' },
			{ value: 'HIGHEST_PRICE', label: 'Price: high to low' },
		]);
		expect(KIBBLE_PLP_GRAPHQL_SORT).toEqual({
			FEATURED: 'FEATURED', NEWEST: 'NEWEST', BEST_SELLING: 'BEST_SELLING',
			A_TO_Z: 'A_TO_Z', Z_TO_A: 'Z_TO_A',
			LOWEST_PRICE: 'LOWEST_PRICE', HIGHEST_PRICE: 'HIGHEST_PRICE',
		});
	});

	it('pins the PDP source anatomy and explicit unavailable-purchase difference', () => {
		expect(KIBBLE_REFERENCE_CONTRACT.recipes.pdp).toMatchObject({
			acceptance: 'approved',
			source: { commit: 'ef122b8e17b9eb0b327c9d42491c44a61577ead4' },
			orderedAnatomy: ['breadcrumbs', 'media-gallery', 'product-identity', 'conditional-bundle-summary', 'catalog-price-and-availability', 'conditional-pinned-subscription-evidence', 'conditional-bundle-contents', 'catalog-options', 'truthful-purchase-unavailable', 'description-and-specifications', 'related-products'],
			commerce: { mode: 'catalog-display-only', sourcePurchaseControls: 'not-rendered-in-aisles', visibleState: 'truthful-purchase-unavailable' },
			publication: { mode: 'live-read-only', reviewAvailability: 'production-and-development', productLinks: 'enabled-to-catalog-display-only-pdp' },
			modelLayoutRequest: false,
		});
		expect(KIBBLE_REFERENCE_CONTRACT.recipes.pdp.source.dependencyClosure).toEqual({
			scope: 'canonical-pdp-import-closure-at-pinned-commit',
			roots: KIBBLE_PDP_SOURCE_ROOTS,
			traversalRule: 'Traverse adapted imports recursively; excluded roots terminate traversal; framework and generated imports are external.',
			adapted: KIBBLE_PDP_ADAPTED_SOURCE_FILES,
			excluded: KIBBLE_PDP_EXCLUDED_DEPENDENCIES,
			external: KIBBLE_PDP_EXTERNAL_DEPENDENCIES,
			exclusionInvariant: 'Excluded commerce and subscription runtime dependencies must not be imported or invoked. Only the contracted local merchant capability projection may be represented, and it grants no transaction authority.',
		});
		expect(KIBBLE_REFERENCE_CONTRACT.recipes.pdp.source.dependencyClosure.adapted).toEqual([
			{ path: 'apps/storefront-svelte/src/routes/products/[slug]/+page.server.ts', sha256: '61546d7a03e180c02dba320ea10b95c5d590f616ae60ce85adcb31292070ef68' },
			{ path: 'apps/storefront-svelte/src/routes/products/[slug]/+page.svelte', sha256: '2037eca5a6b2e98b30e9d901ef97616a7347356566d98906ef777948351e3646' },
			{ path: 'apps/storefront-svelte/src/lib/components/Breadcrumbs.svelte', sha256: '89bee94fca474e2c587a1fc12ab912fade83804e9bb27eeca7c4a557d06d43ac' },
			{ path: 'apps/storefront-svelte/src/lib/components/ProductGallery.svelte', sha256: 'f83501005792e00a7d3b540f65ebfa8ea85eeb2c0bf8e9209f2e9ce346073c76' },
			{ path: 'apps/storefront-svelte/src/lib/components/VariantPicker.svelte', sha256: '2723d808e0441834b42e9d44cc7c03d407181e9d7b65452b91dad719ce5836d3' },
			{ path: 'apps/storefront-svelte/src/lib/components/RelatedProducts.svelte', sha256: '285616781af47263191a96452f75fe678044c59877c82e3a010c7a694f57133f' },
			{ path: 'apps/storefront-svelte/src/lib/components/ProductCard.svelte', sha256: '738d4ee911fa6b852672d2067ec45dcc4e0365756c5572108e91bd4a5828d38d' },
			{ path: 'apps/storefront-svelte/src/lib/brand/bundle-contents.json', sha256: '84eeb73ac2d81e2b796b530c876ab334ec6d613e74ff59e7ecffb6f20086bcdd' },
			{ path: 'apps/storefront-svelte/src/lib/brand/kibble-shelf-reference.ts', sha256: '0559e879e7f5b26b0a52a3d1a9f6af8b04b657661b9ff3c6914efc073523bad2' },
			{ path: 'apps/storefront-svelte/src/lib/server/bigcommerce.ts', sha256: '8d4810e67c328ee5b9ed46f0ed0a2c19bb6586f7516679b4f8813661c87e6015' },
			{ path: 'apps/storefront-svelte/src/lib/types/catalog.ts', sha256: '0bd280034b8f2cdfc0c647d0744f115987a4fc6a1209da36217be6b65173ad03' },
		]);
		expect(KIBBLE_REFERENCE_CONTRACT.recipes.pdp.source.dependencyClosure.excluded).toEqual([
			{ module: '$lib/subscriptions/SubscriptionWidget.svelte', reason: 'Aisles does not implement the canonical subscription selector or subscribe-to-cart flow.' },
			{ module: '$lib/subscriptions/api-client', reason: 'Aisles does not call the subscription API from its catalog-display-only PDP.' },
			{ module: '$lib/subscriptions/eligible-products.json', reason: 'The source runtime file is not imported. Aisles uses only a local hash-pinned, display-only projection with a live-price drift guard.' },
			{ module: '$lib/server/cart', reason: 'Aisles does not create or mutate a cart from the review-only PDP.' },
			{ module: '$lib/server/cart-intents', reason: 'Aisles does not persist subscription intents from the review-only PDP.' },
			{ module: 'products/[slug]/+page.server.ts#actions.addToCart', reason: 'Aisles replaces canonical purchase actions with a truthful purchase-unavailable state while parity remains pending.' },
		]);
		expect(KIBBLE_REFERENCE_CONTRACT.recipes.pdp.source.dependencyClosure.external).toEqual([
			{ module: '@sveltejs/kit', classification: 'framework-runtime' },
			{ module: '$app/stores', classification: 'framework-runtime' },
			{ module: '$env/dynamic/public', classification: 'framework-runtime' },
			{ module: '$env/dynamic/private', classification: 'framework-runtime' },
			{ module: './$types', classification: 'generated-types' },
		]);
		expect(KIBBLE_REFERENCE_CONTRACT.recipes.pdp.bundleProjection).toEqual({
			sourcePath: 'apps/storefront-svelte/src/lib/brand/bundle-contents.json',
			serialization: 'canonical-json-v1',
			bundleCount: 8,
			sha256: KIBBLE_PDP_BUNDLE_PROJECTION_SHA256,
		});
		expect(KIBBLE_REFERENCE_CONTRACT.recipes.pdp.merchantCapabilityProjection).toEqual({
			mode: 'display-only',
			owner: 'merchant-config-projection',
			sourceAuthority: 'subscription-service-snapshot',
			manifestVersion: 'kibble-merchant-capability-manifest-v1',
			evidenceDate: 'not-asserted-source-offer-file-is-undated',
			allowedFields: ['price', 'savingsPercent', 'cadenceMonths', 'capabilityLabels', 'capabilityEvidence'],
			storefrontCapabilities: ['subscribe-and-save', 'free-trial', 'intro-offer', 'annual'],
			portalCapabilities: 'not-rendered-on-pdp',
			driftGuard: 'hide-when-effective-catalog-price-does-not-support-the-pinned-rounded-savings',
			transactionAuthority: 'none',
		});
		expect(new Set([
			KIBBLE_REFERENCE_CONTRACT.source.commit,
			KIBBLE_REFERENCE_CONTRACT.recipes.plp.source.commit,
			KIBBLE_REFERENCE_CONTRACT.recipes.pdp.source.commit,
		])).toEqual(new Set(['ef122b8e17b9eb0b327c9d42491c44a61577ead4']));
		expect(KIBBLE_REFERENCE_CONTRACT.recipes.pdp.commerce.forbidden).toContain('add-to-cart');
		expect(KIBBLE_REFERENCE_CONTRACT.recipes.pdp.commerce.forbidden).toContain('subscription-action');
	});

	it('rejects PDP source, projection, and cross-contract provenance tampering', () => {
		const changedRoot = cloneContract();
		(changedRoot.recipes.pdp.source.dependencyClosure.roots as string[])[0] = 'apps/storefront-svelte/src/routes/cart/+page.svelte';
		expect(() => KibbleReferenceContractSchema.parse(changedRoot)).toThrow();

		const badSourceHash = cloneContract();
		(badSourceHash.recipes.pdp.source.dependencyClosure.adapted[0] as { sha256: string }).sha256 = '0'.repeat(64);
		expect(KibbleReferenceContractSchema.safeParse(badSourceHash).success).toBe(false);

		const badProjectionHash = cloneContract();
		(badProjectionHash.recipes.pdp.bundleProjection as { sha256: string }).sha256 = 'f'.repeat(64);
		expect(KibbleReferenceContractSchema.safeParse(badProjectionHash).success).toBe(false);

		const missingMerchantProjection = cloneContract();
		delete (missingMerchantProjection.recipes.pdp as unknown as Record<string, unknown>).merchantCapabilityProjection;
		expect(KibbleReferenceContractSchema.safeParse(missingMerchantProjection).success).toBe(false);

		const changedCapabilitySourceHash = cloneContract();
		changedCapabilitySourceHash.merchantCapabilityManifest.sourceHashes.demoStateSha256 = '0'.repeat(64) as never;
		expect(KibbleReferenceContractSchema.safeParse(changedCapabilitySourceHash).success).toBe(false);

		const mismatchedCanonicalCommit = cloneContract();
		(mismatchedCanonicalCommit.source as { commit: string }).commit = 'a'.repeat(40);
		expect(KibbleReferenceContractSchema.safeParse(mismatchedCanonicalCommit).success).toBe(false);

		const uncontractedSourceField = cloneContract();
		(uncontractedSourceField.recipes.pdp.source as unknown as Record<string, unknown>).unverified = true;
		expect(KibbleReferenceContractSchema.safeParse(uncontractedSourceField).success).toBe(false);
	});

	it('requires every expected dependency classification and exclusion label', () => {
		const missingProductCard = cloneContract();
		missingProductCard.recipes.pdp.source.dependencyClosure.adapted.splice(6, 1);
		expect(KibbleReferenceContractSchema.safeParse(missingProductCard).success).toBe(false);

		const missingSubscriptionExclusion = cloneContract();
		missingSubscriptionExclusion.recipes.pdp.source.dependencyClosure.excluded.splice(0, 1);
		expect(KibbleReferenceContractSchema.safeParse(missingSubscriptionExclusion).success).toBe(false);

		const relabeledExclusion = cloneContract();
		(relabeledExclusion.recipes.pdp.source.dependencyClosure.excluded[0] as { reason: string }).reason = 'Generic exclusion';
		expect(KibbleReferenceContractSchema.safeParse(relabeledExclusion).success).toBe(false);

		const missingFrameworkClassification = cloneContract();
		missingFrameworkClassification.recipes.pdp.source.dependencyClosure.external.splice(0, 1);
		expect(KibbleReferenceContractSchema.safeParse(missingFrameworkClassification).success).toBe(false);

		const weakenedInvariant = cloneContract();
		(weakenedInvariant.recipes.pdp.source.dependencyClosure as { exclusionInvariant: string }).exclusionInvariant = 'Excluded for now.';
		expect(KibbleReferenceContractSchema.safeParse(weakenedInvariant).success).toBe(false);
	});

	it('rejects reordered or invented PLP sort controls', () => {
		const reordered = cloneContract();
		[reordered.recipes.plp.sortChoices[0], reordered.recipes.plp.sortChoices[1]] =
			[reordered.recipes.plp.sortChoices[1], reordered.recipes.plp.sortChoices[0]];
		expect(KibbleReferenceContractSchema.safeParse(reordered).success).toBe(false);
		const invented = cloneContract();
		invented.recipes.plp.sortChoices[0].value = 'RELEVANCE';
		expect(KibbleReferenceContractSchema.safeParse(invented).success).toBe(false);
	});

	it('rejects PLP and error recipes bound to an unregistered or wrong component variant', () => {
		const badPlp = cloneContract();
		(badPlp.recipes.plp as { variantId: string }).variantId = 'kibble.error.reference-shell';
		expect(KibbleReferenceContractSchema.safeParse(badPlp).success).toBe(false);

		const badError = cloneContract();
		(badError.recipes.error as { implementation: string }).implementation = 'KibbleFooter.svelte';
		expect(KibbleReferenceContractSchema.safeParse(badError).success).toBe(false);
	});

	it('matches the independently hard-coded 28-zone union exactly', () => {
		const expected = [
			'home.hero', 'home.featured-row', 'home.editorial-strip', 'home.brand-spotlight', 'home.below-fold',
			'plp.banner', 'plp.editorial-header', 'plp.cluster-row', 'plp.between-thirds', 'plp.below-grid', 'plp.empty-state',
			'pdp.below-description', 'pdp.related', 'pdp.cross-sell', 'pdp.recently-viewed', 'pdp.below-recs',
			'cart.above-checkout-cta', 'cart.below-fold', 'cart.empty-state',
			'checkout.assurance-strip', 'checkout.last-chance-upsell', 'search.empty-state', 'search.zero-results-rescue',
			'account.welcome', 'account.dashboard-pick', 'locator.editorial-intro', 'error-404.rescue', 'error-empty.rescue',
		];
		expect(KIBBLE_CANONICAL_UNION_ZONE_IDS).toEqual(expected);
		expect(KIBBLE_REFERENCE_CONTRACT.unionZoneCoverage.map(({ id }) => id)).toEqual(expected);

		const renamed = cloneContract();
		(renamed.unionZoneCoverage[10] as { id: string }).id = 'plp.empty';
		expect(KibbleReferenceContractSchema.safeParse(renamed).success).toBe(false);
		const substituted = cloneContract();
		(substituted.unionZoneCoverage[15] as { id: string }).id = 'pdp.below-recommendations';
		expect(KibbleReferenceContractSchema.safeParse(substituted).success).toBe(false);
		const duplicated = cloneContract();
		(duplicated.unionZoneCoverage[18] as { id: string }).id = 'cart.below-fold';
		expect(KibbleReferenceContractSchema.safeParse(duplicated).success).toBe(false);
	});

	it('pins complete route dependency classifications and rejects independent mutations', () => {
		const closures = {
			search: KIBBLE_SEARCH_SOURCE_CLOSURE,
			cart: KIBBLE_CART_SOURCE_CLOSURE,
			account: KIBBLE_ACCOUNT_SOURCE_CLOSURE,
			checkout: KIBBLE_CHECKOUT_SOURCE_CLOSURE,
			subscriptions: KIBBLE_SUBSCRIPTIONS_SOURCE_CLOSURE,
		} as const;
		const hardCodedFirstHashes = {
			search: '61a9fcb709b4cb9b4482e70df54ca805d98057f664b6864c80bcdce7a0c5fa99',
			cart: '2940a76fb4a3fb5d49cfb5325497833060312af6ab184e840c97c8986675a768',
			account: '1addd8ff2da26b481e24a7cffde1ec5b9b2b9c6737c3b1a318a10cc53a512d38',
			checkout: '3cb7b0b58389fcf1e30e8843046e4ab8f72436027292bcdad3bbb7dd007ca39b',
			subscriptions: '7430e47767c479480b4cf04231543f00985b42c32810a989c402b013c6e94f92',
		};
		for (const [surface, expected] of Object.entries(closures)) {
			const recipe = KIBBLE_REFERENCE_CONTRACT.recipes[surface as keyof typeof closures];
			expect(recipe.acceptance).toBe('pending-parity');
			expect(recipe.source.dependencyClosure).toEqual(expected);
			expect(recipe.source.dependencyClosure.adapted[0].sha256).toBe(hardCodedFirstHashes[surface as keyof typeof hardCodedFirstHashes]);
			for (const root of recipe.source.dependencyClosure.roots) {
				const classified = [
					...recipe.source.dependencyClosure.adapted.map(({ path }) => path),
					...recipe.source.dependencyClosure.excluded.map(({ module }) => module),
				];
				expect(classified).toContain(root);
			}
		}

		const changedHash = cloneContract();
		(changedHash.recipes.search.source.dependencyClosure.adapted[0] as { sha256: string }).sha256 = '0'.repeat(64);
		expect(KibbleReferenceContractSchema.safeParse(changedHash).success).toBe(false);
		const changedReason = cloneContract();
		(changedReason.recipes.cart.source.dependencyClosure.excluded[0] as { reason: string }).reason = 'Temporary';
		expect(KibbleReferenceContractSchema.safeParse(changedReason).success).toBe(false);
		const changedInvariant = cloneContract();
		(changedInvariant.recipes.checkout.source.dependencyClosure.excluded[0] as { invariant: string }).invariant = 'Later';
		expect(KibbleReferenceContractSchema.safeParse(changedInvariant).success).toBe(false);
		const unclassifiedRoot = cloneContract();
		unclassifiedRoot.recipes.subscriptions.source.dependencyClosure.excluded.splice(0, 1);
		expect(KibbleReferenceContractSchema.safeParse(unclassifiedRoot).success).toBe(false);
	});
});
