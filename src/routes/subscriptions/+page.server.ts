import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { KIBBLE_REFERENCE_CONTRACT } from '$lib/brand/reference/kibble';
import { getBrand } from '$lib/brand/config';
import { getTrustedKibbleRoutePolicy } from '$lib/brand/composition-policy';

export const load: PageServerLoad = async ({ url }) => {
	const routePolicy = getTrustedKibbleRoutePolicy(getBrand().id, url.pathname);
	if (!routePolicy || routePolicy.surface !== 'account') throw error(404, 'Not found');
	return {
		kibbleSubscriptions: {
			subtype: 'portal' as const,
			availabilityMessage: 'Subscription services are not available in this reference-preserved preview. No redirect, session, or subscriber-data request was started.',
			recipeId: KIBBLE_REFERENCE_CONTRACT.recipes.subscriptions.id,
			policyVersion: routePolicy.policy.policyVersion,
		},
	};
};
