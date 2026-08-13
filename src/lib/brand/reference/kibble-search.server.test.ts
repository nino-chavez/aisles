import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
		env: {
		BIGCOMMERCE_STORE_HASH: 'kibble-parity-fixture',
		KIBBLE_STOREFRONT_TOKEN: 'fixture-token',
		KIBBLE_PARITY_FIXED_DATA_IDENTITY: '833824a875f1fbe83a5d1d9164f521aa38e64e3902d22623a6af1b8cad84fe49',
		KIBBLE_PARITY_ATTESTATION_KEY: 'a'.repeat(64),
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
		expect(url).toBe('https://store-kibble-parity-fixture.mybigcommerce.com/graphql');
		expect(init).toMatchObject({ method: 'POST', headers: { Accept: 'application/json', Authorization: 'Bearer fixture-token' } });
		const body = JSON.parse(String(init?.body));
		expect(body).toEqual({ query: KIBBLE_SEARCH_PRODUCTS_QUERY, variables: { searchTerm: 'goodgut', first: KIBBLE_SEARCH_PAGE_SIZE, after: null } });
		expect(result.products).toEqual([expect.objectContaining({ entityId: 3023, name: fixtureProduct.name, price: 34.99 })]);
		expect(result.products[0]).not.toHaveProperty('salePrice');
		expect(result.provenance).toMatchObject({
			source: 'live-storefront', query: 'goodgut', cursor: null, pageSize: 24,
			catalogSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
			resultSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
		});
		expect(result.provenance).not.toHaveProperty('fixedDataIdentity');
	});

	it('digests validated page catalog content instead of store or fixture environment identity', async () => {
		const response = (product: typeof fixtureProduct) => new Response(JSON.stringify({
			data: { site: { search: { searchProducts: { products: { edges: [{ node: product }], pageInfo } } } } },
		}), { status: 200, headers: { 'content-type': 'application/json' } });
		const first = await searchKibbleCatalog({ query: 'goodgut', fetchImpl: vi.fn(async () => response(fixtureProduct)) });
		const changedCatalogOnly = {
			...fixtureProduct,
			prices: { ...fixtureProduct.prices, salePrice: { value: 28.5, currencyCode: 'USD' as const } },
		};
		const second = await searchKibbleCatalog({ query: 'goodgut', fetchImpl: vi.fn(async () => response(changedCatalogOnly)) });
		expect(second.provenance.catalogSha256).not.toBe(first.provenance.catalogSha256);
		// salePrice is deliberately not projected into shopper results.
		expect(second.provenance.resultSha256).toBe(first.provenance.resultSha256);
	});

	it('makes no request for an empty query and rejects unbounded input or response shapes', async () => {
		const fetchImpl = vi.fn();
		await expect(searchKibbleCatalog({ query: ' ', fetchImpl })).resolves.toMatchObject({
			products: [], pageInfo, provenance: { source: 'not-requested', query: '', cursor: null, pageSize: 24 },
		});
		expect(fetchImpl).not.toHaveBeenCalled();
		expect(() => parseKibbleSearchQuery('x'.repeat(161))).toThrow('160');
		expect(() => parseKibbleSearchCursor('bad cursor')).toThrow('cursor');
		await expect(searchKibbleCatalog({ query: 'food', fetchImpl: vi.fn(async () => new Response(JSON.stringify({ data: {} }), { status: 200 })) })).rejects.toThrow('invalid response');
		await expect(searchKibbleCatalog({
			query: 'food',
			fetchImpl: vi.fn(async () => new Response(JSON.stringify({
				data: { site: { search: { searchProducts: { products: {
					edges: [{ node: { ...fixtureProduct, prices: { price: { value: 34.99, currencyCode: 'EUR' }, salePrice: null } } }],
						pageInfo,
				} } } } },
			}), { status: 200 })),
		})).rejects.toThrow('invalid response');
	});

	it('keeps pagination query and cursor encoded', () => {
		expect(buildKibbleSearchHref('gut food', 'Y3Vyc29yOjI0')).toBe('?q=gut+food&after=Y3Vyc29yOjI0');
		expect(() => buildKibbleSearchHref('gut food', 'bad cursor')).toThrow('cursor');
	});
});
