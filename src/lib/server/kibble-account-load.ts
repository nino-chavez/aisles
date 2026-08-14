import type { Cookies } from '@sveltejs/kit';
import { getKibbleCommerceMode, getKibbleCustomerOrders, KibbleCommerceError } from './kibble-commerce';
import { clearKibbleCommerceSession, getKibbleCommerceSession } from './kibble-commerce-session';
import type { KibbleAccountSessionView, KibbleOrderView } from '$lib/components/kibble/types';

type AccountSubtype = 'account' | 'login' | 'register' | 'orders' | 'addresses' | 'payment-methods' | 'subscriptions' | 'logout' | 'unknown';

export async function loadKibbleAccountState({
	subtype,
	brandName,
	availabilityMessage,
	recipeId,
	policyVersion,
	cookies,
}: {
	subtype: AccountSubtype;
	brandName: string;
	availabilityMessage: string;
	recipeId: string;
	policyVersion: string;
	cookies: Cookies;
}) {
	const commerceEnabled = getKibbleCommerceMode() !== 'off';
	let session: KibbleAccountSessionView | null = null;
	let orders: KibbleOrderView[] = [];
	let accountError: string | null = null;
	if (commerceEnabled) {
		const current = await getKibbleCommerceSession(cookies);
		if (current) {
			session = current.customer;
			if (subtype === 'orders') {
				try {
					orders = await getKibbleCustomerOrders(current.accessToken, { sessionCookie: current.providerSessionCookie });
				} catch (error) {
					if (error instanceof KibbleCommerceError && error.kind === 'authentication') {
						await clearKibbleCommerceSession(cookies);
						session = null;
						accountError = 'Your account session expired. Sign in again.';
					} else {
						accountError = 'Orders are temporarily unavailable. Try again.';
					}
				}
			}
		}
	}
	return {
		subtype,
		brandName,
		availabilityMessage: commerceEnabled ? 'Sign in to manage your Kibble account.' : availabilityMessage,
		recipeId,
		policyVersion,
		commerceEnabled,
		session,
		orders,
		accountError,
	};
}
