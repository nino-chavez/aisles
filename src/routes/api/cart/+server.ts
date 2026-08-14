import { json } from '@sveltejs/kit';
import type { Cookies } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createCart, addToCart, getCart, getKibbleProductDetailByPath } from '$lib/server/bigcommerce';
import {
	addKibbleCartLine,
	createKibbleCart,
	deleteKibbleCartLine,
	getKibbleCart,
	getKibbleCommerceMode,
	KibbleCommerceError,
	updateKibbleCartLine,
	type KibbleCart,
	type KibbleCartLineInput,
} from '$lib/server/kibble-commerce';
import {
	cacheKibbleCart,
	evictKibbleCart,
	getCachedKibbleCart,
	getKibbleCartSessionCookie,
} from '$lib/server/kibble-cart-store';
import { defaultEvaluator } from '$lib/server/incentives';
import {
	readAppliedCodes,
	writeAppliedCodes,
	buildIncentivesContext,
	loadSessionIncentives,
} from '$lib/server/incentives/session';
import { getSessionStore, persistSession, hasSession } from '$lib/signals/session';
import { EMPTY_INCENTIVES, type IncentivesPayload } from '$lib/schema/uip';
import { getBrand } from '$lib/brand/config';

type BCCart = NonNullable<Awaited<ReturnType<typeof getCart>>>;

const KIBBLE_CART_UNAVAILABLE = 'Cart is unavailable for this Kibble reference-preserved preview.';

function kibbleCartPayload(cart: KibbleCart | null) {
	return {
		cart,
		itemCount: cart?.lineItems.totalQuantity ?? cart?.lineItems.physicalItems.reduce((sum, item) => sum + item.quantity, 0) ?? 0,
	};
}

function validPositiveInteger(value: unknown, max: number): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= max;
}

function parseKibbleSelections(value: unknown): Array<{ optionEntityId: number; optionValueEntityId: number }> {
	if (value === undefined) return [];
	if (!Array.isArray(value) || value.length > 10) throw new KibbleCommerceError('Invalid product options.', 400, 'validation');
	return value.map((selection) => {
		if (!selection || typeof selection !== 'object') throw new KibbleCommerceError('Invalid product options.', 400, 'validation');
		const optionEntityId = (selection as Record<string, unknown>).optionEntityId;
		const optionValueEntityId = (selection as Record<string, unknown>).optionValueEntityId;
		if (!validPositiveInteger(optionEntityId, 2_147_483_647) || !validPositiveInteger(optionValueEntityId, 2_147_483_647)) {
			throw new KibbleCommerceError('Invalid product options.', 400, 'validation');
		}
		return { optionEntityId, optionValueEntityId };
	});
}

async function validateKibbleLine(body: Record<string, unknown>): Promise<KibbleCartLineInput> {
	const productEntityId = body.productEntityId;
	const quantity = body.quantity === undefined ? 1 : body.quantity;
	const productSlug = body.productSlug;
	if (!validPositiveInteger(productEntityId, 2_147_483_647)) {
		throw new KibbleCommerceError('Invalid product.', 400, 'validation');
	}
	if (!validPositiveInteger(quantity, 99)) {
		throw new KibbleCommerceError('Quantity must be a whole number from 1 to 99.', 400, 'validation');
	}
	if (typeof productSlug !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(productSlug) || productSlug.length > 160) {
		throw new KibbleCommerceError('Invalid product.', 400, 'validation');
	}

	// Re-read the trusted catalog detail so the browser cannot invent a product
	// or option value. This is a catalog read, not a commerce mutation.
	const detail = await getKibbleProductDetailByPath(`/${productSlug}/`);
	if (!detail || detail.entityId !== productEntityId) {
		throw new KibbleCommerceError('Product is no longer available.', 400, 'validation');
	}

	const selections = parseKibbleSelections(body.selectedOptions);
	const options = detail.productOptions.edges.map(({ node }) => node);
	const allowedValues = new Map(options.map((option) => [
		option.entityId,
		new Set(option.values?.edges.map(({ node }) => node.entityId) ?? []),
	]));
	const selectedIds = new Set<number>();
	for (const selection of selections) {
		if (selectedIds.has(selection.optionEntityId) || !allowedValues.has(selection.optionEntityId) || !allowedValues.get(selection.optionEntityId)?.has(selection.optionValueEntityId)) {
			throw new KibbleCommerceError('Invalid product options.', 400, 'validation');
		}
		selectedIds.add(selection.optionEntityId);
	}
	for (const option of options) {
		if (option.isRequired && !selectedIds.has(option.entityId)) {
			throw new KibbleCommerceError(`Select ${option.displayName}.`, 400, 'validation');
		}
	}

	return {
		productEntityId,
		quantity,
		...(selections.length > 0 ? { selectedOptions: { multipleChoices: selections } } : {}),
	};
}

