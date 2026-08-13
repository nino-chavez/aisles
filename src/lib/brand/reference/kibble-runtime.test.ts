import { describe, expect, it } from 'vitest';
import { getBrandById } from '$lib/brand/config';
import type { Product } from '$lib/types';
import { KIBBLE_PRESERVE_MANIFEST } from './kibble-manifest';
import {
	assertKibblePdpBundleProjection,
	KIBBLE_PDP_BUNDLE_PROJECTION_VERIFIED_SHA256,
} from './kibble-manifest.server';
import { KIBBLE_PDP_BOUNDS, KIBBLE_PDP_BUNDLE_PROJECTION_SHA256, KIBBLE_REFERENCE_CONTRACT } from './kibble';
import {
	buildKibbleHomeReference,
	isKibblePdpPublished,
	materializeKibbleCategory,
	selectMerchantRenderMode,
	verifyAndMaterializeBundle,
} from './kibble-runtime';

const bundle: Product = {
	id: 'essential-bundle-kns4',
	entityId: 3065,
	name: 'Essential Bundle',
	price: 109,
	image: KIBBLE_PRESERVE_MANIFEST.display.featuredBundle.image,
	imageAlt: 'Essential Bundle',
	description: '',
	specs: {},
	tags: [],
	category: 'Bundles',
};

const product = (entityId: number, id: string): Product => ({
	id,
	entityId,
	name: `Product ${entityId}`,
	price: entityId,
	image: `https://example.com/${entityId}.png`,
	imageAlt: `Product ${entityId}`,
	description: '',
	specs: {},
	tags: [],
	category: 'Dog Food',
});

