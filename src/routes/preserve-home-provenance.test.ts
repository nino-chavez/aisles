import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '$lib/types';

const mocks = vi.hoisted(() => ({
	logGeneration: vi.fn(async () => {}),
	createStoreFromRequest: vi.fn(),
}));

const bundle: Product = {
	id: 'essential-bundle-kns4', entityId: 3065, name: 'Essential Bundle', price: 109,
	image: 'https://example.com/bundle.png', imageAlt: 'Essential Bundle', description: '',
	specs: {}, tags: [], category: 'Bundles',
};
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
	loadReferenceHomeProducts: vi.fn(async () => ({ products: [shelfProduct], source: 'featured' })),
	loadCatalogProductByEntityId: vi.fn(async () => bundle),
	loadHomeProducts: vi.fn(),
}));
vi.mock('$lib/server/incentives/session', () => ({ loadSessionIncentives: vi.fn() }));
vi.mock('$lib/server/generation-log', () => ({ logGeneration: mocks.logGeneration }));

import { load } from './+page.server';

describe('Kibble Preserve home publication', () => {
	const originalBrand = process.env.BRAND_ID;

	beforeEach(() => {
		process.env.BRAND_ID = 'kibble';
		mocks.logGeneration.mockClear();
		mocks.createStoreFromRequest.mockReset().mockResolvedValue({
			visitCount: 1,
			store: {
				toInferenceContext: () => ({}),
				getCrossSessionContext: () => ({ scenarioId: null }),
			},
		});
	});

	afterEach(() => {
		if (originalBrand === undefined) delete process.env.BRAND_ID;
		else process.env.BRAND_ID = originalBrand;
	});

	it('emits contracted policy provenance from the production page load', async () => {
		const values = new Map<string, string>([['aisles_session', 'session-one']]);
		const data = await load({
			url: new URL('https://aisles.test/'), request: new Request('https://aisles.test/'),
			cookies: {
				get: (name: string) => values.get(name),
				set: (name: string, value: string) => values.set(name, value),
			},
			parent: async () => ({ devMode: false, renderMode: 'reference-preserve' }),
		} as never);

		if (!data) throw new Error('Expected Preserve home data.');
		expect(data.provenance).toMatchObject({
			reference: { status: 'contracted', id: 'kibble-shelf-native', version: '1.5.0' },
			autonomy: { preset: 'preserve', decisionMode: 'rules', publicationMode: 'live' },
			renderer: { componentId: 'kibble.home', variantId: 'kibble-home-reference-v1' },
		});
		expect(mocks.logGeneration).toHaveBeenCalledOnce();
		expect(mocks.logGeneration).toHaveBeenCalledWith(expect.objectContaining({
			type: 'preserve_render', categorySlug: 'home', sessionId: 'session-one',
			provenance: data.provenance,
		}));
		expect(data.kibbleHomeInspector).toBeNull();
	});

	it('exposes the bounded decision inspector only when server dev and dev mode are both active', async () => {
		const data = await load({
			url: new URL('https://aisles.test/'), request: new Request('https://aisles.test/'),
			cookies: { get: () => undefined, set: () => undefined },
			parent: async () => ({ devMode: true, renderMode: 'reference-preserve' }),
		} as never);

		if (!data) throw new Error('Expected Preserve home data.');
		expect(data.kibbleHomeInspector).toMatchObject({
			reference: { id: 'kibble-shelf-native', version: '1.5.0' },
			surface: 'home',
			dataSourceLabel: 'merchant-order-fallback',
			inference: { primary: 'gatherer', ruleMatches: [] },
		});
		const productZone = data.kibbleHomeInspector?.zones.find(({ id }) => id === 'ranked-products');
		expect(productZone?.outputProducts?.map(({ id }) => id))
			.toEqual(data.kibbleHome?.products.map(({ id }) => id));
	});

	it('turns request-state failures into the branded Preserve 503 boundary', async () => {
		mocks.createStoreFromRequest.mockRejectedValueOnce(new Error('database unavailable'));
		await expect(load({
			url: new URL('https://aisles.test/'), request: new Request('https://aisles.test/'),
			cookies: { get: () => undefined, set: () => undefined },
			parent: async () => ({ devMode: false, renderMode: 'reference-preserve' }),
		} as never)).rejects.toMatchObject({
			status: 503,
			body: { message: expect.stringContaining('Kibble Preserve cannot render') },
		});
	});
});
