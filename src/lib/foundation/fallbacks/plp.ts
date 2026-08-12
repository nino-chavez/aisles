/**
 * PLP (category) surface — static fallbacks.
 *
 * All three PLP zones stay Hidden by default:
 * - plp.editorial-header: engine composes editorial framing for the
 *   category page when it has a strong signal; no brand-generic default.
 * - plp.cluster-row: merchandiser-curated theme rows ("New Arrivals",
 *   "Under $200"). BrandConfig carries no curated cluster data — the
 *   engine populates this when it detects a cluster worth surfacing.
 * - plp.below-grid: engine-disabled by design (see zones.ts) — admin-only,
 *   and no admin app exists yet in Aisles.
 */

import type { ZoneFallback } from './index';

export const plpFallbacks: Partial<Record<string, ZoneFallback>> = {};
