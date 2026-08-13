import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	executeHidden: vi.fn(),
}));

vi.mock('$lib/brand/reference/kibble-zone-executor.server', async (importOriginal) => ({
	...await importOriginal<typeof import('$lib/brand/reference/kibble-zone-executor.server')>(),
	executeKibbleHiddenZoneTerminalsForRoute: mocks.executeHidden,
}));

import { load } from './+layout.server';

const trustedRoutes = [
	'/', '/search', '/cart', '/subscriptions', '/account', '/account/login', '/account/register',
	'/account/logout', '/account/orders', '/account/addresses', '/account/payment-methods',
	'/account/subscriptions', '/checkout', '/checkout/gift', '/checkout/prepaid', '/checkout/confirmation',
	'/store-locator', '/category/dog-food', '/product/reference-product',
	'/portal/subscriptions/subscription-123',
] as const;

describe('Kibble runtime zone boundary', () => {
	const previousBrand = process.env.BRAND_ID;
	const cookies = { get: () => undefined, set: () => undefined, delete: () => undefined };

	beforeEach(() => {
		process.env.BRAND_ID = 'kibble';
		mocks.executeHidden.mockReset().mockResolvedValue([]);
	});

	afterEach(() => {
		if (previousBrand === undefined) delete process.env.BRAND_ID;
		else process.env.BRAND_ID = previousBrand;
		vi.restoreAllMocks();
	});

	it('executes and discards trusted-Hidden terminals on every exact shopper route shape', async () => {
		for (const routePath of trustedRoutes) {
			const data = await load({ url: new URL(`https://aisles.test${routePath}`), cookies } as never);
			expect(data).not.toHaveProperty('kibbleZoneTerminals');
			expect(data).not.toHaveProperty('hiddenZoneTerminals');
		}
		expect(mocks.executeHidden.mock.calls.map(([routePath]) => routePath)).toEqual(trustedRoutes);
	});

	it('binds a real error-empty terminal when trusted-Hidden execution fails', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		mocks.executeHidden.mockRejectedValueOnce(new Error('policy executor unavailable'));
		await expect(load({ url: new URL('https://aisles.test/'), cookies } as never)).rejects.toMatchObject({
			status: 503,
			body: {
				message: 'This Kibble page is temporarily unavailable.',
				kibbleErrorAdapter: {
					instanceId: 'error-empty.rescue',
					sharedContentKind: 'content',
					adapterId: 'kibble.zone.error-empty.rescue',
				},
				kibbleErrorPolicy: { policies: [{ surface: 'error-empty' }] },
			},
		});
	});
});
