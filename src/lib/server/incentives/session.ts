/**
 * Session-level incentives helper.
 *
 * One place to: read the cart, read applied codes from cookies, run the
 * evaluator, populate the signal store's loyalty context, and derive the
 * prompt-ready shape. Used by both the cart API (POST/GET /api/cart) and
 * the page loaders (category, search) so inference and the layout prompt
 * see the same loyalty snapshot.
 */

import type { Cookies } from '@sveltejs/kit';
import type { SignalStore } from '$lib/signals/store';
import type { IncentivesPromptContext } from '$lib/server/layout-prompt';
import type { IncentivesPayload } from '$lib/schema/uip';
import { EMPTY_INCENTIVES } from '$lib/schema/uip';
import { getBrand } from '$lib/brand/config';
import { getCart } from '$lib/server/bigcommerce';
import { defaultEvaluator, type IncentivesContext } from './index';

const CODES_COOKIE = 'aisles_applied_codes';

export function readAppliedCodes(cookies: Cookies): string[] {
	const raw = cookies.get(CODES_COOKIE);
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === 'string') : [];
	} catch {
		return [];
	}
}

export function writeAppliedCodes(cookies: Cookies, codes: string[]) {
	cookies.set(CODES_COOKIE, JSON.stringify(codes), {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 30,
	});
}

function toMinor(dollars: number): number {
	return Math.round(dollars * 100);
}

type BCCart = NonNullable<Awaited<ReturnType<typeof getCart>>>;

export function buildIncentivesContext(cart: BCCart | null, appliedCodes: string[]): IncentivesContext {
	const brand = getBrand();
	const lineItems = (cart?.lineItems.physicalItems ?? []).map((item, idx) => ({
		path: `$.cart.line_items[${idx}]`,
		productEntityId: item.productEntityId,
		quantity: item.quantity,
		unitPriceMinor: toMinor(item.salePrice.value),
	}));
	const subtotalMinor = lineItems.reduce(
		(sum, item) => sum + item.unitPriceMinor * item.quantity,
		0,
	);
	return {
		brand,
		lineItems,
		subtotalMinor,
		appliedCodes,
		membership: null,
	};
}

export function derivePromptContext(
	payload: IncentivesPayload,
	appliedCodes: string[],
): IncentivesPromptContext | undefined {
	const program = payload.loyalty.programs?.[0];
	const wallet = program?.wallets?.[0];
	const hasLoyalty = Boolean(wallet);
	const hasCodes = appliedCodes.length > 0;
	if (!hasLoyalty && !hasCodes) return undefined;

	return {
		walletBalanceMinor: wallet?.balances.active ?? 0,
		walletUnit: wallet?.unit,
		tierCurrent: wallet?.tier?.current,
		tierNext: wallet?.tier?.next,
		tierUnitsToNext: wallet?.tier?.units_to_next ?? null,
		appliedCodes: hasCodes ? appliedCodes : undefined,
	};
}

export interface SessionIncentives {
	payload: IncentivesPayload;
	promptContext: IncentivesPromptContext | undefined;
	appliedCodes: string[];
}

/**
 * Resolve the current session's incentives once and pipe loyalty into the
 * signal store. Safe to call on every page load — short-circuits to an empty
 * payload when there's no cart and no codes to validate.
 */
export async function loadSessionIncentives(
	store: SignalStore,
	cookies: Cookies,
): Promise<SessionIncentives> {
	const appliedCodes = readAppliedCodes(cookies);
	const cartId = cookies.get('bc_cart_id');

	if (!cartId && appliedCodes.length === 0) {
		return { payload: EMPTY_INCENTIVES, promptContext: undefined, appliedCodes };
	}

	let cart: BCCart | null = null;
	if (cartId) {
		try {
			cart = await getCart(cartId);
		} catch {
			cart = null;
		}
	}

	let payload: IncentivesPayload = EMPTY_INCENTIVES;
	try {
		payload = await defaultEvaluator.evaluate(buildIncentivesContext(cart, appliedCodes));
	} catch (err) {
		console.warn('loadSessionIncentives: evaluator failed, using empty payload:', err);
	}

	const wallet = payload.loyalty.programs?.[0]?.wallets?.[0];
	store.setLoyaltyContext({
		walletBalanceMinor: wallet?.balances.active ?? 0,
		tierUnitsToNext: wallet?.tier?.units_to_next ?? null,
	});

	const promptContext = derivePromptContext(payload, appliedCodes);

	// Emit a signal event so the Observe panel has a snapshot of the session's
	// incentive state without needing to replay the evaluator. Only when we
	// actually have content — keeps the signal log uncluttered for guests.
	const hasContent =
		(payload.promotions.codes?.length ?? 0) > 0 ||
		(payload.promotions.discounts?.length ?? 0) > 0 ||
		(payload.loyalty.programs?.length ?? 0) > 0;
	if (hasContent) {
		store.emit('commerce.tier_progress_view', 'commerce', {
			appliedCodes,
			codes: payload.promotions.codes ?? [],
			discounts: payload.promotions.discounts ?? [],
			wallet: wallet
				? {
						unit: wallet.unit,
						balanceActive: wallet.balances.active,
						tierCurrent: wallet.tier?.current ?? null,
						tierNext: wallet.tier?.next ?? null,
						unitsToNext: wallet.tier?.units_to_next ?? null,
					}
				: null,
			programName: payload.loyalty.programs?.[0]?.name ?? null,
		});
	}

	return { payload, promptContext, appliedCodes };
}
