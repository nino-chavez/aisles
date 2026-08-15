import { operationEvidence, type CommerceError, type CommerceServiceBoundary } from '$lib/commerce/cart-contract';
import type { SubscriptionIntentPayload, SubscriptionPlansPayload, SubscriptionPlan } from '$lib/commerce/subscription-contract';
import {
	addToCart,
	BigCommerceGraphQLError,
	createCart,
	deleteCartLineItem,
	getCart,
	getCartProductEligibility,
	type BigCommerceCustomerContext,
	type CartResponse,
} from '$lib/server/bigcommerce';
import { createSubscriptionProvider, SubscriptionProviderError, type CartSubscriptionIntent, type SubscriptionProvider } from '$lib/server/subscriptions';
import { getCommerceServiceBoundary, isKibbleSubscriptionIntentEnabled, isKibbleSubscriptionPlanLookupEnabled } from './boundary';
import {
	activeCustomerSession,
	clearExpiredCustomerSession,
	CommerceIdempotencyMismatchError,
	CommerceOperationInProgressError,
	CommerceSessionUnavailableError,
	coordinateCommerceMutation,
	loadCommerceSession,
	type CommerceSessionState,
} from './session';

interface CartProvider {
	getCartProductEligibility: typeof getCartProductEligibility;
	createCart: typeof createCart;
	addToCart: typeof addToCart;
	getCart: typeof getCart;
	deleteCartLineItem: typeof deleteCartLineItem;
}

const defaultCartProvider: CartProvider = {
	getCartProductEligibility,
	createCart,
	addToCart,
	getCart,
	deleteCartLineItem,
};

type Failure = {
	ok: false;
	status: number;
	error: CommerceError;
	evidence: ReturnType<typeof operationEvidence>;
	services: CommerceServiceBoundary;
	replayed?: boolean;
};

type Result<T> = { ok: true; status: number; data: T } | Failure;

export function createSubscriptionCommerceService(
	platform?: App.Platform,
	dependencies?: { subscriptionProvider?: SubscriptionProvider; cartProvider?: CartProvider },
) {
	const subscriptionProvider = dependencies?.subscriptionProvider ?? createSubscriptionProvider(platform);
	const cartProvider = dependencies?.cartProvider ?? defaultCartProvider;
	return {
		plans: (productEntityId: number) => readPlans(productEntityId, subscriptionProvider),
		cartIntents: async (sessionId: string): Promise<{ status: 'confirmed' | 'unavailable' | 'disabled'; intents: Record<string, CartSubscriptionIntent> }> => {
			if (!isKibbleSubscriptionPlanLookupEnabled()) return { status: 'disabled' as const, intents: {} };
			try {
				const state = await loadCommerceSession(sessionId);
				if (!state.cartEntityId) return { status: 'confirmed' as const, intents: {} };
				return { status: 'confirmed' as const, intents: await subscriptionProvider.listCartIntents(state.cartEntityId) };
			} catch {
				return { status: 'unavailable' as const, intents: {} };
			}
		},
		intent: (sessionId: string, idempotencyKey: string, input: { productEntityId: number; planId: string }) =>
			createIntent(sessionId, idempotencyKey, input, subscriptionProvider, cartProvider),
	};
}

async function readPlans(productEntityId: number, provider: SubscriptionProvider): Promise<Result<SubscriptionPlansPayload>> {
	const correlationId = crypto.randomUUID();
	const services = getCommerceServiceBoundary();
	if (!isKibbleSubscriptionPlanLookupEnabled()) {
		return localFailure('subscription_unavailable', 'Auto-Refill plan lookup is not enabled.', 503, correlationId, services);
	}
	try {
		const plans = await provider.listPlans(productEntityId);
		return {
			ok: true,
			status: 200,
			data: {
				plans,
				services,
				evidence: operationEvidence('subscription.plans.read', correlationId, {
					attempted: true,
					confirmed: true,
					changed: 'none',
					provider: 'bc-subscriptions',
				}),
			},
		};
	} catch {
		return providerFailure('The Auto-Refill plans are temporarily unavailable.', correlationId, services, false);
	}
}

