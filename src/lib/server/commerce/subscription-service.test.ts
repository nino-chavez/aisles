import { beforeEach, describe, expect, it, vi } from 'vitest';

const privateEnv = vi.hoisted(() => ({
	KIBBLE_COMMERCE_MODE: 'sandbox',
	KIBBLE_SUBSCRIPTION_MODE: 'sandbox',
	KIBBLE_CUSTOMER_IDENTITY_MODE: 'bigcommerce',
	BIGCOMMERCE_STORE_HASH: 'store-hash',
	KIBBLE_STOREFRONT_TOKEN: 'storefront-token',
	BIGCOMMERCE_STOREFRONT_TOKEN: '',
	BIGCOMMERCE_PRIVATE_TOKEN: 'private-token',
	KV_REST_API_URL: '',
	KV_REST_API_TOKEN: '',
}));

vi.mock('$app/environment', () => ({ dev: true }));
vi.mock('$env/dynamic/private', () => ({ env: privateEnv }));
vi.mock('$lib/brand/config', () => ({ getBrand: () => ({ id: 'kibble', organizationId: 'test-org' }) }));

import { BigCommerceGraphQLError, type CartResponse } from '$lib/server/bigcommerce';
import type { SubscriptionPlan } from '$lib/commerce/subscription-contract';
import { SubscriptionProviderError, type SubscriptionProvider } from '$lib/server/subscriptions';
import { createCommerceService } from './service';
import { createSubscriptionCommerceService } from './subscription-service';
import { _resetCommerceSessionMemoryForTests, coordinateCommerceMutation, loadCommerceSession } from './session';

const plan: SubscriptionPlan = {
	id: 'plan-dog-food-1mo',
	productEntityId: 3071,
	name: 'Dog food — Auto-Refill every month',
	interval: 'month',
	intervalCount: 1,
	price: { value: 12, currencyCode: 'USD' },
	salesMode: 'subscribe_and_one_time',
	trialDays: 0,
	commitmentCycles: 0,
};

function cart(version: number): CartResponse {
	return {
		entityId: 'bc-cart-one',
		version,
		currencyCode: 'USD',
		amount: { value: 12, currencyCode: 'USD' },
		baseAmount: { value: 12, currencyCode: 'USD' },
		lineItems: { physicalItems: [{
			entityId: 'line-one', productEntityId: 3071, variantEntityId: null, name: 'Dog food', quantity: 1,
			salePrice: { value: 12, currencyCode: 'USD' }, listPrice: { value: 12, currencyCode: 'USD' },
			extendedSalePrice: { value: 12, currencyCode: 'USD' }, extendedListPrice: { value: 12, currencyCode: 'USD' },
			imageUrl: null, path: '/dog-food/', isMutable: true,
		}] },
	};
}

async function authenticatedSession(sessionId: string, cartEntityId: string | null = null) {
	await coordinateCommerceMutation({
		sessionId,
		idempotencyKey: `login-${crypto.randomUUID()}`,
		fingerprint: 'account.login',
		execute: async (state) => {
			state.cartEntityId = cartEntityId;
			state.customerSession = {
				provider: 'bigcommerce', customerEntityId: 42, customerAccessToken: 'server-only', expiresAt: '2099-01-01T00:00:00.000Z',
			};
			return { state, value: true };
		},
	});
}

function providers(options: { current?: CartResponse | null; intent?: string | null } = {}) {
	let current = options.current ?? null;
	let intent = options.intent ?? null;
	const subscriptionProvider: SubscriptionProvider = {
		listPlans: vi.fn(async () => [plan]),
		listCartIntents: vi.fn(async () => {
			const intents: Record<string, { planId: string; name: string; cadence: string; recurringPrice: typeof plan.price }> = {};
			if (intent) intents['line-one'] = { planId: intent, name: plan.name, cadence: 'Every month', recurringPrice: plan.price };
			return intents;
		}),
		getCartIntent: vi.fn(async () => intent),
		createCartIntent: vi.fn(async () => { intent = plan.id; }),
	};
	const cartProvider = {
		getCartProductEligibility: vi.fn(async () => ({ entityId: 3071, isInStock: true, hasOptions: false })),
		createCart: vi.fn(async () => (current = cart(1))),
		addToCart: vi.fn(async () => (current = cart((current?.version ?? 0) + 1))),
		getCart: vi.fn(async () => current),
		deleteCartLineItem: vi.fn(async () => (current = null)),
	};
	return { subscriptionProvider, cartProvider };
}

