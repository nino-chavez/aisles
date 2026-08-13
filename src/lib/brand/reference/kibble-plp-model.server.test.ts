import { describe, expect, it } from 'vitest';
import { buildKibblePlpModelPrompt, buildKibblePlpProviderOutputSchema, hashKibblePlpRankingInput } from './kibble-plp-model.server';

const products = Array.from({ length: 8 }, (_, index) => ({ entityId: index + 1, name: `Food ${index + 1}`, category: 'Dog Food', price: index + 10 }));
const inference = { primary: 'researcher', probabilities: { gatherer: 0.1, hunter: 0.1, researcher: 0.7, gifter: 0.1 } } as any;

describe('Kibble PLP model boundary', () => {
	it('uses an Anthropic-compatible provider schema then requires a strict server-side prefix permutation', () => {
		const schema = buildKibblePlpProviderOutputSchema(products);
		expect(schema.safeParse({ rankedProductIds: ['8', '7', '6', '5', '4', '3', '2', '1'] }).success).toBe(true);
		expect(schema.safeParse({ rankedProductIds: ['8', '8'] }).success).toBe(true); // provider subset intentionally has no generic min/max/unique keywords
		expect(schema.safeParse({ rankedProductIds: ['9'] }).success).toBe(false);
		expect(JSON.stringify(schema)).not.toMatch(/minItems|maxItems/);
	});
	it('does not describe route, sort, cursor, tail, cards, or layout as model authority', () => {
		const prompt = buildKibblePlpModelPrompt(inference, products);
		expect(prompt).toContain('first eight');
		for (const forbiddenAuthority of ['category, sort, cursor', 'layout, CSS, prices, links, or actions']) expect(prompt).toContain(forbiddenAuthority);
		expect(prompt).not.toContain('Food 9');
	});
	it('hashes only the original server-owned route state, not the model permutation', () => {
		const inputHash = hashKibblePlpRankingInput(['1', '2', '3'], ['4', '5']);
		expect(inputHash).toMatch(/^[0-9a-f]{64}$/);
		expect(hashKibblePlpRankingInput(['3', '2', '1'], ['4', '5'])).not.toBe(inputHash);
		expect(hashKibblePlpRankingInput(['1', '2', '3'], ['5', '4'])).not.toBe(inputHash);
	});
	const unsafeCandidates: Array<Array<{ entityId: number }>> = [[], products.slice(0, 2), [...products, { entityId: 9 }], [...products.slice(0, 7), products[6]!]];
	it.each(unsafeCandidates.map((candidate) => [candidate]))('rejects unsafe prefix candidates', (candidate) => {
		expect(() => buildKibblePlpProviderOutputSchema(candidate)).toThrow();
	});
});
