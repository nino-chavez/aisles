import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getKibbleProductDetailByPath: vi.fn() }));

vi.mock('$lib/server/bigcommerce', () => ({
	getKibbleProductDetailByPath: mocks.getKibbleProductDetailByPath,
	getProductByPath: vi.fn(), getProductsByCategory: vi.fn(),
	customFieldsToRecord: (product: { customFields: { edges: Array<{ node: { name: string; value: string } }> } }) => Object.fromEntries(product.customFields.edges.map(({ node }) => [node.name, node.value])),
}));

import { load } from './+page.server';

const detail = {
	entityId: 7, name: 'Verified Food', sku: 'DOG-7', path: '/verified-food/', description: '<p>Catalog description</p>',
	prices: { price: { value: 24, currencyCode: 'USD' }, salePrice: null }, defaultImage: { url: 'https://example.com/food.png', altText: 'Food' },
	customFields: { edges: [{ node: { name: 'Protein', value: 'Chicken' } }] }, categories: { edges: [{ node: { entityId: 10, name: 'Dog Food', path: '/dog-food/' } }] },
	images: { edges: [{ node: { url: 'https://example.com/food.png', altText: 'Food' } }] }, inventory: { isInStock: true },
	productOptions: { edges: [{ node: { entityId: 2, displayName: 'Bag size', isRequired: true, displayStyle: 'Dropdown', values: { edges: [{ node: { entityId: 3, label: 'Small', isDefault: true } }] } } }] },
	relatedProducts: { edges: [{ node: { entityId: 8, name: 'Related Food', sku: 'DOG-8', path: '/related-food/', description: '', prices: { price: { value: 20, currencyCode: 'USD' }, salePrice: null }, defaultImage: null, customFields: { edges: [] }, categories: { edges: [] } } }] },
};

describe('Kibble Preserve PDP route', () => {
	const originalBrand = process.env.BRAND_ID;
	beforeEach(() => { process.env.BRAND_ID = 'kibble'; mocks.getKibbleProductDetailByPath.mockReset().mockResolvedValue(detail); });
	afterEach(() => { if (originalBrand === undefined) delete process.env.BRAND_ID; else process.env.BRAND_ID = originalBrand; });

	it('materializes fixed, catalog-verified facts and only contracted PDP destinations', async () => {
		const data = await load({ params: { slug: 'verified-food' }, url: new URL('https://aisles.test/product/verified-food'), parent: async () => ({ devMode: false, renderMode: 'reference-preserve' }) } as never);
		if (!data || !('kibblePdp' in data)) throw new Error('Expected Kibble PDP data.');
		expect(data.kibblePdp.product).toMatchObject({ name: 'Verified Food', sku: 'DOG-7', description: 'Catalog description', isInStock: true });
		expect(data.kibblePdp.relatedProductHrefs).toEqual({ 'related-food': '/product/related-food' });
		expect(data.kibblePdp.purchaseUnavailableBody).toContain('ordering, cart, and subscription');
		expect(data.provenance).toMatchObject({ surface: 'pdp', autonomy: { decisionMode: 'fixed' }, decisionSource: 'fixed' });
	});

	it('fails missing catalog records and invalid paths into the Preserve error shell', async () => {
		mocks.getKibbleProductDetailByPath.mockResolvedValueOnce(null);
		await expect(load({ params: { slug: 'missing' }, url: new URL('https://aisles.test/product/missing'), parent: async () => ({ devMode: false, renderMode: 'reference-preserve' }) } as never)).rejects.toMatchObject({ status: 404 });
		await expect(load({ params: { slug: '../cart' }, url: new URL('https://aisles.test/product/../cart'), parent: async () => ({ devMode: false, renderMode: 'reference-preserve' }) } as never)).rejects.toMatchObject({ status: 404 });
	});

	it('fails malformed catalog facts closed rather than mounting the generic PDP', async () => {
		mocks.getKibbleProductDetailByPath.mockResolvedValueOnce({ ...detail, prices: { price: { value: -1, currencyCode: 'USD' }, salePrice: null } });
		await expect(load({ params: { slug: 'verified-food' }, url: new URL('https://aisles.test/product/verified-food'), parent: async () => ({ devMode: false, renderMode: 'reference-preserve' }) } as never)).rejects.toMatchObject({ status: 503 });
	});
});
