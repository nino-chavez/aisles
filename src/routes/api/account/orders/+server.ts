import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getBrand } from '$lib/brand/config';
import { getKibbleCommerceMode, getKibbleCustomerOrders, KibbleCommerceError } from '$lib/server/kibble-commerce';
import { clearKibbleCommerceSession, getKibbleCommerceSession, hasKibbleCommerceSessionStorage } from '$lib/server/kibble-commerce-session';

export const GET: RequestHandler = async ({ cookies }) => {
	if (getBrand().id !== 'kibble') return json({ error: 'Orders are unavailable.' }, { status: 404 });
	if (getKibbleCommerceMode() === 'off') return json({ error: 'Orders are unavailable in this preview.' }, { status: 503 });
	if (getKibbleCommerceMode() === 'live' && !hasKibbleCommerceSessionStorage()) return json({ error: 'Account services are not configured for this environment.' }, { status: 503 });
	const session = await getKibbleCommerceSession(cookies);
	if (!session) return json({ error: 'Sign in to view your orders.' }, { status: 401 });
	try {
		const orders = await getKibbleCustomerOrders(session.accessToken, { sessionCookie: session.providerSessionCookie });
		return json({ orders });
	} catch (error) {
		if (error instanceof KibbleCommerceError && error.kind === 'authentication') {
			await clearKibbleCommerceSession(cookies);
			return json({ error: 'Your account session expired. Sign in again.' }, { status: 401 });
		}
		console.warn('[kibble-account] Orders read failed:', error instanceof Error ? error.message : error);
		return json({ error: 'Orders are temporarily unavailable.' }, { status: 503 });
	}
};
