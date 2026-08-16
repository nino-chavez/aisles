import {
	BigCommerceGraphQLError,
	BigCommerceCustomerSessionError,
	getBigCommerceCustomerOrders,
	loginBigCommerceCustomer,
	logoutBigCommerceCustomer,
	type BigCommerceCustomerContext,
	type BigCommerceCustomerLoginResult,
	type BigCommerceCustomerOrderSummary,
} from '$lib/server/bigcommerce';
import {
	customerEvidence,
	type CustomerError,
	type CustomerOperation,
	type CustomerOrdersPayload,
	type CustomerSessionPayload,
} from '$lib/commerce/customer-contract';
import type { CommerceServiceBoundary } from '$lib/commerce/cart-contract';
import { getCommerceServiceBoundary, isKibbleCustomerIdentityEnabled } from './boundary';
import {
	CommerceIdempotencyMismatchError,
	CommerceOperationInProgressError,
	CommerceSessionUnavailableError,
	activeCustomerSession,
	clearExpiredCustomerSession,
	coordinateCommerceMutation,
	loadCommerceSession,
	type CommerceSessionState,
} from './session';

interface CustomerProvider {
	login: (input: { email: string; password: string; guestCartEntityId: string | null }) => Promise<BigCommerceCustomerLoginResult>;
	logout: (customer: BigCommerceCustomerContext, cartEntityId: string | null) => Promise<string | null>;
	orders: (customer: BigCommerceCustomerContext, limit?: number) => Promise<BigCommerceCustomerOrderSummary[]>;
}

const defaultProvider: CustomerProvider = {
	login: loginBigCommerceCustomer,
	logout: logoutBigCommerceCustomer,
	orders: getBigCommerceCustomerOrders,
};

interface CustomerFailure {
	ok: false;
	status: number;
	error: CustomerError;
	evidence: ReturnType<typeof customerEvidence>;
	services: CommerceServiceBoundary;
	replayed?: boolean;
}

interface CustomerSuccess<T> {
	ok: true;
	status: number;
	data: T;
}

export type CustomerResult<T> = CustomerSuccess<T> | CustomerFailure;

export function createCustomerService(provider: CustomerProvider = defaultProvider) {
	return {
		status: (sessionId: string) => customerStatus(sessionId),
		login: (sessionId: string, key: string, credentials: { email: string; password: string }) =>
			loginCustomer(sessionId, key, credentials, provider),
		logout: (sessionId: string, key: string) => logoutCustomer(sessionId, key, provider),
		orders: (sessionId: string, limit = 25) => customerOrders(sessionId, limit, provider),
	};
}

async function customerStatus(sessionId: string): Promise<CustomerSessionPayload> {
	const services = getCommerceServiceBoundary();
	if (!isKibbleCustomerIdentityEnabled()) return { state: 'disabled', services };
	try {
		const state = await loadCommerceSession(sessionId);
		return { state: activeCustomerSession(state) ? 'authenticated' : 'anonymous', services };
	} catch {
		return { state: 'unavailable', services };
	}
}