async function emitKibbleAddToCartSignal(cookies: Cookies, productEntityId: number, quantity: number): Promise<void> {
	const sessionId = cookies.get('aisles_session');
	if (!sessionId || !(await hasSession(sessionId))) return;
	try {
		const store = await getSessionStore(sessionId);
		// Keep the signal useful for inference without copying price, product
		// names, customer data, or provider tokens into Observe.
		store.emit('commerce.add_to_cart', 'commerce', {
			productEntityId,
			quantity,
			purchaseMode: 'one-time',
		}, { page: '/product/[slug]' });
		await persistSession(store);
	} catch (error) {
		console.warn('[kibble-commerce] Failed to persist add-to-cart signal:', error instanceof Error ? error.message : error);
	}
}

async function getKibbleCartForRequest(cartId: string): Promise<KibbleCart | null> {
	const cached = await getCachedKibbleCart(cartId);
	if (cached) return cached.cart;
	const result = await getKibbleCart(cartId, { sessionCookie: await getKibbleCartSessionCookie(cartId) });
	if (!result.cart) return null;
	await cacheKibbleCart(result.cart, result.sessionCookie);
	return result.cart;
}

async function handleKibblePost(request: Request, cookies: Cookies) {
	if (getKibbleCommerceMode() === 'off') return json({ error: KIBBLE_CART_UNAVAILABLE }, { status: 503 });
	const body = await request.json() as Record<string, unknown>;
	if (body.action) return json({ error: 'Promotions are not available in this slice.' }, { status: 400 });
	const lineItem = await validateKibbleLine(body);
	const cartId = cookies.get('bc_cart_id');
	let result;
	let previousSessionCookie: string | null = null;
	if (cartId) {
		const sessionCookie = await getKibbleCartSessionCookie(cartId);
		previousSessionCookie = sessionCookie;
		try {
			result = await addKibbleCartLine(cartId, lineItem, { sessionCookie });
		} catch (error) {
			if (!(error instanceof KibbleCommerceError) || error.kind !== 'stale-cart') throw error;
			await evictKibbleCart(cartId);
			result = await createKibbleCart(lineItem);
		}
	} else {
		result = await createKibbleCart(lineItem);
	}
	await cacheKibbleCart(result.cart, result.sessionCookie ?? previousSessionCookie);
	cookies.set('bc_cart_id', result.cart.entityId, {
		path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30,
	});
	await emitKibbleAddToCartSignal(cookies, lineItem.productEntityId, lineItem.quantity);
	return json(kibbleCartPayload(result.cart));
}

