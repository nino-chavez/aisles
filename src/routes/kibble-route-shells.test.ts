import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import KibbleSearchReference from '$lib/components/kibble/KibbleSearchReference.svelte';
import KibbleCartReference from '$lib/components/kibble/KibbleCartReference.svelte';
import KibbleAccountReference from '$lib/components/kibble/KibbleAccountReference.svelte';
import KibbleCheckoutReference from '$lib/components/kibble/KibbleCheckoutReference.svelte';
import KibbleSubscriptionsReference from '$lib/components/kibble/KibbleSubscriptionsReference.svelte';
import { KIBBLE_REFERENCE_CONTRACT } from '$lib/brand/reference/kibble';

const route = (path: string) => readFileSync(resolve(import.meta.dirname, path), 'utf8');

describe('Kibble route-specific unavailable shells', () => {
	it('keeps search navigation supported without claiming or loading results', () => {
		const body = render(KibbleSearchReference, { props: { query: 'goodgut', availabilityMessage: 'Search unavailable.' } }).body;
		expect(body).toContain('data-kibble-route-shell="search"');
		expect(body).toContain('Results for "goodgut"');
		expect(body).toContain('method="get"');
		expect(body).toContain('action="/search"');
		expect(body).toContain('Results unavailable');
		expect(body).not.toContain('0 products');
		expect(body).not.toContain('KibbleUnavailableReference');
	});

	it('renders canonical cart anatomy without a cart or commerce claim', () => {
		const body = render(KibbleCartReference, { props: { availabilityMessage: 'Cart unavailable.' } }).body;
		expect(body).toContain('data-kibble-route-shell="cart"');
		expect(body).toContain('Your cart');
		expect(body).toContain('No cart was read, created, priced, or changed.');
		expect(body).not.toMatch(/subtotal|discount|checkout now/i);
	});

	it.each(['login', 'register', 'orders', 'addresses', 'payment-methods', 'subscriptions', 'logout', 'unknown'] as const)('renders the %s account subtype with unavailable controls', (subtype) => {
		const body = render(KibbleAccountReference, { props: { subtype, brandName: 'Kibble & Co.', availabilityMessage: 'Account unavailable.' } }).body;
		expect(body).toContain(`data-kibble-account-subtype="${subtype}"`);
		expect(body).toContain('My account');
		expect(body).toContain('Kibble &amp; Co.');
		if (['login', 'register', 'subscriptions', 'logout', 'unknown'].includes(subtype)) expect(body).toContain('disabled');
		expect(body).not.toContain('method="POST"');
	});

	it.each(['checkout', 'gift', 'prepaid', 'confirmation'] as const)('renders the %s checkout subtype without a money-path claim', (subtype) => {
		const body = render(KibbleCheckoutReference, { props: { subtype, availabilityMessage: 'Checkout unavailable.' } }).body;
		expect(body).toContain(`data-kibble-checkout-subtype="${subtype}"`);
		if (subtype !== 'confirmation') expect(body).toContain('disabled');
		expect(body).not.toMatch(/\$\d|save \d|order number|guaranteed/i);
		expect(body).not.toContain('method="POST"');
	});

	it.each(['portal', 'account', 'detail'] as const)('renders the %s subscription subtype without subscriber data', (subtype) => {
		const body = render(KibbleSubscriptionsReference, { props: { subtype, availabilityMessage: 'Subscriptions unavailable.' } }).body;
		expect(body).toContain(`data-kibble-subscriptions-subtype="${subtype}"`);
		expect(body).toContain('disabled');
		expect(body).not.toMatch(/active subscription|next charge|renewal date|payment ending/i);
	});

	it('registers pending-parity route-native recipes and no generic unavailable renderer', () => {
		for (const recipe of [KIBBLE_REFERENCE_CONTRACT.recipes.search, KIBBLE_REFERENCE_CONTRACT.recipes.cart, KIBBLE_REFERENCE_CONTRACT.recipes.checkout, KIBBLE_REFERENCE_CONTRACT.recipes.account, KIBBLE_REFERENCE_CONTRACT.recipes.subscriptions]) {
			expect(recipe.acceptance).toBe('pending-parity');
			expect(recipe.implementation).toMatch(/^Kibble(?:Search|Cart|Checkout|Account|Subscriptions)Reference\.svelte$/);
			expect(recipe.source.owner).toBe('canonical-reference-adaptation');
			expect(recipe.source.commit).toBe(KIBBLE_REFERENCE_CONTRACT.source.commit);
			expect(recipe.source.dependencyClosure.adapted.length).toBeGreaterThan(0);
		}
		expect(JSON.stringify(KIBBLE_REFERENCE_CONTRACT)).not.toContain('approved-unavailable-state');
		expect(JSON.stringify(KIBBLE_REFERENCE_CONTRACT)).not.toContain('KibbleUnavailableReference');
	});

	it('does not let a contracted route select generic Haven DOM', () => {
		const routeFiles = [
			['search/+page.svelte', 'KibbleSearchReference'], ['cart/+page.svelte', 'KibbleCartReference'],
			['checkout/+page.svelte', 'KibbleCheckoutReference'], ['account/+page.svelte', 'KibbleAccountReference'],
			['checkout/[subtype]/+page.svelte', 'KibbleCheckoutReference'], ['account/[...path]/+page.svelte', 'KibbleAccountReference'],
			['subscriptions/+page.svelte', 'KibbleSubscriptionsReference'], ['portal/subscriptions/[id]/+page.svelte', 'KibbleSubscriptionsReference'],
		] as const;
		for (const [path, component] of routeFiles) {
			const source = route(path);
			expect(source).toContain(component);
			if (!path.startsWith('search/')) expect(source).not.toMatch(/HunterLayout|GathererLayout|LayoutRenderer|RefinementChat/);
		}
	});

	it('keeps every unavailable deep-route server free of backend calls', () => {
		for (const path of ['account/[...path]/+page.server.ts', 'checkout/[subtype]/+page.server.ts', 'subscriptions/+page.server.ts', 'portal/subscriptions/[id]/+page.server.ts']) {
			const source = route(path);
			expect(source).not.toMatch(/\bfetch\s*\(|\$lib\/server\/|createApiClient|checkoutKitLoader/);
		}
	});
});
