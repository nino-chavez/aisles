import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getKibbleProductDetailByPath: vi.fn(), createStoreFromRequest: vi.fn(), infer: vi.fn(),
	buildContractedLayoutProvenance: vi.fn(), logGeneration: vi.fn(async () => {}),
}));

vi.mock('$lib/server/bigcommerce', () => ({
	getKibbleProductDetailByPath: mocks.getKibbleProductDetailByPath,
	getProductByPath: vi.fn(), getProductsByCategory: vi.fn(),
	customFieldsToRecord: (product: { customFields: { edges: Array<{ node: { name: string; value: string } }> } }) => Object.fromEntries(product.customFields.edges.map(({ node }) => [node.name, node.value])),
}));
vi.mock('$lib/signals/request', () => ({ createStoreFromRequest: mocks.createStoreFromRequest }));
vi.mock('$lib/signals/inference', () => ({ infer: mocks.infer }));
vi.mock('$lib/server/layout-provenance', () => ({ buildContractedLayoutProvenance: mocks.buildContractedLayoutProvenance }));
vi.mock('$lib/server/generation-log', () => ({ logGeneration: mocks.logGeneration }));

import { load } from './+page.server';

const detail = {
	entityId: 7, name: 'Verified Food', sku: 'DOG-7', path: '/verified-food/', description: '<p>Catalog description</p>',
	prices: { price: { value: 24, currencyCode: 'USD' }, salePrice: null }, defaultImage: { url: 'https://example.com/food.png', altText: 'Food' },
	customFields: { edges: [{ node: { name: 'Protein', value: 'Chicken' } }] }, categories: { edges: [{ node: { entityId: 10, name: 'Dog Food', path: '/dog-food/' } }] },
	images: { edges: [{ node: { url: 'https://example.com/food.png', altText: 'Food' } }] }, inventory: { isInStock: true },
	productOptions: { edges: [{ node: { entityId: 2, displayName: 'Bag size', isRequired: true, displayStyle: 'Dropdown', values: { edges: [{ node: { entityId: 3, label: 'Small', isDefault: true } }] } } }] },
	relatedProducts: { edges: [{ node: { entityId: 8, name: 'Related Food', sku: 'DOG-8', path: '/related-food/', description: '', prices: { price: { value: 20, currencyCode: 'USD' }, salePrice: null }, defaultImage: null, customFields: { edges: [] }, categories: { edges: [] } } }] },
};

function preserveEvent(slug: string) {
	const values = new Map<string, string>([['aisles_session', 'session-one']]);
	const url = new URL(`https://aisles.test/product/${slug}`);
	return {
		params: { slug }, url, request: new Request(url),
		cookies: { get: (name: string) => values.get(name), set: (name: string, value: string) => values.set(name, value) },
		parent: async () => ({ devMode: false, renderMode: 'reference-preserve' }),
	};
}

describe('Kibble Preserve PDP route', () => {
	const originalBrand = process.env.BRAND_ID;
	beforeEach(() => {
		process.env.BRAND_ID = 'kibble';
		mocks.getKibbleProductDetailByPath.mockReset().mockResolvedValue(detail);
		mocks.createStoreFromRequest.mockReset().mockResolvedValue({ visitCount: 1, store: {
			toInferenceContext: () => ({}), getCrossSessionContext: () => ({ scenarioId: null }),
		} });
		mocks.infer.mockReset().mockReturnValue({ primary: 'gatherer', probabilities: { gatherer: 1, hunter: 0, researcher: 0, gifter: 0 } });
		mocks.buildContractedLayoutProvenance.mockReset().mockImplementation((input) => ({
			surface: input.surface, reference: { status: 'contracted', id: 'kibble-shelf-native', version: '1.5.0' },
			autonomy: { decisionMode: 'fixed' }, decisionSource: 'fixed',
		}));
		mocks.logGeneration.mockClear();
	});
	afterEach(() => { if (originalBrand === undefined) delete process.env.BRAND_ID; else process.env.BRAND_ID = originalBrand; });

	it('materializes fixed, catalog-verified facts and only contracted PDP destinations', async () => {
		const data = await load(preserveEvent('verified-food') as never);
		if (!data || !('kibblePdp' in data)) throw new Error('Expected Kibble PDP data.');
		expect(data.kibblePdp.product).toMatchObject({ name: 'Verified Food', sku: 'DOG-7', description: 'Catalog description', isInStock: true });
		expect(data.kibblePdp.relatedProductHrefs).toEqual({ 'related-food': '/product/related-food' });
		expect(data.kibblePdp.purchaseUnavailableBody).toContain('ordering, cart, and subscription');
		expect(data.provenance).toMatchObject({ surface: 'pdp', autonomy: { decisionMode: 'fixed' }, decisionSource: 'fixed' });
		expect(mocks.buildContractedLayoutProvenance).toHaveBeenCalledWith(expect.objectContaining({
			surface: 'pdp', route: '/product/verified-food', decisionSource: 'fixed',
			contractInput: expect.objectContaining({ id: 'kibble-pdp-reference-v1' }),
			catalogInput: expect.objectContaining({ product: expect.objectContaining({ entityId: 7 }) }),
			shopperContext: { persona: 'gatherer', probabilities: { gatherer: 1, hunter: 0, researcher: 0, gifter: 0 } },
		}));
		expect(mocks.logGeneration).toHaveBeenCalledWith(expect.objectContaining({
			type: 'preserve_render', persona: 'gatherer', categorySlug: 'verified-food', sessionId: 'session-one', provenance: data.provenance,
		}));
	});

	it('fails missing catalog records and invalid paths into the Preserve error shell', async () => {
		mocks.getKibbleProductDetailByPath.mockResolvedValueOnce(null);
		await expect(load(preserveEvent('missing') as never)).rejects.toMatchObject({ status: 404 });
		await expect(load(preserveEvent('../cart') as never)).rejects.toMatchObject({ status: 404 });
	});

	it.each([
		['negative list price', { price: { value: -1, currencyCode: 'USD' }, salePrice: null }],
		['invalid sale price', { price: { value: 24, currencyCode: 'USD' }, salePrice: { value: 24, currencyCode: 'USD' } }],
		['unsupported currency', { price: { value: 24, currencyCode: 'EUR' }, salePrice: null }],
	])('fails %s closed before client money formatting', async (_label, prices) => {
		mocks.getKibbleProductDetailByPath.mockResolvedValueOnce({ ...detail, prices });
		await expect(load(preserveEvent('verified-food') as never)).rejects.toMatchObject({ status: 503 });
	});
});