async function handleKibblePatch(request: Request, cookies: Cookies) {
	if (getKibbleCommerceMode() === 'off') return json({ error: KIBBLE_CART_UNAVAILABLE }, { status: 503 });
	const body = await request.json() as Record<string, unknown>;
	const lineItemEntityId = body.lineItemEntityId;
	const quantity = body.quantity;
	if (typeof lineItemEntityId !== 'string' || !lineItemEntityId || typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 0 || quantity > 99) {
		return json({ error: 'Invalid line item or quantity.' }, { status: 400 });
	}
	const cartId = cookies.get('bc_cart_id');
	if (!cartId) return json({ error: 'No cart.' }, { status: 404 });
	let cached = await getCachedKibbleCart(cartId);
	if (!cached) {
		const recovered = await getKibbleCart(cartId, { sessionCookie: await getKibbleCartSessionCookie(cartId) });
		if (!recovered.cart) {
			await evictKibbleCart(cartId);
			cookies.delete('bc_cart_id', { path: '/' });
			return json({ error: 'Your cart has expired.' }, { status: 409 });
		}
		await cacheKibbleCart(recovered.cart, recovered.sessionCookie);
		cached = { cart: recovered.cart, sessionCookie: recovered.sessionCookie };
	}
	const existing = cached?.cart.lineItems.physicalItems.find((item) => item.entityId === lineItemEntityId);
	if (!existing) return json({ error: 'Line item not found.' }, { status: 404 });
	const sessionCookie = cached?.sessionCookie ?? undefined;
	if (quantity === 0) {
		let result;
		try {
			result = await deleteKibbleCartLine(cartId, lineItemEntityId, { sessionCookie });
		} catch (error) {
			if (!(error instanceof KibbleCommerceError) || error.kind !== 'stale-cart') throw error;
			await evictKibbleCart(cartId);
			cookies.delete('bc_cart_id', { path: '/' });
			return json({ error: 'Your cart has expired.' }, { status: 409 });
		}
		if (!result.cart) {
			await evictKibbleCart(cartId);
			cookies.delete('bc_cart_id', { path: '/' });
			return json(kibbleCartPayload(null));
		}
		await cacheKibbleCart(result.cart, result.sessionCookie ?? sessionCookie ?? null);
		return json(kibbleCartPayload(result.cart));
	}
	let result;
	try {
		result = await updateKibbleCartLine(cartId, lineItemEntityId, {
			productEntityId: existing.productEntityId,
			quantity,
			...(existing.variantEntityId ? { variantEntityId: existing.variantEntityId } : {}),
		}, { sessionCookie });
	} catch (error) {
		if (!(error instanceof KibbleCommerceError) || error.kind !== 'stale-cart') throw error;
		await evictKibbleCart(cartId);
		cookies.delete('bc_cart_id', { path: '/' });
		return json({ error: 'Your cart has expired.' }, { status: 409 });
	}
	await cacheKibbleCart(result.cart, result.sessionCookie ?? sessionCookie ?? null);
	return json(kibbleCartPayload(result.cart));
}

async function handleKibbleGet(cookies: Cookies) {
	if (getKibbleCommerceMode() === 'off') return json({ error: KIBBLE_CART_UNAVAILABLE }, { status: 503 });
	const cartId = cookies.get('bc_cart_id');
	if (!cartId) return json(kibbleCartPayload(null));
	try {
		const cart = await getKibbleCartForRequest(cartId);
		if (!cart) {
			await evictKibbleCart(cartId);
			cookies.delete('bc_cart_id', { path: '/' });
		}
		return json(kibbleCartPayload(cart));
	} catch {
		return json({ ...kibbleCartPayload(null), error: 'Cart is temporarily unavailable.' }, { status: 503 });
	}
}

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
	if (getBrand().id === 'kibble') {
		try {
			return await handleKibblePost(request, cookies);
		} catch (error) {
			const status = error instanceof KibbleCommerceError ? error.status : 502;
			console.warn('[kibble-commerce] Add-to-cart failed:', error instanceof Error ? error.message : error);
			return json({ error: status === 400 ? (error as Error).message : 'Cart is temporarily unavailable.' }, { status });
		}
	}
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

/** PATCH /api/cart — Kibble quantity update; quantity 0 removes the line. */
export const PATCH: RequestHandler = async ({ request, cookies }) => {
	if (getBrand().id !== 'kibble') return json({ error: 'Cart updates are unavailable.' }, { status: 404 });
	try {
		return await handleKibblePatch(request, cookies);
	} catch (error) {
		const status = error instanceof KibbleCommerceError ? error.status : 502;
		console.warn('[kibble-commerce] Cart update failed:', error instanceof Error ? error.message : error);
		return json({ error: status === 400 ? (error as Error).message : 'Cart is temporarily unavailable.' }, { status });
	}
};

/** GET /api/cart — Get current cart with UIP incentives payload. */
export const GET: RequestHandler = async ({ cookies }) => {
	if (getBrand().id === 'kibble') {
		return handleKibbleGet(cookies);
	}
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
