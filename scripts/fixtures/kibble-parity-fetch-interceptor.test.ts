import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { findWorkspaceRoot } from '../kibble-parity-local';

vi.mock('$env/dynamic/private', () => ({
		env: {
		BIGCOMMERCE_STORE_HASH: 'kibble-parity-fixture',
		KIBBLE_STOREFRONT_TOKEN: 'fixture-token',
		KIBBLE_PARITY_FIXED_DATA_IDENTITY: '833824a875f1fbe83a5d1d9164f521aa38e64e3902d22623a6af1b8cad84fe49',
		KIBBLE_PARITY_ATTESTATION_KEY: 'a'.repeat(64),
	},
}));

const originalFetch = globalThis.fetch;
const originalFixturePath = process.env.KIBBLE_PARITY_FIXTURE_PATH;
const originalIdentity = process.env.KIBBLE_PARITY_FIXED_DATA_IDENTITY;
const originalAttestationKey = process.env.KIBBLE_PARITY_ATTESTATION_KEY;
const originalBrand = process.env.BRAND_ID;
const originalStoreHash = process.env.BIGCOMMERCE_STORE_HASH;
const originalToken = process.env.KIBBLE_STOREFRONT_TOKEN;
process.env.KIBBLE_PARITY_FIXTURE_PATH = resolve(findWorkspaceRoot(resolve(import.meta.dirname, '../..')), 'labs/bc-subscriptions/scripts/kibble-demo/data/seed-output.json');
process.env.KIBBLE_PARITY_FIXED_DATA_IDENTITY = '833824a875f1fbe83a5d1d9164f521aa38e64e3902d22623a6af1b8cad84fe49';
process.env.KIBBLE_PARITY_ATTESTATION_KEY = 'a'.repeat(64);
process.env.BRAND_ID = 'kibble';
process.env.BIGCOMMERCE_STORE_HASH = 'kibble-parity-fixture';
process.env.KIBBLE_STOREFRONT_TOKEN = 'fixture-token';

const require = createRequire(import.meta.url);
const interceptor = require('./kibble-parity-fetch-interceptor.cjs') as {
	fixtureIdentity: string;
	operationName: (query: string) => string;
	responseFor: (query: string, variables: Record<string, unknown>) => any;
	searchAttestationHeaders: (variables: Record<string, unknown>, data: any) => Record<string, string>;
};
globalThis.fetch = originalFetch;

afterAll(() => {
	globalThis.fetch = originalFetch;
	if (originalFixturePath === undefined) delete process.env.KIBBLE_PARITY_FIXTURE_PATH;
	else process.env.KIBBLE_PARITY_FIXTURE_PATH = originalFixturePath;
	if (originalIdentity === undefined) delete process.env.KIBBLE_PARITY_FIXED_DATA_IDENTITY;
	else process.env.KIBBLE_PARITY_FIXED_DATA_IDENTITY = originalIdentity;
	if (originalAttestationKey === undefined) delete process.env.KIBBLE_PARITY_ATTESTATION_KEY;
	else process.env.KIBBLE_PARITY_ATTESTATION_KEY = originalAttestationKey;
	if (originalBrand === undefined) delete process.env.BRAND_ID; else process.env.BRAND_ID = originalBrand;
	if (originalStoreHash === undefined) delete process.env.BIGCOMMERCE_STORE_HASH; else process.env.BIGCOMMERCE_STORE_HASH = originalStoreHash;
	if (originalToken === undefined) delete process.env.KIBBLE_STOREFRONT_TOKEN; else process.env.KIBBLE_STOREFRONT_TOKEN = originalToken;
});

const query = (name: string) => `query ${name}($path: String!) { site { route(path: $path) { node { __typename } } } }`;

