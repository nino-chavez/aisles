import { describe, expect, it } from 'vitest';
import { KIBBLE_REFERENCE_CONTRACT, KibbleReferenceContractSchema } from './kibble';

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

describe('Kibble reference contract', () => {
	it('pins the approved source revision and locked Shelf-Native artifacts', () => {
		expect(KIBBLE_REFERENCE_CONTRACT.source).toEqual({
			repository: 'bc-subscriptions', remote: 'git@github.com:nino-chavez/bc-subscriptions.git',
			commit: 'a5c9555b89d72e7898d6bc1c38c7157a1c415b06', applicationPath: 'apps/storefront-svelte',
			brandKitPath: 'scripts/kibble-demo/data/brand/brand-kit.md', tokensPath: 'scripts/kibble-demo/data/brand/tokens.css',
			canonicalBoundary: expect.stringContaining('pinned storefront source'),
		});
	});

	it.each([
		['source commit', ['source', 'commit']],
		['semantic action token', ['tokens', 'colors', 'action']],
		['full component variants', ['components', 0, 'variants']],
		['home recipe anatomy', ['recipes', 'home', 'orderedAnatomy']],
	] as const)('rejects a contract missing %s', (_label, path) => {
		expect(KibbleReferenceContractSchema.safeParse(remove([...path])).success).toBe(false);
	});

	it('requires the exact unique chrome anatomy and root-layout owner', () => {
		expect(KIBBLE_REFERENCE_CONTRACT.chrome.required).toEqual([
			'engine-status-bar', 'merchant-wordmark', 'catalog-navigation', 'search-control',
			'account-control', 'cart-control', 'mobile-drawer',
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

	it('separates root chrome from the home component anatomy', () => {
		const anatomy = KIBBLE_REFERENCE_CONTRACT.recipes.home.orderedAnatomy;
		expect(anatomy.map(({ slot, owner }) => ({ slot, owner }))).toEqual([
			{ slot: 'merchant-chrome', owner: 'root-layout' },
			{ slot: 'opening-merchandising', owner: 'home-recipe' },
			{ slot: 'ranked-products', owner: 'home-recipe' },
			{ slot: 'catalog-entry', owner: 'home-recipe' },
			{ slot: 'service-proof', owner: 'home-recipe' },
		]);
		expect(KIBBLE_REFERENCE_CONTRACT.recipes.home.rootLayoutChrome).toBe('kibble.header');
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
});
