import { beforeEach, describe, expect, it, vi } from 'vitest';

const privateEnv = vi.hoisted(() => ({
	KIBBLE_COMMERCE_MODE: 'sandbox',
	KIBBLE_SUBSCRIPTION_MODE: 'sandbox',
	KIBBLE_CUSTOMER_IDENTITY_MODE: 'bigcommerce',
	BIGCOMMERCE_STORE_HASH: 'store-hash',
	BIGCOMMERCE_PRIVATE_TOKEN: 'private-token',
	KV_REST_API_URL: '',
	KV_REST_API_TOKEN: '',
}));

vi.mock('$app/environment', () => ({ dev: true }));
vi.mock('$env/dynamic/private', () => ({ env: privateEnv }));
vi.mock('$lib/brand/config', () => ({ getBrand: () => ({ id: 'kibble', organizationId: 'test-org' }) }));

import type { SubscriptionPortalDetail, SubscriptionPortalSummary } from '$lib/commerce/subscription-portal-contract';
import { SubscriptionPortalProviderError, type SubscriptionPortalProvider } from '$lib/server/subscription-portal';
import { _resetCommerceSessionMemoryForTests, coordinateCommerceMutation, loadCommerceSession } from './session';
import { createSubscriberService } from './subscriber-service';

const summary: SubscriptionPortalSummary = {
	id: 'subscription-one',
	status: 'active',
	planId: 'plan-one',
	planName: 'GoodGut monthly',
	recurringPrice: { value: 29.74, currencyCode: 'USD' },
	cadence: 'Every month',
	productEntityId: 3023,
	nextChargeAt: '2099-02-01T00:00:00.000Z',
	currentPeriodEnd: '2099-02-01T00:00:00.000Z',
	createdAt: '2099-01-01T00:00:00.000Z',
	cancelledAt: null,
	cyclesCompleted: 2,
	prepaidCyclesTotal: null,
	prepaidCyclesRemaining: null,
};

const detail: SubscriptionPortalDetail = { ...summary, cancelReason: null, charges: [] };

function portalProvider(): SubscriptionPortalProvider {
	return {
		isConfigured: vi.fn(() => true),
		exchangeCustomerSession: vi.fn(async () => ({
			sessionToken: 'server-only-provider-session-token',
			providerCustomerId: 'provider-customer-one',
			expiresAt: '2099-01-01T00:00:00.000Z',
		})),
		listSubscriptions: vi.fn(async () => [summary]),
		getSubscription: vi.fn(async () => detail),
		mutateSubscription: vi.fn(async () => undefined),
	};
}

async function seedCustomer(sessionId: string) {
	await coordinateCommerceMutation({
		sessionId,
		idempotencyKey: `seed-${crypto.randomUUID()}`,
		fingerprint: 'seed-customer',
		execute: async (state) => {
			state.customerSession = {
				provider: 'bigcommerce',
				customerEntityId: 42,
				customerEmail: 'shopper@example.test',
				customerAccessToken: 'server-only-bigcommerce-token',
				expiresAt: '2099-01-01T00:00:00.000Z',
			};
			return { state, value: true };
		},
	});
}

