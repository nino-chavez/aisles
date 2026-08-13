import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	executeKibbleErrorZoneAdapter,
	executeKibbleHiddenZoneTerminalsForRoute,
	executeKibbleHomeZoneAdapters,
	executeKibblePdpRelatedZoneAdapter,
	executeKibblePlpZoneAdapter,
	executeKibbleSearchEmptyZoneAdapter,
	executeKibbleZoneTerminal,
} from './kibble-zone-executor.server';
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
			await executeKibbleErrorZoneAdapter({ surface: 'error-404', routePath: '/missing', status: 404, message: 'Page unavailable.' }),
			await executeKibbleErrorZoneAdapter({ surface: 'error-empty', routePath: '/search', status: 503, message: 'Shelf unavailable.' }),
		].filter((binding): binding is NonNullable<typeof binding> => binding !== null);
		expect(visible).toHaveLength(11);
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
			'error-404.rescue': 'kibble.error.rescue',
			'error-empty.rescue': 'kibble.error.rescue',
		} as const;
		for (const binding of visible) {
			expect(binding.content).toBeTruthy();
			expect(binding.sharedContentKind).toBe('content');
			expect(binding.sharedStatus).toBe(binding.instanceId === 'pdp.related' ? 'approval_candidate' : 'live');
			expect(binding.componentVariantId).toBe(exactVariants[binding.instanceId as keyof typeof exactVariants]);
			expect(binding.inputSha256).toMatch(/^[0-9a-f]{64}$/);
		}

		const hidden = (await Promise.all(shopperRoutes.map(executeKibbleHiddenZoneTerminalsForRoute))).flat();
		expect(hidden).toHaveLength(25);
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
		expect(visible).toHaveLength(11);
		expect(hidden).toHaveLength(25);
		expect(hidden.find(({ instanceId }) => instanceId === 'cart.above-checkout-cta')).toBeTruthy();
		await expect(executeKibbleZoneTerminal(visible[0])).rejects.toThrow('requires semantic adapter content');
	});
});
