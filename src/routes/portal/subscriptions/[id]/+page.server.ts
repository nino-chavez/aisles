import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { KIBBLE_REFERENCE_CONTRACT } from '$lib/brand/reference/kibble';
import { getBrand } from '$lib/brand/config';
import { getTrustedKibbleRoutePolicy } from '$lib/brand/composition-policy';

export const load: PageServerLoad = async ({ params, url, parent }) => {
	if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(params.id ?? '')) throw error(404, 'Not found');
	const routePolicy = getTrustedKibbleRoutePolicy(getBrand().id, url.pathname);
	if (!routePolicy || routePolicy.surface !== 'account') throw error(404, 'Not found');
	const { kibbleCommerceServices } = await parent();
	return {
		kibbleSubscriptions: {
			subtype: 'detail' as const,
			brandName: getBrand().name,
			availabilityMessage: 'Subscription detail requires a provider-backed portal session and customer ownership check. The route identifier was not used to request subscriber, charge, renewal, address, or payment data.',
			recipeId: KIBBLE_REFERENCE_CONTRACT.recipes.subscriptions.id,
			policyVersion: routePolicy.policy.policyVersion,
			services: kibbleCommerceServices ?? undefined,
		},
	};
};
