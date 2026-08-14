import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getKibblePdpRelatedProducts, getKibbleProductDetailByPath, getProductsByCategory, resolveKibblePdpRelatedProducts, type BCProduct } from './bigcommerce';

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

describe('BigCommerce Kibble Preserve PDP query', () => {
	beforeEach(() => { vi.stubEnv('BRAND_ID', 'kibble'); });
	afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

	it('requests only the fixed catalog-detail fields and no commerce mutation', async () => {
		const detail = {
			__typename: 'Product',
			...product(7),
			images: { edges: [{ node: { url: 'https://example.com/product.png', altText: 'Product 7' } }] },
			inventory: { isInStock: true },
			productOptions: { edges: [{ node: { entityId: 1, displayName: 'Size', isRequired: true, displayStyle: 'Dropdown', values: { edges: [{ node: { entityId: 2, label: 'Small', isDefault: true } }] } } }] },
			relatedProducts: { edges: [{ node: product(8) }] },
		};
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
			data: { site: { route: { node: detail } } },
		}), { status: 200, headers: { 'content-type': 'application/json' } }));

		const result = await getKibbleProductDetailByPath('product-7');
		expect(result?.entityId).toBe(7);
		const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
		expect(request.variables).toEqual({ path: '/product-7/' });
		expect(request.query).toContain('images(first: 10)');
		expect(request.query).toContain('__typename');
		expect(request.query).toContain('productOptions(first: 10)');
		expect(request.query).toContain('relatedProducts(first: 4)');
		expect(request.query).not.toMatch(/mutation|createCart|addCartLineItems|subscription/i);
	});

	it('returns null for a non-product route node', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
			data: { site: { route: { node: { __typename: 'Category' } } } },
		}), { status: 200, headers: { 'content-type': 'application/json' } }));
		await expect(getKibbleProductDetailByPath('dog-food')).resolves.toBeNull();
	});

	it('fills a sparse native related list from the canonical category catalog and keeps the 3–4 bound', async () => {
		const detail = {
			...product(7),
			images: { edges: [] }, inventory: null, productOptions: { edges: [] },
			relatedProducts: { edges: [] },
		};
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => categoryResponse(
			[product(7), product(8), product(9), product(10)],
			{ hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null },
		));

		const result = await getKibblePdpRelatedProducts(detail);

		expect(result.map(({ entityId }) => entityId)).toEqual([8, 9, 10]);
		const resolution = await resolveKibblePdpRelatedProducts(detail);
		expect(resolution).toMatchObject({ candidateSource: 'category_sibling', relationKind: null, products: result });
		const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
		expect(request.variables).toMatchObject({ categoryId: 10, first: 8 });
	});

	it('keeps native merchant relationships distinct from category-sibling fallback candidates', async () => {
		const detail = {
			...product(7),
			images: { edges: [] }, inventory: null, productOptions: { edges: [] },
			relatedProducts: { edges: [product(8), product(9), product(10)].map((node) => ({ node })) },
		};

		const resolution = await resolveKibblePdpRelatedProducts(detail);

		expect(resolution).toMatchObject({
			candidateSource: 'native_related',
			relationKind: 'related',
			products: [product(8), product(9), product(10)],
		});
	});
});
