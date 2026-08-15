import { describe, expect, it } from 'vitest';
import { Output } from 'ai';
import type { PersonaInference } from '$lib/signals/types';
import {
	buildKibbleHomeModelPrompt,
	buildKibbleHomeProviderOutputSchema,
} from './kibble-home-model.server';
import { getKibbleCatalogSignals } from './kibble-catalog-enrichment';

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
	it('contains only approved facts and merchant presentation IDs', () => {
		const prompt = buildKibbleHomeModelPrompt(inference, [{
			id: 'food-a', entityId: 3023, name: 'Food A', price: 24, image: 'https://example.com/a.jpg',
			imageAlt: 'Food A', description: 'Private catalog description', specs: { secret: 'withheld' },
			tags: ['private-tag'], category: 'dog-food', personaFit: { gatherer: 0.1, hunter: 0.2, researcher: 0.9, gifter: 0.1 },
			catalogSignals: getKibbleCatalogSignals(3023),
		}], {
			hero: { eyebrow: 'Live eyebrow', headline: 'Live headline', body: 'Live body' },
			featuredCopy: { eyebrow: 'Catalog', title: 'New arrivals', browseAllLabel: 'Browse Dog Food' },
			catalogCopy: { eyebrow: 'Browse', title: 'Shop by category' },
		});
		expect(prompt).toContain('3023 | Food A | dog-food | USD 24.00 | researcher fit 0.900');
		expect(prompt).toContain('capabilities: subscribe-and-save, intro-offer | save 15% | cadence 1/2/3');
		expect(prompt).toContain('role: consumable | category source: pinned-seed');
		expect(prompt).toContain('offer projection: pinned Auto-Refill | canonical storefront registry: listed');
		expect(prompt).toContain('shopper job: Choose an everyday nutrition routine');
		expect(prompt).toContain('compare: protein, life stage, food format, diet needs, replenishment');
		expect(prompt).toContain('Return every supplied product ID exactly once, plus one ID for every approved presentation field.');
		expect(prompt).toContain('heroCopyVariantId: merchant-baseline=');
		expect(prompt).toContain('visit-fast-path=');
		expect(prompt).toContain('compare-with-context=');
		expect(prompt).toContain('featuredCopyVariantId: merchant-baseline=Catalog / New arrivals / Browse Dog Food');
		expect(prompt).toContain('Do not write prose');
		for (const forbidden of ['raw shopper search', 'Private catalog description', 'private-tag', 'withheld', 'https://example.com/a.jpg']) {
			expect(prompt).not.toContain(forbidden);
		}
	});

	it('gives the provider an exact product enum without Anthropic-unsupported array bounds', async () => {
		const schema = buildKibbleHomeProviderOutputSchema([
			{ entityId: 3023 },
			{ entityId: 3024 },
			{ entityId: 3025 },
		]);
		const decision = { rankedProductIds: ['3025', '3023', '3024'], heroCopyVariantId: 'visit-fast-path', featuredCopyVariantId: 'visit-start', catalogCopyVariantId: 'routine-builder', catalogComponentVariantId: 'two-column', sectionOrderId: 'catalog-then-featured' };
		expect(schema.safeParse(decision).success).toBe(true);
		expect(schema.safeParse({ rankedProductIds: ['3025', 'outside-catalog'] }).success).toBe(false);
		expect(schema.safeParse({ ...decision, heroCopyVariantId: 'model-authored' }).success).toBe(false);
		expect(schema.safeParse({ ...decision, copy: 'model-authored' }).success).toBe(false);
		const responseFormat = await Output.object({ schema }).responseFormat;
		expect(JSON.stringify(responseFormat)).not.toContain('maxItems');
		expect(JSON.stringify(responseFormat)).toContain('"enum":["3023","3024","3025"]');
		expect(() => buildKibbleHomeProviderOutputSchema([])).toThrow(/one to eight unique/);
	});
});
