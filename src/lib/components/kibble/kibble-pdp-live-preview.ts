import type { KibbleProduct, KibbleZoneAdapterBinding } from './types';
import { KIBBLE_DEMO_MAX_PUBLIC_CLIENT_TIMEOUT_MS } from '$lib/kibble-demo-ai-boundary';

const RESPONSE_KEYS = new Set(['version', 'previewOnly', 'routePath', 'policyVersion', 'persona', 'rankedProductIds', 'zoneAdapter', 'modelCallCount', 'provenance']);
const ADAPTER_KEYS = new Set(['instanceId', 'sharedStatus', 'sharedContentKind', 'decisionMode', 'modelCallCount', 'adapterId', 'componentVariantId', 'inputSha256', 'content']);
const CONTENT_KEYS = new Set(['component', 'props']);
const PROPS_KEYS = new Set(['title', 'products', 'showQuickAdd']);
const PRODUCT_REF_KEYS = new Set(['productId', 'role']);
const HEX_64 = /^[0-9a-f]{64}$/;

type RelatedContent = {
	component: 'product-carousel';
	props: { title: string; products: Array<{ productId: string; role: 'standard' }>; showQuickAdd: false };
};

export type KibblePdpLivePreviewExpectation = {
	routePath: '/product/puppy-starter-kit';
	policyVersion: string;
	productIds: readonly string[];
	relatedHeading: string;
};

export type KibblePdpLivePreview = {
	products: KibbleProduct[];
	zoneAdapter: KibbleZoneAdapterBinding<RelatedContent>;
};

export function listenForKibblePdpLivePreview(input: {
	expectation: KibblePdpLivePreviewExpectation;
	products: readonly KibbleProduct[];
	onApplied: (preview: KibblePdpLivePreview) => void;
	onStatus: (status: 'updating' | 'applied' | 'failed') => void;
}): () => void {
	let active = true;
	let controller: AbortController | null = null;
	const onRequest = async () => {
		if (controller) return;
		const next = new AbortController();
		controller = next;
		input.onStatus('updating');
		let timedOut = false;
		const timeout = window.setTimeout(() => { timedOut = true; next.abort(); }, KIBBLE_DEMO_MAX_PUBLIC_CLIENT_TIMEOUT_MS);
		try {
			const response = await fetch('/api/kibble/pdp-related-decision?observe=true', {
				method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'model' }), signal: next.signal,
			});
			if (!response.ok) throw new Error(`Preview request failed (${response.status})`);
			const preview = validateKibblePdpLivePreview(await response.json(), input.expectation, input.products);
			if (!preview || !active || next.signal.aborted) throw new Error('Preview response rejected');
			input.onApplied(preview);
			input.onStatus('applied');
		} catch (error) {
			if (!active || (next.signal.aborted && !timedOut)) return;
			console.warn('Kibble PDP live preview was rejected; retaining the approved related rail.', error);
			input.onStatus('failed');
		} finally {
			window.clearTimeout(timeout);
			if (controller === next) controller = null;
		}
	};
	window.addEventListener('aisles-kibble-pdp-model-request', onRequest);
	return () => {
		active = false;
		controller?.abort();
		window.removeEventListener('aisles-kibble-pdp-model-request', onRequest);
	};
}

/** Reject every response except an exact permutation of the server-rendered rail. */
export function validateKibblePdpLivePreview(
	value: unknown,
	expected: KibblePdpLivePreviewExpectation,
	products: readonly KibbleProduct[],
): KibblePdpLivePreview | null {
	if (!isRecord(value) || !hasOnlyKeys(value, RESPONSE_KEYS)
		|| value.version !== 'kibble-pdp-related-preview-v1' || value.previewOnly !== true
		|| value.routePath !== expected.routePath || value.policyVersion !== expected.policyVersion
		|| !Array.isArray(value.rankedProductIds) || value.rankedProductIds.some((id) => typeof id !== 'string')
		|| !sameIdSet(value.rankedProductIds, expected.productIds)) return null;
	const modelCallCount = value.modelCallCount;
	if (!isModelCallCount(modelCallCount)
		|| !isRelatedAdapter(value.zoneAdapter, value.rankedProductIds, modelCallCount, expected.relatedHeading)) return null;
	const byEntityId = new Map(products.map((product) => [String(product.entityId), product]));
	const reordered = value.rankedProductIds.map((id) => byEntityId.get(id));
	if (reordered.some((product): product is undefined => product === undefined)) return null;
	return { products: reordered as KibbleProduct[], zoneAdapter: value.zoneAdapter };
}

function isRelatedAdapter(value: unknown, ids: readonly string[], modelCallCount: number, relatedHeading: string): value is KibbleZoneAdapterBinding<RelatedContent> {
	if (!isRecord(value) || !hasOnlyKeys(value, ADAPTER_KEYS)
		|| value.instanceId !== 'pdp.related' || value.sharedStatus !== 'live' || value.sharedContentKind !== 'content'
		|| value.decisionMode !== 'model' || value.modelCallCount !== modelCallCount
		|| value.adapterId !== 'kibble.zone.pdp.related' || value.componentVariantId !== 'kibble.product-detail.related-products'
		|| typeof value.inputSha256 !== 'string' || !HEX_64.test(value.inputSha256)
		|| !isRecord(value.content) || !hasOnlyKeys(value.content, CONTENT_KEYS)
		|| value.content.component !== 'product-carousel' || !isRecord(value.content.props) || !hasOnlyKeys(value.content.props, PROPS_KEYS)
		|| value.content.props.title !== relatedHeading || value.content.props.showQuickAdd !== false || !Array.isArray(value.content.props.products)) return false;
	const refs = value.content.props.products;
	return refs.every((ref) => isRecord(ref) && hasOnlyKeys(ref, PRODUCT_REF_KEYS) && typeof ref.productId === 'string' && ref.role === 'standard')
		&& refs.length === ids.length && refs.every((ref, index) => ref.productId === ids[index]);
}

function isRecord(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function isModelCallCount(value: unknown): value is number { return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 2; }
function hasOnlyKeys(value: Record<string, unknown>, allowed: Set<string>) { return Object.keys(value).every((key) => allowed.has(key)); }
function sameIdSet(actual: readonly string[], expected: readonly string[]) {
	return actual.length === expected.length && new Set(actual).size === actual.length && actual.every((id) => expected.includes(id));
}
