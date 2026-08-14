import type { KibbleProduct, KibbleZoneAdapterBinding } from './types';
import { KIBBLE_DEMO_PLP_CLIENT_TIMEOUT_MS } from '$lib/kibble-demo-ai-boundary';
import { buildKibbleDecisionEvidence, type KibbleLivePreviewStatus } from './kibble-dev-inspector';
import {
	KIBBLE_PLP_PRESENTATION_POLICY,
	materializeKibblePlpPresentation,
	parseKibblePlpPresentationDecision,
	snapshotKibblePlpPresentation,
	type KibblePlpPresentationDecision,
	type KibblePresentationSnapshot,
} from '$lib/brand/reference/kibble-presentation-decisions';

const RESPONSE_KEYS = new Set(['version', 'previewOnly', 'routePath', 'sort', 'cursor', 'policyVersion', 'reference', 'persona', 'prefixIds', 'tailIds', 'rankedPrefixIds', 'presentationPolicy', 'presentationDecision', 'zoneAdapter', 'modelCallCount', 'provider', 'modelId', 'provenance']);
const ADAPTER_KEYS = new Set(['instanceId', 'sharedStatus', 'sharedContentKind', 'decisionMode', 'modelCallCount', 'adapterId', 'componentVariantId', 'inputSha256', 'content']);
const CONTENT_KEYS = new Set(['component', 'props']);
const PROP_KEYS = new Set(['columns', 'products', 'imageRatio', 'showDescription', 'showSpecs', 'showQuickAdd']);
const PRODUCT_REF_KEYS = new Set(['productId', 'role']);
const HEX_64 = /^[0-9a-f]{64}$/;
const REQUEST_TIMEOUT_MS = KIBBLE_DEMO_PLP_CLIENT_TIMEOUT_MS;

export type KibblePlpLivePreviewExpectation = {
	routePath: string; sort: 'FEATURED'; cursor: null; policyVersion: string;
	reference: { id: string; version: string }; prefixIds: readonly string[]; tailIds: readonly string[]; expectedInputSha256: string;
	title: string; productCount: number; productSingular: string; productPlural: string;
};
export type KibblePlpLivePreview = { products: KibbleProduct[]; zoneAdapter: KibbleZoneAdapterBinding; presentationDecision: KibblePlpPresentationDecision; persona: 'gatherer' | 'hunter' | 'researcher' | 'gifter'; provider: 'anthropic'; modelId: string; modelCallCount: number };

export function listenForKibblePlpLivePreview(input: {
	expectation: KibblePlpLivePreviewExpectation; products: readonly KibbleProduct[];
	getCurrentPresentation: () => KibblePresentationSnapshot;
	onApplied: (preview: KibblePlpLivePreview) => void; onStatus: (status: KibbleLivePreviewStatus) => void;
}): () => void {
	let active = true;
	let controller: AbortController | null = null;
	const onRequest = async () => {
		if (controller) return; // one paid dispatch at a time; a repeated click cannot replace it.
		const next = new AbortController(); controller = next; input.onStatus({ state: 'updating', mode: 'model' });
		const presentationBefore = input.getCurrentPresentation();
		let timedOut = false;
		const timeout = window.setTimeout(() => { timedOut = true; next.abort(); }, REQUEST_TIMEOUT_MS);
		try {
			const response = await fetch('/api/kibble/plp-product-ranking-decision?observe=true', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'model', routePath: input.expectation.routePath }), signal: next.signal });
			if (!response.ok) throw new Error(`Preview request failed (${response.status})`);
			const preview = validateKibblePlpLivePreview(await response.json(), input.expectation, input.products);
			if (!preview || !active || next.signal.aborted) throw new Error('Preview response rejected');
			const before = input.products.map(({ id, name }) => ({ id, name }));
			const after = preview.products.map(({ id, name }) => ({ id, name }));
			const presentationAfter = snapshotKibblePlpPresentation(materializeKibblePlpPresentation(preview.presentationDecision, input.expectation));
			const evidence = buildKibbleDecisionEvidence({ surface: 'plp', zoneId: 'plp.presentation', zoneLabel: 'Category presentation', policyVersion: KIBBLE_PLP_PRESENTATION_POLICY.policyVersion, before, after, provider: preview.provider, model: preview.modelId, calls: preview.modelCallCount, state: 'applied', presentationBefore, presentationAfter });
			input.onApplied(preview); input.onStatus({ state: 'applied', mode: 'model', persona: preview.persona, changed: hasChanges(evidence), evidence });
		} catch (error) {
			if (!active || (next.signal.aborted && !timedOut)) return;
			console.warn('Kibble PLP live preview was rejected; retaining the server-rendered catalog presentation.', error); const before = input.products.map(({ id, name }) => ({ id, name })); input.onStatus({ state: 'failed', mode: 'model', evidence: buildKibbleDecisionEvidence({ surface: 'plp', zoneId: 'plp.presentation', zoneLabel: 'Category presentation', policyVersion: KIBBLE_PLP_PRESENTATION_POLICY.policyVersion, before, after: before, provider: null, model: null, calls: null, state: 'failed', presentationBefore, presentationAfter: presentationBefore }) });
		} finally {
			window.clearTimeout(timeout);
			if (controller === next) controller = null;
		}
	};
	window.addEventListener('aisles-kibble-plp-model-request', onRequest);
	return () => { active = false; controller?.abort(); window.removeEventListener('aisles-kibble-plp-model-request', onRequest); };
}

