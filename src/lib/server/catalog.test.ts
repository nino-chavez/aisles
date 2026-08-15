import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BCProduct } from './bigcommerce';
import type { PersonaFitScores } from './enrichment/types';

const mocks = vi.hoisted(() => ({
	getFeaturedProducts: vi.fn(),
	getNewestProducts: vi.fn(),
	getProducts: vi.fn(),
	getCategories: vi.fn(),
	getProductsByCategory: vi.fn(),
	getEnrichmentByEntityIds: vi.fn(),
}));

vi.mock('./bigcommerce', () => ({
	getCategories: mocks.getCategories,
	getFeaturedProducts: mocks.getFeaturedProducts,
	getNewestProducts: mocks.getNewestProducts,
	getProductByEntityId: vi.fn(),
	getProducts: mocks.getProducts,
	getProductsByCategory: mocks.getProductsByCategory,
	customFieldsToRecord: vi.fn(() => ({})),
}));
vi.mock('./enrichment/query', () => ({
	getEnrichmentByEntityIds: mocks.getEnrichmentByEntityIds,
}));
vi.mock('$lib/brand/config', () => ({
	getBrand: vi.fn(() => ({
		id: 'kibble', name: 'Kibble & Co.', categories: {
			'dog-food': { bcName: 'Dog Food', displayName: 'Dog Food' },
			supplements: { bcName: 'Supplements & Wellness', displayName: 'Supplements & Wellness' },
		},
	})),
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
		mocks.getCategories.mockReset().mockResolvedValue([
			{ entityId: 10, name: 'Dog Food' },
			{ entityId: 11, name: 'Supplements & Wellness' },
		]);
		mocks.getProductsByCategory.mockReset().mockImplementation(async (entityId: number) => ({
			products: entityId === 10 ? [product(10)] : [product(11)],
		}));
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

	it('uses one live product per configured category when no merchant featured collection exists', async () => {
		mocks.getFeaturedProducts.mockResolvedValue([]);

		const result = await loadReferenceHomeProducts(9);
		expect(result.source).toBe('category-breadth');
		expect(result.products.map(({ entityId }) => entityId)).toEqual([10, 11]);
		expect(result.categoryCounts).toEqual({ 'dog-food': 1, supplements: 1 });
		expect(result.products.every(({ personaFit }) => personaFit === null)).toBe(true);
	});

	it('uses a stable entity-id catalog fallback before attaching enrichment', async () => {
		mocks.getFeaturedProducts.mockRejectedValue(new Error('featured unavailable'));
		mocks.getCategories.mockRejectedValue(new Error('categories unavailable'));
		mocks.getNewestProducts.mockRejectedValue(new Error('newest unavailable'));
		mocks.getProducts.mockResolvedValue([product(2), product(7), product(4)]);

		const result = await loadReferenceHomeProducts(2);
		expect(result.source).toBe('deterministic-catalog');
		expect(result.products.map(({ entityId }) => entityId)).toEqual([7, 4]);
	});
});
