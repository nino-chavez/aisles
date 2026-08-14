import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PersonaInference } from '$lib/signals/types';

const mocks = vi.hoisted(() => ({ generateText: vi.fn() }));
vi.mock('ai', async (importOriginal) => ({ ...await importOriginal<typeof import('ai')>(), generateText: mocks.generateText }));
vi.mock('$lib/server/model', () => ({ model: (id: string) => ({ id }), withModelFallback: async (run: (id: string) => Promise<unknown>) => run('claude-test') }));

import { rankKibblePlpFirstEightWithModel } from './kibble-plp-model.server';
import { rankKibbleHomeWithModel } from './kibble-home-model.server';
import { rankKibblePdpRelatedWithModel } from './kibble-pdp-related-model.server';
import { chooseKibbleBoundedCopyWithModel } from './kibble-bounded-copy-model.server';
import { hashKibblePlpRankingInput } from './kibble-plp-ranking-boundary.server';
import { validateKibblePlpLivePreview } from '$lib/components/kibble/kibble-plp-live-preview';
import { KIBBLE_HOME_DEFAULT_PRESENTATION, KIBBLE_PDP_DEFAULT_PRESENTATION, KIBBLE_PLP_DEFAULT_PRESENTATION, KIBBLE_PLP_PRESENTATION_POLICY } from './kibble-presentation-decisions';

const inference: PersonaInference = {
	primary: 'researcher', probabilities: { gatherer: 0.1, hunter: 0.1, researcher: 0.7, gifter: 0.1 }, confidence: 0.6, entropy: 0.5, certainty: 0.6,
	modifiers: { priceSensitivity: 0, urgency: 0, familiarityWithStore: 0 }, shift: { detected: false, from: null, trigger: null }, signalCount: 1, lastUpdated: 1, dominantSource: 'request', ruleMatches: [],
};
const candidates = Array.from({ length: 10 }, (_, index) => ({ entityId: index + 1, name: `Food ${index + 1}`, category: 'Dog Food', price: index + 10 }));

describe('Kibble PLP runner to adapter to client', () => {
	beforeEach(() => mocks.generateText.mockReset());
	it('composes one validated model action into the exact prefix-only client preview', async () => {
		mocks.generateText.mockResolvedValueOnce({ modelId: 'claude-test', result: { output: { rankedProductIds: ['8', '7', '6', '5', '4', '3', '2', '1'], ...KIBBLE_PLP_DEFAULT_PRESENTATION }, usage: { inputTokens: 1, outputTokens: 1 } } });
		const result = await rankKibblePlpFirstEightWithModel({ inference, prefix: candidates.slice(0, 8), tail: candidates.slice(8), routePath: '/category/dog-food' });
		expect(result.modelCallCount).toBe(1);
		expect(result.zoneAdapter.modelCallCount).toBe(1);
		const prefixIds = candidates.slice(0, 8).map(({ entityId }) => String(entityId));
		const tailIds = ['9', '10'];
		const preview = validateKibblePlpLivePreview({ version: 'kibble-plp-presentation-preview-v2', previewOnly: true, routePath: '/category/dog-food', sort: 'FEATURED', cursor: null, policyVersion: result.policy.policyVersion, reference: { id: 'kibble-shelf-native', version: '1.8.0' }, persona: 'researcher', prefixIds, tailIds, rankedPrefixIds: result.rankedPrefixIds, presentationPolicy: KIBBLE_PLP_PRESENTATION_POLICY, presentationDecision: result.presentationDecision, zoneAdapter: result.zoneAdapter, modelCallCount: result.modelCallCount, provider: 'anthropic', modelId: result.modelId, provenance: {} }, { routePath: '/category/dog-food', sort: 'FEATURED', cursor: null, policyVersion: result.policy.policyVersion, reference: { id: 'kibble-shelf-native', version: '1.8.0' }, prefixIds, tailIds, expectedInputSha256: hashKibblePlpRankingInput(prefixIds, tailIds, '/category/dog-food'), title: 'Dog Food', productCount: 10, productSingular: 'product', productPlural: 'products' }, candidates.map((candidate) => ({ id: String(candidate.entityId), ...candidate, image: '', imageAlt: '', description: '', specs: {}, tags: [] })));
		expect(preview?.products.map(({ entityId }) => entityId)).toEqual([8, 7, 6, 5, 4, 3, 2, 1, 9, 10]);
	});

	it('passes one action-scoped AbortSignal and output cap to Home, PDP, PLP, and narrow-funnel provider calls', async () => {
		mocks.generateText
			.mockResolvedValueOnce({ modelId: 'claude-test', result: { output: { rankedProductIds: ['1', '2', '3'], ...KIBBLE_HOME_DEFAULT_PRESENTATION }, usage: {} } })
			.mockResolvedValueOnce({ modelId: 'claude-test', result: { output: { rankedProductIds: ['1', '2', '3'], ...KIBBLE_PDP_DEFAULT_PRESENTATION }, usage: {} } })
			.mockResolvedValueOnce({ modelId: 'claude-test', result: { output: { rankedProductIds: ['3', '2', '1'], ...KIBBLE_PLP_DEFAULT_PRESENTATION }, usage: {} } })
			.mockResolvedValueOnce({ modelId: 'claude-test', result: { output: { copyVariantId: 'compare-first' }, usage: {} } });
		await rankKibbleHomeWithModel({ inference, products: candidates.slice(0, 3).map((candidate) => ({ id: String(candidate.entityId), ...candidate, image: '', imageAlt: '', description: '', specs: {}, tags: [], personaFit: { gatherer: 0.1, hunter: 0.1, researcher: 0.8, gifter: 0.1 } })) });
		await rankKibblePdpRelatedWithModel({ inference, products: candidates.slice(0, 3), routePath: '/product/puppy-starter-kit', heading: 'You may also like' });
		await rankKibblePlpFirstEightWithModel({ inference, prefix: candidates.slice(0, 3), tail: candidates.slice(3), routePath: '/category/dog-food' });
		const cart = await chooseKibbleBoundedCopyWithModel({ surface: 'cart', routePath: '/cart', inference });
		expect(cart.copyVariantId).toBe('compare-first');
		expect(mocks.generateText).toHaveBeenCalledTimes(4);
		for (const [options] of mocks.generateText.mock.calls) {
			expect(options.abortSignal).toBeInstanceOf(AbortSignal);
			expect(options.maxOutputTokens).toBe(512);
		}
	});

	it('does not send the raw zero-result search query to the provider', async () => {
		mocks.generateText.mockResolvedValueOnce({ modelId: 'claude-test', result: { output: { copyVariantId: 'broaden-search' }, usage: {} } });
		await chooseKibbleBoundedCopyWithModel({ surface: 'search', routePath: '/search', query: 'name@example.com', inference });
		const [options] = mocks.generateText.mock.calls[0];
		expect(options.prompt).toContain('zero results for a non-empty query');
		expect(options.prompt).not.toContain('name@example.com');
	});
});
