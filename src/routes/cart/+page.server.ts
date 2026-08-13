import type { PageServerLoad } from './$types';
import { getBrand } from '$lib/brand/config';
import { getTrustedKibbleRoutePolicy } from '$lib/brand/composition-policy';

/** Kibble never reads a cart cookie or commerce backend in Preserve mode. */
export const load: PageServerLoad = async ({ url, parent }) => {
	const { renderMode } = await parent();
	const routePolicy = getTrustedKibbleRoutePolicy(getBrand().id, url.pathname);
	if (routePolicy) {
		if (routePolicy.surface !== 'cart') throw new Error('Kibble cart route resolved to the wrong policy surface.');
		return {
			renderMode,
			kibbleCart: {
				availabilityMessage: 'Cart services are not available in this reference-preserved preview.',
				policyVersion: routePolicy.policy.policyVersion,
			},
		};
	}
	return { renderMode };
};
