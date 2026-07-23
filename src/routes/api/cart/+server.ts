import { json } from '@sveltejs/kit';
import type { Cookies } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createCart, addToCart, getCart } from '$lib/server/bigcommerce';
import { defaultEvaluator } from '$lib/server/incentives';
import {
	readAppliedCodes,
	writeAppliedCodes,
	buildIncentivesContext,
	loadSessionIncentives,
} from '$lib/server/incentives/session';
import { getSessionStore, persistSession, hasSession } from '$lib/signals/session';
import { EMPTY_INCENTIVES, type IncentivesPayload } from '$lib/schema/uip';

type BCCart = NonNullable<Awaited<ReturnType<typeof getCart>>>;

async function resolveIncentives(cart: BCCart | null, appliedCodes: string[]): Promise<IncentivesPayload> {
	try {
		return await defaultEvaluator.evaluate(buildIncentivesContext(cart, appliedCodes));
	} catch (err) {
		console.error('Incentives evaluation failed, falling back to empty payload:', err);
		return EMPTY_INCENTIVES;
	}
}

/**
 * Emit commerce.promo_applied + refresh the tier_progress_view snapshot into
 * the session store so the Observe dashboard reflects the change immediately,
 * without waiting for the next page navigation. Silently no-ops if the session
 * hasn't been initialized yet (agent-only clients without a session cookie).
 */
async function emitPromoSignal(
	cookies: Cookies,
	action: 'apply' | 'remove',
	code: string,
): Promise<void> {
	const sessionId = cookies.get('aisles_session');
	if (!sessionId) return;
	if (!(await hasSession(sessionId))) return;

	try {
		const store = await getSessionStore(sessionId);
		store.emit('commerce.promo_applied', 'commerce', { action, code });
		// Re-run the evaluator so tier_progress_view reflects the latest state.
		await loadSessionIncentives(store, cookies);
		await persistSession(store);
	} catch (err) {
		console.warn('Failed to emit promo signal:', err);
	}
}

/** POST /api/cart — Add item to cart, or apply/remove a promotion code. */
export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const body = await request.json();

		// Code management: { action: 'apply'|'remove', code: string }
		if (body.action === 'apply' || body.action === 'remove') {
			const code = typeof body.code === 'string' ? body.code.trim() : '';
			if (!code) return json({ error: 'Missing code' }, { status: 400 });

			const existing = readAppliedCodes(cookies);
			const next =
				body.action === 'apply'
					? Array.from(new Set([...existing, code]))
					: existing.filter((c) => c !== code);
			writeAppliedCodes(cookies, next);

			// Fire the session-level signal in parallel with cart fetching.
			const signalWork = emitPromoSignal(cookies, body.action, code);

			const cartId = cookies.get('bc_cart_id');
			const cart = cartId ? await getCart(cartId) : null;
			if (!cart) {
				await signalWork;
				return json({ cart: null, itemCount: 0, appliedCodes: next, ...EMPTY_INCENTIVES });
			}
			const itemCount = cart.lineItems.physicalItems.reduce((sum, item) => sum + item.quantity, 0);
			const incentives = await resolveIncentives(cart, next);
			await signalWork;
			return json({ cart, itemCount, appliedCodes: next, ...incentives });
		}

		// Default: add line item
		const { productEntityId, quantity = 1 } = body;
		if (!productEntityId) {
			return json({ error: 'Missing productEntityId' }, { status: 400 });
		}

		const cartId = cookies.get('bc_cart_id');
		let cart;

		if (cartId) {
			try {
				cart = await addToCart(cartId, productEntityId, quantity);
			} catch {
				cart = await createCart(productEntityId, quantity);
			}
		} else {
			cart = await createCart(productEntityId, quantity);
		}

		cookies.set('bc_cart_id', cart.entityId, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 30,
		});

		const appliedCodes = readAppliedCodes(cookies);
		const itemCount = cart.lineItems.physicalItems.reduce((sum, item) => sum + item.quantity, 0);
		const incentives = await resolveIncentives(cart, appliedCodes);

		return json({ cart, itemCount, appliedCodes, ...incentives });
	} catch (err) {
		console.error('Cart operation failed:', err);
		return json(
			{ error: 'Cart operation failed', message: err instanceof Error ? err.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};

/** GET /api/cart — Get current cart with UIP incentives payload. */
export const GET: RequestHandler = async ({ cookies }) => {
	const cartId = cookies.get('bc_cart_id');
	const appliedCodes = readAppliedCodes(cookies);

	if (!cartId) {
		return json({ cart: null, itemCount: 0, appliedCodes, ...EMPTY_INCENTIVES });
	}

	try {
		const cart = await getCart(cartId);
		if (!cart) {
			cookies.delete('bc_cart_id', { path: '/' });
			return json({ cart: null, itemCount: 0, appliedCodes, ...EMPTY_INCENTIVES });
		}

		const itemCount = cart.lineItems.physicalItems.reduce((sum, item) => sum + item.quantity, 0);
		const incentives = await resolveIncentives(cart, appliedCodes);
		return json({ cart, itemCount, appliedCodes, ...incentives });
	} catch {
		return json({ cart: null, itemCount: 0, appliedCodes, ...EMPTY_INCENTIVES });
	}
};
