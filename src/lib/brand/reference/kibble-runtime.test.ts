import { describe, expect, it } from 'vitest';
import { getBrandById } from '$lib/brand/config';
import type { Product } from '$lib/types';
import { KIBBLE_PRESERVE_MANIFEST } from './kibble-manifest';
import {
	buildKibbleHomeReference,
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
		expect(selectMerchantRenderMode('kibble')).toBe('reference-preserve');
		expect(selectMerchantRenderMode('haven')).toBe('legacy-generated');
		expect(selectMerchantRenderMode('__proto__')).toBe('legacy-generated');
		expect(selectMerchantRenderMode({ id: 'kibble' })).toBe('legacy-generated');
	});

	it('requires the exact live bundle identity before using the pinned offer', () => {
		expect(verifyAndMaterializeBundle(bundle)).toMatchObject({
			entityId: 3065,
			href: '/category/bundles',
			subscribePrice: 97,
			oneTimePrice: 109,
		});
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
		expect(home.categories).toHaveLength(8);
		expect(home.hero.proofItems).toEqual([]);
	});

	it('records every bounded copy divergence and withholds operational claims', () => {
		expect(KIBBLE_PRESERVE_MANIFEST.copyProvenance.approvedBoundedDivergences.map(({ field }) => field)).toEqual([
			'home.hero.eyebrow', 'home.hero.body', 'home.serviceProof',
		]);
		expect(KIBBLE_PRESERVE_MANIFEST.withheldSourceClaims).toContain('engine health');
		expect(JSON.stringify(KIBBLE_PRESERVE_MANIFEST.display)).not.toContain('$30M');
		expect(JSON.stringify(KIBBLE_PRESERVE_MANIFEST.display)).not.toContain('5 vetted brands');
		expect(JSON.stringify(KIBBLE_PRESERVE_MANIFEST.display)).not.toContain('Preserve adapter');
		expect(JSON.stringify(KIBBLE_PRESERVE_MANIFEST.display)).not.toContain('fixed shelf structure');
	});
});
