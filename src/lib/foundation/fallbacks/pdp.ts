/**
 * PDP surface — static fallbacks.
 *
 * PDP scaffold blocks (gallery, title, variants, add-to-cart, description,
 * reviews) are NOT zones — they render directly from the product route,
 * populated from the BC product. Only the insertion-zone fallbacks would
 * live here, and all four PDP zones stay Hidden:
 *
 * - pdp.below-description: needs product-specific editorial copy; nothing
 *   brand-generic fits without speaking to the wrong product.
 * - pdp.related / pdp.cross-sell / pdp.recently-viewed: recommendation
 *   carousels that need real product IDs. The product route's load
 *   function is expected to populate these via engineOutput from a
 *   recommendation query; there is no synchronous, brand-generic default.
 */

import type { ZoneFallback } from './index';

export const pdpFallbacks: Partial<Record<string, ZoneFallback>> = {};
