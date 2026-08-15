import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ brandId: 'kibble' }));
const mocks = vi.hoisted(() => ({ findStore: vi.fn(), infer: vi.fn(), search: vi.fn(), reserve: vi.fn(), choose: vi.fn(), provenance: vi.fn(), log: vi.fn() }));
vi.mock('$env/dynamic/private', () => ({ env: {} }));
vi.mock('$lib/brand/config', () => ({ getBrand: () => ({ id: state.brandId }) }));
vi.mock('$lib/brand/reference/kibble', () => ({ KIBBLE_REFERENCE_CONTRACT: { recipes: { search: { variantId: 'search' }, cart: { variantId: 'cart' }, checkout: { variantId: 'checkout' } } } }));
vi.mock('$lib/brand/reference/kibble-bounded-copy-model.server', () => ({
	KIBBLE_BOUNDED_COPY_MODEL_PROMPT_VERSION: 'prompt-v1', KIBBLE_BOUNDED_COPY_MODEL_SCHEMA_VERSION: 'schema-v1',
	chooseKibbleBoundedCopyWithModel: mocks.choose,
	decisionFromCopyVariant: (surface: string, id: string) => surface === 'checkout' ? { assuranceCopyVariantId: id } : { emptyCopyVariantId: id },
}));
vi.mock('$lib/brand/composition-policy', () => ({ getKibbleObserveCopyModelPolicyDescriptor: (input: Record<string, unknown>) => ({ policyVersion: 'assist-v2', zoneId: input.instanceId, routePath: input.routePath }) }));
vi.mock('$lib/brand/reference/kibble-search.server', () => ({ searchKibbleCatalog: mocks.search }));
vi.mock('$lib/server/kibble-demo-ai-budget', () => ({ reserveKibbleDemoAiCall: mocks.reserve }));
vi.mock('$lib/server/layout-provenance', () => ({ buildContractedLayoutProvenance: mocks.provenance }));
vi.mock('$lib/server/generation-log', () => ({ logGeneration: mocks.log }));
vi.mock('$lib/signals/inference', () => ({ infer: mocks.infer }));
vi.mock('$lib/signals/session', () => ({ findSessionStore: mocks.findStore }));

import { POST } from './+server';
import { BoundedModelActionError } from '$lib/server/bounded-model-action.server';

const adapter = {
	instanceId: 'cart.empty-state', sharedStatus: 'live', sharedContentKind: 'content', decisionMode: 'model', modelCallCount: 1,
	adapterId: 'kibble.zone.cart.empty-state', componentVariantId: 'kibble.cart.reference-shell', inputSha256: 'a'.repeat(64),
	content: { component: 'editorial-header', props: { eyebrow: 'Compare first', headline: 'Keep product facts in view.', body: 'Review the approved catalog.' } },
};

function request(body: unknown) {
	const url = 'https://aisles.test/api/kibble/bounded-copy-decision?observe=true';
	return {
		url: new URL(url), request: new Request(url, { method: 'POST', body: JSON.stringify(body) }),
		cookies: { get: (name: string) => name === 'aisles_observe_demo' ? '1' : name === 'aisles_session' ? 'session-one' : undefined },
	} as never;
}

describe('POST /api/kibble/bounded-copy-decision', () => {
	beforeEach(() => {
		state.brandId = 'kibble';
		mocks.findStore.mockReset().mockResolvedValue({ toInferenceContext: () => ({ trusted: true }) });
		mocks.infer.mockReset().mockReturnValue({ primary: 'researcher', probabilities: { researcher: 1 }, modifiers: { urgency: 0 } });
		mocks.search.mockReset().mockResolvedValue({ products: [] });
		mocks.reserve.mockReset().mockResolvedValue({ ok: true });
		mocks.choose.mockReset().mockResolvedValue({ policy: { policyVersion: 'assist-v2', provenance: { zoneBinding: {} } }, copyVariantId: 'compare-first', adapter, modelId: 'claude-haiku-4-5', modelCallCount: 1 });
		mocks.provenance.mockReset().mockReturnValue({});
		mocks.log.mockReset().mockResolvedValue(undefined);
	});

	it('runs one provider-backed cart presentation decision without reading or inventing cart state', async () => {
		const response = await POST(request({ mode: 'model', surface: 'cart' }));
		expect(response.status).toBe(200);
		expect(mocks.choose).toHaveBeenCalledWith(expect.objectContaining({ surface: 'cart', routePath: '/cart' }));
		expect(mocks.search).not.toHaveBeenCalled();
		expect(await response.json()).toMatchObject({ surface: 'cart', routePath: '/cart', provider: 'anthropic', modelCallCount: 1, presentationDecision: { emptyCopyVariantId: 'compare-first' } });
	});

	it('allows search AI only after the server confirms zero results', async () => {
		mocks.search.mockResolvedValueOnce({ products: [{ entityId: 1 }] });
		expect((await POST(request({ mode: 'model', surface: 'search', query: 'food' }))).status).toBe(409);
		expect(mocks.reserve).not.toHaveBeenCalled();
		expect(mocks.choose).not.toHaveBeenCalled();
	});

	it('fails closed when the feature budget is disabled and rejects injected fields', async () => {
		mocks.reserve.mockResolvedValueOnce({ ok: false, reason: 'disabled' });
		expect((await POST(request({ mode: 'model', surface: 'checkout', subtype: 'gift' }))).status).toBe(503);
		expect(mocks.choose).not.toHaveBeenCalled();
		expect((await POST(request({ mode: 'model', surface: 'cart', products: [1] }))).status).toBe(400);
	});

	it('reports actual failed provider attempts without exposing the provider error', async () => {
		mocks.choose.mockRejectedValueOnce(new BoundedModelActionError('provider_failed', 'sensitive upstream detail', 2));
		const response = await POST(request({ mode: 'model', surface: 'cart' }));
		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({
			error: 'Failed to preview Kibble bounded presentation decision',
			modelCallCount: 2,
		});
	});
});
