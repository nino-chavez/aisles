import type { CommerceServiceBoundary } from '$lib/commerce/cart-contract';
import {
	subscriptionPortalEvidence,
	type SubscriptionPortalActionInput,
	type SubscriptionPortalDetailPayload,
	type SubscriptionPortalError,
	type SubscriptionPortalListPayload,
	type SubscriptionPortalMutationPayload,
	type SubscriptionPortalOperation,
	type SubscriptionPortalState,
	type SubscriptionPortalStatusPayload,
} from '$lib/commerce/subscription-portal-contract';
import {
	createSubscriptionPortalProvider,
	SubscriptionPortalProviderError,
	type SubscriptionPortalProvider,
} from '$lib/server/subscription-portal';
import { getCommerceServiceBoundary } from './boundary';
import {
	CommerceIdempotencyMismatchError,
	CommerceOperationInProgressError,
	CommerceSessionUnavailableError,
	activeCustomerSession,
	activeSubscriptionPortalSession,
	coordinateCommerceMutation,
	loadCommerceSession,
} from './session';

interface PortalFailure {
	ok: false;
	status: number;
	error: SubscriptionPortalError;
	evidence: ReturnType<typeof subscriptionPortalEvidence>;
	services: CommerceServiceBoundary;
	replayed?: boolean;
}

interface PortalSuccess<T> {
	ok: true;
	status: number;
	data: T;
}

export type SubscriptionPortalResult<T> = PortalSuccess<T> | PortalFailure;

export function createSubscriberService(
	platform?: App.Platform,
	provider: SubscriptionPortalProvider = createSubscriptionPortalProvider(platform),
) {
	return {
		status: (sessionId: string) => portalStatus(sessionId, provider),
		connect: (sessionId: string, key: string) => connectPortal(sessionId, key, provider),
		disconnect: (sessionId: string, key: string) => disconnectPortal(sessionId, key),
		list: (sessionId: string) => listSubscriptions(sessionId, provider),
		detail: (sessionId: string, subscriptionId: string) => subscriptionDetail(sessionId, subscriptionId, provider),
		mutate: (sessionId: string, key: string, subscriptionId: string, input: SubscriptionPortalActionInput) =>
			mutateSubscription(sessionId, key, subscriptionId, input, provider),
	};
}

async function portalStatus(
	sessionId: string,
	provider: SubscriptionPortalProvider,
): Promise<SubscriptionPortalStatusPayload> {
	const services = getCommerceServiceBoundary();
	if (!provider.isConfigured()) return { state: 'provider_configuration_required', services };
	try {
		const state = await loadCommerceSession(sessionId);
		if (!activeCustomerSession(state)) return { state: 'customer_session_required', services };
		return { state: activeSubscriptionPortalSession(state) ? 'connected' : 'connection_required', services };
	} catch {
		return { state: 'unavailable', services };
	}
}

async function connectPortal(
	sessionId: string,
	key: string,
	provider: SubscriptionPortalProvider,
): Promise<SubscriptionPortalResult<SubscriptionPortalStatusPayload>> {
	const operation = 'subscription.portal.connect' as const;
	const services = getCommerceServiceBoundary();
	const correlationId = crypto.randomUUID();
	if (!provider.isConfigured()) return localFailure(operation, correlationId, services, 'provider_configuration_required');
	let attempted = false;
	try {
		const coordinated = await coordinateCommerceMutation<SubscriptionPortalResult<SubscriptionPortalStatusPayload>>({
			sessionId,
			idempotencyKey: key,
			fingerprint: operation,
			execute: async (state) => {
				const customer = activeCustomerSession(state);
				if (!customer) return { state, value: localFailure(operation, correlationId, services, 'customer_session_required') };
				try {
					attempted = true;
					const connected = await provider.exchangeCustomerSession({
						customerEntityId: customer.customerEntityId,
						email: customer.customerEmail,
					});
					state.subscriptionPortalSession = {
						provider: 'bc-subscriptions',
						bigCommerceCustomerEntityId: customer.customerEntityId,
						providerCustomerId: connected.providerCustomerId,
						sessionToken: connected.sessionToken,
						expiresAt: connected.expiresAt,
					};
					return {
						state,
						value: success(200, {
							state: 'connected',
							services,
							evidence: subscriptionPortalEvidence(operation, correlationId, {
								confirmed: true,
								subscriptionStateChanged: 'none',
							}),
						}),
					};
				} catch (cause) {
					return { state, value: providerFailure(cause, operation, correlationId, services, attempted) };
				}
			},
		});
		if (coordinated.replayed) markReplay(coordinated.value);
		return coordinated.value;
	} catch (cause) {
		return coordinationFailure(cause, operation, correlationId, services, attempted);
	}
}

