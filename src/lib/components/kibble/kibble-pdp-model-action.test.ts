import { describe, expect, it } from 'vitest';
import { describeKibblePdpModelAction } from './kibble-pdp-model-action';

describe('Kibble PDP Observe rail model action', () => {
	it('disables duplicate dispatch while a paid ranking is queued and reports applied or failed truthfully', () => {
		expect(describeKibblePdpModelAction('idle')).toMatchObject({ label: 'Run AI product page', detail: expect.stringContaining('Ready'), disabled: false });
		expect(describeKibblePdpModelAction('updating')).toMatchObject({ label: 'AI composing product page…', disabled: true });
		expect(describeKibblePdpModelAction('applied')).toMatchObject({ label: 'Run AI product page again', detail: expect.stringContaining('validated'), disabled: false });
		expect(describeKibblePdpModelAction('failed')).toMatchObject({ label: 'AI product page failed — retry', detail: expect.stringContaining('last approved'), disabled: false });
	});
});
