import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getKibbleProductDetailByPath: vi.fn(), resolveKibblePdpRelatedProducts: vi.fn(), createStoreFromRequest: vi.fn(), infer: vi.fn(),
	buildContractedLayoutProvenance: vi.fn(), logGeneration: vi.fn(async () => {}),
}));

vi.mock('$lib/server/bigcommerce', () => ({
	getKibbleProductDetailByPath: mocks.getKibbleProductDetailByPath,
	resolveKibblePdpRelatedProducts: mocks.resolveKibblePdpRelatedProducts,
	getProductByPath: vi.fn(), getProductsByCategory: vi.fn(),
	customFieldsToRecord: (product: { customFields: { edges: Array<{ node: { name: string; value: string } }> } }) => Object.fromEntries(product.customFields.edges.map(({ node }) => [node.name, node.value])),
}));
vi.mock('$lib/signals/request', () => ({ createStoreFromRequest: mocks.createStoreFromRequest }));
vi.mock('$lib/signals/inference', () => ({ infer: mocks.infer }));
vi.mock('$lib/server/layout-provenance', () => ({ buildContractedLayoutProvenance: mocks.buildContractedLayoutProvenance }));
vi.mock('$lib/server/generation-log', () => ({ logGeneration: mocks.logGeneration }));

import { load } from './+page.server';
import { KIBBLE_PDP_BOUNDS, KIBBLE_REFERENCE_CONTRACT } from '$lib/brand/reference/kibble';

const detail = {
	entityId: 7, name: 'Verified Food', sku: 'DOG-7', path: '/verified-food/', description: '<p>Catalog description</p>',
	prices: { price: { value: 24, currencyCode: 'USD' }, salePrice: null }, defaultImage: { url: 'https://example.com/food.png', altText: 'Food' },
	customFields: { edges: [{ node: { name: 'Protein', value: 'Chicken' } }] }, categories: { edges: [{ node: { entityId: 10, name: 'Dog Food', path: '/dog-food/' } }] },
	images: { edges: [{ node: { url: 'https://example.com/food.png', altText: 'Food' } }] }, inventory: { isInStock: true },
	productOptions: { edges: [{ node: { entityId: 2, displayName: 'Bag size', isRequired: true, displayStyle: 'Dropdown', values: { edges: [{ node: { entityId: 3, label: 'Small', isDefault: true } }] } } }] },
	relatedProducts: { edges: [{ node: { entityId: 8, name: 'Related Food', sku: 'DOG-8', path: '/related-food/', description: '', prices: { price: { value: 20, currencyCode: 'USD' }, salePrice: null }, defaultImage: null, customFields: { edges: [] }, categories: { edges: [] } } }] },
};

function preserveEvent(slug: string, renderMode: 'reference-review' | 'reference-preserve' | 'reference-unavailable' = 'reference-preserve') {
	const values = new Map<string, string>([['aisles_session', 'session-one']]);
	const url = new URL(`https://aisles.test/product/${slug}`);
	return {
		params: { slug }, url, request: new Request(url),
		cookies: { get: (name: string) => values.get(name), set: (name: string, value: string) => values.set(name, value) },
		parent: async () => ({ devMode: false, renderMode }),
	};
}

