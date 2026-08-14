import type { PageServerLoad } from './$types';
import { env as privateEnv } from '$env/dynamic/private';
import { getBrand } from '$lib/brand/config';
import { getKibbleObserveCopyModelPolicyDescriptor, getTrustedKibbleRoutePolicy } from '$lib/brand/composition-policy';
import { executeKibbleCartEmptyZoneAdapter } from '$lib/brand/reference/kibble-zone-executor.server';
import { KIBBLE_CART_DEFAULT_PRESENTATION, materializeKibbleCartPresentation } from '$lib/brand/reference/kibble-presentation-decisions';
import { createStoreFromRequest } from '$lib/signals/request';
import { KIBBLE_COMMERCE_COPY } from '$lib/components/kibble/types';
import { getKibbleCommerceMode, getKibbleCart } from '$lib/server/kibble-commerce';
import { cacheKibbleCart, getCachedKibbleCart, getKibbleCartSessionCookie } from '$lib/server/kibble-cart-store';

export const load: PageServerLoad = async ({ url, request, cookies, parent }) => {
	const { renderMode, observeMode } = await parent();
	const routePolicy = getTrustedKibbleRoutePolicy(getBrand().id, url.pathname);
	if (routePolicy) {
		if (routePolicy.surface !== 'cart') throw new Error('Kibble cart route resolved to the wrong policy surface.');
		const modelEnabled = observeMode && privateEnv.KIBBLE_DEMO_AI_ENABLED === 'true';
		if (modelEnabled) await createStoreFromRequest({ url, request, cookies, category: 'cart' });
		const commerceEnabled = getKibbleCommerceMode() !== 'off';
		let cart = null;
		let cartError: string | null = null;
		if (commerceEnabled) {
			const cartId = cookies.get('bc_cart_id');
			if (cartId) {
				try {
					const cached = await getCachedKibbleCart(cartId);
					if (cached) cart = cached.cart;
					else {
						const result = await getKibbleCart(cartId, { sessionCookie: await getKibbleCartSessionCookie(cartId) });
						cart = result.cart;
						if (result.cart) await cacheKibbleCart(result.cart, result.sessionCookie);
					}
				} catch {
					cartError = 'Cart is temporarily unavailable. Try again.';
				}
			}
		}
		return {
			renderMode,
			kibbleCart: {
				availabilityMessage: commerceEnabled ? 'Your cart is empty.' : 'Cart services are not available in this reference-preserved preview.',
				commerceEnabled,
				commerceCopy: KIBBLE_COMMERCE_COPY,
				cart,
				cartError,
				policyVersion: routePolicy.policy.policyVersion,
				zoneAdapter: await executeKibbleCartEmptyZoneAdapter(materializeKibbleCartPresentation(KIBBLE_CART_DEFAULT_PRESENTATION).copy),
				cartModelDecision: modelEnabled
					? getKibbleObserveCopyModelPolicyDescriptor({ surface: 'cart', familyId: 'cart.empty-state', instanceId: 'cart.empty-state', routePath: '/cart' })
					: null,
			},
		};
	}
	return { renderMode };
};
