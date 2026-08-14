import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ brandId: 'kibble', enabled: 'true', store: null as Record<string, unknown> | null }));
const mocks = vi.hoisted(() => ({
	findSessionStore: vi.fn(), infer: vi.fn(), getDetail: vi.fn(), getRelated: vi.fn(), reserveBudget: vi.fn(), rankWithModel: vi.fn(), provenance: vi.fn(), logGeneration: vi.fn(),
}));

vi.mock('$env/dynamic/private', () => ({ env: new Proxy({}, { get: (_target, key) => key === 'KIBBLE_DEMO_AI_ENABLED' ? state.enabled : undefined }) }));
vi.mock('$lib/brand/config', () => ({ getBrand: () => ({ id: state.brandId }) }));
vi.mock('$lib/brand/composition-policy', () => ({
	getKibbleObservePdpRelatedModelPolicyDescriptor: (routePath: string) => ({ policyVersion: 'pdp-assist-v1', zoneId: 'pdp.related', routePath }),
}));
vi.mock('$lib/brand/reference/kibble', () => ({ KIBBLE_REFERENCE_CONTRACT: { recipes: { pdp: { variantId: 'kibble.product-detail.catalog-display-only' } } } }));
vi.mock('$lib/brand/reference/kibble-manifest', () => ({ KIBBLE_PRESERVE_MANIFEST: { display: { pdp: { relatedHeading: 'You may also like' } } } }));
vi.mock('$lib/brand/reference/kibble-pdp-related-model.server', () => ({
	KIBBLE_PDP_RELATED_MODEL_PROMPT_VERSION: 'kibble-pdp-related-presentation-v2',
	KIBBLE_PDP_RELATED_MODEL_SCHEMA_VERSION: 'kibble-pdp-presentation-decision-v2',
	rankKibblePdpRelatedWithModel: mocks.rankWithModel,
}));
vi.mock('$lib/server/bigcommerce', () => ({ getKibbleProductDetailByPath: mocks.getDetail, getKibblePdpRelatedProducts: mocks.getRelated }));
vi.mock('$lib/server/kibble-demo-ai-budget', () => ({ reserveKibbleDemoAiCall: mocks.reserveBudget }));
vi.mock('$lib/server/layout-provenance', () => ({ buildContractedLayoutProvenance: mocks.provenance }));
vi.mock('$lib/server/generation-log', () => ({ logGeneration: mocks.logGeneration }));
vi.mock('$lib/signals/inference', () => ({ infer: mocks.infer }));
vi.mock('$lib/signals/session', () => ({ findSessionStore: mocks.findSessionStore }));

import { POST } from './+server';

const inference = {
	primary: 'researcher', probabilities: { gatherer: 0.1, hunter: 0.1, researcher: 0.7, gifter: 0.1 },
	modifiers: { priceSensitivity: 0.2, urgency: 0.3, familiarityWithStore: 0.4 },
};
const detail = {
	entityId: 100,
	relatedProducts: { edges: [
		{ node: { entityId: 11, name: 'Starter Bundle', prices: { price: { value: 90 } }, categories: { edges: [{ node: { name: 'Bundles' } }] } } },
		{ node: { entityId: 12, name: 'Mealtime Kit', prices: { price: { value: 55 } }, categories: { edges: [{ node: { name: 'Care' } }] } } },
		{ node: { entityId: 13, name: 'Dog Toy Kit', prices: { price: { value: 32 } }, categories: { edges: [{ node: { name: 'Toys' } }] } } },
	] },
};
const adapter = {
	instanceId: 'pdp.related', sharedStatus: 'live', sharedContentKind: 'content', decisionMode: 'model', modelCallCount: 1,
	adapterId: 'kibble.zone.pdp.related', componentVariantId: 'kibble.product-detail.related-products', inputSha256: 'a'.repeat(64),
	content: { component: 'product-carousel', props: { title: 'You may also like', products: [{ productId: '13', role: 'standard' }, { productId: '11', role: 'standard' }, { productId: '12', role: 'standard' }], showQuickAdd: false } },
};

