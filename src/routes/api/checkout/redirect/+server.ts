import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getBrand } from '$lib/brand/config';
import {
	createKibbleCheckoutRedirect,
	getKibbleCart,
	getKibbleCommerceMode,
	KibbleCommerceError,
} from '$lib/server/kibble-commerce';
import { cacheKibbleCart, getCachedKibbleCart, getKibbleCartSessionCookie } from '$lib/server/kibble-cart-store';
import { getKibbleCommerceSession } from '$lib/server/kibble-commerce-session';

/**
 * Create a just-in-time BigCommerce hosted-checkout handoff. The client never
 * receives a provider token and never constructs a provider checkout URL.
 */
export const POST: RequestHandler = async ({ cookies }) => {
	if (getBrand().id !== 'kibble') return json({ error: 'Checkout is unavailable.' }, { status: 404 });
	if (getKibbleCommerceMode() === 'off') return json({ error: 'Checkout is unavailable in this preview.' }, { status: 503 });

	const cartId = cookies.get('bc_cart_id');
	if (!cartId) return json({ error: 'Your cart is empty.' }, { status: 400 });

	try {
		const customerSession = await getKibbleCommerceSession(cookies);
		let cached = await getCachedKibbleCart(cartId);
		if (!cached) {
			const recovered = await getKibbleCart(cartId, { sessionCookie: await getKibbleCartSessionCookie(cartId) ?? customerSession?.providerSessionCookie, customerAccessToken: customerSession?.accessToken });
			if (!recovered.cart) {
				cookies.delete('bc_cart_id', { path: '/' });
				return json({ error: 'Your cart has expired.' }, { status: 409 });
			}
			await cacheKibbleCart(recovered.cart, recovered.sessionCookie);
			cached = { cart: recovered.cart, sessionCookie: recovered.sessionCookie };
		}
		if (!cached.cart.lineItems.physicalItems.length) return json({ error: 'Your cart is empty.' }, { status: 400 });
		const url = await createKibbleCheckoutRedirect(cartId, {
			sessionCookie: cached.sessionCookie ?? await getKibbleCartSessionCookie(cartId) ?? customerSession?.providerSessionCookie,
			customerAccessToken: customerSession?.accessToken,
		});
		return json({ url });
	} catch (error) {
		const status = error instanceof KibbleCommerceError ? error.status : 502;
		console.warn('[kibble-commerce] Checkout redirect failed:', error instanceof Error ? error.message : error);
		return json({ error: status === 400 ? (error as Error).message : 'Checkout is temporarily unavailable.' }, { status });
	}
};
