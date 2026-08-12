import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
	scenarioId: null as string | null,
	cachedLayout: null as Record<string, unknown> | null,
	generatedLayout: { zone: 'generated' } as Record<string, unknown>,
	requestProvenance: { marker: 'request' } as Record<string, unknown>,
	storedProvenance: { marker: 'stored' } as Record<string, unknown>,
	getCachedLayout: vi.fn(),
	cacheLayout: vi.fn(),
	buildProvenance: vi.fn(),
}));

vi.mock('ai', () => ({
	streamText: vi.fn(() => ({
		partialOutputStream: (async function* () {})(),
		output: Promise.resolve(state.generatedLayout),
		usage: Promise.resolve({}),
	})),
	Output: { object: vi.fn(() => ({})) },
}));
vi.mock('$lib/server/model', () => ({ model: vi.fn(), PRIMARY_MODEL: 'test-model' }));
vi.mock('$lib/schema/layout', () => ({ layoutSchemaFor: vi.fn(() => ({})) }));
vi.mock('$lib/server/layout-prompt', () => ({ buildLayoutPrompt: vi.fn(() => 'test prompt'), PROMPT_VERSION: 'v5' }));
vi.mock('$lib/server/catalog', () => ({
	loadCategoryProducts: vi.fn(async () => ({ products: [], categoryName: 'Dog food' })),
	loadHomeProducts: vi.fn(async () => ({ products: [], categoryName: 'Home' })),
}));
vi.mock('$lib/server/cache', () => ({
	getCachedLayout: state.getCachedLayout,
	cacheLayout: state.cacheLayout,
}));
vi.mock('$lib/server/generation-log', () => ({ logGeneration: vi.fn(async () => {}) }));
vi.mock('$lib/server/rules', () => ({ getActiveRules: vi.fn(async () => []), rulesToPromptContext: vi.fn(() => '') }));
vi.mock('$lib/brand/config', () => ({ getBrand: vi.fn(() => ({ organizationId: 'test-org', id: 'test-brand' })) }));
vi.mock('$lib/server/layout-provenance', () => ({
	buildLegacyLayoutProvenance: state.buildProvenance,
	LEGACY_LAYOUT_SCHEMA_VERSION: 'legacy-layout-schema-v1',
}));
vi.mock('$lib/signals/session', () => ({
	hasSession: vi.fn(async () => state.scenarioId !== null),
	getSessionStore: vi.fn(async () => ({ getCrossSessionContext: () => ({ scenarioId: state.scenarioId }) })),
}));

import { POST } from './+server';

function requestForLayout() {
	return new Request('http://localhost/api/layout/stream', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ persona: 'researcher', categorySlug: 'dog-food' }),
	});
}

describe('/api/layout/stream cache provenance', () => {
	beforeEach(() => {
		state.scenarioId = null;
		state.cachedLayout = { zone: 'cached-real' };
		state.generatedLayout = { zone: 'generated-synthetic' };
		state.requestProvenance = { marker: 'request' };
		state.storedProvenance = { marker: 'stored' };
		state.buildProvenance.mockReset().mockReturnValue(state.requestProvenance);
		state.getCachedLayout.mockReset().mockResolvedValue({ layout: state.cachedLayout, provenance: state.storedProvenance });
		state.cacheLayout.mockReset().mockResolvedValue(undefined);
	});

	it('uses an existing cache entry for a real shopper', async () => {
		const response = await POST({ request: requestForLayout(), cookies: { get: () => 'real-session' } } as never);

		expect(state.getCachedLayout).toHaveBeenCalledOnce();
		expect(state.getCachedLayout).toHaveBeenCalledWith(state.requestProvenance);
		expect(await response.json()).toMatchObject({
			layout: state.cachedLayout,
			meta: { cacheHit: true, provenance: state.storedProvenance },
		});
	});

	it('never reads or writes the real cache for a synthetic scenario', async () => {
		state.scenarioId = 'first-time-puppy-owner';

		const response = await POST({ request: requestForLayout(), cookies: { get: () => 'synthetic:first-time-puppy-owner' } } as never);
		await response.text();

		expect(state.getCachedLayout).not.toHaveBeenCalled();
		expect(state.cacheLayout).not.toHaveBeenCalled();
	});

	it('stores and returns the same request envelope on a streamed miss', async () => {
		state.getCachedLayout.mockResolvedValue(null);

		const response = await POST({ request: requestForLayout(), cookies: { get: () => 'real-session' } } as never);
		const body = await response.text();

		expect(state.cacheLayout).toHaveBeenCalledWith(state.requestProvenance, state.generatedLayout);
		expect(body).toContain('"provenance":{"marker":"request"}');
	});
});
