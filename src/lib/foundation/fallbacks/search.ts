/**
 * Search surface — static fallbacks.
 *
 * Only one zone: search.empty-state. bealls-aisles' array-multiplicity
 * "zero-results-rescue" row (category tiles / popular searches / product
 * carousel) was dropped — none of those shapes have a synchronous,
 * brand-generic source in Aisles (no category imagery, no product data at
 * fallback time), and it would duplicate error-empty.rescue below. A
 * single copy-only zone covers the case.
 */

import { getBrandById } from '$lib/brand/config';
import type { ZoneFallback } from './index';

export const searchFallbacks: Partial<Record<string, ZoneFallback>> = {
	'search.empty-state': (brandId) => {
		const brand = getBrandById(brandId);
		if (!brand) return null;
		return {
			component: 'editorial-header',
			props: {
				eyebrow: 'NO MATCHES',
				headline: 'Nothing matched that search',
				body: `Browse ${brand.name}'s full catalog instead, or try a different search term.`,
			},
		};
	},
};
