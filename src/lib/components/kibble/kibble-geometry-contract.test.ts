import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import KibbleCheckoutReference from './KibbleCheckoutReference.svelte';
import KibbleErrorReference from './KibbleErrorReference.svelte';
import KibbleProductDetailReference from './KibbleProductDetailReference.svelte';
import KibbleSubscriptionsReference from './KibbleSubscriptionsReference.svelte';

const css = readFileSync(resolve(import.meta.dirname, 'kibble-reference.css'), 'utf8');

describe('Kibble source-backed geometry contracts', () => {
	it('pins PLP, PDP, and 404 heading steps to the captured canonical measurements', () => {
		expect(css).toContain('.kc-reference-category__header h1 {\n\tmargin: 0.45rem 0 0;\n\tfont-family: var(--kc-font-display);\n\tfont-size: 2.25rem;');
		expect(css).toContain('.kc-reference-pdp__details h1 { margin: .35rem 0 1rem; font-size: 1.875rem; line-height: 2.25rem; letter-spacing: -.04em; }');
		expect(css).toContain('.kc-reference-error__inner {\n\tmax-width: 42rem;');
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

	it('uses div anatomy for catalog-display-only PDP groups without restoring purchase controls', () => {
		const body = render(KibbleProductDetailReference, { props: {
			product: { id: 'goodgut', entityId: 3023, name: 'GoodGut', price: 34.99, currencyCode: 'USD', image: '', imageAlt: '', images: [], description: '<p>Details</p>', descriptionPlain: 'Details', specs: {}, tags: [], category: 'Dog food', categoryPath: 'dog-food', sku: 'GOODGUT', isInStock: true },
			bundle: null, breadcrumbs: [], options: [], relatedProducts: [], relatedProductHrefs: {},
			purchaseUnavailableLabel: 'Unavailable', purchaseUnavailableBody: 'No purchase action is available.', relatedHeading: 'Related',
			copy: { breadcrumbLabel: 'Breadcrumb', galleryLabel: 'images', galleryImagesLabel: 'Images', viewImageLabel: 'View image', imageUnavailableLabel: 'Image unavailable', bundleEyebrow: 'Kit', bundleProductSingular: 'product', bundleProductPlural: 'products', priceLabel: 'Price', skuLabel: 'SKU', inStockLabel: 'In stock', outOfStockLabel: 'Out of stock', availabilityUnavailableLabel: 'Availability unavailable', bundleContentsHeading: 'Contents', optionsLegend: 'Options', requiredSuffix: 'required', detailsHeading: 'Details' },
		} }).body;
		expect(body).not.toContain('<section class="kc-reference-pdp__gallery"');
		expect(body).not.toContain('Add to cart');
		expect(body).toContain('purchase-unavailable');
	});
});
