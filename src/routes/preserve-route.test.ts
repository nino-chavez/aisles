import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import HomePage from './+page.svelte';
import CategoryPage from './category/[slug]/+page.svelte';
import ProductPage from './product/[slug]/+page.svelte';
import { _parseKibblePlpRequest } from './category/[slug]/+page.server';
import { load as loadLayout } from './+layout.server';
import { load as loadSearch } from './search/+page.server';
import { GET as getCart, POST as postCart } from './api/cart/+server';
import type { Product } from '$lib/types';
import { KIBBLE_PRESERVE_MANIFEST } from '$lib/brand/reference/kibble-manifest';

const route = (path: string) => readFileSync(resolve(import.meta.dirname, path), 'utf8');
const product: Product = {
	id: 'actual-product', entityId: 10, name: 'Actual Product', price: 20,
	image: 'https://example.com/product.png', imageAlt: 'Actual Product', description: '', specs: {}, tags: [], category: 'Dog Food',
};

describe('Preserve route boundaries', () => {
	it('accepts only the seven canonical sorts and bounded opaque cursors', () => {
		expect(_parseKibblePlpRequest(new URL('https://aisles.test/category/dog-food'))).toEqual({
			sort: 'FEATURED', after: null,
		});
		expect(_parseKibblePlpRequest(new URL('https://aisles.test/category/dog-food?sort=NEWEST&after=YXJyYXljb25uZWN0aW9uOjIz'))).toEqual({
			sort: 'NEWEST', after: 'YXJyYXljb25uZWN0aW9uOjIz',
		});
		for (const url of [
			'https://aisles.test/category/dog-food?sort=RELEVANCE',
			'https://aisles.test/category/dog-food?sort=BEST_REVIEWED',
			'https://aisles.test/category/dog-food?after=cursor%20with%20spaces',
			'https://aisles.test/category/dog-food?after=',
		]) {
			try {
				_parseKibblePlpRequest(new URL(url));
				throw new Error('Expected invalid PLP input to fail closed.');
			} catch (cause) {
				expect(cause).toMatchObject({ status: 400 });
			}
		}
	});

	it('establishes the render mode on the server from the configured merchant', async () => {
		const previousBrand = process.env.BRAND_ID;
		const cookies = { get: () => undefined, set: () => undefined };
		try {
			process.env.BRAND_ID = 'kibble';
			const kibble = await loadLayout({ url: new URL('https://aisles.test/'), cookies } as never);
			if (!kibble) throw new Error('Expected the Kibble root layout server load to return data.');
			expect(kibble.renderMode).toBe('reference-preserve');
			expect(kibble.chromeMode).toBe('reference');
			expect(kibble.kibbleChrome?.navItems[0]).toEqual({ label: 'Dog Food', href: '/category/dog-food' });
			expect(kibble.kibbleChrome?.statusItems).toEqual([]);
			expect(kibble.kibbleErrorPolicy).toMatchObject({
				referenceId: 'kibble-shelf-native', referenceVersion: '1.5.0',
				policies: [{ surface: 'error-404' }, { surface: 'error-empty' }],
			});

			process.env.BRAND_ID = 'haven';
			const legacy = await loadLayout({ url: new URL('https://aisles.test/'), cookies } as never);
			if (!legacy) throw new Error('Expected the legacy root layout server load to return data.');
			expect(legacy.renderMode).toBe('legacy-generated');
			expect(legacy.chromeMode).toBe('legacy');
			expect(legacy.kibbleChrome).toBeNull();
			expect(legacy.kibbleErrorPolicy).toBeNull();

			process.env.BRAND_ID = 'kibble';
			const pdp = await loadLayout({ url: new URL('https://aisles.test/product/example'), cookies } as never);
			if (!pdp) throw new Error('Expected the contracted Kibble PDP layout to return data.');
			expect(pdp.renderMode).toBe('reference-review');
			expect(pdp.chromeMode).toBe('reference');
		} finally {
			if (previousBrand === undefined) delete process.env.BRAND_ID;
			else process.env.BRAND_ID = previousBrand;
		}
	});

	it('SSR renders only the Kibble home tree in Preserve mode', () => {
		const result = render(HomePage, {
			props: {
				data: {
					renderMode: 'reference-preserve',
					brandName: 'Kibble & Co.',
					brandTagline: 'UNVERIFIED — never running out',
					homepage: { heroHeadline: 'LEGACY HOME SENTINEL', heroBody: 'Legacy description' },
					kibbleHome: {
						hero: {
							eyebrow: 'Reference eyebrow', headline: 'REFERENCE HOME SENTINEL', body: 'Reference description',
							ctas: [], proofItems: [],
							featured: {
								name: 'Essential Bundle', href: '/category/bundles', image: 'https://example.com/bundle.png',
								oneTimePrice: 109, contents: [],
								eyebrow: 'Featured bundle', ctaLabel: 'Browse bundles',
							},
						},
						products: [product], productHrefs: {}, categories: [], serviceProof: [],
						featuredCopy: { title: 'Featured', eyebrow: 'Catalog', browseAllLabel: 'Browse Dog Food' },
						browseHref: '/category/dog-food', categoryTitle: 'Shop by category', categoryEyebrow: 'Browse',
					},
				} as never,
			},
		});
		expect(result.body).toContain('REFERENCE HOME SENTINEL');
		expect(result.body).not.toContain('/product/actual-product');
		expect(result.body).not.toContain('LEGACY HOME SENTINEL');
		expect(result.head).toContain('<title>Kibble &amp; Co.</title>');
		expect(result.head).not.toContain('never running out');
	});

	it('SSR renders the fixed Kibble category shell instead of a persona layout', () => {
		const result = render(CategoryPage, {
			props: {
				data: {
					renderMode: 'reference-preserve',
					category: { name: 'Dog Food', slug: 'dog-food' }, products: [product], persona: 'gatherer',
					kibbleCategory: {
						eyebrow: 'Catalog', title: 'Dog Food',
						breadcrumbs: [{ label: 'Home', href: '/' }, { label: 'Dog Food' }],
						sortLabel: 'Sort:',
						sortOptions: [
							{ value: 'FEATURED', label: 'Featured' }, { value: 'NEWEST', label: 'Newest' },
							{ value: 'BEST_SELLING', label: 'Best selling' }, { value: 'A_TO_Z', label: 'A to Z' },
							{ value: 'Z_TO_A', label: 'Z to A' }, { value: 'LOWEST_PRICE', label: 'Price: low to high' },
							{ value: 'HIGHEST_PRICE', label: 'Price: high to low' },
						],
						selectedSort: 'FEATURED', productCount: 1, productSingular: 'product', productPlural: 'products',
						emptyMessage: 'No products.', products: [product], productHrefs: {},
						loadMoreHref: '?sort=FEATURED&after=next-cursor', loadMoreLabel: 'Load more',
					},
				} as never,
			},
		});
		expect(result.body).toContain('Actual Product');
		expect(result.body).not.toContain('/product/actual-product');
		expect(result.body).toContain('aria-label="Breadcrumb"');
		expect(result.body).toContain('aria-current="page"');
		expect(result.body.match(/<option/g)).toHaveLength(7);
		expect(result.body).toContain('?sort=FEATURED&amp;after=next-cursor');
		expect(result.body).toContain('Load more');
		expect(result.body).toContain('1 product');
		expect(result.body).not.toContain('Personalizing');
	});

	it('SSR renders the approval-gated PDP review without generic commerce controls', () => {
		const result = render(ProductPage, {
			props: {
				data: {
					renderMode: 'reference-review',
					kibblePdp: {
						product: {
							...product, sku: 'ACTUAL-10', categoryPath: '/dog-food/', currencyCode: 'USD',
							isInStock: true, images: [], description: '<p>Catalog details.</p>', descriptionPlain: 'Catalog details.',
						},
						bundle: null,
						breadcrumbs: [{ label: 'Home', href: '/' }, { label: product.name }],
						options: [], relatedProducts: [], relatedProductHrefs: {},
						purchaseUnavailableLabel: KIBBLE_PRESERVE_MANIFEST.display.pdp.purchaseUnavailableLabel,
						purchaseUnavailableBody: KIBBLE_PRESERVE_MANIFEST.display.pdp.purchaseUnavailableBody,
						relatedHeading: KIBBLE_PRESERVE_MANIFEST.display.pdp.relatedHeading,
						copy: { ...KIBBLE_PRESERVE_MANIFEST.display.pdp.copy },
					},
				} as never,
			},
		});
		expect(result.body).toContain('data-reference-pdp="catalog-display-only"');
		expect(result.body).toContain('data-reference-contract-version="1.5.0"');
		expect(result.body).toContain('Purchase unavailable in this preview');
		expect(result.body).not.toMatch(/Add to Cart|Add to Picks|Pairs well with/);
	});

	it('keeps stream calls inside an explicit legacy guard on both routes', () => {
		for (const source of [route('+page.svelte'), route('category/[slug]/+page.svelte')]) {
			expect(source).toContain("if (data.renderMode === 'reference-preserve') return;");
			expect(source).toContain("fetch('/api/layout/stream'");
		}
	});

	it('keeps search unavailable while PDP has its own contracted server adapter', async () => {
		const parent = async () => ({ devMode: false, chromeMode: 'reference' });
		await expect(loadSearch({ url: new URL('https://aisles.test/search?q=food'), parent } as never))
			.rejects.toMatchObject({ status: 503 });
	});

	it('fails the unsupported Kibble cart API closed', async () => {
		const previousBrand = process.env.BRAND_ID;
		try {
			process.env.BRAND_ID = 'kibble';
			const cookies = { get: () => undefined };
			const getResponse = await getCart({ cookies } as never);
			const postResponse = await postCart({ cookies, request: new Request('https://aisles.test/api/cart', { method: 'POST' }) } as never);
			expect(getResponse.status).toBe(503);
			expect(postResponse.status).toBe(503);
		} finally {
			if (previousBrand === undefined) delete process.env.BRAND_ID;
			else process.env.BRAND_ID = previousBrand;
		}
	});
});
