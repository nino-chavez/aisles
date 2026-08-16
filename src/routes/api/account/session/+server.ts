import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { customerEvidence, type CustomerOperation } from '$lib/commerce/customer-contract';
import { getCommerceServiceBoundary } from '$lib/server/commerce/boundary';
import { customerService, type CustomerResult } from '$lib/server/commerce/customer-service';
import {
	CommerceRateLimitError,
	CommerceSessionUnavailableError,
	commerceSessionId,
	requireCommerceSessionId,
	requireCustomerAuthenticationCapacity,
	requireIdempotencyKey,
	requireSameOrigin,
} from '$lib/server/commerce/session';

export const GET: RequestHandler = async ({ cookies }) => {
	return json(await customerService.status(commerceSessionId(cookies)), {
		headers: privateHeaders(),
	});
};

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	try {
		requireSameOrigin(request);
		await requireCustomerAuthenticationCapacity(getClientAddress());
		const body = await request.json();
		const email = typeof body?.email === 'string' ? body.email.trim() : '';
		const password = typeof body?.password === 'string' ? body.password : '';
		if (!validEmail(email) || password.length < 1 || password.length > 1024) {
			return localFailure('account.login', 'invalid_request', 'A valid email and password are required.', 400, false);
		}
		return customerResponse(await customerService.login(
			requireCommerceSessionId(cookies),
			requireIdempotencyKey(request),
			{ email, password },
		));
	} catch (cause) {
		return guardFailure('account.login', cause);
	}
};

export const DELETE: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	try {
		requireSameOrigin(request);
		await requireCustomerAuthenticationCapacity(getClientAddress());
		return customerResponse(await customerService.logout(
			requireCommerceSessionId(cookies),
			requireIdempotencyKey(request),
		));
	} catch (cause) {
		return guardFailure('account.logout', cause);
	}
};

function validEmail(value: string): boolean {
	return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function customerResponse(result: CustomerResult<unknown>) {
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

function guardFailure(operation: CustomerOperation, cause: unknown) {
	if (cause instanceof CommerceRateLimitError) {
		return localFailure(operation, 'rate_limited', 'Too many account attempts. Wait a minute and try again.', 429, true);
	}
	if (cause instanceof CommerceSessionUnavailableError) {
		return localFailure(operation, 'session_unavailable', 'The customer session is temporarily unavailable.', 503, true);
	}
	return localFailure(
		operation,
		'invalid_request',
		cause instanceof TypeError ? cause.message : 'The account request could not be read.',
		400,
		false,
	);
}

function localFailure(
	operation: CustomerOperation,
	code: 'invalid_request' | 'rate_limited' | 'session_unavailable',
	message: string,
	status: number,
	retryable: boolean,
) {
	const correlationId = crypto.randomUUID();
	return json(
		{
			error: { code, message, retryable, correlationId },
			evidence: customerEvidence(operation, correlationId, {
				attempted: false,
				provider: 'none',
				sessionStateChanged: 'none',
			}),
			services: getCommerceServiceBoundary(),
		},
		{ status, headers: privateHeaders() },
	);
}

function privateHeaders() {
	return { 'Cache-Control': 'private, no-store' };
}
