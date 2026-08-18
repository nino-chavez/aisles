import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({ dev: true }));
vi.mock('$env/dynamic/private', () => ({ env: {
	SUBS_API_ORIGIN: 'https://subscriptions.example.test',
	BIGCOMMERCE_STORE_HASH: 'store-hash',
	BIGCOMMERCE_CHANNEL_ID: '1853406',
} }));

import { createSubscriptionProvider, SubscriptionProviderError } from './subscriptions';

const rawPlan = {
	id: 'plan-dog-food-1mo', bc_product_id: 3023, name: 'Dog food monthly', interval: 'month', interval_count: 1,
	amount_cents: 2974, currency: 'USD', sales_mode: 'subscribe_and_one_time', trial_days: 0, minimum_term_cycles: 3,
	cycle_discount_pct: 50, cycle_discount_scope: 'first_cycle_only', cycle_discount_count: null,
};

describe('bc-subscriptions server adapter', () => {
	afterEach(() => vi.restoreAllMocks());

	it('normalizes bounded provider plans and scopes the lookup to the configured store and channel', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ plans: [rawPlan] }), { status: 200 }));
		await expect(createSubscriptionProvider().listPlans(3023)).resolves.toEqual([{
			id: rawPlan.id, productEntityId: 3023, name: rawPlan.name, interval: 'month', intervalCount: 1,
			price: { value: 29.74, currencyCode: 'USD' }, salesMode: 'subscribe_and_one_time', trialDays: 0, commitmentCycles: 3,
			introDiscountPercent: 50, introDiscountCycles: 1,
		}]);
		const url = new URL(String(fetchMock.mock.calls[0][0]));
		expect(url.pathname).toBe('/api/v1/storefront/plans');
		expect(Object.fromEntries(url.searchParams)).toEqual({ bc_product_id: '3023', store_hash: 'store-hash', channel_id: '1853406' });
	});

	it('does not expose a provider plan whose effective sales mode is one-time only', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
			plans: [{ ...rawPlan, sales_mode: 'one_time_only' }],
		}), { status: 200 }));
		await expect(createSubscriptionProvider().listPlans(3023)).resolves.toEqual([]);
	});

	it('rejects a provider plan mapped to a different product', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ plans: [{ ...rawPlan, bc_product_id: 9999 }] }), { status: 200 }));
		await expect(createSubscriptionProvider().listPlans(3023)).rejects.toBeInstanceOf(SubscriptionProviderError);
	});

	it('sends only line and plan identifiers and requires exact intent confirmation', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
			cart_id: 'secret-cart', intents: { 'line-one': { id: rawPlan.id, name: rawPlan.name, interval: 'month', interval_count: 1, amount_cents: 2974, currency: 'USD' } },
		}), { status: 201 }));
		await expect(createSubscriptionProvider().createCartIntent('secret-cart', 'line-one', rawPlan.id)).resolves.toBeUndefined();
		const request = fetchMock.mock.calls[0];
		expect(JSON.parse(String(request[1]?.body))).toEqual({ cart_line_id: 'line-one', plan_id: rawPlan.id });
		expect(String(request[0])).toContain('/api/v1/storefront/cart/secret-cart/intents');
	});

	it('classifies a successful response without the requested intent as an ambiguous outcome', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ cart_id: 'secret-cart', intents: {} }), { status: 201 }));
		await expect(createSubscriptionProvider().createCartIntent('secret-cart', 'line-one', rawPlan.id)).rejects.toMatchObject({
			options: { outcomeUnknown: true },
		});
	});

	it('normalizes the provider cart-intent map without returning the cart identifier', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
			cart_id: 'secret-cart',
			intents: { 'line-one': { id: rawPlan.id, name: rawPlan.name, interval: 'month', interval_count: 1, amount_cents: 2974, currency: 'USD' } },
		}), { status: 200 }));
		const intents = await createSubscriptionProvider().listCartIntents('secret-cart');
		expect(intents).toEqual({ 'line-one': { planId: rawPlan.id, name: rawPlan.name, cadence: 'Every month', recurringPrice: { value: 29.74, currencyCode: 'USD' } } });
		expect(JSON.stringify(intents)).not.toContain('secret-cart');
	});
});
