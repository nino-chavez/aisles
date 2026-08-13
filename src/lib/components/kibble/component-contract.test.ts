import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

	it('renders the contracted PLP anatomy without enabling PDP cards', () => {
		const category = component('KibbleCategoryReference.svelte');
		expect(category).toContain('aria-label="Breadcrumb"');
		expect(category).toContain('aria-current="page"');
		expect(category).toContain('name="sort"');
		expect(category).toContain('{#if loadMoreHref}');
		expect(category).toContain('productHref={productHrefs[product.id]}');
	});
});
