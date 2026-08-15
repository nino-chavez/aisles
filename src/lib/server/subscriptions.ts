import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import type { SubscriptionInterval, SubscriptionPlan } from '$lib/commerce/subscription-contract';

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_PLANS = 10;
const PLAN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;
const LINE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const INTERVALS = new Set<SubscriptionInterval>(['day', 'week', 'month', 'year']);
const SALES_MODES = new Set<SubscriptionPlan['salesMode']>(['subscription_only', 'subscribe_and_one_time']);

export class SubscriptionProviderError extends Error {
	constructor(
		message: string,
		readonly options: { status?: number; outcomeUnknown?: boolean } = {},
	) {
		super(message);
	}
}

export interface SubscriptionProvider {
	listPlans(productEntityId: number): Promise<SubscriptionPlan[]>;
	listCartIntents(cartEntityId: string): Promise<Record<string, CartSubscriptionIntent>>;
	getCartIntent(cartEntityId: string, lineEntityId: string): Promise<string | null>;
	createCartIntent(cartEntityId: string, lineEntityId: string, planId: string): Promise<void>;
}

export interface CartSubscriptionIntent {
	planId: string;
	name: string;
	cadence: string;
	recurringPrice: { value: number; currencyCode: string };
}

export function createSubscriptionProvider(platform?: App.Platform): SubscriptionProvider {
	const binding = !dev ? platform?.env?.SUBS_API : undefined;
	const fallbackOrigin = dev && env.SUBS_API_ORIGIN ? validOrigin(env.SUBS_API_ORIGIN) : null;
	const storeHash = env.BIGCOMMERCE_STORE_HASH;
	const channelId = positiveInteger(env.BIGCOMMERCE_CHANNEL_ID);

	async function request(path: string, init?: RequestInit): Promise<Response> {
		if (!storeHash) throw new SubscriptionProviderError('Subscription store mapping is unavailable.');
		if (!binding && !fallbackOrigin) throw new SubscriptionProviderError('Subscription service binding is unavailable.');
		const origin = fallbackOrigin ?? 'https://subscription.service.internal';
		const target = new URL(path, origin);
		target.searchParams.set('store_hash', storeHash);
		if (channelId) target.searchParams.set('channel_id', String(channelId));
		const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
		try {
			return binding
				? await binding.fetch(new Request(target, { ...init, signal }))
				: await fetch(target, { ...init, signal });
		} catch {
			throw new SubscriptionProviderError('Subscription provider request failed.', {
				outcomeUnknown: init?.method === 'POST',
			});
		}
	}

	return {
		async listPlans(productEntityId) {
			const response = await request(`/api/v1/storefront/plans?bc_product_id=${productEntityId}`);
			if (!response.ok) throw new SubscriptionProviderError('Subscription plan lookup failed.', { status: response.status });
			const body = await safeJson(response);
			if (!isRecord(body) || !Array.isArray(body.plans) || body.plans.length > MAX_PLANS) {
				throw new SubscriptionProviderError('Subscription provider returned an invalid plan list.');
			}
			return body.plans.map((value) => normalizePlan(value, productEntityId));
		},

		async listCartIntents(cartEntityId) {
			if (!cartEntityId) throw new SubscriptionProviderError('Subscription cart identifier is invalid.');
			const response = await request(`/api/v1/storefront/cart/${encodeURIComponent(cartEntityId)}/intents`);
			if (!response.ok) throw new SubscriptionProviderError('Subscription intent lookup failed.', { status: response.status });
			const body = await safeJson(response);
			if (!isRecord(body) || !isRecord(body.intents) || Object.keys(body.intents).length > 100) {
				throw new SubscriptionProviderError('Subscription provider returned an invalid intent list.');
			}
			return Object.fromEntries(Object.entries(body.intents).map(([lineId, value]) => {
				if (!LINE_ID_PATTERN.test(lineId) || !isRecord(value)) throw new SubscriptionProviderError('Subscription provider returned an invalid cart intent.');
				const planId = stringField(value, 'id', 128);
				const name = stringField(value, 'name', 240);
				const interval = value.interval;
				const intervalCount = positiveNumberField(value, 'interval_count', 365);
				const amountCents = nonnegativeNumberField(value, 'amount_cents', 100_000_000);
				const currencyCode = stringField(value, 'currency', 3).toUpperCase();
				if (!PLAN_ID_PATTERN.test(planId) || !INTERVALS.has(interval as SubscriptionInterval) || !/^[A-Z]{3}$/.test(currencyCode)) {
					throw new SubscriptionProviderError('Subscription provider returned an invalid cart intent.');
				}
				const unit = intervalCount === 1 ? interval : `${interval}s`;
				return [lineId, {
					planId,
					name,
					cadence: intervalCount === 1 ? `Every ${unit}` : `Every ${intervalCount} ${unit}`,
					recurringPrice: { value: amountCents / 100, currencyCode },
				} satisfies CartSubscriptionIntent];
			}));
		},

		async getCartIntent(cartEntityId, lineEntityId) {
			if (!cartEntityId || !LINE_ID_PATTERN.test(lineEntityId)) throw new SubscriptionProviderError('Subscription intent identifiers are invalid.');
			const response = await request(`/api/v1/storefront/cart/${encodeURIComponent(cartEntityId)}/intents`);
			if (!response.ok) throw new SubscriptionProviderError('Subscription intent lookup failed.', { status: response.status });
			const body = await safeJson(response);
			if (!isRecord(body) || !isRecord(body.intents)) throw new SubscriptionProviderError('Subscription provider returned an invalid intent list.');
			const intent = body.intents[lineEntityId];
			if (intent === undefined) return null;
			if (!isRecord(intent) || typeof intent.id !== 'string' || !PLAN_ID_PATTERN.test(intent.id)) {
				throw new SubscriptionProviderError('Subscription provider returned an invalid cart intent.');
			}
			return intent.id;
		},

		async createCartIntent(cartEntityId, lineEntityId, planId) {
			if (!cartEntityId || !LINE_ID_PATTERN.test(lineEntityId) || !PLAN_ID_PATTERN.test(planId)) {
				throw new SubscriptionProviderError('Subscription intent identifiers are invalid.');
			}
			const response = await request(`/api/v1/storefront/cart/${encodeURIComponent(cartEntityId)}/intents`, {
				method: 'POST',
				headers: { accept: 'application/json', 'content-type': 'application/json' },
				body: JSON.stringify({ cart_line_id: lineEntityId, plan_id: planId }),
			});
			if (!response.ok) {
				throw new SubscriptionProviderError('Subscription provider did not confirm the cart intent.', {
					status: response.status,
					outcomeUnknown: response.status >= 500,
				});
			}
			const body = await safeJson(response);
			if (!isRecord(body) || !isRecord(body.intents) || !Object.hasOwn(body.intents, lineEntityId)) {
				throw new SubscriptionProviderError('Subscription provider omitted the confirmed cart intent.', { outcomeUnknown: true });
			}
			const confirmed = body.intents[lineEntityId];
			if (!isRecord(confirmed) || confirmed.id !== planId) {
				throw new SubscriptionProviderError('Subscription provider confirmed a different plan.', { outcomeUnknown: true });
			}
		},
	};
}

