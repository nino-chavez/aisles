import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { KIBBLE_REFERENCE_CONTRACT } from '$lib/brand/reference/kibble';
import { getBrand } from '$lib/brand/config';
import { getTrustedKibbleRoutePolicy } from '$lib/brand/composition-policy';

const SUBTYPES = new Set(['gift', 'prepaid', 'confirmation']);

export const load: PageServerLoad = async ({ params, url }) => {
	if (!SUBTYPES.has(params.subtype)) throw error(404, 'Not found');
	const routePolicy = getTrustedKibbleRoutePolicy(getBrand().id, url.pathname);
	if (!routePolicy || routePolicy.surface !== 'checkout') throw error(404, 'Not found');
	const subtype = params.subtype as 'gift' | 'prepaid' | 'confirmation';
	const availabilityMessage = subtype === 'gift'
		? 'Gift checkout is unavailable. No product, plan, recipient, amount, payment method, or purchase request was loaded.'
		: subtype === 'prepaid'
			? 'Prepaid checkout is unavailable. No plan, term, savings, total, payment method, or purchase request was loaded.'
			: 'Order confirmation is unavailable because no checkout or order service was called.';
	return {
		kibbleCheckout: { subtype, availabilityMessage, recipeId: KIBBLE_REFERENCE_CONTRACT.recipes.checkout.id, policyVersion: routePolicy.policy.policyVersion },
	};
};
