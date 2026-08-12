import { describe, expect, it } from 'vitest';
import { isObserveAuthorized, isObservePath, observeUnauthorizedResponse } from './observe-auth';

function request(authorization?: string) {
	return new Request('https://example.test/observe', {
		headers: authorization ? { authorization } : undefined,
	});
}

describe('Observe authorization', () => {
	it('requires a server token outside local development', () => {
		expect(isObserveAuthorized(request(), { OBSERVE_ACCESS_TOKEN: 'secret' }, false)).toBe(false);
		expect(isObserveAuthorized(request('Basic b3BlcmF0b3I6c2VjcmV0'), { OBSERVE_ACCESS_TOKEN: 'secret' }, false)).toBe(true);
		expect(isObserveAuthorized(request('Basic b3BlcmF0b3I6d3Jvbmc='), { OBSERVE_ACCESS_TOKEN: 'secret' }, false)).toBe(false);
	});

	it('allows only tokenless local development', () => {
		expect(isObserveAuthorized(request(), undefined, true, '')).toBe(true);
		expect(isObserveAuthorized(request(), undefined, false, '')).toBe(false);
		expect(isObserveAuthorized(request(), undefined, true, 'local-secret')).toBe(false);
		expect(isObserveAuthorized(request('Basic b3BlcmF0b3I6bG9jYWwtc2VjcmV0'), undefined, true, 'local-secret')).toBe(true);
	});

	it('limits the guard to the Observe page and API', () => {
		expect(isObservePath('/observe')).toBe(true);
		expect(isObservePath('/api/observe/sessions')).toBe(true);
		expect(isObservePath('/category/dog-food')).toBe(false);
	});

	it('uses a browser authentication challenge and disables caching on denial', () => {
		const response = observeUnauthorizedResponse();
		expect(response.status).toBe(401);
		expect(response.headers.get('www-authenticate')).toContain('Basic realm="Aisles Observe"');
		expect(response.headers.get('cache-control')).toBe('no-store');
	});
});
