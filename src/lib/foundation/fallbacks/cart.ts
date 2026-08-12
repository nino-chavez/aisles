/**
 * Cart surface — static fallbacks.
 *
 * The mandatory cart scaffold (line items, summary, promo entry, checkout
 * CTA) is foundation-rendered from cart state directly and is NOT
 * zone-targeted — only the upsell zone is.
 *
 * - cart.above-checkout-cta: Hidden by default. The engine emits a
 *   product-carousel upsell when it finds qualifying neighborhood
 *   products from the cart's line items; empty cart falls back to no
 *   upsell rather than guessing.
 */

import type { ZoneFallback } from './index';

export const cartFallbacks: Partial<Record<string, ZoneFallback>> = {
	// Intentionally Hidden — see header note.
};
