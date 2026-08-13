import { describe, expect, it, vi } from 'vitest';
import type { PersonaInference } from '$lib/signals/types';

const mocks = vi.hoisted(() => ({ generateText: vi.fn() }));
vi.mock('ai', async (importOriginal) => ({ ...await importOriginal<typeof import('ai')>(), generateText: mocks.generateText }));
vi.mock('$lib/server/model', () => ({ model: (id: string) => ({ id }), withModelFallback: async (run: (id: string) => Promise<unknown>) => run('claude-test') }));

import { rankKibblePlpFirstEightWithModel } from './kibble-plp-model.server';
import { hashKibblePlpRankingInput } from './kibble-plp-ranking-boundary.server';
import { validateKibblePlpLivePreview } from '$lib/components/kibble/kibble-plp-live-preview';

const inference: PersonaInference = {
	primary: 'researcher', probabilities: { gatherer: 0.1, hunter: 0.1, researcher: 0.7, gifter: 0.1 }, confidence: 0.6, entropy: 0.5, certainty: 0.6,
	modifiers: { priceSensitivity: 0, urgency: 0, familiarityWithStore: 0 }, shift: { detected: false, from: null, trigger: null }, signalCount: 1, lastUpdated: 1, dominantSource: 'request', ruleMatches: [],
};
const candidates = Array.from({ length: 10 }, (_, index) => ({ entityId: index + 1, name: `Food ${index + 1}`, category: 'Dog Food', price: index + 10 }));

describe('Kibble PLP runner to adapter to client', () => {
	it('composes one validated model action into the exact prefix-only client preview', async () => {
		mocks.generateText.mockResolvedValueOnce({ modelId: 'claude-test', result: { output: { rankedProductIds: ['8', '7', '6', '5', '4', '3', '2', '1'] }, usage: { inputTokens: 1, outputTokens: 1 } } });
		const result = await rankKibblePlpFirstEightWithModel({ inference, prefix: candidates.slice(0, 8), tail: candidates.slice(8) });
		expect(result.modelCallCount).toBe(1);
		expect(result.zoneAdapter.modelCallCount).toBe(1);
		const prefixIds = candidates.slice(0, 8).map(({ entityId }) => String(entityId));
		const tailIds = ['9', '10'];
		const preview = validateKibblePlpLivePreview({ version: 'kibble-plp-first-eight-preview-v1', previewOnly: true, routePath: '/category/dog-food', sort: 'FEATURED', cursor: null, policyVersion: result.policy.policyVersion, reference: { id: 'kibble-shelf-native', version: '1.8.0' }, prefixIds, tailIds, rankedPrefixIds: result.rankedPrefixIds, zoneAdapter: result.zoneAdapter, modelCallCount: result.modelCallCount, provenance: {} }, { routePath: '/category/dog-food', sort: 'FEATURED', cursor: null, policyVersion: result.policy.policyVersion, reference: { id: 'kibble-shelf-native', version: '1.8.0' }, prefixIds, tailIds, expectedInputSha256: hashKibblePlpRankingInput(prefixIds, tailIds) }, candidates.map((candidate) => ({ id: String(candidate.entityId), ...candidate, image: '', imageAlt: '', description: '', specs: {}, tags: [] })));
		expect(preview?.products.map(({ entityId }) => entityId)).toEqual([8, 7, 6, 5, 4, 3, 2, 1, 9, 10]);
	});
});