async function disconnectPortal(
	sessionId: string,
	key: string,
): Promise<SubscriptionPortalResult<SubscriptionPortalStatusPayload>> {
	const operation = 'subscription.portal.disconnect' as const;
	const services = getCommerceServiceBoundary();
	const correlationId = crypto.randomUUID();
	try {
		const coordinated = await coordinateCommerceMutation<SubscriptionPortalResult<SubscriptionPortalStatusPayload>>({
			sessionId,
			idempotencyKey: key,
			fingerprint: operation,
			execute: async (state) => {
				state.subscriptionPortalSession = null;
				return {
					state,
					value: success(200, {
						state: activeCustomerSession(state) ? 'connection_required' : 'customer_session_required',
						services,
						evidence: subscriptionPortalEvidence(operation, correlationId, {
							attempted: false,
							confirmed: true,
							provider: 'none',
							subscriptionStateChanged: 'none',
						}),
					}),
				};
			},
		});
		if (coordinated.replayed) markReplay(coordinated.value);
		return coordinated.value;
	} catch (cause) {
		return coordinationFailure(cause, operation, correlationId, services, false);
	}
}

async function listSubscriptions(
	sessionId: string,
	provider: SubscriptionPortalProvider,
): Promise<SubscriptionPortalResult<SubscriptionPortalListPayload>> {
	const operation = 'subscription.portal.list' as const;
	const services = getCommerceServiceBoundary();
	const correlationId = crypto.randomUUID();
	const session = await requirePortalSession(sessionId, operation, correlationId, services, provider);
	if (!session.ok) return session.failure;
	try {
		const subscriptions = await provider.listSubscriptions(session.token);
		return success(200, {
			state: 'connected',
			subscriptions,
			services,
			evidence: subscriptionPortalEvidence(operation, correlationId, {
				confirmed: true,
				subscriptionStateChanged: 'none',
			}),
		});
	} catch (cause) {
		return providerFailure(cause, operation, correlationId, services, true);
	}
}

async function subscriptionDetail(
	sessionId: string,
	subscriptionId: string,
	provider: SubscriptionPortalProvider,
): Promise<SubscriptionPortalResult<SubscriptionPortalDetailPayload>> {
	const operation = 'subscription.portal.detail' as const;
	const services = getCommerceServiceBoundary();
	const correlationId = crypto.randomUUID();
	const session = await requirePortalSession(sessionId, operation, correlationId, services, provider);
	if (!session.ok) return session.failure;
	try {
		const subscription = await provider.getSubscription(session.token, subscriptionId);
		return success(200, {
			state: 'connected',
			subscription,
			services,
			evidence: subscriptionPortalEvidence(operation, correlationId, {
				confirmed: true,
				subscriptionStateChanged: 'none',
			}),
		});
	} catch (cause) {
		return providerFailure(cause, operation, correlationId, services, true);
	}
}

async function mutateSubscription(
	sessionId: string,
	key: string,
	subscriptionId: string,
	input: SubscriptionPortalActionInput,
	provider: SubscriptionPortalProvider,
): Promise<SubscriptionPortalResult<SubscriptionPortalMutationPayload>> {
	const operation = `subscription.portal.${input.action}` as SubscriptionPortalOperation;
	const services = getCommerceServiceBoundary();
	const correlationId = crypto.randomUUID();
	if (!provider.isConfigured()) return localFailure(operation, correlationId, services, 'provider_configuration_required');
	let attempted = false;
	try {
		const coordinated = await coordinateCommerceMutation<SubscriptionPortalResult<SubscriptionPortalMutationPayload>>({
			sessionId,
			idempotencyKey: key,
			fingerprint: JSON.stringify({ operation, subscriptionId, input }),
			execute: async (state) => {
				if (!activeCustomerSession(state)) return { state, value: localFailure(operation, correlationId, services, 'customer_session_required') };
				const portal = activeSubscriptionPortalSession(state);
				if (!portal) return { state, value: localFailure(operation, correlationId, services, 'portal_connection_required') };
				try {
					attempted = true;
					await provider.mutateSubscription(portal.sessionToken, subscriptionId, input);
					return {
						state,
						value: success(200, {
							state: 'connected',
							subscriptionId,
							services,
							evidence: subscriptionPortalEvidence(operation, correlationId, {
								confirmed: true,
								subscriptionStateChanged: 'confirmed',
							}),
						}),
					};
				} catch (cause) {
					return { state, value: providerFailure(cause, operation, correlationId, services, attempted) };
				}
			},
		});
		if (coordinated.replayed) markReplay(coordinated.value);
		return coordinated.value;
	} catch (cause) {
		return coordinationFailure(cause, operation, correlationId, services, attempted);
	}
}

async function requirePortalSession(
	sessionId: string,
	operation: SubscriptionPortalOperation,
	correlationId: string,
	services: CommerceServiceBoundary,
	provider: SubscriptionPortalProvider,
): Promise<{ ok: true; token: string } | { ok: false; failure: PortalFailure }> {
	if (!provider.isConfigured()) return { ok: false, failure: localFailure(operation, correlationId, services, 'provider_configuration_required') };
	try {
		const state = await loadCommerceSession(sessionId);
		if (!activeCustomerSession(state)) return { ok: false, failure: localFailure(operation, correlationId, services, 'customer_session_required') };
		const portal = activeSubscriptionPortalSession(state);
		if (!portal) return { ok: false, failure: localFailure(operation, correlationId, services, 'portal_connection_required') };
		return { ok: true, token: portal.sessionToken };
	} catch {
		return { ok: false, failure: localFailure(operation, correlationId, services, 'session_unavailable') };
	}
}

