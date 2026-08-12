import { describe, expect, it } from 'vitest';
import { validatePublicSignalProvenance } from './public-provenance';

describe('public signal provenance', () => {
	it('rejects browser-spoofed external provider facts', () => {
		expect(validatePublicSignalProvenance('subscription.due_proximity', 'external')).toContain('server-side authenticated');
		expect(validatePublicSignalProvenance('subscription.tenure', 'external')).toContain('server-side authenticated');
	});
	it('allows only interaction provenance for browser subscription controls', () => {
		expect(validatePublicSignalProvenance('subscription.skip', 'interaction')).toBeNull();
		expect(validatePublicSignalProvenance('subscription.skip', 'commerce')).toContain('interaction');
	});
});
