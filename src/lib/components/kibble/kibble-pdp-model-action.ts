export type KibblePdpModelActionStatus = 'idle' | 'updating' | 'applied' | 'failed';

export function describeKibblePdpModelAction(status: KibblePdpModelActionStatus) {
	if (status === 'updating') return { label: 'AI composing product page…', detail: 'A bounded provider action is selecting related-product order, approved heading copy, and an approved marketing block, with at most two attempts.', disabled: true };
	if (status === 'applied') return { label: 'Run AI product page again', detail: 'A model returned a validated related-products presentation. Product facts, price, purchase boundaries, links, and styling stayed merchant-owned.', disabled: false };
	if (status === 'failed') return { label: 'AI product page failed — retry', detail: 'The model result was not applied. The last approved product-page presentation remains visible.', disabled: false };
	return { label: 'Run AI product page', detail: 'Ready to run one bounded action with up to two provider attempts across the approved product-page zones.', disabled: false };
}
