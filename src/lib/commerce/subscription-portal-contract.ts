import type { CommerceServiceBoundary } from './cart-contract';

export type SubscriptionPortalOperation =
	| 'subscription.portal.status'
	| 'subscription.portal.connect'
	| 'subscription.portal.disconnect'
	| 'subscription.portal.list'
	| 'subscription.portal.detail'
	| 'subscription.portal.skip'
	| 'subscription.portal.pause'
	| 'subscription.portal.resume'
	| 'subscription.portal.reschedule'
	| 'subscription.portal.cancel'
	| 'subscription.portal.reactivate';

export type SubscriptionPortalState =
	| 'provider_configuration_required'
	| 'customer_session_required'
	| 'connection_required'
	| 'connected'
	| 'unavailable';

export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'past_due' | 'unknown';

export interface SubscriptionPortalSummary {
	id: string;
	status: SubscriptionStatus;
	planId: string;
	planName: string;
	recurringPrice: { value: number; currencyCode: string };
	cadence: string;
	productEntityId: number | null;
	nextChargeAt: string | null;
	currentPeriodEnd: string;
	createdAt: string;
	cancelledAt: string | null;
	cyclesCompleted: number;
	prepaidCyclesTotal: number | null;
	prepaidCyclesRemaining: number | null;
}

export interface SubscriptionChargeSummary {
	id: string;
	amount: { value: number; currencyCode: string };
	status: string;
	scheduledAt: string;
	attemptedAt: string | null;
	succeededAt: string | null;
}

export interface SubscriptionPortalDetail extends SubscriptionPortalSummary {
	cancelReason: string | null;
	charges: SubscriptionChargeSummary[];
}

export interface SubscriptionPortalEvidence {
	operation: SubscriptionPortalOperation;
	attempted: boolean;
	confirmed: boolean;
	provider: 'bc-subscriptions' | 'none';
	subscriptionStateChanged: 'confirmed' | 'not_confirmed' | 'none';
	modelCalls: 0;
	correlationId: string;
}

export type SubscriptionPortalErrorCode =
	| 'invalid_request'
	| 'provider_configuration_required'
	| 'customer_session_required'
	| 'portal_connection_required'
	| 'portal_session_expired'
	| 'subscription_not_found'
	| 'subscription_conflict'
	| 'rate_limited'
	| 'session_unavailable'
	| 'operation_in_progress'
	| 'idempotency_mismatch'
	| 'provider_unavailable'
	| 'provider_outcome_unknown';

export interface SubscriptionPortalError {
	code: SubscriptionPortalErrorCode;
	message: string;
	retryable: boolean;
	correlationId: string;
}

export interface SubscriptionPortalStatusPayload {
	state: SubscriptionPortalState;
	services: CommerceServiceBoundary;
	evidence?: SubscriptionPortalEvidence;
}

export interface SubscriptionPortalListPayload extends SubscriptionPortalStatusPayload {
	subscriptions: SubscriptionPortalSummary[];
}

export interface SubscriptionPortalDetailPayload extends SubscriptionPortalStatusPayload {
	subscription: SubscriptionPortalDetail;
}

export interface SubscriptionPortalMutationPayload extends SubscriptionPortalStatusPayload {
	subscriptionId: string;
	replayed?: boolean;
}

export type SubscriptionPortalAction = 'skip' | 'pause' | 'resume' | 'reschedule' | 'cancel' | 'reactivate';

export type SubscriptionPortalActionInput =
	| { action: 'skip' }
	| { action: 'pause'; weeks: number }
	| { action: 'resume' }
	| { action: 'reschedule'; nextChargeDate: string }
	| { action: 'cancel' }
	| { action: 'reactivate' };

export function subscriptionPortalEvidence(
	operation: SubscriptionPortalOperation,
	correlationId: string,
	options: Partial<Omit<SubscriptionPortalEvidence, 'operation' | 'correlationId' | 'modelCalls'>> = {},
): SubscriptionPortalEvidence {
	return {
		operation,
		attempted: options.attempted ?? true,
		confirmed: options.confirmed ?? false,
		provider: options.provider ?? 'bc-subscriptions',
		subscriptionStateChanged: options.subscriptionStateChanged ?? 'not_confirmed',
		modelCalls: 0,
		correlationId,
	};
}
