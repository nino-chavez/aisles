import { json } from '@sveltejs/kit';
import type { SubscriptionPortalOperation } from '$lib/commerce/subscription-portal-contract';
import { subscriptionPortalEvidence } from '$lib/commerce/subscription-portal-contract';
import { getCommerceServiceBoundary } from './boundary';
import type { SubscriptionPortalResult } from './subscriber-service';
import {
	CommerceIdempotencyMismatchError,
	CommerceOperationInProgressError,
	CommerceRateLimitError,
	CommerceSessionUnavailableError,
} from './session';

export function subscriberResponse(result: SubscriptionPortalResult<unknown>) {
	return result.ok
		? json(result.data, { status: result.status, headers: privateHeaders() })
		: json(
			{
				error: result.error,
				evidence: result.evidence,
				services: result.services,
				...(result.replayed ? { replayed: true } : {}),
			},
			{ status: result.status, headers: privateHeaders() },
		);
}

export function subscriberGuardFailure(operation: SubscriptionPortalOperation, cause: unknown) {
	if (cause instanceof CommerceRateLimitError) {
		return subscriberLocalFailure(operation, 'rate_limited', 'Too many subscription changes. Wait a minute and try again.', 429, true);
	}
	if (cause instanceof CommerceOperationInProgressError) {
		return subscriberLocalFailure(operation, 'operation_in_progress', 'Another commerce change is still in progress.', 409, true);
	}
	if (cause instanceof CommerceIdempotencyMismatchError) {
		return subscriberLocalFailure(operation, 'idempotency_mismatch', 'That request key was already used for another change.', 409, false);
	}
	if (cause instanceof CommerceSessionUnavailableError) {
		return subscriberLocalFailure(operation, 'session_unavailable', 'The durable customer session is temporarily unavailable.', 503, true);
	}
	return subscriberLocalFailure(
		operation,
		'invalid_request',
		cause instanceof TypeError ? cause.message : 'The subscription request could not be read.',
		400,
		false,
	);
}

export function subscriberLocalFailure(
	operation: SubscriptionPortalOperation,
	code: 'invalid_request' | 'rate_limited' | 'session_unavailable' | 'operation_in_progress' | 'idempotency_mismatch',
	message: string,
	status: number,
	retryable: boolean,
) {
	const correlationId = crypto.randomUUID();
	return json(
		{
			error: { code, message, retryable, correlationId },
			evidence: subscriptionPortalEvidence(operation, correlationId, {
				attempted: false,
				provider: 'none',
				subscriptionStateChanged: 'none',
			}),
			services: getCommerceServiceBoundary(),
		},
		{ status, headers: privateHeaders() },
	);
}

export function privateHeaders() {
	return { 'Cache-Control': 'private, no-store' };
}
