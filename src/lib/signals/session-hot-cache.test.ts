import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: {
		KV_REST_API_URL: '',
		KV_REST_API_TOKEN: '',
	},
}));

import { findSessionStore, getSessionStore } from './session';

describe('memory-only signal session reads', () => {
	it('returns the scope-checked hot session for a fresh Observe read when Redis is unavailable', async () => {
		const store = await getSessionStore('observe-hot-session');
		store.emit('nav.search', 'navigation', { query: 'birthday gift present' });

		expect(await findSessionStore('observe-hot-session', { fresh: true })).toBe(store);
		expect(await findSessionStore('unknown-session', { fresh: true })).toBeNull();
	});
});
