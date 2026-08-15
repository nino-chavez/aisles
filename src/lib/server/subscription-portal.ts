import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import type {
	SubscriptionChargeSummary,
	SubscriptionPortalActionInput,
	SubscriptionPortalDetail,
	SubscriptionPortalSummary,
} from '$lib/commerce/subscription-portal-contract';

const REQUEST_TIMEOUT_MS = 10_000;
const SESSION_SAFETY_TTL_MS = 29 * 24 * 60 * 60 * 1000;
const MAX_SUBSCRIPTIONS = 100;
const MAX_CHARGES = 20;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const INTERVALS = new Set(['day', 'week', 'month', 'year']);
const STATUSES = new Set(['active', 'paused', 'cancelled', 'past_due']);

export class SubscriptionPortalProviderError extends Error {
	constructor(
		message: string,
		readonly options: { status?: number; outcomeUnknown?: boolean } = {},
	) {
		super(message);
	}
}

export interface SubscriptionPortalSessionResult {
	sessionToken: string;
	providerCustomerId: string;
	expiresAt: string;
}

export interface SubscriptionPortalProvider {
	isConfigured(): boolean;
	exchangeCustomerSession(input: { customerEntityId: number; email: string }): Promise<SubscriptionPortalSessionResult>;
	listSubscriptions(sessionToken: string): Promise<SubscriptionPortalSummary[]>;
	getSubscription(sessionToken: string, subscriptionId: string): Promise<SubscriptionPortalDetail>;
	mutateSubscription(sessionToken: string, subscriptionId: string, input: SubscriptionPortalActionInput): Promise<void>;
}