function normalizePlan(value: unknown, expectedProductEntityId?: number): SubscriptionPlan {
	if (!isRecord(value)) throw new SubscriptionProviderError('Subscription provider returned an invalid plan.');
	const id = stringField(value, 'id', 128);
	const name = stringField(value, 'name', 240);
	const productEntityId = expectedProductEntityId ?? positiveNumberField(value, 'bc_product_id');
	const interval = value.interval;
	const intervalCount = positiveNumberField(value, 'interval_count', 365);
	const amountCents = nonnegativeNumberField(value, 'amount_cents', 100_000_000);
	const currency = stringField(value, 'currency', 3).toUpperCase();
	const salesMode = value.sales_mode ?? 'subscribe_and_one_time';
	const trialDays = optionalNonnegativeNumberField(value, 'trial_days', 3650);
	const commitmentCycles = optionalNonnegativeNumberField(value, 'commitment_cycles', 1200);
	if (!PLAN_ID_PATTERN.test(id) || !INTERVALS.has(interval as SubscriptionInterval) || !SALES_MODES.has(salesMode as SubscriptionPlan['salesMode']) || !/^[A-Z]{3}$/.test(currency)) {
		throw new SubscriptionProviderError('Subscription provider returned an invalid plan.');
	}
	if (expectedProductEntityId !== undefined && 'bc_product_id' in value && Number(value.bc_product_id) !== expectedProductEntityId) {
		throw new SubscriptionProviderError('Subscription plan product mapping is invalid.');
	}
	return {
		id,
		productEntityId,
		name,
		interval: interval as SubscriptionInterval,
		intervalCount,
		price: { value: amountCents / 100, currencyCode: currency },
		salesMode: salesMode as SubscriptionPlan['salesMode'],
		trialDays,
		commitmentCycles,
	};
}

async function safeJson(response: Response): Promise<unknown> {
	try {
		return await response.json();
	} catch {
		throw new SubscriptionProviderError('Subscription provider returned invalid JSON.', {
			outcomeUnknown: response.status >= 200 && response.status < 300,
		});
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringField(record: Record<string, unknown>, field: string, maxLength: number): string {
	const value = record[field];
	if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) throw new SubscriptionProviderError('Subscription provider returned an invalid plan.');
	return value;
}

function positiveNumberField(record: Record<string, unknown>, field: string, maximum = Number.MAX_SAFE_INTEGER): number {
	const value = Number(record[field]);
	if (!Number.isInteger(value) || value < 1 || value > maximum) throw new SubscriptionProviderError('Subscription provider returned an invalid plan.');
	return value;
}

function nonnegativeNumberField(record: Record<string, unknown>, field: string, maximum: number): number {
	const value = Number(record[field]);
	if (!Number.isInteger(value) || value < 0 || value > maximum) throw new SubscriptionProviderError('Subscription provider returned an invalid plan.');
	return value;
}

function optionalNonnegativeNumberField(record: Record<string, unknown>, field: string, maximum: number): number {
	return record[field] === undefined || record[field] === null ? 0 : nonnegativeNumberField(record, field, maximum);
}

function positiveInteger(value: string | undefined): number | null {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function validOrigin(value: string): string {
	const url = new URL(value);
	if (url.protocol !== 'https:' && url.hostname !== 'localhost') throw new SubscriptionProviderError('Subscription service origin must use HTTPS.');
	return url.origin;
}
