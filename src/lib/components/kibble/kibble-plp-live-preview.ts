import type { KibbleModelZoneAdapterBinding, KibbleProduct, KibbleRenderedModelZoneAdapterBinding } from './types';
import { KIBBLE_DEMO_PLP_CLIENT_TIMEOUT_MS, kibbleModelCallCountFromPayload, readKibbleModelFailureCallCount } from '$lib/kibble-demo-ai-boundary';
import { buildKibbleDecisionEvidence, type KibbleLivePreviewStatus } from './kibble-dev-inspector';
import {
	KIBBLE_PLP_PRESENTATION_POLICY,
	materializeKibblePlpPresentation,
	parseKibblePlpPresentationDecision,
	snapshotKibblePlpPresentation,
	type KibblePlpPresentationDecision,
	type KibblePresentationSnapshot,
} from '$lib/brand/reference/kibble-presentation-decisions';

const RESPONSE_KEYS = new Set(['version', 'previewOnly', 'routePath', 'sort', 'cursor', 'policyVersion', 'reference', 'persona', 'prefixIds', 'tailIds', 'rankedPrefixIds', 'presentationPolicy', 'zoneArtifacts', 'modelCallCount', 'provider', 'modelId', 'provenance']);
const ADAPTER_KEYS = new Set(['instanceId', 'sharedStatus', 'sharedContentKind', 'decisionMode', 'modelCallCount', 'adapterId', 'componentVariantId', 'inputSha256', 'content', 'selection']);
const MODEL_SELECTION_KEYS = new Set(['componentVariantId', 'copyVariantId', 'placementId', 'visible']);
const PRESENTATION_ADAPTER_KEYS = new Set(['header', 'ranking', 'marketing']);
const CONTENT_KEYS = new Set(['component', 'props']);
const PROP_KEYS = new Set(['columns', 'products', 'imageRatio', 'showDescription', 'showSpecs', 'showQuickAdd']);
const PRODUCT_REF_KEYS = new Set(['productId', 'role']);
const HEX_64 = /^[0-9a-f]{64}$/;
const REQUEST_TIMEOUT_MS = KIBBLE_DEMO_PLP_CLIENT_TIMEOUT_MS;

type EditorialContent = { component: 'editorial-header'; props: { eyebrow: string; headline: string; body: string } };
type ProductGridContent = {
	component: 'product-grid';
	props: { columns: 4; products: Array<{ productId: string; role: 'standard' }>; imageRatio: 'square'; showDescription: false; showSpecs: false; showQuickAdd: false };
};

