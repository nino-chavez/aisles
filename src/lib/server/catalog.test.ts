import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BCProduct } from './bigcommerce';
import type { PersonaFitScores } from './enrichment/types';

const mocks = vi.hoisted(() => ({
	getFeaturedProducts: vi.fn(),
	getNewestProducts: vi.fn(),
	getProducts: vi.fn(),
	getEnrichmentByEntityIds: vi.fn(),
}));

vi.mock('./bigcommerce', () => ({
	getCategories: vi.fn(),
	getFeaturedProducts: mocks.getFeaturedProducts,
	getNewestProducts: mocks.getNewestProducts,
	getProductByEntityId: vi.fn(),
	getProducts: mocks.getProducts,
	getProductsByCategory: vi.fn(),
	customFieldsToRecord: vi.fn(() => ({})),
}));
vi.mock('./enrichment/query', () => ({
	getEnrichmentByEntityIds: mocks.getEnrichmentByEntityIds,
}));
vi.mock('$lib/brand/config', () => ({
	getBrand: vi.fn(() => ({ id: 'kibble', name: 'Kibble & Co.', categories: {} })),
}));

import { loadReferenceHomeProducts } from './catalog';

const score = (gatherer: number): PersonaFitScores => ({
	gatherer, hunter: 0, researcher: 0, gifter: 0,
});

const product = (entityId: number): BCProduct => ({
	entityId,
	name: `Product ${entityId}`,
	sku: `SKU-${entityId}`,
	path: `/product-${entityId}/`,
	description: '',
	prices: { price: { value: entityId, currencyCode: 'USD' }, salePrice: null },
	defaultImage: null,
	customFields: { edges: [] },
	categories: { edges: [{ node: { entityId: 10, name: 'Dog Food', path: '/dog-food/' } }] },
});

describe('Kibble Preserve Home catalog candidates', () => {
	beforeEach(() => {
		mocks.getFeaturedProducts.mockReset();
		mocks.getNewestProducts.mockReset();
		mocks.getProducts.mockReset();
		mocks.getEnrichmentByEntityIds.mockReset().mockResolvedValue(new Map());
	});

	it('attaches available fit scores without changing featured merchant order', async () => {
		mocks.getFeaturedProducts.mockResolvedValue([product(3), product(1), product(2)]);
		mocks.getEnrichmentByEntityIds.mockResolvedValue(new Map([
			[3, { personaFit: score(0.1) }],
			[2, { personaFit: score(0.9) }],
		]));

		const result = await loadReferenceHomeProducts(9);
		expect(result.source).toBe('featured');
		expect(result.products.map(({ entityId }) => entityId)).toEqual([3, 1, 2]);
		expect(result.products.map(({ personaFit }) => personaFit?.gatherer ?? null)).toEqual([0.1, null, 0.9]);
	});

	it('keeps newest order and null enrichment when the database has no records', async () => {
		mocks.getFeaturedProducts.mockResolvedValue([]);
		mocks.getNewestProducts.mockResolvedValue([product(8), product(4), product(6)]);

		const result = await loadReferenceHomeProducts(9);
		expect(result.source).toBe('newest');
		expect(result.products.map(({ entityId }) => entityId)).toEqual([8, 4, 6]);
		expect(result.products.every(({ personaFit }) => personaFit === null)).toBe(true);
	});

	it('uses a stable entity-id catalog fallback before attaching enrichment', async () => {
		mocks.getFeaturedProducts.mockRejectedValue(new Error('featured unavailable'));
		mocks.getNewestProducts.mockRejectedValue(new Error('newest unavailable'));
		mocks.getProducts.mockResolvedValue([product(2), product(7), product(4)]);

		const result = await loadReferenceHomeProducts(2);
		expect(result.source).toBe('deterministic-catalog');
		expect(result.products.map(({ entityId }) => entityId)).toEqual([7, 4]);
	});
});
