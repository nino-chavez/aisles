import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from 'svelte/server';
import { chromium } from 'playwright';
import { KIBBLE_PRESERVE_MANIFEST } from '$lib/brand/reference/kibble-manifest';
import KibbleProductDetailReference from './KibbleProductDetailReference.svelte';
import KibbleCategoryReference from './KibbleCategoryReference.svelte';
import KibbleProductCard from './KibbleProductCard.svelte';
import { KIBBLE_CATEGORY_JOB_PROFILES } from '$lib/brand/reference/kibble-catalog-enrichment';

const component = (name: string) => readFileSync(resolve(import.meta.dirname, name), 'utf8');

const pdpProps = (images: Array<{ url: string; alt: string }>) => ({
	product: {
		id: 'fixture-product', entityId: 42, name: 'Fixture Product', sku: 'FIXTURE-42', price: 24,
		image: images[0]?.url ?? '', imageAlt: 'Fixture Product', description: '<p>Fixture details.</p>',
		descriptionPlain: 'Fixture details.', specs: {}, tags: [], category: 'Dog Food', categoryPath: '/dog-food/',
		currencyCode: 'USD', isInStock: true, images,
	},
	bundle: null,
	breadcrumbs: [{ label: 'Home', href: '/' }, { label: 'Fixture Product' }],
	options: [], relatedProducts: [], relatedProductHrefs: {},
	purchaseUnavailableLabel: KIBBLE_PRESERVE_MANIFEST.display.pdp.purchaseUnavailableLabel,
	purchaseUnavailableBody: KIBBLE_PRESERVE_MANIFEST.display.pdp.purchaseUnavailableBody,
	relatedHeading: KIBBLE_PRESERVE_MANIFEST.display.pdp.relatedHeading,
	copy: { ...KIBBLE_PRESERVE_MANIFEST.display.pdp.copy },
});

