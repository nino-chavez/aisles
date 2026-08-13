import { describe, expect, it } from 'vitest';
import { getContractSurfaceDecision } from '../composition-policy';
import type { EffectiveCompositionPolicy } from '$lib/foundation/composition-policy';
import type { Persona, PersonaInference } from '$lib/signals/types';
import type { PersonaFitScores } from '$lib/server/enrichment/types';
import type { Product } from '$lib/types';
import { decideKibbleHome, KIBBLE_HOME_SHELF_CAPACITY, type KibbleHomeCandidateProduct } from './kibble-home-decision';

const policy = (): EffectiveCompositionPolicy => {
	const decision = getContractSurfaceDecision('kibble', 'home');
	if (decision.mode !== 'reference-preserve') throw new Error('Expected Kibble Preserve Home policy.');
	return decision.policy;
};

const inference = (primary: Persona): PersonaInference => ({
	primary,
	probabilities: {
		gatherer: primary === 'gatherer' ? 0.7 : 0.1,
		hunter: primary === 'hunter' ? 0.7 : 0.1,
		researcher: primary === 'researcher' ? 0.7 : 0.1,
		gifter: primary === 'gifter' ? 0.7 : 0.1,
	},
	confidence: 0.6,
	entropy: 0.9,
	certainty: 0.35,
	modifiers: { priceSensitivity: 0.2, urgency: 0.3, familiarityWithStore: 0.4 },
	shift: { detected: false, from: null, trigger: null },
	signalCount: 3,
	lastUpdated: 123,
	dominantSource: 'request',
	ruleMatches: [{
		ruleName: 'test-rule', weight: 1, adjustment: { [primary]: 0.4 }, reason: 'Test signal',
	}],
});

const fit = (values: Partial<PersonaFitScores>): PersonaFitScores => ({
	gatherer: 0, hunter: 0, researcher: 0, gifter: 0, ...values,
});

const product = (entityId: number, personaFit: PersonaFitScores | null = null): KibbleHomeCandidateProduct => ({
	id: `product-${entityId}`,
	entityId,
	name: `Product ${entityId}`,
	price: entityId,
	image: `https://example.com/${entityId}.png`,
	imageAlt: `Product ${entityId}`,
	description: '',
	specs: {},
	tags: [],
	category: 'Dog Food',
	personaFit,
});

