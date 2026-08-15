import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isKibbleCommerceEnabled, getCommerceServiceBoundary } from '$lib/server/commerce/boundary';
import { commerceService } from '$lib/server/commerce/service';
import {
	CommerceRateLimitError,
	CommerceSessionUnavailableError,
	requireCommerceSessionId,
	requireCommerceMutationCapacity,
	requireIdempotencyKey,
	requireSameOrigin,
} from '$lib/server/commerce/session';
import { operationEvidence, type CommerceOperation } from '$lib/commerce/cart-contract';

export const PATCH: RequestHandler = async ({ params, request, cookies, getClientAddress }) => {
	if (!isKibbleCommerceEnabled()) return disabled('cart.update');
	try {
		requireSameOrigin(request);
		const body = await request.json();
		const quantity = Number(body?.quantity);
		if (!validLineId(params.lineId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
			return invalid('cart.update', 'A valid cart item and quantity from 1 to 99 are required.');
		}
		await requireCommerceMutationCapacity(getClientAddress());
		return respond(await commerceService.update(requireCommerceSessionId(cookies), requireIdempotencyKey(request), { lineId: params.lineId, quantity }));
	} catch (cause) {
		return guardFailure('cart.update', cause);
	}
};

export const DELETE: RequestHandler = async ({ params, request, cookies, getClientAddress }) => {
	if (!isKibbleCommerceEnabled()) return disabled('cart.remove');
	try {
		requireSameOrigin(request);
		if (!validLineId(params.lineId)) return invalid('cart.remove', 'A valid cart item is required.');
		await requireCommerceMutationCapacity(getClientAddress());
		return respond(await commerceService.remove(requireCommerceSessionId(cookies), requireIdempotencyKey(request), { lineId: params.lineId }));
	} catch (cause) {
		return guardFailure('cart.remove', cause);
	}
};

function validLineId(lineId: string): boolean {
	return /^[A-Za-z0-9_-]{1,128}$/.test(lineId);
}

function respond(result: Awaited<ReturnType<typeof commerceService.update>>) {
	return result.ok
		? json(result.data, { status: result.status, headers: commerceHeaders() })
		: json(
				{
					error: result.error,
					evidence: result.evidence,
					services: result.services,
					...(result.replayed ? { replayed: true } : {}),
				},
				{ status: result.status, headers: commerceHeaders() },
			);
}

function disabled(operation: CommerceOperation) {
	const correlationId = crypto.randomUUID();
	return json(
		{
			error: {
				code: 'commerce_disabled',
				message: 'Kibble sandbox commerce is not enabled.',
				retryable: false,
				correlationId,
			},
			evidence: operationEvidence(operation, correlationId, {
				attempted: false,
				provider: 'none',
				changed: 'none',
			}),
			services: getCommerceServiceBoundary(),
		},
		{ status: 503, headers: commerceHeaders() },
	);
}

function invalid(operation: CommerceOperation, message: string) {
	const correlationId = crypto.randomUUID();
	return json(
		{
			error: {
				code: 'invalid_request',
				message,
				retryable: false,
				correlationId,
			},
			evidence: operationEvidence(operation, correlationId, {
				attempted: false,
				provider: 'none',
				changed: 'none',
			}),
			services: getCommerceServiceBoundary(),
		},
		{ status: 400, headers: commerceHeaders() },
	);
}

function guardFailure(operation: CommerceOperation, cause: unknown) {
	if (cause instanceof CommerceRateLimitError) {
		return localFailure(operation, 'rate_limited', 'Too many cart changes. Wait a minute and try again.', 429);
	}
	if (cause instanceof CommerceSessionUnavailableError) {
		return localFailure(operation, 'session_unavailable', 'The cart session is temporarily unavailable.', 503);
	}
	return invalid(operation, cause instanceof TypeError ? cause.message : 'The cart request could not be read.');
}

function localFailure(
	operation: CommerceOperation,
	code: 'rate_limited' | 'session_unavailable',
	message: string,
	status: number,
) {
	const correlationId = crypto.randomUUID();
	return json(
		{
			error: { code, message, retryable: true, correlationId },
			evidence: operationEvidence(operation, correlationId, {
				attempted: false,
				provider: 'none',
				changed: 'none',
			}),
			services: getCommerceServiceBoundary(),
		},
		{ status, headers: commerceHeaders() },
	);
}

function commerceHeaders() {
	return { 'Cache-Control': 'private, no-store' };
}
