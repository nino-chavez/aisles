import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: {} }));

import {
	CommerceIdempotencyMismatchError,
	CommerceOperationInProgressError,
	CommerceRateLimitError,
	CommerceSessionUnavailableError,
	COMMERCE_MUTATION_CLIENT_LIMIT,
	CUSTOMER_AUTH_CLIENT_LIMIT,
	_resetCommerceSessionMemoryForTests,
	activeCustomerSession,
	clearExpiredCustomerSession,
	commerceSessionId,
	coordinateCommerceMutation,
	loadCommerceSession,
	requireCommerceSessionId,
	requireCommerceMutationCapacity,
	requireCustomerAuthenticationCapacity,
	requireIdempotencyKey,
	requireSameOrigin,
} from './session';

describe('server-owned commerce session and mutation coordination', () => {
	beforeEach(() => {
		vi.stubEnv('BRAND_ID', 'kibble');
		_resetCommerceSessionMemoryForTests();
	});

	it('sets only an opaque, httpOnly session reference in the browser', () => {
		const set = vi.fn();
		const id = commerceSessionId({ get: vi.fn(), set } as never);
		expect(id).toMatch(/^[a-f0-9-]{36}$/);
		expect(set).toHaveBeenCalledWith(
			'kibble_commerce_session',
			id,
			expect.objectContaining({
				httpOnly: true,
				sameSite: 'lax',
				path: '/',
			}),
		);
		expect(JSON.stringify(set.mock.calls)).not.toContain('cartEntityId');
	});

	it('reuses an existing valid opaque session without rewriting the cookie', () => {
		const existing = crypto.randomUUID();
		const set = vi.fn();
		const id = commerceSessionId({ get: vi.fn(() => existing), set } as never);
		expect(id).toBe(existing);
		expect(set).not.toHaveBeenCalled();
	});

	it('rejects a mutation until SSR or a read establishes the opaque session', () => {
		expect(() => requireCommerceSessionId({ get: vi.fn() } as never)).toThrow(CommerceSessionUnavailableError);
		const existing = crypto.randomUUID();
		expect(requireCommerceSessionId({ get: vi.fn(() => existing) } as never)).toBe(existing);
	});

	it('requires a bounded idempotency key', () => {
		expect(
			requireIdempotencyKey(
				new Request('https://example.test', {
					headers: { 'Idempotency-Key': 'request-1234' },
				}),
			),
		).toBe('request-1234');
		expect(() => requireIdempotencyKey(new Request('https://example.test'))).toThrow(TypeError);
	});

	it('rejects missing or cross-origin mutation provenance', () => {
		expect(() => requireSameOrigin(new Request('https://aisles.example.test/api/cart'))).toThrow(TypeError);
		expect(() =>
			requireSameOrigin(
				new Request('https://aisles.example.test/api/cart', {
					headers: { Origin: 'https://other.example.test' },
				}),
			),
		).toThrow(TypeError);
		expect(() =>
			requireSameOrigin(
				new Request('https://aisles.example.test/api/cart', {
					headers: { Origin: 'https://aisles.example.test' },
				}),
			),
		).not.toThrow();
	});

	it('replays one completed result without re-running the provider operation', async () => {
		const execute = vi.fn(async (state) => {
			state.cartEntityId = 'server-only-cart';
			return { state, value: { confirmed: true } };
		});
		const options = {
			sessionId: crypto.randomUUID(),
			idempotencyKey: 'request-1234',
			fingerprint: 'cart.add:7',
			execute,
		};
		const first = await coordinateCommerceMutation(options);
		const replay = await coordinateCommerceMutation(options);
		expect(first.replayed).toBe(false);
		expect(replay).toEqual({ value: { confirmed: true }, replayed: true });
		expect(execute).toHaveBeenCalledTimes(1);
		expect((await loadCommerceSession(options.sessionId)).cartEntityId).toBe('server-only-cart');
	});

	it('serializes but does not persist a single-use result', async () => {
		const execute = vi.fn(async (state) => ({ state, value: crypto.randomUUID() }));
		const options = {
			sessionId: crypto.randomUUID(),
			idempotencyKey: 'request-checkout',
			fingerprint: 'checkout.handoff',
			persistResult: false,
			execute,
		};
		const first = await coordinateCommerceMutation(options);
		const second = await coordinateCommerceMutation(options);
		expect(first.replayed).toBe(false);
		expect(second.replayed).toBe(false);
		expect(second.value).not.toBe(first.value);
		expect(execute).toHaveBeenCalledTimes(2);
	});

	it('rate-limits a client address before another anonymous mutation can run', async () => {
		for (let index = 0; index < COMMERCE_MUTATION_CLIENT_LIMIT; index += 1) {
			await expect(requireCommerceMutationCapacity('203.0.113.10')).resolves.toBeUndefined();
		}
		await expect(requireCommerceMutationCapacity('203.0.113.10')).rejects.toBeInstanceOf(CommerceRateLimitError);
		await expect(requireCommerceMutationCapacity('203.0.113.11')).resolves.toBeUndefined();
	});

	it('uses a stricter, separate rate window for customer authentication', async () => {
		for (let index = 0; index < CUSTOMER_AUTH_CLIENT_LIMIT; index += 1) {
			await expect(requireCustomerAuthenticationCapacity('203.0.113.20')).resolves.toBeUndefined();
		}
		await expect(requireCustomerAuthenticationCapacity('203.0.113.20')).rejects.toBeInstanceOf(CommerceRateLimitError);
		await expect(requireCommerceMutationCapacity('203.0.113.20')).resolves.toBeUndefined();
	});

	it('accepts only a live server-held customer token and clears an expired reference', async () => {
		const sessionId = crypto.randomUUID();
		await coordinateCommerceMutation({
			sessionId,
			idempotencyKey: 'request-auth1',
			fingerprint: 'account.login',
			execute: async (state) => {
				state.customerSession = {
					provider: 'bigcommerce',
					customerEntityId: 42,
					customerEmail: 'shopper@example.test',
					customerAccessToken: 'server-only-token',
					expiresAt: '2026-08-15T15:00:00.000Z',
				};
				state.subscriptionPortalSession = {
					provider: 'bc-subscriptions',
					bigCommerceCustomerEntityId: 42,
					providerCustomerId: 'provider-customer-one',
					sessionToken: 'server-only-portal-token',
					expiresAt: '2026-08-16T15:00:00.000Z',
				};
				return { state, value: true };
			},
		});
		const state = await loadCommerceSession(sessionId);
		expect(activeCustomerSession(state, Date.parse('2026-08-15T14:59:59.000Z'))?.customerEntityId).toBe(42);
		expect(activeCustomerSession(state, Date.parse('2026-08-15T15:00:00.000Z'))).toBeNull();
		clearExpiredCustomerSession(state, Date.parse('2026-08-15T15:00:00.000Z'));
		expect(state.customerSession).toBeNull();
		expect(state.subscriptionPortalSession).toBeNull();
	});

	it('rejects a reused key with a different operation fingerprint', async () => {
		const sessionId = crypto.randomUUID();
		await coordinateCommerceMutation({
			sessionId,
			idempotencyKey: 'request-1234',
			fingerprint: 'cart.add:7',
			execute: async (state) => ({ state, value: 'done' }),
		});
		await expect(
			coordinateCommerceMutation({
				sessionId,
				idempotencyKey: 'request-1234',
				fingerprint: 'cart.add:8',
				execute: async (state) => ({ state, value: 'must-not-run' }),
			}),
		).rejects.toBeInstanceOf(CommerceIdempotencyMismatchError);
	});

	it('serializes concurrent first mutations for one session', async () => {
		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const sessionId = crypto.randomUUID();
		const first = coordinateCommerceMutation({
			sessionId,
			idempotencyKey: 'request-1234',
			fingerprint: 'cart.add:7',
			execute: async (state) => {
				await gate;
				return { state, value: 'first' };
			},
		});
		await Promise.resolve();
		await expect(
			coordinateCommerceMutation({
				sessionId,
				idempotencyKey: 'request-5678',
				fingerprint: 'cart.update:1',
				execute: async (state) => ({ state, value: 'second' }),
			}),
		).rejects.toBeInstanceOf(CommerceOperationInProgressError);
		release();
		await expect(first).resolves.toMatchObject({ value: 'first' });
	});
});
