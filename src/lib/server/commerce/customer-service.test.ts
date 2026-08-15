import { beforeEach, describe, expect, it, vi } from 'vitest';

const privateEnv = vi.hoisted(() => ({
	KIBBLE_COMMERCE_MODE: 'sandbox',
	KIBBLE_CUSTOMER_IDENTITY_MODE: 'bigcommerce',
	BIGCOMMERCE_STORE_HASH: 'store-hash',
	KIBBLE_STOREFRONT_TOKEN: 'storefront-token',
	BIGCOMMERCE_STOREFRONT_TOKEN: '',
	BIGCOMMERCE_PRIVATE_TOKEN: 'private-token',
	KV_REST_API_URL: '',
	KV_REST_API_TOKEN: '',
}));

vi.mock('$app/environment', () => ({ dev: true }));
vi.mock('$env/dynamic/private', () => ({ env: privateEnv }));
vi.mock('$lib/brand/config', () => ({
	getBrand: () => ({ id: 'kibble', organizationId: 'signal-x-studio' }),
}));

import { BigCommerceGraphQLError } from '$lib/server/bigcommerce';
import { _resetCommerceSessionMemoryForTests, coordinateCommerceMutation, loadCommerceSession } from './session';
import { createCustomerService } from './customer-service';

const future = '2099-01-01T00:00:00.000Z';

function provider() {
	return {
		login: vi.fn(async () => ({
			customerEntityId: 42,
			customerAccessToken: 'server-only-customer-token',
			expiresAt: future,
			cartEntityId: 'customer-cart' as string | null,
		})),
		logout: vi.fn(async () => 'anonymous-cart'),
		orders: vi.fn(async () => [{
			entityId: 1001,
			orderedAt: '2026-08-01T12:00:00.000Z',
			status: 'Completed',
			total: { value: 24, currencyCode: 'USD' },
			itemCount: 2,
		}]),
	};
}

async function seedGuestCart(sessionId: string) {
	await coordinateCommerceMutation({
		sessionId,
		idempotencyKey: 'request-seed-cart',
		fingerprint: 'seed-cart',
		execute: async (state) => {
			state.cartEntityId = 'guest-cart';
			return { state, value: true };
		},
	});
}

