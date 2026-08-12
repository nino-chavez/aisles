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
		expect(desktop).toContain('aria-label="Cart unavailable"');
		const mobile = component('KibbleMobileNavigation.svelte');
		expect(mobile).toContain('{#if accountHref || onPicksClick || picksHref}');
		expect(mobile).toContain('aria-label="Cart unavailable"');
	});
});
