import { describe, expect, it, vi } from 'vitest';
import {
	getKibbleCartSubscriptionIntents,
	getKibbleSubscriptionPlans,
	setKibbleCartSubscriptionIntent,
} from './kibble-subscriptions';

vi.mock('$env/dynamic/private', () => ({
	env: {
		BIGCOMMERCE_STORE_HASH: 'store-1',
		KIBBLE_SUBSCRIPTION_API_URL: 'https://subs.test/',
	},
}));

function response(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

describe('Kibble subscription storefront adapter', () => {
	it('reads only active, accepting plans for the requested catalog product', async () => {
		let requestUrl = '';
		const plans = await getKibbleSubscriptionPlans(42, {
			fetchImpl: async (input) => {
				requestUrl = String(input);
				return response({ plans: [
					{ id: 'plan-monthly', name: 'Monthly', bc_product_id: 42, amount_cents: 2400, currency: 'usd', interval: 'month', interval_count: 1, status: 'active', accepting_new_subscribers: true, sales_mode: 'subscribe_and_one_time', discount_pct: 10, trial_days: 0, commitment_cycles: null },
					{ id: 'plan-archived', name: 'Old plan', bc_product_id: 42, amount_cents: 2200, currency: 'USD', interval: 'month', interval_count: 1, status: 'archived', accepting_new_subscribers: true, sales_mode: 'subscribe_and_one_time' },
					{ id: 'plan-paused', name: 'Paused plan', bc_product_id: 42, amount_cents: 2200, currency: 'USD', interval: 'month', interval_count: 1, status: 'active', accepting_new_subscribers: false, sales_mode: 'subscribe_and_one_time' },
					{ id: 'plan-other-product', name: 'Other product', bc_product_id: 99, amount_cents: 2200, currency: 'USD', interval: 'month', interval_count: 1, status: 'active', accepting_new_subscribers: true, sales_mode: 'subscribe_and_one_time' },
					{ id: 'plan-one-time', name: 'One time', bc_product_id: 42, amount_cents: 2200, currency: 'USD', interval: 'month', interval_count: 1, status: 'active', accepting_new_subscribers: true, sales_mode: 'one_time_only' },
				] });
			},
		});

		expect(requestUrl).toBe('https://subs.test/api/v1/storefront/plans?store_hash=store-1&bc_product_id=42');
		expect(plans).toEqual([{ id: 'plan-monthly', name: 'Monthly', bcProductId: 42, amountCents: 2400, currency: 'USD', interval: 'month', intervalCount: 1, salesMode: 'subscribe_and_one_time', discountPct: 10, trialDays: 0, commitmentCycles: null }]);
	});

	it('posts the plan identity and provider-derived cadence to the intent service', async () => {
		let requestUrl = '';
		let requestBody: unknown;
		const intent = await setKibbleCartSubscriptionIntent('cart/1', 'line-1', 'plan-1', {
			cadence: 'month', intervalCount: 2,
			fetchImpl: async (input, init) => {
				requestUrl = String(input);
				requestBody = JSON.parse(String(init?.body));
				return response({ cart_id: 'cart/1', intents: { 'line-1': { id: 'plan-1', name: 'Every two months', interval: 'month', interval_count: 2, amount_cents: 3000, currency: 'USD' } } }, 201);
			},
		});

		expect(requestUrl).toBe('https://subs.test/api/v1/storefront/cart/cart%2F1/intents?store_hash=store-1');
		expect(requestBody).toEqual({ lineEntityId: 'line-1', plan_id: 'plan-1', cadence: 'month', interval_count: 2 });
		expect(intent).toEqual({ id: 'plan-1', name: 'Every two months', interval: 'month', intervalCount: 2, amountCents: 3000, currency: 'USD' });
	});

	it('maps a provider conflict to a safe retryable error', async () => {
		await expect(setKibbleCartSubscriptionIntent('cart-1', 'line-1', 'plan-1', {
			cadence: 'month', intervalCount: 1,
			fetchImpl: async () => response({ error: 'internal details must not escape' }, 409),
		})).rejects.toMatchObject({ status: 409, kind: 'conflict', message: 'Subscription intent changed. Refresh the cart and try again.' });
	});

	it('reads and bounds the cart intent map without exposing provider response fields', async () => {
		const intents = await getKibbleCartSubscriptionIntents('cart-1', {
			fetchImpl: async () => response({ cart_id: 'cart-1', intents: {
				'line-1': { id: 'plan-1', name: 'Monthly', interval: 'month', interval_count: 1, amount_cents: 2500, currency: 'usd', cycles: 3, internal_token: 'secret',
				},
			} }),
		});
		expect(intents).toEqual({ 'line-1': { id: 'plan-1', name: 'Monthly', interval: 'month', intervalCount: 1, amountCents: 2500, currency: 'USD', cycles: 3 } });
		expect(JSON.stringify(intents)).not.toContain('internal_token');
	});
});