describe('Auto-Refill cart-intent orchestration', () => {
	beforeEach(() => {
		_resetCommerceSessionMemoryForTests();
		privateEnv.KIBBLE_SUBSCRIPTION_MODE = 'sandbox';
		privateEnv.KIBBLE_CUSTOMER_IDENTITY_MODE = 'bigcommerce';
		privateEnv.BIGCOMMERCE_PRIVATE_TOKEN = 'private-token';
	});

	it('requires a server-held customer session before any provider call', async () => {
		const dependencies = providers();
		const result = await createSubscriptionCommerceService(undefined, dependencies).intent(
			crypto.randomUUID(), 'request-intent1', { productEntityId: 3071, planId: plan.id },
		);
		expect(result).toMatchObject({ ok: false, status: 403, error: { code: 'customer_session_required' }, evidence: { attempted: false } });
		expect(dependencies.subscriptionProvider.listPlans).not.toHaveBeenCalled();
		expect(dependencies.cartProvider.createCart).not.toHaveBeenCalled();
	});

	it('creates one cart line, confirms its provider intent, and replays without mutating twice', async () => {
		const sessionId = crypto.randomUUID();
		await authenticatedSession(sessionId);
		const dependencies = providers();
		const service = createSubscriptionCommerceService(undefined, dependencies);
		const first = await service.intent(sessionId, 'request-intent1', { productEntityId: 3071, planId: plan.id });
		const replay = await service.intent(sessionId, 'request-intent1', { productEntityId: 3071, planId: plan.id });
		const cartIntents = await service.cartIntents(sessionId);
		expect(first).toMatchObject({ ok: true, data: { plan: { id: plan.id }, itemCount: 1, evidence: { confirmed: true, commerceStateChanged: 'confirmed', provider: 'bc-subscriptions' } } });
		expect(replay).toMatchObject({ ok: true, data: { replayed: true } });
		expect(dependencies.cartProvider.createCart).toHaveBeenCalledTimes(1);
		expect(dependencies.subscriptionProvider.createCartIntent).toHaveBeenCalledTimes(1);
		expect(cartIntents).toMatchObject({ status: 'confirmed', intents: { 'line-one': { planId: plan.id, cadence: 'Every month' } } });
		expect(JSON.stringify(cartIntents)).not.toContain('bc-cart-one');
		expect(JSON.stringify(first)).not.toContain('bc-cart-one');
		expect(JSON.stringify(first)).not.toContain('server-only');
	});

	it('removes a newly-added line when a known intent failure occurs', async () => {
		const sessionId = crypto.randomUUID();
		await authenticatedSession(sessionId);
		const dependencies = providers();
		vi.mocked(dependencies.subscriptionProvider.createCartIntent).mockRejectedValueOnce(new SubscriptionProviderError('private upstream detail', { status: 409 }));
		const result = await createSubscriptionCommerceService(undefined, dependencies).intent(
			sessionId, 'request-intent1', { productEntityId: 3071, planId: plan.id },
		);
		expect(result).toMatchObject({ ok: false, status: 409, error: { code: 'cart_conflict' }, evidence: { confirmed: false, provider: 'bc-subscriptions' } });
		expect(dependencies.cartProvider.deleteCartLineItem).toHaveBeenCalledTimes(1);
		expect((await loadCommerceSession(sessionId)).cartEntityId).toBeNull();
		expect(JSON.stringify(result)).not.toContain('private upstream detail');
	});

	it('blocks checkout after an ambiguous existing-line intent and clears the block after provider reconciliation', async () => {
		const sessionId = crypto.randomUUID();
		await authenticatedSession(sessionId, 'bc-cart-one');
		const dependencies = providers({ current: cart(2) });
		vi.mocked(dependencies.subscriptionProvider.createCartIntent).mockRejectedValueOnce(new SubscriptionProviderError('timeout', { outcomeUnknown: true }));
		const service = createSubscriptionCommerceService(undefined, dependencies);
		await expect(service.intent(sessionId, 'request-intent1', { productEntityId: 3071, planId: plan.id })).resolves.toMatchObject({ ok: false, error: { code: 'provider_outcome_unknown' } });
		expect((await loadCommerceSession(sessionId)).checkoutBlock).toMatchObject({ reason: 'subscription_intent_unconfirmed' });

		const cartService = createCommerceService({
			...dependencies.cartProvider,
			updateCartLineItem: vi.fn(), deleteCart: vi.fn(), createCartRedirectUrl: vi.fn(),
		} as never);
		await expect(cartService.checkout(sessionId, 'request-checkout1')).resolves.toMatchObject({ ok: false, error: { code: 'checkout_unavailable' } });

		vi.mocked(dependencies.subscriptionProvider.getCartIntent).mockResolvedValueOnce(plan.id);
		await expect(service.intent(sessionId, 'request-intent2', { productEntityId: 3071, planId: plan.id })).resolves.toMatchObject({ ok: true, data: { evidence: { commerceStateChanged: 'none' } } });
		expect((await loadCommerceSession(sessionId)).checkoutBlock).toBeNull();
	});

	it('serializes concurrent attempts for the same durable session', async () => {
		const sessionId = crypto.randomUUID();
		await authenticatedSession(sessionId);
		const dependencies = providers();
		let release!: () => void;
		let started!: () => void;
		const gate = new Promise<void>((resolve) => { release = resolve; });
		const seen = new Promise<void>((resolve) => { started = resolve; });
		vi.mocked(dependencies.subscriptionProvider.createCartIntent).mockImplementationOnce(async () => { started(); await gate; });
		const service = createSubscriptionCommerceService(undefined, dependencies);
		const first = service.intent(sessionId, 'request-intent1', { productEntityId: 3071, planId: plan.id });
		await seen;
		await expect(service.intent(sessionId, 'request-intent2', { productEntityId: 3071, planId: plan.id })).resolves.toMatchObject({ ok: false, error: { code: 'operation_in_progress' } });
		release();
		await expect(first).resolves.toMatchObject({ ok: true });
	});

	it('marks an ambiguous BigCommerce add as checkout-blocking', async () => {
		const sessionId = crypto.randomUUID();
		await authenticatedSession(sessionId);
		const dependencies = providers();
		vi.mocked(dependencies.cartProvider.createCart).mockRejectedValueOnce(new BigCommerceGraphQLError('unknown', { outcomeUnknown: true }));
		await createSubscriptionCommerceService(undefined, dependencies).intent(sessionId, 'request-intent1', { productEntityId: 3071, planId: plan.id });
		expect((await loadCommerceSession(sessionId)).checkoutBlock).toMatchObject({ reason: 'subscription_intent_unconfirmed' });
	});
});