export function createSubscriptionPortalProvider(platform?: App.Platform): SubscriptionPortalProvider {
	const binding = !dev ? platform?.env?.SUBS_API : undefined;
	const fallbackOrigin = dev && env.SUBS_API_ORIGIN ? validOrigin(env.SUBS_API_ORIGIN) : null;
	const storeHash = env.BIGCOMMERCE_STORE_HASH;
	const handoffSecret = env.SSO_HANDOFF_SECRET;

	async function request(path: string, init?: RequestInit): Promise<Response> {
		if (!binding && !fallbackOrigin) throw new SubscriptionPortalProviderError('Subscription portal binding is unavailable.');
		const target = new URL(path, fallbackOrigin ?? 'https://subscription.service.internal');
		try {
			return binding
				? await binding.fetch(new Request(target, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }))
				: await fetch(target, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
		} catch {
			throw new SubscriptionPortalProviderError('Subscription portal request failed.', {
				outcomeUnknown: init?.method !== undefined && init.method !== 'GET',
			});
		}
	}

	async function authorized(path: string, token: string, init?: RequestInit): Promise<Response> {
		return request(path, {
			...init,
			headers: {
				accept: 'application/json',
				Authorization: `Bearer ${token}`,
				...(init?.body ? { 'content-type': 'application/json' } : {}),
				...init?.headers,
			},
		});
	}

	return {
		isConfigured() {
			return Boolean(storeHash && handoffSecret && (binding || fallbackOrigin));
		},

		async exchangeCustomerSession(input) {
			if (!storeHash || !handoffSecret) throw new SubscriptionPortalProviderError('Subscription portal handoff is not configured.');
			const handoffToken = await signHandoff({
				store_hash: storeHash,
				bc_customer_id: input.customerEntityId,
				email: input.email,
			}, handoffSecret);
			const response = await request('/api/v1/portal/auth/exchange-bc-session', {
				method: 'POST',
				headers: { accept: 'application/json', 'content-type': 'application/json' },
				body: JSON.stringify({ handoff_token: handoffToken }),
			});
			if (!response.ok) throw providerResponseError(response, 'Subscription portal connection was not confirmed.');
			const body = await safeJson(response, true);
			if (!isRecord(body) || !validToken(body.session_token) || !validId(body.customer_id) || body.store_hash !== storeHash) {
				throw new SubscriptionPortalProviderError('Subscription provider returned an invalid portal session.', { outcomeUnknown: true });
			}
			return {
				sessionToken: body.session_token,
				providerCustomerId: body.customer_id,
				expiresAt: new Date(Date.now() + SESSION_SAFETY_TTL_MS).toISOString(),
			};
		},

		async listSubscriptions(sessionToken) {
			const response = await authorized('/api/v1/portal/subscriptions', sessionToken);
			if (!response.ok) throw providerResponseError(response, 'Subscription list was not confirmed.');
			const body = await safeJson(response);
			if (!isRecord(body) || !Array.isArray(body.subscriptions) || body.subscriptions.length > MAX_SUBSCRIPTIONS) {
				throw new SubscriptionPortalProviderError('Subscription provider returned an invalid list.');
			}
			return body.subscriptions.map(normalizeSummary);
		},

		async getSubscription(sessionToken, subscriptionId) {
			if (!validId(subscriptionId)) throw new SubscriptionPortalProviderError('Subscription identifier is invalid.');
			const [detailResponse, chargesResponse] = await Promise.all([
				authorized(`/api/v1/portal/subscriptions/${encodeURIComponent(subscriptionId)}`, sessionToken),
				authorized(`/api/v1/portal/subscriptions/${encodeURIComponent(subscriptionId)}/charges`, sessionToken),
			]);
			if (!detailResponse.ok) throw providerResponseError(detailResponse, 'Subscription detail was not confirmed.');
			if (!chargesResponse.ok) throw providerResponseError(chargesResponse, 'Subscription charges were not confirmed.');
			const [detailBody, chargesBody] = await Promise.all([safeJson(detailResponse), safeJson(chargesResponse)]);
			if (!isRecord(detailBody) || !isRecord(detailBody.subscription) || !isRecord(chargesBody) || !Array.isArray(chargesBody.charges) || chargesBody.charges.length > MAX_CHARGES) {
				throw new SubscriptionPortalProviderError('Subscription provider returned invalid detail.');
			}
			const summary = normalizeSummary(detailBody.subscription);
			return {
				...summary,
				cancelReason: nullableString(detailBody.subscription.cancel_reason, 500),
				charges: chargesBody.charges.map(normalizeCharge),
			};
		},

		async mutateSubscription(sessionToken, subscriptionId, input) {
			if (!validId(subscriptionId)) throw new SubscriptionPortalProviderError('Subscription identifier is invalid.');
			const path = `/api/v1/portal/subscriptions/${encodeURIComponent(subscriptionId)}/${input.action}`;
			const body = input.action === 'pause'
				? { weeks: input.weeks }
				: input.action === 'reschedule'
					? { next_charge_date: input.nextChargeDate }
					: {};
			const response = await authorized(path, sessionToken, {
				method: 'POST',
				body: JSON.stringify(body),
			});
			if (!response.ok) throw providerResponseError(response, 'Subscription change was not confirmed.', response.status >= 500);
			const result = await safeJson(response, true);
			if (!isRecord(result) || result.ok !== true) {
				throw new SubscriptionPortalProviderError('Subscription provider omitted mutation confirmation.', { outcomeUnknown: true });
			}
		},
	};
}

async function signHandoff(
	claims: { store_hash: string; bc_customer_id: number; email: string },
	secret: string,
): Promise<string> {
	const now = Math.floor(Date.now() / 1000);
	const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
	const payload = base64Url(JSON.stringify({ ...claims, iat: now, exp: now + 60 }));
	const unsigned = `${header}.${payload}`;
	const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(unsigned));
	return `${unsigned}.${base64Url(new Uint8Array(signature))}`;
}

