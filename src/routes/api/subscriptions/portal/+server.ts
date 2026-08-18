import type { RequestHandler } from './$types';
import { createSubscriberService } from '$lib/server/commerce/subscriber-service';
import { subscriberResponse } from '$lib/server/commerce/subscriber-http';
import { commerceSessionId } from '$lib/server/commerce/session';

export const GET: RequestHandler = async ({ cookies, platform }) => {
	return subscriberResponse(await createSubscriberService(platform).list(commerceSessionId(cookies)));
};
