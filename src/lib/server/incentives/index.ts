/**
 * Incentives evaluator — produces UIP (Unified Incentives Protocol) payloads.
 *
 * Phase 1 ships a stub implementation backed by static brand config. Phase 4
 * will swap in a Voucherify adapter behind the same interface without touching
 * callers. The contract is: given cart + session, return valid UIP blocks.
 */

import type { BrandConfig } from '$lib/brand/config';
import type { IncentivesPayload } from '$lib/schema/uip';
import { IncentivesPayloadSchema } from '$lib/schema/uip';
import { evaluateStub } from './stub';
import { voucherifyConfigured, voucherifyEvaluator } from './voucherify';

export interface IncentivesContext {
	brand: BrandConfig;
	/** Cart line items, prices in minor units (cents). */
	lineItems: Array<{
		path: string;
		productEntityId: number;
		quantity: number;
		unitPriceMinor: number;
	}>;
	/** Cart subtotal in minor units. */
	subtotalMinor: number;
	/** Applied promotion codes (from URL params, cookies, or BC cart state). */
	appliedCodes: string[];
	/** Customer/membership identity; null for anonymous carts. */
	membership: { type: 'profile' | 'card'; id: string } | null;
}

export interface IncentivesEvaluator {
	evaluate(ctx: IncentivesContext): Promise<IncentivesPayload>;
}

/**
 * Validate an evaluator's output against the UIP schema. Fails loud in dev
 * so schema drift is caught before it reaches agent clients.
 */
export function assertValidPayload(payload: IncentivesPayload): IncentivesPayload {
	const parsed = IncentivesPayloadSchema.safeParse(payload);
	if (!parsed.success) {
		throw new Error(`UIP payload failed schema validation: ${parsed.error.message}`);
	}
	return parsed.data;
}

/**
 * Default evaluator — Voucherify when credentials are present, stub otherwise.
 * Validation guarantees every response is UIP-schema-valid regardless of source.
 */
export const defaultEvaluator: IncentivesEvaluator = {
	async evaluate(ctx) {
		const impl = voucherifyConfigured() ? voucherifyEvaluator : null;
		const payload = impl ? await impl.evaluate(ctx) : evaluateStub(ctx);
		return assertValidPayload(payload);
	},
};
