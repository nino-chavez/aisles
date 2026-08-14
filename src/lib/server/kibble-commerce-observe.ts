import type { Cookies } from '@sveltejs/kit';
import { getSessionStore, hasSession, persistSession } from '$lib/signals/session';

/**
 * Observe receives a bounded commerce signal only after the provider mutation
 * or the subscription-intent confirmation succeeds. It never receives price,
 * product names, customer data, or provider credentials.
 */
export async function emitKibbleAddToCartSignal(
	cookies: Cookies,
	productEntityId: number,
	quantity: number,
	purchaseMode: 'one-time' | 'auto-refill' = 'one-time',
): Promise<void> {
	const sessionId = cookies.get('aisles_session');
	if (!sessionId || !(await hasSession(sessionId))) return;
	try {
		const store = await getSessionStore(sessionId);
		store.emit('commerce.add_to_cart', 'commerce', {
			productEntityId,
			quantity,
			purchaseMode,
		}, { page: '/product/[slug]' });
		await persistSession(store);
	} catch (error) {
		console.warn('[kibble-commerce] Failed to persist add-to-cart signal:', error instanceof Error ? error.message : error);
	}
}
