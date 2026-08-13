import { describe, expect, it } from 'vitest';
import { getBrandById } from '$lib/brand/config';
import type { Product } from '$lib/types';
import { KIBBLE_PRESERVE_MANIFEST } from './kibble-manifest';
import {
	buildKibbleHomeReference,
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
		expect(selectMerchantRenderMode('kibble', 'plp')).toBe('legacy-generated');
		expect(selectMerchantRenderMode('kibble', 'pdp')).toBe('legacy-generated');
		expect(selectMerchantRenderMode('haven', 'home')).toBe('legacy-generated');
		expect(selectMerchantRenderMode('__proto__', 'home')).toBe('legacy-generated');
		expect(selectMerchantRenderMode({ id: 'kibble' }, 'home')).toBe('legacy-generated');
	});

	it('requires the exact live bundle identity before using the pinned offer', () => {
		expect(verifyAndMaterializeBundle(bundle)).toMatchObject({
			entityId: 3065,
			href: '/category/bundles',
			oneTimePrice: 109,
		});
		expect(verifyAndMaterializeBundle(bundle)).not.toHaveProperty('subscribePrice');
		expect(() => verifyAndMaterializeBundle(null)).toThrow('requires live BigCommerce product 3065');
		expect(() => verifyAndMaterializeBundle({ ...bundle, price: 108 })).toThrow('bundle mismatch for list price');
		expect(() => verifyAndMaterializeBundle({ ...bundle, name: 'Almost Essential' })).toThrow('bundle mismatch for name');
		expect(verifyAndMaterializeBundle({ ...bundle, image: 'https://cdn11.bigcommerce.com/transformed.png' }).image)
			.toBe(KIBBLE_PRESERVE_MANIFEST.display.featuredBundle.image);
	});

	it('materializes the exact fixed recipe input without duplicating the bundle', () => {
		const brand = getBrandById('kibble');
		expect(brand).toBeDefined();
		const home = buildKibbleHomeReference(
			brand!,
			[bundle, product(4, 'four'), product(2, 'two'), product(3, 'three')],
			'deterministic-catalog',
			bundle,
		);
		expect(KIBBLE_PRESERVE_MANIFEST.recipe).toEqual([
			'opening-merchandising', 'ranked-products', 'catalog-entry', 'service-proof',
		]);
		expect(home.featuredCopy.title).toBe('Catalog shelf');
		expect(home.products.map(({ entityId }) => entityId)).toEqual([4, 2, 3]);
		expect(home.productHrefs).toEqual({});
		expect(home.categories).toHaveLength(8);
		expect(home.hero.proofItems).toEqual([]);
	});

	it('materializes breadcrumb, sort, and cursor continuation without PDP links', () => {
		const brand = getBrandById('kibble')!;
		const category = materializeKibbleCategory(brand, 'dog-food', [product(1, 'one')], {
			sort: 'LOWEST_PRICE',
			pageInfo: { hasNextPage: true, endCursor: 'YXJyYXljb25uZWN0aW9uOjIz' },
		});
		expect(category.breadcrumbs).toEqual([{ label: 'Home', href: '/' }, { label: 'Dog Food' }]);
		expect(category.sortOptions).toHaveLength(7);
		expect(category.selectedSort).toBe('LOWEST_PRICE');
		expect(category.loadMoreHref).toBe('?sort=LOWEST_PRICE&after=YXJyYXljb25uZWN0aW9uOjIz');
		expect(category.productHrefs).toEqual({});
		expect(materializeKibbleCategory(brand, 'dog-food', [product(1, 'one')], {
			sort: 'FEATURED', pageInfo: { hasNextPage: false, endCursor: null },
		}).loadMoreHref).toBeNull();
	});

	it('records every bounded copy divergence and withholds operational claims', () => {
		expect(KIBBLE_PRESERVE_MANIFEST.copyProvenance.approvedBoundedDivergences.map(({ field }) => field)).toEqual([
			'home.hero.eyebrow', 'home.hero.headline', 'home.hero.body', 'home.serviceProof',
		]);
		expect(KIBBLE_PRESERVE_MANIFEST.withheldSourceClaims).toContain('engine health');
		expect(JSON.stringify(KIBBLE_PRESERVE_MANIFEST.display)).not.toContain('$30M');
		expect(JSON.stringify(KIBBLE_PRESERVE_MANIFEST.display)).not.toContain('5 vetted brands');
		expect(JSON.stringify(KIBBLE_PRESERVE_MANIFEST.display)).not.toContain('Preserve adapter');
		expect(JSON.stringify(KIBBLE_PRESERVE_MANIFEST.display)).not.toContain('fixed shelf structure');
		expect(JSON.stringify(KIBBLE_PRESERVE_MANIFEST.display)).not.toContain('never lapses');
	});
});
