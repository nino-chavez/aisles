import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({ dev: true }));
vi.mock('$env/dynamic/private', () => ({ env: {
	SUBS_API_ORIGIN: 'https://subscriptions.example.test',
	BIGCOMMERCE_STORE_HASH: 'store-hash',
	SSO_HANDOFF_SECRET: 'shared-test-secret',
} }));

import { createSubscriptionPortalProvider, SubscriptionPortalProviderError } from './subscription-portal';

const rawSummary = {
	id: 'subscription-one',
	status: 'active',
	next_charge_at: '2099-02-01T00:00:00.000Z',
	current_period_end: '2099-02-01T00:00:00.000Z',
	created_at: '2099-01-01T00:00:00.000Z',
	cancelled_at: null,
	plan_id: 'plan-one',
	plan_name: 'GoodGut monthly',
	plan_amount_cents: 2974,
	plan_currency: 'USD',
	plan_interval: 'month',
	plan_interval_count: 1,
	bc_product_id: 3023,
	cycles_completed: 2,
	prepaid_cycles_total: null,
	prepaid_cycles_remaining: null,
};

describe('bc-subscriptions portal adapter', () => {
	afterEach(() => vi.restoreAllMocks());

	it('mints a one-minute server handoff without putting the BC token in its claims', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
			session_token: 'provider-session-token-at-least-twenty',
			customer_id: 'provider-customer-one',
			store_hash: 'store-hash',
		}), { status: 200 }));
		await expect(createSubscriptionPortalProvider().exchangeCustomerSession({ customerEntityId: 42, email: 'shopper@example.test' })).resolves.toMatchObject({
			providerCustomerId: 'provider-customer-one',
			sessionToken: 'provider-session-token-at-least-twenty',
		});
		const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
		const [, payload] = body.handoff_token.split('.');
		const claims = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
		expect(claims).toMatchObject({ store_hash: 'store-hash', bc_customer_id: 42, email: 'shopper@example.test' });
		expect(claims.exp - claims.iat).toBe(60);
		expect(claims).not.toHaveProperty('bc_access_token');
	});

	it('normalizes the customer-scoped list and never returns the bearer token', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ subscriptions: [rawSummary] }), { status: 200 }));
		const subscriptions = await createSubscriptionPortalProvider().listSubscriptions('server-only-portal-token');
		expect(subscriptions).toEqual([expect.objectContaining({
			id: 'subscription-one',
			status: 'active',
			recurringPrice: { value: 29.74, currencyCode: 'USD' },
			cadence: 'Every month',
		})]);
		expect((fetchMock.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe('Bearer server-only-portal-token');
		expect(JSON.stringify(subscriptions)).not.toContain('server-only-portal-token');
	});

	it('does not classify an invalid read response as an unknown subscription mutation', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('not json', { status: 200 }));
		await expect(createSubscriptionPortalProvider().listSubscriptions('server-only-portal-token')).rejects.toMatchObject({
			options: { outcomeUnknown: false },
		});
	});

	it('reads detail and charge history through ownership-checking provider routes', async () => {
		vi.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(new Response(JSON.stringify({ subscription: { ...rawSummary, cancel_reason: null } }), { status: 200 }))
			.mockResolvedValueOnce(new Response(JSON.stringify({ charges: [{
				id: 'charge-one', amount_cents: 2974, currency: 'USD', status: 'succeeded',
				scheduled_at: '2099-01-01T00:00:00.000Z', attempted_at: '2099-01-01T00:00:00.000Z', succeeded_at: '2099-01-01T00:00:01.000Z',
			}] }), { status: 200 }));
		await expect(createSubscriptionPortalProvider().getSubscription('server-only-portal-token', 'subscription-one')).resolves.toMatchObject({
			id: 'subscription-one',
			charges: [{ id: 'charge-one', amount: { value: 29.74, currencyCode: 'USD' } }],
		});
	});

	it('sends only the validated action fields and treats network mutation failure as ambiguous', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
		await createSubscriptionPortalProvider().mutateSubscription('server-only-portal-token', 'subscription-one', { action: 'pause', weeks: 8 });
		expect(new URL(String(fetchMock.mock.calls[0][0])).pathname).toBe('/api/v1/portal/subscriptions/subscription-one/pause');
		expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ weeks: 8 });

		fetchMock.mockRejectedValueOnce(new Error('private network detail'));
		await expect(createSubscriptionPortalProvider().mutateSubscription('server-only-portal-token', 'subscription-one', { action: 'skip' })).rejects.toMatchObject({
			options: { outcomeUnknown: true },
		});
	});

	it('rejects a portal response that maps to another store', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
			session_token: 'provider-session-token-at-least-twenty',
			customer_id: 'provider-customer-one',
			store_hash: 'another-store',
		}), { status: 200 }));
		await expect(createSubscriptionPortalProvider().exchangeCustomerSession({ customerEntityId: 42, email: 'shopper@example.test' })).rejects.toBeInstanceOf(SubscriptionPortalProviderError);
	});
});
