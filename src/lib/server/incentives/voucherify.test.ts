/**
 * Validates the Voucherify → UIP mapper against a real sandbox response.
 * Run: npx tsx src/lib/server/incentives/voucherify.test.ts
 *
 * Fixture captured from:
 *   POST https://us1.api.voucherify.io/v1/validations
 *   redeemables: [{ object: 'voucher', id: 'BLCKFRDY' }]
 *   order: { amount: 5500 }
 */

import {
	mapValidationToPayload,
	redeemableToCode,
	redeemableToDiscount,
	mapEffectToTarget,
	type VoucherifyValidation,
} from './voucherify';
import { IncentivesPayloadSchema } from '../../schema/uip';
import { getBrandById } from '../../brand/config';
import type { IncentivesContext } from './index';

const haven = getBrandById('haven')!;

const fixture: VoucherifyValidation = {
	id: 'valid_124c90eafec3472189',
	valid: true,
	redeemables: [
		{
			status: 'APPLICABLE',
			id: 'BLCKFRDY',
			object: 'voucher',
			order: {
				amount: 5500,
				discount_amount: 1000,
				total_amount: 4500,
			},
			result: {
				discount: {
					type: 'AMOUNT',
					effect: 'APPLY_TO_ORDER',
					amount_off: 1000,
					is_dynamic: false,
				},
			},
			metadata: { name: 'Black Friday Coupon' },
		},
	],
	order: { amount: 5500, discount_amount: 1000, total_amount: 4500 },
};

function ctx(overrides: Partial<IncentivesContext> = {}): IncentivesContext {
	return {
		brand: haven,
		lineItems: [],
		subtotalMinor: 5500,
		appliedCodes: ['BLCKFRDY'],
		membership: null,
		...overrides,
	};
}

function assert(label: string, cond: boolean, detail = '') {
	if (!cond) {
		console.error(`  ✘ ${label}${detail ? ` — ${detail}` : ''}`);
		process.exitCode = 1;
	} else {
		console.log(`  ✓ ${label}`);
	}
}

console.log('Voucherify → UIP mapper');

// Effect mapping
{
	assert('APPLY_TO_ORDER → cart', mapEffectToTarget('APPLY_TO_ORDER') === 'cart');
	assert('APPLY_TO_ITEMS → item', mapEffectToTarget('APPLY_TO_ITEMS') === 'item');
	assert('ADD_FREE_SHIPPING → additional_cost', mapEffectToTarget('ADD_FREE_SHIPPING') === 'additional_cost');
	assert('unknown effect → cart (default)', mapEffectToTarget('SOME_FUTURE_EFFECT') === 'cart');
}

// Individual redeemable mapping
{
	const r = fixture.redeemables[0];
	const code = redeemableToCode(r);
	assert('voucher maps to coupon type', code.type === 'coupon' && code.code === 'BLCKFRDY');

	const d = redeemableToDiscount(r);
	assert('APPLICABLE redeemable produces a Discount', d !== null);
	assert('discount title pulls from metadata.name', d?.title === 'Black Friday Coupon');
	assert('discount target is cart', d?.target === 'cart');
	assert('discount amount is minor units', d?.amount === 1000);
	assert('discount code references redeemable id', d?.code === 'BLCKFRDY');
}

// Inapplicable redeemable → no discount but code still surfaces
{
	const inap = redeemableToDiscount({
		status: 'INAPPLICABLE',
		id: 'EXPIRED10',
		object: 'voucher',
		error: { code: 'expired', message: 'Voucher expired' },
	});
	assert('INAPPLICABLE redeemable yields no Discount', inap === null);
}

// Full payload round-trip against Zod schema
{
	const payload = mapValidationToPayload(fixture, ctx());
	const r = IncentivesPayloadSchema.safeParse(payload);
	assert('mapped payload is schema-valid', r.success, r.success ? '' : r.error.message);
	assert('payload surfaces the applied code', payload.promotions.codes?.[0]?.code === 'BLCKFRDY');
	assert('payload surfaces the mapped discount', payload.promotions.discounts?.[0]?.amount === 1000);
}

// Stub merge: Haven subtotal > $500 should add the free-shipping discount alongside Voucherify's
{
	const payload = mapValidationToPayload(fixture, ctx({ subtotalMinor: 60000 }));
	const titles = (payload.promotions.discounts ?? []).map((d) => d.title);
	assert('Voucherify + stub merge includes both discounts', titles.includes('Free shipping') && titles.includes('Black Friday Coupon'));
	assert(
		'free-shipping discount has no code attribution',
		(payload.promotions.discounts ?? []).find((d) => d.title === 'Free shipping')?.code === undefined,
	);
}

// Loyalty pass-through from stub (Phase 4a keeps loyalty stub-sourced)
{
	const payload = mapValidationToPayload(
		fixture,
		ctx({ membership: { type: 'profile', id: 'bc-customer-7' } }),
	);
	assert('loyalty programs surfaced from stub when member present', (payload.loyalty.programs ?? []).length === 1);
}

if (process.exitCode) {
	console.log('\nFAILED');
} else {
	console.log('\nOK');
}
