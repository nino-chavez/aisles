/** Shared limits for every paid Kibble Observe model action. */
export const KIBBLE_DEMO_PROVIDER_DEADLINE_MS = 12_000;
export const KIBBLE_DEMO_MAX_OUTPUT_TOKENS = 512;
export const KIBBLE_DEMO_PLP_CLIENT_TIMEOUT_MS = 15_000;
export const KIBBLE_DEMO_MAX_PUBLIC_CLIENT_TIMEOUT_MS = 16_000;
export const KIBBLE_DEMO_ACTION_COOLDOWN_SECONDS = 18;
export const KIBBLE_DEMO_ACTION_COOLDOWN_MS = KIBBLE_DEMO_ACTION_COOLDOWN_SECONDS * 1_000;
export const KIBBLE_DEMO_MAX_PROVIDER_CALLS_PER_ACTION = 2;

/** Read only a sanitized, explicitly reported attempt count from a failed preview response. */
export async function readKibbleModelFailureCallCount(response: Response): Promise<number | null> {
	try {
		return kibbleModelCallCountFromPayload(await response.json());
	} catch {
		return null;
	}
}

export function kibbleModelCallCountFromPayload(body: unknown): number | null {
	if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
	const record = body as Record<string, unknown>;
	const firstAdapter = Array.isArray(record.featuredZoneAdapters) && record.featuredZoneAdapters[0]
		&& typeof record.featuredZoneAdapters[0] === 'object'
		? record.featuredZoneAdapters[0] as Record<string, unknown>
		: null;
	const value = record.modelCallCount ?? firstAdapter?.modelCallCount;
	return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= KIBBLE_DEMO_MAX_PROVIDER_CALLS_PER_ACTION
		? value as number
		: null;
}

if (KIBBLE_DEMO_ACTION_COOLDOWN_MS <= KIBBLE_DEMO_PROVIDER_DEADLINE_MS || KIBBLE_DEMO_ACTION_COOLDOWN_MS <= KIBBLE_DEMO_MAX_PUBLIC_CLIENT_TIMEOUT_MS) {
	throw new Error('Kibble demo action cooldown must outlast every provider and public-client deadline.');
}
