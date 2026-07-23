import { z } from 'zod';

/**
 * Unified Incentives Protocol (UIP) — v2026-01 schema bindings.
 *
 * https://uip.dev/schemas/ucp/shopping/loyalty.json
 * https://uip.dev/schemas/ucp/shopping/promotions.json
 *
 * All monetary and point values are minor units (cents, not dollars).
 * Produced by the incentives evaluator and returned on the cart/checkout
 * response so agentic commerce clients can read loyalty + promotions state
 * without bespoke per-merchant contracts.
 */

// ─── Promotions ─────────────────────────────────────────────────────

export const PromotionCodeSchema = z.object({
	type: z.enum(['coupon', 'referral', 'giftcard']),
	code: z.string(),
});

export const DiscountAllocationSchema = z.object({
	path: z.string().describe('JSONPath to the target line item or additional cost'),
	amount: z.number().int().nonnegative().describe('Allocated value in minor units'),
});

export const DiscountSchema = z.object({
	title: z.string(),
	target: z.enum(['cart', 'additional_cost', 'item', 'bundle']),
	method: z.enum(['each', 'across', 'one']).optional(),
	amount: z.number().int().nonnegative().describe('Discount value in minor units'),
	code: z.string().optional().describe('JSONPath reference to triggering code'),
	allocations: z.array(DiscountAllocationSchema).optional(),
});

export const FreeItemSchema = z.object({
	title: z.string(),
	path: z.string().describe('JSONPath to the line item receiving the free units'),
	quantity: z.number().int().min(1),
	amount: z.number().int().nonnegative().describe('Total value in minor units'),
	code: z.string().optional(),
});

export const PromotionsObjectSchema = z.object({
	codes: z.array(PromotionCodeSchema).optional(),
	discounts: z.array(DiscountSchema).optional(),
	free_items: z.array(FreeItemSchema).optional(),
});

// ─── Loyalty ────────────────────────────────────────────────────────

export const MembershipSchema = z.object({
	type: z.enum(['profile', 'card']),
	id: z.string(),
});

export const BalancesSchema = z.object({
	active: z.number().int().nonnegative(),
	pending: z.number().int().nonnegative(),
	total: z.number().int().nonnegative(),
});

export const TierSchema = z.object({
	current: z.string(),
	next: z.string().optional(),
	units_to_next: z.number().int().nonnegative().optional(),
});

export const WalletSchema = z.object({
	id: z.string(),
	unit: z.string().describe('e.g. "points", "stars", "miles"'),
	balances: BalancesSchema,
	earnings: BalancesSchema.optional(),
	tier: TierSchema.optional(),
});

export const ProgramSchema = z.object({
	id: z.string(),
	name: z.string(),
	membership: z.string().describe('JSONPath reference to the membership'),
	wallets: z.array(WalletSchema).min(1),
});

export const EarningAllocationSchema = z.object({
	path: z.string(),
	amount: z.number().int(),
});

export const EarningSchema = z.object({
	title: z.string(),
	target: z.enum(['session', 'items', 'bundle']),
	method: z.enum(['each', 'across']).optional(),
	amount: z.number().int(),
	wallet: z.string().describe('JSONPath reference to the wallet'),
	active_from: z.iso.datetime().optional(),
	allocations: z.array(EarningAllocationSchema).optional(),
});

export const LoyaltyObjectSchema = z.object({
	memberships: z.array(MembershipSchema).optional(),
	programs: z.array(ProgramSchema).optional(),
	earnings: z.array(EarningSchema).optional(),
});

// ─── Combined payload ───────────────────────────────────────────────

export const IncentivesPayloadSchema = z.object({
	promotions: PromotionsObjectSchema,
	loyalty: LoyaltyObjectSchema,
});

// ─── Inferred types ─────────────────────────────────────────────────

export type PromotionCode = z.infer<typeof PromotionCodeSchema>;
export type DiscountAllocation = z.infer<typeof DiscountAllocationSchema>;
export type Discount = z.infer<typeof DiscountSchema>;
export type FreeItem = z.infer<typeof FreeItemSchema>;
export type PromotionsObject = z.infer<typeof PromotionsObjectSchema>;

export type Membership = z.infer<typeof MembershipSchema>;
export type Balances = z.infer<typeof BalancesSchema>;
export type Tier = z.infer<typeof TierSchema>;
export type Wallet = z.infer<typeof WalletSchema>;
export type Program = z.infer<typeof ProgramSchema>;
export type Earning = z.infer<typeof EarningSchema>;
export type LoyaltyObject = z.infer<typeof LoyaltyObjectSchema>;

export type IncentivesPayload = z.infer<typeof IncentivesPayloadSchema>;

/** Empty but schema-valid payload. Use as a fallback. */
export const EMPTY_INCENTIVES: IncentivesPayload = {
	promotions: {},
	loyalty: {},
};
