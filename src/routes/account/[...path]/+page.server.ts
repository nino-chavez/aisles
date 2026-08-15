import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { KIBBLE_REFERENCE_CONTRACT } from '$lib/brand/reference/kibble';
import { getBrand } from '$lib/brand/config';
import { getTrustedKibbleRoutePolicy } from '$lib/brand/composition-policy';

const SUBTYPES = new Set(['login', 'register', 'orders', 'addresses', 'payment-methods', 'subscriptions', 'logout']);

export const load: PageServerLoad = async ({ params, url, parent }) => {
	const { brand, kibbleCommerceServices } = await parent();
	const requested = params.path?.replace(/^\/+|\/+$/g, '') || 'login';
	if (!SUBTYPES.has(requested)) throw error(404, 'Not found');
	const routePolicy = getTrustedKibbleRoutePolicy(getBrand().id, url.pathname);
	if (!routePolicy || routePolicy.surface !== 'account') throw error(404, 'Not found');
	const subtype = requested as 'login' | 'register' | 'orders' | 'addresses' | 'payment-methods' | 'subscriptions' | 'logout';
	return {
		kibbleAccount: {
			subtype,
			brandName: brand.name,
			availabilityMessage: availabilityMessage(subtype),
			recipeId: KIBBLE_REFERENCE_CONTRACT.recipes.account.id,
			policyVersion: routePolicy.policy.policyVersion,
			services: kibbleCommerceServices ?? undefined,
		},
	};
};

function availabilityMessage(subtype: 'login' | 'register' | 'orders' | 'addresses' | 'payment-methods' | 'subscriptions' | 'logout'): string {
	if (subtype === 'orders') return 'Order history requires a signed-in BigCommerce customer context held server-side. No account or order request was started.';
	if (subtype === 'addresses') return 'Addresses require a signed-in customer session and provider ownership checks. No address request was started.';
	if (subtype === 'payment-methods') return 'Saved payment methods remain provider-owned and require a signed-in customer session. No payment instrument or credential request was started.';
	if (subtype === 'subscriptions') return 'Auto-Refill requires both customer identity and a subscription-provider portal session. Neither session exists, and no subscriber request was started.';
	return 'Customer identity is paused until the merchant chooses the identity owner and Aisles has an opaque server-side customer session. No sign-in, registration, logout, or customer-data request was started.';
}
