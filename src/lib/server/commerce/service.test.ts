import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { KIBBLE_COMMERCE_MODE: 'sandbox' },
}));

import { BigCommerceGraphQLError, type CartResponse } from '$lib/server/bigcommerce';
import { _resetCommerceSessionMemoryForTests } from './session';
import { createCommerceService } from './service';

function cart(version: number, quantity = 1, isMutable = true): CartResponse {
	return {
		entityId: 'bc-cart-one',
		version,
		currencyCode: 'USD',
		amount: { value: 12 * quantity, currencyCode: 'USD' },
		baseAmount: { value: 12 * quantity, currencyCode: 'USD' },
		lineItems: {
			physicalItems:
				quantity === 0
					? []
					: [
							{
								entityId: 'line-one',
								productEntityId: 3071,
								variantEntityId: null,
								name: 'Sandbox dog food',
								quantity,
								salePrice: { value: 12, currencyCode: 'USD' },
								listPrice: { value: 14, currencyCode: 'USD' },
								extendedSalePrice: {
									value: 12 * quantity,
									currencyCode: 'USD',
								},
								extendedListPrice: {
									value: 14 * quantity,
									currencyCode: 'USD',
								},
								imageUrl: 'https://cdn.example.test/dog-food.jpg',
								path: '/dog-food/',
								isMutable,
							},
						],
		},
	};
}

