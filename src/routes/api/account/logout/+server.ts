import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getBrand } from '$lib/brand/config';
import { getKibbleCommerceMode, KibbleCommerceError, logoutKibbleCustomer } from '$lib/server/kibble-commerce';
import { evictKibbleCart } from '$lib/server/kibble-cart-store';
import { clearKibbleCommerceSession, getKibbleCommerceSession, hasKibbleCommerceSessionStorage } from '$lib/server/kibble-commerce-session';

export const POST: RequestHandler = async ({ request, cookies, url }) => {
	if (getBrand().id !== 'kibble') return json({ error: 'Account is unavailable.' }, { status: 404 });
	if (getKibbleCommerceMode() === 'off') return json({ error: 'Account services are unavailable in this preview.' }, { status: 503 });
	if (getKibbleCommerceMode() === 'live' && !hasKibbleCommerceSessionStorage()) return json({ error: 'Account services are not configured for this environment.' }, { status: 503 });
	const origin = request.headers.get('origin');
	if (origin && origin !== url.origin) return json({ error: 'Invalid account request origin.' }, { status: 403 });
	const session = await getKibbleCommerceSession(cookies);
	const cartId = cookies.get('bc_cart_id');
	try {
		if (session) await logoutKibbleCustomer(session.accessToken, { sessionCookie: session.providerSessionCookie });
	} catch (error) {
		if (!(error instanceof KibbleCommerceError) || error.kind !== 'authentication') {
			console.warn('[kibble-account] Provider logout failed; clearing local session:', error instanceof Error ? error.message : error);
		}
	} finally {
		await clearKibbleCommerceSession(cookies);
		if (cartId) await evictKibbleCart(cartId);
		cookies.delete('bc_cart_id', { path: '/' });
	}
	return json({ ok: true });
};
