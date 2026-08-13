import { describe, expect, it, vi } from 'vitest';

const brandState = vi.hoisted(() => ({ id: 'kibble' }));
vi.mock('$lib/brand/config', async (importOriginal) => ({
	...await importOriginal<typeof import('$lib/brand/config')>(),
	getBrand: vi.fn(() => ({ organizationId: 'kibble-demo-merchant', id: brandState.id, name: 'Kibble & Co.' })),
}));

import { load as loadAccount } from './account/+page.server';
import { load as loadAccountPath } from './account/[...path]/+page.server';
import { load as loadCheckoutPath } from './checkout/[subtype]/+page.server';
import { load as loadSubscriptions } from './subscriptions/+page.server';
import { load as loadSubscriptionDetail } from './portal/subscriptions/[id]/+page.server';
import { load as loadStoreLocator } from './store-locator/+page.server';

const parent = async () => ({ brand: { name: 'Kibble & Co.' }, renderMode: 'reference-preserve' });

describe('Kibble trusted route authority', () => {
	it('binds account identity and every canonical account subtype to the compiled account policy', async () => {
		brandState.id = 'kibble';
		const root = await loadAccount({ url: new URL('https://aisles.test/account'), parent } as never);
		expect(root).toMatchObject({ kibbleAccount: { subtype: 'login', brandName: 'Kibble & Co.', policyVersion: expect.any(String) } });

		for (const subtype of ['login', 'register', 'orders', 'addresses', 'payment-methods', 'subscriptions', 'logout']) {
			const result = await loadAccountPath({
				params: { path: subtype },
				url: new URL(`https://aisles.test/account/${subtype}`),
				parent,
			} as never);
			expect(result).toMatchObject({ kibbleAccount: { subtype, brandName: 'Kibble & Co.', policyVersion: expect.any(String) } });
		}
	});

	it.each(['admin', 'orders/private', '../admin'])('rejects fabricated account subtype %s before any account service can run', async (path) => {
		await expect(loadAccountPath({
			params: { path },
			url: new URL(`https://aisles.test/account/${encodeURI(path)}`),
			parent,
		} as never)).rejects.toMatchObject({ status: 404 });
	});

	it('binds only the three canonical checkout subroutes', async () => {
		for (const subtype of ['gift', 'prepaid', 'confirmation']) {
			const result = await loadCheckoutPath({ params: { subtype }, url: new URL(`https://aisles.test/checkout/${subtype}`) } as never);
			expect(result).toMatchObject({ kibbleCheckout: { subtype, policyVersion: expect.any(String) } });
		}
		await expect(loadCheckoutPath({ params: { subtype: 'admin' }, url: new URL('https://aisles.test/checkout/admin') } as never))
			.rejects.toMatchObject({ status: 404 });
	});

	it('binds subscription entry and safe detail identifiers without reading subscriber data', async () => {
		await expect(loadSubscriptions({ url: new URL('https://aisles.test/subscriptions') } as never))
			.resolves.toMatchObject({ kibbleSubscriptions: { subtype: 'portal', brandName: 'Kibble & Co.', policyVersion: expect.any(String) } });
		await expect(loadSubscriptionDetail({ params: { id: 'subscription-123' }, url: new URL('https://aisles.test/portal/subscriptions/subscription-123') } as never))
			.resolves.toMatchObject({ kibbleSubscriptions: { subtype: 'detail', brandName: 'Kibble & Co.', policyVersion: expect.any(String) } });
		await expect(loadSubscriptionDetail({ params: { id: '../admin' }, url: new URL('https://aisles.test/portal/subscriptions/admin') } as never))
			.rejects.toMatchObject({ status: 404 });
	});

	it('keeps the typed locator policy behind a Kibble-native not-applicable boundary', async () => {
		await expect(loadStoreLocator({ url: new URL('https://aisles.test/store-locator') } as never))
			.rejects.toMatchObject({
				status: 404,
				body: {
					message: 'Store locator is not part of the pinned Kibble storefront.',
					kibbleErrorAdapter: { instanceId: 'error-404.rescue', sharedContentKind: 'content' },
				},
			});
	});

	it('does not grant reference route data from the generic parent chrome state', async () => {
		brandState.id = 'haven';
		await expect(loadAccount({ url: new URL('https://aisles.test/account'), parent } as never)).resolves.toEqual({});
		brandState.id = 'kibble';
	});
});
