import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getBrand } from '$lib/brand/config';
import { getKibbleCommerceMode, getKibbleCart, KibbleCommerceError } from '$lib/server/kibble-commerce';
import { getCachedKibbleCart, getKibbleCartSessionCookie } from '$lib/server/kibble-cart-store';
import { getKibbleCommerceSession } from '$lib/server/kibble-commerce-session';
import {
	getKibbleSubscriptionPlans,
	getKibbleCartSubscriptionIntents,
	KibbleSubscriptionError,
	setKibbleCartSubscriptionIntent,
} from '$lib/server/kibble-subscriptions';
import { emitKibbleAddToCartSignal } from '$lib/server/kibble-commerce-observe';

function assertSameOrigin(request: Request, origin: string): void {
	const requestOrigin = request.headers.get('origin');
	if (requestOrigin && requestOrigin !== origin) throw new KibbleSubscriptionError('Invalid cart request origin.', 403, 'validation');
}

function readCartId(cookies: { get: (name: string) => string | undefined }): string | null {
	const cartId = cookies.get('bc_cart_id');
	return cartId && cartId.length <= 128 ? cartId : null;
}

export const GET: RequestHandler = async ({ cookies }) => {
	if (getBrand().id !== 'kibble') return json({ error: 'Cart intents are unavailable.' }, { status: 404 });
	if (getKibbleCommerceMode() === 'off') return json({ error: 'Cart intents are unavailable in this preview.' }, { status: 503 });
	const cartId = readCartId(cookies);
	if (!cartId) return json({ cartId: null, intents: {} });
	try {
		return json({ cartId, intents: await getKibbleCartSubscriptionIntents(cartId) });
	} catch (error) {
		console.warn('[kibble-subscriptions] Intent read failed:', error instanceof Error ? error.message : error);
		return json({ error: 'Auto-Refill details are temporarily unavailable.' }, { status: 503 });
	}
};

export const POST: RequestHandler = async ({ request, cookies, url }) => {
	if (getBrand().id !== 'kibble') return json({ error: 'Cart intents are unavailable.' }, { status: 404 });
	if (getKibbleCommerceMode() === 'off') return json({ error: 'Cart intents are unavailable in this preview.' }, { status: 503 });
	let addedLine: { productEntityId: number; quantity: number } | null = null;
	try {
		assertSameOrigin(request, url.origin);
		const cartId = readCartId(cookies);
		if (!cartId) return json({ error: 'Your cart is empty.' }, { status: 400 });
		const body = await request.json() as Record<string, unknown>;
		const lineEntityId = typeof body.lineEntityId === 'string' ? body.lineEntityId : '';
		const planId = typeof body.planId === 'string' ? body.planId : '';
		if (!lineEntityId || lineEntityId.length > 128 || !planId || planId.length > 128) {
			return json({ error: 'Choose a valid Auto-Refill plan.' }, { status: 400 });
		}

		const customerSession = await getKibbleCommerceSession(cookies);
		const cached = await getCachedKibbleCart(cartId);
		const current = await getKibbleCart(cartId, {
			sessionCookie: cached?.sessionCookie ?? await getKibbleCartSessionCookie(cartId) ?? customerSession?.providerSessionCookie,
			customerAccessToken: customerSession?.accessToken,
		});
		if (!current.cart || !current.cart.lineItems.physicalItems.some((line) => line.entityId === lineEntityId)) {
			return json({ error: 'That cart item is no longer available. Refresh your cart.' }, { status: 409 });
		}

		const line = current.cart.lineItems.physicalItems.find((candidate) => candidate.entityId === lineEntityId)!;
		// This slice's PDP adds one unit per request. Keep the fallback signal
		// aligned to that mutation rather than the cart line's post-merge total.
		addedLine = { productEntityId: line.productEntityId, quantity: 1 };
		// Resolve the bounded plan list server-side before writing the intent. The
		// subscription service remains authoritative, but this prevents a browser
		// from pairing a plan id from another product with this cart line.
		const plan = (await getKibbleSubscriptionPlans(line.productEntityId)).find((candidate) => candidate.id === planId);
		if (!plan) return json({ error: 'Choose a valid Auto-Refill plan.' }, { status: 400 });
		const intent = await setKibbleCartSubscriptionIntent(cartId, lineEntityId, planId, {
			cadence: plan.interval,
			intervalCount: plan.intervalCount,
		});
		await emitKibbleAddToCartSignal(cookies, line.productEntityId, line.quantity, 'auto-refill');
		return json({ cartId, lineEntityId, intent });
	} catch (error) {
		// The preceding PDP mutation is deliberately one-time-safe. If intent
		// confirmation fails after that line was found, record the actual fallback
		// state rather than implying Auto-Refill changed the cart.
		if (addedLine) await emitKibbleAddToCartSignal(cookies, addedLine.productEntityId, addedLine.quantity, 'one-time');
		const status = error instanceof KibbleSubscriptionError || error instanceof KibbleCommerceError ? error.status : 502;
		console.warn('[kibble-subscriptions] Intent write failed:', error instanceof Error ? error.message : error);
		return json({ error: status === 409 ? 'The cart changed. Refresh and choose Auto-Refill again.' : status === 400 ? 'Choose a valid Auto-Refill plan.' : 'Auto-Refill is temporarily unavailable. The item was added as a one-time purchase.' }, { status });
	}
};
