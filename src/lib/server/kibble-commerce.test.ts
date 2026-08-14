import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	addKibbleCartLine,
	createKibbleCart,
	createKibbleCheckoutRedirect,
	getKibbleCart,
	type KibbleCart,
} from './kibble-commerce';

vi.mock('$env/dynamic/private', () => ({
	env: {
		BIGCOMMERCE_STORE_HASH: 'test-store',
		BIGCOMMERCE_PRIVATE_TOKEN: 'private-token',
	},
}));

vi.mock('$lib/brand/config', () => ({
	getBrand: () => ({ id: 'kibble', bc: { channelId: 1 } }),
}));

const cart: KibbleCart = {
	entityId: 'cart-1',
	currencyCode: 'USD',
	baseAmount: { value: 20, currencyCode: 'USD' },
	discountedAmount: { value: 20, currencyCode: 'USD' },
	amount: { value: 20, currencyCode: 'USD' },
	lineItems: {
		totalQuantity: 1,
		physicalItems: [{
			entityId: 'line-1', parentEntityId: null, variantEntityId: null, productEntityId: 42,
			sku: 'SKU-42', name: 'Fixture food', path: '/fixture-food/', imageUrl: null, quantity: 1,
			listPrice: { value: 20, currencyCode: 'USD' }, salePrice: { value: 20, currencyCode: 'USD' },
			extendedListPrice: { value: 20, currencyCode: 'USD' }, extendedSalePrice: { value: 20, currencyCode: 'USD' },
			selectedOptions: [],
		}],
	},
};

function response(data: unknown, headers: Record<string, string> = {}): Response {
	return new Response(JSON.stringify({ data }), { status: 200, headers: { 'content-type': 'application/json', ...headers } });
}

describe('Kibble commerce adapter', () => {
	afterEach(() => vi.restoreAllMocks());

	it('uses the server-only private token and captures the provider session cookie', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ cart: { createCart: { cart } } }, { 'set-cookie': 'bc_session=session-1; Path=/' }));
		const result = await createKibbleCart({
			productEntityId: 42,
			quantity: 1,
			selectedOptions: { multipleChoices: [{ optionEntityId: 7, optionValueEntityId: 8 }] },
		});

		expect(result.cart.entityId).toBe('cart-1');
		expect(result.sessionCookie).toBe('bc_session=session-1');
		const [, init] = fetchMock.mock.calls[0];
		const headers = new Headers(init?.headers);
		expect(headers.get('authorization')).toBe('Bearer private-token');
		expect(headers.get('x-bc-customer-access-token')).toBeNull();
		const body = JSON.parse(String(init?.body));
		expect(body.variables.input.lineItems[0].selectedOptions.multipleChoices).toEqual([{ optionEntityId: 7, optionValueEntityId: 8 }]);
	});

	it('replays the cart session cookie and optional customer context on subsequent operations', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ cart: { addCartLineItems: { cart } } }));
		await addKibbleCartLine('cart-1', { productEntityId: 42, quantity: 2 }, { sessionCookie: 'bc_session=session-1', customerAccessToken: 'customer-token' });
		const [, init] = fetchMock.mock.calls[0];
		const headers = new Headers(init?.headers);
		expect(headers.get('cookie')).toBe('bc_session=session-1');
		expect(headers.get('x-bc-customer-access-token')).toBe('customer-token');
	});

	it('requests the provider-owned hosted checkout redirect URL', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({
			cart: { createCartRedirectUrls: { redirectUrls: { redirectedCheckoutUrl: 'https://store-test.mybigcommerce.com/checkout/redirect-token' } } },
		}));
		await expect(createKibbleCheckoutRedirect('cart-1', { sessionCookie: 'bc_session=session-1' }))
			.resolves.toBe('https://store-test.mybigcommerce.com/checkout/redirect-token');
		const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
		expect(body.query).toContain('createCartRedirectUrls');
		expect(body.variables).toEqual({ cartId: 'cart-1' });
	});

	it('reads a cart with its entity ID and session cookie', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ site: { cart } }));
		await getKibbleCart('cart-1', { sessionCookie: 'bc_session=session-1' });
		const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
		expect(body.variables).toEqual({ cartId: 'cart-1' });
		expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('cookie')).toBe('bc_session=session-1');
	});
});

