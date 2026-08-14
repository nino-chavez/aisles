import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';

const searchMocks = vi.hoisted(() => ({ searchKibbleCatalog: vi.fn() }));
vi.mock('$lib/brand/reference/kibble-search.server', async (importOriginal) => ({
	...await importOriginal<typeof import('$lib/brand/reference/kibble-search.server')>(),
	searchKibbleCatalog: searchMocks.searchKibbleCatalog,
}));
import HomePage from './+page.svelte';
import CategoryPage from './category/[slug]/+page.svelte';
import ProductPage from './product/[slug]/+page.svelte';
import { _parseKibblePlpRequest } from './category/[slug]/+page.server';
import { load as loadLayout } from './+layout.server';
import { load as loadSearch } from './search/+page.server';
import { GET as getCart, POST as postCart } from './api/cart/+server';
import type { Product } from '$lib/types';
import { KIBBLE_PRESERVE_MANIFEST } from '$lib/brand/reference/kibble-manifest';
import { KIBBLE_REFERENCE_CONTRACT } from '$lib/brand/reference/kibble';
import { KIBBLE_CATEGORY_JOB_PROFILES } from '$lib/brand/reference/kibble-catalog-enrichment';

const route = (path: string) => readFileSync(resolve(import.meta.dirname, path), 'utf8');
const product: Product = {
	id: 'actual-product', entityId: 10, name: 'Actual Product', price: 20,
	image: 'https://example.com/product.png', imageAlt: 'Actual Product', description: '', specs: {}, tags: [], category: 'Dog Food',
};

