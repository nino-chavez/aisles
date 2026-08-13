import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { findSessionStore } from '$lib/signals/session';
import { infer } from '$lib/signals/inference';
import { scenarioLabel } from '$lib/signals/scenarios';

/**
	* GET /api/observe/session?id={sessionId}
	* Returns the full session state: events, inference, cross-session context.
 */
export const GET: RequestHandler = async ({ url }) => {
	const sessionId = url.searchParams.get('id');
	if (!sessionId) {
		return json({ error: 'Missing id parameter' }, { status: 400 });
	}

	// This is an identity-checked read. Do not fall back to getSessionStore:
	// that function creates a fresh store for a missing or foreign session ID.
	const store = await findSessionStore(sessionId, { fresh: true });
	if (!store) {
		return json({ error: 'Session not found' }, { status: 404 });
	}
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
		scenarioLabel: scenarioLabel(crossSession.scenarioId),
		incentives,
	});
};
