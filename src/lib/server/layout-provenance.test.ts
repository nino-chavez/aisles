import { describe, expect, it } from 'vitest';
import type { Layout } from '$lib/schema/layout';
import { layoutCacheKey, parseCachedLayoutValue } from './cache';
import {
	buildContractedLayoutProvenance,
	buildLegacyLayoutProvenance,
	canonicalSerialize,
	LayoutProvenanceSchema,
	stableHash,
	type BuildLegacyLayoutProvenanceInput,
} from './layout-provenance';
import { getContractSurfaceDecision } from '$lib/brand/composition-policy';

const baseInput: BuildLegacyLayoutProvenanceInput = {
	brand: { organizationId: 'merchant-one', id: 'brand-one' },
	surface: 'plp',
	route: '/category/dog-food',
	persona: 'researcher',
	promptVersion: 'v5',
	schemaVersion: 'legacy-layout-schema-v1',
	prompt: 'prompt one',
	catalogInput: [{ id: 'product-one', price: 10 }],
	shopperContext: { persona: 'researcher', probabilities: { researcher: 0.8 } },
	picksContext: 'product-one',
	incentiveContext: { wallet: 100 },
	scenarioId: null,
};

const validLayout: Layout = {
	persona: 'researcher',
	reasoning: 'A compact comparison layout.',
	sections: [
		{ component: 'category-header', props: { title: 'Dog Food', showSort: true, showFilter: true } },
		{
			component: 'product-grid',
			props: {
				columns: 3,
				products: [],
				imageRatio: 'square',
				showDescription: true,
				showSpecs: true,
				showQuickAdd: false,
			},
		},
	],
	productOrder: [],
};

function build(overrides: Partial<BuildLegacyLayoutProvenanceInput> = {}) {
	return buildLegacyLayoutProvenance({ ...baseInput, ...overrides });
}

describe('layout provenance and cache identity', () => {
	it('canonically serializes and hashes equivalent object input', () => {
		expect(canonicalSerialize({ b: 2, a: { d: 4, c: 3 } })).toBe(
			canonicalSerialize({ a: { c: 3, d: 4 }, b: 2 }),
		);
		expect(stableHash({ b: 2, a: 1 })).toBe(stableHash({ a: 1, b: 2 }));
	});

	it.each([
		['organization', { brand: { organizationId: 'merchant-two', id: 'brand-one' } }],
		['brand', { brand: { organizationId: 'merchant-one', id: 'brand-two' } }],
		['route and surface', { surface: 'home' as const, route: '/' }],
		['catalog', { catalogInput: [{ id: 'product-two', price: 10 }] }],
		['input prompt', { prompt: 'prompt two' }],
		['shopper context', { shopperContext: { persona: 'hunter' } }],
		['picks', { picksContext: 'product-two' }],
		['incentive', { incentiveContext: { wallet: 200 } }],
		['synthetic scenario', { scenarioId: 'first-time-puppy-owner' }],
	] as const)('isolates the cache key by %s', (_label, overrides) => {
		expect(layoutCacheKey(build(overrides))).not.toBe(layoutCacheKey(build()));
	});

	it('isolates reference, policy, and autonomy identities', () => {
		const base = build();
		const contracted = LayoutProvenanceSchema.parse({
			...base,
			reference: { status: 'contracted', id: 'kibble-shelf-native', version: '1.1.0' },
		});
		const policy = LayoutProvenanceSchema.parse({ ...base, policyVersion: 'policy-v2' });
		const preset = LayoutProvenanceSchema.parse({
			...base,
			autonomy: {
				...base.autonomy,
				preset: 'assist',
				effectiveCapabilities: ['rank_products', 'select_products'],
				decisionMode: 'rules',
				publicationMode: 'approval_required',
			},
		});

		for (const candidate of [contracted, policy, preset]) {
			expect(layoutCacheKey(candidate)).not.toBe(layoutCacheKey(base));
		}
	});

	it('records the truthful responsive viewport and rejects fabricated viewport variants', () => {
		const provenance = build();
		expect(layoutCacheKey(provenance)).toContain(':viewport:responsive:');
		expect(LayoutProvenanceSchema.safeParse({ ...provenance, viewportClass: 'mobile' }).success).toBe(false);
	});

	it('builds contracted Preserve provenance only from compiled reference policy', () => {
		const decision = getContractSurfaceDecision('kibble', 'home');
		if (decision.mode !== 'reference-preserve') throw new Error('expected Preserve');
		const provenance = buildContractedLayoutProvenance({
			policy: decision.policy,
			surface: 'home', route: '/', persona: 'gatherer',
			rendererComponentId: 'kibble.home', rendererVariantId: 'kibble-home-reference-v1',
			decisionSource: 'rules', promptVersion: 'no-model', schemaVersion: 'kibble-reference-1.4.0',
			contractInput: { recipe: 'home' }, catalogInput: [{ id: 'one' }], shopperContext: { persona: 'gatherer' },
		});
		expect(provenance).toMatchObject({
			reference: { status: 'contracted', id: 'kibble-shelf-native', version: '1.4.0' },
			autonomy: { preset: 'preserve', decisionMode: 'rules', publicationMode: 'live' },
			decisionSource: 'rules',
		});
	});

	it('preserves a validated envelope and rejects old or corrupted cache values', () => {
		const provenance = build();
		expect(parseCachedLayoutValue({ layout: validLayout, provenance })).toEqual({ layout: validLayout, provenance });
		expect(parseCachedLayoutValue(validLayout)).toBeNull();
		expect(parseCachedLayoutValue({ layout: { sections: [] }, provenance })).toBeNull();
		expect(parseCachedLayoutValue({ layout: validLayout, provenance: { ...provenance, inputHash: 'bad' } })).toBeNull();
	});
});