describe('Kibble Preserve PDP route', () => {
	const originalBrand = process.env.BRAND_ID;
	beforeEach(() => {
		process.env.BRAND_ID = 'kibble';
		mocks.getKibbleProductDetailByPath.mockReset().mockResolvedValue(detail);
		mocks.resolveKibblePdpRelatedProducts.mockReset().mockImplementation(async (value: typeof detail) => ({
			products: value.relatedProducts.edges.map(({ node }) => node),
			candidateSource: 'category_sibling',
			relationKind: null,
		}));
		mocks.createStoreFromRequest.mockReset().mockResolvedValue({ visitCount: 1, store: {
			toInferenceContext: () => ({}), getCrossSessionContext: () => ({ scenarioId: null }),
		} });
		mocks.infer.mockReset().mockReturnValue({ primary: 'gatherer', probabilities: { gatherer: 1, hunter: 0, researcher: 0, gifter: 0 } });
		mocks.buildContractedLayoutProvenance.mockReset().mockImplementation((input) => ({
			surface: input.surface, reference: { status: 'contracted', id: KIBBLE_REFERENCE_CONTRACT.id, version: KIBBLE_REFERENCE_CONTRACT.version },
			autonomy: { decisionMode: 'fixed' }, decisionSource: 'fixed',
		}));
		mocks.logGeneration.mockClear();
	});
	afterEach(() => { if (originalBrand === undefined) delete process.env.BRAND_ID; else process.env.BRAND_ID = originalBrand; });

	it('materializes fixed, catalog-verified facts and only contracted PDP destinations', async () => {
		const data = await load(preserveEvent('verified-food') as never);
		if (!data || !('kibblePdp' in data)) throw new Error('Expected Kibble PDP data.');
		expect(data.renderMode).toBe('reference-preserve');
		expect(data.kibblePdp.product).toMatchObject({ name: 'Verified Food', sku: 'DOG-7', description: '<p>Catalog description</p>', descriptionPlain: 'Catalog description', isInStock: true });
		expect(data.kibblePdp.bundle).toBeNull();
		expect(data.kibblePdp.relatedProductHrefs).toEqual({ 'related-food': '/product/related-food' });
		expect(data.kibblePdp.purchaseUnavailableBody).toContain('ordering, cart, and subscription');
		expect(data.provenance).toMatchObject({ surface: 'pdp', autonomy: { decisionMode: 'fixed' }, decisionSource: 'fixed' });
		expect(mocks.buildContractedLayoutProvenance).toHaveBeenCalledWith(expect.objectContaining({
			surface: 'pdp', route: '/product/verified-food', decisionSource: 'fixed',
			rendererVariantId: 'kibble.product-detail.catalog-display-only',
			contractInput: expect.objectContaining({
				recipe: expect.objectContaining({ id: 'kibble-pdp-reference-v1' }),
				renderedManifest: expect.objectContaining({
					purchaseUnavailableLabel: 'Purchase unavailable in this preview',
					copy: expect.objectContaining({ detailsHeading: 'Details' }),
					bundle: null,
				}),
			}),
			catalogInput: expect.objectContaining({ product: expect.objectContaining({ entityId: 7 }) }),
			shopperContext: { persona: 'gatherer', probabilities: { gatherer: 1, hunter: 0, researcher: 0, gifter: 0 } },
		}));
		expect(mocks.logGeneration).toHaveBeenCalledWith(expect.objectContaining({
			type: 'preserve_render', persona: 'gatherer', categorySlug: 'verified-food', sessionId: 'session-one', provenance: data.provenance,
		}));
	});

	it('projects an eligible product offer without creating subscription authority', async () => {
		mocks.getKibbleProductDetailByPath.mockResolvedValueOnce({ ...detail, entityId: 3023, prices: { price: { value: 34.99, currencyCode: 'USD' }, salePrice: null } });
		const data = await load(preserveEvent('verified-food') as never);
		if (!data || !('kibblePdp' in data)) throw new Error('Expected Kibble PDP data.');
		expect(data.kibblePdp.autoRefill).toMatchObject({
			price: 29.74,
			savingsPercent: 15,
			capabilityLabels: ['Intro offer'],
			capabilityEvidence: [expect.objectContaining({ label: 'Intro offer', detail: expect.stringContaining('first-cycle offer') })],
		});
		expect(data.kibblePdp.purchaseUnavailableBody).toContain('subscription services are not available');
		expect(JSON.stringify(data.kibblePdp.autoRefill)).not.toMatch(/planId|cart|checkout|payment/i);
	});

	it('suppresses pinned offer evidence when the live catalog price no longer supports its savings claim', async () => {
		mocks.getKibbleProductDetailByPath.mockResolvedValueOnce({ ...detail, entityId: 3023, prices: { price: { value: 40, currencyCode: 'USD' }, salePrice: null } });
		const data = await load(preserveEvent('verified-food') as never);
		if (!data || !('kibblePdp' in data)) throw new Error('Expected Kibble PDP data.');
		expect(data.kibblePdp.autoRefill).toBeNull();
	});

	it('suppresses pinned offer evidence when a sale price invalidates the stated savings', async () => {
		mocks.getKibbleProductDetailByPath.mockResolvedValueOnce({ ...detail, entityId: 3023, prices: { price: { value: 34.99, currencyCode: 'USD' }, salePrice: { value: 31.99, currencyCode: 'USD' } } });
		const data = await load(preserveEvent('verified-food') as never);
		if (!data || !('kibblePdp' in data)) throw new Error('Expected Kibble PDP data.');
		expect(data.kibblePdp.autoRefill).toBeNull();
	});

	it('renders the bounded related zone when the server resolver supplies three catalog candidates', async () => {
		const candidates = [8, 9, 10].map((entityId) => ({
			...detail.relatedProducts.edges[0].node,
			entityId,
			name: `Related Food ${entityId}`,
			path: `/related-food-${entityId}/`,
		}));
		mocks.resolveKibblePdpRelatedProducts.mockResolvedValueOnce({ products: candidates, candidateSource: 'native_related', relationKind: 'related' });

		const data = await load(preserveEvent('verified-food') as never);
		if (!data || !('kibblePdp' in data)) throw new Error('Expected Kibble PDP data.');
		expect(data.kibblePdp.relatedProducts).toHaveLength(3);
		expect(data.kibblePdp.zoneAdapter).toMatchObject({ instanceId: 'pdp.related' });
		expect(data.kibblePdp.relatedCandidateSource).toBe('native_related');
		expect(data.kibblePdp.relatedRelationKind).toBe('related');
	});

	it('fails closed before catalog access when the trusted route is explicitly unavailable', async () => {
		await expect(load(preserveEvent('verified-food', 'reference-unavailable') as never)).rejects.toMatchObject({ status: 503 });
		expect(mocks.getKibbleProductDetailByPath).not.toHaveBeenCalled();
	});

	it('preserves the pinned conditional bundle anatomy without subscription fields', async () => {
		const bundleDetail = structuredClone(detail);
		Object.assign(bundleDetail, {
			entityId: 3065,
			name: 'Essential Bundle',
			sku: 'BUNDLE-ESSENTIAL',
			path: '/essential-bundle-kns4/',
		});
		mocks.getKibbleProductDetailByPath.mockResolvedValueOnce(bundleDetail);
		const data = await load(preserveEvent('essential-bundle-kns4') as never);
		if (!data || !('kibblePdp' in data)) throw new Error('Expected Kibble bundle PDP data.');
		expect(data.kibblePdp.bundle?.name).toBe('Essential Bundle');
		expect(data.kibblePdp.bundle?.contents).toHaveLength(3);
		expect(data.kibblePdp.bundle?.contents[0]).toMatchObject({ brand: 'Open Farm', title: 'GoodGut Grass-Fed Beef Dog Kibble', role: 'Premium dry food' });
		expect(JSON.stringify(data.kibblePdp.bundle)).not.toMatch(/subscribable|subscribe_price|save/);
		expect(mocks.buildContractedLayoutProvenance).toHaveBeenCalledWith(expect.objectContaining({
			contractInput: expect.objectContaining({ renderedManifest: expect.objectContaining({ bundle: expect.objectContaining({ name: 'Essential Bundle' }) }) }),
		}));
	});

	it('omits catalog description blocks that advertise unavailable subscription commerce', async () => {
		mocks.getKibbleProductDetailByPath.mockResolvedValueOnce({
			...detail,
			description: '<p>For growing puppies. Auto-Refill $47, one-time $60. Reset the cadence as the puppy grows.</p>',
		});
		const data = await load(preserveEvent('verified-food') as never);
		if (!data || !('kibblePdp' in data)) throw new Error('Expected Kibble PDP data.');
		expect(data.kibblePdp.product.description).toBe('');
		expect(data.kibblePdp.product.descriptionPlain).toBe('');
		expect(JSON.stringify(data.kibblePdp)).not.toMatch(/Auto-Refill \$47|one-time \$60/);
	});

	it('keeps validated rich description semantics and rejects executable markup', async () => {
		mocks.getKibbleProductDetailByPath.mockResolvedValueOnce({
			...detail,
			description: '<p>Made with <strong>care</strong>. <a href="https://example.com/details">Read more</a></p>',
		});
		const data = await load(preserveEvent('verified-food') as never);
		if (!data || !('kibblePdp' in data)) throw new Error('Expected Kibble PDP data.');
		expect(data.kibblePdp.product.description).toContain('<strong>care</strong>');
		expect(data.kibblePdp.product.description).toContain('rel="noopener noreferrer"');

		mocks.getKibbleProductDetailByPath.mockResolvedValueOnce({ ...detail, description: '<script>alert(1)</script>' });
		await expect(load(preserveEvent('verified-food') as never)).rejects.toMatchObject({ status: 503 });
	});

	it('fails missing catalog records and invalid paths into the Preserve error shell', async () => {
		mocks.getKibbleProductDetailByPath.mockResolvedValueOnce(null);
		await expect(load(preserveEvent('missing') as never)).rejects.toMatchObject({
			status: 404,
			body: {
				message: 'Product not found.',
				kibbleErrorAdapter: { instanceId: 'error-404.rescue', sharedContentKind: 'content' },
				kibbleErrorPolicy: { policies: [{ surface: 'error-404' }] },
			},
		});
		await expect(load(preserveEvent('../cart') as never)).rejects.toMatchObject({
			status: 404,
			body: { kibbleErrorAdapter: { instanceId: 'error-404.rescue' } },
		});
	});

	it('rejects an over-bound request slug before session or catalog work', async () => {
		const slug = `a${'b'.repeat(KIBBLE_PDP_BOUNDS.strings.routeId)}`;
		expect(slug).toHaveLength(KIBBLE_PDP_BOUNDS.strings.routeId + 1);
		await expect(load(preserveEvent(slug) as never)).rejects.toMatchObject({ status: 404 });
		expect(mocks.createStoreFromRequest).not.toHaveBeenCalled();
		expect(mocks.getKibbleProductDetailByPath).not.toHaveBeenCalled();
		expect(mocks.logGeneration).not.toHaveBeenCalled();
	});

	it.each([
		['negative list price', { price: { value: -1, currencyCode: 'USD' }, salePrice: null }],
		['invalid sale price', { price: { value: 24, currencyCode: 'USD' }, salePrice: { value: 24, currencyCode: 'USD' } }],
		['mismatched sale-price currency', { price: { value: 24, currencyCode: 'USD' }, salePrice: { value: 20, currencyCode: 'EUR' } }],
		['unsupported currency', { price: { value: 24, currencyCode: 'EUR' }, salePrice: null }],
	])('fails %s closed before client money formatting', async (_label, prices) => {
		mocks.getKibbleProductDetailByPath.mockResolvedValueOnce({ ...detail, prices });
		await expect(load(preserveEvent('verified-food') as never)).rejects.toMatchObject({ status: 503 });
	});

	it.each([
		['product name', (candidate: typeof detail) => { candidate.name = 'n'.repeat(97); }],
		['product SKU', (candidate: typeof detail) => { candidate.sku = 's'.repeat(65); }],
		['description', (candidate: typeof detail) => { candidate.description = 'd'.repeat(4001); }],
		['image alt text', (candidate: typeof detail) => { candidate.images.edges[0].node.altText = 'a'.repeat(161); }],
		['category name', (candidate: typeof detail) => { candidate.categories.edges[0].node.name = 'c'.repeat(97); }],
		['option name', (candidate: typeof detail) => { candidate.productOptions.edges[0].node.displayName = 'o'.repeat(97); }],
		['option value label', (candidate: typeof detail) => { candidate.productOptions.edges[0].node.values.edges[0].node.label = 'v'.repeat(97); }],
		['custom field name', (candidate: typeof detail) => { candidate.customFields.edges[0].node.name = 'k'.repeat(65); }],
		['custom field value', (candidate: typeof detail) => { candidate.customFields.edges[0].node.value = 'v'.repeat(241); }],
		['related product name', (candidate: typeof detail) => { candidate.relatedProducts.edges[0].node.name = 'r'.repeat(97); }],
	])('fails an over-bound %s closed before rendering', async (_label, mutate) => {
		const candidate = structuredClone(detail);
		mutate(candidate);
		mocks.getKibbleProductDetailByPath.mockResolvedValueOnce(candidate);
		await expect(load(preserveEvent('verified-food') as never)).rejects.toMatchObject({ status: 503 });
	});

	it.each([
		['images', (candidate: typeof detail) => { candidate.images.edges = Array.from({ length: 11 }, () => structuredClone(detail.images.edges[0])); }],
		['options', (candidate: typeof detail) => { candidate.productOptions.edges = Array.from({ length: 11 }, (_, index) => ({ node: { ...structuredClone(detail.productOptions.edges[0].node), entityId: index + 1 } })); }],
		['option values', (candidate: typeof detail) => { candidate.productOptions.edges[0].node.values.edges = Array.from({ length: 26 }, (_, index) => ({ node: { entityId: index + 1, label: `Value ${index}`, isDefault: false } })); }],
		['related products', (candidate: typeof detail) => { candidate.relatedProducts.edges = Array.from({ length: 5 }, (_, index) => ({ node: { ...structuredClone(detail.relatedProducts.edges[0].node), entityId: index + 20, path: `/related-${index}/` } })); }],
		['custom fields', (candidate: typeof detail) => { candidate.customFields.edges = Array.from({ length: 11 }, (_, index) => ({ node: { name: `Field ${index}`, value: 'Value' } })); }],
		['categories', (candidate: typeof detail) => { candidate.categories.edges = Array.from({ length: 6 }, (_, index) => ({ node: { entityId: index + 1, name: `Category ${index}`, path: `/category-${index}/` } })); }],
	])('fails an over-bound %s array closed before rendering', async (_label, mutate) => {
		const candidate = structuredClone(detail);
		mutate(candidate);
		mocks.getKibbleProductDetailByPath.mockResolvedValueOnce(candidate);
		await expect(load(preserveEvent('verified-food') as never)).rejects.toMatchObject({ status: 503 });
	});
});
