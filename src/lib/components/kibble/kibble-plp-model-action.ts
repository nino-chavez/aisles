export type KibblePlpModelActionStatus = 'idle' | 'updating' | 'applied' | 'failed';

export function describeKibblePlpModelAction(status: KibblePlpModelActionStatus) {
	if (status === 'updating') return { label: 'AI-ranking first 8 products…', detail: 'One bounded AI ranking is running. The current catalog grid remains visible until its exact first-eight order is validated.', disabled: true };
	if (status === 'applied') return { label: 'Run AI ranking again', detail: 'A model reordered only the first eight products. The selected sort, cursor, remaining products, cards, prices, links, and layout stayed fixed.', disabled: false };
	if (status === 'failed') return { label: 'AI ranking failed — retry', detail: 'The model result was not applied. The server-rendered catalog order remains visible.', disabled: false };
	return { label: 'AI-rank first 8 products', detail: 'Ready to rank only the first eight products on this fixed category page.', disabled: false };
}
