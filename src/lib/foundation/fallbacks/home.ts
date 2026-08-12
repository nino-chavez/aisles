/**
 * Home surface — static fallbacks.
 *
 * Every fallback is brand-aware via `getBrandById()` and synchronous (no
 * IO at request time). Each must validate against its zone's Zod schema
 * in `../zone-schemas.ts`; the resolver enforces this at request time.
 */

import { getBrandById } from '$lib/brand/config';
import type { ZoneFallback } from './index';

export const homeFallbacks: Partial<Record<string, ZoneFallback>> = {
	'home.hero': (brandId) => {
		const brand = getBrandById(brandId);
		if (!brand) return null;
		return {
			component: 'editorial-header',
			props: {
				eyebrow: brand.tagline.toUpperCase().slice(0, 60),
				headline: brand.homepage.editorialHeadline,
				body: brand.homepage.editorialBody,
			},
		};
	},

	// home.featured-row — a "best sellers" row needs curated product IDs;
	// BrandConfig carries no such list and fallbacks must stay synchronous
	// (no BC API call at request time). Hidden until curated picks land.

	// home.editorial-strip — a photo-led zone (image-gallery /
	// category-tile-grid). BrandConfig.categories has no image field
	// (`bcName` + `displayName` only), so there is no synchronous source
	// for the imagery either shape needs. Hidden; the engine composes this
	// zone once it has real imagery to work with.

	'home.below-fold': (brandId) => {
		const brand = getBrandById(brandId);
		if (!brand) return null;
		const isContent = brand.mode === 'content';
		const rewardsLabel = brand.incentives?.loyalty?.programName ?? 'Member perks';
		const freeShippingBody = freeShippingCopy(brand.incentives?.freeShippingThresholdMinor);
		// Icon names map to named SVG keys in ServiceCalloutsGrid (no emoji).
		const callouts = isContent
			? [
					{ icon: 'support', label: 'Get in touch', body: 'Questions? We read every message.' },
					{ icon: 'support', label: 'Stay updated', body: brand.tagline },
				]
			: [
					{ icon: 'shipping', label: 'Free shipping', body: freeShippingBody },
					{ icon: 'returns', label: 'Easy returns', body: '30-day returns, no restocking fee.' },
					{
						icon: 'rewards',
						label: rewardsLabel,
						body: brand.incentives ? 'Earn on every order.' : 'Sign up for updates and offers.',
					},
				];
		return {
			component: 'service-callouts-grid',
			props: { columns: 3 as const, callouts },
		};
	},
};

function freeShippingCopy(thresholdMinor: number | null | undefined): string {
	if (thresholdMinor == null || thresholdMinor === 0) return 'Every order ships free.';
	return `On orders $${Math.round(thresholdMinor / 100)}+.`;
}
