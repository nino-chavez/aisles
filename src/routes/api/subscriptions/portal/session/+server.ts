import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createSubscriberService } from '$lib/server/commerce/subscriber-service';
import { privateHeaders, subscriberGuardFailure, subscriberResponse } from '$lib/server/commerce/subscriber-http';
import {
	commerceSessionId,
	requireCommerceMutationCapacity,
	requireCommerceSessionId,
	requireIdempotencyKey,
	requireSameOrigin,
} from '$lib/server/commerce/session';

export const GET: RequestHandler = async ({ cookies, platform }) => {
	return json(await createSubscriberService(platform).status(commerceSessionId(cookies)), {
		headers: privateHeaders(),
	});
};

export const POST: RequestHandler = async ({ request, cookies, platform, getClientAddress }) => {
	try {
		requireSameOrigin(request);
		await requireCommerceMutationCapacity(getClientAddress());
		return subscriberResponse(await createSubscriberService(platform).connect(
			requireCommerceSessionId(cookies),
			requireIdempotencyKey(request),
		));
	} catch (cause) {
		return subscriberGuardFailure('subscription.portal.connect', cause);
	}
};

export const DELETE: RequestHandler = async ({ request, cookies, platform, getClientAddress }) => {
	try {
		requireSameOrigin(request);
		await requireCommerceMutationCapacity(getClientAddress());
		return subscriberResponse(await createSubscriberService(platform).disconnect(
			requireCommerceSessionId(cookies),
			requireIdempotencyKey(request),
		));
	} catch (cause) {
		return subscriberGuardFailure('subscription.portal.disconnect', cause);
	}
};
