/**
 * Stub evaluator — reads brand.incentives config and emits UIP payloads.
 *
 * No external calls. Used as the default in dev and as the fallback when
 * the Voucherify adapter is unavailable. Rules here are intentionally simple;
 * real promotion logic lives in the external engine.
 */

import type { IncentivesContext } from './index';
import type { IncentivesPayload, Discount } from '$lib/schema/uip';

export function evaluateStub(ctx: IncentivesContext): IncentivesPayload {
	const { brand, subtotalMinor, lineItems, appliedCodes, membership } = ctx;
	const cfg = brand.incentives;

	const discounts: Discount[] = [];
	const codes = appliedCodes.map((code) => ({ type: 'coupon' as const, code }));

	if (cfg?.freeShippingThresholdMinor != null && subtotalMinor >= cfg.freeShippingThresholdMinor) {
		discounts.push({
			title: 'Free shipping',
			target: 'additional_cost',
			amount: 0,
		});
	}

	const payload: IncentivesPayload = {
		promotions: {
			...(codes.length > 0 && { codes }),
			...(discounts.length > 0 && { discounts }),
		},
		loyalty: {},
	};

	if (membership && cfg?.loyalty) {
		payload.loyalty = {
			memberships: [membership],
			programs: [
				{
					id: cfg.loyalty.programId,
					name: cfg.loyalty.programName,
					membership: '$.loyalty.memberships[0]',
					wallets: [
						{
							id: `${cfg.loyalty.programId}-main`,
							unit: cfg.loyalty.unit,
							balances: { active: 0, pending: 0, total: 0 },
							...(cfg.loyalty.tiers && {
								tier: {
									current: cfg.loyalty.tiers[0].name,
									next: cfg.loyalty.tiers[1]?.name,
									units_to_next: cfg.loyalty.tiers[1]?.unitsRequired,
								},
							}),
						},
					],
				},
			],
		};
	}

	// Keep lineItems referenced for future per-item rules; silences lint.
	void lineItems;

	return payload;
}
