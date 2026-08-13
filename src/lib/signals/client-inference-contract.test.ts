import { describe, expect, it } from 'vitest';
import { infer } from './inference';
import { parseConfirmedSignalBatch, parsePersonaInference } from './client-inference-contract';
import { SignalStore } from './store';

function actualInference(query = 'budget sale discount') {
	const store = new SignalStore(`contract-test-${query}`);
	store.setBrandId('kibble');
	store.emit('nav.search', 'navigation', { query });
	return infer(store.toInferenceContext());
}

describe('client inference contract', () => {
	it('accepts the actual server inference output and exact batch count', () => {
		const inference = actualInference();
		expect(parsePersonaInference(inference)).toEqual(inference);
		expect(parseConfirmedSignalBatch({ received: 1, inference }, 1)).toEqual({ received: 1, inference });
		expect(parseConfirmedSignalBatch({ received: 1, inference: null }, 1)).toEqual({ received: 1, inference: null });
	});

	it('accepts the producer output across all four deterministic search personas', () => {
		for (const query of [
			'cozy inspiration ideas',
			'budget sale discount',
			'compare best reviews',
			'birthday gift present',
		]) {
			const inference = actualInference(query);
			expect(parsePersonaInference(inference), query).toEqual(inference);
		}
	});

	it('rejects extra authority-shaped fields and undeclared adjustment keys', () => {
		const inference = actualInference();
		expect(parsePersonaInference({ ...inference, approved: true })).toBeNull();
		expect(parsePersonaInference({
			...inference,
			ruleMatches: inference.ruleMatches.map((match, index) => index === 0
				? { ...match, adjustment: { ...match.adjustment, adminOverride: 1 } }
				: match),
		})).toBeNull();
	});

	it('rejects invalid probability, modifier, confidence, and count invariants', () => {
		const inference = actualInference();
		expect(parsePersonaInference({ ...inference, probabilities: { ...inference.probabilities, hunter: 2 } })).toBeNull();
		expect(parsePersonaInference({ ...inference, modifiers: { ...inference.modifiers, urgency: -0.1 } })).toBeNull();
		expect(parsePersonaInference({ ...inference, confidence: 0.99 })).toBeNull();
		expect(parsePersonaInference({ ...inference, signalCount: inference.signalCount + 1 })).toBeNull();
		expect(parseConfirmedSignalBatch({ received: 2, inference }, 1)).toBeNull();
	});

	it('rejects inconsistent entropy, certainty, shift, duplicates, missing keys, and non-finite values', () => {
		const inference = actualInference();
		expect(parsePersonaInference({ ...inference, entropy: inference.entropy + 0.01 })).toBeNull();
		expect(parsePersonaInference({ ...inference, certainty: inference.certainty - 0.01 })).toBeNull();
		expect(parsePersonaInference({ ...inference, shift: { detected: false, from: 'gatherer', trigger: null } })).toBeNull();
		expect(parsePersonaInference({ ...inference, ruleMatches: [inference.ruleMatches[0], inference.ruleMatches[0]], signalCount: 2 })).toBeNull();
		const { certainty: _certainty, ...missingCertainty } = inference;
		expect(parsePersonaInference(missingCertainty)).toBeNull();
		expect(parsePersonaInference({ ...inference, confidence: Number.NaN })).toBeNull();
	});
});
