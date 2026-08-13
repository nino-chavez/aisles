import { KIBBLE_DEMO_PROVIDER_DEADLINE_MS } from '$lib/kibble-demo-ai-boundary';

/** One action-wide signal spans the primary provider attempt and its fallback. */
export function createKibbleDemoProviderDeadline() {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(new Error('Kibble demo provider deadline exceeded.')), KIBBLE_DEMO_PROVIDER_DEADLINE_MS);
	return { signal: controller.signal, dispose: () => clearTimeout(timeout) };
}