describe('Kibble server-owned customer session service', () => {
	beforeEach(() => {
		privateEnv.KIBBLE_CUSTOMER_IDENTITY_MODE = 'bigcommerce';
		privateEnv.BIGCOMMERCE_PRIVATE_TOKEN = 'private-token';
		_resetCommerceSessionMemoryForTests();
	});

	it('merges the guest cart, stores the token only server-side, and safely replays login', async () => {
		const adapter = provider();
		const service = createCustomerService(adapter);
		const sessionId = crypto.randomUUID();
		await seedGuestCart(sessionId);

		const credentials = { email: 'shopper@example.test', password: 'do-not-return' };
		const first = await service.login(sessionId, 'request-login1', credentials);
		const replay = await service.login(sessionId, 'request-login1', credentials);

		expect(adapter.login).toHaveBeenCalledTimes(1);
		expect(adapter.login).toHaveBeenCalledWith({ ...credentials, guestCartEntityId: 'guest-cart' });
		expect(first).toMatchObject({
			ok: true,
			data: {
				state: 'authenticated',
				evidence: {
					confirmed: true,
					sessionStateChanged: 'confirmed',
					guestCartAssignment: 'confirmed',
					modelCalls: 0,
				},
			},
		});
		expect(replay).toMatchObject({ ok: true, data: { replayed: true } });
		const serialized = JSON.stringify({ first, replay });
		for (const secret of ['server-only-customer-token', 'shopper@example.test', 'do-not-return', 'customer-cart', 'customerEntityId']) {
			expect(serialized).not.toContain(secret);
		}

		const state = await loadCommerceSession(sessionId);
		expect(state).toMatchObject({
			cartEntityId: 'customer-cart',
			customerSession: {
				provider: 'bigcommerce',
				customerEntityId: 42,
				customerAccessToken: 'server-only-customer-token',
				expiresAt: future,
			},
		});
	});

	it('uses the server token for read-only order history and confirmed logout', async () => {
		const adapter = provider();
		const service = createCustomerService(adapter);
		const sessionId = crypto.randomUUID();
		await service.login(sessionId, 'request-login1', { email: 'shopper@example.test', password: 'password' });

		const orders = await service.orders(sessionId);
		expect(orders).toMatchObject({
			ok: true,
			data: {
				orders: [{ orderId: 1001, status: 'Completed', itemCount: 2 }],
				evidence: { operation: 'order.history', confirmed: true, sessionStateChanged: 'none' },
			},
		});
		expect(adapter.orders).toHaveBeenCalledWith({ customerAccessToken: 'server-only-customer-token' }, 25);

		const loggedOut = await service.logout(sessionId, 'request-logout1');
		expect(loggedOut).toMatchObject({ ok: true, data: { state: 'anonymous' } });
		expect(adapter.logout).toHaveBeenCalledWith({ customerAccessToken: 'server-only-customer-token' }, 'customer-cart');
		expect(await loadCommerceSession(sessionId)).toMatchObject({
			cartEntityId: 'anonymous-cart',
			customerSession: null,
		});
	});

	it('preserves the guest cart and records no customer session after an ambiguous login', async () => {
		const adapter = provider();
		adapter.login.mockRejectedValueOnce(new BigCommerceGraphQLError('sensitive upstream detail', { outcomeUnknown: true }));
		const service = createCustomerService(adapter);
		const sessionId = crypto.randomUUID();
		await seedGuestCart(sessionId);

		const result = await service.login(sessionId, 'request-login1', { email: 'shopper@example.test', password: 'password' });
		expect(result).toMatchObject({
			ok: false,
			status: 502,
			error: { code: 'provider_outcome_unknown', retryable: false },
			evidence: {
				attempted: true,
				confirmed: false,
				sessionStateChanged: 'not_confirmed',
				guestCartAssignment: 'not_confirmed',
			},
		});
		expect(JSON.stringify(result)).not.toContain('sensitive upstream detail');
		expect(await loadCommerceSession(sessionId)).toMatchObject({
			cartEntityId: 'guest-cart',
			customerSession: null,
		});
	});

	it('rejects an expired customer session before any order provider call', async () => {
		const adapter = provider();
		const service = createCustomerService(adapter);
		const sessionId = crypto.randomUUID();
		await coordinateCommerceMutation({
			sessionId,
			idempotencyKey: 'request-expired1',
			fingerprint: 'expired-session',
			execute: async (state) => {
				state.customerSession = {
					provider: 'bigcommerce',
					customerEntityId: 42,
					customerAccessToken: 'expired-token',
					expiresAt: '2020-01-01T00:00:00.000Z',
				};
				return { state, value: true };
			},
		});
		await expect(service.orders(sessionId)).resolves.toMatchObject({
			ok: false,
			status: 401,
			error: { code: 'customer_session_expired', retryable: false },
			evidence: { attempted: false, provider: 'none' },
		});
		expect(adapter.orders).not.toHaveBeenCalled();
	});

	it('serializes concurrent login attempts for one opaque session', async () => {
		let release!: () => void;
		let started!: () => void;
		const gate = new Promise<void>((resolve) => { release = resolve; });
		const providerStarted = new Promise<void>((resolve) => { started = resolve; });
		const adapter = provider();
		adapter.login.mockImplementationOnce(async () => {
			started();
			await gate;
			return {
				customerEntityId: 42,
				customerAccessToken: 'server-only-customer-token',
				expiresAt: future,
				cartEntityId: null,
			};
		});
		const service = createCustomerService(adapter);
		const sessionId = crypto.randomUUID();
		const first = service.login(sessionId, 'request-login1', { email: 'one@example.test', password: 'password' });
		await providerStarted;
		await expect(service.login(sessionId, 'request-login2', { email: 'two@example.test', password: 'password' })).resolves.toMatchObject({
			ok: false,
			status: 409,
			error: { code: 'operation_in_progress' },
			evidence: { attempted: false },
		});
		release();
		await expect(first).resolves.toMatchObject({ ok: true });
		expect(adapter.login).toHaveBeenCalledTimes(1);
	});

	it('makes no provider call when merchant identity or the private token is missing', async () => {
		const adapter = provider();
		const service = createCustomerService(adapter);
		privateEnv.KIBBLE_CUSTOMER_IDENTITY_MODE = '';
		const result = await service.login(crypto.randomUUID(), 'request-login1', { email: 'shopper@example.test', password: 'password' });
		expect(result).toMatchObject({
			ok: false,
			status: 503,
			error: { code: 'account_not_configured', retryable: false },
			evidence: { attempted: false, provider: 'none' },
		});
		expect(adapter.login).not.toHaveBeenCalled();
	});
});
