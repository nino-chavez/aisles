import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import KibbleSearchReference from '$lib/components/kibble/KibbleSearchReference.svelte';
import KibbleCartReference from '$lib/components/kibble/KibbleCartReference.svelte';
import KibbleAccountReference from '$lib/components/kibble/KibbleAccountReference.svelte';
import KibbleCheckoutReference from '$lib/components/kibble/KibbleCheckoutReference.svelte';
import KibbleSubscriptionsReference from '$lib/components/kibble/KibbleSubscriptionsReference.svelte';
import SearchPage from './search/+page.svelte';
import CartPage from './cart/+page.svelte';
import AccountPage from './account/+page.svelte';
import { KIBBLE_REFERENCE_CONTRACT } from '$lib/brand/reference/kibble';

const route = (path: string) => readFileSync(resolve(import.meta.dirname, path), 'utf8');

describe('Kibble route-specific unavailable shells', () => {
	it('renders source-backed search results as inert Kibble product cards', () => {
		const body = render(KibbleSearchReference, { props: {
			query: 'goodgut',
			products: [{ id: 'goodgut', entityId: 3023, name: 'GoodGut', price: 34.99, image: '', imageAlt: 'GoodGut', description: '', specs: {}, tags: [], category: 'Dog Food' }],
			pageInfo: { hasNextPage: false, endCursor: null }, loadMoreHref: null,
			responseProvenance: {
				referenceId: KIBBLE_REFERENCE_CONTRACT.id, referenceVersion: KIBBLE_REFERENCE_CONTRACT.version,
				policyVersion: 'trusted-policy', routePath: '/search', source: 'parity-fixture', query: 'goodgut', cursor: null, pageSize: 24,
				catalogSha256: 'b'.repeat(64), resultSha256: 'c'.repeat(64), fixedDataIdentity: KIBBLE_REFERENCE_CONTRACT.source.fixtureSha256,
			},
		} }).body;
		expect(body).toContain('data-kibble-route-shell="search"');
		expect(body).toContain('Results for "goodgut"');
		expect(body).toContain('method="get"');
		expect(body).toContain('action="/search"');
		expect(body).toContain('1 product');
		expect(body).toContain('GoodGut');
		expect(body).toContain(`data-reference-fixture-sha256="${KIBBLE_REFERENCE_CONTRACT.source.fixtureSha256}"`);
		expect(body).toContain('data-reference-provenance-source="parity-fixture"');
		expect(body).toContain(`data-kibble-search-catalog-sha256="${'b'.repeat(64)}"`);
		expect(body).not.toContain('/product/goodgut');
		expect(body).not.toContain('KibbleUnavailableReference');
	});

	it('renders the content-backed Kibble empty-search adapter', () => {
		const body = render(KibbleSearchReference, { props: {
			query: 'missing', products: [], pageInfo: { hasNextPage: false, endCursor: null }, loadMoreHref: null,
			zoneAdapter: {
				instanceId: 'search.empty-state', adapterId: 'kibble.zone.search.empty-state',
				sharedStatus: 'live', sharedContentKind: 'content',
				componentVariantId: 'kibble.search.empty-state', inputSha256: 'a'.repeat(64),
				content: { component: 'editorial-header', props: { eyebrow: 'No matches', headline: 'No products match “missing”', body: 'Try a different keyword.' } },
			},
		} }).body;
		expect(body).toContain('data-kibble-zone-instance="search.empty-state"');
		expect(body).toContain('No products match “missing”');
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

	it('renders the opt-in authenticated account state without provider credentials in markup', () => {
		const body = render(KibbleAccountReference, { props: {
			subtype: 'orders', brandName: 'Kibble & Co.', availabilityMessage: 'Account services are available.', commerceEnabled: true,
			session: { entityId: 9, firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' },
			orders: [{ entityId: 101, updatedAt: '2026-08-14T00:00:00Z', subTotal: { value: 25, currencyCode: 'USD' }, totalIncTax: { value: 27, currencyCode: 'USD' }, itemCount: 2 }],
		} }).body;
		expect(body).toContain('data-kibble-backend-state="authenticated"');
		expect(body).toContain('Order #101');
		expect(body).toContain('$27.00');
		expect(body).not.toContain('customer-token');
		expect(body).not.toContain('commerce_session');
	});

	it.each(['gift', 'prepaid', 'confirmation'] as const)('renders the %s checkout subtype without a money-path claim', (subtype) => {
		const body = render(KibbleCheckoutReference, { props: { subtype, availabilityMessage: 'Checkout unavailable.' } }).body;
		expect(body).toContain(`data-kibble-checkout-subtype="${subtype}"`);
		if (subtype !== 'confirmation') expect(body).toContain('disabled');
		expect(body).not.toMatch(/\$\d|save \d|order number|guaranteed/i);
		expect(body).not.toContain('method="POST"');
	});

	it.each(['portal', 'account', 'detail'] as const)('renders the %s subscription subtype without subscriber data', (subtype) => {
		const body = render(KibbleSubscriptionsReference, { props: { subtype, brandName: 'Trusted Tenant', availabilityMessage: 'Subscriptions unavailable.' } }).body;
		expect(body).toContain(`data-kibble-subscriptions-subtype="${subtype}"`);
		expect(body).toContain('disabled');
		if (subtype !== 'detail') expect(body).toContain('Trusted Tenant');
		expect(body).not.toMatch(/active subscription|next charge|renewal date|payment ending/i);
	});

	it('contracts the trusted tenant name consumed by subscription account shells', () => {
		const component = KIBBLE_REFERENCE_CONTRACT.components.find(({ id }) => id === 'kibble.subscriptions');
		const variant = component?.variants.find(({ id }) => id === KIBBLE_REFERENCE_CONTRACT.recipes.subscriptions.variantId);
		expect(variant?.dynamicPropFields).toContain('brandName');
		expect(variant?.copyFields).toContainEqual(expect.objectContaining({ field: 'brandName', maxLength: 40 }));
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
			['account/+page.svelte', 'KibbleAccountReference'],
			['checkout/[subtype]/+page.svelte', 'KibbleCheckoutReference'], ['account/[...path]/+page.svelte', 'KibbleAccountReference'],
			['subscriptions/+page.svelte', 'KibbleSubscriptionsReference'], ['portal/subscriptions/[id]/+page.svelte', 'KibbleSubscriptionsReference'],
		] as const;
		for (const [path, component] of routeFiles) {
			const source = route(path);
			expect(source).toContain(component);
			if (!path.startsWith('search/')) expect(source).not.toMatch(/HunterLayout|GathererLayout|LayoutRenderer|RefinementChat/);
		}
	});

	it('SSR selects only route-native Kibble DOM when trusted Preserve data is present', () => {
		const search = render(SearchPage, { props: { data: {
			renderMode: 'reference-preserve', query: 'LEGACY QUERY', results: [{ name: 'LEGACY PRODUCT' }],
			kibbleSearch: { query: 'goodgut', products: [], pageInfo: { hasNextPage: false, endCursor: null }, loadMoreHref: null, zoneAdapter: {
				instanceId: 'search.empty-state', adapterId: 'kibble.zone.search.empty-state', sharedStatus: 'live', sharedContentKind: 'content', componentVariantId: 'kibble.search.empty-state', inputSha256: 'a'.repeat(64),
				content: { component: 'editorial-header', props: { eyebrow: 'No matches', headline: 'No products match “goodgut”', body: 'Try another keyword.' } },
			}, policyVersion: 'trusted-policy' },
		} as never } }).body;
		expect(search).toContain('data-kibble-route-shell="search"');
		expect(search).toContain('data-kibble-route-policy="trusted-policy"');
		expect(search).not.toContain('LEGACY PRODUCT');

		const cart = render(CartPage, { props: { data: {
			renderMode: 'reference-preserve',
			kibbleCart: { availabilityMessage: 'Cart unavailable.', policyVersion: 'trusted-policy' },
		} as never } }).body;
		expect(cart).toContain('data-kibble-route-shell="cart"');
		expect(cart).not.toContain('mx-auto max-w-3xl');

		const checkoutSource = route('checkout/+page.server.ts');
		expect(checkoutSource).toContain("throw error(404, 'Not found')");

		const account = render(AccountPage, { props: { data: {
			kibbleAccount: { subtype: 'login', brandName: 'Kibble & Co.', availabilityMessage: 'Account unavailable.', recipeId: 'kibble-account-reference-v1', policyVersion: 'trusted-policy' },
		} as never } }).body;
		expect(account).toContain('data-kibble-route-shell="account"');
		expect(account).not.toContain('Account is unavailable.');
	});

	it('keeps every unavailable deep-route server free of backend calls', () => {
		for (const path of ['account/[...path]/+page.server.ts', 'checkout/[subtype]/+page.server.ts', 'subscriptions/+page.server.ts', 'portal/subscriptions/[id]/+page.server.ts']) {
			const source = route(path);
			if (path.startsWith('account/')) {
				// Account is the first opt-in commerce slice. Its loader remains inert
				// when KIBBLE_COMMERCE_MODE=off; live-mode provider reads are tested at
				// the adapter boundary instead of by this presentation-shell contract.
				expect(source).toContain('loadKibbleAccountState');
				continue;
			}
			expect(source).not.toMatch(/\bfetch\s*\(|\$lib\/server\/|createApiClient|checkoutKitLoader/);
		}
	});

	it('keeps operator and development routes outside shopper chrome and marks every Kibble shopper page at the root', () => {
		const server = route('+layout.server.ts');
		const layout = route('+layout.svelte');
		expect(server).toContain("pathname.startsWith('/observe/')");
		expect(server).toContain("pathname.startsWith('/style-guide/')");
		expect(server).toContain('tryNormalizeTrustedShopperRoute');
		expect(layout).toContain("data.routeAudience !== 'shopper'");
		for (const marker of ['data-reference-id', 'data-reference-contract-version', 'data-reference-fixture-sha256', 'data-reference-provenance-source', 'data-reference-route', 'data-reference-surface']) {
			expect(layout).toContain(marker);
		}
		expect(route('compare/+page.server.ts')).toContain("getBrand().id === 'kibble'");
		expect(route('style-guide/+page.server.ts')).toContain("getBrand().id === 'kibble'");
	});
});
