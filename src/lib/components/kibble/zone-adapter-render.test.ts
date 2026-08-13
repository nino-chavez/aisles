import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { KIBBLE_PRESERVE_MANIFEST } from '$lib/brand/reference/kibble-manifest';
import {
	executeKibbleErrorZoneAdapter,
	executeKibbleHomeZoneAdapters,
	executeKibblePdpRelatedZoneAdapter,
	executeKibblePlpZoneAdapter,
	executeKibbleSearchEmptyZoneAdapter,
} from '$lib/brand/reference/kibble-zone-executor.server';
import { KIBBLE_ZONE_TERMINALS } from '$lib/brand/reference/kibble-zone-union';
import KibbleCategoryReference from './KibbleCategoryReference.svelte';
import KibbleErrorReference from './KibbleErrorReference.svelte';
import KibbleHomeReference from './KibbleHomeReference.svelte';
import KibbleProductDetailReference from './KibbleProductDetailReference.svelte';
import KibbleSearchReference from './KibbleSearchReference.svelte';
import type { KibbleProduct } from './types';

const priorBrand = process.env.BRAND_ID;
beforeAll(() => { process.env.BRAND_ID = 'kibble'; });
afterAll(() => {
	if (priorBrand === undefined) delete process.env.BRAND_ID;
	else process.env.BRAND_ID = priorBrand;
});

const products: KibbleProduct[] = Array.from({ length: 6 }, (_, index) => ({
	id: `product-${index + 1}`,
	entityId: 3023 + index,
	name: `Catalog product ${index + 1}`,
	price: 20 + index,
	image: '',
	imageAlt: `Catalog product ${index + 1}`,
	description: 'Catalog description.',
	specs: {},
	tags: [],
	category: 'Dog Food',
}));