function request(body: unknown = { mode: 'model', routePath: '/product/puppy-starter-kit' }, query = '?observe=true') {
	const url = `https://aisles.test/api/kibble/pdp-related-decision${query}`;
	return {
		url: new URL(url), request: new Request(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
		cookies: { get: (name: string) => name === 'aisles_observe_demo' ? '1' : name === 'aisles_session' ? 'session-one' : undefined },
	} as never;
}

describe('POST /api/kibble/pdp-related-decision', () => {
	beforeEach(() => {
		state.brandId = 'kibble'; state.enabled = 'true'; state.store = { toInferenceContext: () => ({ trusted: true }) };
		mocks.findSessionStore.mockReset().mockResolvedValue(state.store);
		mocks.infer.mockReset().mockReturnValue(inference);
		mocks.getDetail.mockReset().mockResolvedValue(structuredClone(detail));
		mocks.getRelated.mockReset().mockImplementation(async (value: typeof detail) => value.relatedProducts.edges.map(({ node }) => node));
		mocks.reserveBudget.mockReset().mockResolvedValue({ ok: true, sessionUsed: 1, globalUsed: 1 });
		mocks.rankWithModel.mockReset().mockResolvedValue({ policy: { policyVersion: 'pdp-assist-v1', provenance: { zoneBinding: { instanceId: 'pdp.related' } } }, rankedProductIds: ['13', '11', '12'], presentationDecision: { relatedCopyVariantId: 'continue-routine', marketingBlockVariantId: 'compare-current' }, adapter, modelId: 'claude-haiku-4-5', modelCallCount: 1 });
		mocks.provenance.mockReset().mockReturnValue({ decisionSource: 'model' });
		mocks.logGeneration.mockReset().mockResolvedValue(undefined);
	});

	it('reloads the requested trusted PDP route while ignoring query-string product facts', async () => {
		const response = await POST(request({ mode: 'model', routePath: '/product/puppy-starter-kit' }, '?observe=true&route=/product/adjacent-slug&products=browser-owned'));
		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(mocks.getDetail).toHaveBeenCalledWith('/puppy-starter-kit/');
		expect(mocks.rankWithModel).toHaveBeenCalledWith(expect.objectContaining({
			routePath: '/product/puppy-starter-kit',
			products: [
				{ entityId: 11, name: 'Starter Bundle', category: 'Bundles', price: 90 },
				{ entityId: 12, name: 'Mealtime Kit', category: 'Care', price: 55 },
				{ entityId: 13, name: 'Dog Toy Kit', category: 'Toys', price: 32 },
			],
		}));
		const body = await response.json();
		expect(body).toMatchObject({ version: 'kibble-pdp-presentation-preview-v2', routePath: '/product/puppy-starter-kit', rankedProductIds: ['13', '11', '12'], presentationDecision: { relatedCopyVariantId: 'continue-routine', marketingBlockVariantId: 'compare-current' }, presentationPolicy: { capabilities: ['rank_products', 'select_copy_variant', 'toggle_zone'] } });
		expect(JSON.stringify(body)).not.toContain('browser-owned');
	});

	it('rejects bodies that try to inject browser facts before catalog or budget work', async () => {
		expect((await POST(request({ mode: 'model', route: '/product/adjacent-slug', products: [999] }))).status).toBe(400);
		expect(mocks.getDetail).not.toHaveBeenCalled();
		expect(mocks.reserveBudget).not.toHaveBeenCalled();
	});

	it('accepts another trusted PDP slug and binds the provider call to that route', async () => {
		const response = await POST(request({ mode: 'model', routePath: '/product/adult-dog-bundle' }));
		expect(response.status).toBe(200);
		expect(mocks.getDetail).toHaveBeenCalledWith('/adult-dog-bundle/');
		expect(mocks.rankWithModel).toHaveBeenCalledWith(expect.objectContaining({ routePath: '/product/adult-dog-bundle' }));
	});

	it('does not call a model for fewer than three server-reloaded candidates or a rejected budget', async () => {
		const tooFew = structuredClone(detail);
		tooFew.relatedProducts.edges.pop();
		mocks.getDetail.mockResolvedValueOnce(tooFew);
		expect((await POST(request())).status).toBe(409);
		expect(mocks.reserveBudget).not.toHaveBeenCalled();
		expect(mocks.rankWithModel).not.toHaveBeenCalled();

		mocks.reserveBudget.mockResolvedValueOnce({ ok: false, reason: 'cooldown' });
		expect((await POST(request())).status).toBe(429);
		expect(mocks.rankWithModel).not.toHaveBeenCalled();
	});
});
