import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	KIBBLE_COMMERCE_SESSION_COOKIE,
	clearKibbleCommerceSession,
	createKibbleCommerceSession,
	getKibbleCommerceSession,
	resetKibbleCommerceSessionsForTest,
	setKibbleCommerceSessionCookie,
} from './kibble-commerce-session';

vi.mock('$env/dynamic/private', () => ({ env: {} }));
vi.mock('$app/environment', () => ({ dev: true }));

function cookies() {
	const values = new Map<string, string>();
	return {
		values,
		get: (name: string) => values.get(name),
		set: (name: string, value: string) => { values.set(name, value); },
		delete: (name: string) => { values.delete(name); },
	};
}

describe('Kibble commerce sessions', () => {
	afterEach(() => { resetKibbleCommerceSessionsForTest(); vi.restoreAllMocks(); });

	it('stores provider credentials server-side behind an opaque cookie', async () => {
		const jar = cookies();
		const sessionId = await createKibbleCommerceSession({
			customer: { entityId: 9, firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' },
			accessToken: 'customer-token',
			accessTokenExpiresAt: '2099-01-01T00:00:00Z',
			cartEntityId: 'cart-9',
			providerSessionCookie: 'bc_session=session-9',
		});
		await setKibbleCommerceSessionCookie(jar as never, sessionId);
		expect(jar.values.get(KIBBLE_COMMERCE_SESSION_COOKIE)).toBe(sessionId);
		expect(jar.values.get(KIBBLE_COMMERCE_SESSION_COOKIE)).not.toContain('customer-token');
		expect(await getKibbleCommerceSession(jar)).toMatchObject({ customer: { entityId: 9 }, accessToken: 'customer-token', cartEntityId: 'cart-9' });
	});

	it('clears the session cookie and server-side entry on logout', async () => {
		const jar = cookies();
		const sessionId = await createKibbleCommerceSession({
			customer: { entityId: 9, firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' },
			accessToken: 'customer-token', accessTokenExpiresAt: null, cartEntityId: null, providerSessionCookie: null,
		});
		await setKibbleCommerceSessionCookie(jar as never, sessionId);
		expect(await getKibbleCommerceSession(jar)).not.toBeNull();
		await clearKibbleCommerceSession(jar as never);
		expect(jar.values.has(KIBBLE_COMMERCE_SESSION_COOKIE)).toBe(false);
		expect(await getKibbleCommerceSession(jar)).toBeNull();
	});
});
