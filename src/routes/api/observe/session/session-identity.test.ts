import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ store: null as Record<string, any> | null }));
const findSessionStore = vi.hoisted(() => vi.fn(async () => state.store));

vi.mock('$lib/signals/session', () => ({ findSessionStore }));
vi.mock('$lib/signals/inference', () => ({ infer: vi.fn(() => ({ primary: 'gatherer' })) }));
vi.mock('$lib/signals/scenarios', () => ({ scenarioLabel: vi.fn(() => null) }));

import { GET } from './+server';

describe('/api/observe/session identity boundary', () => {
	beforeEach(() => {
		findSessionStore.mockClear();
		state.store = null;
	});

	it('does not create or return a session when the scoped lookup rejects its identity', async () => {
		const response = await GET({ url: new URL('http://localhost/api/observe/session?id=foreign-id') } as never);

		expect(response.status).toBe(404);
		expect(findSessionStore).toHaveBeenCalledWith('foreign-id', { fresh: true });
	});

	it('returns a validated session', async () => {
		state.store = {
			getEvents: () => [],
			toInferenceContext: () => ({}),
			getCrossSessionContext: () => ({ scenarioId: null }),
		};

		const response = await GET({ url: new URL('http://localhost/api/observe/session?id=owned-id') } as never);
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ sessionId: 'owned-id', eventCount: 0 });
	});
});
