import { describe, expect, it } from 'vitest';
import {
	buildPresentationDecisionEvidence,
	describePresentationDecisionOutcome,
	hasPresentationDecisionChanged,
} from './presentation-evidence';

const products = [{ id: 'one', name: 'Product One' }, { id: 'two', name: 'Product Two' }];
const baseline = { copy: [{ id: 'headline', label: 'Headline', value: 'Start here' }], components: [], sections: [], marketingBlocks: [] };

describe('generic presentation decision evidence', () => {
	it('records moved, added, removed, unchanged, and changed presentation fields', () => {
		const evidence = buildPresentationDecisionEvidence({
			surface: 'plp', zoneId: 'plp.product-ranking', zoneLabel: 'Product ranking', policyVersion: 'plp-v1',
			before: products, after: [{ id: 'two', name: 'Product Two' }, { id: 'three', name: 'Product Three' }],
			provider: 'anthropic', model: 'claude-haiku-4-5', calls: 1, state: 'applied',
			presentationBefore: baseline,
			presentationAfter: { ...baseline, copy: [{ id: 'headline', label: 'Headline', value: 'Compare first' }] },
		});
		expect(evidence.moved.map(({ id }) => id)).toEqual(['two']);
		expect(evidence.added.map(({ id }) => id)).toEqual(['three']);
		expect(evidence.removed.map(({ id }) => id)).toEqual(['one']);
		expect(evidence.unchanged).toEqual([]);
		expect(evidence.outcome).toBe('changed');
		expect(hasPresentationDecisionChanged(evidence)).toBe(true);
	});

	it('makes the unchanged outcome explicit for a model call that keeps the baseline', () => {
		const evidence = buildPresentationDecisionEvidence({
			surface: 'pdp', zoneId: 'pdp.related', zoneLabel: 'Related products', policyVersion: 'pdp-v1',
			before: products, after: products, provider: 'anthropic', model: 'claude-haiku-4-5', calls: 1, state: 'applied',
			presentationBefore: baseline, presentationAfter: baseline,
		});
		expect(evidence.outcome).toBe('kept');
		expect(describePresentationDecisionOutcome(evidence)).toBe('AI kept the existing presentation.');
	});
});
