import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const privateEnv = vi.hoisted(() => ({
	BIGCOMMERCE_STORE_HASH: 'store-hash',
	KIBBLE_STOREFRONT_TOKEN: 'storefront-token',
	BIGCOMMERCE_PRIVATE_TOKEN: '',
}));

vi.mock('$env/dynamic/private', () => ({
	env: privateEnv,
}));

import {
	BigCommerceGraphQLError,
	addToCart,
	createCartRedirectUrl,
	deleteCartLineItem,
	getCart,
	getCartProductEligibility,
	updateCartLineItem,
} from './bigcommerce';

const cart = {
	entityId: 'cart-one',
	version: 4,
	currencyCode: 'USD',
	amount: { value: 24, currencyCode: 'USD' },
	baseAmount: { value: 24, currencyCode: 'USD' },
	lineItems: {
		physicalItems: [
			{
				entityId: 'line-one',
				productEntityId: 3071,
				variantEntityId: null,
				name: 'Dog food',
				quantity: 2,
				salePrice: { value: 12, currencyCode: 'USD' },
				listPrice: { value: 14, currencyCode: 'USD' },
				extendedSalePrice: { value: 24, currencyCode: 'USD' },
				extendedListPrice: { value: 28, currencyCode: 'USD' },
				imageUrl: null,
				path: '/dog-food/',
				isMutable: true,
			},
		],
	},
};

describe('BigCommerce cart GraphQL contract', () => {
	beforeEach(() => {
		vi.stubEnv('BRAND_ID', 'kibble');
		privateEnv.BIGCOMMERCE_PRIVATE_TOKEN = '';
	});
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.restoreAllMocks();
	});

	it('sends the current cart version on quantity updates', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(
				JSON.stringify({
					data: { cart: { updateCartLineItem: { cart } } },
				}),
				{ status: 200, headers: { 'content-type': 'application/json' } },
			),
		);
		await updateCartLineItem('cart-one', 'line-one', 3071, 2, 3);
		const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
		expect(request.variables).toEqual({
			cartId: 'cart-one',
			lineId: 'line-one',
			productId: 3071,
			quantity: 2,
			version: 3,
		});
		expect(request.query).toContain('version: $version');
		expect(request.query).toContain('version');
		expect(request.query).toContain('isMutable');
		expect(request.query).toContain('path');
		expect(request.query).not.toMatch(/\n\s*url\s*\n/);
	});

	it('prefers the private token for Kibble server-to-server cart calls', async () => {
		privateEnv.BIGCOMMERCE_PRIVATE_TOKEN = 'private-token';
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: { site: { cart } } }), {
			status: 200,
			headers: { 'content-type': 'application/json' },
		}));
		await getCart('cart-one');
		expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('Authorization')).toBe('Bearer private-token');
	});

	it('revalidates stock and optionlessness from provider catalog data', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(
				JSON.stringify({
					data: {
						site: {
							product: {
								entityId: 3071,
								inventory: { isInStock: true },
								productOptions: { edges: [] },
							},
						},
					},
				}),
				{ status: 200, headers: { 'content-type': 'application/json' } },
			),
		);
		await expect(getCartProductEligibility(3071)).resolves.toEqual({
			entityId: 3071,
			isInStock: true,
			hasOptions: false,
		});
		const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
		expect(request.variables).toEqual({ entityId: 3071 });
		expect(request.query).toContain('inventory { isInStock }');
		expect(request.query).toContain('productOptions(first: 1)');
	});

	it('does not make an unclassified mutation error safe to repeat', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(
				JSON.stringify({
					errors: [{ message: 'Provider did not return mutation data' }],
				}),
				{ status: 200, headers: { 'content-type': 'application/json' } },
			),
		);
		await expect(updateCartLineItem('cart-one', 'line-one', 3071, 2, 3)).rejects.toMatchObject({
			outcomeUnknown: true,
		});
	});

	it('treats a successful response without mutation data as ambiguous', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ data: null }), {
				status: 200,
				headers: { 'content-type': 'application/json' },
			}),
		);
		await expect(updateCartLineItem('cart-one', 'line-one', 3071, 2, 3)).rejects.toMatchObject({
			outcomeUnknown: true,
		});
	});

	it('treats a partial add mutation payload as ambiguous instead of retryable', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ data: { cart: { addCartLineItems: { cart: null } } } }), {
				status: 200,
				headers: { 'content-type': 'application/json' },
			}),
		);
		await expect(addToCart('cart-one', 3071, 1, 4)).rejects.toMatchObject({ outcomeUnknown: true });
	});

	it('requires explicit last-cart deletion evidence when line removal omits the cart', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(
				JSON.stringify({ data: { cart: { deleteCartLineItem: { cart: null, deletedLineItemEntityId: 'line-one', deletedCartEntityId: null } } } }),
				{ status: 200, headers: { 'content-type': 'application/json' } },
			),
		);
		await expect(deleteCartLineItem('cart-one', 'line-one', 4)).rejects.toMatchObject({ outcomeUnknown: true });
	});

	it('leaves nullable cart versions to the commerce boundary instead of breaking shared catalog brands', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ data: { site: { cart: { ...cart, version: null } } } }), {
				status: 200,
				headers: { 'content-type': 'application/json' },
			}),
		);
		await expect(getCart('cart-one')).resolves.toMatchObject({ version: null });
	});

	it('requests only the hosted checkout URL and does not create an order', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(
				JSON.stringify({
					data: {
						cart: {
							createCartRedirectUrls: {
								redirectUrls: {
									redirectedCheckoutUrl: 'https://store.example.test/checkout/token',
								},
							},
						},
					},
				}),
				{ status: 200, headers: { 'content-type': 'application/json' } },
			),
		);
		await expect(createCartRedirectUrl('cart-one')).resolves.toContain('/checkout/token');
		const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
		expect(request.query).toContain('createCartRedirectUrls');
		expect(request.query).not.toMatch(/createOrder|payment|subscription/i);
	});

	it('rejects a non-HTTPS checkout handoff URL', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(
				JSON.stringify({
					data: {
						cart: {
							createCartRedirectUrls: {
								redirectUrls: { redirectedCheckoutUrl: 'javascript:alert(1)' },
							},
						},
					},
				}),
				{ status: 200, headers: { 'content-type': 'application/json' } },
			),
		);
		await expect(createCartRedirectUrl('cart-one')).rejects.toBeInstanceOf(BigCommerceGraphQLError);
	});
});
