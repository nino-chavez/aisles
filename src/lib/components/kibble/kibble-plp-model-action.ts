export type KibblePlpModelActionStatus = 'idle' | 'updating' | 'applied' | 'failed';

export function describeKibblePlpModelAction(status: KibblePlpModelActionStatus) {
	if (status === 'updating') return { label: 'AI composing category…', detail: 'A bounded provider action is selecting the first-eight order, approved header copy, and an approved marketing block, with at most two attempts.', disabled: true };
	if (status === 'applied') return { label: 'Run AI category again', detail: 'A model returned a validated category presentation. The sort, cursor, remaining products, product facts, prices, links, and styling stayed merchant-owned.', disabled: false };
	if (status === 'failed') return { label: 'AI category failed — retry', detail: 'The model result was not applied. The server-rendered category presentation remains visible.', disabled: false };
	return { label: 'Run AI category', detail: 'Ready to run one bounded action with up to two provider attempts across the approved category zones.', disabled: false };
}
