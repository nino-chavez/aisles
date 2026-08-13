import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const redisState = vi.hoisted(() => ({ values: new Map<string, unknown>() }));

vi.mock('@upstash/redis', () => ({
	Redis: class {
		async get<T>(key: string): Promise<T | null> {
			return (redisState.values.get(key) as T | undefined) ?? null;
		}
		async set(key: string, value: unknown) {
			redisState.values.set(key, value);
		}
		async scan(cursor: number, { match }: { match: string }) {
			const prefix = match.slice(0, -1);
			return [0, [...redisState.values.keys()].filter((key) => key.startsWith(prefix))] as const;
		}
	},
}));
vi.mock('$env/dynamic/private', () => ({ env: process.env }));

import { findSessionStore, getSessionStore, listSessionIds, persistSession } from './session';

const ownedSessionId = 'owned-id';
const havenKey = `aisles:session:haven-demo-merchant:haven:${ownedSessionId}`;

describe('scoped signal sessions', () => {
	const previousBrand = process.env.BRAND_ID;
	const previousUrl = process.env.KV_REST_API_URL;
	const previousToken = process.env.KV_REST_API_TOKEN;

	beforeEach(() => {
		process.env.BRAND_ID = 'haven';
		process.env.KV_REST_API_URL = 'https://redis.test';
		process.env.KV_REST_API_TOKEN = 'test-token';
		redisState.values.clear();
	});

	afterEach(() => {
		if (previousBrand === undefined) delete process.env.BRAND_ID;
		else process.env.BRAND_ID = previousBrand;
		if (previousUrl === undefined) delete process.env.KV_REST_API_URL;
		else process.env.KV_REST_API_URL = previousUrl;
		if (previousToken === undefined) delete process.env.KV_REST_API_TOKEN;
		else process.env.KV_REST_API_TOKEN = previousToken;
	});

	it('writes and enumerates only the active organization and brand scope', async () => {
		const store = await getSessionStore(ownedSessionId);
		store.emit('nav.product_view', 'navigation', {});
		await persistSession(store);

		expect(redisState.values.get(havenKey)).toMatchObject({
			crossSession: { organizationId: 'haven-demo-merchant', brandId: 'haven' },
		});
		expect(await listSessionIds()).toEqual([ownedSessionId]);
	});

	it('fails closed for a stored snapshot with foreign identity', async () => {
		const foreignSessionId = 'foreign-id';
		redisState.values.set(`aisles:session:haven-demo-merchant:haven:${foreignSessionId}`, {
			sessionId: foreignSessionId,
			events: [],
			crossSession: {
				organizationId: 'volt-demo-merchant', brandId: 'volt', storedPersona: null,
				storedCategory: null, visitCount: 0, currentCategory: '',
			},
		});

		expect(await findSessionStore(foreignSessionId, { fresh: true })).toBeNull();
		expect(await listSessionIds()).not.toContain(foreignSessionId);
	});

	it('accepts a legacy global snapshot only when its brand resolves to the active organization', async () => {
		const legacySessionId = 'legacy-id';
		redisState.values.set(`aisles:session:${legacySessionId}`, {
			sessionId: legacySessionId,
			events: [],
			crossSession: { brandId: 'haven', storedPersona: null, storedCategory: null, visitCount: 0, currentCategory: '' },
		});

		expect((await findSessionStore(legacySessionId, { fresh: true }))?.getCrossSessionContext()).toMatchObject({
			organizationId: 'haven-demo-merchant', brandId: 'haven',
		});
	});
});
