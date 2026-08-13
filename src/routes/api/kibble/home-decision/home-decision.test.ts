import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '$lib/types';

const state = vi.hoisted(() => ({
	brandId: 'kibble',
	store: null as Record<string, any> | null,
	dataSourceOverride: '',
	scenarioId: 'runner-scenario',
}));
const mocks = vi.hoisted(() => ({
	findSessionStore: vi.fn(),
	infer: vi.fn(),
	loadReferenceHomeProducts: vi.fn(),
	decideKibbleHome: vi.fn(),
	buildContractedLayoutProvenance: vi.fn(),
	assertPolicy: vi.fn(),
	executeFeaturedAdapters: vi.fn(),
	rankWithModel: vi.fn(),
	reserveBudget: vi.fn(),
	logGeneration: vi.fn(),
}));

vi.mock('$env/dynamic/private', () => ({ env: new Proxy({}, { get: () => state.dataSourceOverride }) }));
vi.mock('$lib/brand/config', () => ({ getBrand: () => ({ id: state.brandId }) }));
vi.mock('$lib/brand/composition-policy', () => ({
	getContractSurfaceDecision: () => ({ mode: 'reference-preserve', policy: { policyVersion: 'policy-v1' } }),
	assertKibblePreserveRoutePolicy: mocks.assertPolicy,
	getKibbleObserveHomeModelPolicyDescriptor: () => ({ policyVersion: 'model-policy-v1', zoneId: 'home.featured-row', capabilities: ['rank_products'], publicationMode: 'live' }),
}));
vi.mock('$lib/signals/session', () => ({ findSessionStore: mocks.findSessionStore }));
vi.mock('$lib/signals/inference', () => ({ infer: mocks.infer }));
vi.mock('$lib/server/catalog', () => ({ loadReferenceHomeProducts: mocks.loadReferenceHomeProducts }));
vi.mock('$lib/brand/reference/kibble-home-decision', () => ({ decideKibbleHome: mocks.decideKibbleHome }));
vi.mock('$lib/server/layout-provenance', () => ({ buildContractedLayoutProvenance: mocks.buildContractedLayoutProvenance }));
vi.mock('$lib/brand/reference/kibble', () => ({ KIBBLE_REFERENCE_CONTRACT: { version: '1.5.0', recipes: { home: { id: 'kibble-home-reference-v1' } } } }));
vi.mock('$lib/brand/reference/kibble-zone-executor.server', () => ({ executeKibbleHomeFeaturedZoneAdapters: mocks.executeFeaturedAdapters }));
vi.mock('$lib/brand/reference/kibble-home-model.server', () => ({
	KIBBLE_HOME_MODEL_PROMPT_VERSION: 'kibble-home-bounded-rank-v1',
	KIBBLE_HOME_MODEL_SCHEMA_VERSION: 'kibble-home-zone-decision-v1',
	rankKibbleHomeWithModel: mocks.rankWithModel,
}));
vi.mock('$lib/server/kibble-demo-ai-budget', () => ({ reserveKibbleDemoAiCall: mocks.reserveBudget }));
vi.mock('$lib/server/generation-log', () => ({ logGeneration: mocks.logGeneration }));

import { POST } from './+server';

const candidate: Product & { personaFit: Record<string, number> } = {
	id: 'food-one', entityId: 1, name: 'Food One', price: 24, image: 'https://example.com/one.jpg', imageAlt: 'Food One',
	description: '', specs: {}, tags: [], category: 'Dog food', personaFit: { gatherer: 0.9 },
};
const inference = {
	primary: 'gatherer', probabilities: { gatherer: 0.7, hunter: 0.1, researcher: 0.1, gifter: 0.1 }, confidence: 0.6,
	entropy: 0.8, certainty: 0.4, modifiers: { priceSensitivity: 0, urgency: 0, familiarityWithStore: 0 },
	shift: { detected: true, from: 'hunter', trigger: 'request query=private' }, signalCount: 2, lastUpdated: 1,
	dominantSource: 'interaction', ruleMatches: [{ ruleName: 'test', reason: 'private raw value', weight: 1, adjustment: { gatherer: 1 } }],
};

