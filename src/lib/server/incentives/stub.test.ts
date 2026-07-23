/**
 * Validates the stub evaluator emits schema-valid UIP payloads.
 * Run: npx tsx src/lib/server/incentives/stub.test.ts
 */

import { evaluateStub } from './stub';
import { IncentivesPayloadSchema } from '../../schema/uip';
import { getBrandById } from '../../brand/config';
import type { IncentivesContext } from './index';

const haven = getBrandById('haven')!;

function ctx(overrides: Partial<IncentivesContext> = {}): IncentivesContext {
	return {
		brand: haven,
		lineItems: [],
		subtotalMinor: 0,
		appliedCodes: [],
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

console.log('UIP stub evaluator');

// Empty cart → valid empty payload
{
	const p = evaluateStub(ctx());
	const r = IncentivesPayloadSchema.safeParse(p);
	assert('empty cart produces schema-valid payload', r.success, r.success ? '' : r.error.message);
	assert('empty cart has no discounts', !p.promotions.discounts);
	assert('empty cart has no codes', !p.promotions.codes);
	assert('empty cart has no programs', !p.loyalty.programs);
}

// Subtotal over Haven's $500 free-shipping threshold
{
	const p = evaluateStub(ctx({ subtotalMinor: 60000 }));
	const r = IncentivesPayloadSchema.safeParse(p);
	assert('free-shipping-eligible cart is schema-valid', r.success, r.success ? '' : r.error.message);
	assert(
		'emits Free shipping discount at target=additional_cost',
		p.promotions.discounts?.[0]?.title === 'Free shipping' &&
			p.promotions.discounts?.[0]?.target === 'additional_cost',
	);
}

// Subtotal under threshold → no free shipping
{
	const p = evaluateStub(ctx({ subtotalMinor: 10000 }));
	assert('below-threshold cart has no free-shipping discount', !p.promotions.discounts);
}

// Applied code lands in promotions.codes
{
	const p = evaluateStub(ctx({ appliedCodes: ['SPRING10'] }));
	assert('applied code surfaces in promotions.codes', p.promotions.codes?.[0]?.code === 'SPRING10');
	assert('applied code typed as coupon', p.promotions.codes?.[0]?.type === 'coupon');
}

// Membership + brand.loyalty populates programs + tier
{
	const p = evaluateStub(
		ctx({
			membership: { type: 'profile', id: 'bc-customer-42' },
			subtotalMinor: 25000,
		}),
	);
	const r = IncentivesPayloadSchema.safeParse(p);
	assert('logged-in payload is schema-valid', r.success, r.success ? '' : r.error.message);
	assert('one membership surfaced', p.loyalty.memberships?.length === 1);
	assert('one program surfaced', p.loyalty.programs?.length === 1);
	assert(
		'wallet tier reflects brand config',
		p.loyalty.programs?.[0]?.wallets?.[0]?.tier?.current === 'Resident' &&
			p.loyalty.programs?.[0]?.wallets?.[0]?.tier?.next === 'Host',
	);
	assert(
		'membership JSONPath reference is canonical',
		p.loyalty.programs?.[0]?.membership === '$.loyalty.memberships[0]',
	);
}

if (process.exitCode) {
	console.log('\nFAILED');
} else {
	console.log('\nOK');
}
