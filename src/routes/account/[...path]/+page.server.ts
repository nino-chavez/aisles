import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { KIBBLE_REFERENCE_CONTRACT } from '$lib/brand/reference/kibble';
import { getBrand } from '$lib/brand/config';
import { getTrustedKibbleRoutePolicy } from '$lib/brand/composition-policy';

const SUBTYPES = new Set(['login', 'register', 'orders', 'addresses', 'payment-methods', 'subscriptions', 'logout']);

export const load: PageServerLoad = async ({ params, url, parent }) => {
	const { brand } = await parent();
	const requested = params.path?.replace(/^\/+|\/+$/g, '') || 'login';
	if (!SUBTYPES.has(requested)) throw error(404, 'Not found');
	const routePolicy = getTrustedKibbleRoutePolicy(getBrand().id, url.pathname);
	if (!routePolicy || routePolicy.surface !== 'account') throw error(404, 'Not found');
	const subtype = requested as 'login' | 'register' | 'orders' | 'addresses' | 'payment-methods' | 'subscriptions' | 'logout';
	return {
		kibbleAccount: {
			subtype,
			brandName: brand.name,
			availabilityMessage: 'Account services are not available in this reference-preserved preview. No sign-in or customer-data request was started.',
			recipeId: KIBBLE_REFERENCE_CONTRACT.recipes.account.id,
			policyVersion: routePolicy.policy.policyVersion,
		},
	};
};
