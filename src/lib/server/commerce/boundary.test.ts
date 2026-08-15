import { beforeEach, describe, expect, it, vi } from 'vitest';

const privateEnv = vi.hoisted(() => ({
	KIBBLE_COMMERCE_MODE: 'sandbox',
	BIGCOMMERCE_STORE_HASH: '',
	KIBBLE_STOREFRONT_TOKEN: '',
	BIGCOMMERCE_STOREFRONT_TOKEN: '',
	KV_REST_API_URL: '',
	KV_REST_API_TOKEN: '',
}));

vi.mock('$app/environment', () => ({ dev: false }));
vi.mock('$env/dynamic/private', () => ({ env: privateEnv }));
vi.mock('$lib/brand/config', () => ({
	getBrand: () => ({ id: 'kibble' }),
}));

import { getCommerceServiceBoundary, isKibbleCommerceEnabled } from './boundary';

describe('Kibble commerce provider boundary', () => {
	beforeEach(() => {
		privateEnv.KIBBLE_COMMERCE_MODE = 'sandbox';
		privateEnv.BIGCOMMERCE_STORE_HASH = '';
		privateEnv.KIBBLE_STOREFRONT_TOKEN = '';
		privateEnv.BIGCOMMERCE_STOREFRONT_TOKEN = '';
		privateEnv.KV_REST_API_URL = '';
		privateEnv.KV_REST_API_TOKEN = '';
	});

	it('fails closed when provider or durable session prerequisites are missing', () => {
		expect(isKibbleCommerceEnabled()).toBe(false);
		privateEnv.KIBBLE_STOREFRONT_TOKEN = 'configured';
		expect(isKibbleCommerceEnabled()).toBe(false);
		privateEnv.BIGCOMMERCE_STORE_HASH = 'configured';
		expect(isKibbleCommerceEnabled()).toBe(false);
		expect(getCommerceServiceBoundary()).toMatchObject({
			mode: 'off',
			cart: 'not_connected',
			checkout: 'not_connected',
			orderCreation: 'not_exposed',
			orderHistory: 'customer_session_required',
			account: 'merchant_decision_required',
			payment: 'provider_owned',
			subscription: 'provider_not_connected',
			subscriptionPortal: 'portal_session_required',
		});
	});

	it('advertises the sandbox only when every deployed prerequisite is present', () => {
		privateEnv.BIGCOMMERCE_STORE_HASH = 'configured';
		privateEnv.KIBBLE_STOREFRONT_TOKEN = 'configured';
		privateEnv.KV_REST_API_URL = 'https://redis.example.test';
		privateEnv.KV_REST_API_TOKEN = 'configured';
		expect(getCommerceServiceBoundary()).toMatchObject({
			mode: 'sandbox',
			cart: 'bigcommerce_sandbox',
			checkout: 'bigcommerce_hosted_handoff',
			orderCreation: 'not_exposed',
			orderHistory: 'customer_session_required',
			account: 'merchant_decision_required',
			payment: 'provider_owned',
			subscription: 'provider_not_connected',
			subscriptionPortal: 'portal_session_required',
		});
	});
});
