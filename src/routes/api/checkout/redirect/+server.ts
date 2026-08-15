import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCommerceServiceBoundary, isKibbleCommerceEnabled } from '$lib/server/commerce/boundary';
import { commerceService } from '$lib/server/commerce/service';
import {
	CommerceRateLimitError,
	CommerceSessionUnavailableError,
	requireCommerceSessionId,
	requireCommerceMutationCapacity,
	requireIdempotencyKey,
	requireSameOrigin,
} from '$lib/server/commerce/session';
import { operationEvidence } from '$lib/commerce/cart-contract';

/**
 * POST /api/checkout/redirect mints a one-use BigCommerce hosted-checkout URL.
 * Aisles neither creates an order nor receives payment credentials here.
 */
export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	if (!isKibbleCommerceEnabled()) return disabled();
	try {
		requireSameOrigin(request);
		await requireCommerceMutationCapacity(getClientAddress());
		const result = await commerceService.checkout(requireCommerceSessionId(cookies), requireIdempotencyKey(request));
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
	} catch (cause) {
		const correlationId = crypto.randomUUID();
		const localFailure = cause instanceof CommerceRateLimitError
			? { code: 'rate_limited', message: 'Too many checkout attempts. Wait a minute and try again.', status: 429, retryable: true }
			: cause instanceof CommerceSessionUnavailableError
				? { code: 'session_unavailable', message: 'The checkout session is temporarily unavailable.', status: 503, retryable: true }
				: { code: 'invalid_request', message: cause instanceof TypeError ? cause.message : 'The checkout request could not be read.', status: 400, retryable: false };
		return json(
			{
				error: {
					code: localFailure.code,
					message: localFailure.message,
					retryable: localFailure.retryable,
					correlationId,
				},
				evidence: operationEvidence('checkout.handoff', correlationId, {
					attempted: false,
					provider: 'none',
					changed: 'none',
				}),
				services: getCommerceServiceBoundary(),
			},
			{ status: localFailure.status, headers: commerceHeaders() },
		);
	}
};

function disabled() {
	const correlationId = crypto.randomUUID();
	return json(
		{
			error: {
				code: 'commerce_disabled',
				message: 'Kibble sandbox commerce is not enabled.',
				retryable: false,
				correlationId,
			},
			evidence: operationEvidence('checkout.handoff', correlationId, {
				attempted: false,
				provider: 'none',
				changed: 'none',
			}),
			services: getCommerceServiceBoundary(),
		},
		{ status: 503, headers: commerceHeaders() },
	);
}

function commerceHeaders() {
	return { 'Cache-Control': 'private, no-store' };
}
