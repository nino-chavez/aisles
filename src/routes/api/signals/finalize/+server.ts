import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionStore, hasSession } from '$lib/signals/session';
import { finalizeSession } from '$lib/server/outcomes';

const SESSION_COOKIE = 'aisles_session';

/**
 * POST /api/signals/finalize
 *
 * Called from the client via navigator.sendBeacon() on page unload. Writes
 * the current session state to session_outcomes for calibration and LR
 * fitting. Idempotent — the finalize function upserts on sessionId.
 *
 * Body (optional): { converted?: boolean }
 *
 * Returns 204 always, even on error — the beacon caller doesn't read the
 * response and we don't want to block unload.
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const sessionId = cookies.get(SESSION_COOKIE);
		if (!sessionId || !(await hasSession(sessionId))) {
			return new Response(null, { status: 204 });
		}

		let converted = false;
		try {
			const body = await request.json();
			if (typeof body?.converted === 'boolean') converted = body.converted;
		} catch {
			// Beacons may send empty body or raw text — ignore parse failure
		}

		const store = await getSessionStore(sessionId);
		await finalizeSession(store, { converted });
	} catch (err) {
		console.warn('[finalize] failed:', err);
	}
	return new Response(null, { status: 204 });
};

// Health check for the endpoint
export const GET: RequestHandler = () => json({ ok: true });
