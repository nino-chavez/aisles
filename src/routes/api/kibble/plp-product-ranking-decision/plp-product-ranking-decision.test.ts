import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ brandId: 'kibble' }));
const mocks = vi.hoisted(() => ({ findSessionStore: vi.fn(), infer: vi.fn(), loadPage: vi.fn(), reserve: vi.fn(), rank: vi.fn(), provenance: vi.fn(), log: vi.fn() }));
vi.mock('$env/dynamic/private', () => ({ env: {} }));
vi.mock('$lib/brand/config', () => ({ getBrand: () => ({ id: state.brandId }) }));
vi.mock('$lib/brand/composition-policy', () => ({ KIBBLE_OBSERVE_PLP_PRODUCT_RANKING_SORT: 'FEATURED', getKibbleObservePlpProductRankingModelPolicyDescriptor: () => ({ policyVersion: 'plp-assist-v1' }) }));
vi.mock('$lib/brand/reference/kibble', () => ({ KIBBLE_REFERENCE_CONTRACT: { id: 'kibble-shelf-native', version: '1.8.0', recipes: { plp: { id: 'kibble-plp-reference-v1' } } } }));
vi.mock('$lib/brand/reference/kibble-plp-model.server', () => ({ KIBBLE_PLP_MODEL_PROMPT_VERSION: 'prompt-v1', KIBBLE_PLP_MODEL_SCHEMA_VERSION: 'schema-v1', rankKibblePlpFirstEightWithModel: mocks.rank }));
vi.mock('$lib/server/catalog', () => ({ loadReferenceCategoryProducts: mocks.loadPage }));
vi.mock('$lib/server/kibble-demo-ai-budget', () => ({ reserveKibbleDemoAiCall: mocks.reserve }));
vi.mock('$lib/server/layout-provenance', () => ({ buildContractedLayoutProvenance: mocks.provenance }));
vi.mock('$lib/server/generation-log', () => ({ logGeneration: mocks.log }));
vi.mock('$lib/signals/inference', () => ({ infer: mocks.infer }));
vi.mock('$lib/signals/session', () => ({ findSessionStore: mocks.findSessionStore }));
import { POST } from './+server';

const products = Array.from({ length: 10 }, (_, index) => ({ entityId: index + 1, name: `Food ${index + 1}`, category: 'Dog Food', price: index + 10 }));
const adapter = { instanceId: 'plp.product-ranking', sharedStatus: 'live', sharedContentKind: 'content', decisionMode: 'model', modelCallCount: 1, adapterId: 'kibble.zone.plp.product-ranking', componentVariantId: 'kibble.category-listing.ranked-prefix', inputSha256: 'a'.repeat(64), selection: { componentVariantId: 'kibble.category-listing.ranked-prefix' }, content: { component: 'product-grid', props: { columns: 4, products: products.slice(0, 8).reverse().map(({ entityId }) => ({ productId: String(entityId), role: 'standard' })), imageRatio: 'square', showDescription: false, showSpecs: false, showQuickAdd: false } } };
const zoneArtifacts = {
	header: { instanceId: 'plp.editorial-header', decisionMode: 'model', modelCallCount: 1 },
	ranking: adapter,
	marketing: { instanceId: 'plp.marketing-block', decisionMode: 'model', modelCallCount: 1 },
};
function request(body: unknown = { mode: 'model', routePath: '/category/dog-food' }) { const url = 'https://aisles.test/api/kibble/plp-product-ranking-decision?observe=true&products=browser-owned'; return { url: new URL(url), request: new Request(url, { method: 'POST', body: JSON.stringify(body) }), cookies: { get: (name: string) => name === 'aisles_observe_demo' ? '1' : name === 'aisles_session' ? 'session-one' : undefined } } as never; }

describe('POST /api/kibble/plp-product-ranking-decision', () => {
	beforeEach(() => {
		state.brandId = 'kibble'; mocks.findSessionStore.mockReset().mockResolvedValue({ toInferenceContext: () => ({}) }); mocks.infer.mockReset().mockReturnValue({ primary: 'researcher', probabilities: {} }); mocks.loadPage.mockReset().mockResolvedValue({ products }); mocks.reserve.mockReset().mockResolvedValue({ ok: true }); mocks.rank.mockReset().mockResolvedValue({ policy: { policyVersion: 'plp-assist-v1', provenance: { zoneBinding: { instanceId: 'plp.product-ranking' } } }, prefixIds: products.slice(0, 8).map(({ entityId }) => String(entityId)), tailIds: ['9', '10'], rankedPrefixIds: ['8', '7', '6', '5', '4', '3', '2', '1'], presentationDecision: { headerCopyVariantId: 'guided-start', marketingBlockVariantId: 'routine-builder' }, zoneArtifacts, modelId: 'claude', modelCallCount: 1 }); mocks.provenance.mockReset().mockReturnValue({}); mocks.log.mockReset().mockResolvedValue(undefined);
	});
	it('reloads only the approved FEATURED first page and retains the exact tail', async () => {
		const response = await POST(request()); expect(response.status).toBe(200); expect(mocks.loadPage).toHaveBeenCalledWith('dog-food', { sort: 'FEATURED', after: null }); expect(mocks.rank).toHaveBeenCalledWith(expect.objectContaining({ prefix: products.slice(0, 8), tail: products.slice(8), routePath: '/category/dog-food' })); const body = await response.json(); expect(body).toMatchObject({ version: 'kibble-plp-presentation-preview-v2', routePath: '/category/dog-food', sort: 'FEATURED', cursor: null, persona: 'researcher', tailIds: ['9', '10'], zoneArtifacts: { header: { instanceId: 'plp.editorial-header' }, ranking: { instanceId: 'plp.product-ranking' }, marketing: { instanceId: 'plp.marketing-block' } }, presentationPolicy: { capabilities: ['rank_products', 'select_copy_variant', 'toggle_zone'] } }); expect(Object.keys(body.zoneArtifacts)).toEqual(['header', 'ranking', 'marketing']); expect(body).not.toHaveProperty('presentationDecision'); expect(body).not.toHaveProperty('zoneAdapter'); expect(JSON.stringify(body)).not.toContain('rawModelContent'); expect(JSON.stringify(body)).not.toContain('browser-owned'); for (const artifact of Object.values(body.zoneArtifacts) as Array<{ modelCallCount: number }>) expect(artifact.modelCallCount).toBe(1);
	});
	it('accepts another trusted category slug and binds the provider call to it', async () => {
		const response = await POST(request({ mode: 'model', routePath: '/category/treats' }));
		expect(response.status).toBe(200);
		expect(mocks.loadPage).toHaveBeenCalledWith('treats', { sort: 'FEATURED', after: null });
		expect(mocks.rank).toHaveBeenCalledWith(expect.objectContaining({ routePath: '/category/treats' }));
	});
	it('rejects injected bodies and makes no provider call for fewer than three candidates or rejected budget', async () => {
		expect((await POST(request({ mode: 'model', products: [999], persona: 'browser' }))).status).toBe(400); expect(mocks.loadPage).not.toHaveBeenCalled();
		mocks.loadPage.mockResolvedValueOnce({ products: products.slice(0, 2) }); expect((await POST(request())).status).toBe(409); expect(mocks.reserve).not.toHaveBeenCalled(); expect(mocks.rank).not.toHaveBeenCalled();
		mocks.reserve.mockResolvedValueOnce({ ok: false, reason: 'cooldown' }); expect((await POST(request())).status).toBe(429); expect(mocks.rank).not.toHaveBeenCalled();
	});
});
