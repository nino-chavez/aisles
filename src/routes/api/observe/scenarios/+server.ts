import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionStore, persistSession } from '$lib/signals/session';
import { KIBBLE_SCENARIOS, replayKibbleScenario, type KibbleScenarioId } from '$lib/signals/scenarios';

const OBSERVE_KEY = 'aisles-observe';

/** Seeds only the local signal session store. It never writes Postgres, calls a provider, or generates a layout. */
export const POST: RequestHandler = async ({ request, url, cookies }) => {
	if (url.searchParams.get('key') !== OBSERVE_KEY) return json({ error: 'Unauthorized' }, { status: 401 });
	const { scenarioId } = await request.json() as { scenarioId?: string };
	if (!scenarioId || !(scenarioId in KIBBLE_SCENARIOS)) return json({ error: 'Unknown Kibble scenario' }, { status: 400 });
	const sessionId = `synthetic:${scenarioId}`;
	const replay = replayKibbleScenario(scenarioId as KibbleScenarioId, sessionId);
	const store = await getSessionStore(sessionId);
	store.setBrandId('kibble');
	store.setScenarioId(scenarioId);
	store.setCrossSessionContext({ storedPersona: null, storedCategory: null, visitCount: 1, currentCategory: 'dog-food' });
	for (const event of replay.store.getEvents()) store.restore(event);
	await persistSession(store);
	cookies.set('aisles_session', sessionId, { path: '/', maxAge: 60 * 30 });
	return json({ sessionId, scenarioId, scenarioLabel: replay.scenario.name, inference: replay.inference, synthetic: true });
};
