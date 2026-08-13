import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ ids: ['expired-id'], store: null as Record<string, any> | null }));
const listSessionIds = vi.hoisted(() => vi.fn(async () => state.ids));
const findSessionStore = vi.hoisted(() => vi.fn(async () => state.store));

vi.mock('$lib/signals/session', () => ({ listSessionIds, findSessionStore }));
vi.mock('$lib/signals/scenarios', () => ({ scenarioLabel: vi.fn(() => null) }));

import { GET } from './+server';

describe('/api/observe/sessions identity boundary', () => {
	beforeEach(() => {
		listSessionIds.mockClear();
		findSessionStore.mockClear();
		state.ids = ['expired-id'];
		state.store = null;
	});

	it('omits an ID that no longer has a verified session instead of creating it', async () => {
		const response = await GET({} as never);

		expect(await response.json()).toEqual({ sessionIds: [], sessions: [] });
		expect(findSessionStore).toHaveBeenCalledWith('expired-id', { fresh: true });
	});
});