describe('Preserve route boundaries', () => {
	it('keeps the public observability demo active across ordinary shopper navigation', async () => {
		const previousBrand = process.env.BRAND_ID;
		const values = new Map<string, string>();
		const cookies = {
			get: (name: string) => values.get(name),
			set: (name: string, value: string) => values.set(name, value),
			delete: (name: string) => values.delete(name),
		};
		try {
			process.env.BRAND_ID = 'kibble';
			const started = await loadLayout({ url: new URL('https://aisles.test/?observe=true&utm_source=demo'), cookies } as never);
			if (!started) throw new Error('Expected observability PageData.');
			expect(started.observeMode).toBe(true);
			expect(started.kibbleCapabilityCoverage?.catalog).toMatchObject({ totalProducts: 49, pinnedOfferProducts: 34 });
			expect(started.observeSessionId).toMatch(/^[0-9a-f-]{36}$/);
			expect(started.observeEnableHref).toBe('/?observe=true&utm_source=demo');
			expect(started.observeDisableHref).toBe('/?observe=false&utm_source=demo');
			expect(values.get('aisles_observe_demo')).toBe('1');

			const continued = await loadLayout({ url: new URL('https://aisles.test/category/dog-food?sort=NEWEST'), cookies } as never);
			if (!continued) throw new Error('Expected persistent observability PageData.');
			expect(continued.observeMode).toBe(true);
			expect(continued.kibbleCapabilityCoverage).not.toBeNull();
			expect(continued.observeEnableHref).toBe('/category/dog-food?sort=NEWEST&observe=true');
			expect(continued.observeDisableHref).toBe('/category/dog-food?sort=NEWEST&observe=false');

			const stopped = await loadLayout({ url: new URL('https://aisles.test/category/dog-food?observe=false'), cookies } as never);
			if (!stopped) throw new Error('Expected stopped observability PageData.');
			expect(stopped.observeMode).toBe(false);
			expect(stopped.kibbleCapabilityCoverage).toBeNull();
			expect(values.has('aisles_observe_demo')).toBe(false);
		} finally {
			if (previousBrand === undefined) delete process.env.BRAND_ID;
			else process.env.BRAND_ID = previousBrand;
		}
	});

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
			expect(kibble.routeAudience).toBe('shopper');
			expect(kibble.kibbleRoutePolicy).toMatchObject({ routePath: '/', surface: 'home' });
			expect(kibble.kibbleProvenance).toMatchObject({
				referenceId: KIBBLE_REFERENCE_CONTRACT.id,
				referenceVersion: KIBBLE_REFERENCE_CONTRACT.version,
				fixtureSha256: KIBBLE_REFERENCE_CONTRACT.source.fixtureSha256,
				routePath: '/',
				surface: 'home',
			});
			expect(kibble.kibbleChrome?.navItems[0]).toEqual({ label: 'Dog Food', href: '/category/dog-food' });
			expect(kibble.kibbleChrome?.statusItems).toEqual([]);
			expect(kibble).not.toHaveProperty('kibbleErrorPolicy');
			expect(kibble).not.toHaveProperty('kibbleErrorAdapter');
			expect(kibble).not.toHaveProperty('kibbleZoneTerminals');

			const successfulSearch = await loadLayout({ url: new URL('https://aisles.test/search?q=food'), cookies } as never);
			if (!successfulSearch) throw new Error('Expected the Kibble search layout server load to return data.');
			expect(successfulSearch.kibbleRoutePolicy).toMatchObject({ routePath: '/search', surface: 'search' });
			expect(successfulSearch.kibbleProvenance).not.toHaveProperty('fixturePath');
			expect(successfulSearch.kibbleProvenance).not.toHaveProperty('fixtureSha256');
			expect(successfulSearch).not.toHaveProperty('kibbleErrorPolicy');
			expect(successfulSearch).not.toHaveProperty('kibbleErrorAdapter');
			expect(successfulSearch).not.toHaveProperty('kibbleZoneTerminals');

			const missing = await loadLayout({ url: new URL('https://aisles.test/missing-kibble-route'), cookies } as never);
			if (!missing) throw new Error('Expected the Kibble 404 layout server load to return data.');
			expect(missing.kibbleErrorPolicy).toMatchObject({
				referenceId: 'kibble-shelf-native', referenceVersion: KIBBLE_REFERENCE_CONTRACT.version,
				policies: [{ surface: 'error-404' }],
			});
			expect(missing.kibbleErrorAdapter).toMatchObject({
				instanceId: 'error-404.rescue', sharedContentKind: 'content', adapterId: 'kibble.zone.error-404.rescue',
			});
			expect(missing).not.toHaveProperty('kibbleZoneTerminals');

			process.env.BRAND_ID = 'haven';
			const legacy = await loadLayout({ url: new URL('https://aisles.test/'), cookies } as never);
			if (!legacy) throw new Error('Expected the legacy root layout server load to return data.');
			expect(legacy.renderMode).toBe('legacy-generated');
			expect(legacy.chromeMode).toBe('legacy');
			expect(legacy.kibbleChrome).toBeNull();
			expect(legacy).not.toHaveProperty('kibbleErrorPolicy');

			process.env.BRAND_ID = 'kibble';
			const pdp = await loadLayout({ url: new URL('https://aisles.test/product/example'), cookies } as never);
			if (!pdp) throw new Error('Expected the contracted Kibble PDP layout to return data.');
			expect(pdp.renderMode).toBe('reference-preserve');
			expect(pdp.chromeMode).toBe('reference');

			const account = await loadLayout({ url: new URL('https://aisles.test/account/subscriptions'), cookies } as never);
			if (!account) throw new Error('Expected the Kibble account layout to return data.');
			expect(account.kibbleRoutePolicy).toMatchObject({ routePath: '/account/subscriptions', surface: 'account' });

			for (const path of ['/observe', '/style-guide']) {
				const isolated = await loadLayout({ url: new URL(`https://aisles.test${path}`), cookies } as never);
				if (!isolated) throw new Error(`Expected ${path} layout data.`);
				expect(isolated.chromeMode).toBe('isolated');
				expect(isolated.kibbleChrome).toBeNull();
				expect(isolated.kibbleProvenance).toBeNull();
				expect(isolated.routeAudience).toBe(path === '/observe' ? 'operator' : 'development');
			}
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
						products: [product], productHrefs: { 'actual-product': '/product/actual-product' }, categories: [], serviceProof: [],
						featuredCopy: { title: 'Featured', eyebrow: 'Catalog', browseAllLabel: 'Browse Dog Food' },
						browseHref: '/category/dog-food', categoryTitle: 'Shop by category', categoryEyebrow: 'Browse',
					},
				} as never,
			},
		});
		expect(result.body).toContain('REFERENCE HOME SENTINEL');
		expect(result.body).toContain('href="/product/actual-product"');
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
						emptyMessage: 'No products.', products: [product], productHrefs: { 'actual-product': '/product/actual-product' },
						categoryGuide: KIBBLE_CATEGORY_JOB_PROFILES['dog-food'],
						loadMoreHref: '?sort=FEATURED&after=next-cursor', loadMoreLabel: 'Load more',
					},
				} as never,
			},
		});
		expect(result.body).toContain('Actual Product');
		expect(result.body).toContain('href="/product/actual-product"');
		expect(result.body).toContain('aria-label="Breadcrumb"');
		expect(result.body).toContain('aria-current="page"');
		expect(result.body.match(/<option/g)).toHaveLength(7);
		expect(result.body).toContain('?sort=FEATURED&amp;after=next-cursor');
		expect(result.body).toContain('Load more');
		expect(result.body).toContain('1 product');
		expect(result.body).not.toContain('Personalizing');
	});

	it('SSR renders the live read-only PDP without generic commerce controls', () => {
		const result = render(ProductPage, {
			props: {
				data: {
					renderMode: 'reference-preserve',
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
		expect(result.body).toContain(`data-reference-contract-version="${KIBBLE_REFERENCE_CONTRACT.version}"`);
		expect(result.body).toContain('Purchase unavailable in this preview');
		expect(result.body).not.toMatch(/Add to Cart|Add to Picks|Pairs well with/);
	});

	it('keeps stream calls inside an explicit legacy guard on both routes', () => {
		for (const source of [route('+page.svelte'), route('category/[slug]/+page.svelte')]) {
			expect(source).toContain("if (data.renderMode === 'reference-preserve') return;");
			expect(source).toContain("fetch('/api/layout/stream'");
		}
	});

	it('uses bounded read-only Kibble catalog search with approved PDP links and no unrelated error evidence', async () => {
		const previousBrand = process.env.BRAND_ID;
		try {
			process.env.BRAND_ID = 'kibble';
			searchMocks.searchKibbleCatalog.mockResolvedValueOnce({
				products: [product],
				pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null },
				provenance: {
					referenceId: KIBBLE_REFERENCE_CONTRACT.id,
					referenceVersion: KIBBLE_REFERENCE_CONTRACT.version,
					source: 'live-storefront', query: 'food', cursor: null, pageSize: 24,
					catalogSha256: 'b'.repeat(64), resultSha256: 'c'.repeat(64),
				},
			});
			const parent = async () => ({ devMode: false, chromeMode: 'reference', renderMode: 'reference-preserve' });
			const successfulSearch = await loadSearch({
				url: new URL('https://aisles.test/search?q=food'), parent,
				setHeaders: vi.fn(),
			} as never);
			expect(successfulSearch).toMatchObject({
				renderMode: 'reference-preserve',
				kibbleSearch: {
					query: 'food', products: [{ id: 'actual-product' }], productHrefs: { 'actual-product': '/product/actual-product' }, zoneAdapter: null,
					responseProvenance: {
						source: 'live-storefront', routePath: '/search', policyVersion: expect.any(String),
						catalogSha256: 'b'.repeat(64), resultSha256: 'c'.repeat(64),
					},
				},
			});
			expect(successfulSearch).not.toHaveProperty('kibbleErrorAdapter');
			expect(successfulSearch).not.toHaveProperty('kibbleZoneTerminals');
			expect(searchMocks.searchKibbleCatalog).toHaveBeenCalledWith({ query: 'food', after: null });

			const oversizedQuery = 'x'.repeat(161);
			try {
				await loadSearch({
					url: new URL(`https://aisles.test/search?q=${oversizedQuery}`), parent,
					setHeaders: vi.fn(),
				} as never);
				throw new Error('Expected oversized search input to fail closed.');
			} catch (cause) {
				expect(cause).toMatchObject({
					status: 400,
					body: { message: 'Search query exceeds 160 characters.' },
				});
				expect((cause as { body?: Record<string, unknown> }).body).not.toHaveProperty('kibbleErrorAdapter');
			}

			searchMocks.searchKibbleCatalog.mockRejectedValueOnce(new Error('fixture catalog offline'));
			try {
				await loadSearch({
					url: new URL('https://aisles.test/search?q=food'), parent,
					setHeaders: vi.fn(),
				} as never);
				throw new Error('Expected the unavailable catalog to reach the 503 boundary.');
			} catch (cause) {
				expect(cause).toMatchObject({
					status: 503,
					body: {
						kibbleErrorAdapter: {
							instanceId: 'error-empty.rescue',
							sharedContentKind: 'content',
							adapterId: 'kibble.zone.error-empty.rescue',
						},
						kibbleErrorPolicy: { policies: [{ surface: 'error-empty' }] },
					},
				});
			}
		} finally {
			if (previousBrand === undefined) delete process.env.BRAND_ID;
			else process.env.BRAND_ID = previousBrand;
		}
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
