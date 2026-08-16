import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	plans: vi.fn(), intent: vi.fn(), sameOrigin: vi.fn(), capacity: vi.fn(),
}));

vi.mock('$lib/server/commerce/subscription-service', () => ({
	createSubscriptionCommerceService: () => ({ plans: mocks.plans, intent: mocks.intent }),
}));
vi.mock('$lib/server/commerce/session', () => ({
	CommerceRateLimitError: class CommerceRateLimitError extends Error {},
	CommerceSessionUnavailableError: class CommerceSessionUnavailableError extends Error {},
	requireSameOrigin: mocks.sameOrigin,
	requireCommerceMutationCapacity: mocks.capacity,
	requireCommerceSessionId: () => 'opaque-session',
	requireIdempotencyKey: () => 'request-intent1',
}));

import { GET as getPlans } from './plans/+server';
import { POST as createIntent } from './cart-intent/+server';

describe('Auto-Refill browser API boundary', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.plans.mockResolvedValue({ ok: true, status: 200, data: { plans: [], evidence: { confirmed: true }, services: {} } });
		mocks.intent.mockResolvedValue({ ok: true, status: 200, data: { plan: { id: 'plan-dog-food-1mo' }, itemCount: 1, evidence: { confirmed: true }, services: {} } });
	});

	it('rejects an invalid plan query before provider lookup', async () => {
		const response = await getPlans({ url: new URL('https://aisles.test/api/subscriptions/plans?bc_product_id=nope') } as never);
		expect(response.status).toBe(400);
		expect(mocks.plans).not.toHaveBeenCalled();
	});

	it('accepts only product and plan identifiers while cart identity stays server-owned', async () => {
		const request = new Request('https://aisles.test/api/subscriptions/cart-intent', {
			method: 'POST',
			headers: { Origin: 'https://aisles.test', 'Idempotency-Key': 'request-intent1' },
			body: JSON.stringify({ productEntityId: 3023, planId: 'plan-dog-food-1mo', cartId: 'browser-must-not-control-this' }),
		});
		const response = await createIntent({ request, cookies: {}, getClientAddress: () => '203.0.113.4' } as never);
		expect(response.status).toBe(200);
		expect(mocks.sameOrigin).toHaveBeenCalledWith(request);
		expect(mocks.capacity).toHaveBeenCalledWith('203.0.113.4');
		expect(mocks.intent).toHaveBeenCalledWith('opaque-session', 'request-intent1', { productEntityId: 3023, planId: 'plan-dog-food-1mo' });
		expect(JSON.stringify(await response.json())).not.toContain('browser-must-not-control-this');
	});
});