function request(observeQuery = true, body?: unknown) {
	const url = `http://localhost/api/kibble/home-decision${observeQuery ? '?observe=true' : ''}`;
	return {
		url: new URL(url),
		request: new Request(url, { method: 'POST', ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) }),
		cookies: { get: (name: string) => name === 'aisles_observe_demo' ? '1' : name === 'aisles_session' ? 'session-one' : undefined },
	} as never;
}

describe('POST /api/kibble/home-decision', () => {
	beforeEach(() => {
		state.brandId = 'kibble';
		state.dataSourceOverride = 'runner-fixture';
		state.scenarioId = 'runner-scenario';
		state.store = { toInferenceContext: () => ({ trusted: true }), getCrossSessionContext: () => ({ scenarioId: state.scenarioId }) };
		mocks.findSessionStore.mockReset().mockResolvedValue(state.store);
		mocks.infer.mockReset().mockReturnValue(inference);
		mocks.loadReferenceHomeProducts.mockReset().mockResolvedValue({ products: [candidate], source: 'featured' });
		mocks.decideKibbleHome.mockReset().mockReturnValue({
			products: [candidate],
			inspector: {
				reference: { id: 'kibble-shelf-native', version: '1.5.0' }, surface: 'home', preset: 'preserve', policyVersion: 'policy-v1', publicationMode: 'live', inference,
				dataSourceLabel: 'merchant-enrichment',
				zones: [{ id: 'ranked-products', label: 'Ranked products', authority: 'rules', componentVariant: 'kibble.home.ranked-products', capabilities: ['rank_products'], decisionSummary: 'Ranked.', changed: true, inputProducts: [{ id: 'food-one', name: 'Food One', variant: 'gatherer fit 0.900' }], outputProducts: [{ id: 'food-one', name: 'Food One', variant: 'gatherer fit 0.900' }], modelCallStatus: { calls: 0, authorized: false } }],
			},
		});
		mocks.buildContractedLayoutProvenance.mockReset().mockReturnValue({ decisionSource: 'rules', synthetic: { value: true, scenarioId: state.scenarioId } });
		mocks.assertPolicy.mockReset();
		mocks.executeFeaturedAdapters.mockReset().mockResolvedValue([{ instanceId: 'home.featured-row.1' }]);
		mocks.rankWithModel.mockReset();
		mocks.reserveBudget.mockReset().mockResolvedValue({ ok: true, sessionUsed: 1, globalUsed: 1 });
		mocks.logGeneration.mockReset().mockResolvedValue(undefined);
	});

	it('requires the explicit public demo query and the active Kibble brand', async () => {
		expect((await POST(request(false))).status).toBe(404);
		state.brandId = 'haven';
		expect((await POST(request())).status).toBe(404);
		expect(mocks.findSessionStore).not.toHaveBeenCalled();
	});

	it('requires an existing scoped session without creating or mutating one', async () => {
		const missingCookie = { url: new URL('http://localhost/api/kibble/home-decision?observe=true'), request: new Request('http://localhost/api/kibble/home-decision?observe=true', { method: 'POST' }), cookies: { get: (name: string) => name === 'aisles_observe_demo' ? '1' : undefined } } as never;
		expect((await POST(missingCookie)).status).toBe(409);
		mocks.findSessionStore.mockResolvedValueOnce(null);
		const response = await POST(request());
		expect(response.status).toBe(409);
		expect(mocks.findSessionStore).toHaveBeenCalledWith('session-one', { fresh: true });
	});

	it('accepts the scoped demo session when Redis is unavailable', async () => {
		const response = await POST(request());

		expect(response.status).toBe(200);
		expect(mocks.findSessionStore).toHaveBeenCalledWith('session-one', { fresh: true });
	});

	it('derives and serializes a bounded, score-free server preview', async () => {
		const response = await POST(request());
		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(mocks.infer).toHaveBeenCalledWith({ trusted: true });
		expect(mocks.loadReferenceHomeProducts).toHaveBeenCalledWith(9);
		expect(mocks.decideKibbleHome).toHaveBeenCalledWith({ policyVersion: 'policy-v1' }, inference, [candidate]);
		const body = await response.json();
		expect(body).toMatchObject({
			version: 'kibble-live-home-preview-v2', previewOnly: true,
			reference: { id: 'kibble-shelf-native', version: '1.5.0' }, policyVersion: 'policy-v1', persona: 'gatherer',
			inspector: { dataSourceLabel: 'runner-fixture', inference: { shift: { trigger: '[request detail withheld]' }, ruleMatches: [{ reason: 'Matched; raw request detail withheld.' }] }, provenance: { decisionSource: 'rules', synthetic: { scenarioId: 'runner-scenario' } } },
		});
		expect(body.products[0]).not.toHaveProperty('personaFit');
		expect(body.featuredZoneAdapters).toEqual([{ instanceId: 'home.featured-row.1' }]);
		expect(body.inspector.zones[0].inputProducts[0]).not.toHaveProperty('variant');
		expect(body.inspector.zones[0].outputProducts[0]).not.toHaveProperty('variant');
		expect(JSON.stringify(body)).not.toContain('0.900');
	});

	it('reserves budget and publishes one bounded model ranking only after an explicit request', async () => {
		mocks.rankWithModel.mockResolvedValue({
			products: [candidate],
			zoneAdapter: { instanceId: 'home.featured-row.1', decisionMode: 'model', modelCallCount: 1 },
			policy: { policyVersion: 'model-policy-v1', provenance: { zoneBinding: { familyId: 'home.featured-row' } } },
			modelId: 'claude-haiku-4-5', modelCallCount: 1, inputTokens: 100, outputTokens: 12,
		});
		mocks.buildContractedLayoutProvenance.mockReturnValueOnce({ decisionSource: 'model', synthetic: { value: true, scenarioId: 'runner-scenario' } });

		const response = await POST(request(true, { mode: 'model' }));
		expect(response.status).toBe(200);
		expect(mocks.reserveBudget).toHaveBeenCalledWith('session-one');
		expect(mocks.rankWithModel).toHaveBeenCalledWith({ inference, products: [candidate] });
		const body = await response.json();
		expect(body).toMatchObject({
			version: 'kibble-live-home-preview-v2', policyVersion: 'model-policy-v1',
			featuredZoneAdapters: [{ instanceId: 'home.featured-row.1', decisionMode: 'model', modelCallCount: 1 }],
			inspector: {
				preset: 'assist',
				dataSourceLabel: 'bounded-model-ranking',
				zones: [{
					authority: 'model',
					componentVariant: 'kibble.featured-grid.ranked-segment',
					modelCallStatus: { calls: 1, authorized: true },
				}],
			},
		});
		expect(body.products[0]).not.toHaveProperty('personaFit');
		expect(mocks.logGeneration).toHaveBeenCalledWith(expect.objectContaining({
			model: 'anthropic/claude-haiku-4-5', inputTokens: 100, outputTokens: 12, sessionId: 'session-one',
		}));
	});

	it('does not contact a model when the request or budget is rejected', async () => {
		expect((await POST(request(true, { mode: 'model', extra: true }))).status).toBe(400);
		mocks.reserveBudget.mockResolvedValueOnce({ ok: false, reason: 'cooldown' });
		expect((await POST(request(true, { mode: 'model' }))).status).toBe(429);
		expect(mocks.rankWithModel).not.toHaveBeenCalled();
		expect(mocks.logGeneration).not.toHaveBeenCalled();
	});
});
