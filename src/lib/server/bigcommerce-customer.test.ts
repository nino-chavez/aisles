import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: {
		BIGCOMMERCE_STORE_HASH: 'store-hash',
		KIBBLE_STOREFRONT_TOKEN: 'storefront-token',
		BIGCOMMERCE_PRIVATE_TOKEN: 'private-token',
	},
}));

import {
	BigCommerceCustomerSessionError,
	getBigCommerceCustomerOrders,
	getCart,
	loginBigCommerceCustomer,
	logoutBigCommerceCustomer,
} from './bigcommerce';

describe('BigCommerce customer GraphQL contract', () => {
	beforeEach(() => vi.stubEnv('BRAND_ID', 'kibble'));
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.restoreAllMocks();
	});

	it('logs in server-to-server with the private token and guest cart assignment', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
			data: {
				login: {
					customer: { entityId: 42 },
					cart: { entityId: 'customer-cart' },
					customerAccessToken: { value: 'customer-token', expiresAt: '2099-01-01T00:00:00.000Z' },
				},
			},
		}), { status: 200, headers: { 'content-type': 'application/json' } }));

		await expect(loginBigCommerceCustomer({
			email: 'shopper@example.test',
			password: 'password',
			guestCartEntityId: 'guest-cart',
		})).resolves.toMatchObject({ customerEntityId: 42, cartEntityId: 'customer-cart' });
		const [, init] = fetchMock.mock.calls[0];
		const headers = new Headers(init?.headers);
		const body = JSON.parse(String(init?.body));
		expect(headers.get('Authorization')).toBe('Bearer private-token');
		expect(headers.has('X-Bc-Customer-Access-Token')).toBe(false);
		expect(body.variables).toEqual({
			email: 'shopper@example.test',
			password: 'password',
			guestCartEntityId: 'guest-cart',
		});
		expect(body.query).toContain('guestCartEntityId: $guestCartEntityId');
		expect(body.query).toContain('customerAccessToken { value expiresAt }');
	});

	it('uses both private and customer tokens for order and customer-cart reads', async () => {
		const customer = { customerAccessToken: 'customer-token' };
		const fetchMock = vi.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(new Response(JSON.stringify({
				data: { customer: { orders: { edges: [{ node: {
					entityId: 1001,
					orderedAt: { utc: '2026-08-01T12:00:00.000Z' },
					status: { label: 'Completed' },
					totalIncTax: { value: 24, currencyCode: 'USD' },
					totalProductQuantity: 2,
				} }] } } },
			}), { status: 200, headers: { 'content-type': 'application/json' } }))
			.mockResolvedValueOnce(new Response(JSON.stringify({ data: { site: { cart: null } } }), {
				status: 200,
				headers: { 'content-type': 'application/json' },
			}));

		await expect(getBigCommerceCustomerOrders(customer)).resolves.toEqual([{
			entityId: 1001,
			orderedAt: '2026-08-01T12:00:00.000Z',
			status: 'Completed',
			total: { value: 24, currencyCode: 'USD' },
			itemCount: 2,
		}]);
		await expect(getCart('customer-cart', customer)).resolves.toBeNull();
		for (const [, init] of fetchMock.mock.calls) {
			const headers = new Headers(init?.headers);
			expect(headers.get('Authorization')).toBe('Bearer private-token');
			expect(headers.get('X-Bc-Customer-Access-Token')).toBe('customer-token');
		}
		const orderBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
		expect(orderBody.query).toContain('totalProductQuantity');
		expect(orderBody.query).not.toMatch(/createOrder|payment|subscription/i);
	});

	it('confirms logout before returning the unassigned anonymous cart', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
			data: {
				logout: {
					result: 'success',
					cartUnassignResult: { cart: { entityId: 'anonymous-cart' } },
				},
			},
		}), { status: 200, headers: { 'content-type': 'application/json' } }));

		await expect(logoutBigCommerceCustomer({ customerAccessToken: 'customer-token' }, 'customer-cart'))
			.resolves.toBe('anonymous-cart');
		const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
		expect(headers.get('X-Bc-Customer-Access-Token')).toBe('customer-token');
		const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
		expect(body.variables).toEqual({ cartEntityId: 'customer-cart' });
		expect(body.query).toContain('cartUnassignResult { cart { entityId } }');
	});

	it('distinguishes a missing authenticated customer from an empty order list', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
			data: { customer: null },
		}), { status: 200, headers: { 'content-type': 'application/json' } }));
		await expect(getBigCommerceCustomerOrders({ customerAccessToken: 'expired-token' }))
			.rejects.toBeInstanceOf(BigCommerceCustomerSessionError);
	});
});
