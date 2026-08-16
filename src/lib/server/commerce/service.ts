import { addToCart, BigCommerceGraphQLError, createCart, createCartRedirectUrl, deleteCart, deleteCartLineItem, getCart, getCartProductEligibility, updateCartLineItem, type BigCommerceCustomerContext, type CartResponse } from '$lib/server/bigcommerce';
import { operationEvidence, productPath, type CartPayload, type CommerceCart, type CommerceError, type CommerceOperation, type CommerceServiceBoundary } from '$lib/commerce/cart-contract';
import { getCommerceServiceBoundary, isKibbleCustomerIdentityEnabled } from './boundary';
import {
	CommerceIdempotencyMismatchError,
	CommerceOperationInProgressError,
	CommerceSessionUnavailableError,
	coordinateCommerceMutation,
	activeCustomerSession,
	clearExpiredCustomerSession,
	loadCommerceSession,
	type CommerceSessionState,
} from './session';

export interface CommerceFailure {
	ok: false;
	status: number;
	error: CommerceError;
	evidence: ReturnType<typeof operationEvidence>;
	services: CommerceServiceBoundary;
	replayed?: boolean;
}

export interface CommerceSuccess<T> {
	ok: true;
	status: number;
	data: T;
}

export type CommerceResult<T> = CommerceSuccess<T> | CommerceFailure;

interface Provider {
	createCart: typeof createCart;
	getCartProductEligibility: typeof getCartProductEligibility;
	addToCart: typeof addToCart;
	getCart: typeof getCart;
	updateCartLineItem: typeof updateCartLineItem;
	deleteCartLineItem: typeof deleteCartLineItem;
	deleteCart: typeof deleteCart;
	createCartRedirectUrl: typeof createCartRedirectUrl;
}

const defaultProvider: Provider = {
	createCart,
	getCartProductEligibility,
	addToCart,
	getCart,
	updateCartLineItem,
	deleteCartLineItem,
	deleteCart,
	createCartRedirectUrl,
};

export function createCommerceService(provider: Provider = defaultProvider) {
	return {
		read: (sessionId: string) => readCart(sessionId, provider),
		add: (sessionId: string, key: string, input: { productEntityId: number; quantity: number }) =>
			mutateCart(sessionId, key, 'cart.add', input, provider, async (state, current, callProvider) => {
				const customer = customerContext(state);
				const product = await callProvider(() => provider.getCartProductEligibility(input.productEntityId, customer));
				if (!product || !product.isInStock || product.hasOptions) throw knownError('product_not_available');
				const cart = current
					? await callProvider(() => provider.addToCart(current.entityId, input.productEntityId, input.quantity, current.version, customer))
					: await callProvider(() => provider.createCart(input.productEntityId, input.quantity, customer));
				state.cartEntityId = cart.entityId;
				return cart;
			}),
		update: (sessionId: string, key: string, input: { lineId: string; quantity: number }) =>
			mutateCart(sessionId, key, 'cart.update', input, provider, async (state, current, callProvider) => {
				if (!current) throw knownError('cart_not_found');
				const line = current.lineItems.physicalItems.find(({ entityId }) => entityId === input.lineId);
				if (!line) throw knownError('line_not_found');
				if (!line.isMutable) throw knownError('line_not_mutable');
				return callProvider(() => provider.updateCartLineItem(current.entityId, line.entityId, line.productEntityId, input.quantity, current.version, customerContext(state)));
			}),
		remove: (sessionId: string, key: string, input: { lineId: string }) =>
			mutateCart(sessionId, key, 'cart.remove', input, provider, async (state, current, callProvider) => {
				if (!current) throw knownError('cart_not_found');
				const line = current.lineItems.physicalItems.find(({ entityId }) => entityId === input.lineId);
				if (!line) throw knownError('line_not_found');
				if (!line.isMutable) throw knownError('line_not_mutable');
				const cart = await callProvider(() => provider.deleteCartLineItem(current.entityId, line.entityId, current.version, customerContext(state)));
				if (!cart) {
					state.cartEntityId = null;
					state.checkoutBlock = null;
				}
				return cart;
			}),
		empty: (sessionId: string, key: string) =>
			mutateCart(sessionId, key, 'cart.empty', {}, provider, async (state, current, callProvider) => {
				if (!current) throw knownError('cart_not_found');
				await callProvider(() => provider.deleteCart(current.entityId, customerContext(state)));
				state.cartEntityId = null;
				state.checkoutBlock = null;
				return null;
			}),
		checkout: (sessionId: string, key: string) => checkoutHandoff(sessionId, key, provider),
	};
}

