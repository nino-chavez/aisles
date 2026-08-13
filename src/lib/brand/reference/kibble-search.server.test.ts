import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: {
		BIGCOMMERCE_STORE_HASH: 'fixture-store',
		KIBBLE_STOREFRONT_TOKEN: 'fixture-token',
	},
}));

import {
	KIBBLE_SEARCH_PAGE_SIZE,
	KIBBLE_SEARCH_PRODUCTS_QUERY,
	buildKibbleSearchHref,
	parseKibbleSearchCursor,
	parseKibbleSearchQuery,
	searchKibbleCatalog,
} from './kibble-search.server';

const prior = {
	brand: process.env.BRAND_ID,
};

beforeEach(() => {
	process.env.BRAND_ID = 'kibble';
});

afterEach(() => {
	vi.restoreAllMocks();
	for (const [name, value] of [['BRAND_ID', prior.brand]] as const) {
		if (value === undefined) delete process.env[name]; else process.env[name] = value;
	}
});

const pageInfo = { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null };
const fixtureProduct = {
	entityId: 3023,
	name: 'GoodGut Grass-Fed Beef Dog Kibble',
	sku: 'KC_OPENFARM_GOODGUT_GRASS_FED_BEEF_DOG_KIBB',
	path: '/openfarm-goodgut-grass-fed-beef-dog-kibble/',
	description: '<p>Catalog description.</p>',
	prices: { price: { value: 34.99, currencyCode: 'USD' }, salePrice: { value: 29.74, currencyCode: 'USD' } },
	defaultImage: { url: 'https://cdn.example.test/product.png', altText: 'GoodGut bag' },
	customFields: { edges: [{ node: { name: 'Brand', value: 'Open Farm' } }] },
	categories: { edges: [{ node: { entityId: 317, name: 'Dog Food', path: '/dog-food/' } }] },
};

describe('Kibble read-only Storefront search', () => {
	it('adapts the pinned SearchProducts query with bounded inputs and validated output', async () => {
		const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ data: { site: { search: { searchProducts: { products: { edges: [{ node: fixtureProduct }], pageInfo } } } } } }), { status: 200, headers: { 'content-type': 'application/json' } }));
		const result = await searchKibbleCatalog({ query: '  goodgut  ', fetchImpl });
		expect(fetchImpl).toHaveBeenCalledOnce();
		const [url, init] = fetchImpl.mock.calls[0];
		expect(url).toBe('https://store-fixture-store.mybigcommerce.com/graphql');
		expect(init).toMatchObject({ method: 'POST', headers: { Accept: 'application/json', Authorization: 'Bearer fixture-token' } });
		const body = JSON.parse(String(init?.body));
		expect(body).toEqual({ query: KIBBLE_SEARCH_PRODUCTS_QUERY, variables: { searchTerm: 'goodgut', first: KIBBLE_SEARCH_PAGE_SIZE, after: null } });
		expect(result.products).toEqual([expect.objectContaining({ entityId: 3023, name: fixtureProduct.name, price: 34.99 })]);
		expect(result.products[0]).not.toHaveProperty('salePrice');
	});

	it('makes no request for an empty query and rejects unbounded input or response shapes', async () => {
		const fetchImpl = vi.fn();
		await expect(searchKibbleCatalog({ query: ' ', fetchImpl })).resolves.toEqual({ products: [], pageInfo });
		expect(fetchImpl).not.toHaveBeenCalled();
		expect(() => parseKibbleSearchQuery('x'.repeat(161))).toThrow('160');
		expect(() => parseKibbleSearchCursor('bad cursor')).toThrow('cursor');
		await expect(searchKibbleCatalog({ query: 'food', fetchImpl: vi.fn(async () => new Response(JSON.stringify({ data: {} }), { status: 200 })) })).rejects.toThrow('invalid response');
	});

	it('keeps pagination query and cursor encoded', () => {
		expect(buildKibbleSearchHref('gut food', 'Y3Vyc29yOjI0')).toBe('?q=gut+food&after=Y3Vyc29yOjI0');
		expect(() => buildKibbleSearchHref('gut food', 'bad cursor')).toThrow('cursor');
	});
});