function success<T>(status: number, data: T): PortalSuccess<T> {
	return { ok: true, status, data };
}

function localFailure(
	operation: SubscriptionPortalOperation,
	correlationId: string,
	services: CommerceServiceBoundary,
	code: 'provider_configuration_required' | 'customer_session_required' | 'portal_connection_required' | 'session_unavailable',
): PortalFailure {
	const definitions = {
		provider_configuration_required: [503, 'The Auto-Refill portal handoff is not configured.', false],
		customer_session_required: [401, 'Sign in before connecting Auto-Refill management.', false],
		portal_connection_required: [401, 'Connect Auto-Refill management before reading or changing subscriptions.', false],
		session_unavailable: [503, 'The durable customer session is temporarily unavailable.', true],
	} as const;
	const [status, message, retryable] = definitions[code];
	return {
		ok: false,
		status,
		error: { code, message, retryable, correlationId },
		evidence: subscriptionPortalEvidence(operation, correlationId, {
			attempted: false,
			provider: 'none',
			subscriptionStateChanged: 'none',
		}),
		services,
	};
}

function providerFailure(
	cause: unknown,
	operation: SubscriptionPortalOperation,
	correlationId: string,
	services: CommerceServiceBoundary,
	attempted: boolean,
): PortalFailure {
	const error = cause instanceof SubscriptionPortalProviderError ? cause : new SubscriptionPortalProviderError('Subscription provider failed.');
	let status = 503;
	let code: SubscriptionPortalError['code'] = 'provider_unavailable';
	let message = 'The subscription provider is temporarily unavailable.';
	let retryable = true;
	if (error.options.status === 401 || error.options.status === 403) {
		status = 401;
		code = 'portal_session_expired';
		message = 'Reconnect Auto-Refill management before continuing.';
		retryable = false;
	} else if (error.options.status === 404) {
		status = 404;
		code = 'subscription_not_found';
		message = 'The subscription was not found for this customer.';
		retryable = false;
	} else if (error.options.status === 409) {
		status = 409;
		code = 'subscription_conflict';
		message = 'The subscription changed or this action is not currently allowed. Reload and try again.';
		retryable = true;
	} else if (error.options.outcomeUnknown) {
		status = 502;
		code = 'provider_outcome_unknown';
		message = 'The provider did not return a final outcome. Reload the subscription before trying another change.';
		retryable = false;
	}
	return {
		ok: false,
		status,
		error: { code, message, retryable, correlationId },
		evidence: subscriptionPortalEvidence(operation, correlationId, {
			attempted,
			confirmed: false,
			provider: attempted ? 'bc-subscriptions' : 'none',
			subscriptionStateChanged: attempted && changesSubscriptionState(operation) ? 'not_confirmed' : 'none',
		}),
		services,
	};
}

function coordinationFailure(
	cause: unknown,
	operation: SubscriptionPortalOperation,
	correlationId: string,
	services: CommerceServiceBoundary,
	attempted: boolean,
): PortalFailure {
	if (cause instanceof CommerceOperationInProgressError) {
		return failure(operation, correlationId, services, 'operation_in_progress', 'Another commerce change is still in progress.', 409, true, attempted);
	}
	if (cause instanceof CommerceIdempotencyMismatchError) {
		return failure(operation, correlationId, services, 'idempotency_mismatch', 'That request key was already used for a different change.', 409, false, attempted);
	}
	if (cause instanceof CommerceSessionUnavailableError) {
		return failure(operation, correlationId, services, 'session_unavailable', 'The durable customer session is temporarily unavailable.', 503, true, attempted);
	}
	return providerFailure(cause, operation, correlationId, services, attempted);
}

function failure(
	operation: SubscriptionPortalOperation,
	correlationId: string,
	services: CommerceServiceBoundary,
	code: SubscriptionPortalError['code'],
	message: string,
	status: number,
	retryable: boolean,
	attempted: boolean,
): PortalFailure {
	return {
		ok: false,
		status,
		error: { code, message, retryable, correlationId },
		evidence: subscriptionPortalEvidence(operation, correlationId, {
			attempted,
			provider: attempted ? 'bc-subscriptions' : 'none',
			subscriptionStateChanged: attempted && changesSubscriptionState(operation) ? 'not_confirmed' : 'none',
		}),
		services,
	};
}

function markReplay(result: SubscriptionPortalResult<unknown>): void {
	if (result.ok) {
		(result.data as { replayed?: boolean }).replayed = true;
	} else if (!result.ok) {
		result.replayed = true;
	}
}

function changesSubscriptionState(operation: SubscriptionPortalOperation): boolean {
	return operation !== 'subscription.portal.status' &&
		operation !== 'subscription.portal.connect' &&
		operation !== 'subscription.portal.disconnect' &&
		operation !== 'subscription.portal.list' &&
		operation !== 'subscription.portal.detail';
}
