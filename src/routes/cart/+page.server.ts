import type { PageServerLoad } from './$types';
import { env as privateEnv } from '$env/dynamic/private';
import { getBrand } from '$lib/brand/config';
import { getKibbleObserveCopyModelPolicyDescriptor, getTrustedKibbleRoutePolicy } from '$lib/brand/composition-policy';
import { executeKibbleCartEmptyZoneAdapter } from '$lib/brand/reference/kibble-zone-executor.server';
import { KIBBLE_CART_DEFAULT_PRESENTATION, materializeKibbleCartPresentation } from '$lib/brand/reference/kibble-presentation-decisions';
import { createStoreFromRequest } from '$lib/signals/request';
import { getCommerceServiceBoundary } from '$lib/server/commerce/boundary';
import { commerceService } from '$lib/server/commerce/service';
import { commerceSessionId } from '$lib/server/commerce/session';

export const load: PageServerLoad = async ({ url, request, cookies, parent }) => {
	const { renderMode, observeMode } = await parent();
	const routePolicy = getTrustedKibbleRoutePolicy(getBrand().id, url.pathname);
	if (routePolicy) {
		if (routePolicy.surface !== 'cart') throw new Error('Kibble cart route resolved to the wrong policy surface.');
		const services = getCommerceServiceBoundary();
		const cartResult = services.mode === 'sandbox' ? await commerceService.read(commerceSessionId(cookies)) : null;
		const cart = cartResult?.ok ? cartResult.data.cart : null;
		const cartStatus: 'ready' | 'empty' | 'unavailable' = cartResult?.ok ? (cart ? 'ready' : 'empty') : 'unavailable';
		const confirmedEmpty = cartResult?.ok === true && cart === null;
		const modelEnabled = (services.mode === 'off' || confirmedEmpty) && observeMode && privateEnv.KIBBLE_DEMO_AI_ENABLED === 'true';
		if (modelEnabled) await createStoreFromRequest({ url, request, cookies, category: 'cart' });
		return {
			renderMode,
			kibbleCart: {
				cart,
				cartStatus,
				services,
				availabilityMessage: services.mode === 'off' ? 'Sandbox cart service is not enabled in this deployment.' : cartResult?.ok ? 'Your cart is empty.' : (cartResult?.error.message ?? 'The cart is temporarily unavailable.'),
				policyVersion: routePolicy.policy.policyVersion,
				zoneAdapter: services.mode === 'off' || confirmedEmpty ? await executeKibbleCartEmptyZoneAdapter(materializeKibbleCartPresentation(KIBBLE_CART_DEFAULT_PRESENTATION).copy) : null,
				cartModelDecision: modelEnabled
					? getKibbleObserveCopyModelPolicyDescriptor({
							surface: 'cart',
							familyId: 'cart.empty-state',
							instanceId: 'cart.empty-state',
							routePath: '/cart',
						})
					: null,
			},
		};
	}
	return { renderMode };
};
