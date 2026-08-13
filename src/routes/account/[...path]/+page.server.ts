import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { KIBBLE_REFERENCE_CONTRACT } from '$lib/brand/reference/kibble';

const SUBTYPES = new Set(['login', 'register', 'orders', 'addresses', 'payment-methods', 'subscriptions', 'logout']);

export const load: PageServerLoad = async ({ params, parent }) => {
	const { chromeMode, brand } = await parent();
	if (chromeMode !== 'reference') throw error(404, 'Not found');
	const requested = params.path?.replace(/^\/+|\/+$/g, '') || 'login';
	const subtype = SUBTYPES.has(requested) ? requested : 'unknown';
	return {
		kibbleAccount: {
			subtype: subtype as 'login' | 'register' | 'orders' | 'addresses' | 'payment-methods' | 'subscriptions' | 'logout' | 'unknown',
			brandName: brand.name,
			availabilityMessage: 'Account services are not available in this reference-preserved preview. No sign-in or customer-data request was started.',
			recipeId: KIBBLE_REFERENCE_CONTRACT.recipes.account.id,
		},
	};
};
