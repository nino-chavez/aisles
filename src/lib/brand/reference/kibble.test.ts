import { describe, expect, it } from 'vitest';
import { KIBBLE_REFERENCE_CONTRACT, KibbleReferenceContractSchema } from './kibble';

function cloneContract(): unknown {
	return structuredClone(KIBBLE_REFERENCE_CONTRACT);
}

function remove(path: Array<string | number>): unknown {
	const candidate = cloneContract() as Record<string, unknown>;
	let cursor: unknown = candidate;
	for (const key of path.slice(0, -1)) {
		cursor = (cursor as Record<string | number, unknown>)[key];
	}
	delete (cursor as Record<string | number, unknown>)[path.at(-1)!];
	return candidate;
}

describe('Kibble reference contract', () => {
	it('pins the approved source revision and locked Shelf-Native artifacts', () => {
		expect(KIBBLE_REFERENCE_CONTRACT.source).toEqual({
			repository: 'bc-subscriptions',
			remote: 'git@github.com:nino-chavez/bc-subscriptions.git',
			commit: 'a5c9555b89d72e7898d6bc1c38c7157a1c415b06',
			applicationPath: 'apps/storefront-svelte',
			brandKitPath: 'scripts/kibble-demo/data/brand/brand-kit.md',
			tokensPath: 'scripts/kibble-demo/data/brand/tokens.css',
			canonicalBoundary: expect.stringContaining('pinned storefront source'),
		});
	});

	it.each([
		['source commit', ['source', 'commit']],
		['semantic action token', ['tokens', 'colors', 'action']],
		['component permitted props', ['components', 0, 'permittedProps']],
		['home recipe anatomy', ['recipes', 'home', 'orderedAnatomy']],
	] as const)('rejects a contract missing %s', (_label, path) => {
		expect(KibbleReferenceContractSchema.safeParse(remove([...path])).success).toBe(false);
	});

	it('locks the semantic palette instead of accepting generic brand aliases', () => {
		expect(KIBBLE_REFERENCE_CONTRACT.tokens.colors).toMatchObject({
			identity: '#1e2150',
			action: '#3b5bd0',
			autoRefill: '#37bfa2',
		});
		expect(KIBBLE_REFERENCE_CONTRACT.ownership.forbiddenAtRuntime).toContain(
			'inventing CSS',
		);
	});

	it('asserts the reference homepage anatomy in order', () => {
		expect(
			KIBBLE_REFERENCE_CONTRACT.recipes.home.orderedAnatomy.map(
				({ slot, component, variant, required }) => ({ slot, component, variant, required }),
			),
		).toEqual([
			{ slot: 'merchant-chrome', component: 'kibble.header', variant: 'desktop+mobile-drawer', required: true },
			{ slot: 'opening-merchandising', component: 'kibble.hero', variant: 'flagship-bundle', required: true },
			{ slot: 'ranked-products', component: 'kibble.featured-grid', variant: 'four-column', required: true },
			{ slot: 'catalog-entry', component: 'kibble.visual-module', variant: 'category', required: true },
			{ slot: 'service-proof', component: 'kibble.service-proof', variant: 'three-column', required: true },
		]);
	});

	it('rejects recipe slots that name unregistered components', () => {
		const candidate = cloneContract() as typeof KIBBLE_REFERENCE_CONTRACT;
		candidate.recipes.home.orderedAnatomy[0].component = 'kibble.unknown';
		expect(KibbleReferenceContractSchema.safeParse(candidate).success).toBe(false);
	});

	it('rejects recipe slots that request an unregistered component variant', () => {
		const candidate = cloneContract() as typeof KIBBLE_REFERENCE_CONTRACT;
		candidate.recipes.home.orderedAnatomy[1].variant = 'invented-layout';
		expect(KibbleReferenceContractSchema.safeParse(candidate).success).toBe(false);
	});
});