describe('server-owned subscriber portal orchestration', () => {
	beforeEach(() => _resetCommerceSessionMemoryForTests());

	it('requires an explicit connect and keeps both provider tokens out of the response', async () => {
		const sessionId = crypto.randomUUID();
		await seedCustomer(sessionId);
		const provider = portalProvider();
		const service = createSubscriberService(undefined, provider);

		await expect(service.list(sessionId)).resolves.toMatchObject({
			ok: false,
			status: 401,
			error: { code: 'portal_connection_required' },
			evidence: { attempted: false, provider: 'none' },
		});

		const connected = await service.connect(sessionId, 'request-connect1');
		expect(connected).toMatchObject({ ok: true, data: { state: 'connected', evidence: { confirmed: true } } });
		expect(provider.exchangeCustomerSession).toHaveBeenCalledWith({ customerEntityId: 42, email: 'shopper@example.test' });
		const serialized = JSON.stringify(connected);
		expect(serialized).not.toContain('shopper@example.test');
		expect(serialized).not.toContain('server-only-provider-session-token');
		expect(serialized).not.toContain('server-only-bigcommerce-token');

		expect(await loadCommerceSession(sessionId)).toMatchObject({
			subscriptionPortalSession: {
				provider: 'bc-subscriptions',
				bigCommerceCustomerEntityId: 42,
				providerCustomerId: 'provider-customer-one',
				sessionToken: 'server-only-provider-session-token',
			},
		});
	});

	it('lists and reads only through the server-held portal token', async () => {
		const sessionId = crypto.randomUUID();
		await seedCustomer(sessionId);
		const provider = portalProvider();
		const service = createSubscriberService(undefined, provider);
		await service.connect(sessionId, 'request-connect1');

		await expect(service.list(sessionId)).resolves.toMatchObject({ ok: true, data: { subscriptions: [{ id: summary.id }] } });
		await expect(service.detail(sessionId, summary.id)).resolves.toMatchObject({ ok: true, data: { subscription: { id: summary.id } } });
		expect(provider.listSubscriptions).toHaveBeenCalledWith('server-only-provider-session-token');
		expect(provider.getSubscription).toHaveBeenCalledWith('server-only-provider-session-token', summary.id);
		expect(JSON.stringify(await service.list(sessionId))).not.toContain('server-only-provider-session-token');
	});

	it('disconnects only the provider portal reference and leaves the BC customer session active', async () => {
		const sessionId = crypto.randomUUID();
		await seedCustomer(sessionId);
		const service = createSubscriberService(undefined, portalProvider());
		await service.connect(sessionId, 'request-connect1');
		await expect(service.disconnect(sessionId, 'request-disconnect1')).resolves.toMatchObject({
			ok: true,
			data: { state: 'connection_required', evidence: { provider: 'none', subscriptionStateChanged: 'none' } },
		});
		expect(await loadCommerceSession(sessionId)).toMatchObject({
			customerSession: { customerEntityId: 42 },
			subscriptionPortalSession: null,
		});
	});

	it('replays one mutation and serializes a concurrent second action', async () => {
		const sessionId = crypto.randomUUID();
		await seedCustomer(sessionId);
		const provider = portalProvider();
		const service = createSubscriberService(undefined, provider);
		await service.connect(sessionId, 'request-connect1');

		const first = await service.mutate(sessionId, 'request-skip1', summary.id, { action: 'skip' });
		const replay = await service.mutate(sessionId, 'request-skip1', summary.id, { action: 'skip' });
		expect(first).toMatchObject({ ok: true, data: { evidence: { confirmed: true, subscriptionStateChanged: 'confirmed' } } });
		expect(replay).toMatchObject({ ok: true, data: { replayed: true } });
		expect(provider.mutateSubscription).toHaveBeenCalledTimes(1);
		await expect(service.mutate(sessionId, 'request-skip1', summary.id, { action: 'resume' })).resolves.toMatchObject({
			ok: false,
			status: 409,
			error: { code: 'idempotency_mismatch', retryable: false },
			evidence: { attempted: false },
		});
		expect(provider.mutateSubscription).toHaveBeenCalledTimes(1);

		let release!: () => void;
		let started!: () => void;
		const gate = new Promise<void>((resolve) => { release = resolve; });
		const seen = new Promise<void>((resolve) => { started = resolve; });
		vi.mocked(provider.mutateSubscription).mockImplementationOnce(async () => { started(); await gate; });
		const pending = service.mutate(sessionId, 'request-pause1', summary.id, { action: 'pause', weeks: 8 });
		await seen;
		await expect(service.mutate(sessionId, 'request-resume1', summary.id, { action: 'resume' })).resolves.toMatchObject({
			ok: false,
			error: { code: 'operation_in_progress' },
			evidence: { attempted: false },
		});
		release();
		await expect(pending).resolves.toMatchObject({ ok: true });
	});

	it('does not retry or claim success after an ambiguous provider mutation', async () => {
		const sessionId = crypto.randomUUID();
		await seedCustomer(sessionId);
		const provider = portalProvider();
		const service = createSubscriberService(undefined, provider);
		await service.connect(sessionId, 'request-connect1');
		vi.mocked(provider.mutateSubscription).mockRejectedValueOnce(new SubscriptionPortalProviderError('private provider detail', { outcomeUnknown: true }));

		const result = await service.mutate(sessionId, 'request-skip1', summary.id, { action: 'skip' });
		expect(result).toMatchObject({
			ok: false,
			status: 502,
			error: { code: 'provider_outcome_unknown', retryable: false },
			evidence: { attempted: true, confirmed: false, subscriptionStateChanged: 'not_confirmed' },
		});
		expect(JSON.stringify(result)).not.toContain('private provider detail');
		expect(provider.mutateSubscription).toHaveBeenCalledTimes(1);
	});

	it('normalizes a provider conflict without exposing provider detail or claiming a change', async () => {
		const sessionId = crypto.randomUUID();
		await seedCustomer(sessionId);
		const provider = portalProvider();
		const service = createSubscriberService(undefined, provider);
		await service.connect(sessionId, 'request-connect1');
		vi.mocked(provider.mutateSubscription).mockRejectedValueOnce(new SubscriptionPortalProviderError('private provider detail', { status: 409 }));

		const result = await service.mutate(sessionId, 'request-resume1', summary.id, { action: 'resume' });
		expect(result).toMatchObject({
			ok: false,
			status: 409,
			error: { code: 'subscription_conflict', retryable: true },
			evidence: { attempted: true, confirmed: false, subscriptionStateChanged: 'not_confirmed' },
		});
		expect(JSON.stringify(result)).not.toContain('private provider detail');
	});
});
