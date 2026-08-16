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
import { SignalStore } from './store';

const ownedSessionId = 'owned-id';
const kibbleKey = `aisles:session:kibble-demo-merchant:kibble:${ownedSessionId}`;

describe('scoped signal sessions', () => {
	const previousBrand = process.env.BRAND_ID;
	const previousUrl = process.env.KV_REST_API_URL;
	const previousToken = process.env.KV_REST_API_TOKEN;

	beforeEach(() => {
		process.env.BRAND_ID = 'kibble';
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

		expect(redisState.values.get(kibbleKey)).toMatchObject({
			crossSession: { organizationId: 'kibble-demo-merchant', brandId: 'kibble' },
		});
		expect(await listSessionIds()).toEqual([ownedSessionId]);
	});

	it('fails closed for a stored snapshot with foreign identity', async () => {
		const foreignSessionId = 'foreign-id';
		redisState.values.set(`aisles:session:kibble-demo-merchant:kibble:${foreignSessionId}`, {
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
			crossSession: { brandId: 'kibble', storedPersona: null, storedCategory: null, visitCount: 0, currentCategory: '' },
		});

		expect((await findSessionStore(legacySessionId, { fresh: true }))?.getCrossSessionContext()).toMatchObject({
			organizationId: 'kibble-demo-merchant', brandId: 'kibble',
		});
	});

	it('does not let a crafted cookie ID alias a scoped Redis key through the legacy reader', async () => {
		const victimSessionId = 'victim-id';
		redisState.values.set(`aisles:session:kibble-demo-merchant:kibble:${victimSessionId}`, {
			sessionId: victimSessionId,
			events: [],
			crossSession: {
				organizationId: 'kibble-demo-merchant', brandId: 'kibble', storedPersona: null,
				storedCategory: null, visitCount: 0, currentCategory: '',
			},
		});

		expect(await findSessionStore(`kibble-demo-merchant:kibble:${victimSessionId}`, { fresh: true })).toBeNull();
	});

	it('rejects a write whose stored identity is outside the active scope', async () => {
		const foreign = new SignalStore('foreign-write');
		foreign.setOrganizationId('volt-demo-merchant');
		foreign.setBrandId('volt');
		await expect(persistSession(foreign)).rejects.toThrow('outside the active organization');
	});
});
