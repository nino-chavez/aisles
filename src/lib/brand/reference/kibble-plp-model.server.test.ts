import { describe, expect, it } from 'vitest';
import { buildKibblePlpModelPrompt, buildKibblePlpProviderOutputSchema } from './kibble-plp-model.server';
import { hashKibblePlpCandidateCatalog, hashKibblePlpRankingInput, sha256Hex } from './kibble-plp-ranking-boundary.server';

const products = Array.from({ length: 8 }, (_, index) => ({ entityId: index + 1, name: `Food ${index + 1}`, category: 'Dog Food', price: index + 10 }));
const inference = { primary: 'researcher', probabilities: { gatherer: 0.1, hunter: 0.1, researcher: 0.7, gifter: 0.1 } } as any;

describe('Kibble PLP model boundary', () => {
	it('uses an Anthropic-compatible provider schema then requires a strict server-side prefix permutation', () => {
		const schema = buildKibblePlpProviderOutputSchema(products);
		const presentation = { headerCopyVariantId: 'guided-start', marketingBlockVariantId: 'routine-builder' };
		expect(schema.safeParse({ rankedProductIds: ['8', '7', '6', '5', '4', '3', '2', '1'], ...presentation }).success).toBe(true);
		expect(schema.safeParse({ rankedProductIds: ['8', '8'], ...presentation }).success).toBe(true); // provider subset intentionally has no generic min/max/unique keywords
		expect(schema.safeParse({ rankedProductIds: ['9'] }).success).toBe(false);
		expect(schema.safeParse({ rankedProductIds: ['8', '7', '6', '5', '4', '3', '2', '1'], ...presentation, marketingBlockVariantId: 'outside' }).success).toBe(false);
		expect(JSON.stringify(schema)).not.toMatch(/minItems|maxItems/);
	});
	it('authorizes only the first-eight order and approved presentation IDs', () => {
		const prompt = buildKibblePlpModelPrompt(inference, products);
		expect(prompt).toContain('Approved prefix products');
		for (const forbiddenAuthority of ['category, sort, cursor', 'prices, links, actions, CSS']) expect(prompt).toContain(forbiddenAuthority);
		expect(prompt).toContain('headerCopyVariantId: merchant-baseline=');
		expect(prompt).toContain('guided-start=');
		expect(prompt).toContain('compare-first=');
		expect(prompt).not.toContain('Food 9');
	});
	it('hashes the immutable original route input and exact live candidate facts', () => {
		expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
		const inputHash = hashKibblePlpRankingInput(['1', '2', '3'], ['4', '5'], '/category/dog-food');
		expect(inputHash).toMatch(/^[0-9a-f]{64}$/);
		expect(hashKibblePlpRankingInput(['3', '2', '1'], ['4', '5'], '/category/dog-food')).not.toBe(inputHash);
		expect(hashKibblePlpRankingInput(['1', '2', '3'], ['5', '4'], '/category/dog-food')).not.toBe(inputHash);
		expect(hashKibblePlpRankingInput(['1', '2', '3'], ['4', '5'], '/category/treats')).not.toBe(inputHash);
		const catalogVersion = hashKibblePlpCandidateCatalog(products);
		expect(hashKibblePlpCandidateCatalog([...products.slice(0, 7), { ...products[7]!, price: 999 }])).not.toBe(catalogVersion);
	});
	const unsafeCandidates: Array<Array<{ entityId: number }>> = [[], products.slice(0, 2), [...products, { entityId: 9 }], [...products.slice(0, 7), products[6]!]];
	it.each(unsafeCandidates.map((candidate) => [candidate]))('rejects unsafe prefix candidates', (candidate) => {
		expect(() => buildKibblePlpProviderOutputSchema(candidate)).toThrow();
	});
});
