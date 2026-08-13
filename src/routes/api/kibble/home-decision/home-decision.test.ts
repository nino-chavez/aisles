import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '$lib/types';

const state = vi.hoisted(() => ({
	dev: true,
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
}));

vi.mock('$app/environment', () => ({ get dev() { return state.dev; } }));
vi.mock('$env/dynamic/private', () => ({ env: new Proxy({}, { get: () => state.dataSourceOverride }) }));
vi.mock('$lib/brand/config', () => ({ getBrand: () => ({ id: state.brandId }) }));
vi.mock('$lib/brand/composition-policy', () => ({
	getContractSurfaceDecision: () => ({ mode: 'reference-preserve', policy: { policyVersion: 'policy-v1' } }),
	assertKibblePreserveRoutePolicy: mocks.assertPolicy,
}));
vi.mock('$lib/signals/session', () => ({ findSessionStore: mocks.findSessionStore }));
vi.mock('$lib/signals/inference', () => ({ infer: mocks.infer }));
vi.mock('$lib/server/catalog', () => ({ loadReferenceHomeProducts: mocks.loadReferenceHomeProducts }));
vi.mock('$lib/brand/reference/kibble-home-decision', () => ({ decideKibbleHome: mocks.decideKibbleHome }));
vi.mock('$lib/server/layout-provenance', () => ({ buildContractedLayoutProvenance: mocks.buildContractedLayoutProvenance }));
vi.mock('$lib/brand/reference/kibble', () => ({ KIBBLE_REFERENCE_CONTRACT: { version: '1.5.0', recipes: { home: { id: 'kibble-home-reference-v1' } } } }));

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

function request(devQuery = true) {
	return { url: new URL(`http://localhost/api/kibble/home-decision${devQuery ? '?dev=true' : ''}`), cookies: { get: () => 'session-one' } } as never;
}

describe('POST /api/kibble/home-decision', () => {
	beforeEach(() => {
		state.dev = true;
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
	});

	it('requires server dev, the explicit query, and the active Kibble brand', async () => {
		state.dev = false;
		expect((await POST(request())).status).toBe(404);
		state.dev = true;
		expect((await POST(request(false))).status).toBe(404);
		state.brandId = 'haven';
		expect((await POST(request())).status).toBe(404);
		expect(mocks.findSessionStore).not.toHaveBeenCalled();
	});

	it('requires an existing scoped session without creating or mutating one', async () => {
		const missingCookie = { url: new URL('http://localhost/api/kibble/home-decision?dev=true'), cookies: { get: () => undefined } } as never;
		expect((await POST(missingCookie)).status).toBe(409);
		mocks.findSessionStore.mockResolvedValueOnce(null);
		const response = await POST(request());
		expect(response.status).toBe(409);
		expect(mocks.findSessionStore).toHaveBeenCalledWith('session-one');
	});

	it('accepts the scoped hot session in dev when Redis is unavailable', async () => {
		const response = await POST(request());

		expect(response.status).toBe(200);
		expect(mocks.findSessionStore).toHaveBeenCalledWith('session-one');
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
			version: 'kibble-live-home-preview-v1', previewOnly: true,
			reference: { id: 'kibble-shelf-native', version: '1.5.0' }, policyVersion: 'policy-v1', persona: 'gatherer',
			inspector: { dataSourceLabel: 'runner-fixture', inference: { shift: { trigger: '[request detail withheld]' }, ruleMatches: [{ reason: 'Matched; raw request detail withheld.' }] }, provenance: { decisionSource: 'rules', synthetic: { scenarioId: 'runner-scenario' } } },
		});
		expect(body.products[0]).not.toHaveProperty('personaFit');
		expect(body.inspector.zones[0].inputProducts[0]).not.toHaveProperty('variant');
		expect(body.inspector.zones[0].outputProducts[0]).not.toHaveProperty('variant');
		expect(JSON.stringify(body)).not.toContain('0.900');
	});
});
