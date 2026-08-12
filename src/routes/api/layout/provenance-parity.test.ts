import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
	buildProvenance: vi.fn(),
	requestProvenance: { marker: 'request' } as Record<string, unknown>,
	storedProvenance: { marker: 'stored' } as Record<string, unknown>,
}));

vi.mock('ai', () => ({
	generateText: vi.fn(),
	streamText: vi.fn(),
	Output: { object: vi.fn(() => ({})) },
}));
vi.mock('$lib/server/model', () => ({
	model: vi.fn(),
	withModelFallback: vi.fn(),
	PRIMARY_MODEL: 'test-model',
}));
vi.mock('$lib/schema/layout', () => ({ layoutSchemaFor: vi.fn(() => ({})) }));
vi.mock('$lib/server/layout-prompt', () => ({
	buildLayoutPrompt: vi.fn(() => 'identical prompt'),
	PROMPT_VERSION: 'v5',
}));
vi.mock('$lib/server/catalog', () => ({
	loadCategoryProducts: vi.fn(async () => ({ products: [{ id: 'one' }], categoryName: 'Dog food' })),
	loadHomeProducts: vi.fn(async () => ({ products: [{ id: 'one' }], categoryName: 'Home' })),
}));
vi.mock('$lib/server/cache', () => ({
	getCachedLayout: vi.fn(async () => ({
		layout: { zone: 'cached' },
		provenance: state.storedProvenance,
	})),
	cacheLayout: vi.fn(),
}));
vi.mock('$lib/server/generation-log', () => ({ logGeneration: vi.fn(async () => {}) }));
vi.mock('$lib/server/rules', () => ({
	getActiveRules: vi.fn(async () => []),
	rulesToPromptContext: vi.fn(() => ''),
}));
vi.mock('$lib/signals/session', () => ({
	hasSession: vi.fn(async () => false),
	getSessionStore: vi.fn(),
}));
vi.mock('$lib/brand/config', () => ({
	getBrand: vi.fn(() => ({ organizationId: 'test-org', id: 'test-brand' })),
}));
vi.mock('$lib/server/layout-provenance', () => ({
	buildLegacyLayoutProvenance: state.buildProvenance,
	LEGACY_LAYOUT_SCHEMA_VERSION: 'legacy-layout-schema-v1',
}));

import { POST as nonStreamingPost } from './+server';
import { POST as streamingPost } from './stream/+server';

function request(path: string) {
	return new Request(`http://localhost${path}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			persona: 'researcher',
			categorySlug: 'dog-food',
			picksContext: 'one',
			probabilities: { gatherer: 0.1, hunter: 0.1, researcher: 0.7, gifter: 0.1 },
			incentives: { walletBalanceMinor: 100 },
		}),
	});
}

describe('layout API provenance parity', () => {
	beforeEach(() => {
		state.requestProvenance = { marker: 'request' };
		state.storedProvenance = { marker: 'stored' };
		state.buildProvenance.mockReset().mockReturnValue(state.requestProvenance);
	});

	it('builds the same trusted identity for streaming and non-streaming requests', async () => {
		const event = (path: string) => ({ request: request(path), cookies: { get: () => 'real-session' } }) as never;

		await nonStreamingPost(event('/api/layout'));
		await streamingPost(event('/api/layout/stream'));

		expect(state.buildProvenance).toHaveBeenCalledTimes(2);
		expect(state.buildProvenance.mock.calls[0][0]).toEqual(state.buildProvenance.mock.calls[1][0]);
	});
});