export type KibblePlpLivePreviewExpectation = {
	routePath: string; sort: 'FEATURED'; cursor: null; policyVersion: string;
	reference: { id: string; version: string }; prefixIds: readonly string[]; tailIds: readonly string[]; expectedInputSha256: string;
	title: string; productCount: number; productSingular: string; productPlural: string;
};
export type KibblePlpLivePreview = {
	products: KibbleProduct[];
	zoneAdapter: KibbleRenderedModelZoneAdapterBinding<ProductGridContent>;
	presentationDecision: KibblePlpPresentationDecision;
	zoneArtifacts: {
		header: KibbleRenderedModelZoneAdapterBinding<EditorialContent>;
		ranking: KibbleRenderedModelZoneAdapterBinding<ProductGridContent>;
		marketing: KibbleModelZoneAdapterBinding<EditorialContent>;
	};
	persona: 'gatherer' | 'hunter' | 'researcher' | 'gifter';
	provider: 'anthropic';
	modelId: string;
	modelCallCount: number;
};

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
		let failedModelCallCount: number | null = null;
		let timedOut = false;
		const timeout = window.setTimeout(() => { timedOut = true; next.abort(); }, REQUEST_TIMEOUT_MS);
		try {
			const response = await fetch('/api/kibble/plp-product-ranking-decision?observe=true', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'model', routePath: input.expectation.routePath }), signal: next.signal });
			if (!response.ok) { failedModelCallCount = await readKibbleModelFailureCallCount(response); throw new Error(`Preview request failed (${response.status})`); }
			const payload: unknown = await response.json(); failedModelCallCount = kibbleModelCallCountFromPayload(payload);
			const preview = validateKibblePlpLivePreview(payload, input.expectation, input.products);
			if (!preview || !active || next.signal.aborted) throw new Error('Preview response rejected');
			const before = input.products.map(({ id, name }) => ({ id, name }));
			const after = preview.products.map(({ id, name }) => ({ id, name }));
			const presentationAfter = snapshotKibblePlpPresentation(materializeKibblePlpPresentation(preview.presentationDecision, input.expectation));
			const evidence = buildKibbleDecisionEvidence({ surface: 'plp', zoneIds: KIBBLE_PLP_PRESENTATION_POLICY.zoneIds, zoneLabel: 'Category presentation', policyVersion: KIBBLE_PLP_PRESENTATION_POLICY.policyVersion, before, after, provider: preview.provider, model: preview.modelId, calls: preview.modelCallCount, state: 'applied', presentationBefore, presentationAfter });
			input.onApplied(preview); input.onStatus({ state: 'applied', mode: 'model', persona: preview.persona, changed: hasChanges(evidence), evidence });
		} catch (error) {
			if (!active || (next.signal.aborted && !timedOut)) return;
			console.warn('Kibble PLP live preview was rejected; retaining the server-rendered catalog presentation.', error); const before = input.products.map(({ id, name }) => ({ id, name })); input.onStatus({ state: 'failed', mode: 'model', evidence: buildKibbleDecisionEvidence({ surface: 'plp', zoneIds: KIBBLE_PLP_PRESENTATION_POLICY.zoneIds, zoneLabel: 'Category presentation', policyVersion: KIBBLE_PLP_PRESENTATION_POLICY.policyVersion, before, after: before, provider: null, model: null, calls: failedModelCallCount, state: 'failed', presentationBefore, presentationAfter: presentationBefore }) });
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
	if (!samePolicy(value.presentationPolicy)) return null;
	const rankedPrefixIds = value.rankedPrefixIds as string[];
	const tailIds = value.tailIds as string[];
	const modelCallCount = value.modelCallCount as number;
	const parsedArtifacts = parsePlpZoneArtifacts(value.zoneArtifacts, expected, rankedPrefixIds, tailIds, modelCallCount);
	if (!parsedArtifacts) return null;
	const allOriginal = [...expected.prefixIds, ...expected.tailIds];
	if (!sameIds(products.map(({ entityId }) => String(entityId)), allOriginal)) return null;
	const byId = new Map(products.map((product) => [String(product.entityId), product]));
	const reordered = [...rankedPrefixIds, ...tailIds].map((id) => byId.get(id));
	return reordered.some((product) => product === undefined) ? null : {
		products: reordered as KibbleProduct[], zoneAdapter: parsedArtifacts.artifacts.ranking,
		presentationDecision: parsedArtifacts.decision, zoneArtifacts: parsedArtifacts.artifacts,
		persona: value.persona, provider: value.provider, modelId: value.modelId, modelCallCount,
	};
}

function isAdapter(value: unknown, expectedInputSha256: string, rankedPrefixIds: readonly string[], tailIds: readonly string[], modelCallCount: number): value is KibbleRenderedModelZoneAdapterBinding<ProductGridContent> {
	if (!isRecord(value) || !hasOnlyKeys(value, ADAPTER_KEYS) || value.instanceId !== 'plp.product-ranking' || value.sharedStatus !== 'live' || value.sharedContentKind !== 'content'
		|| value.decisionMode !== 'model' || value.modelCallCount !== modelCallCount || value.adapterId !== 'kibble.zone.plp.product-ranking' || value.componentVariantId !== 'kibble.category-listing.ranked-prefix'
		|| typeof value.inputSha256 !== 'string' || !HEX_64.test(value.inputSha256) || value.inputSha256 !== expectedInputSha256
		|| !sameSelection(value.selection, { componentVariantId: 'kibble.category-listing.ranked-prefix' })) return false;
	if (!isRecord(value.content) || !hasOnlyKeys(value.content, CONTENT_KEYS) || value.content.component !== 'product-grid' || !isRecord(value.content.props) || !hasOnlyKeys(value.content.props, PROP_KEYS)) return false;
	const props = value.content.props;
	if (props.columns !== 4 || props.imageRatio !== 'square' || props.showDescription !== false || props.showSpecs !== false || props.showQuickAdd !== false || !Array.isArray(props.products) || props.products.length !== rankedPrefixIds.length) return false;
	return rankedPrefixIds.length >= 3 && rankedPrefixIds.length <= 8 && tailIds.length >= 0 && props.products.every((product, index) => isRecord(product) && hasOnlyKeys(product, PRODUCT_REF_KEYS) && product.productId === rankedPrefixIds[index] && product.role === 'standard');
}