describe('Kibble Preserve Home decision', () => {
	it('ranks the same merchant candidate set for each inferred primary persona', () => {
		const candidates = [
			product(1, fit({ gatherer: 0.9 })),
			product(2, fit({ hunter: 0.9 })),
			product(3, fit({ researcher: 0.9 })),
			product(4, fit({ gifter: 0.9 })),
		];
		for (const [persona, firstId] of [
			['gatherer', 1], ['hunter', 2], ['researcher', 3], ['gifter', 4],
		] as const) {
			const result = decideKibbleHome(policy(), inference(persona), candidates);
			expect(result.products[0].entityId).toBe(firstId);
			expect(result.inspector.inference.primary).toBe(persona);
			expect(result.inspector.inference.ruleMatches).toEqual(inference(persona).ruleMatches);
		}
	});

	it('keeps missing enrichment anchored and preserves merchant order for score ties', () => {
		const result = decideKibbleHome(policy(), inference('gatherer'), [
			product(1, fit({ gatherer: 0.2 })),
			product(2),
			product(3, fit({ gatherer: 0.9 })),
			product(4, fit({ gatherer: 0.2 })),
		]);
		expect(result.products.map(({ entityId }) => entityId)).toEqual([3, 2, 1, 4]);
		expect(result.inspector.dataSourceLabel).toBe('merchant-enrichment');

		const fallback = decideKibbleHome(policy(), inference('gatherer'), [product(4), product(2), product(3)]);
		expect(fallback.products.map(({ entityId }) => entityId)).toEqual([4, 2, 3]);
		expect(fallback.inspector.dataSourceLabel).toBe('merchant-order-fallback');
		expect(fallback.inspector.zones.find(({ id }) => id === 'ranked-products')?.changed).toBe(false);
	});

	it('excludes the pinned bundle, deduplicates merchant ids, and selects no more than shelf capacity', () => {
		const candidates = [
			product(3065, fit({ gatherer: 1 })),
			...Array.from({ length: 10 }, (_, index) => product(index + 1, fit({ gatherer: (index + 1) / 10 }))),
			product(10, fit({ gatherer: 1 })),
		];
		const result = decideKibbleHome(policy(), inference('gatherer'), candidates);
		expect(result.products).toHaveLength(KIBBLE_HOME_SHELF_CAPACITY);
		expect(result.products.map(({ entityId }) => entityId)).toEqual([10, 9, 8, 7, 6, 5, 4, 3]);
		expect(result.products.some(({ entityId }) => entityId === 3065)).toBe(false);
		expect(new Set(result.products.map(({ entityId }) => entityId)).size).toBe(result.products.length);
	});

	it('rejects missing, expanded, or otherwise unauthorized Home policy', () => {
		const trusted = policy();
		for (const capabilities of [
			['rank_products'],
			['rank_products', 'select_products', 'toggle_zone'],
			['rank_products', 'rank_products'],
		] as const) {
			expect(() => decideKibbleHome(
				{ ...trusted, capabilities },
				inference('gatherer'),
				[product(1)],
			)).toThrow('capabilities');
		}
		expect(() => decideKibbleHome(
			{ ...trusted, decisionMode: 'model' },
			inference('gatherer'),
			[product(1)],
		)).toThrow('decision envelope');
		expect(() => decideKibbleHome(
			{ ...trusted, provenance: { ...trusted.provenance, surface: 'plp' } },
			inference('gatherer'),
			[product(1)],
		)).toThrow('identity');
		expect(() => decideKibbleHome(
			{ ...trusted, policyVersion: 'substituted-policy' },
			inference('gatherer'),
			[product(1)],
		)).toThrow('identity');
	});

	it('is deterministic and reports the fixed ordered anatomy with zero model calls', () => {
		const candidates = [product(2, fit({ researcher: 0.2 })), product(1, fit({ researcher: 0.8 }))];
		const first = decideKibbleHome(policy(), inference('researcher'), candidates);
		const second = decideKibbleHome(policy(), inference('researcher'), candidates);
		expect(first).toEqual(second);
		expect(first.inspector.zones.map(({ id }) => id)).toEqual([
			'merchant-chrome',
			'opening-merchandising',
			'ranked-products',
			'catalog-entry',
			'service-proof',
			'merchant-footer',
		]);
		expect(first.inspector.zones.map(({ label }) => label)).toEqual([
			'Root header', 'Opening hero', 'Ranked products', 'Catalog entry', 'Service proof', 'Root footer',
		]);
		expect(first.inspector.zones.every(({ modelCallStatus }) =>
			modelCallStatus.calls === 0 && modelCallStatus.authorized === false,
		)).toBe(true);
		expect(first.inspector.zones.find(({ id }) => id === 'ranked-products')).toMatchObject({
			authority: 'rules',
			componentVariant: 'kibble.featured-grid.four-column',
			capabilities: ['rank_products', 'select_products'],
			changed: true,
		});
		expect(first.inspector.zones.filter(({ id }) => id !== 'ranked-products'))
			.toEqual(expect.arrayContaining([
				expect.objectContaining({ authority: 'fixed', capabilities: [], changed: false }),
			]));
	});

	it('does not mutate candidate products or invent rendered ids', () => {
		const candidates: Product[] = [product(2), product(1)];
		const snapshot = structuredClone(candidates);
		const result = decideKibbleHome(policy(), inference('gifter'), candidates);
		expect(candidates).toEqual(snapshot);
		expect(result.products.every(({ entityId }) => candidates.some((candidate) => candidate.entityId === entityId))).toBe(true);
	});
});
