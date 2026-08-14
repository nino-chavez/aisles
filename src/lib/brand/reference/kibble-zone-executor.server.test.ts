import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	executeKibbleErrorZoneAdapter,
	executeKibbleHiddenZoneTerminalsForRoute,
	executeKibbleHomeZoneAdapters,
	executeKibbleHomeModelShelf,
	executeKibbleCartEmptyZoneAdapter,
	executeKibbleCheckoutAssuranceZoneAdapter,
	executeKibblePdpRelatedModelShelf,
	executeKibblePdpRelatedZoneAdapter,
	executeKibblePlpZoneAdapter,
	executeKibbleSearchEmptyZoneAdapter,
	executeKibbleZoneTerminal,
} from './kibble-zone-executor.server';
import { withKibblePdpRelatedModelCallCount } from './kibble-pdp-related-model.server';
import { validateKibblePdpLivePreview } from '$lib/components/kibble/kibble-pdp-live-preview';
import type { KibbleProduct } from '$lib/components/kibble/types';
import { KIBBLE_CART_DEFAULT_PRESENTATION, KIBBLE_CHECKOUT_DEFAULT_PRESENTATION, KIBBLE_PDP_DEFAULT_PRESENTATION, KIBBLE_PDP_PRESENTATION_POLICY, materializeKibbleCartPresentation, materializeKibbleCheckoutPresentation } from './kibble-presentation-decisions';
import {
	KIBBLE_CANONICAL_UNION_ZONE_INSTANCE_IDS,
	KIBBLE_ZONE_TERMINALS,
} from './kibble-zone-union';

const previousBrand = process.env.BRAND_ID;

beforeAll(() => { process.env.BRAND_ID = 'kibble'; });
afterAll(() => {
	if (previousBrand === undefined) delete process.env.BRAND_ID;
	else process.env.BRAND_ID = previousBrand;
});

const shopperRoutes = [
	'/', '/category/dog-food', '/product/reference-product', '/cart', '/checkout',
	'/search', '/account', '/store-locator',
] as const;

