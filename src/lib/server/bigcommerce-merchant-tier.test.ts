import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ env: {} as Record<string, string | undefined> }));

vi.mock('$env/dynamic/private', () => ({
	env: new Proxy({}, { get: (_target, key: string) => state.env[key] }),
}));

import { getProducts } from './bigcommerce';
import { resetMerchantTierWarnings, runWithMerchantTier } from './merchant-tier';

const productsResponse = () => new Response(JSON.stringify({
	data: { site: { products: { edges: [], pageInfo: { hasNextPage: false, endCursor: '' } } } },
}), { status: 200, headers: { 'content-type': 'application/json' } });

describe('getGraphQLConfig merchant-tier override (via getProducts)', () => {
	beforeEach(() => {
		state.env = {
			BIGCOMMERCE_STORE_HASH: 'store-hash',
			KIBBLE_STOREFRONT_TOKEN: 'default-token',
		};
		vi.stubEnv('BRAND_ID', 'kibble');
		resetMerchantTierWarnings();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.restoreAllMocks();
	});

	it('uses the default channel 1 host and token with no active tier', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(productsResponse());
		await getProducts();
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe('https://store-store-hash-1853406.mybigcommerce.com/graphql');
		expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer default-token' });
	});

	it('uses the default channel when a tier is active but its env is unprovisioned, and warns once', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => productsResponse());
		await runWithMerchantTier('enterprise', () => getProducts());
		await runWithMerchantTier('enterprise', () => getProducts());
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe('https://store-store-hash-1853406.mybigcommerce.com/graphql');
		expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer default-token' });
		expect(warn).toHaveBeenCalledTimes(1);
	});

	it('switches to the tier channel and token when the tier env is provisioned', async () => {
		state.env.KIBBLE_TIER_SMALL_CHANNEL_ID = '5551';
		state.env.KIBBLE_TIER_SMALL_STOREFRONT_TOKEN = 'small-token';
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(productsResponse());
		await runWithMerchantTier('small', () => getProducts());
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe('https://store-store-hash-5551.mybigcommerce.com/graphql');
		expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer small-token' });
	});

	it('does not carry an active tier over to a call outside its scope', async () => {
		state.env.KIBBLE_TIER_SMALL_CHANNEL_ID = '5551';
		state.env.KIBBLE_TIER_SMALL_STOREFRONT_TOKEN = 'small-token';
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => productsResponse());
		await runWithMerchantTier('small', () => getProducts());
		await getProducts();
		const [, secondInit] = fetchMock.mock.calls[1];
		expect((secondInit as RequestInit).headers).toMatchObject({ Authorization: 'Bearer default-token' });
	});
});
