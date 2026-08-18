import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { KIBBLE_REFERENCE_CONTRACT } from '$lib/brand/reference/kibble';
import { getBrand } from '$lib/brand/config';
import { getTrustedKibbleRoutePolicy } from '$lib/brand/composition-policy';

export const load: PageServerLoad = async ({ params, url, parent }) => {
	if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(params.id ?? '')) throw error(404, 'Not found');
	const routePolicy = getTrustedKibbleRoutePolicy(getBrand().id, url.pathname);
	if (!routePolicy || routePolicy.surface !== 'account') throw error(404, 'Not found');
	const { kibbleCommerceServices, kibbleCustomerSessionState } = await parent();
	return {
		kibbleSubscriptions: {
			subtype: 'detail' as const,
			brandName: getBrand().name,
			availabilityMessage: 'The provider verifies this subscription belongs to the connected customer before returning schedule or charge data.',
			recipeId: KIBBLE_REFERENCE_CONTRACT.recipes.subscriptions.id,
			policyVersion: routePolicy.policy.policyVersion,
			services: kibbleCommerceServices ?? undefined,
			customerSessionState: kibbleCustomerSessionState,
			subscriptionId: params.id,
		},
	};
};
