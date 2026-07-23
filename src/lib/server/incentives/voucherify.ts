/**
 * Voucherify adapter — calls /v1/validations and maps the response to UIP.
 *
 * Scope (Phase 4a): code-driven promotions only. Auto-applied brand rules
 * (free-shipping thresholds, config-based tiers) continue to come from the
 * stub and are merged in. Loyalty wallets remain stub-sourced until Phase 4b.
 *
 * Failure mode: network error, non-2xx, or >500ms timeout → fall back to stub.
 * We never let the cart response block on the incentives engine.
 */

import type { IncentivesEvaluator, IncentivesContext } from './index';
import type { Discount, IncentivesPayload, PromotionCode } from '$lib/schema/uip';
import { evaluateStub } from './stub';

const TIMEOUT_MS = 500;

interface VoucherifyDiscount {
	type: 'AMOUNT' | 'PERCENT' | 'FIXED' | 'UNIT' | string;
	effect: string;
	amount_off?: number;
	percent_off?: number;
	is_dynamic?: boolean;
}

interface VoucherifyOrder {
	amount: number;
	discount_amount: number;
	total_amount: number;
}

export interface VoucherifyRedeemable {
	status: string;
	id: string;
	object: 'voucher' | 'campaign' | 'promotion_tier' | 'loyalty_card' | string;
	order?: VoucherifyOrder;
	result?: { discount?: VoucherifyDiscount };
	metadata?: { name?: string } & Record<string, unknown>;
	error?: { code: string; message: string };
}

export interface VoucherifyValidation {
	id: string;
	valid: boolean;
	redeemables: VoucherifyRedeemable[];
	order: VoucherifyOrder;
}

interface VoucherifyCredentials {
	apiUrl: string;
	appId: string;
	secretKey: string;
}

function readCredentials(): VoucherifyCredentials | null {
	const appId = process.env.VOUCHERIFY_APP_ID;
	const secretKey = process.env.VOUCHERIFY_SECRET_KEY;
	const apiUrl = process.env.VOUCHERIFY_API_URL ?? 'https://api.voucherify.io';
	if (!appId || !secretKey) return null;
	return { apiUrl, appId, secretKey };
}

export function voucherifyConfigured(): boolean {
	return readCredentials() !== null;
}

async function callValidations(
	body: unknown,
	creds: VoucherifyCredentials,
): Promise<VoucherifyValidation | null> {
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
	try {
		const res = await fetch(`${creds.apiUrl}/v1/validations`, {
			method: 'POST',
			signal: ctrl.signal,
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
				'x-app-id': creds.appId,
				'x-app-token': creds.secretKey,
			},
			body: JSON.stringify(body),
		});
		if (!res.ok) {
			console.warn(`Voucherify /validations returned ${res.status}`);
			return null;
		}
		return (await res.json()) as VoucherifyValidation;
	} catch (err) {
		console.warn('Voucherify /validations call failed:', err instanceof Error ? err.message : err);
		return null;
	} finally {
		clearTimeout(timer);
	}
}

// ─── Response → UIP mapping (pure) ──────────────────────────────────

export function mapEffectToTarget(effect: string): Discount['target'] {
	switch (effect) {
		case 'APPLY_TO_ORDER':
			return 'cart';
		case 'APPLY_TO_ITEMS':
		case 'APPLY_TO_ITEMS_BY_QUANTITY':
		case 'APPLY_TO_CHEAPEST':
		case 'APPLY_TO_MOST_EXPENSIVE':
			return 'item';
		case 'ADD_FREE_SHIPPING':
		case 'ADD_FREE_SHIPPING_ITEM':
			return 'additional_cost';
		default:
			return 'cart';
	}
}

export function redeemableToCode(r: VoucherifyRedeemable): PromotionCode {
	// Voucherify's 'voucher' bucket covers coupons AND gift cards; loyalty cards are distinct.
	const type: PromotionCode['type'] =
		r.object === 'loyalty_card' ? 'giftcard' : r.metadata?.referral_code ? 'referral' : 'coupon';
	return { type, code: r.id };
}

export function redeemableToDiscount(r: VoucherifyRedeemable): Discount | null {
	if (r.status !== 'APPLICABLE' || !r.result?.discount) return null;
	const d = r.result.discount;
	const amount = d.amount_off ?? r.order?.discount_amount ?? 0;
	if (amount <= 0) return null;
	return {
		title: r.metadata?.name ?? r.id,
		target: mapEffectToTarget(d.effect),
		amount,
		code: r.id,
	};
}

export function mapValidationToPayload(
	validation: VoucherifyValidation,
	ctx: IncentivesContext,
): IncentivesPayload {
	const codes: PromotionCode[] = [];
	const discounts: Discount[] = [];
	for (const r of validation.redeemables ?? []) {
		codes.push(redeemableToCode(r));
		const d = redeemableToDiscount(r);
		if (d) discounts.push(d);
	}

	// Merge stub-sourced non-code rules (e.g., brand free-shipping threshold).
	const stub = evaluateStub(ctx);
	const stubNonCodeDiscounts = (stub.promotions.discounts ?? []).filter((d) => !d.code);
	const allDiscounts = [...discounts, ...stubNonCodeDiscounts];

	return {
		promotions: {
			...(codes.length > 0 && { codes }),
			...(allDiscounts.length > 0 && { discounts: allDiscounts }),
		},
		// Phase 4b will source loyalty from Voucherify loyalty campaigns; for now, keep stub output.
		loyalty: stub.loyalty,
	};
}

// ─── Evaluator ──────────────────────────────────────────────────────

export const voucherifyEvaluator: IncentivesEvaluator = {
	async evaluate(ctx: IncentivesContext): Promise<IncentivesPayload> {
		const creds = readCredentials();
		// No creds or no codes to validate → fall through to stub-only behavior.
		if (!creds || ctx.appliedCodes.length === 0) {
			return evaluateStub(ctx);
		}

		const body = {
			redeemables: ctx.appliedCodes.map((code) => ({ object: 'voucher', id: code })),
			order: { amount: ctx.subtotalMinor },
			...(ctx.membership && { customer: { source_id: ctx.membership.id } }),
		};

		const validation = await callValidations(body, creds);
		if (!validation) return evaluateStub(ctx);

		return mapValidationToPayload(validation, ctx);
	},
};
