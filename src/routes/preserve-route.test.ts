import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import HomePage from './+page.svelte';
import CategoryPage from './category/[slug]/+page.svelte';
import { load as loadLayout } from './+layout.server';
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

			process.env.BRAND_ID = 'haven';
			const legacy = await loadLayout({ url: new URL('https://aisles.test/'), cookies } as never);
			if (!legacy) throw new Error('Expected the legacy root layout server load to return data.');
			expect(legacy.renderMode).toBe('legacy-generated');
			expect(legacy.chromeMode).toBe('legacy');
			expect(legacy.kibbleChrome).toBeNull();

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
								subscribePrice: 97, oneTimePrice: 109, savingsPercent: 11, contents: [],
								eyebrow: 'Featured bundle', autoRefillLabel: 'Auto-Refill', savingsLabel: 'Save', ctaLabel: 'Shop the bundle',
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
					kibbleCategory: { eyebrow: 'Catalog', title: 'Dog Food', productCount: 1, productSingular: 'product', productPlural: 'products', emptyMessage: 'No products.', products: [product], productHrefs: {} },
				} as never,
			},
		});
		expect(result.body).toContain('Actual Product');
		expect(result.body).not.toContain('/product/actual-product');
		expect(result.body).toContain('1 product');
		expect(result.body).not.toContain('Personalizing');
	});

	it('keeps stream calls inside an explicit legacy guard on both routes', () => {
		for (const source of [route('+page.svelte'), route('category/[slug]/+page.svelte')]) {
			expect(source).toContain("if (data.renderMode === 'reference-preserve') return;");
			expect(source).toContain("fetch('/api/layout/stream'");
		}
	});
});
