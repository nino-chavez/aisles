import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { replaceSessionStore } from '$lib/signals/session';
import { KIBBLE_SCENARIOS, replayKibbleScenario, type KibbleScenarioId } from '$lib/signals/scenarios';
import { getBrand } from '$lib/brand/config';

const OBSERVE_KEY = 'aisles-observe';

/** Seeds only the local signal session store. It never writes Postgres, calls a provider, or generates a layout. */
export const POST: RequestHandler = async ({ request, url, cookies }) => {
	if (url.searchParams.get('key') !== OBSERVE_KEY) return json({ error: 'Unauthorized' }, { status: 401 });
	if (getBrand().id !== 'kibble') return json({ error: 'Synthetic scenarios are available only for Kibble' }, { status: 404 });
	const { scenarioId } = await request.json() as { scenarioId?: string };
	if (!scenarioId || !(scenarioId in KIBBLE_SCENARIOS)) return json({ error: 'Unknown Kibble scenario' }, { status: 400 });
	const sessionId = `synthetic:${scenarioId}`;
	const replay = replayKibbleScenario(scenarioId as KibbleScenarioId, sessionId);
	await replaceSessionStore(replay.store);
	cookies.set('aisles_session', sessionId, { path: '/', maxAge: 60 * 30 });
	return json({ sessionId, scenarioId, scenarioLabel: replay.scenario.name, inference: replay.inference, synthetic: true });
};
