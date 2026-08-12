import { dev } from '$app/environment';
import { env as privateEnv } from '$env/dynamic/private';

const REALM = 'Aisles Observe';

type RuntimeEnv = { OBSERVE_ACCESS_TOKEN?: string } | undefined;

/**
 * Observe exposes session telemetry and must never rely on a browser-shipped
 * routing key. In local development only, it remains open when no token has
 * been configured. Every deployed environment requires the Pages secret.
 */
export function isObserveAuthorized(
	request: Request,
	env: RuntimeEnv,
	isDevelopment = dev,
	localToken = privateEnv.OBSERVE_ACCESS_TOKEN,
): boolean {
	const token = env?.OBSERVE_ACCESS_TOKEN || localToken;
	if (!token) return isDevelopment;

	const header = request.headers.get('authorization');
	if (!header?.startsWith('Basic ')) return false;

	try {
		const decoded = atob(header.slice('Basic '.length));
		const separator = decoded.indexOf(':');
		if (separator < 0) return false;
		return decoded.slice(separator + 1) === token;
	} catch {
		return false;
	}
}

export function observeUnauthorizedResponse(): Response {
	return new Response('Observe authorization required.', {
		status: 401,
		headers: {
			'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"`,
			'Cache-Control': 'no-store',
		},
	});
}

export function isObservePath(pathname: string): boolean {
	return pathname === '/observe' || pathname.startsWith('/observe/') || pathname.startsWith('/api/observe/');
}
