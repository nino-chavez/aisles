import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import KibbleUnavailableReference from '$lib/components/kibble/KibbleUnavailableReference.svelte';
import {
	KIBBLE_ACCOUNT_ADAPTED_SOURCE_FILES,
	KIBBLE_CART_ADAPTED_SOURCE_FILES,
	KIBBLE_CHECKOUT_ADAPTED_SOURCE_FILES,
	KIBBLE_REFERENCE_CONTRACT,
	KIBBLE_SEARCH_ADAPTED_SOURCE_FILES,
} from '$lib/brand/reference/kibble';

const route = (path: string) => readFileSync(resolve(import.meta.dirname, path), 'utf8');

describe('Kibble unavailable shopper surfaces', () => {
	it.each(['search', 'cart', 'checkout', 'account'] as const)('uses the native reference shell for %s', (surface) => {
		const result = render(KibbleUnavailableReference, {
			props: { surface, heading: surface === 'cart' ? 'Your cart' : surface[0].toUpperCase() + surface.slice(1), message: 'Service is unavailable in this preview.', returnLabel: 'Return to Kibble & Co.' },
		});
		expect(result.body).toContain('kibble-reference');
		expect(result.body).toContain(`data-kibble-unavailable-surface="${surface}"`);
		expect(result.body).toContain('Return to Kibble &amp; Co.');
	});

	it('keeps source ownership, responsive recipe, and fail-closed backend boundary explicit', () => {
		const recipes = KIBBLE_REFERENCE_CONTRACT.recipes;
		for (const recipe of [recipes.search, recipes.cart, recipes.checkout, recipes.account]) {
			expect(recipe.implementation).toBe('KibbleUnavailableReference.svelte');
			expect(recipe.source.owner).toBe('reference-shell-adaptation');
			expect(recipe.source.commit).toBe(KIBBLE_REFERENCE_CONTRACT.source.commit);
			expect(recipe.source.files.length).toBeGreaterThan(0);
			expect(recipe.responsive.mobile).toBe('single-column');
			expect(recipe.fallback).toBe('fixed-kibble-unavailable-shell');
		}
		expect(KIBBLE_SEARCH_ADAPTED_SOURCE_FILES).toHaveLength(5);
		expect(KIBBLE_CART_ADAPTED_SOURCE_FILES).toHaveLength(5);
		expect(KIBBLE_ACCOUNT_ADAPTED_SOURCE_FILES).toHaveLength(4);
		expect(KIBBLE_CHECKOUT_ADAPTED_SOURCE_FILES).toHaveLength(2);
	});

	it('classifies every union zone and calls the absent canonical routes out', () => {
		const coverage = KIBBLE_REFERENCE_CONTRACT.unionZoneCoverage;
		expect(coverage).toHaveLength(28);
		expect(new Set(coverage.map(({ id }) => id)).size).toBe(28);
		expect(coverage.find(({ id }) => id === 'locator.editorial-intro')).toMatchObject({ classification: 'not-applicable' });
		expect(coverage.find(({ id }) => id === 'account.welcome')).toMatchObject({ classification: 'fixed' });
	});

	it('keeps operator and development routes outside Kibble shopper parity', () => {
		const inventory = KIBBLE_REFERENCE_CONTRACT.routeInventory;
		expect(inventory.find(({ path }) => path === '/compare')).toMatchObject({ audience: 'operator', classification: 'operator-only' });
		expect(inventory.find(({ path }) => path === '/observe')).toMatchObject({ audience: 'operator', classification: 'operator-only' });
		expect(inventory.find(({ path }) => path === '/style-guide')).toMatchObject({ audience: 'development', classification: 'development-only' });
		expect(inventory.find(({ path }) => path === '/store-locator')).toMatchObject({ classification: 'not-applicable' });
	});

	it('does not let a Kibble route fall back to a generic shopper component', () => {
		for (const path of ['search/+page.svelte', 'cart/+page.svelte', 'checkout/+page.svelte', 'account/+page.svelte']) {
			const source = route(path);
			expect(source).toContain('KibbleUnavailableReference');
		}
		expect(route('checkout/+page.svelte')).toContain("if (data.renderMode === 'reference-preserve') return;");
		expect(route('cart/+page.server.ts')).toContain('No cart was read, created, or changed.');
	});
});
