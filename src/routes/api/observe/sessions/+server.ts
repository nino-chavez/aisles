import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listSessionIds, getSessionStore } from '$lib/signals/session';

const OBSERVE_KEY = 'aisles-observe';

/**
 * GET /api/observe/sessions
 * Returns active session IDs sorted by most recent event timestamp
 * so "watch latest" actually picks the freshest session.
 */
export const GET: RequestHandler = async ({ url }) => {
	if (url.searchParams.get('key') !== OBSERVE_KEY) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const ids = await listSessionIds();

	const withActivity = await Promise.all(
		ids.map(async (id) => {
			try {
				const store = await getSessionStore(id);
				const events = store.getEvents();
				const last = events.length > 0 ? events[events.length - 1].timestamp : 0;
				return { id, last };
			} catch {
				return { id, last: 0 };
			}
		})
	);

	withActivity.sort((a, b) => b.last - a.last);
	return json({ sessionIds: withActivity.map((s) => s.id) });
};