async function readCart(sessionId: string, provider: Provider): Promise<CommerceResult<CartPayload>> {
	const correlationId = crypto.randomUUID();
	const services = getCommerceServiceBoundary();
	let providerAttempted = false;
	try {
		const state = await loadCommerceSession(sessionId);
		if (!state.cartEntityId) {
			return successCart(null, 'cart.read', correlationId, services, {
				attempted: false,
				provider: 'none',
			});
		}
		providerAttempted = true;
		const cart = await provider.getCart(state.cartEntityId, customerContext(state));
		// Reads never write session state. A delayed stale-cart read must not
		// overwrite a newer cart reference persisted by a concurrent mutation.
		// The next serialized mutation performs confirmed stale-cart recovery.
		if (!cart) return successCart(null, 'cart.read', correlationId, services);
		return successCart(requireCommerceCartVersion(cart, false), 'cart.read', correlationId, services);
	} catch (cause) {
		return failureFrom(infrastructureCause(cause), 'cart.read', correlationId, services, providerAttempted);
	}
}

async function mutateCart<T extends Record<string, unknown>>(
	sessionId: string,
	idempotencyKey: string,
	operation: Exclude<CommerceOperation, 'cart.read' | 'checkout.handoff'>,
	input: T,
	provider: Provider,
	apply: (state: CommerceSessionState, current: CartResponse | null, callProvider: <R>(call: () => Promise<R>) => Promise<R>) => Promise<CartResponse | null>,
): Promise<CommerceResult<CartPayload>> {
	const services = getCommerceServiceBoundary();
	const correlationId = crypto.randomUUID();
	let providerAttempted = false;
	const callProvider = async <R>(call: () => Promise<R>): Promise<R> => {
		providerAttempted = true;
		return call();
	};
	try {
		const coordinated = await coordinateCommerceMutation<CommerceResult<CartPayload>>({
			sessionId,
			idempotencyKey,
			fingerprint: JSON.stringify({ operation, ...input }),
			execute: async (state) => {
				try {
					clearExpiredCustomerSession(state);
					const providerCurrent = state.cartEntityId ? await callProvider(() => provider.getCart(state.cartEntityId!, customerContext(state))) : null;
					const current = providerCurrent ? requireCommerceCartVersion(providerCurrent, false) : null;
					if (state.cartEntityId && !current) state.cartEntityId = null;
					const providerCart = await apply(state, current, callProvider);
					const cart = providerCart ? requireCommerceCartVersion(providerCart, true) : null;
					if (cart) state.cartEntityId = cart.entityId;
					return {
						state,
						value: successCart(cart, operation, correlationId, services, {
							changed: 'confirmed',
						}),
					};
				} catch (cause) {
					return {
						state,
						value: failureFrom(cause, operation, correlationId, services, providerAttempted),
					};
				}
			},
		});
		const value = coordinated.value;
		if (coordinated.replayed) {
			if (value.ok) value.data.replayed = true;
			else value.replayed = true;
		}
		return value;
	} catch (cause) {
		return failureFrom(infrastructureCause(cause), operation, correlationId, services, providerAttempted);
	}
}

async function checkoutHandoff(
	sessionId: string,
	key: string,
	provider: Provider,
): Promise<
	CommerceResult<{
		redirectUrl: string;
		evidence: ReturnType<typeof operationEvidence>;
		services: CommerceServiceBoundary;
		replayed?: boolean;
	}>