describe('Kibble exact union-zone execution', () => {
	it('pins the exact 36-instance union independently of declaration order', () => {
		const hardCoded = [
			'home.hero', 'home.featured-row.1', 'home.featured-row.2', 'home.featured-row.3', 'home.featured-row.4', 'home.featured-row.5', 'home.featured-row.6', 'home.editorial-strip', 'home.brand-spotlight', 'home.below-fold',
			'plp.banner', 'plp.editorial-header', 'plp.cluster-row', 'plp.between-thirds', 'plp.below-grid', 'plp.empty-state',
			'pdp.below-description', 'pdp.related', 'pdp.cross-sell', 'pdp.recently-viewed', 'pdp.below-recs',
			'cart.above-checkout-cta', 'cart.below-fold', 'cart.empty-state',
			'checkout.assurance-strip', 'checkout.last-chance-upsell',
			'search.empty-state', 'search.zero-results-rescue',
			'account.welcome', 'account.dashboard-pick.1', 'account.dashboard-pick.2', 'account.dashboard-pick.3', 'account.dashboard-pick.4',
			'locator.editorial-intro', 'error-404.rescue', 'error-empty.rescue',
		];
		expect([...KIBBLE_CANONICAL_UNION_ZONE_INSTANCE_IDS].sort()).toEqual([...hardCoded].sort());
		expect(KIBBLE_ZONE_TERMINALS.map(({ instanceId }) => instanceId).sort()).toEqual([...hardCoded].sort());
		expect(new Set(hardCoded).size).toBe(36);
	});

	it('executes every exact instance as Kibble-native content or trusted Hidden', async () => {
		const home = await executeKibbleHomeZoneAdapters({
			hero: { eyebrow: 'Catalog', headline: 'Trusted shelf', body: 'Pinned catalog copy.' },
			products: Array.from({ length: 6 }, (_, index) => ({ entityId: 3023 + index })),
			featuredCopy: { title: 'Featured' }, categoryEyebrow: 'Browse', categoryTitle: 'Shop by category',
			serviceProof: [
				{ title: 'Independent brands', body: 'Current catalog.' },
				{ title: 'Clear paths', body: 'Focused shelves.' },
				{ title: 'Catalog facts', body: 'Read-only product data.' },
			],
		});
		const visible = [
			home.hero, ...home.featuredRows, home.editorial, home.belowFold,
			await executeKibblePlpZoneAdapter({ routePath: '/category/dog-food', eyebrow: 'Catalog', title: 'Dog Food', productCount: 6 }),
			await executeKibblePdpRelatedZoneAdapter([{ entityId: 3023 }, { entityId: 3024 }, { entityId: 3025 }], 'You may also like', '/product/reference-product'),
			await executeKibbleSearchEmptyZoneAdapter({ query: 'missing', body: 'Try a different keyword.' }),
			await executeKibbleCartEmptyZoneAdapter(materializeKibbleCartPresentation(KIBBLE_CART_DEFAULT_PRESENTATION).copy),
			await executeKibbleCheckoutAssuranceZoneAdapter({ routePath: '/checkout/gift', assurance: materializeKibbleCheckoutPresentation(KIBBLE_CHECKOUT_DEFAULT_PRESENTATION).assurance }),
			await executeKibbleErrorZoneAdapter({ surface: 'error-404', routePath: '/missing', status: 404, message: 'Page unavailable.' }),
			await executeKibbleErrorZoneAdapter({ surface: 'error-empty', routePath: '/search', status: 503, message: 'Shelf unavailable.' }),
		].filter((binding): binding is NonNullable<typeof binding> => binding !== null);
		expect(visible).toHaveLength(13);
		const exactVariants = {
			'home.hero': 'kibble.hero.zone-editorial-header',
			'home.featured-row.1': 'kibble.featured-grid.ranked-segment',
			'home.featured-row.2': 'kibble.featured-grid.ranked-segment',
			'home.featured-row.3': 'kibble.featured-grid.ranked-segment',
			'home.editorial-strip': 'kibble.visual-module.editorial-strip',
			'home.below-fold': 'kibble.service-proof.below-fold',
			'plp.editorial-header': 'kibble.category-listing.editorial-header',
			'pdp.related': 'kibble.product-detail.related-products',
			'search.empty-state': 'kibble.search.empty-state',
			'cart.empty-state': 'kibble.cart.reference-shell',
			'checkout.assurance-strip': 'kibble.checkout.reference-shell',
			'error-404.rescue': 'kibble.error.rescue',
			'error-empty.rescue': 'kibble.error.rescue',
		} as const;
		for (const binding of visible) {
			expect(binding.content).toBeTruthy();
			expect(binding.sharedContentKind).toBe('content');
			expect(binding.sharedStatus).toBe('live');
			expect(binding.componentVariantId).toBe(exactVariants[binding.instanceId as keyof typeof exactVariants]);
			expect(binding.inputSha256).toMatch(/^[0-9a-f]{64}$/);
		}

		const hidden = (await Promise.all(shopperRoutes.map(executeKibbleHiddenZoneTerminalsForRoute))).flat();
		expect(hidden).toHaveLength(23);
		for (const result of hidden) {
			expect(result.adapter).toBeNull();
			expect(['live', 'approval_candidate']).toContain(result.execution.status);
			expect(result.execution.render).toEqual({ kind: 'hidden' });
			if (result.execution.status === 'approval_candidate') {
				expect(result.execution.candidate.render).toEqual({ kind: 'hidden' });
			}
			expect(result.execution.provenance.instanceId).toBe(result.terminal.instanceId);
			expect(result.execution.provenance.zoneOrigin).toBe(result.terminal.origin);
		}

		const reached = [...visible.map(({ instanceId }) => instanceId), ...hidden.map(({ terminal }) => terminal.instanceId)].sort();
		expect(reached).toEqual([...KIBBLE_CANONICAL_UNION_ZONE_INSTANCE_IDS].sort());
	});

	it('does not let a visible declaration execute without semantic content', async () => {
		const visible = KIBBLE_ZONE_TERMINALS.filter(({ terminal }) => terminal === 'kibble-native');
		const hidden = KIBBLE_ZONE_TERMINALS.filter(({ terminal }) => terminal === 'trusted-hidden');
		expect(visible).toHaveLength(13);
		expect(hidden).toHaveLength(23);
		expect(hidden.find(({ instanceId }) => instanceId === 'cart.above-checkout-cta')).toBeTruthy();
		await expect(executeKibbleZoneTerminal(visible[0])).rejects.toThrow('requires semantic adapter content');
	});

	it('lets the live model boundary return only an exact approved product permutation', async () => {
		const products = [{ entityId: 3023 }, { entityId: 3024 }, { entityId: 3025 }];
		const runModel = async ({ outputSchema }: { outputSchema: { safeParse(value: unknown): { success: boolean } } }) => {
			const output = { rankedProductIds: ['3025', '3023', '3024'] };
			expect(outputSchema.safeParse(output).success).toBe(true);
			expect(outputSchema.safeParse({ ...output, headline: 'forbidden' }).success).toBe(false);
			return output;
		};
		const result = await executeKibbleHomeModelShelf({ products, runModel });
		expect(result.rankedProductIds).toEqual(['3025', '3023', '3024']);
		expect(result.adapter).toMatchObject({
			instanceId: 'home.featured-row.1', decisionMode: 'model', modelCallCount: 0,
			content: { component: 'product-grid', props: { products: [
				{ productId: '3025' }, { productId: '3023' }, { productId: '3024' },
			] } },
		});
	});

	it('permits the PDP model boundary on trusted product routes only', async () => {
		const products = [{ entityId: 3023 }, { entityId: 3024 }, { entityId: 3025 }];
		const result = await executeKibblePdpRelatedModelShelf({
			relatedProducts: products,
			heading: 'You may also like',
			routePath: '/product/puppy-starter-kit',
			runModel: async ({ outputSchema }) => outputSchema.parse({ rankedProductIds: ['3025', '3023', '3024'] }),
		});
		expect(result.rankedProductIds).toEqual(['3025', '3023', '3024']);
		expect(result.adapter).toMatchObject({ instanceId: 'pdp.related', decisionMode: 'model', content: { component: 'product-carousel' } });
		await expect(executeKibblePdpRelatedModelShelf({
			relatedProducts: products, heading: 'You may also like', routePath: '/category/dog-food',
			runModel: async ({ outputSchema }) => outputSchema.parse({ rankedProductIds: ['3025', '3023', '3024'] }),
		})).rejects.toThrow(/not approved/);
	});

	it('feeds the real executor adapter through client validation with the actual provider call count', async () => {
		const relatedProducts: KibbleProduct[] = [
			{ id: 'starter', entityId: 3023, name: 'Starter Bundle', price: 90, image: '', imageAlt: '', description: '', specs: {}, tags: [], category: 'Bundles' },
			{ id: 'mealtime', entityId: 3024, name: 'Mealtime Kit', price: 55, image: '', imageAlt: '', description: '', specs: {}, tags: [], category: 'Care' },
			{ id: 'toys', entityId: 3025, name: 'Dog Toy Kit', price: 32, image: '', imageAlt: '', description: '', specs: {}, tags: [], category: 'Toys' },
		];
		const result = await executeKibblePdpRelatedModelShelf({
			relatedProducts,
			heading: 'You may also like',
			routePath: '/product/puppy-starter-kit',
			runModel: async ({ outputSchema }) => outputSchema.parse({ rankedProductIds: ['3025', '3023', '3024'] }),
		});
		const adapter = withKibblePdpRelatedModelCallCount(result.adapter, 1);
		const preview = validateKibblePdpLivePreview({
			version: 'kibble-pdp-presentation-preview-v2', previewOnly: true,
			routePath: '/product/puppy-starter-kit', policyVersion: result.policy.policyVersion,
			persona: 'researcher', rankedProductIds: result.rankedProductIds,
			presentationPolicy: KIBBLE_PDP_PRESENTATION_POLICY, presentationDecision: KIBBLE_PDP_DEFAULT_PRESENTATION,
			zoneAdapter: adapter, modelCallCount: 1, provider: 'anthropic', modelId: 'claude-haiku-4-5', provenance: {},
		}, {
			routePath: '/product/puppy-starter-kit', policyVersion: result.policy.policyVersion,
			productIds: relatedProducts.map(({ entityId }) => String(entityId)), relatedHeading: 'You may also like',
		}, relatedProducts);
		expect(preview?.products.map(({ id }) => id)).toEqual(['toys', 'starter', 'mealtime']);
		expect(preview?.zoneAdapter.modelCallCount).toBe(1);
	});
});
