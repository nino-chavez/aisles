import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { KIBBLE_REFERENCE_CONTRACT } from '$lib/brand/reference/kibble';
import { getBrand } from '$lib/brand/config';
import { getTrustedKibbleRoutePolicy } from '$lib/brand/composition-policy';

const SUBTYPES = new Set(['login', 'register', 'orders', 'addresses', 'payment-methods', 'subscriptions', 'logout']);

export const load: PageServerLoad = async ({ params, url, parent }) => {
	const { brand, kibbleCommerceServices, kibbleCustomerSessionState } = await parent();
	const requested = params.path?.replace(/^\/+|\/+$/g, '') || 'login';
	if (!SUBTYPES.has(requested)) throw error(404, 'Not found');
	const routePolicy = getTrustedKibbleRoutePolicy(getBrand().id, url.pathname);
	if (!routePolicy || routePolicy.surface !== 'account') throw error(404, 'Not found');
	const subtype = requested as 'login' | 'register' | 'orders' | 'addresses' | 'payment-methods' | 'subscriptions' | 'logout';
	return {
		kibbleAccount: {
			subtype,
			brandName: brand.name,
			availabilityMessage: availabilityMessage(
				subtype,
				kibbleCommerceServices?.account === 'bigcommerce_login_ready',
				kibbleCustomerSessionState === 'authenticated',
			),
			recipeId: KIBBLE_REFERENCE_CONTRACT.recipes.account.id,
			policyVersion: routePolicy.policy.policyVersion,
			services: kibbleCommerceServices ?? undefined,
			customerSessionState: kibbleCustomerSessionState,
		},
	};
};

function availabilityMessage(
	subtype: 'login' | 'register' | 'orders' | 'addresses' | 'payment-methods' | 'subscriptions' | 'logout',
	loginReady: boolean,
	signedIn: boolean,
): string {
	if (subtype === 'orders') return signedIn
		? 'Order history is read from BigCommerce with the server-held customer token. This route cannot create or change an order.'
		: 'Order history requires a signed-in BigCommerce customer context held server-side. No account or order request was started.';
	if (subtype === 'addresses') return 'Addresses require a signed-in customer session and provider ownership checks. No address request was started.';
	if (subtype === 'payment-methods') return 'Saved payment methods remain provider-owned and require a signed-in customer session. No payment instrument or credential request was started.';
	if (subtype === 'subscriptions') return 'Auto-Refill requires both customer identity and a subscription-provider portal session. Neither session exists, and no subscriber request was started.';
	if (subtype === 'register') return 'Account registration remains disabled until the merchant approves registration and password policy. No account was created.';
	if (subtype === 'logout') return signedIn
		? 'Sign out asks BigCommerce to invalidate the customer token before Aisles clears its server session.'
		: 'No signed-in customer session exists, so no logout request can be started.';
	return loginReady
		? signedIn
			? 'A signed-in BigCommerce customer session is active in durable server storage.'
			: 'BigCommerce password sign-in is ready. Credentials and the customer token stay server-side.'
		: 'Customer identity is paused until the merchant chooses the identity owner and configures the server-only customer connection. No sign-in or customer-data request was started.';
}