> {
	const services = getCommerceServiceBoundary();
	const correlationId = crypto.randomUUID();
	let providerAttempted = false;
	const callProvider = async <R>(call: () => Promise<R>): Promise<R> => {
		providerAttempted = true;
		return call();
	};
	try {
		const coordinated = await coordinateCommerceMutation<
			CommerceResult<{
				redirectUrl: string;
				evidence: ReturnType<typeof operationEvidence>;
				services: CommerceServiceBoundary;
				replayed?: boolean;
			}>
			>({
				sessionId,
				idempotencyKey: key,
				fingerprint: 'checkout.handoff',
				// BigCommerce checkout URLs are single-use and must be minted just in
				// time. Serialize concurrent attempts, but never replay a stored URL.
				persistResult: false,
				execute: async (state) => {
				try {
					clearExpiredCustomerSession(state);
					if (state.checkoutBlock) throw checkoutBlockedError();
					if (!state.cartEntityId) throw knownError('cart_not_found');
					const cart = await callProvider(() => provider.getCart(state.cartEntityId!, customerContext(state)));
					if (!cart || cart.lineItems.physicalItems.length === 0) {
						state.cartEntityId = null;
						throw knownError('cart_not_found');
					}
					const redirectUrl = await callProvider(() => provider.createCartRedirectUrl(cart.entityId, customerContext(state)));
					return {
						state,
						value: {
							ok: true as const,
							status: 200,
							data: {
								redirectUrl,
								evidence: operationEvidence('checkout.handoff', correlationId, {
									confirmed: true,
									changed: 'none',
								}),
								services,
							},
						},
					};
				} catch (cause) {
					return {
						state,
						value: failureFrom(cause, 'checkout.handoff', correlationId, services, providerAttempted),
					};
				}
			},
		});
		if (coordinated.replayed) {
			if (coordinated.value.ok) coordinated.value.data.replayed = true;
			else coordinated.value.replayed = true;
		}
		return coordinated.value;
	} catch (cause) {
		return failureFrom(infrastructureCause(cause), 'checkout.handoff', correlationId, services, providerAttempted);
	}
}

function customerContext(state: CommerceSessionState): BigCommerceCustomerContext | undefined {
	if (!isKibbleCustomerIdentityEnabled()) return undefined;
	const customer = activeCustomerSession(state);
	return customer ? { customerAccessToken: customer.customerAccessToken } : undefined;
}

function successCart(
	cart: CartResponse | null,
	operation: CommerceOperation,
	correlationId: string,
	services: CommerceServiceBoundary,
	evidenceOptions: Parameters<typeof operationEvidence>[2] = {
		confirmed: true,
		changed: 'none',
	},
): CommerceSuccess<CartPayload> {
	const normalized = cart ? normalizeCart(cart) : null;
	return {
		ok: true,
		status: 200,
		data: {
			cart: normalized,
			itemCount: normalized?.itemCount ?? 0,
			evidence: operationEvidence(operation, correlationId, {
				confirmed: true,
				changed: 'none',
				...evidenceOptions,
			}),
			services,
		},
	};
}

export function normalizeCart(cart: CartResponse): CommerceCart {
	const lines = cart.lineItems.physicalItems.map((line) => ({
		lineId: line.entityId,
		productEntityId: line.productEntityId,
		variantEntityId: line.variantEntityId,
		name: line.name,
		imageUrl: line.imageUrl,
		productPath: productPath(line.path),
		isMutable: line.isMutable,
		quantity: line.quantity,
		unitPrice: line.salePrice ?? line.listPrice,
		extendedPrice: line.extendedSalePrice ?? line.extendedListPrice,
		subscription: null,
	}));
	return {
		version: cart.version,
		currencyCode: cart.currencyCode,
		itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
		subtotal: cart.baseAmount,
		total: cart.amount,
		lines,
	};
}

function requireCommerceCartVersion(cart: CartResponse, outcomeUnknown: boolean): CartResponse {
	if (!Number.isInteger(cart.version) || cart.version < 0) {
		throw new BigCommerceGraphQLError('BigCommerce returned a cart without usable concurrency metadata.', {
			outcomeUnknown,
		});
	}
	return cart;
}

