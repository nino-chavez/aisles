import type { Handle } from '@sveltejs/kit';
import { isObserveAuthorized, isObservePath, observeUnauthorizedResponse } from '$lib/server/observe-auth';

export const handle: Handle = async ({ event, resolve }) => {
	if (isObservePath(event.url.pathname) && !isObserveAuthorized(event.request, event.platform?.env)) {
		return observeUnauthorizedResponse();
	}

	const response = await resolve(event);
	if (isObservePath(event.url.pathname)) response.headers.set('Cache-Control', 'private, no-store');
	return response;
};