/** A response may change exactly the prefix; the server-rendered tail is immutable. */
export function validateKibblePlpLivePreview(value: unknown, expected: KibblePlpLivePreviewExpectation, products: readonly KibbleProduct[]): KibblePlpLivePreview | null {
	if (!isRecord(value) || !hasOnlyKeys(value, RESPONSE_KEYS) || value.version !== 'kibble-plp-presentation-preview-v2' || value.previewOnly !== true
		|| value.routePath !== expected.routePath || value.sort !== expected.sort || value.cursor !== expected.cursor || value.policyVersion !== expected.policyVersion
		|| !sameReference(value.reference, expected.reference) || !sameIds(value.prefixIds, expected.prefixIds) || !sameIds(value.tailIds, expected.tailIds)
		|| !sameIdSet(value.rankedPrefixIds, expected.prefixIds) || !isModelCallCount(value.modelCallCount)
		|| !isPersona(value.persona) || value.provider !== 'anthropic' || typeof value.modelId !== 'string' || value.modelId.length < 1) return null;
	const presentationDecision = parseKibblePlpPresentationDecision(value.presentationDecision);
	if (!presentationDecision || !samePolicy(value.presentationPolicy)) return null;
	const rankedPrefixIds = value.rankedPrefixIds as string[];
	const tailIds = value.tailIds as string[];
	const modelCallCount = value.modelCallCount as number;
	if (!isAdapter(value.zoneAdapter, expected.expectedInputSha256, rankedPrefixIds, tailIds, modelCallCount)) return null;
	const allOriginal = [...expected.prefixIds, ...expected.tailIds];
	if (!sameIds(products.map(({ entityId }) => String(entityId)), allOriginal)) return null;
	const byId = new Map(products.map((product) => [String(product.entityId), product]));
	const reordered = [...rankedPrefixIds, ...tailIds].map((id) => byId.get(id));
	return reordered.some((product) => product === undefined) ? null : { products: reordered as KibbleProduct[], zoneAdapter: value.zoneAdapter, presentationDecision, persona: value.persona, provider: value.provider, modelId: value.modelId, modelCallCount };
}

function isAdapter(value: unknown, expectedInputSha256: string, rankedPrefixIds: readonly string[], tailIds: readonly string[], modelCallCount: number): value is KibbleZoneAdapterBinding {
	if (!isRecord(value) || !hasOnlyKeys(value, ADAPTER_KEYS) || value.instanceId !== 'plp.product-ranking' || value.sharedStatus !== 'live' || value.sharedContentKind !== 'content'
		|| value.decisionMode !== 'model' || value.modelCallCount !== modelCallCount || value.adapterId !== 'kibble.zone.plp.product-ranking' || value.componentVariantId !== 'kibble.category-listing.ranked-prefix'
		|| typeof value.inputSha256 !== 'string' || !HEX_64.test(value.inputSha256) || value.inputSha256 !== expectedInputSha256) return false;
	if (!isRecord(value.content) || !hasOnlyKeys(value.content, CONTENT_KEYS) || value.content.component !== 'product-grid' || !isRecord(value.content.props) || !hasOnlyKeys(value.content.props, PROP_KEYS)) return false;
	const props = value.content.props;
	if (props.columns !== 4 || props.imageRatio !== 'square' || props.showDescription !== false || props.showSpecs !== false || props.showQuickAdd !== false || !Array.isArray(props.products) || props.products.length !== rankedPrefixIds.length) return false;
	return rankedPrefixIds.length >= 3 && rankedPrefixIds.length <= 8 && tailIds.length >= 0 && props.products.every((product, index) => isRecord(product) && hasOnlyKeys(product, PRODUCT_REF_KEYS) && product.productId === rankedPrefixIds[index] && product.role === 'standard');
}
function isRecord(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function hasOnlyKeys(value: Record<string, unknown>, keys: Set<string>) { return Object.keys(value).every((key) => keys.has(key)); }
function isModelCallCount(value: unknown): value is number { return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 2; }
function sameIds(value: unknown, expected: readonly string[]) { return Array.isArray(value) && value.every((id) => typeof id === 'string') && value.length === expected.length && value.every((id, index) => id === expected[index]); }
function sameIdSet(value: unknown, expected: readonly string[]) { return Array.isArray(value) && value.every((id) => typeof id === 'string') && value.length === expected.length && new Set(value).size === value.length && value.every((id) => expected.includes(id)); }
function sameReference(value: unknown, expected: { id: string; version: string }) { return isRecord(value) && Object.keys(value).length === 2 && value.id === expected.id && value.version === expected.version; }
function isPersona(value: unknown): value is KibblePlpLivePreview['persona'] { return value === 'gatherer' || value === 'hunter' || value === 'researcher' || value === 'gifter'; }
function sameProductOrder(left: readonly { id: string }[], right: readonly { id: string }[]) { return left.length === right.length && left.every((product, index) => product.id === right[index]?.id); }
function samePolicy(value: unknown) { return isRecord(value) && Object.keys(value).length === 3 && value.policyVersion === KIBBLE_PLP_PRESENTATION_POLICY.policyVersion && sameIds(value.zoneIds, KIBBLE_PLP_PRESENTATION_POLICY.zoneIds) && sameIds(value.capabilities, KIBBLE_PLP_PRESENTATION_POLICY.capabilities); }
function hasChanges(evidence: ReturnType<typeof buildKibbleDecisionEvidence>) { return !sameProductOrder(evidence.before, evidence.after) || [...evidence.copy, ...evidence.components, ...evidence.sections, ...evidence.marketingBlocks].some(({ changed }) => changed); }