class KnownCommerceError extends Error {
	constructor(readonly code: 'cart_not_found' | 'line_not_found' | 'line_not_mutable' | 'product_not_available' | 'checkout_unavailable') {
		super(code);
	}
}

function knownError(code: KnownCommerceError['code']): KnownCommerceError {
	return new KnownCommerceError(code);
}

function checkoutBlockedError(): KnownCommerceError {
	return knownError('checkout_unavailable');
}

function infrastructureCause(cause: unknown): unknown {
	return cause instanceof BigCommerceGraphQLError ||
		cause instanceof CommerceSessionUnavailableError ||
		cause instanceof CommerceOperationInProgressError ||
		cause instanceof CommerceIdempotencyMismatchError ||
		cause instanceof KnownCommerceError
		? cause
		: new CommerceSessionUnavailableError('Commerce session infrastructure failed.');
}

function failureFrom(cause: unknown, operation: CommerceOperation, correlationId: string, services: CommerceServiceBoundary, providerAttempted = true): CommerceFailure {
	let status = 502;
	let code: CommerceError['code'] = 'provider_unavailable';
	let message = 'The commerce service is temporarily unavailable.';
	let retryable = true;

	if (cause instanceof CommerceSessionUnavailableError) {
		status = 503;
		code = 'session_unavailable';
		message = 'The cart session is temporarily unavailable.';
	} else if (cause instanceof CommerceOperationInProgressError) {
		status = 409;
		code = 'operation_in_progress';
		message = 'Another cart change is still in progress.';
	} else if (cause instanceof CommerceIdempotencyMismatchError) {
		status = 409;
		code = 'idempotency_mismatch';
		message = 'This operation key was already used for a different cart change.';
		retryable = false;
	} else if (cause instanceof KnownCommerceError) {
		status = cause.code === 'product_not_available' ? 422 : cause.code === 'line_not_mutable' || cause.code === 'checkout_unavailable' ? 409 : 404;
		code = cause.code;
		message =
			cause.code === 'checkout_unavailable'
				? 'Checkout is paused until the subscription intent is confirmed or removed.'
				: cause.code === 'product_not_available'
				? 'This product is not eligible for the optionless one-time cart.'
				: cause.code === 'line_not_mutable'
					? 'BigCommerce does not allow this cart item to be changed.'
					: cause.code === 'line_not_found'
					? 'That cart item no longer exists.'
					: 'The cart no longer exists.';
		retryable = false;
	} else if (cause instanceof BigCommerceGraphQLError) {
		const hint = `${cause.providerCode ?? ''} ${cause.message}`.toLowerCase();
		if (cause.outcomeUnknown && operation !== 'cart.read') {
			status = 502;
			code = 'provider_outcome_unknown';
			message =
				operation === 'checkout.handoff'
					? 'BigCommerce did not confirm the checkout handoff. Refresh the cart before trying again.'
					: 'BigCommerce did not confirm whether the cart changed. Refresh the cart before taking another action.';
			retryable = false;
		} else if (cause.status === 409 || hint.includes('conflict') || hint.includes('version')) {
			status = 409;
			code = 'cart_conflict';
			message = 'The cart changed elsewhere. Refresh it before trying again.';
		} else if (operation === 'checkout.handoff') {
			status = 503;
			code = 'checkout_unavailable';
			message = 'Hosted checkout is temporarily unavailable.';
		}
	}

	return {
		ok: false,
		status,
		error: { code, message, retryable, correlationId },
		evidence: operationEvidence(operation, correlationId, {
			attempted: providerAttempted,
			provider: providerAttempted ? 'bigcommerce' : 'none',
			changed:
				!providerAttempted ||
				cause instanceof KnownCommerceError ||
				(cause instanceof BigCommerceGraphQLError && !cause.outcomeUnknown) ||
				operation === 'cart.read' ||
				operation === 'checkout.handoff'
					? 'none'
					: 'not_confirmed',
		}),
		services,
	};
}

export const commerceService = createCommerceService();
