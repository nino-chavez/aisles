import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from 'svelte/server';
import { KIBBLE_PRESERVE_MANIFEST } from '$lib/brand/reference/kibble-manifest';
import KibbleProductDetailReference from './KibbleProductDetailReference.svelte';

const component = (name: string) => readFileSync(resolve(import.meta.dirname, name), 'utf8');

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
	});

	it('keeps the PDP catalog-only and routes every visible label through its adapter copy', () => {
		const pdp = component('KibbleProductDetailReference.svelte');
		expect(pdp).toContain('data-kibble-pdp-recipe="fixed-catalog-display-only"');
		for (const forbidden of ['/api/cart', '/api/suggest', 'addToCart', 'Auto-Refill', 'subscription']) expect(pdp).not.toContain(forbidden);
		for (const field of ['purchaseUnavailableLabel', 'purchaseUnavailableBody', 'breadcrumbLabel', 'galleryLabel', 'skuLabel', 'bundleEyebrow', 'bundleContentsHeading', 'detailsHeading']) expect(pdp).toContain(field);
		expect(pdp).toContain('aria-pressed={activeImage === index}');
		expect(pdp).toContain("aria-current={activeImage === index ? 'true' : undefined}");
		expect(pdp).toContain('{@html product.description}');
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
});
