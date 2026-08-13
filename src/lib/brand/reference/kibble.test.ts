import { describe, expect, it } from 'vitest';
import {
	KIBBLE_PDP_BUNDLE_PROJECTION_SHA256,
	KIBBLE_PDP_CANONICAL_SOURCE_FILES,
	KIBBLE_REFERENCE_CONTRACT,
	KibbleReferenceContractSchema,
} from './kibble';
import { KIBBLE_PLP_GRAPHQL_SORT } from './kibble-plp';

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
		expect(KIBBLE_REFERENCE_CONTRACT.source).toEqual({
			repository: 'bc-subscriptions', remote: 'git@github.com:nino-chavez/bc-subscriptions.git',
			commit: 'ef122b8e17b9eb0b327c9d42491c44a61577ead4', applicationPath: 'apps/storefront-svelte',
			brandKitPath: 'scripts/kibble-demo/data/brand/brand-kit.md', tokensPath: 'scripts/kibble-demo/data/brand/tokens.css',
			fixturePath: 'scripts/kibble-demo/data/seed-output.json', fixtureSha256: '833824a875f1fbe83a5d1d9164f521aa38e64e3902d22623a6af1b8cad84fe49',
			canonicalBoundary: expect.stringContaining('pinned storefront source'),
		});
	});

	it.each([
		['source commit', ['source', 'commit']],
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
		expect(KIBBLE_REFERENCE_CONTRACT.recipes.home.acceptance).toBe('approved');
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

	it('pins the full PLP request and rendering contract', () => {
		expect(KIBBLE_REFERENCE_CONTRACT.recipes.plp).toMatchObject({
			source: { commit: 'ef122b8e17b9eb0b327c9d42491c44a61577ead4' },
			orderedAnatomy: ['breadcrumbs', 'category-header', 'sort-control', 'product-grid', 'cursor-continuation'],
			defaultSort: 'FEATURED', pageSize: 24,
			pagination: { strategy: 'forward-cursor', cursorParam: 'after', actionLabel: 'Load more' },
			productCards: 'noninteractive-until-pdp-approved', modelLayoutRequest: false,
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
			acceptance: 'implemented-pending-visual-approval',
			source: { commit: 'ef122b8e17b9eb0b327c9d42491c44a61577ead4' },
			orderedAnatomy: ['breadcrumbs', 'media-gallery', 'product-identity', 'conditional-bundle-summary', 'catalog-price-and-availability', 'conditional-bundle-contents', 'catalog-options', 'merchant-approved-purchase-unavailable', 'description-and-specifications', 'related-products'],
			commerce: { mode: 'catalog-display-only', sourcePurchaseControls: 'not-rendered-in-aisles', visibleState: 'merchant-approved-purchase-unavailable' },
			publication: { mode: 'approval-required', reviewAvailability: 'development-build-only', productLinks: 'disabled-until-approved' },
			modelLayoutRequest: false,
		});
		expect(KIBBLE_REFERENCE_CONTRACT.recipes.pdp.source.files).toEqual(KIBBLE_PDP_CANONICAL_SOURCE_FILES);
		expect(KIBBLE_REFERENCE_CONTRACT.recipes.pdp.bundleProjection).toEqual({
			sourcePath: 'apps/storefront-svelte/src/lib/brand/bundle-contents.json',
			serialization: 'canonical-json-v1',
			bundleCount: 8,
			sha256: KIBBLE_PDP_BUNDLE_PROJECTION_SHA256,
		});
		expect(new Set([
			KIBBLE_REFERENCE_CONTRACT.source.commit,
			KIBBLE_REFERENCE_CONTRACT.recipes.plp.source.commit,
			KIBBLE_REFERENCE_CONTRACT.recipes.pdp.source.commit,
		])).toEqual(new Set(['ef122b8e17b9eb0b327c9d42491c44a61577ead4']));
		expect(KIBBLE_REFERENCE_CONTRACT.recipes.pdp.commerce.forbidden).toContain('add-to-cart');
		expect(KIBBLE_REFERENCE_CONTRACT.recipes.pdp.commerce.forbidden).toContain('subscription');
	});

	it('rejects PDP source, projection, and cross-contract provenance tampering', () => {
		const badSourceHash = cloneContract();
		(badSourceHash.recipes.pdp.source.files[0] as { sha256: string }).sha256 = '0'.repeat(64);
		expect(KibbleReferenceContractSchema.safeParse(badSourceHash).success).toBe(false);

		const badProjectionHash = cloneContract();
		(badProjectionHash.recipes.pdp.bundleProjection as { sha256: string }).sha256 = 'f'.repeat(64);
		expect(KibbleReferenceContractSchema.safeParse(badProjectionHash).success).toBe(false);

		const mismatchedCanonicalCommit = cloneContract();
		(mismatchedCanonicalCommit.source as { commit: string }).commit = 'a'.repeat(40);
		expect(KibbleReferenceContractSchema.safeParse(mismatchedCanonicalCommit).success).toBe(false);

		const uncontractedSourceField = cloneContract();
		(uncontractedSourceField.recipes.pdp.source as unknown as Record<string, unknown>).unverified = true;
		expect(KibbleReferenceContractSchema.safeParse(uncontractedSourceField).success).toBe(false);
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
});