describe('Kibble reference components fail closed', () => {
	it('does not carry unsupported account, cart, search, or product route defaults', () => {
		for (const file of ['KibbleHeader.svelte', 'KibbleMobileNavigation.svelte', 'KibbleFeaturedGrid.svelte', 'KibbleProductCard.svelte']) {
			const source = component(file);
			expect(source).not.toMatch(/=['"]\/(account|cart|search|product)/);
		}
	});

	it('requires header facts and hero claims from the trusted route adapter', () => {
		const header = component('KibbleHeader.svelte');
		expect(header).toMatch(/brandName: string/);
		expect(header).toMatch(/statusItems: KibbleStatusItem\[\]/);
		expect(header).not.toContain('26 subscription SKUs');
		expect(header).not.toContain('5 vetted brands');
		expect(header).not.toContain('Free US shipping');

		const hero = component('KibbleHero.svelte');
		expect(hero).toMatch(/headline: string/);
		expect(hero).toMatch(/body: string/);
		expect(hero).toMatch(/proofItems: KibbleProofItem\[\]/);
		expect(hero).not.toContain('Subscription GMV');
		expect(hero).not.toContain('brands worth trusting');
	});

	it('hides optional account and disables an unavailable cart in both chrome variants', () => {
		const desktop = component('KibbleHeader.svelte');
		expect(desktop).toContain('{#if accountHref}');
		expect(desktop).toContain('aria-label={copy.cartUnavailableLabel}');
		expect(desktop).toContain('<span class="kc-reference-header__cart-unavailable">{copy.cartUnavailableLabel}</span>');
		expect(desktop).toContain('>{copy.searchUnavailableLabel}</span>');
		expect(desktop).toContain('bind:this={searchTrigger}');
		expect(desktop).toContain('bind:this={searchInput}');
		expect(desktop).toContain('searchInput?.focus()');
		expect(desktop).toContain('searchTrigger?.focus()');
		expect(desktop).toContain("event.key !== 'Escape'");
		const mobile = component('KibbleMobileNavigation.svelte');
		expect(mobile).toContain('{#if accountHref || onPicksClick || picksHref}');
		expect(mobile).toContain('aria-label={copy.cartUnavailableLabel}');
	});

	it('requires visible section copy and fails closed without a product href', () => {
		const featured = component('KibbleFeaturedGrid.svelte');
		expect(featured).toContain('id="kibble-featured-shelf"');
		expect(featured).toContain('tabindex="-1"');
		expect(featured).toMatch(/copy: KibbleFeaturedCopy/);
		expect(featured).not.toContain("'New arrivals'");
		expect(featured).not.toContain("'Catalog'");
		const home = component('KibbleHomeReference.svelte');
		expect(home).not.toContain("'Shop by category'");
		expect(home).not.toContain("'Browse'");
		const card = component('KibbleProductCard.svelte');
		expect(card).toContain('{#if productHref}');
		expect(card).toContain('<article');
		expect(card).toContain('kc-reference-product-card--disabled');
	});

	it('renders catalog capability labels from the server-owned offer projection', () => {
		const body = render(KibbleProductCard, {
			props: {
				product: {
					id: 'goodgut', entityId: 3023, name: 'GoodGut', price: 34.99,
					image: '', imageAlt: 'GoodGut', description: '', specs: {}, tags: [], category: 'Dog Food',
				},
				productHref: '/product/goodgut',
				autoRefill: {
					price: 29.74, savingsPercent: 15, label: 'Auto-Refill', savingsLabel: 'Save',
					cadenceLabel: 'every 1, 2, or 3 months', capabilityLabels: ['Intro offer'],
				},
			},
		}).body;
		expect(body).toContain('Auto-Refill · Save 15%');
		expect(body).toContain('Intro offer');
	});

	it('renders hash-pinned capability evidence on the PDP without a commerce affordance', () => {
		const body = render(KibbleProductDetailReference, {
			props: {
				...pdpProps([]),
					autoRefill: {
						price: 20.4, savingsPercent: 15, label: 'Auto-Refill', savingsLabel: 'Save', cadenceLabel: 'every 1, 2, or 3 months',
						capabilityEvidence: [{ label: 'Free trial', detail: 'The canonical storefront registry records a 14-day trial for this product.' }],
					},
			},
		}).body;
		expect(body).toContain('Free trial');
		expect(body).toContain('14-day trial');
		expect(body).toContain('hash-pinned, display-only source projection');
		expect(body).not.toContain('Subscribe now');
	});

	it('keeps the featured bundle below the page heading in the heading outline', () => {
		const hero = component('KibbleHero.svelte');
		expect(hero).toContain('<h3>{featured.name}</h3>');
		expect(hero).not.toContain('<h2>{featured.name}</h2>');
	});

	it('renders the contracted PLP anatomy without enabling PDP cards', () => {
		const category = component('KibbleCategoryReference.svelte');
		expect(category).toContain('aria-label="Breadcrumb"');
		expect(category).toContain('aria-current="page"');
		expect(category).toContain('name="sort"');
		expect(category).toContain('{#if loadMoreHref}');
		expect(category).toContain('productHref={productHrefs[product.id]}');
		expect(category).not.toContain('kc-reference-category__sort-submit');
	});

	it('keeps the PLP sort control visible, semantic, and at least 44 pixels tall', async () => {
		const body = render(KibbleCategoryReference, {
			props: {
				eyebrow: 'Catalog', title: 'Dog Food', breadcrumbs: [{ label: 'Home', href: '/' }, { label: 'Dog Food' }],
				sortLabel: 'Sort by', sortOptions: [{ value: 'FEATURED', label: 'Featured' }], selectedSort: 'FEATURED',
				productCount: 0, productSingular: 'product', productPlural: 'products', emptyMessage: 'No products.',
				products: [], productHrefs: {}, loadMoreHref: null, loadMoreLabel: 'Load more', categoryGuide: KIBBLE_CATEGORY_JOB_PROFILES['dog-food'],
			},
		}).body;
		const browser = await chromium.launch({ headless: true });
		try {
			const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
			await page.setContent(`<style>${component('kibble-reference.css')}</style>${body}`);
			const select = page.locator('#kibble-category-sort');
			await select.focus();
			expect(await select.evaluate((element) => document.activeElement === element)).toBe(true);
			expect((await select.boundingBox())?.height).toBeGreaterThanOrEqual(44);
			expect(await page.locator('button[type="submit"]').count()).toBe(0);
		} finally {
			await browser.close();
		}
	});

	it('keeps the PDP presentation fixed while exposing only the server-owned cart callback', () => {
		const pdp = component('KibbleProductDetailReference.svelte');
		expect(pdp).toContain('data-kibble-pdp-recipe="fixed-catalog-display-only"');
		expect(pdp).toContain("data-kibble-commerce-mode={commerceEnabled ? 'sandbox-cart' : 'off'}");
		expect(pdp).toContain('onclick={onAddToCart}');
		for (const forbidden of ['/api/cart', '/api/suggest', 'method="post"', 'use:enhance', 'Subscribe now', 'Manage plan']) expect(pdp).not.toContain(forbidden);
		expect(pdp).toContain('Pinned subscription evidence');
		expect(pdp).toContain('The subscription service owns plan eligibility');
		const offerStart = pdp.indexOf('data-aisles-zone-instance="pdp.subscription-offer"');
		const offerEnd = pdp.indexOf('{#if bundle}', offerStart);
		expect(offerStart).toBeGreaterThan(-1);
		expect(offerEnd).toBeGreaterThan(offerStart);
		const offerBlock = pdp.slice(offerStart, offerEnd);
		for (const forbidden of [/<form\b/i, /<button\b/i, /\bmethod\s*=/i, /use:enhance/i, /href\s*=\s*["'{][^\n]*(cart|checkout)/i]) {
			expect(offerBlock).not.toMatch(forbidden);
		}
		for (const field of ['purchaseUnavailableLabel', 'purchaseUnavailableBody', 'breadcrumbLabel', 'galleryLabel', 'skuLabel', 'bundleEyebrow', 'bundleContentsHeading', 'detailsHeading']) expect(pdp).toContain(field);
		expect(pdp).toContain('aria-pressed={activeImage === index}');
		expect(pdp).toContain("aria-current={activeImage === index ? 'true' : undefined}");
		expect(pdp).toContain('{@html product.description}');
	});

	it.each([768, 1280])('does not reserve the thumbnail column for a one-image PDP at %ipx', async (width) => {
		const image = { url: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>', alt: 'Fixture Product' };
		const oneImage = render(KibbleProductDetailReference, { props: pdpProps([image]) }).body;
		const multiImage = render(KibbleProductDetailReference, { props: pdpProps([image, { ...image, url: `${image.url}%20` }]) }).body;
		const browser = await chromium.launch({ headless: true });
		try {
			const page = await browser.newPage({ viewport: { width, height: 900 } });
			await page.setContent(`<style>${component('kibble-reference.css')}</style><div id="one">${oneImage}</div><div id="multi">${multiImage}</div>`);
			const one = page.locator('#one .kc-reference-pdp__gallery');
			const multi = page.locator('#multi .kc-reference-pdp__gallery');
			expect(await one.getAttribute('data-gallery-count')).toBe('1');
			expect(await one.getAttribute('class')).not.toContain('kc-reference-pdp__gallery--with-thumbnails');
			expect((await one.evaluate((element) => getComputedStyle(element).gridTemplateColumns)).split(' ')).toHaveLength(1);
			expect(await multi.getAttribute('data-gallery-count')).toBe('2');
			expect(await multi.getAttribute('class')).toContain('kc-reference-pdp__gallery--with-thumbnails');
			expect((await multi.evaluate((element) => getComputedStyle(element).gridTemplateColumns)).split(' ')).toHaveLength(2);
		} finally {
			await browser.close();
		}
	});

	it('SSR preserves conditional bundle contents and the non-commerce state', () => {
		const sourceBundle = KIBBLE_PRESERVE_MANIFEST.display.pdp.bundles['essential-bundle-kns4'];
		const result = render(KibbleProductDetailReference, {
			props: {
				product: {
					id: 'essential-bundle-kns4', entityId: 3065, name: 'Essential Bundle', sku: 'BUNDLE-ESSENTIAL',
					price: 109, image: '', imageAlt: 'Essential Bundle', description: '<p>Bundle <strong>details</strong>.</p>',
					descriptionPlain: 'Bundle details.', specs: {}, tags: [], category: 'Bundles', categoryPath: '/bundles/',
					currencyCode: 'USD', isInStock: true, images: [],
				},
				bundle: { name: sourceBundle.name, contents: sourceBundle.contents.map((item) => ({ ...item })) },
				breadcrumbs: [{ label: 'Home', href: '/' }, { label: 'Essential Bundle' }],
				options: [], relatedProducts: [], relatedProductHrefs: {},
				purchaseUnavailableLabel: KIBBLE_PRESERVE_MANIFEST.display.pdp.purchaseUnavailableLabel,
				purchaseUnavailableBody: KIBBLE_PRESERVE_MANIFEST.display.pdp.purchaseUnavailableBody,
				relatedHeading: KIBBLE_PRESERVE_MANIFEST.display.pdp.relatedHeading,
				copy: { ...KIBBLE_PRESERVE_MANIFEST.display.pdp.copy },
			},
		});
		expect(result.body).toContain('Curated kit · 3 products');
		expect(result.body).toContain("What's in this kit");
		expect(result.body).toContain('<strong>details</strong>');
		expect(result.body).toContain('aria-pressed="true"');
		expect(result.body).toContain('aria-current="true"');
		expect(result.body).toContain('Purchase unavailable in this preview');
		expect(result.body).not.toContain('data-aisles-zone-instance="pdp.related"');
		expect(result.body).not.toMatch(/Add to Cart|Auto-Refill|Subscribe/);
	});

	it('reserves mint and coral for their contracted meanings on the PDP', () => {
		const css = component('kibble-reference.css');
		const pdpCss = css.slice(css.indexOf('.kc-reference-pdp {'), css.indexOf('.kc-reference-visual-grid--2'));
		expect(pdpCss).toContain('.kc-reference-pdp__stock--in { color: var(--kc-identity); }');
		expect(pdpCss).toContain('border-left: 4px solid var(--kc-action)');
		expect(pdpCss).not.toContain('var(--kc-autorefill');
		expect(pdpCss).not.toContain('var(--kc-savings)');
	});

	it('exposes the full fixed-data parity marker set at the PDP route root', () => {
		const page = readFileSync(resolve(import.meta.dirname, '../../../routes/product/[slug]/+page.svelte'), 'utf8');
		for (const marker of ['data-reference-id', 'data-reference-contract-version', 'data-reference-fixture', 'data-reference-fixture-sha256']) expect(page).toContain(marker);
	});

	it('never renders KibbleProductCard without a productHref — a missing wire is a silent dead card, not a render error', () => {
		const srcRoot = resolve(import.meta.dirname, '../../..');
		const offenders: string[] = [];
		const walk = (dir: string) => {
			for (const entry of readdirSync(dir, { withFileTypes: true })) {
				const full = resolve(dir, entry.name);
				if (entry.isDirectory()) { if (entry.name !== 'node_modules' && entry.name !== '.svelte-kit') walk(full); continue; }
				if (!entry.name.endsWith('.svelte')) continue;
				const source = readFileSync(full, 'utf8');
				for (const line of source.split('\n')) {
					if (line.includes('<KibbleProductCard') && !line.includes('productHref')) offenders.push(`${full}: ${line.trim()}`);
				}
			}
		};
		walk(srcRoot);
		expect(offenders).toEqual([]);
	});
});
