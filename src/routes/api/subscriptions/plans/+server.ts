import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getBrand } from '$lib/brand/config';
import { getKibbleCommerceMode } from '$lib/server/kibble-commerce';
import { getKibbleSubscriptionPlans, KibbleSubscriptionError } from '$lib/server/kibble-subscriptions';

export const GET: RequestHandler = async ({ url }) => {
	if (getBrand().id !== 'kibble') return json({ error: 'Subscription plans are unavailable.' }, { status: 404 });
	if (getKibbleCommerceMode() === 'off') return json({ error: 'Subscription plans are unavailable in this preview.' }, { status: 503 });
	const rawProductId = url.searchParams.get('bc_product_id');
	const productEntityId = rawProductId ? Number(rawProductId) : NaN;
	if (!Number.isInteger(productEntityId) || productEntityId < 1) return json({ error: 'A valid product is required.' }, { status: 400 });
	try {
		const plans = await getKibbleSubscriptionPlans(productEntityId);
		return json({ plans });
	} catch (error) {
		const status = error instanceof KibbleSubscriptionError ? error.status : 502;
		console.warn('[kibble-subscriptions] Plan read failed:', error instanceof Error ? error.message : error);
		return json({ error: status === 400 ? 'Subscription plans are not available for this product.' : 'Auto-Refill is temporarily unavailable.' }, { status });
	}
};
