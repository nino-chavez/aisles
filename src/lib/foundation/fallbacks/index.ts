/**
 * Static fallback registry — the third rung of the resolution cascade.
 *
 * A fallback may return either content (typed loosely here — the resolver
 * validates against the per-zone schema) or `null` for the Hidden
 * semantic. Fallbacks must:
 * - Always return synchronously (no IO at request time).
 * - Be brand-aware via `getBrandById()` if they need brand context.
 * - Match the zone's Zod schema (validated in resolve-zone.test.ts).
 *
 * Many zones intentionally register no fallback and stay Hidden — see the
 * per-surface files for why (usually: the content needs real product data,
 * or BrandConfig has no field to build it from without a network call).
 */

import type { ZoneId } from '../zones';
import { homeFallbacks } from './home';
import { plpFallbacks } from './plp';
import { pdpFallbacks } from './pdp';
import { cartFallbacks } from './cart';
import { checkoutFallbacks } from './checkout';
import { searchFallbacks } from './search';
import { error404Fallbacks } from './error-404';
import { errorEmptyFallbacks } from './error-empty';

/** A fallback function for one zone family, keyed by brand ID. */
export type ZoneFallback = (brandId: string) => unknown | null;

/**
 * Default fallback — returns `null` (Hidden). Used for any zone family
 * that does not declare a specific fallback.
 */
const HIDDEN: ZoneFallback = () => null;

const FALLBACKS: Partial<Record<ZoneId, ZoneFallback>> = {
	...homeFallbacks,
	...plpFallbacks,
	...pdpFallbacks,
	...cartFallbacks,
	...checkoutFallbacks,
	...searchFallbacks,
	...error404Fallbacks,
	...errorEmptyFallbacks,
};

/**
 * Resolve a static fallback for a zone family. Returns `null` (Hidden)
 * for any zone without a registered fallback.
 */
export function getFallback(family: ZoneId, brandId: string): unknown | null {
	const fallback = Object.prototype.hasOwnProperty.call(FALLBACKS, family)
		? FALLBACKS[family]
		: undefined;
	return (fallback ?? HIDDEN)(brandId);
}
