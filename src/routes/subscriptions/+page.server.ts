import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { KIBBLE_REFERENCE_CONTRACT } from '$lib/brand/reference/kibble';
import { getBrand } from '$lib/brand/config';
import { getTrustedKibbleRoutePolicy } from '$lib/brand/composition-policy';
import { buildKibbleMerchantCapabilityCoverage } from '$lib/brand/reference/kibble-catalog-enrichment';

export const load: PageServerLoad = async ({ url, parent }) => {
	const routePolicy = getTrustedKibbleRoutePolicy(getBrand().id, url.pathname);
	if (!routePolicy || routePolicy.surface !== 'account') throw error(404, 'Not found');
	const { kibbleCommerceServices } = await parent();
	return {
		kibbleSubscriptions: {
			subtype: 'portal' as const,
			brandName: getBrand().name,
			availabilityMessage: kibbleCommerceServices?.subscription === 'provider_not_connected'
				? 'Auto-Refill plans are not connected. No subscriber-data request was started.'
				: 'Live Auto-Refill plans are available on eligible products. Subscription management still requires a provider portal session.',
			recipeId: KIBBLE_REFERENCE_CONTRACT.recipes.subscriptions.id,
			policyVersion: routePolicy.policy.policyVersion,
			capabilityCoverage: buildKibbleMerchantCapabilityCoverage(),
			services: kibbleCommerceServices ?? undefined,
		},
	};
};
