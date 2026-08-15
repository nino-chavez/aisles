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
	getTrustedKibbleObserveHomePresentationPolicy: () => ({
		policyVersion: 'model-policy-v1', decisionMode: 'model', publicationMode: 'live',
		capabilities: ['rank_products', 'select_copy_variant', 'select_component_variant', 'reorder_zones'],
		provenance: { preset: 'compose' },
	}),
	getKibbleObserveHomeModelPolicyDescriptor: () => ({
		policyVersion: 'model-policy-v1', zoneIds: ['home.hero', 'home.featured-row.1', 'home.editorial-strip'],
		capabilities: ['rank_products', 'select_copy_variant', 'select_component_variant', 'reorder_zones'], publicationMode: 'live',
	}),
}));
vi.mock('$lib/signals/session', () => ({ findSessionStore: mocks.findSessionStore }));
vi.mock('$lib/signals/inference', () => ({ infer: mocks.infer }));
vi.mock('$lib/server/catalog', () => ({ loadReferenceHomeProducts: mocks.loadReferenceHomeProducts }));
vi.mock('$lib/brand/reference/kibble-home-decision', () => ({ decideKibbleHome: mocks.decideKibbleHome }));
vi.mock('$lib/server/layout-provenance', () => ({ buildContractedLayoutProvenance: mocks.buildContractedLayoutProvenance }));
vi.mock('$lib/brand/reference/kibble', () => ({ KIBBLE_REFERENCE_CONTRACT: { version: '1.8.0', recipes: { home: { id: 'kibble-home-reference-v1' } } } }));
vi.mock('$lib/brand/reference/kibble-zone-executor.server', () => ({ executeKibbleHomeFeaturedZoneAdapters: mocks.executeFeaturedAdapters }));
vi.mock('$lib/brand/reference/kibble-runtime', () => ({
	buildKibbleHomePresentationContext: () => ({
		hero: { eyebrow: 'Live eyebrow', headline: 'Live headline', body: 'Live body' },
		featuredCopy: { eyebrow: 'Catalog', title: 'New arrivals', browseAllLabel: 'Browse Dog Food' },
		catalogCopy: { eyebrow: 'Browse', title: 'Shop by category' },
	}),
}));
vi.mock('$lib/brand/reference/kibble-home-model.server', () => ({
	KIBBLE_HOME_MODEL_PROMPT_VERSION: 'kibble-home-bounded-presentation-v2',
	KIBBLE_HOME_MODEL_SCHEMA_VERSION: 'kibble-home-presentation-decision-v2',
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
				reference: { id: 'kibble-shelf-native', version: '1.8.0' }, surface: 'home', preset: 'preserve', policyVersion: 'policy-v1', publicationMode: 'live', inference,
				dataSourceLabel: 'merchant-enrichment',
				zones: [
					{ id: 'merchant-chrome', label: 'Root header', authority: 'fixed', componentVariant: 'kibble.header.responsive-chrome', capabilities: [], decisionSummary: 'Pinned.', changed: false, modelCallStatus: { calls: 0, authorized: false } },
					{ id: 'opening-merchandising', label: 'Opening hero', authority: 'fixed', componentVariant: 'kibble.hero.flagship-bundle', capabilities: [], decisionSummary: 'Pinned.', changed: false, modelCallStatus: { calls: 0, authorized: false } },
					{ id: 'ranked-products', label: 'Ranked products', authority: 'rules', componentVariant: 'kibble.featured-grid.four-column', capabilities: ['rank_products', 'select_products'], decisionSummary: 'Ranked.', changed: false, inputProducts: [{ id: 'food-one', name: 'Food One', variant: 'gatherer fit 0.900' }], outputProducts: [{ id: 'food-one', name: 'Food One', variant: 'gatherer fit 0.900' }], modelCallStatus: { calls: 0, authorized: false } },
					{ id: 'catalog-entry', label: 'Catalog entry', authority: 'fixed', componentVariant: 'kibble.visual-module.category', capabilities: [], decisionSummary: 'Pinned.', changed: false, modelCallStatus: { calls: 0, authorized: false } },
					{ id: 'service-proof', label: 'Service proof', authority: 'fixed', componentVariant: 'kibble.service-proof.three-column', capabilities: [], decisionSummary: 'Pinned.', changed: false, modelCallStatus: { calls: 0, authorized: false } },
					{ id: 'merchant-footer', label: 'Root footer', authority: 'fixed', componentVariant: 'kibble.footer.four-column', capabilities: [], decisionSummary: 'Pinned.', changed: false, modelCallStatus: { calls: 0, authorized: false } },
				],
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
			version: 'kibble-live-home-preview-v3', previewOnly: true,
			reference: { id: 'kibble-shelf-native', version: '1.8.0' }, policyVersion: 'policy-v1', persona: 'gatherer',
			inspector: { dataSourceLabel: 'runner-fixture', inference: { shift: { trigger: '[request detail withheld]' }, ruleMatches: [{ reason: 'Matched; raw request detail withheld.' }] }, provenance: { decisionSource: 'rules', synthetic: { scenarioId: 'runner-scenario' } } },
		});
		expect(body.products[0]).not.toHaveProperty('personaFit');
		expect(body.featuredZoneAdapters).toEqual([{ instanceId: 'home.featured-row.1' }]);
		const rankedZone = body.inspector.zones.find(({ id }: { id: string }) => id === 'ranked-products');
		expect(rankedZone.inputProducts[0]).not.toHaveProperty('variant');
		expect(rankedZone.outputProducts[0]).not.toHaveProperty('variant');
		expect(JSON.stringify(body)).not.toContain('0.900');
	});

	it('reserves budget and publishes one bounded model ranking only after an explicit request', async () => {
		mocks.rankWithModel.mockResolvedValue({
			products: [candidate],
			zoneArtifacts: {
				hero: { instanceId: 'home.hero', componentVariantId: 'kibble.hero.zone-editorial-header', decisionMode: 'model', modelCallCount: 1 },
				featured: { instanceId: 'home.featured-row.1', componentVariantId: 'kibble.featured-grid.ranked-segment', decisionMode: 'model', modelCallCount: 1 },
				editorial: { instanceId: 'home.editorial-strip', componentVariantId: 'kibble.visual-module.routine', decisionMode: 'model', modelCallCount: 1 },
			},
			policy: { policyVersion: 'model-policy-v1', provenance: { zoneBinding: { familyId: 'home.featured-row' } } },
			modelId: 'claude-haiku-4-5', modelCallCount: 1, inputTokens: 100, outputTokens: 12,
			presentationDecision: { heroCopyVariantId: 'visit-fast-path', featuredCopyVariantId: 'visit-start', catalogCopyVariantId: 'routine-builder', catalogComponentVariantId: 'two-column', sectionOrderId: 'catalog-then-featured' },
		});
		mocks.buildContractedLayoutProvenance.mockReturnValueOnce({ decisionSource: 'model', synthetic: { value: true, scenarioId: 'runner-scenario' } });

		const response = await POST(request(true, { mode: 'model' }));
		expect(response.status).toBe(200);
		expect(mocks.reserveBudget).toHaveBeenCalledWith('session-one');
		expect(mocks.rankWithModel).toHaveBeenCalledWith({
			inference,
			products: [candidate],
			presentationContext: {
				hero: { eyebrow: 'Live eyebrow', headline: 'Live headline', body: 'Live body' },
				featuredCopy: { eyebrow: 'Catalog', title: 'New arrivals', browseAllLabel: 'Browse Dog Food' },
				catalogCopy: { eyebrow: 'Browse', title: 'Shop by category' },
			},
		});
		const body = await response.json();
		expect(body).toMatchObject({
			version: 'kibble-live-home-preview-v3', policyVersion: 'model-policy-v1', modelCallCount: 1,
			zoneArtifacts: {
				hero: { instanceId: 'home.hero', decisionMode: 'model', modelCallCount: 1 },
				featured: { instanceId: 'home.featured-row.1', decisionMode: 'model', modelCallCount: 1 },
				editorial: { instanceId: 'home.editorial-strip', decisionMode: 'model', modelCallCount: 1 },
			},
			inspector: {
				preset: 'compose',
				dataSourceLabel: 'bounded-model-presentation',
				zones: expect.arrayContaining([
					expect.objectContaining({ id: 'home.hero', authority: 'model', capabilities: ['select_copy_variant'], changed: true, modelCallStatus: { calls: 1, authorized: true } }),
					expect.objectContaining({ id: 'home.featured-row.1', authority: 'model', capabilities: ['rank_products', 'select_copy_variant', 'reorder_zones'], changed: true, inputProducts: [{ id: 'food-one', name: 'Food One' }], outputProducts: [{ id: 'food-one', name: 'Food One' }] }),
					expect.objectContaining({ id: 'home.editorial-strip', authority: 'model', capabilities: ['select_copy_variant', 'select_component_variant'], changed: true }),
				]),
			},
		});
		expect(mocks.buildContractedLayoutProvenance).toHaveBeenCalledWith(expect.objectContaining({
			policy: expect.objectContaining({
				capabilities: ['rank_products', 'select_copy_variant', 'select_component_variant', 'reorder_zones'],
				provenance: { preset: 'compose' },
			}),
			contractInput: expect.objectContaining({ zones: ['home.hero', 'home.featured-row.1', 'home.editorial-strip'] }),
		}));
		expect(Object.keys(body.zoneArtifacts)).toEqual(['hero', 'featured', 'editorial']);
		expect(body).not.toHaveProperty('presentationDecision');
		expect(body).not.toHaveProperty('featuredZoneAdapters');
		expect(JSON.stringify(body)).not.toContain('rawModelContent');
		for (const artifact of Object.values(body.zoneArtifacts) as Array<{ modelCallCount: number }>) expect(artifact.modelCallCount).toBe(1);
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
