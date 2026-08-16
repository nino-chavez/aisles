import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createSubscriptionCommerceService } from '$lib/server/commerce/subscription-service';
import {
	CommerceRateLimitError,
	CommerceSessionUnavailableError,
	requireCommerceMutationCapacity,
	requireCommerceSessionId,
	requireIdempotencyKey,
	requireSameOrigin,
} from '$lib/server/commerce/session';

export const POST: RequestHandler = async ({ request, cookies, getClientAddress, platform }) => {
	try {
		requireSameOrigin(request);
		const body = await request.json();
		const productEntityId = Number(body?.productEntityId);
		const planId = typeof body?.planId === 'string' ? body.planId : '';
		if (!Number.isInteger(productEntityId) || productEntityId < 1 || !/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/.test(planId)) {
			return localError('invalid_request', 'A valid product and Auto-Refill plan are required.', 400);
		}
		await requireCommerceMutationCapacity(getClientAddress());
		const result = await createSubscriptionCommerceService(platform).intent(
			requireCommerceSessionId(cookies),
			requireIdempotencyKey(request),
			{ productEntityId, planId },
		);
		return result.ok
			? json(result.data, { status: result.status, headers: commerceHeaders() })
			: json({ error: result.error, evidence: result.evidence, services: result.services, ...(result.replayed ? { replayed: true } : {}) }, { status: result.status, headers: commerceHeaders() });
	} catch (cause) {
		if (cause instanceof CommerceRateLimitError) return localError('rate_limited', 'Too many cart changes. Wait a minute and try again.', 429, true);
		if (cause instanceof CommerceSessionUnavailableError) return localError('session_unavailable', 'The cart session is temporarily unavailable.', 503, true);
		return localError('invalid_request', cause instanceof TypeError ? cause.message : 'The Auto-Refill request could not be read.', 400);
	}
};

function localError(code: string, message: string, status: number, retryable = false) {
	return json({ error: { code, message, retryable, correlationId: crypto.randomUUID() } }, { status, headers: commerceHeaders() });
}

function commerceHeaders() {
	return { 'Cache-Control': 'private, no-store' };
}
