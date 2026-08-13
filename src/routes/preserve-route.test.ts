import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import HomePage from './+page.svelte';
import { load as loadLayout } from './+layout.server';
import { load as loadProduct } from './product/[slug]/+page.server';
import { load as loadSearch } from './search/+page.server';
import { GET as getCart, POST as postCart } from './api/cart/+server';
import type { Product } from '$lib/types';

const route = (path: string) => readFileSync(resolve(import.meta.dirname, path), 'utf8');
const product: Product = {
	id: 'actual-product', entityId: 10, name: 'Actual Product', price: 20,
	image: 'https://example.com/product.png', imageAlt: 'Actual Product', description: '', specs: {}, tags: [], category: 'Dog Food',
};

describe('Preserve route boundaries', () => {
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
				referenceId: 'kibble-shelf-native', referenceVersion: '1.4.0',
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
			const unsupported = await loadLayout({ url: new URL('https://aisles.test/product/example'), cookies } as never);
			if (!unsupported) throw new Error('Expected the unsupported Kibble surface load to return data.');
			expect(unsupported.renderMode).toBe('legacy-generated');
			expect(unsupported.chromeMode).toBe('reference');
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

	it('keeps the home stream call inside an explicit Preserve guard', () => {
		const source = route('+page.svelte');
		expect(source).toContain("if (data.renderMode === 'reference-preserve') return;");
		expect(source).toContain("fetch('/api/layout/stream'");
	});

	it('fails closed before unsupported Kibble product and search adapters run', async () => {
		const parent = async () => ({ devMode: false, chromeMode: 'reference' });
		await expect(loadProduct({ params: { slug: 'anything' }, url: new URL('https://aisles.test/product/anything'), parent } as never))
			.rejects.toMatchObject({ status: 503 });
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