function parsePlpZoneArtifacts(
	value: unknown,
	expected: KibblePlpLivePreviewExpectation,
	rankedPrefixIds: readonly string[],
	tailIds: readonly string[],
	modelCallCount: number,
): { artifacts: KibblePlpLivePreview['zoneArtifacts']; decision: KibblePlpPresentationDecision } | null {
	if (!isRecord(value) || !hasOnlyKeys(value, PRESENTATION_ADAPTER_KEYS)
		|| !isRecord(value.header) || !isRecord(value.marketing)
		|| !isRecord(value.header.selection) || !isRecord(value.marketing.selection)
		|| !isAdapter(value.ranking, expected.expectedInputSha256, rankedPrefixIds, tailIds, modelCallCount)) return null;
	const decision = parseKibblePlpPresentationDecision({
		headerCopyVariantId: value.header.selection.copyVariantId,
		marketingBlockVariantId: value.marketing.selection.copyVariantId,
	});
	if (!decision) return null;
	const selected = materializeKibblePlpPresentation(decision, expected);
	if (!isEditorialAdapter(value.header, {
		instanceId: 'plp.editorial-header', adapterId: 'kibble.zone.plp.editorial-header',
		componentVariantId: 'kibble.category-listing.editorial-header', copyVariantId: decision.headerCopyVariantId,
		modelCallCount, content: { eyebrow: selected.header.eyebrow, headline: selected.header.title, body: selected.header.body },
	})) return null;
	const marketing = value.marketing;
	const visible = decision.marketingBlockVariantId !== 'none';
	if (!isModelAdapterBase(marketing, {
		instanceId: 'plp.marketing-block', adapterId: 'kibble.zone.plp.marketing-block',
		componentVariantId: 'kibble.hero.zone-editorial-header', modelCallCount,
	}) || !sameSelection(marketing.selection, {
		componentVariantId: 'kibble.hero.zone-editorial-header',
		copyVariantId: decision.marketingBlockVariantId,
		visible,
	}) || marketing.sharedContentKind !== (visible ? 'content' : 'hidden')) return null;
	if (visible) {
		if (!selected.marketingBlock || !isEditorialContent(marketing.content, selected.marketingBlock)) return null;
	} else if ('content' in marketing) return null;
	return { artifacts: value as KibblePlpLivePreview['zoneArtifacts'], decision };
}

function isEditorialAdapter(value: unknown, expected: {
	instanceId: string; adapterId: string; componentVariantId: string; copyVariantId: string; modelCallCount: number;
	content: { eyebrow: string; headline: string; body: string };
}): boolean {
	return isModelAdapterBase(value, expected) && value.sharedContentKind === 'content'
		&& sameSelection(value.selection, { componentVariantId: expected.componentVariantId, copyVariantId: expected.copyVariantId })
		&& isEditorialContent(value.content, expected.content);
}

function isModelAdapterBase(value: unknown, expected: {
	instanceId: string; adapterId: string; componentVariantId: string; modelCallCount: number;
}): value is Record<string, unknown> {
	return isRecord(value) && hasOnlyKeys(value, ADAPTER_KEYS)
		&& value.instanceId === expected.instanceId && value.adapterId === expected.adapterId
		&& value.componentVariantId === expected.componentVariantId && value.sharedStatus === 'live'
		&& value.decisionMode === 'model' && value.modelCallCount === expected.modelCallCount
		&& typeof value.inputSha256 === 'string' && HEX_64.test(value.inputSha256)
		&& isRecord(value.selection) && hasOnlyKeys(value.selection, MODEL_SELECTION_KEYS);
}

function isEditorialContent(value: unknown, expected: { eyebrow: string; headline: string; body: string }): boolean {
	return isRecord(value) && hasOnlyKeys(value, CONTENT_KEYS) && value.component === 'editorial-header'
		&& isRecord(value.props) && JSON.stringify(value.props) === JSON.stringify(expected);
}

function sameSelection(value: unknown, expected: Record<string, unknown>): boolean {
	return isRecord(value) && hasOnlyKeys(value, MODEL_SELECTION_KEYS)
		&& Object.keys(value).length === Object.keys(expected).length
		&& Object.entries(expected).every(([key, expectedValue]) => value[key] === expectedValue);
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
