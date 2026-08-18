import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	status: vi.fn(),
	connect: vi.fn(),
	disconnect: vi.fn(),
	list: vi.fn(),
	detail: vi.fn(),
	mutate: vi.fn(),
	sameOrigin: vi.fn(),
	capacity: vi.fn(),
}));

vi.mock('$lib/server/commerce/subscriber-service', () => ({
	createSubscriberService: () => ({
		status: mocks.status,
		connect: mocks.connect,
		disconnect: mocks.disconnect,
		list: mocks.list,
		detail: mocks.detail,
		mutate: mocks.mutate,
	}),
}));

vi.mock('$lib/server/commerce/session', () => ({
	CommerceIdempotencyMismatchError: class CommerceIdempotencyMismatchError extends Error {},
	CommerceOperationInProgressError: class CommerceOperationInProgressError extends Error {},
	CommerceRateLimitError: class CommerceRateLimitError extends Error {},
	CommerceSessionUnavailableError: class CommerceSessionUnavailableError extends Error {},
	commerceSessionId: () => 'opaque-session',
	requireCommerceSessionId: () => 'opaque-session',
	requireIdempotencyKey: () => 'request-action1',
	requireSameOrigin: mocks.sameOrigin,
	requireCommerceMutationCapacity: mocks.capacity,
}));

import { GET as getPortalStatus, POST as connectPortal } from './session/+server';
import { GET as listSubscriptions } from './+server';
import { GET as getSubscription } from './[id]/+server';
import { POST as mutateSubscription } from './[id]/[action]/+server';

const services = {};
const evidence = { confirmed: true };

describe('same-origin subscriber portal API boundary', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.status.mockResolvedValue({ state: 'connection_required', services });
		mocks.connect.mockResolvedValue({ ok: true, status: 200, data: { state: 'connected', services, evidence } });
		mocks.list.mockResolvedValue({ ok: true, status: 200, data: { state: 'connected', subscriptions: [], services, evidence } });
		mocks.detail.mockResolvedValue({ ok: true, status: 200, data: { state: 'connected', subscription: { id: 'subscription-one' }, services, evidence } });
		mocks.mutate.mockResolvedValue({ ok: true, status: 200, data: { state: 'connected', subscriptionId: 'subscription-one', services, evidence } });
	});

	it('returns portal status without exposing a provider session token', async () => {
		const response = await getPortalStatus({ cookies: {}, platform: undefined } as never);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ state: 'connection_required', services });
		expect(mocks.status).toHaveBeenCalledWith('opaque-session');
	});

	it('connects only from a same-origin, rate-limited, idempotent request', async () => {
		const request = new Request('https://aisles.test/api/subscriptions/portal/session', {
			method: 'POST',
			headers: { Origin: 'https://aisles.test', 'Idempotency-Key': 'request-action1' },
			body: '{}',
		});
		const response = await connectPortal({ request, cookies: {}, platform: undefined, getClientAddress: () => '203.0.113.8' } as never);
		expect(response.status).toBe(200);
		expect(mocks.sameOrigin).toHaveBeenCalledWith(request);
		expect(mocks.capacity).toHaveBeenCalledWith('203.0.113.8');
		expect(mocks.connect).toHaveBeenCalledWith('opaque-session', 'request-action1');
		expect(JSON.stringify(await response.json())).not.toContain('token');
	});

	it('reads list and detail with only the opaque server session and route id', async () => {
		await listSubscriptions({ cookies: {}, platform: undefined } as never);
		await getSubscription({ params: { id: 'subscription-one' }, cookies: {}, platform: undefined } as never);
		expect(mocks.list).toHaveBeenCalledWith('opaque-session');
		expect(mocks.detail).toHaveBeenCalledWith('opaque-session', 'subscription-one');
	});

	it('normalizes action input and ignores browser attempts to supply authority fields', async () => {
		const request = new Request('https://aisles.test/api/subscriptions/portal/subscription-one/pause', {
			method: 'POST',
			headers: { Origin: 'https://aisles.test', 'Idempotency-Key': 'request-action1' },
			body: JSON.stringify({ weeks: 8, customerId: 'browser-controlled', providerToken: 'browser-token' }),
		});
		const response = await mutateSubscription({
			params: { id: 'subscription-one', action: 'pause' },
			request,
			cookies: {},
			platform: undefined,
			getClientAddress: () => '203.0.113.8',
		} as never);
		expect(response.status).toBe(200);
		expect(mocks.mutate).toHaveBeenCalledWith('opaque-session', 'request-action1', 'subscription-one', { action: 'pause', weeks: 8 });
		expect(JSON.stringify(await response.json())).not.toContain('browser-token');
	});

	it('rejects unknown actions and malformed reschedule dates before service mutation', async () => {
		const unknown = await mutateSubscription({
			params: { id: 'subscription-one', action: 'charge-now' },
			request: new Request('https://aisles.test/api/subscriptions/portal/subscription-one/charge-now', { method: 'POST', headers: { Origin: 'https://aisles.test' }, body: '{}' }),
			cookies: {}, platform: undefined, getClientAddress: () => '203.0.113.8',
		} as never);
		expect(unknown.status).toBe(400);

		const invalidDate = await mutateSubscription({
			params: { id: 'subscription-one', action: 'reschedule' },
			request: new Request('https://aisles.test/api/subscriptions/portal/subscription-one/reschedule', { method: 'POST', headers: { Origin: 'https://aisles.test' }, body: JSON.stringify({ nextChargeDate: 'tomorrow' }) }),
			cookies: {}, platform: undefined, getClientAddress: () => '203.0.113.8',
		} as never);
		expect(invalidDate.status).toBe(400);
		expect(mocks.mutate).not.toHaveBeenCalled();
	});

	it('uses the provider pause bound instead of hard-coded storefront presets', async () => {
		const request = new Request('https://aisles.test/api/subscriptions/portal/subscription-one/pause', {
			method: 'POST',
			headers: { Origin: 'https://aisles.test', 'Idempotency-Key': 'request-action1' },
			body: JSON.stringify({ weeks: 17 }),
		});
		const response = await mutateSubscription({
			params: { id: 'subscription-one', action: 'pause' }, request, cookies: {}, platform: undefined,
			getClientAddress: () => '203.0.113.8',
		} as never);
		expect(response.status).toBe(200);
		expect(mocks.mutate).toHaveBeenCalledWith('opaque-session', 'request-action1', 'subscription-one', { action: 'pause', weeks: 17 });
	});
});