describe('Kibble BigCommerce cart service integration', () => {
	beforeEach(() => {
		vi.stubEnv('BRAND_ID', 'kibble');
		_resetCommerceSessionMemoryForTests();
	});

	it('creates, reads, updates, removes, and safely replays a cart operation', async () => {
		let providerCart: CartResponse | null = null;
		const provider = {
			getCartProductEligibility: vi.fn(async () => ({ entityId: 3071, isInStock: true, hasOptions: false })),
			createCart: vi.fn(async () => (providerCart = cart(1, 1))),
			addToCart: vi.fn(async () => (providerCart = cart((providerCart?.version ?? 0) + 1, 2))),
			getCart: vi.fn(async () => providerCart),
			updateCartLineItem: vi.fn(async (_cartId: string, _lineId: string, _productId: number, quantity: number, version: number) => (providerCart = cart(version + 1, quantity))),
			deleteCartLineItem: vi.fn(async () => (providerCart = null)),
			deleteCart: vi.fn(async () => {
				providerCart = null;
			}),
			createCartRedirectUrl: vi.fn(async () => 'https://store.example.test/checkout/token'),
		};
		const service = createCommerceService(provider);
		const sessionId = crypto.randomUUID();

		const added = await service.add(sessionId, 'request-add1', {
			productEntityId: 3071,
			quantity: 1,
		});
		const replay = await service.add(sessionId, 'request-add1', {
			productEntityId: 3071,
			quantity: 1,
		});
		expect(added.ok && added.data).toMatchObject({
			itemCount: 1,
			evidence: {
				confirmed: true,
				commerceStateChanged: 'confirmed',
				modelCalls: 0,
			},
		});
		expect(replay.ok && replay.data.replayed).toBe(true);
		expect(provider.createCart).toHaveBeenCalledTimes(1);

		const read = await service.read(sessionId);
		expect(read.ok && read.data.cart).toMatchObject({
			version: 1,
			itemCount: 1,
			total: { value: 12 },
			lines: [{ productPath: '/product/dog-food', isMutable: true }],
		});
		expect(JSON.stringify(read)).not.toContain('bc-cart-one');

		const updated = await service.update(sessionId, 'request-upd1', {
			lineId: 'line-one',
			quantity: 3,
		});
		expect(updated.ok && updated.data.itemCount).toBe(3);
		expect(provider.updateCartLineItem).toHaveBeenCalledWith('bc-cart-one', 'line-one', 3071, 3, 1);

		const removed = await service.remove(sessionId, 'request-rem1', {
			lineId: 'line-one',
		});
		expect(removed.ok && removed.data).toMatchObject({
			cart: null,
			itemCount: 0,
		});
		expect(provider.deleteCartLineItem).toHaveBeenCalledWith('bc-cart-one', 'line-one', 2);

		await service.add(sessionId, 'request-add2', {
			productEntityId: 3071,
			quantity: 1,
		});
		const emptied = await service.empty(sessionId, 'request-emp1');
		expect(emptied.ok && emptied.data).toMatchObject({
			cart: null,
			itemCount: 0,
		});
		expect(provider.deleteCart).toHaveBeenCalledWith('bc-cart-one');
	});

	it('rejects provider-immutable line changes before either mutation is sent', async () => {
		let providerCart: CartResponse | null = null;
		const provider = {
			getCartProductEligibility: vi.fn(async () => ({ entityId: 3071, isInStock: true, hasOptions: false })),
			createCart: vi.fn(async () => (providerCart = cart(1, 1, false))),
			addToCart: vi.fn(),
			getCart: vi.fn(async () => providerCart),
			updateCartLineItem: vi.fn(),
			deleteCartLineItem: vi.fn(),
			deleteCart: vi.fn(),
			createCartRedirectUrl: vi.fn(),
		};
		const service = createCommerceService(provider as never);
		const sessionId = crypto.randomUUID();
		await service.add(sessionId, 'request-add1', { productEntityId: 3071, quantity: 1 });

		await expect(service.update(sessionId, 'request-upd1', { lineId: 'line-one', quantity: 2 })).resolves.toMatchObject({
			ok: false,
			status: 409,
			error: { code: 'line_not_mutable', retryable: false },
		});
		await expect(service.remove(sessionId, 'request-rem1', { lineId: 'line-one' })).resolves.toMatchObject({
			ok: false,
			status: 409,
			error: { code: 'line_not_mutable', retryable: false },
		});
		expect(provider.updateCartLineItem).not.toHaveBeenCalled();
		expect(provider.deleteCartLineItem).not.toHaveBeenCalled();
	});

	it('replaces a cart only after BigCommerce confirms the stored cart is gone', async () => {
		let providerCart: CartResponse | null = null;
		const provider = {
			getCartProductEligibility: vi.fn(async () => ({ entityId: 3071, isInStock: true, hasOptions: false })),
			createCart: vi.fn(async () => (providerCart = cart(1))),
			addToCart: vi.fn(),
			getCart: vi.fn(async () => providerCart),
			updateCartLineItem: vi.fn(),
			deleteCartLineItem: vi.fn(),
			deleteCart: vi.fn(),
			createCartRedirectUrl: vi.fn(),
		};
		const service = createCommerceService(provider as never);
		const sessionId = crypto.randomUUID();
		await service.add(sessionId, 'request-add1', {
			productEntityId: 3071,
			quantity: 1,
		});
		providerCart = null;
		const recovered = await service.add(sessionId, 'request-add2', {
			productEntityId: 3071,
			quantity: 1,
		});
		expect(recovered.ok && recovered.data.itemCount).toBe(1);
		expect(provider.createCart).toHaveBeenCalledTimes(2);
		expect(provider.addToCart).not.toHaveBeenCalled();
	});

	it('does not let a delayed stale read erase a newer cart reference', async () => {
		let providerCart: CartResponse | null = null;
		let delayNextRead = false;
		let releaseRead!: () => void;
		let markReadStarted!: () => void;
		const readGate = new Promise<void>((resolve) => {
			releaseRead = resolve;
		});
		const readStarted = new Promise<void>((resolve) => {
			markReadStarted = resolve;
		});
		const provider = {
			getCartProductEligibility: vi.fn(async () => ({ entityId: 3071, isInStock: true, hasOptions: false })),
			createCart: vi.fn(async () => (providerCart = cart(1))),
			addToCart: vi.fn(async () => (providerCart = cart(2, 2))),
			getCart: vi.fn(async () => {
				if (!delayNextRead) return providerCart;
				delayNextRead = false;
				markReadStarted();
				await readGate;
				return null;
			}),
			updateCartLineItem: vi.fn(),
			deleteCartLineItem: vi.fn(),
			deleteCart: vi.fn(),
			createCartRedirectUrl: vi.fn(),
		};
		const service = createCommerceService(provider as never);
		const sessionId = crypto.randomUUID();
		await service.add(sessionId, 'request-add1', {
			productEntityId: 3071,
			quantity: 1,
		});

		delayNextRead = true;
		const staleRead = service.read(sessionId);
		await readStarted;
		const added = await service.add(sessionId, 'request-add2', {
			productEntityId: 3071,
			quantity: 1,
		});
		expect(added.ok && added.data.itemCount).toBe(2);
		releaseRead();
		expect((await staleRead).ok).toBe(true);

		const current = await service.read(sessionId);
		expect(current.ok && current.data.cart).toMatchObject({
			version: 2,
			itemCount: 2,
		});
	});

	it('fails the Kibble cart boundary when BigCommerce omits its concurrency version', async () => {
		let providerCart: CartResponse | null = null;
		const provider = {
			getCartProductEligibility: vi.fn(async () => ({ entityId: 3071, isInStock: true, hasOptions: false })),
			createCart: vi.fn(async () => (providerCart = cart(1))),
			addToCart: vi.fn(),
			getCart: vi.fn(async () => providerCart),
			updateCartLineItem: vi.fn(),
			deleteCartLineItem: vi.fn(),
			deleteCart: vi.fn(),
			createCartRedirectUrl: vi.fn(),
		};
		const service = createCommerceService(provider as never);
		const sessionId = crypto.randomUUID();
		await service.add(sessionId, 'request-add1', { productEntityId: 3071, quantity: 1 });
		providerCart = { ...cart(1), version: null } as unknown as CartResponse;
		await expect(service.read(sessionId)).resolves.toMatchObject({
			ok: false,
			error: { code: 'provider_unavailable', retryable: true },
			evidence: { attempted: true, confirmed: false, commerceStateChanged: 'none' },
		});
	});

	it('mints hosted checkout only after validating a non-empty cart', async () => {
		let providerCart: CartResponse | null = null;
		let redirectSequence = 0;
		const provider = {
			getCartProductEligibility: vi.fn(async () => ({ entityId: 3071, isInStock: true, hasOptions: false })),
			createCart: vi.fn(async () => (providerCart = cart(1))),
			addToCart: vi.fn(),
			getCart: vi.fn(async () => providerCart),
			updateCartLineItem: vi.fn(),
			deleteCartLineItem: vi.fn(),
			deleteCart: vi.fn(),
			createCartRedirectUrl: vi.fn(async () => `https://store.example.test/checkout/token-${++redirectSequence}`),
		};
		const service = createCommerceService(provider as never);
		const sessionId = crypto.randomUUID();
		await service.add(sessionId, 'request-add1', {
			productEntityId: 3071,
			quantity: 1,
		});
		const result = await service.checkout(sessionId, 'request-chk1');
		expect(result.ok && result.data.redirectUrl).toBe('https://store.example.test/checkout/token-1');
		expect(result.ok && result.data.evidence).toMatchObject({
			confirmed: true,
			commerceStateChanged: 'none',
			modelCalls: 0,
		});
		const repeated = await service.checkout(sessionId, 'request-chk1');
		expect(repeated.ok && repeated.data.redirectUrl).toBe('https://store.example.test/checkout/token-2');
		expect(repeated.ok && repeated.data.replayed).not.toBe(true);
		expect(provider.createCartRedirectUrl).toHaveBeenCalledTimes(2);
	});

	it('does not retry or expose an ambiguous provider outcome', async () => {
		const provider = {
			getCartProductEligibility: vi.fn(async () => ({ entityId: 3071, isInStock: true, hasOptions: false })),
			createCart: vi.fn(async () => {
				throw new BigCommerceGraphQLError('secret upstream detail', {
					outcomeUnknown: true,
				});
			}),
			addToCart: vi.fn(),
			getCart: vi.fn(async () => null),
			updateCartLineItem: vi.fn(),
			deleteCartLineItem: vi.fn(),
			deleteCart: vi.fn(),
			createCartRedirectUrl: vi.fn(),
		};
		const service = createCommerceService(provider as never);
		const sessionId = crypto.randomUUID();
		const result = await service.add(sessionId, 'request-add1', {
			productEntityId: 3071,
			quantity: 1,
		});
		const replay = await service.add(sessionId, 'request-add1', {
			productEntityId: 3071,
			quantity: 1,
		});
		expect(result).toMatchObject({
			ok: false,
			status: 502,
			error: { code: 'provider_outcome_unknown', retryable: false },
			evidence: { attempted: true, confirmed: false, modelCalls: 0 },
		});
		expect(JSON.stringify(result)).not.toContain('secret upstream detail');
		expect(replay).toMatchObject({
			ok: false,
			replayed: true,
			error: { code: 'provider_outcome_unknown' },
		});
		expect(provider.createCart).toHaveBeenCalledTimes(1);
	});

	it('reports no provider attempt when local session state rejects a mutation', async () => {
		const provider = {
			getCartProductEligibility: vi.fn(),
			createCart: vi.fn(),
			addToCart: vi.fn(),
			getCart: vi.fn(),
			updateCartLineItem: vi.fn(),
			deleteCartLineItem: vi.fn(),
			deleteCart: vi.fn(),
			createCartRedirectUrl: vi.fn(),
		};
		const service = createCommerceService(provider as never);
		const result = await service.update(crypto.randomUUID(), 'request-upd1', {
			lineId: 'line-one',
			quantity: 2,
		});
		expect(result).toMatchObject({
			ok: false,
			error: { code: 'cart_not_found' },
			evidence: {
				attempted: false,
				confirmed: false,
				provider: 'none',
				modelCalls: 0,
			},
		});
		expect(provider.getCart).not.toHaveBeenCalled();
		expect(provider.updateCartLineItem).not.toHaveBeenCalled();
	});

	it('rejects optioned or unavailable products before a cart mutation', async () => {
		const provider = {
			getCartProductEligibility: vi.fn(async () => ({ entityId: 3071, isInStock: true, hasOptions: true })),
			createCart: vi.fn(),
			addToCart: vi.fn(),
			getCart: vi.fn(async () => null),
			updateCartLineItem: vi.fn(),
			deleteCartLineItem: vi.fn(),
			deleteCart: vi.fn(),
			createCartRedirectUrl: vi.fn(),
		};
		const service = createCommerceService(provider as never);
		const result = await service.add(crypto.randomUUID(), 'request-add1', {
			productEntityId: 3071,
			quantity: 1,
		});
		expect(result).toMatchObject({
			ok: false,
			status: 422,
			error: { code: 'product_not_available' },
			evidence: { attempted: true, confirmed: false, commerceStateChanged: 'none' },
		});
		expect(provider.createCart).not.toHaveBeenCalled();
		expect(provider.addToCart).not.toHaveBeenCalled();
	});
});
