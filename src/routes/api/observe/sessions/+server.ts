import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listSessionIds, findSessionStore } from '$lib/signals/session';
import { scenarioLabel } from '$lib/signals/scenarios';

/**
 * GET /api/observe/sessions
 * Returns active session IDs sorted by most recent event timestamp
 * so "watch latest" actually picks the freshest session.
 */
export const GET: RequestHandler = async ({ url }) => {
	const ids = await listSessionIds();

	const withActivity = await Promise.all(
		ids.map(async (id) => {
			try {
				// A key can expire between enumeration and this read. Use the
				// identity-checked lookup so Observe never manufactures a session.
				const store = await findSessionStore(id, { fresh: true });
				if (!store) return null;
				const events = store.getEvents();
				const last = events.length > 0 ? events[events.length - 1].timestamp : 0;
				return { id, last, scenarioId: store.getCrossSessionContext().scenarioId, scenarioLabel: scenarioLabel(store.getCrossSessionContext().scenarioId) };
			} catch {
				return null;
			}
		})
	);

	const verifiedSessions = withActivity.filter((session): session is NonNullable<typeof session> => session !== null);
	verifiedSessions.sort((a, b) => b.last - a.last);
	return json({
		sessionIds: verifiedSessions.map((session) => session.id),
		sessions: verifiedSessions.map(({ id, scenarioId, scenarioLabel }) => ({ id, scenarioId, scenarioLabel })),
	});
};
