import { describe, expect, it } from 'vitest';
import { describeKibblePdpModelAction } from './kibble-pdp-model-action';

describe('Kibble PDP Observe rail model action', () => {
	it('disables duplicate dispatch while a paid ranking is queued and reports applied or failed truthfully', () => {
		expect(describeKibblePdpModelAction('idle')).toEqual({ label: 'AI-rank related products', detail: null, disabled: false });
		expect(describeKibblePdpModelAction('updating')).toMatchObject({ label: 'AI-ranking related products…', disabled: true });
		expect(describeKibblePdpModelAction('applied')).toMatchObject({ label: 'AI-ranked related products', detail: expect.stringContaining('did not change'), disabled: false });
		expect(describeKibblePdpModelAction('failed')).toMatchObject({ label: 'AI ranking failed — retry', detail: expect.stringContaining('last approved'), disabled: false });
	});
});
