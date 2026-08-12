/**
 * Error-404 surface — static fallback.
 *
 * bealls-aisles' array-multiplicity rescue row (category tiles / product
 * carousel) was narrowed to a single copy-only zone here — see
 * zones.ts for the multiplicity change and search.ts for the same
 * reasoning applied to search's empty state.
 */

import { getBrandById } from '$lib/brand/config';
import type { ZoneFallback } from './index';

export const error404Fallbacks: Partial<Record<string, ZoneFallback>> = {
	'error-404.rescue': (brandId) => {
		const brand = getBrandById(brandId);
		if (!brand) return null;
		return {
			component: 'editorial-header',
			props: {
				eyebrow: 'PAGE NOT FOUND',
				headline: "That page doesn't exist",
				body: `Head back to ${brand.name}'s homepage to keep browsing.`,
			},
		};
	},
};