async function createIntent(
	sessionId: string,
	idempotencyKey: string,
	input: { productEntityId: number; planId: string },
	subscriptionProvider: SubscriptionProvider,
	cartProvider: CartProvider,
): Promise<Result<SubscriptionIntentPayload>> {
	const correlationId = crypto.randomUUID();
	const services = getCommerceServiceBoundary();
	if (!isKibbleSubscriptionIntentEnabled()) {
		const identityReady = services.account === 'bigcommerce_login_ready';
		return localFailure(
			identityReady ? 'subscription_unavailable' : 'customer_session_required',
			identityReady ? 'Auto-Refill cart intents are not enabled.' : 'Sign in before adding an Auto-Refill plan.',
			identityReady ? 503 : 403,
			correlationId,
			services,
		);
	}

	let attemptedProvider: 'bigcommerce' | 'bc-subscriptions' | 'none' = 'none';
	try {
		const coordinated = await coordinateCommerceMutation<Result<SubscriptionIntentPayload>>({
			sessionId,
			idempotencyKey,
			fingerprint: JSON.stringify({ operation: 'subscription.intent.create', ...input }),
			execute: async (state) => {
				let cart: CartResponse | null = null;
				let addedLineId: string | null = null;
				try {
					clearExpiredCustomerSession(state);
					const customer = customerContext(state);
					if (!customer) throw new LocalSubscriptionError('customer_session_required');

					attemptedProvider = 'bc-subscriptions';
					const plans = await subscriptionProvider.listPlans(input.productEntityId);
					const plan = plans.find(({ id }) => id === input.planId);
					if (!plan) throw new LocalSubscriptionError('plan_not_found');
					if (plan.productEntityId !== input.productEntityId) throw new LocalSubscriptionError('plan_product_mismatch');

					attemptedProvider = 'bigcommerce';
					const eligibility = await cartProvider.getCartProductEligibility(input.productEntityId, customer);
					if (!eligibility || !eligibility.isInStock || eligibility.hasOptions) throw new LocalSubscriptionError('product_not_available');
					cart = state.cartEntityId ? await cartProvider.getCart(state.cartEntityId, customer) : null;
					if (state.cartEntityId && !cart) state.cartEntityId = null;
					requireCartVersion(cart);
					let line = cart?.lineItems.physicalItems.find(({ productEntityId }) => productEntityId === input.productEntityId && Boolean(productEntityId));
					if (line && !line.isMutable) throw new LocalSubscriptionError('line_not_mutable');
					if (!line) {
						cart = cart
							? await cartProvider.addToCart(cart.entityId, input.productEntityId, 1, cart.version, customer)
							: await cartProvider.createCart(input.productEntityId, 1, customer);
						requireCartVersion(cart);
						state.cartEntityId = cart.entityId;
						line = cart.lineItems.physicalItems.find(({ productEntityId }) => productEntityId === input.productEntityId);
						if (!line) throw new BigCommerceGraphQLError('BigCommerce omitted the added subscription line.', { outcomeUnknown: true });
						addedLineId = line.entityId;
					}

					attemptedProvider = 'bc-subscriptions';
					const currentPlanId = await subscriptionProvider.getCartIntent(cart!.entityId, line.entityId);
					if (currentPlanId !== plan.id) await subscriptionProvider.createCartIntent(cart!.entityId, line.entityId, plan.id);
					state.checkoutBlock = null;
					return {
						state,
						value: intentSuccess(plan, cart!, correlationId, services, currentPlanId === plan.id),
					};
				} catch (cause) {
					const failureProvider = attemptedProvider;
					const ambiguous = cause instanceof SubscriptionProviderError
						? cause.options.outcomeUnknown === true
						: cause instanceof BigCommerceGraphQLError && cause.outcomeUnknown;
					let compensated = false;
					if (addedLineId && cart) {
						try {
							attemptedProvider = 'bigcommerce';
							const afterRemoval = await cartProvider.deleteCartLineItem(cart.entityId, addedLineId, cart.version, customerContext(state));
							state.cartEntityId = afterRemoval?.entityId ?? null;
							compensated = true;
						} catch {
							compensated = false;
						}
					}
					if (ambiguous && !compensated) {
						state.checkoutBlock = { reason: 'subscription_intent_unconfirmed', setAt: new Date().toISOString() };
					}
					return {
						state,
						value: intentFailure(cause, correlationId, services, failureProvider),
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
		return intentFailure(cause, correlationId, services, attemptedProvider);
	}
}

function intentSuccess(
	plan: SubscriptionPlan,
	cart: CartResponse,
	correlationId: string,
	services: CommerceServiceBoundary,
	alreadyConfirmed: boolean,
): Result<SubscriptionIntentPayload> {
	return {
		ok: true,
		status: 200,
		data: {
			plan,
			itemCount: cart.lineItems.physicalItems.reduce((sum, line) => sum + line.quantity, 0),
			services,
			evidence: operationEvidence('subscription.intent.create', correlationId, {
				attempted: true,
				confirmed: true,
				changed: alreadyConfirmed ? 'none' : 'confirmed',
				provider: 'bc-subscriptions',
			}),
		},
	};
}

function intentFailure(
	cause: unknown,
	correlationId: string,
	services: CommerceServiceBoundary,
	provider: 'bigcommerce' | 'bc-subscriptions' | 'none',
): Failure {
	if (cause instanceof CommerceSessionUnavailableError) return localFailure('session_unavailable', 'The cart session is temporarily unavailable.', 503, correlationId, services, true);
	if (cause instanceof CommerceOperationInProgressError) return localFailure('operation_in_progress', 'Another cart change is still in progress.', 409, correlationId, services, true);
	if (cause instanceof CommerceIdempotencyMismatchError) return localFailure('idempotency_mismatch', 'This operation key was already used for a different change.', 409, correlationId, services);
	if (cause instanceof LocalSubscriptionError) {
		const details: Record<LocalSubscriptionError['code'], [CommerceError['code'], string, number]> = {
			customer_session_required: ['customer_session_required', 'Sign in before adding an Auto-Refill plan.', 403],
			plan_not_found: ['plan_not_found', 'That Auto-Refill plan is no longer available.', 404],
			plan_product_mismatch: ['plan_product_mismatch', 'That Auto-Refill plan does not belong to this product.', 409],
			product_not_available: ['product_not_available', 'This product is not eligible for Auto-Refill.', 422],
			line_not_mutable: ['line_not_mutable', 'BigCommerce does not allow this cart item to be changed.', 409],
		};
		const [code, message, status] = details[cause.code];
		return {
			ok: false,
			status,
			error: { code, message, retryable: false, correlationId },
			evidence: operationEvidence('subscription.intent.create', correlationId, {
				attempted: provider !== 'none',
				confirmed: false,
				changed: 'none',
				provider,
			}),
			services,
		};
	}
	const ambiguous = cause instanceof SubscriptionProviderError
		? cause.options.outcomeUnknown === true
		: cause instanceof BigCommerceGraphQLError && cause.outcomeUnknown;
	const conflict = cause instanceof SubscriptionProviderError && cause.options.status === 409;
	return {
		ok: false,
		status: conflict ? 409 : 502,
		error: {
			code: ambiguous ? 'provider_outcome_unknown' : conflict ? 'cart_conflict' : 'provider_unavailable',
			message: ambiguous
				? 'The Auto-Refill intent was not confirmed. Checkout is paused if recovery could not remove the affected line.'
				: conflict
					? 'The Auto-Refill cart intent changed elsewhere. Refresh the cart before trying again.'
				: 'The Auto-Refill service is temporarily unavailable.',
			retryable: !ambiguous,
			correlationId,
		},
		evidence: operationEvidence('subscription.intent.create', correlationId, {
			attempted: provider !== 'none',
			confirmed: false,
			changed: 'not_confirmed',
			provider,
		}),
		services,
	};
}

function providerFailure(message: string, correlationId: string, services: CommerceServiceBoundary, outcomeUnknown: boolean): Failure {
	return {
		ok: false,
		status: 502,
		error: { code: outcomeUnknown ? 'provider_outcome_unknown' : 'provider_unavailable', message, retryable: !outcomeUnknown, correlationId },
		evidence: operationEvidence('subscription.plans.read', correlationId, {
			attempted: true,
			confirmed: false,
			changed: 'none',
			provider: 'bc-subscriptions',
		}),
		services,
	};
}

function localFailure(
	code: CommerceError['code'],
	message: string,
	status: number,
	correlationId: string,
	services: CommerceServiceBoundary,
	retryable = false,
): Failure {
	return {
		ok: false,
		status,
		error: { code, message, retryable, correlationId },
		evidence: operationEvidence('subscription.intent.create', correlationId, {
			attempted: false,
			confirmed: false,
			changed: 'none',
			provider: 'none',
		}),
		services,
	};
}

function customerContext(state: CommerceSessionState): BigCommerceCustomerContext | undefined {
	const session = activeCustomerSession(state);
	return session ? { customerAccessToken: session.customerAccessToken } : undefined;
}

function requireCartVersion(cart: CartResponse | null): void {
	if (cart && (!Number.isInteger(cart.version) || cart.version < 0)) {
		throw new BigCommerceGraphQLError('BigCommerce returned unusable cart concurrency metadata.');
	}
}

class LocalSubscriptionError extends Error {
	constructor(readonly code: 'customer_session_required' | 'plan_not_found' | 'plan_product_mismatch' | 'product_not_available' | 'line_not_mutable') {
		super(code);
	}
}
