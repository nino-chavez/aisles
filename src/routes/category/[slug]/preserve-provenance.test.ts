import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '$lib/types';
import { KIBBLE_REFERENCE_CONTRACT } from '$lib/brand/reference/kibble';

const state = vi.hoisted(() => ({ enabled: 'false' }));
const mocks = vi.hoisted(() => ({
	logGeneration: vi.fn(async () => {}),
	createStoreFromRequest: vi.fn(),
	loadReferenceCategoryProducts: vi.fn(),
}));

vi.mock('$env/dynamic/private', () => ({ env: new Proxy({}, { get: (_target, key) => key === 'KIBBLE_DEMO_AI_ENABLED' ? state.enabled : undefined }) }));

const shelfProduct: Product = {
	id: 'dog-food-one', entityId: 4001, name: 'Dog Food One', price: 29,
	image: 'https://example.com/food.png', imageAlt: 'Dog Food One', description: '',
	specs: {}, tags: [], category: 'Dog Food',
};

vi.mock('$lib/signals/request', () => ({
	createStoreFromRequest: mocks.createStoreFromRequest,
}));
vi.mock('$lib/signals/inference', () => ({
	infer: vi.fn(() => ({
		primary: 'gatherer', probabilities: { gatherer: 0.7, hunter: 0.1, researcher: 0.1, gifter: 0.1 },
		confidence: 0.6, entropy: 0.9, certainty: 0.35,
		modifiers: { priceSensitivity: 0, urgency: 0, familiarityWithStore: 0 },
		shift: { detected: false, from: null, trigger: null }, signalCount: 1,
		lastUpdated: 1, dominantSource: 'request', ruleMatches: [],
	})),
}));
vi.mock('$lib/server/catalog', () => ({
	CATEGORY_MAP: { 'dog-food': 1 },
	loadReferenceCategoryProducts: mocks.loadReferenceCategoryProducts,
	loadCategoryProducts: vi.fn(),
}));
vi.mock('$lib/server/incentives/session', () => ({ loadSessionIncentives: vi.fn() }));
vi.mock('$lib/server/generation-log', () => ({ logGeneration: mocks.logGeneration }));

import { load } from './+page.server';

