import { describe, expect, it } from 'vitest';
import {
	OBSERVE_SESSION_ID_MAX_LENGTH,
	buildObserveSessionHref,
	observeSessionIdFromUrl,
	parseObserveSessionId,
} from './observe-session-link';

describe('Observe session deep links', () => {
	it('round-trips the exact scoped session through an encoded query value', () => {
		const id = 'synthetic:kibble local/showcase';
		const href = buildObserveSessionHref(id);
		expect(href).toBe('/observe?session=synthetic%3Akibble+local%2Fshowcase');
		expect(observeSessionIdFromUrl(new URL(href!, 'http://localhost'))).toBe(id);
	});

	it('fails closed on empty, padded, control-character, and overbound identifiers', () => {
		for (const value of ['', ' padded', 'padded ', 'line\nbreak', 'x'.repeat(OBSERVE_SESSION_ID_MAX_LENGTH + 1)]) {
			expect(parseObserveSessionId(value)).toBeNull();
			expect(buildObserveSessionHref(value)).toBeNull();
		}
	});
});