async function loginCustomer(
	sessionId: string,
	key: string,
	credentials: { email: string; password: string },
	provider: CustomerProvider,
): Promise<CustomerResult<CustomerSessionPayload>> {
	const services = getCommerceServiceBoundary();
	const correlationId = crypto.randomUUID();
	if (!isKibbleCustomerIdentityEnabled()) return disabled('account.login', correlationId, services);
	let providerAttempted = false;
	try {
		const coordinated = await coordinateCommerceMutation<CustomerResult<CustomerSessionPayload>>({
			sessionId,
			idempotencyKey: key,
			// Do not persist any credential-derived fingerprint. The key replays one
			// generic terminal result for this server session and never reruns login.
			fingerprint: 'account.login',
			execute: async (state) => {
				clearExpiredCustomerSession(state);
				const guestCartEntityId = state.cartEntityId;
				try {
					providerAttempted = true;
					const login = await provider.login({ ...credentials, guestCartEntityId });
					if (Date.parse(login.expiresAt) <= Date.now()) {
						throw new BigCommerceGraphQLError('BigCommerce returned an expired customer session.');
					}
					state.customerSession = {
						provider: 'bigcommerce',
						customerEntityId: login.customerEntityId,
						customerAccessToken: login.customerAccessToken,
						expiresAt: login.expiresAt,
					};
					state.cartEntityId = login.cartEntityId;
					return {
						state,
						value: {
							ok: true,
							status: 200,
							data: {
								state: 'authenticated',
								services,
								evidence: customerEvidence('account.login', correlationId, {
									confirmed: true,
									sessionStateChanged: 'confirmed',
									guestCartAssignment: !guestCartEntityId
										? 'none'
										: login.cartEntityId
											? 'confirmed'
											: 'not_confirmed',
								}),
							},
						},
					};
				} catch (cause) {
					return {
						state,
						value: customerFailure(cause, 'account.login', correlationId, services, providerAttempted, Boolean(guestCartEntityId)),
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
		return customerFailure(cause, 'account.login', correlationId, services, providerAttempted);
	}
}

async function logoutCustomer(
	sessionId: string,
	key: string,
	provider: CustomerProvider,
): Promise<CustomerResult<CustomerSessionPayload>> {
	const services = getCommerceServiceBoundary();
	const correlationId = crypto.randomUUID();
	if (!isKibbleCustomerIdentityEnabled()) return disabled('account.logout', correlationId, services);
	let providerAttempted = false;
	try {
		const coordinated = await coordinateCommerceMutation<CustomerResult<CustomerSessionPayload>>({
			sessionId,
			idempotencyKey: key,
			fingerprint: 'account.logout',
			execute: async (state) => {
				const customer = activeCustomerSession(state);
				if (!customer) {
					clearExpiredCustomerSession(state);
					return {
						state,
						value: customerFailure(new CustomerSessionRequiredError(), 'account.logout', correlationId, services, false),
					};
				}
				try {
					providerAttempted = true;
					const cartEntityId = await provider.logout(context(customer), state.cartEntityId);
					state.customerSession = null;
					state.cartEntityId = cartEntityId;
					return {
						state,
						value: {
							ok: true,
							status: 200,
							data: {
								state: 'anonymous',
								services,
								evidence: customerEvidence('account.logout', correlationId, {
									confirmed: true,
									sessionStateChanged: 'confirmed',
								}),
							},
						},
					};
				} catch (cause) {
					return { state, value: customerFailure(cause, 'account.logout', correlationId, services, providerAttempted, Boolean(state.cartEntityId)) };
				}
			},
		});
		if (coordinated.replayed) {
			if (coordinated.value.ok) coordinated.value.data.replayed = true;
			else coordinated.value.replayed = true;
		}
		return coordinated.value;
	} catch (cause) {
		return customerFailure(cause, 'account.logout', correlationId, services, providerAttempted);
	}
}

async function customerOrders(
	sessionId: string,
	limit: number,
	provider: CustomerProvider,
): Promise<CustomerResult<CustomerOrdersPayload>> {
	const services = getCommerceServiceBoundary();
	const correlationId = crypto.randomUUID();
	if (!isKibbleCustomerIdentityEnabled()) return disabled('order.history', correlationId, services);
	let providerAttempted = false;
	try {
		const state = await loadCommerceSession(sessionId);
		const customer = activeCustomerSession(state);
		if (!customer) {
			return customerFailure(new CustomerSessionRequiredError(Boolean(state.customerSession)), 'order.history', correlationId, services, false);
		}
		providerAttempted = true;
		const orders = await provider.orders(context(customer), limit);
		return {
			ok: true,
			status: 200,
			data: {
				orders: orders.map((order) => ({
					orderId: order.entityId,
					orderedAt: order.orderedAt,
					status: order.status,
					total: order.total,
					itemCount: order.itemCount,
				})),
				evidence: customerEvidence('order.history', correlationId, {
					confirmed: true,
					sessionStateChanged: 'none',
				}),
				services,
			},
		};
	} catch (cause) {
		return customerFailure(cause, 'order.history', correlationId, services, providerAttempted);
	}
}

class CustomerSessionRequiredError extends Error {
	constructor(readonly expired = false) {
		super(expired ? 'customer_session_expired' : 'customer_session_required');
	}
}

function context(customer: NonNullable<CommerceSessionState['customerSession']>): BigCommerceCustomerContext {
	return { customerAccessToken: customer.customerAccessToken };
}

function disabled(
	operation: CustomerOperation,
	correlationId: string,
	services: CommerceServiceBoundary,
): CustomerFailure {
	return customerFailure(new AccountNotConfiguredError(), operation, correlationId, services, false);
}

class AccountNotConfiguredError extends Error {}

function customerFailure(
	cause: unknown,
	operation: CustomerOperation,
	correlationId: string,
	services: CommerceServiceBoundary,
	providerAttempted: boolean,
	providerCartPresent = false,
): CustomerFailure {
	let status = 502;
	let code: CustomerError['code'] = 'provider_unavailable';
	let message = 'The customer service is temporarily unavailable.';
	let retryable = true;

	if (cause instanceof AccountNotConfiguredError) {
		status = 503;
		code = 'account_not_configured';
		message = services.account === 'merchant_decision_required'
			? 'The merchant has not selected the customer identity owner.'
			: 'The customer service private token is not configured.';
		retryable = false;
	} else if (cause instanceof CustomerSessionRequiredError || cause instanceof BigCommerceCustomerSessionError) {
		status = 401;
		const expired = cause instanceof BigCommerceCustomerSessionError || cause.expired;
		code = expired ? 'customer_session_expired' : 'customer_session_required';
		message = expired ? 'The customer session expired. Sign in again.' : 'Sign in before requesting customer data.';
		retryable = false;
	} else if (cause instanceof CommerceSessionUnavailableError) {
		status = 503;
		code = 'session_unavailable';
		message = 'The customer session is temporarily unavailable.';
	} else if (cause instanceof CommerceOperationInProgressError) {
		status = 409;
		code = 'operation_in_progress';
		message = 'Another account change is still in progress.';
	} else if (cause instanceof CommerceIdempotencyMismatchError) {
		status = 409;
		code = 'idempotency_mismatch';
		message = 'This operation key was already used for another account change.';
		retryable = false;
	} else if (cause instanceof BigCommerceGraphQLError) {
		if (cause.outcomeUnknown) {
			code = 'provider_outcome_unknown';
			message = 'BigCommerce did not confirm the account operation. Do not repeat it automatically.';
			retryable = false;
		} else if (operation === 'account.login') {
			status = 401;
			code = 'authentication_failed';
			message = 'The sign-in details were not accepted.';
			retryable = false;
		}
	}

	const ambiguous = cause instanceof BigCommerceGraphQLError && cause.outcomeUnknown;
	return {
		ok: false,
		status,
		error: { code, message, retryable, correlationId },
		evidence: customerEvidence(operation, correlationId, {
			attempted: providerAttempted,
			provider: providerAttempted ? 'bigcommerce' : 'none',
			sessionStateChanged: ambiguous ? 'not_confirmed' : 'none',
			guestCartAssignment: ambiguous && providerCartPresent ? 'not_confirmed' : 'none',
		}),
		services,
	};
}

export const customerService = createCustomerService();
