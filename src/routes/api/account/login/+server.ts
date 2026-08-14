import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getBrand } from '$lib/brand/config';
import { getKibbleCommerceMode, getKibbleCart, KibbleCommerceError, loginKibbleCustomer } from '$lib/server/kibble-commerce';
import { getCachedKibbleCart, cacheKibbleCart } from '$lib/server/kibble-cart-store';
import {
	clearKibbleCommerceSession,
	createKibbleCommerceSession,
	getKibbleCommerceSession,
	hasKibbleCommerceSessionStorage,
	setKibbleCommerceSessionCookie,
} from '$lib/server/kibble-commerce-session';

function assertSameOrigin(request: Request, origin: string): void {
	const requestOrigin = request.headers.get('origin');
	if (requestOrigin && requestOrigin !== origin) throw new KibbleCommerceError('Invalid account request origin.', 403, 'validation');
}

function safeCustomer(customer: { entityId: number; firstName: string; lastName: string; email: string }) {
	return { entityId: customer.entityId, firstName: customer.firstName, lastName: customer.lastName, email: customer.email };
}

export const POST: RequestHandler = async ({ request, cookies, url }) => {
	if (getBrand().id !== 'kibble') return json({ error: 'Account is unavailable.' }, { status: 404 });
	if (getKibbleCommerceMode() === 'off') return json({ error: 'Account services are unavailable in this preview.' }, { status: 503 });
	if (getKibbleCommerceMode() === 'live' && !hasKibbleCommerceSessionStorage()) return json({ error: 'Account services are not configured for this environment.' }, { status: 503 });
	try {
		assertSameOrigin(request, url.origin);
		const body = await request.json() as Record<string, unknown>;
		const email = typeof body.email === 'string' ? body.email.trim() : '';
		const password = typeof body.password === 'string' ? body.password : '';
		if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254 || password.length < 1 || password.length > 256) {
			return json({ error: 'Enter a valid email address and password.' }, { status: 400 });
		}

		const guestCartId = cookies.get('bc_cart_id') ?? null;
		const guestCart = guestCartId ? await getCachedKibbleCart(guestCartId) : null;
		const result = await loginKibbleCustomer(email, password, guestCartId, { sessionCookie: guestCart?.sessionCookie });
		if (!result) return json({ error: 'We could not sign you in with those details.' }, { status: 401 });

		const existingSession = await getKibbleCommerceSession(cookies);
		if (existingSession) await clearKibbleCommerceSession(cookies);
		const sessionId = await createKibbleCommerceSession({
			customer: result.customer,
			accessToken: result.accessToken,
			accessTokenExpiresAt: result.accessTokenExpiresAt,
			cartEntityId: result.cartEntityId,
			providerSessionCookie: result.sessionCookie ?? guestCart?.sessionCookie ?? null,
		});
		await setKibbleCommerceSessionCookie(cookies, sessionId);

		if (result.cartEntityId) {
			cookies.set('bc_cart_id', result.cartEntityId, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30 });
			try {
				const cart = await getKibbleCart(result.cartEntityId, {
					sessionCookie: result.sessionCookie ?? guestCart?.sessionCookie,
					customerAccessToken: result.accessToken,
				});
				if (cart.cart) await cacheKibbleCart(cart.cart, cart.sessionCookie ?? result.sessionCookie ?? guestCart?.sessionCookie ?? null);
			} catch {
				// Account login succeeded; the cart loader can re-read the provider cart.
			}
		} else {
			cookies.delete('bc_cart_id', { path: '/' });
		}

		return json({ customer: safeCustomer(result.customer), cartEntityId: result.cartEntityId });
	} catch (error) {
		const status = error instanceof KibbleCommerceError ? error.status : 502;
		console.warn('[kibble-account] Login failed:', error instanceof Error ? error.message : error);
		return json({ error: status === 401 ? 'We could not sign you in with those details.' : 'Account services are temporarily unavailable.' }, { status });
	}
};