describe('Kibble Preserve PLP publication', () => {
	const originalBrand = process.env.BRAND_ID;

	beforeEach(() => {
		process.env.BRAND_ID = 'kibble';
		state.enabled = 'false';
		mocks.logGeneration.mockClear();
		mocks.createStoreFromRequest.mockReset().mockResolvedValue({
			visitCount: 1,
			store: {
				eventCount: 1,
				toInferenceContext: () => ({}),
				getCrossSessionContext: () => ({ scenarioId: null }),
			},
		});
		mocks.loadReferenceCategoryProducts.mockReset().mockResolvedValue({
			categoryName: 'Dog Food', products: [shelfProduct],
			pageInfo: { hasNextPage: true, endCursor: 'YXJyYXljb25uZWN0aW9uOjIz' },
		});
	});

	afterEach(() => {
		if (originalBrand === undefined) delete process.env.BRAND_ID;
		else process.env.BRAND_ID = originalBrand;
	});

	it('emits contracted fixed-policy provenance from the production category load', async () => {
		const values = new Map<string, string>([['aisles_session', 'session-one']]);
		const data = await load({
			params: { slug: 'dog-food' },
			url: new URL('https://aisles.test/category/dog-food?sort=NEWEST'),
			request: new Request('https://aisles.test/category/dog-food?sort=NEWEST'),
			cookies: {
				get: (name: string) => values.get(name),
				set: (name: string, value: string) => values.set(name, value),
			},
			parent: async () => ({ devMode: false, renderMode: 'reference-preserve' }),
		} as never);

		if (!data) throw new Error('Expected Preserve PLP data.');
		expect(Object.keys(data).sort()).toEqual(['category', 'kibbleCategory', 'provenance', 'renderMode']);
		expect(data).not.toHaveProperty('inference');
		expect(data).not.toHaveProperty('sessionContext');
		expect(data).not.toHaveProperty('sessionId');
		expect(data).not.toHaveProperty('products');
		expect(data).not.toHaveProperty('persona');
		expect(data.provenance).toMatchObject({
			reference: { status: 'contracted', id: 'kibble-shelf-native', version: KIBBLE_REFERENCE_CONTRACT.version },
			surface: 'plp', route: '/category/dog-food',
			autonomy: { preset: 'preserve', decisionMode: 'fixed', publicationMode: 'live' },
			renderer: { componentId: 'kibble.category-listing', variantId: 'kibble-plp-reference-v1' },
			decisionSource: 'fixed',
		});
		expect(data.kibbleCategory?.selectedSort).toBe('NEWEST');
		expect(mocks.logGeneration).toHaveBeenCalledOnce();
		expect(mocks.logGeneration).toHaveBeenCalledWith(expect.objectContaining({
			type: 'preserve_render', categorySlug: 'dog-food', sessionId: 'session-one',
			provenance: data.provenance,
		}));
	});

	it('turns catalog failures into the branded Preserve 503 boundary', async () => {
		mocks.loadReferenceCategoryProducts.mockRejectedValueOnce(new Error('catalog unavailable'));
		await expect(load({
			params: { slug: 'dog-food' },
			url: new URL('https://aisles.test/category/dog-food'),
			request: new Request('https://aisles.test/category/dog-food'),
			cookies: { get: () => undefined, set: () => undefined },
			parent: async () => ({ devMode: false, renderMode: 'reference-preserve' }),
		} as never)).rejects.toMatchObject({
			status: 503,
			body: {
				message: 'This Kibble shelf is temporarily unavailable.',
				kibbleErrorAdapter: { instanceId: 'error-empty.rescue', sharedContentKind: 'content' },
				kibbleErrorPolicy: { policies: [{ surface: 'error-empty' }] },
			},
		});
	});

	it('exposes the PLP model action only for the enabled exact FEATURED first page', async () => {
		const products = Array.from({ length: 10 }, (_, index) => ({ ...shelfProduct, id: `food-${index + 1}`, entityId: index + 1 }));
		mocks.loadReferenceCategoryProducts.mockResolvedValueOnce({ categoryName: 'Dog Food', products, pageInfo: { hasNextPage: false, endCursor: null } });
		const args = (url: string) => ({ params: { slug: 'dog-food' }, url: new URL(url), request: new Request(url), cookies: { get: (name: string) => name === 'aisles_observe_demo' ? '1' : undefined, set: () => undefined }, parent: async () => ({ devMode: false, renderMode: 'reference-preserve' }) } as never);
		const disabled = await load(args('https://aisles.test/category/dog-food?observe=true'));
		if (!disabled) throw new Error('Expected disabled PLP data.');
		expect(disabled.kibbleCategory?.productRanking).toBeNull();
		state.enabled = 'true';
		mocks.loadReferenceCategoryProducts.mockResolvedValueOnce({ categoryName: 'Dog Food', products, pageInfo: { hasNextPage: false, endCursor: null } });
		const enabled = await load(args('https://aisles.test/category/dog-food?observe=true'));
		if (!enabled) throw new Error('Expected enabled PLP data.');
		expect(enabled.kibbleCategory?.productRanking).toMatchObject({ eligible: true, sort: 'FEATURED', cursor: null, prefixIds: ['1', '2', '3', '4', '5', '6', '7', '8'], tailIds: ['9', '10'] });
		mocks.loadReferenceCategoryProducts.mockResolvedValueOnce({ categoryName: 'Dog Food', products, pageInfo: { hasNextPage: true, endCursor: 'cursor' } });
		const adjacent = await load(args('https://aisles.test/category/dog-food?observe=true&sort=NEWEST&after=cursor'));
		if (!adjacent) throw new Error('Expected adjacent PLP data.');
		expect(adjacent.kibbleCategory?.productRanking).toBeNull();
	});

	it('binds a real error-404 terminal for a valid route whose category is missing', async () => {
		await expect(load({
			params: { slug: 'missing-category' },
			url: new URL('https://aisles.test/category/missing-category'),
			request: new Request('https://aisles.test/category/missing-category'),
			cookies: { get: () => undefined, set: () => undefined },
			parent: async () => ({ devMode: false, renderMode: 'reference-preserve' }),
		} as never)).rejects.toMatchObject({
			status: 404,
			body: {
				message: 'Category "missing-category" was not found.',
				kibbleErrorAdapter: { instanceId: 'error-404.rescue', sharedContentKind: 'content' },
				kibbleErrorPolicy: { policies: [{ surface: 'error-404' }] },
			},
		});
		expect(mocks.createStoreFromRequest).not.toHaveBeenCalled();
	});
});
