/**
 * Error-empty surface — static fallback.
 *
 * The shared zero-results rescue: any surface that lands on nothing to
 * show (a filtered category with no matches, an empty recommendation
 * slot with no upstream fallback) can resolve this zone rather than each
 * surface growing its own near-duplicate copy-only zone.
 */

import { getBrandById } from '$lib/brand/config';
import type { ZoneFallback } from './index';

export const errorEmptyFallbacks: Partial<Record<string, ZoneFallback>> = {
	'error-empty.rescue': (brandId) => {
		const brand = getBrandById(brandId);
		if (!brand) return null;
		return {
			component: 'editorial-header',
			props: {
				eyebrow: 'NOTHING HERE YET',
				headline: 'No results to show',
				body: `Try adjusting your filters, or browse ${brand.name}'s full catalog.`,
			},
		};
	},
};
