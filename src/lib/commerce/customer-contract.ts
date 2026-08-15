import type { CommerceMoney, CommerceServiceBoundary } from './cart-contract';

export type CustomerOperation = 'account.login' | 'account.logout' | 'order.history';

export type CustomerErrorCode =
	| 'account_not_configured'
	| 'invalid_request'
	| 'authentication_failed'
	| 'customer_session_required'
	| 'customer_session_expired'
	| 'session_unavailable'
	| 'rate_limited'
	| 'operation_in_progress'
	| 'idempotency_mismatch'
	| 'provider_unavailable'
	| 'provider_outcome_unknown';

export interface CustomerError {
	code: CustomerErrorCode;
	message: string;
	retryable: boolean;
	correlationId: string;
}

/** Redacted evidence: no credentials, identity fields, cart IDs, or order IDs. */
export interface CustomerEvidence {
	operation: CustomerOperation;
	attempted: boolean;
	confirmed: boolean;
	provider: 'bigcommerce' | 'none';
	sessionStateChanged: 'confirmed' | 'not_confirmed' | 'none';
	guestCartAssignment: 'confirmed' | 'not_confirmed' | 'none';
	modelCalls: 0;
	correlationId: string;
}

export type CustomerSessionStateView = 'disabled' | 'anonymous' | 'authenticated' | 'unavailable';

export interface CustomerOrderSummary {
	orderId: number;
	orderedAt: string;
	status: string;
	total: CommerceMoney;
	itemCount: number;
}

export interface CustomerSessionPayload {
	state: CustomerSessionStateView;
	evidence?: CustomerEvidence;
	services: CommerceServiceBoundary;
	replayed?: boolean;
}

export interface CustomerOrdersPayload {
	orders: CustomerOrderSummary[];
	evidence: CustomerEvidence;
	services: CommerceServiceBoundary;
}

export function customerEvidence(
	operation: CustomerOperation,
	correlationId: string,
	options: Partial<Omit<CustomerEvidence, 'operation' | 'correlationId' | 'modelCalls'>> = {},
): CustomerEvidence {
	return {
		operation,
		attempted: options.attempted ?? true,
		confirmed: options.confirmed ?? false,
		provider: options.provider ?? 'bigcommerce',
		sessionStateChanged: options.sessionStateChanged ?? 'not_confirmed',
		guestCartAssignment: options.guestCartAssignment ?? 'none',
		modelCalls: 0,
		correlationId,
	};
}