describe('Kibble native zone DOM bindings', () => {
	it('renders executed adapter content instead of fallback component copy', async () => {
		const adapter = await executeKibbleErrorZoneAdapter({
			surface: 'error-404', routePath: '/missing-content-check', status: 404,
			message: 'EXECUTED ADAPTER BODY',
		});
		const body = render(KibbleErrorReference, { props: {
			status: 404,
			message: 'FALLBACK BODY SENTINEL',
			eyebrow: 'FALLBACK EYEBROW SENTINEL',
			headline: 'FALLBACK HEADLINE SENTINEL',
			returnLabel: 'Return home',
			zoneAdapter: adapter as never,
		} }).body;
		expect(body).toContain('EXECUTED ADAPTER BODY');
		expect(body).toContain(KIBBLE_PRESERVE_MANIFEST.display.error.headline);
		expect(body).not.toContain('FALLBACK BODY SENTINEL');
		expect(body).not.toContain('FALLBACK EYEBROW SENTINEL');
		expect(body).not.toContain('FALLBACK HEADLINE SENTINEL');
	});

	it('renders every content-backed adapter with its exact shared terminal markers and no Hidden zone DOM', async () => {
		const home = await executeKibbleHomeZoneAdapters({
			hero: { eyebrow: 'Catalog', headline: 'Trusted shelf', body: 'Pinned catalog copy.' },
			products,
			featuredCopy: { title: 'Featured' },
			categoryEyebrow: 'Browse',
			categoryTitle: 'Shop by category',
			serviceProof: [
				{ title: 'Independent brands', body: 'Current catalog.' },
				{ title: 'Clear paths', body: 'Focused shelves.' },
				{ title: 'Catalog facts', body: 'Read-only product data.' },
			],
		});
		const plp = await executeKibblePlpZoneAdapter({ routePath: '/category/dog-food', eyebrow: 'Catalog', title: 'Dog Food', productCount: 6 });
		const pdp = await executeKibblePdpRelatedZoneAdapter(products.slice(0, 3), 'You may also like', '/product/reference-product');
		const search = await executeKibbleSearchEmptyZoneAdapter({ query: 'missing', body: 'Try a different keyword.' });
		const error404 = await executeKibbleErrorZoneAdapter({ surface: 'error-404', routePath: '/missing', status: 404, message: 'Page unavailable.' });
		const errorEmpty = await executeKibbleErrorZoneAdapter({ surface: 'error-empty', routePath: '/search', status: 503, message: 'Shelf unavailable.' });
		if (!pdp) throw new Error('Expected the related-products adapter.');

		const bodies = [
			render(KibbleHomeReference, { props: {
				hero: {
					eyebrow: 'Catalog', headline: 'Trusted shelf', body: 'Pinned catalog copy.', ctas: [], proofItems: [],
					featured: { name: 'Bundle', href: '/category/bundles', image: '', oneTimePrice: 109, contents: [], eyebrow: 'Bundle', ctaLabel: 'Browse bundles' },
				},
				products, productHrefs: {}, categories: [{ label: 'Dog Food', href: '/category/dog-food', image: '' }], serviceProof: [
					{ title: 'Independent brands', body: 'Current catalog.' },
					{ title: 'Clear paths', body: 'Focused shelves.' },
					{ title: 'Catalog facts', body: 'Read-only product data.' },
				],
				featuredCopy: { title: 'Featured', eyebrow: 'Catalog', browseAllLabel: 'Browse' }, browseHref: '/category/dog-food',
				categoryTitle: 'Shop by category', categoryEyebrow: 'Browse', zoneAdapters: home,
			} }).body,
			render(KibbleCategoryReference, { props: {
				eyebrow: 'Catalog', title: 'Dog Food', breadcrumbs: [{ label: 'Home', href: '/' }, { label: 'Dog Food' }],
				sortLabel: 'Sort', sortOptions: [{ value: 'FEATURED', label: 'Featured' }], selectedSort: 'FEATURED',
				productCount: 6, productSingular: 'product', productPlural: 'products', emptyMessage: 'No products.', products,
				productHrefs: {}, loadMoreHref: null, loadMoreLabel: 'Load more', zoneAdapter: plp,
			} }).body,
			render(KibbleProductDetailReference, { props: {
				product: { ...products[0], sku: 'SKU-1', categoryPath: '/dog-food/', currencyCode: 'USD', isInStock: true, images: [], descriptionPlain: 'Catalog description.' },
				bundle: null, breadcrumbs: [{ label: 'Home', href: '/' }, { label: products[0].name }], options: [],
				relatedProducts: products.slice(0, 3), relatedProductHrefs: {}, purchaseUnavailableLabel: 'Purchase unavailable',
				purchaseUnavailableBody: 'No purchase action is available.', relatedHeading: 'You may also like', copy: KIBBLE_PRESERVE_MANIFEST.display.pdp.copy,
				zoneAdapter: pdp,
			} }).body,
			render(KibbleSearchReference, { props: { query: 'missing', products: [], pageInfo: { hasNextPage: false, endCursor: null }, loadMoreHref: null, zoneAdapter: search } }).body,
			render(KibbleErrorReference, { props: { status: 404, message: 'Page unavailable.', eyebrow: 'Unavailable', headline: 'Page unavailable', returnLabel: 'Return home', zoneAdapter: error404 as never } }).body,
			render(KibbleErrorReference, { props: { status: 503, message: 'Shelf unavailable.', eyebrow: 'Unavailable', headline: 'Shelf unavailable', returnLabel: 'Return home', zoneAdapter: errorEmpty as never } }).body,
		].join('\n');

		const visible = [home.hero, ...home.featuredRows, home.editorial, home.belowFold, plp, pdp, search, error404, errorEmpty];
		for (const adapter of visible) {
			expect(bodies).toContain(`data-kibble-zone-instance="${adapter.instanceId}"`);
			expect(bodies).toContain(`data-kibble-zone-status="${adapter.sharedStatus}"`);
			expect(bodies).toContain('data-kibble-zone-content-kind="content"');
			expect(bodies).toContain(`data-kibble-zone-adapter="${adapter.adapterId}"`);
			expect(bodies).toContain(`data-kibble-zone-variant="${adapter.componentVariantId}"`);
			expect(bodies).toContain(`data-kibble-zone-input-sha256="${adapter.inputSha256}"`);
		}
		for (const hidden of KIBBLE_ZONE_TERMINALS.filter(({ terminal }) => terminal === 'trusted-hidden')) {
			expect(bodies).not.toContain(`data-kibble-zone-instance="${hidden.instanceId}"`);
		}
	});
});
