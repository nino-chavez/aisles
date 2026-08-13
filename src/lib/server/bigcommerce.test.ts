import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getProductsByCategory, type BCProduct } from './bigcommerce';

vi.mock('$env/dynamic/private', () => ({
	env: {
		BIGCOMMERCE_STORE_HASH: 'store-hash',
		KIBBLE_STOREFRONT_TOKEN: 'storefront-token',
	},
}));

const product = (entityId: number): BCProduct => ({
	entityId,
	name: `Product ${entityId}`,
	sku: `SKU-${entityId}`,
	path: `/product-${entityId}/`,
	description: '',
	prices: { price: { value: entityId, currencyCode: 'USD' }, salePrice: null },
	defaultImage: null,
	customFields: { edges: [] },
	categories: { edges: [{ node: { entityId: 10, name: 'Kibble Dog Food', path: '/dog-food/' } }] },
});

const categoryResponse = (products: BCProduct[], pageInfo: {
	hasNextPage: boolean;
	hasPreviousPage: boolean;
	startCursor: string | null;
	endCursor: string | null;
}) => new Response(JSON.stringify({
	data: {
		site: {
			category: {
				entityId: 10,
				name: 'Kibble Dog Food',
				description: '',
				products: { edges: products.map((node) => ({ node })), pageInfo },
			},
		},
	},
}), { status: 200, headers: { 'content-type': 'application/json' } });

describe('BigCommerce category PLP query', () => {
	beforeEach(() => {
		vi.stubEnv('BRAND_ID', 'kibble');
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.restoreAllMocks();
	});

	it('requests 24 products and continues from the returned cursor at scale', async () => {
		const firstPage = Array.from({ length: 24 }, (_, index) => product(index + 1));
		const nextCursor = 'YXJyYXljb25uZWN0aW9uOjIz';
		const fetchMock = vi.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(categoryResponse(firstPage, {
				hasNextPage: true, hasPreviousPage: false,
				startCursor: 'YXJyYXljb25uZWN0aW9uOjA=', endCursor: nextCursor,
			}))
			.mockResolvedValueOnce(categoryResponse([product(25), product(26)], {
				hasNextPage: false, hasPreviousPage: true,
				startCursor: 'YXJyYXljb25uZWN0aW9uOjI0', endCursor: 'YXJyYXljb25uZWN0aW9uOjI1',
			}));

		const first = await getProductsByCategory(10, { first: 24, after: null, sortBy: 'NEWEST' });
		expect(first.products).toHaveLength(24);
		expect(first.pageInfo).toMatchObject({ hasNextPage: true, endCursor: nextCursor });

		const second = await getProductsByCategory(10, { first: 24, after: nextCursor, sortBy: 'NEWEST' });
		expect(second.products.map(({ entityId }) => entityId)).toEqual([25, 26]);
		expect(second.pageInfo.hasNextPage).toBe(false);

		const requestBodies = fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)));
		expect(requestBodies[0].variables).toEqual({
			categoryId: 10, first: 24, after: null, sortBy: 'NEWEST',
		});
		expect(requestBodies[1].variables).toEqual({
			categoryId: 10, first: 24, after: nextCursor, sortBy: 'NEWEST',
		});
		expect(requestBodies[0].query).toContain('products(first: $first, after: $after, sortBy: $sortBy)');
		expect(requestBodies[0].query).toContain('pageInfo');
	});
});
