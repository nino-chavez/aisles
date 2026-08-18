import type { RequestHandler } from './$types';
import { createSubscriberService } from '$lib/server/commerce/subscriber-service';
import { subscriberLocalFailure, subscriberResponse } from '$lib/server/commerce/subscriber-http';
import { commerceSessionId } from '$lib/server/commerce/session';

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export const GET: RequestHandler = async ({ params, cookies, platform }) => {
	if (!ID_PATTERN.test(params.id)) {
		return subscriberLocalFailure('subscription.portal.detail', 'invalid_request', 'A valid subscription identifier is required.', 400, false);
	}
	return subscriberResponse(await createSubscriberService(platform).detail(commerceSessionId(cookies), params.id));
};
