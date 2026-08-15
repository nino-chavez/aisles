export type CommerceOperation = 'cart.read' | 'cart.add' | 'cart.update' | 'cart.remove' | 'cart.empty' | 'checkout.handoff' | 'subscription.plans.read' | 'subscription.intent.create';

export interface CommerceMoney {
	value: number;
	currencyCode: string;
}

export interface CommerceCartLine {
	lineId: string;
	productEntityId: number;
	variantEntityId: number | null;
	name: string;
	imageUrl: string | null;
	productPath: string;
	isMutable: boolean;
	quantity: number;
	unitPrice: CommerceMoney;
	extendedPrice: CommerceMoney;
	subscription?: {
		planId: string;
		name: string;
		cadence: string;
		recurringPrice: CommerceMoney;
	} | null;
}

export interface CommerceCart {
	version: number;
	currencyCode: string;
	itemCount: number;
	subtotal: CommerceMoney;
	total: CommerceMoney;
	lines: CommerceCartLine[];
}

export type CommerceErrorCode =
	| 'commerce_disabled'
	| 'invalid_request'
	| 'session_unavailable'
	| 'cart_not_found'
	| 'line_not_found'
	| 'line_not_mutable'
	| 'product_not_available'
	| 'cart_conflict'
	| 'rate_limited'
	| 'operation_in_progress'
	| 'idempotency_mismatch'
	| 'provider_unavailable'
	| 'provider_outcome_unknown'
	| 'checkout_unavailable'
	| 'customer_session_required'
	| 'subscription_unavailable'
	| 'plan_not_found'
	| 'plan_product_mismatch';

export interface CommerceError {
	code: CommerceErrorCode;
	message: string;
	retryable: boolean;
	correlationId: string;
}

/**
 * Redacted service evidence. It deliberately excludes shopper identity, cart IDs,
 * product names, checkout URLs, and provider error text.
 */
export interface CommerceEvidence {
	operation: CommerceOperation;
	attempted: boolean;
	confirmed: boolean;
	provider: 'bigcommerce' | 'bc-subscriptions' | 'none';
	commerceStateChanged: 'confirmed' | 'not_confirmed' | 'none';
	modelCalls: 0;
	correlationId: string;
}

export interface CommerceServiceBoundary {
	mode: 'off' | 'sandbox';
	cart: 'not_connected' | 'bigcommerce_sandbox';
	checkout: 'not_connected' | 'bigcommerce_hosted_handoff';
	orderCreation: 'not_exposed';
	orderHistory: 'customer_session_required';
	account: 'merchant_decision_required' | 'private_token_required' | 'bigcommerce_login_ready';
	payment: 'provider_owned';
	subscription: 'provider_not_connected' | 'plan_lookup_ready' | 'authenticated_intent_ready';
	subscriptionPortal: 'provider_not_connected' | 'handoff_secret_required' | 'portal_session_required';
}

export interface CartPayload {
	cart: CommerceCart | null;
	itemCount: number;
	evidence: CommerceEvidence;
	services: CommerceServiceBoundary;
	replayed?: boolean;
}

export function operationEvidence(
	operation: CommerceOperation,
	correlationId: string,
	options: {
		attempted?: boolean;
		confirmed?: boolean;
		changed?: CommerceEvidence['commerceStateChanged'];
		provider?: CommerceEvidence['provider'];
	} = {},
): CommerceEvidence {
	return {
		operation,
		attempted: options.attempted ?? true,
		confirmed: options.confirmed ?? false,
		provider: options.provider ?? 'bigcommerce',
		commerceStateChanged: options.changed ?? 'not_confirmed',
		modelCalls: 0,
		correlationId,
	};
}

export function productPath(url: string): string {
	let pathname: string;
	try {
		pathname = new URL(url).pathname;
	} catch {
		pathname = (url.startsWith('/') ? url : `/${url}`).replace(/\/+/g, '/');
	}
	const slug = pathname.split('/').filter(Boolean).at(-1) ?? '';
	return /^[a-z0-9][a-z0-9-]*$/.test(slug) ? `/product/${slug}` : '/';
}
