import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { chromium } from 'playwright';
import KibbleCheckoutReference from './KibbleCheckoutReference.svelte';
import KibbleErrorReference from './KibbleErrorReference.svelte';
import KibbleProductDetailReference from './KibbleProductDetailReference.svelte';
import KibbleSubscriptionsReference from './KibbleSubscriptionsReference.svelte';
import { KIBBLE_PRESERVE_MANIFEST } from '$lib/brand/reference/kibble-manifest';

const css = readFileSync(resolve(import.meta.dirname, 'kibble-reference.css'), 'utf8');

describe('Kibble source-backed geometry contracts', () => {
	it('pins PLP, PDP, and 404 heading steps to the captured canonical measurements', () => {
		expect(css).toContain('.kc-reference-category__header h1 {\n\tmargin: 0.45rem 0 0;\n\tfont-family: var(--kc-font-display);\n\tfont-size: 2.25rem;');
		expect(css).toContain('.kc-reference-pdp__details h1 { margin: .35rem 0 1rem; font-size: 1.875rem; line-height: 2.25rem; letter-spacing: -.04em; }');
		expect(css).toContain('.kc-reference-error__inner {\n\tmax-width: 43rem;');
		expect(css).toContain('@media (min-width: 640px) {\n\t.kc-reference-category__header h1 {\n\t\tfont-size: 3rem;');
		expect(css).toContain('@media (min-width: 1280px) {\n\t.kc-reference-search-page__results { grid-template-columns: repeat(4, minmax(0, 1fr)); }');
	});

	it('keeps route-specific containers at the source-backed bounds', () => {
		expect(render(KibbleCheckoutReference, { props: { subtype: 'confirmation', availabilityMessage: 'Unavailable.' } }).body)
		.toContain('kc-reference-container kc-reference-checkout-page__confirmation');
		expect(render(KibbleErrorReference, { props: { status: 404, message: 'Unavailable.', eyebrow: 'Error', headline: 'Page not found', returnLabel: 'Home' } }).body)
		.toContain('kc-reference-container kc-reference-error__inner');
		expect(render(KibbleSubscriptionsReference, { props: { subtype: 'detail', brandName: 'Kibble & Co.', availabilityMessage: 'Unavailable.' } }).body)
		.toContain('kc-reference-subscriptions-page__content--detail');
	});

	it('uses truthful copy for an actual 404 without changing the temporary failure headline', () => {
		expect(KIBBLE_PRESERVE_MANIFEST.display.error.notFoundHeadline).toBe('Page not found.');
		expect(KIBBLE_PRESERVE_MANIFEST.display.error.headline).toBe('This shelf needs a moment.');
	});

	it('uses div anatomy and keeps the purchase control off without the server gate', () => {
		const body = render(KibbleProductDetailReference, { props: {
			product: { id: 'goodgut', entityId: 3023, name: 'GoodGut', price: 34.99, currencyCode: 'USD', image: '', imageAlt: '', images: [], description: '<p>Details</p>', descriptionPlain: 'Details', specs: {}, tags: [], category: 'Dog food', categoryPath: 'dog-food', sku: 'GOODGUT', isInStock: true },
			bundle: null, breadcrumbs: [], options: [], relatedProducts: [], relatedProductHrefs: {},
			purchaseUnavailableLabel: 'Unavailable', purchaseUnavailableBody: 'No purchase action is available.', relatedHeading: 'Related',
			copy: { breadcrumbLabel: 'Breadcrumb', galleryLabel: 'images', galleryImagesLabel: 'Images', viewImageLabel: 'View image', imageUnavailableLabel: 'Image unavailable', bundleEyebrow: 'Kit', bundleProductSingular: 'product', bundleProductPlural: 'products', priceLabel: 'Price', skuLabel: 'SKU', inStockLabel: 'In stock', outOfStockLabel: 'Out of stock', availabilityUnavailableLabel: 'Availability unavailable', bundleContentsHeading: 'Contents', optionsLegend: 'Options', requiredSuffix: 'required', detailsHeading: 'Details' },
		} }).body;
		expect(body).not.toContain('<section class="kc-reference-pdp__gallery"');
		expect(body).toContain('role="group"');
		expect(body).toContain('aria-label="GoodGut images"');
		expect(body).not.toContain('Add to cart');
		expect(body).toContain('purchase-unavailable');
	});

	it('wraps bounded catalog identifiers at the 320px reflow floor', async () => {
		const body = render(KibbleProductDetailReference, { props: {
			product: { id: 'goodgut', entityId: 3023, name: 'GoodGut', price: 34.99, currencyCode: 'USD', image: '', imageAlt: '', images: [], description: '', descriptionPlain: '', specs: {}, tags: [], category: 'Dog food', categoryPath: 'dog-food', sku: 'UNBROKEN-SKU-IDENTIFIER-THAT-MUST-WRAP-AT-THE-REFLOW-FLOOR', isInStock: true },
			bundle: null, breadcrumbs: [], options: [], relatedProducts: [], relatedProductHrefs: {},
			purchaseUnavailableLabel: 'Unavailable', purchaseUnavailableBody: 'No purchase action is available.', relatedHeading: 'Related',
			copy: { breadcrumbLabel: 'Breadcrumb', galleryLabel: 'images', galleryImagesLabel: 'Images', viewImageLabel: 'View image', imageUnavailableLabel: 'Image unavailable', bundleEyebrow: 'Kit', bundleProductSingular: 'product', bundleProductPlural: 'products', priceLabel: 'Price', skuLabel: 'SKU', inStockLabel: 'In stock', outOfStockLabel: 'Out of stock', availabilityUnavailableLabel: 'Availability unavailable', bundleContentsHeading: 'Contents', optionsLegend: 'Options', requiredSuffix: 'required', detailsHeading: 'Details' },
		} }).body;
		const browser = await chromium.launch({ headless: true });
		try {
			const page = await browser.newPage({ viewport: { width: 320, height: 800 } });
			await page.setContent(`<style>html,body{margin:0}${css}</style>${body}`);
			expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
		} finally {
			await browser.close();
		}
	});
});
