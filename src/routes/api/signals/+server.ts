import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionStore, hasSession, persistSession } from '$lib/signals/session';
import { infer } from '$lib/signals/inference';
import { finalizeSession } from '$lib/server/outcomes';
import type { SignalEventType, SignalSource } from '$lib/signals/types';
import { getBrand } from '$lib/brand/config';
import { validatePublicSignalProvenance } from '$lib/signals/public-provenance';

const SESSION_COOKIE = 'aisles_session';

/**
 * POST /api/signals
 *
 * Receives batched client-side signal events, appends them to the
 * session's store, re-runs inference, and returns the updated
 * PersonaInference so the client can react to persona shifts.
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
	let events: unknown;
	try {
		({ events } = await request.json());
	} catch {
		return json({ error: 'Invalid request body' }, { status: 400 });
	}

	if (!Array.isArray(events) || events.length === 0) {
		return json({ error: 'Expected non-empty events array' }, { status: 400 });
	}

	for (const event of events) {
		if (!event || typeof event !== 'object' || !('type' in event) || !('source' in event) || !('timestamp' in event)) {
			return json({ error: 'Invalid event: missing type, source, or timestamp' }, { status: 400 });
		}
		const provenanceError = validatePublicSignalProvenance(event.type, event.source);
		if (provenanceError) return json({ error: provenanceError }, { status: 400 });
	}

	try {
		// Get session — if no session cookie exists, acknowledge but can't infer
		const sessionId = cookies.get(SESSION_COOKIE);
		if (!sessionId || !(await hasSession(sessionId))) {
			return json({ received: events.length, inference: null });
		}

		// Append events to the session store
		const store = await getSessionStore(sessionId);
		// The server's active brand is authoritative. This also upgrades legacy
		// Redis snapshots that predate persisted brandId.
		store.setBrandId(getBrand().id);
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

		// On conversion, finalize before reporting success. Operational telemetry
		// must not disappear behind a successful signal response.
		if (hasConversionSignal) {
			await finalizeSession(store, { converted: true });
		}

		return json({
			received: events.length,
			inference,
		});
	} catch (error) {
		console.error('[signals] operational failure:', error);
		return json({ error: 'Failed to process signals' }, { status: 500 });
	}
};