function base64Url(value: string | Uint8Array): string {
	const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function normalizeSummary(value: unknown): SubscriptionPortalSummary {
	if (!isRecord(value)) throw new SubscriptionPortalProviderError('Subscription provider returned an invalid subscription.');
	const interval = requiredString(value.plan_interval, 16);
	const intervalCount = integer(value.plan_interval_count, 1, 365);
	const currencyCode = requiredString(value.plan_currency, 3).toUpperCase();
	if (!INTERVALS.has(interval) || !CURRENCY_PATTERN.test(currencyCode)) throw new SubscriptionPortalProviderError('Subscription provider returned invalid plan terms.');
	const statusValue = requiredString(value.status, 32);
	return {
		id: requiredId(value.id),
		status: STATUSES.has(statusValue) ? statusValue as SubscriptionPortalSummary['status'] : 'unknown',
		planId: requiredId(value.plan_id),
		planName: requiredString(value.plan_name, 240),
		recurringPrice: { value: integer(value.plan_amount_cents, 0, 100_000_000) / 100, currencyCode },
		cadence: cadence(interval, intervalCount),
		productEntityId: nullablePositiveInteger(value.bc_product_id),
		nextChargeAt: nullableDate(value.next_charge_at),
		currentPeriodEnd: requiredDate(value.current_period_end),
		createdAt: requiredDate(value.created_at),
		cancelledAt: nullableDate(value.cancelled_at),
		cyclesCompleted: integer(value.cycles_completed, 0, 100_000),
		prepaidCyclesTotal: nullableNonnegativeInteger(value.prepaid_cycles_total),
		prepaidCyclesRemaining: nullableNonnegativeInteger(value.prepaid_cycles_remaining),
	};
}

function normalizeCharge(value: unknown): SubscriptionChargeSummary {
	if (!isRecord(value)) throw new SubscriptionPortalProviderError('Subscription provider returned an invalid charge.');
	const currencyCode = requiredString(value.currency, 3).toUpperCase();
	if (!CURRENCY_PATTERN.test(currencyCode)) throw new SubscriptionPortalProviderError('Subscription provider returned an invalid charge currency.');
	return {
		id: requiredId(value.id),
		amount: { value: integer(value.amount_cents, 0, 100_000_000) / 100, currencyCode },
		status: requiredString(value.status, 40),
		scheduledAt: requiredDate(value.scheduled_at),
		attemptedAt: nullableDate(value.attempted_at),
		succeededAt: nullableDate(value.succeeded_at),
	};
}

function providerResponseError(response: Response, message: string, outcomeUnknown = false): SubscriptionPortalProviderError {
	return new SubscriptionPortalProviderError(message, { status: response.status, outcomeUnknown });
}

async function safeJson(response: Response, outcomeUnknown = false): Promise<unknown> {
	try {
		return await response.json();
	} catch {
		throw new SubscriptionPortalProviderError('Subscription provider returned invalid JSON.', {
			outcomeUnknown: outcomeUnknown && response.ok && response.type !== 'error',
		});
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validToken(value: unknown): value is string {
	return typeof value === 'string' && value.length >= 20 && value.length <= 8192;
}

function validId(value: unknown): value is string {
	return typeof value === 'string' && ID_PATTERN.test(value);
}

function requiredId(value: unknown): string {
	if (!validId(value)) throw new SubscriptionPortalProviderError('Subscription provider returned an invalid identifier.');
	return value;
}

function requiredString(value: unknown, maxLength: number): string {
	if (typeof value !== 'string' || value.length < 1 || value.length > maxLength) throw new SubscriptionPortalProviderError('Subscription provider returned an invalid field.');
	return value;
}

function nullableString(value: unknown, maxLength: number): string | null {
	if (value === null || value === undefined) return null;
	return requiredString(value, maxLength);
}

function integer(value: unknown, minimum: number, maximum: number): number {
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) throw new SubscriptionPortalProviderError('Subscription provider returned an invalid number.');
	return parsed;
}

function nullablePositiveInteger(value: unknown): number | null {
	if (value === null || value === undefined) return null;
	return integer(value, 1, Number.MAX_SAFE_INTEGER);
}

function nullableNonnegativeInteger(value: unknown): number | null {
	if (value === null || value === undefined) return null;
	return integer(value, 0, 100_000);
}

function requiredDate(value: unknown): string {
	if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new SubscriptionPortalProviderError('Subscription provider returned an invalid date.');
	return value;
}

function nullableDate(value: unknown): string | null {
	if (value === null || value === undefined) return null;
	return requiredDate(value);
}

function cadence(interval: string, count: number): string {
	const unit = count === 1 ? interval : `${interval}s`;
	return count === 1 ? `Every ${unit}` : `Every ${count} ${unit}`;
}

function validOrigin(value: string): string {
	const url = new URL(value);
	if (url.protocol !== 'https:' && url.hostname !== 'localhost') throw new SubscriptionPortalProviderError('Subscription portal origin must use HTTPS.');
	return url.origin;
}
