import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { commerceSessionId } from '$lib/server/commerce/session';
import { customerService } from '$lib/server/commerce/customer-service';

/** Read-only customer order history. This endpoint cannot create an order. */
export const GET: RequestHandler = async ({ cookies, url }) => {
	const requested = Number(url.searchParams.get('limit') ?? '25');
	const limit = Number.isFinite(requested) ? Math.min(Math.max(Math.trunc(requested), 1), 50) : 25;
	const result = await customerService.orders(commerceSessionId(cookies), limit);
	return result.ok
		? json(result.data, { status: result.status, headers: privateHeaders() })
		: json(
				{
					error: result.error,
					evidence: result.evidence,
					services: result.services,
				},
				{ status: result.status, headers: privateHeaders() },
			);
};

function privateHeaders() {
	return { 'Cache-Control': 'private, no-store' };
}
