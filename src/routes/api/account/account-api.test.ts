import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	status: vi.fn(),
	login: vi.fn(),
	logout: vi.fn(),
	orders: vi.fn(),
	requireSameOrigin: vi.fn(),
	requireCapacity: vi.fn(),
}));

vi.mock('$lib/server/commerce/boundary', () => ({
	getCommerceServiceBoundary: () => ({
		mode: 'sandbox',
		cart: 'bigcommerce_sandbox',
		checkout: 'bigcommerce_hosted_handoff',
		orderCreation: 'not_exposed',
		orderHistory: 'customer_session_required',
		account: 'bigcommerce_login_ready',
		payment: 'provider_owned',
		subscription: 'provider_not_connected',
		subscriptionPortal: 'portal_session_required',
	}),
}));
vi.mock('$lib/server/commerce/customer-service', () => ({
	customerService: {
		status: mocks.status,
		login: mocks.login,
		logout: mocks.logout,
		orders: mocks.orders,
	},
}));
vi.mock('$lib/server/commerce/session', () => ({
	CommerceRateLimitError: class CommerceRateLimitError extends Error {},
	CommerceSessionUnavailableError: class CommerceSessionUnavailableError extends Error {},
	commerceSessionId: () => 'opaque-session',
	requireCommerceSessionId: () => 'opaque-session',
	requireIdempotencyKey: () => 'request-login1',
	requireSameOrigin: mocks.requireSameOrigin,
	requireCustomerAuthenticationCapacity: mocks.requireCapacity,
}));

import { GET as getSession, POST as login } from './session/+server';
import { GET as getOrders } from './orders/+server';

const services = {
	mode: 'sandbox',
	account: 'bigcommerce_login_ready',
};

function loginEvent(body: unknown) {
	const url = 'https://aisles.test/api/account/session';
	return {
		request: new Request(url, {
			method: 'POST',
			headers: { Origin: 'https://aisles.test', 'Idempotency-Key': 'request-login1' },
			body: JSON.stringify(body),
		}),
		cookies: {},
		getClientAddress: () => '203.0.113.10',
	} as never;
}

describe('Kibble customer API boundary', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.status.mockResolvedValue({ state: 'anonymous', services });
		mocks.login.mockResolvedValue({
			ok: true,
			status: 200,
			data: {
				state: 'authenticated',
				services,
				evidence: { operation: 'account.login', confirmed: true, modelCalls: 0 },
			},
		});
		mocks.orders.mockResolvedValue({
			ok: true,
			status: 200,
			data: {
				orders: [{ orderId: 1001, status: 'Completed', itemCount: 2, orderedAt: '2026-08-01T12:00:00.000Z', total: { value: 24, currencyCode: 'USD' } }],
				services,
				evidence: { operation: 'order.history', confirmed: true, modelCalls: 0 },
			},
		});
	});

	it('returns only redacted customer-session state', async () => {
		const response = await getSession({ cookies: {} } as never);
		expect(response.status).toBe(200);
		expect(response.headers.get('Cache-Control')).toBe('private, no-store');
		expect(await response.json()).toEqual({ state: 'anonymous', services });
	});

	it('rejects invalid credentials locally before calling the provider service', async () => {
		const response = await login(loginEvent({ email: 'not-an-email', password: '' }));
		expect(response.status).toBe(400);
		expect(mocks.login).not.toHaveBeenCalled();
		expect(await response.json()).toMatchObject({
			error: { code: 'invalid_request', retryable: false },
			evidence: { attempted: false, provider: 'none', modelCalls: 0 },
		});
	});

	it('passes credentials once to the server service but never returns them', async () => {
		const response = await login(loginEvent({ email: ' shopper@example.test ', password: 'server-bound-password' }));
		expect(response.status).toBe(200);
		expect(mocks.requireSameOrigin).toHaveBeenCalledTimes(1);
		expect(mocks.requireCapacity).toHaveBeenCalledWith('203.0.113.10');
		expect(mocks.login).toHaveBeenCalledWith('opaque-session', 'request-login1', {
			email: 'shopper@example.test',
			password: 'server-bound-password',
		});
		const serialized = JSON.stringify(await response.json());
		expect(serialized).not.toContain('shopper@example.test');
		expect(serialized).not.toContain('server-bound-password');
	});

	it('exposes only the signed-in customer order read and no order mutation', async () => {
		const response = await getOrders({
			cookies: {},
			url: new URL('https://aisles.test/api/account/orders?limit=500'),
		} as never);
		expect(response.status).toBe(200);
		expect(mocks.orders).toHaveBeenCalledWith('opaque-session', 50);
		expect(await response.json()).toMatchObject({ orders: [{ orderId: 1001 }] });
	});
});