describe('Kibble Preserve runtime adapter', () => {
	it('selects Preserve only through an own trusted brand id', () => {
		expect(selectMerchantRenderMode('kibble', 'home')).toBe('reference-preserve');
		expect(selectMerchantRenderMode('kibble', 'plp')).toBe('reference-preserve');
		expect(selectMerchantRenderMode('kibble', 'pdp')).toBe('reference-preserve');
		expect(selectMerchantRenderMode('kibble', 'pdp', { allowPendingReview: true })).toBe('reference-preserve');
		expect(selectMerchantRenderMode('kibble', 'account')).toBe('reference-preserve');
		expect(selectMerchantRenderMode('kibble', 'locator')).toBe('reference-preserve');
		expect(isKibblePdpPublished()).toBe(true);
		expect(selectMerchantRenderMode('haven', 'home')).toBe('legacy-generated');
		expect(selectMerchantRenderMode('__proto__', 'home')).toBe('legacy-generated');
		expect(selectMerchantRenderMode({ id: 'kibble' }, 'home')).toBe('legacy-generated');
	});

	it('requires stable catalog facts without binding the category CTA to a mutable product slug', () => {
		expect(verifyAndMaterializeBundle(bundle)).toMatchObject({
			entityId: 3065,
			href: '/category/bundles',
			oneTimePrice: 109,
		});
		expect(verifyAndMaterializeBundle(bundle)).not.toHaveProperty('subscribePrice');
		expect(() => verifyAndMaterializeBundle(null)).toThrow('requires live BigCommerce product 3065');
		expect(() => verifyAndMaterializeBundle({ ...bundle, price: 108 })).toThrow('bundle mismatch for list price');
		expect(() => verifyAndMaterializeBundle({ ...bundle, name: 'Almost Essential' })).toThrow('bundle mismatch for name');
		expect(() => verifyAndMaterializeBundle({ ...bundle, id: 'essential-bundle' })).not.toThrow();
		expect(verifyAndMaterializeBundle({ ...bundle, image: 'https://cdn11.bigcommerce.com/transformed.png' }).image)
			.toBe(KIBBLE_PRESERVE_MANIFEST.display.featuredBundle.image);
	});

	it('materializes the exact fixed recipe input without duplicating the bundle', () => {
		const brand = getBrandById('kibble');
		expect(brand).toBeDefined();
		const home = buildKibbleHomeReference(
			brand!,
			[product(4, 'four'), product(2, 'two'), product(3, 'three')],
			'deterministic-catalog',
			bundle,
		);
		expect(KIBBLE_PRESERVE_MANIFEST.recipe).toEqual([
			'opening-merchandising', 'ranked-products', 'catalog-entry', 'service-proof',
		]);
		expect(home.featuredCopy.title).toBe('Catalog shelf');
		expect(home.products.map(({ entityId }) => entityId)).toEqual([4, 2, 3]);
		expect(home.productHrefs).toEqual({ four: '/product/four', two: '/product/two', three: '/product/three' });
		expect(home.categories).toHaveLength(8);
		expect(home.hero.proofItems).toEqual([]);
		expect(() => buildKibbleHomeReference(brand!, [bundle], 'featured', bundle))
			.toThrow('must not duplicate the featured bundle');
	});

	it('materializes breadcrumb, sort, cursor continuation, and approved read-only PDP links', () => {
		const brand = getBrandById('kibble')!;
		const category = materializeKibbleCategory(brand, 'dog-food', [product(1, 'one')], {
			sort: 'LOWEST_PRICE',
			pageInfo: { hasNextPage: true, endCursor: 'YXJyYXljb25uZWN0aW9uOjIz' },
		});
		expect(category.breadcrumbs).toEqual([{ label: 'Home', href: '/' }, { label: 'Dog Food' }]);
		expect(category.sortOptions).toHaveLength(7);
		expect(category.selectedSort).toBe('LOWEST_PRICE');
		expect(category.loadMoreHref).toBe('?sort=LOWEST_PRICE&after=YXJyYXljb25uZWN0aW9uOjIz');
		expect(category.productHrefs).toEqual({ one: '/product/one' });
		expect(materializeKibbleCategory(brand, 'dog-food', [product(1, 'one')], {
			sort: 'FEATURED', pageInfo: { hasNextPage: false, endCursor: null },
		}).loadMoreHref).toBeNull();
	});

	it('records every bounded copy divergence and withholds operational claims', () => {
		expect(KIBBLE_PRESERVE_MANIFEST.copyProvenance.approvedBoundedDivergences.map(({ field }) => field)).toEqual([
			'home.hero.eyebrow', 'home.hero.headline', 'home.hero.body', 'home.serviceProof', 'error.notFoundHeadline', 'pdp.purchaseUnavailable',
		]);
		expect(KIBBLE_PRESERVE_MANIFEST.withheldSourceClaims).toContain('engine health');
		expect(JSON.stringify(KIBBLE_PRESERVE_MANIFEST.display)).not.toContain('$30M');
		expect(JSON.stringify(KIBBLE_PRESERVE_MANIFEST.display)).not.toContain('5 vetted brands');
		expect(JSON.stringify(KIBBLE_PRESERVE_MANIFEST.display)).not.toContain('Preserve adapter');
		expect(JSON.stringify(KIBBLE_PRESERVE_MANIFEST.display)).not.toContain('fixed shelf structure');
		expect(JSON.stringify(KIBBLE_PRESERVE_MANIFEST.display)).not.toContain('never lapses');
		expect(JSON.stringify(KIBBLE_PRESERVE_MANIFEST.display.pdp.bundles)).not.toMatch(/subscribable|subscribe_price|save/);
		const pdpVariant = KIBBLE_REFERENCE_CONTRACT.components.find(({ id }) => id === 'kibble.product-detail')!.variants[0];
		const copyLimit = pdpVariant.copyFields.find(({ field }) => field === 'copy.*')!.maxLength;
		expect(Object.values(KIBBLE_PRESERVE_MANIFEST.display.pdp.copy).every((value) => value.length <= copyLimit)).toBe(true);
		for (const item of Object.values(KIBBLE_PRESERVE_MANIFEST.display.pdp.bundles)) {
			expect(Object.keys(item).sort()).toEqual(['contents', 'name']);
			expect(item.contents.length).toBeLessThanOrEqual(KIBBLE_PDP_BOUNDS.arrays.bundleContents);
			for (const content of item.contents) expect(Object.keys(content).sort()).toEqual(['brand', 'image', 'role', 'title']);
		}
	});

	it('pins the safe eight-bundle projection and rejects copied-data tampering', () => {
		expect(KIBBLE_PDP_BUNDLE_PROJECTION_VERIFIED_SHA256).toBe(KIBBLE_PDP_BUNDLE_PROJECTION_SHA256);
		expect(assertKibblePdpBundleProjection(KIBBLE_PRESERVE_MANIFEST.display.pdp.bundles))
			.toBe(KIBBLE_PDP_BUNDLE_PROJECTION_SHA256);
		const reordered = Object.fromEntries(Object.entries(KIBBLE_PRESERVE_MANIFEST.display.pdp.bundles).reverse());
		expect(assertKibblePdpBundleProjection(reordered)).toBe(KIBBLE_PDP_BUNDLE_PROJECTION_SHA256);

		const changedCopy = structuredClone(KIBBLE_PRESERVE_MANIFEST.display.pdp.bundles);
		(changedCopy['essential-bundle-kns4'].contents[0] as { role: string }).role = 'Tampered role';
		expect(() => assertKibblePdpBundleProjection(changedCopy)).toThrow(/SHA mismatch/);

		const missingBundle = structuredClone(KIBBLE_PRESERVE_MANIFEST.display.pdp.bundles) as Record<string, unknown>;
		delete missingBundle['gift-bundle'];
		expect(() => assertKibblePdpBundleProjection(missingBundle)).toThrow(/exactly 8 bundles/);
	});
});
