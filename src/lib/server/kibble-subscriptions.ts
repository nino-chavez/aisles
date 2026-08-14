import { env } from '$env/dynamic/private';

/**
 * Safe storefront projection of the bc-subscriptions Plan contract.
 * Keep provider-specific fields out of page data unless a future slice needs
 * them for a named, reviewed surface.
 */
export type KibbleSubscriptionPlan = {
	id: string;
	name: string;
	bcProductId: number;
	amountCents: number;
	currency: string;
	interval: 'day' | 'week' | 'month' | 'year';
	intervalCount: number;
	salesMode: 'subscribe_only' | 'subscribe_and_one_time' | 'one_time_only';
	discountPct: number | null;
	trialDays: number | null;
	commitmentCycles: number | null;
};

export type KibbleSubscriptionIntent = {
	id: string;
	name: string;
	interval: 'day' | 'week' | 'month' | 'year';
	intervalCount: number;
	amountCents: number;
	currency: string;
	cycles?: number;
};

type KibbleSubscriptionIntentResponse = {
	cart_id: string;
	intents: Record<string, {
		id: string;
		name: string;
		interval: 'day' | 'week' | 'month' | 'year';
		interval_count: number;
		amount_cents: number;
		currency: string;
		cycles?: number;
	}>;
};

type FetchOptions = {
	fetchImpl?: typeof fetch;
};

type IntentWriteOptions = FetchOptions & {
	cadence?: KibbleSubscriptionIntent['interval'];
	intervalCount?: number;
};

export class KibbleSubscriptionError extends Error {
	readonly status: number;
	readonly kind: 'configuration' | 'provider' | 'validation' | 'conflict';

	constructor(message: string, status = 502, kind: KibbleSubscriptionError['kind'] = 'provider') {
		super(message);
		this.name = 'KibbleSubscriptionError';
		this.status = status;
		this.kind = kind;
	}
}

function getServiceConfig(): { origin: string; storeHash: string } {
	const origin = env.KIBBLE_SUBSCRIPTION_API_URL?.trim();
	const storeHash = env.BIGCOMMERCE_STORE_HASH?.trim();
	if (!origin || !storeHash) throw new KibbleSubscriptionError('Subscription service is not configured.', 503, 'configuration');
	let parsed: URL;
	try {
		parsed = new URL(origin);
	} catch {
		throw new KibbleSubscriptionError('Subscription service is not configured.', 503, 'configuration');
	}
	if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
		throw new KibbleSubscriptionError('Subscription service is not configured.', 503, 'configuration');
	}
	return { origin: parsed.toString().replace(/\/+$/, ''), storeHash };
}

function serviceUrl(origin: string, path: string, params: Record<string, string>): string {
	const url = new URL(`${origin}${path}`);
	for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
	return url.toString();
}

function safeString(value: unknown, maxLength: number): string | null {
	return typeof value === 'string' && value.length > 0 && value.length <= maxLength ? value : null;
}

function safeInteger(value: unknown, min = 0): number | null {
	return typeof value === 'number' && Number.isInteger(value) && value >= min ? value : null;
}

function parsePlan(value: unknown, productEntityId: number): KibbleSubscriptionPlan | null {
	if (!value || typeof value !== 'object') return null;
	const raw = value as Record<string, unknown>;
	const id = safeString(raw.id, 128);
	const name = safeString(raw.name, 160);
	const bcProductId = safeInteger(raw.bc_product_id, 1);
	const amountCents = safeInteger(raw.amount_cents, 0);
	const currency = safeString(raw.currency, 3)?.toUpperCase() ?? null;
	const interval = raw.interval;
	const intervalCount = safeInteger(raw.interval_count, 1);
	if (!id || !name || bcProductId !== productEntityId || raw.status !== 'active' || raw.accepting_new_subscribers !== true || amountCents === null || !currency || !/^[A-Z]{3}$/.test(currency) || !['day', 'week', 'month', 'year'].includes(String(interval)) || intervalCount === null) return null;
	const salesMode = ['subscribe_only', 'subscribe_and_one_time', 'one_time_only'].includes(String(raw.sales_mode)) ? raw.sales_mode as KibbleSubscriptionPlan['salesMode'] : 'subscribe_and_one_time';
	const discountPct = raw.discount_pct === null || raw.discount_pct === undefined ? null : safeInteger(raw.discount_pct, 0);
	const trialDays = raw.trial_days === null || raw.trial_days === undefined ? null : safeInteger(raw.trial_days, 0);
	const commitmentCycles = raw.commitment_cycles === null || raw.commitment_cycles === undefined ? null : safeInteger(raw.commitment_cycles, 0);
	return { id, name, bcProductId, amountCents, currency, interval: interval as KibbleSubscriptionPlan['interval'], intervalCount, salesMode, discountPct, trialDays, commitmentCycles };
}

