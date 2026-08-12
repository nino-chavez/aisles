/**
 * Checkout surface — static fallbacks.
 *
 * Checkout is the narrowest-latitude surface. Two zones:
 *
 * - checkout.assurance-strip: brand-default trust strip (shipping /
 *   returns / secure-checkout), rendered as a service-callouts-grid — the
 *   closest existing component to bealls-aisles' dedicated
 *   assurance-strip-checkout block, which is not in Aisles' vocabulary.
 *   The AI may override with a richer composition once it has shopper
 *   signal.
 * - checkout.last-chance-upsell: Hidden by default. The engine populates
 *   this when it finds qualifying neighborhood products; otherwise no
 *   upsell.
 */

import { getBrandById } from '$lib/brand/config';
import type { ZoneFallback } from './index';

export const checkoutFallbacks: Partial<Record<string, ZoneFallback>> = {
	'checkout.assurance-strip': (brandId) => {
		const brand = getBrandById(brandId);
		if (!brand) return null;
		const hasFreeShipping = brand.incentives?.freeShippingThresholdMinor != null;
		const freeShippingBody =
			brand.incentives?.freeShippingThresholdMinor && brand.incentives.freeShippingThresholdMinor > 0
				? `On orders $${Math.round(brand.incentives.freeShippingThresholdMinor / 100)}+.`
				: 'Every order ships free.';
		return {
			component: 'service-callouts-grid',
			props: {
				columns: 3 as const,
				callouts: [
					{ icon: 'secure', label: 'Secure checkout', body: 'Encrypted payment, handled by BigCommerce.' },
					{ icon: 'returns', label: 'Easy returns', body: '30-day returns, no restocking fee.' },
					hasFreeShipping
						? { icon: 'shipping', label: 'Free shipping', body: freeShippingBody }
						: { icon: 'quality', label: `Backed by ${brand.name}`, body: brand.tagline },
				],
			},
		};
	},

	// checkout.last-chance-upsell — Hidden default; engine populates per request.
};
