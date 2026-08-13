export type KibblePdpModelActionStatus = 'idle' | 'updating' | 'applied' | 'failed';

export function describeKibblePdpModelAction(status: KibblePdpModelActionStatus) {
	if (status === 'updating') return { label: 'AI-ranking related products…', detail: 'One bounded AI ranking is running. The fixed related rail remains visible until its exact order is validated.', disabled: true };
	if (status === 'applied') return { label: 'AI-ranked related products', detail: 'A model returned the current related-product order. The fixed PDP content did not change.', disabled: false };
	if (status === 'failed') return { label: 'AI ranking failed — retry', detail: 'The model result was not applied. The last approved related rail remains visible.', disabled: false };
	return { label: 'AI-rank related products', detail: null, disabled: false };
}