function parseIntent(value: KibbleSubscriptionIntentResponse['intents'][string] | undefined): KibbleSubscriptionIntent | null {
	if (!value) return null;
	const id = safeString(value.id, 128);
	const name = safeString(value.name, 160);
	const amountCents = safeInteger(value.amount_cents, 0);
	const currency = safeString(value.currency, 3)?.toUpperCase() ?? null;
	const intervalCount = safeInteger(value.interval_count, 1);
	const cycles = value.cycles === undefined ? undefined : safeInteger(value.cycles, 2);
	if (!id || !name || amountCents === null || !currency || !/^[A-Z]{3}$/.test(currency) || !['day', 'week', 'month', 'year'].includes(value.interval) || intervalCount === null || (value.cycles !== undefined && cycles === null)) return null;
	return { id, name, interval: value.interval, intervalCount, amountCents, currency, ...(cycles === undefined || cycles === null ? {} : { cycles }) };
}

async function subscriptionRequest<T>(path: string, init: RequestInit, options: FetchOptions): Promise<T> {
	const request = options.fetchImpl ?? fetch;
	const response = await request(path, {
		...init,
		headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
	});
	if (!response.ok) {
		const kind = response.status === 409 ? 'conflict' : response.status >= 400 && response.status < 500 ? 'validation' : 'provider';
		throw new KibbleSubscriptionError(kind === 'conflict' ? 'Subscription intent changed. Refresh the cart and try again.' : 'Subscription service rejected the request.', response.status === 409 ? 409 : response.status >= 500 ? 502 : 400, kind);
	}
	try {
		return await response.json() as T;
	} catch {
		throw new KibbleSubscriptionError('Subscription service returned an invalid response.');
	}
}

/**
 * Verified against the internal bc-subscriptions public storefront contract:
 * `apps/api/src/openapi/routes-public.ts` and `apps/api/src/routes/plans.ts`
 * in the pinned reference repository. The service owns plan eligibility and
 * pricing; Aisles only returns a bounded presentation projection.
 */
export async function getKibbleSubscriptionPlans(productEntityId: number, options: FetchOptions = {}): Promise<KibbleSubscriptionPlan[]> {
	if (!Number.isInteger(productEntityId) || productEntityId < 1) throw new KibbleSubscriptionError('Invalid subscription product.', 400, 'validation');
	const { origin, storeHash } = getServiceConfig();
	const data = await subscriptionRequest<{ plans?: unknown[] }>(
		serviceUrl(origin, '/api/v1/storefront/plans', { store_hash: storeHash, bc_product_id: String(productEntityId) }),
		{ method: 'GET' },
		options,
	);
	if (!Array.isArray(data.plans)) throw new KibbleSubscriptionError('Subscription service returned an invalid plan list.');
	return data.plans.map((plan) => parsePlan(plan, productEntityId)).filter((plan): plan is KibbleSubscriptionPlan => plan !== null && plan.salesMode !== 'one_time_only');
}

/**
 * The intent route resolves `plan_id` to the shared intent shape consumed by
 * the order-created reconciler. It writes through bc-subscriptions rather than
 * directly calling BigCommerce. BigCommerce documents cart metafields as
 * server-managed metadata, with REST Management and Storefront GraphQL access:
 * https://docs.bigcommerce.com/developer/docs/admin/checkout-and-cart/metafields-api-guides
 */
export async function setKibbleCartSubscriptionIntent(cartId: string, lineEntityId: string, planId: string, options: IntentWriteOptions = {}): Promise<KibbleSubscriptionIntent> {
	if (!cartId || cartId.length > 128 || !lineEntityId || lineEntityId.length > 128 || !planId || planId.length > 128) throw new KibbleSubscriptionError('Invalid subscription intent.', 400, 'validation');
	const { origin, storeHash } = getServiceConfig();
	const cadence = options.cadence;
	const intervalCount = options.intervalCount;
	if (!cadence || typeof intervalCount !== 'number' || !Number.isInteger(intervalCount) || intervalCount < 1) throw new KibbleSubscriptionError('Invalid subscription intent.', 400, 'validation');
	const data = await subscriptionRequest<KibbleSubscriptionIntentResponse>(
		serviceUrl(origin, `/api/v1/storefront/cart/${encodeURIComponent(cartId)}/intents`, { store_hash: storeHash }),
		{ method: 'POST', body: JSON.stringify({ lineEntityId, plan_id: planId, cadence, interval_count: intervalCount }) },
		options,
	);
	if (data.cart_id !== cartId) throw new KibbleSubscriptionError('Subscription service returned the wrong cart.');
	const intent = parseIntent(data.intents?.[lineEntityId]);
	if (!intent) throw new KibbleSubscriptionError('Subscription service did not confirm the selected plan.');
	return intent;
}

export async function getKibbleCartSubscriptionIntents(cartId: string, options: FetchOptions = {}): Promise<Record<string, KibbleSubscriptionIntent>> {
	if (!cartId || cartId.length > 128) throw new KibbleSubscriptionError('Invalid cart.', 400, 'validation');
	const { origin, storeHash } = getServiceConfig();
	const data = await subscriptionRequest<KibbleSubscriptionIntentResponse>(
		serviceUrl(origin, `/api/v1/storefront/cart/${encodeURIComponent(cartId)}/intents`, { store_hash: storeHash }),
		{ method: 'GET' },
		options,
	);
	if (data.cart_id !== cartId || !data.intents || typeof data.intents !== 'object') throw new KibbleSubscriptionError('Subscription service returned an invalid intent map.');
	return Object.fromEntries(Object.entries(data.intents).flatMap(([lineId, raw]) => {
		const intent = parseIntent(raw);
		return intent ? [[lineId, intent]] : [];
	}));
}
