import type { PageServerLoad } from './$types';
import { env as privateEnv } from '$env/dynamic/private';
import { getBrand } from '$lib/brand/config';
import { getKibbleObserveCopyModelPolicyDescriptor, getTrustedKibbleRoutePolicy } from '$lib/brand/composition-policy';
import { executeKibbleCartEmptyZoneAdapter } from '$lib/brand/reference/kibble-zone-executor.server';
import { KIBBLE_CART_DEFAULT_PRESENTATION, materializeKibbleCartPresentation } from '$lib/brand/reference/kibble-presentation-decisions';
import { createStoreFromRequest } from '$lib/signals/request';

/** Kibble never reads a cart cookie or commerce backend in Preserve mode. */
export const load: PageServerLoad = async ({ url, request, cookies, parent }) => {
	const { renderMode, observeMode } = await parent();
	const routePolicy = getTrustedKibbleRoutePolicy(getBrand().id, url.pathname);
	if (routePolicy) {
		if (routePolicy.surface !== 'cart') throw new Error('Kibble cart route resolved to the wrong policy surface.');
		const modelEnabled = observeMode && privateEnv.KIBBLE_DEMO_AI_ENABLED === 'true';
		if (modelEnabled) await createStoreFromRequest({ url, request, cookies, category: 'cart' });
		return {
			renderMode,
			kibbleCart: {
				availabilityMessage: 'Cart services are not available in this reference-preserved preview.',
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
