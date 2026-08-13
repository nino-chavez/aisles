export const OBSERVE_SESSION_ID_MAX_LENGTH = 256;

export function parseObserveSessionId(value: string | null | undefined): string | null {
	if (!value || value.length > OBSERVE_SESSION_ID_MAX_LENGTH) return null;
	if (value.trim() !== value || /[\u0000-\u001f\u007f]/.test(value)) return null;
	return value;
}

export function buildObserveSessionHref(sessionId: string | null | undefined): string | null {
	const parsed = parseObserveSessionId(sessionId);
	if (!parsed) return null;
	const params = new URLSearchParams({ session: parsed });
	return `/observe?${params.toString()}`;
}

export function observeSessionIdFromUrl(url: URL): string | null {
	return parseObserveSessionId(url.searchParams.get('session'));
}