describe('official Kibble parity GraphQL fixture', () => {
	it('pins one fixed fixture identity', () => {
		expect(interceptor.fixtureIdentity).toBe('833824a875f1fbe83a5d1d9164f521aa38e64e3902d22623a6af1b8cad84fe49');
	});

	it('serves canonical CategoryBySlug with fixed catalog identity', () => {
		const response = interceptor.responseFor(query('CategoryBySlug'), { path: '/dog-food/', first: 24 });
		expect(response.site.route.node).toMatchObject({ __typename: 'Category', entityId: 317, name: 'Dog Food', path: '/dog-food/' });
		expect(response.site.route.node.products.edges[0].node).toMatchObject({ entityId: 3023, name: 'GoodGut Grass-Fed Beef Dog Kibble' });
		expect(response.site.route.node.products.pageInfo).toEqual({ hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null });
	});

	it('serves canonical SearchProducts with deterministic matching', () => {
		const response = interceptor.responseFor(query('SearchProducts'), { searchTerm: 'goodgut', first: 24 });
		const products = response.site.search.searchProducts.products;
		expect(products.edges.map(({ node }: any) => node.entityId)).toEqual([3023, 3024, 3025]);
		expect(products.pageInfo.hasNextPage).toBe(false);
	});

	it('passes the full canonical SearchProducts fixture response through the strict Kibble adapter', async () => {
		const { KIBBLE_SEARCH_PRODUCTS_QUERY, searchKibbleCatalog } = await import('../../src/lib/brand/reference/kibble-search.server');
		const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
			const body = JSON.parse(String(init?.body));
			const data = interceptor.responseFor(body.query, body.variables);
			return new Response(JSON.stringify({ data }), {
				status: 200,
				headers: { 'content-type': 'application/json', ...interceptor.searchAttestationHeaders(body.variables, data) },
			});
		});
		const result = await searchKibbleCatalog({ query: 'goodgut', fetchImpl });
		expect(fetchImpl).toHaveBeenCalledOnce();
		const request = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body));
		expect(request.query).toBe(KIBBLE_SEARCH_PRODUCTS_QUERY);
		expect(result.products.map(({ entityId }) => entityId)).toEqual([3023, 3024, 3025]);
		expect(result.provenance).toMatchObject({
			source: 'parity-fixture', query: 'goodgut', pageSize: 24,
			catalogSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
			fixedDataIdentity: interceptor.fixtureIdentity,
			resultSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
		});
		expect(result.provenance.catalogSha256).not.toBe(interceptor.fixtureIdentity);
	});

	it('does not attest an arbitrary or content-tampered mock under reserved parity environment values', async () => {
		const { KIBBLE_SEARCH_PRODUCTS_QUERY, searchKibbleCatalog } = await import('../../src/lib/brand/reference/kibble-search.server');
		const variables = { searchTerm: 'goodgut', first: 24, after: null };
		const data = interceptor.responseFor(KIBBLE_SEARCH_PRODUCTS_QUERY, variables);
		const unattested = await searchKibbleCatalog({
			query: 'goodgut',
			fetchImpl: vi.fn(async () => new Response(JSON.stringify({ data }), { status: 200, headers: { 'content-type': 'application/json' } })),
		});
		expect(unattested.provenance.source).toBe('live-storefront');
		expect(unattested.provenance).not.toHaveProperty('fixedDataIdentity');

		const headers = interceptor.searchAttestationHeaders(variables, data);
		const tampered = structuredClone(data);
		tampered.site.search.searchProducts.products.edges[0].node.name = 'Tampered fixture product';
		const contentMismatch = await searchKibbleCatalog({
			query: 'goodgut',
			fetchImpl: vi.fn(async () => new Response(JSON.stringify({ data: tampered }), { status: 200, headers: { 'content-type': 'application/json', ...headers } })),
		});
		expect(contentMismatch.provenance.source).toBe('live-storefront');
		expect(contentMismatch.provenance).not.toHaveProperty('fixedDataIdentity');
	});

	it.each(['ProductDetail', 'GetKibbleProductDetail'])('serves %s through the same fixed product identity', (operation) => {
		const response = interceptor.responseFor(query(operation), { path: '/openfarm-goodgut-grass-fed-beef-dog-kibble/' });
		expect(response.site.route.node).toMatchObject({ __typename: 'Product', entityId: 3023, sku: 'KC_OPENFARM_GOODGUT_GRASS_FED_BEEF_DOG_KIBB' });
		expect(response.site.route.node.images.edges).toHaveLength(1);
		expect(response.site.route.node.defaultImage.url).toBe('https://fixture.kibble.invalid/products/3023.svg');
		expect(response.site.route.node.inventory).toEqual({ isInStock: true });
		expect(response.site.route.node.productOptions).toEqual({ edges: [] });
	});

	it('preflights the stable PDP proof route and its honest category-sibling candidates', async () => {
		const previousFetch = globalThis.fetch;
		globalThis.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
			const body = JSON.parse(String(init?.body));
			return new Response(JSON.stringify({ data: interceptor.responseFor(body.query, body.variables) }), {
				status: 200,
				headers: { 'content-type': 'application/json' },
			});
		});
		try {
			const { getKibbleProductDetailByPath, resolveKibblePdpRelatedProducts } = await import('../../src/lib/server/bigcommerce');
			const detail = await getKibbleProductDetailByPath('/puppy-starter-kit/');
			expect(detail?.entityId).toBe(3064);
			if (!detail) throw new Error('Pinned PDP proof product was not returned.');
			const resolution = await resolveKibblePdpRelatedProducts(detail);
			expect(resolution.products).toHaveLength(4);
			expect(new Set(resolution.products.map(({ entityId }) => entityId)).size).toBe(4);
			expect(resolution.products.some(({ entityId }) => entityId === 3064)).toBe(false);
			expect(resolution).toMatchObject({ candidateSource: 'category_sibling', relationKind: null });
		} finally {
			globalThis.fetch = previousFetch;
		}
	});

	it('fails closed for an unimplemented operation', () => {
		expect(() => interceptor.responseFor(query('InventedMutation'), {})).toThrow('InventedMutation');
	});
});
