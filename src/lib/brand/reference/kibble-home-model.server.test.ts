import { describe, expect, it } from 'vitest';
import type { PersonaInference } from '$lib/signals/types';
import { buildKibbleHomeModelPrompt } from './kibble-home-model.server';

const inference: PersonaInference = {
	primary: 'researcher',
	probabilities: { gatherer: 0.1, hunter: 0.1, researcher: 0.7, gifter: 0.1 },
	confidence: 0.6, entropy: 0.5, certainty: 0.6,
	modifiers: { priceSensitivity: 0.2, urgency: 0.3, familiarityWithStore: 0.4 },
	shift: { detected: true, from: 'gatherer', trigger: 'raw shopper search' },
	signalCount: 4, lastUpdated: 1, dominantSource: 'interaction',
	ruleMatches: [{ ruleName: 'search', weight: 1, adjustment: { researcher: 1 }, reason: 'raw shopper search' }],
};

describe('bounded Kibble Home model prompt', () => {
	it('contains only approved ranking facts and denies every visual or commerce axis', () => {
		const prompt = buildKibbleHomeModelPrompt(inference, [{
			id: 'food-a', entityId: 3023, name: 'Food A', price: 24, image: 'https://example.com/a.jpg',
			imageAlt: 'Food A', description: 'Private catalog description', specs: { secret: 'withheld' },
			tags: ['private-tag'], category: 'dog-food', personaFit: { gatherer: 0.1, hunter: 0.2, researcher: 0.9, gifter: 0.1 },
		}]);
		expect(prompt).toContain('3023 | Food A | dog-food | USD 24.00 | researcher fit 0.900');
		expect(prompt).toContain('Your only authority is rankedProductIds. Return every supplied product ID exactly once.');
		expect(prompt).toContain('Do not write copy. Do not choose layout, components, CSS, prices, claims, links, or actions.');
		for (const forbidden of ['raw shopper search', 'Private catalog description', 'private-tag', 'withheld', 'https://example.com/a.jpg']) {
			expect(prompt).not.toContain(forbidden);
		}
	});
});
