import { describe, expect, it } from 'vitest';
import { Output } from 'ai';
import type { PersonaInference } from '$lib/signals/types';
import { buildKibblePdpRelatedModelPrompt, buildKibblePdpRelatedProviderOutputSchema } from './kibble-pdp-related-model.server';

const inference: PersonaInference = {
	primary: 'researcher', probabilities: { gatherer: 0.1, hunter: 0.1, researcher: 0.7, gifter: 0.1 },
	confidence: 0.6, entropy: 0.5, certainty: 0.6,
	modifiers: { priceSensitivity: 0.2, urgency: 0.3, familiarityWithStore: 0.4 },
	shift: { detected: true, from: 'gatherer', trigger: 'private request value' }, signalCount: 4, lastUpdated: 1, dominantSource: 'interaction',
	ruleMatches: [],
};

describe('bounded Kibble PDP related-products model prompt', () => {
	it('offers only server-approved rank facts and denies every visible PDP axis', () => {
		const prompt = buildKibblePdpRelatedModelPrompt(inference, [
			{ entityId: 11, name: 'Starter Bundle', category: 'Bundles', price: 90 },
			{ entityId: 12, name: 'Dog Toy Kit', category: 'Toys', price: 32 },
			{ entityId: 13, name: 'Mealtime Kit', category: 'Care', price: 55 },
		]);
		expect(prompt).toContain('11 | Starter Bundle | Bundles | USD 90.00');
		expect(prompt).toContain('Your only authority is rankedProductIds. Return every supplied product ID exactly once.');
		expect(prompt).toContain('Do not write copy. Do not choose layout, components, CSS, prices, claims, links, or actions.');
		expect(prompt).not.toContain('private request value');
	});

	it('uses a provider-compatible enum then leaves exact permutation enforcement to the generic contract', async () => {
		const schema = buildKibblePdpRelatedProviderOutputSchema([{ entityId: 11 }, { entityId: 12 }, { entityId: 13 }]);
		expect(schema.safeParse({ rankedProductIds: ['13', '11', '12'] }).success).toBe(true);
		expect(schema.safeParse({ rankedProductIds: ['13', 'outside'] }).success).toBe(false);
		expect(schema.safeParse({ rankedProductIds: ['13', '11', '12'], copy: 'forbidden' }).success).toBe(false);
		const responseFormat = await Output.object({ schema }).responseFormat;
		expect(JSON.stringify(responseFormat)).not.toContain('maxItems');
		expect(() => buildKibblePdpRelatedProviderOutputSchema([{ entityId: 1 }, { entityId: 2 }])).toThrow(/three to four unique/);
	});
});
