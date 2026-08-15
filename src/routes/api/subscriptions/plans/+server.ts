import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createSubscriptionCommerceService } from '$lib/server/commerce/subscription-service';

export const GET: RequestHandler = async ({ url, platform }) => {
	const productEntityId = Number(url.searchParams.get('bc_product_id'));
	if (!Number.isInteger(productEntityId) || productEntityId < 1) {
		return json({ error: { code: 'invalid_request', message: 'A valid bc_product_id is required.', retryable: false } }, {
			status: 400,
			headers: commerceHeaders(),
		});
	}
	const result = await createSubscriptionCommerceService(platform).plans(productEntityId);
	return result.ok
		? json(result.data, { status: result.status, headers: commerceHeaders() })
		: json({ error: result.error, evidence: result.evidence, services: result.services }, { status: result.status, headers: commerceHeaders() });
};

function commerceHeaders() {
	return { 'Cache-Control': 'private, no-store' };
}
