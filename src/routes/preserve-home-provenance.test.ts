import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '$lib/types';
import { KIBBLE_REFERENCE_CONTRACT } from '$lib/brand/reference/kibble';

const mocks = vi.hoisted(() => ({
	logGeneration: vi.fn(async () => {}),
	createStoreFromRequest: vi.fn(),
	privateEnv: {} as Record<string, string>,
}));

const bundle: Product = {
	id: 'essential-bundle-kns4', entityId: 3065, name: 'Essential Bundle', price: 109,
	image: 'https://example.com/bundle.png', imageAlt: 'Essential Bundle', description: '',
	specs: {}, tags: [], category: 'Bundles',
};
const shelfProduct: Product & { personaFit: { gatherer: number; hunter: number; researcher: number; gifter: number } } = {
	id: 'dog-food-one', entityId: 4001, name: 'Dog Food One', price: 29,
	image: 'https://example.com/food.png', imageAlt: 'Dog Food One', description: '',
	specs: {}, tags: [], category: 'Dog Food',
	personaFit: { gatherer: 0.9, hunter: 0.2, researcher: 0.5, gifter: 0.3 },
};
const shelfProducts = [
	shelfProduct,
	{ ...shelfProduct, id: 'dog-food-two', entityId: 4002, name: 'Dog Food Two' },
	{ ...shelfProduct, id: 'dog-food-three', entityId: 4003, name: 'Dog Food Three' },
];

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
	loadReferenceHomeProducts: vi.fn(async () => ({ products: shelfProducts, source: 'featured' })),
	loadCatalogProductByEntityId: vi.fn(async () => bundle),
	loadHomeProducts: vi.fn(),
}));
vi.mock('$lib/server/incentives/session', () => ({ loadSessionIncentives: vi.fn() }));
vi.mock('$lib/server/generation-log', () => ({ logGeneration: mocks.logGeneration }));
vi.mock('$env/dynamic/private', () => ({ env: mocks.privateEnv }));

import { load } from './+page.server';

describe('Kibble Preserve home publication', () => {
	const originalBrand = process.env.BRAND_ID;

	beforeEach(() => {
		process.env.BRAND_ID = 'kibble';
		delete mocks.privateEnv.KIBBLE_SHOWCASE_SCENARIO_ID;
		delete mocks.privateEnv.KIBBLE_SHOWCASE_DATA_SOURCE;
		mocks.logGeneration.mockClear();
		mocks.createStoreFromRequest.mockReset().mockResolvedValue({
			visitCount: 1,
			store: (() => {
				let scenarioId: string | null = null;
				return {
					toInferenceContext: () => ({}),
					setScenarioId: (value: string | null) => { scenarioId = value; },
					getCrossSessionContext: () => ({ scenarioId }),
				};
			})(),
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
			reference: { status: 'contracted', id: 'kibble-shelf-native', version: KIBBLE_REFERENCE_CONTRACT.version },
			autonomy: { preset: 'preserve', decisionMode: 'rules', publicationMode: 'live' },
			renderer: { componentId: 'kibble.home', variantId: 'kibble-home-reference-v1' },
		});
		expect(mocks.logGeneration).toHaveBeenCalledOnce();
		expect(mocks.logGeneration).toHaveBeenCalledWith(expect.objectContaining({
			type: 'preserve_render', categorySlug: 'home', sessionId: 'session-one',
			provenance: data.provenance,
		}));
		expect(data.kibbleHomeInspector).toBeNull();
		expect(data.kibbleHome?.products[0]).not.toHaveProperty('personaFit');
		expect(data.products[0]).not.toHaveProperty('personaFit');
	});

	it('exposes the bounded decision inspector only when server dev and dev mode are both active', async () => {
		const data = await load({
			url: new URL('https://aisles.test/?dev=true'), request: new Request('https://aisles.test/?dev=true'),
			cookies: { get: () => undefined, set: () => undefined },
			parent: async () => ({ devMode: true, renderMode: 'reference-preserve' }),
		} as never);

		if (!data) throw new Error('Expected Preserve home data.');
		expect(data.kibbleHomeInspector).toMatchObject({
			reference: { id: 'kibble-shelf-native', version: KIBBLE_REFERENCE_CONTRACT.version },
			surface: 'home',
			dataSourceLabel: 'merchant-enrichment',
			inference: { primary: 'gatherer', ruleMatches: [] },
		});
		const productZone = data.kibbleHomeInspector?.zones.find((zone: { id: string }) => zone.id === 'ranked-products');
		expect(productZone?.outputProducts?.map((product: { id: string }) => product.id))
			.toEqual(data.kibbleHome?.products.map((product: { id: string }) => product.id));
	});

	it('does not reopen the inspector from a persisted site-wide dev cookie', async () => {
		const data = await load({
			url: new URL('https://aisles.test/?intent=hunter'), request: new Request('https://aisles.test/?intent=hunter'),
			cookies: { get: () => undefined, set: () => undefined },
			parent: async () => ({ devMode: true, renderMode: 'reference-preserve' }),
		} as never);

		if (!data) throw new Error('Expected Preserve home data.');
		expect(data.kibbleHomeInspector).toBeNull();
	});

	it('marks runner-owned showcase data synthetic in contracted provenance', async () => {
		mocks.privateEnv.KIBBLE_SHOWCASE_SCENARIO_ID = 'kibble-local-showcase';
		try {
			const data = await load({
				url: new URL('https://aisles.test/?dev=true&intent=gifter'), request: new Request('https://aisles.test/?dev=true&intent=gifter'),
				cookies: { get: () => undefined, set: () => undefined },
				parent: async () => ({ devMode: true, renderMode: 'reference-preserve' }),
			} as never);

			if (!data) throw new Error('Expected Preserve home data.');
			expect(data.provenance.synthetic).toEqual({ value: true, scenarioId: 'kibble-local-showcase' });
		} finally {
			delete mocks.privateEnv.KIBBLE_SHOWCASE_SCENARIO_ID;
		}
	});

	it('turns request-state failures into the branded Preserve 503 boundary', async () => {
		mocks.createStoreFromRequest.mockRejectedValueOnce(new Error('database unavailable'));
		await expect(load({
			url: new URL('https://aisles.test/'), request: new Request('https://aisles.test/'),
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
});
