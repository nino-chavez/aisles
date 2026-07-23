import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionStore, hasSession, persistSession } from '$lib/signals/session';
import { infer } from '$lib/signals/inference';
import { finalizeSession } from '$lib/server/outcomes';
import type { SignalEventType, SignalSource } from '$lib/signals/types';

const SESSION_COOKIE = 'aisles_session';

/**
 * POST /api/signals
 *
 * Receives batched client-side signal events, appends them to the
 * session's store, re-runs inference, and returns the updated
 * PersonaInference so the client can react to persona shifts.
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const { events } = await request.json();

		if (!Array.isArray(events) || events.length === 0) {
			return json({ error: 'Expected non-empty events array' }, { status: 400 });
		}

		// Validate basic event shape
		for (const event of events) {
			if (!event.type || !event.source || !event.timestamp) {
				return json({ error: 'Invalid event: missing type, source, or timestamp' }, { status: 400 });
			}
		}

		// Get session — if no session cookie exists, acknowledge but can't infer
		const sessionId = cookies.get(SESSION_COOKIE);
		if (!sessionId || !(await hasSession(sessionId))) {
			return json({ received: events.length, inference: null });
		}

		// Append events to the session store
		const store = await getSessionStore(sessionId);
		let hasConversionSignal = false;
		for (const event of events) {
			store.emit(
				event.type as SignalEventType,
				event.source as SignalSource,
				event.data || {},
				event.context,
			);
			if (event.type === 'commerce.add_to_cart') hasConversionSignal = true;
		}

		// Re-run inference with accumulated signals
		const inference = infer(store.toInferenceContext());

		// Persist to Redis
		await persistSession(store);

		// On conversion, finalize the outcome for calibration/fitting.
		// Fire-and-forget — doesn't block the response.
		if (hasConversionSignal) {
			finalizeSession(store, { converted: true }).catch((err) => {
				console.warn('[signals] finalize on conversion failed:', err);
			});
		}

		return json({
			received: events.length,
			inference,
		});
	} catch {
		return json({ error: 'Invalid request body' }, { status: 400 });
	}
};
