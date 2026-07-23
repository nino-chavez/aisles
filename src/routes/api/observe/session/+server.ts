import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionStore, hasSession } from '$lib/signals/session';
import { infer } from '$lib/signals/inference';

const OBSERVE_KEY = 'aisles-observe';

/**
 * GET /api/observe/session?id={sessionId}&key=aisles-observe
 * Returns the full session state: events, inference, cross-session context.
 */
export const GET: RequestHandler = async ({ url }) => {
	if (url.searchParams.get('key') !== OBSERVE_KEY) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const sessionId = url.searchParams.get('id');
	if (!sessionId) {
		return json({ error: 'Missing id parameter' }, { status: 400 });
	}

	if (!(await hasSession(sessionId))) {
		return json({ error: 'Session not found' }, { status: 404 });
	}

	const store = await getSessionStore(sessionId, { fresh: true });
	const events = store.getEvents();
	const inference = infer(store.toInferenceContext());
	const crossSession = store.getCrossSessionContext();

	// Pull the latest incentive snapshot from the signal log.
	const latestIncentive = [...events]
		.reverse()
		.find((e) => e.type === 'commerce.tier_progress_view');
	const incentives = latestIncentive
		? (latestIncentive.data as {
				appliedCodes: string[];
				codes: Array<{ type: string; code: string }>;
				discounts: Array<{ title: string; target: string; amount: number; code?: string }>;
				wallet: {
					unit: string;
					balanceActive: number;
					tierCurrent: string | null;
					tierNext: string | null;
					unitsToNext: number | null;
				} | null;
				programName: string | null;
			})
		: null;

	return json({
		sessionId,
		events,
		inference,
		eventCount: events.length,
		crossSession,
		incentives,
	});
};
