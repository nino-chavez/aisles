import type { PageServerLoad } from './$types';
import { getBrand } from '$lib/brand/config';
import { getTrustedKibbleRoutePolicy } from '$lib/brand/composition-policy';

export const load: PageServerLoad = async ({ url, parent }) => {
	const { renderMode } = await parent();
	const routePolicy = getTrustedKibbleRoutePolicy(getBrand().id, url.pathname);
	if (routePolicy) {
		if (routePolicy.surface !== 'checkout') throw new Error('Kibble checkout route resolved to the wrong policy surface.');
		return {
			renderMode,
			kibbleCheckout: {
				subtype: 'checkout' as const,
				availabilityMessage: 'Checkout is not available in this reference-preserved preview. No checkout service or redirect was started.',
				policyVersion: routePolicy.policy.policyVersion,
			},
		};
	}
	return { renderMode };
};
