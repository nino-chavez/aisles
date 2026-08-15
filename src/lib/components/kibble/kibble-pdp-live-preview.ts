import type { KibbleModelZoneAdapterBinding, KibbleProduct, KibbleRenderedModelZoneAdapterBinding } from './types';
import { KIBBLE_DEMO_MAX_PUBLIC_CLIENT_TIMEOUT_MS, kibbleModelCallCountFromPayload, readKibbleModelFailureCallCount } from '$lib/kibble-demo-ai-boundary';
import { buildKibbleDecisionEvidence, type KibbleLivePreviewStatus } from './kibble-dev-inspector';
import {
	KIBBLE_PDP_PRESENTATION_POLICY,
	materializeKibblePdpPresentation,
	parseKibblePdpPresentationDecision,
	snapshotKibblePdpPresentation,
	type KibblePdpPresentationDecision,
	type KibblePresentationSnapshot,
} from '$lib/brand/reference/kibble-presentation-decisions';

const RESPONSE_KEYS = new Set(['version', 'previewOnly', 'routePath', 'policyVersion', 'persona', 'rankedProductIds', 'presentationPolicy', 'zoneArtifacts', 'modelCallCount', 'provider', 'modelId', 'provenance']);
const ADAPTER_KEYS = new Set(['instanceId', 'sharedStatus', 'sharedContentKind', 'decisionMode', 'modelCallCount', 'adapterId', 'componentVariantId', 'inputSha256', 'content', 'selection']);
const MODEL_SELECTION_KEYS = new Set(['componentVariantId', 'copyVariantId', 'placementId', 'visible']);
const ZONE_ARTIFACT_KEYS = new Set(['related', 'marketing']);
const CONTENT_KEYS = new Set(['component', 'props']);
const PROPS_KEYS = new Set(['title', 'products', 'showQuickAdd']);
const PRODUCT_REF_KEYS = new Set(['productId', 'role']);
const HEX_64 = /^[0-9a-f]{64}$/;

type RelatedContent = {
	component: 'product-carousel';
	props: { title: string; products: Array<{ productId: string; role: 'standard' }>; showQuickAdd: false };
};

export type KibblePdpLivePreviewExpectation = {
	routePath: string;
	policyVersion: string;
	productIds: readonly string[];
	relatedHeading: string;
};

export type KibblePdpLivePreview = {
	products: KibbleProduct[];
	zoneAdapter: KibbleRenderedModelZoneAdapterBinding<RelatedContent>;
	persona: 'gatherer' | 'hunter' | 'researcher' | 'gifter';
	provider: 'anthropic';
	modelId: string;
	modelCallCount: number;
	presentationDecision: KibblePdpPresentationDecision;
	zoneArtifacts: { related: KibbleRenderedModelZoneAdapterBinding<RelatedContent>; marketing: KibbleModelZoneAdapterBinding<{ component: 'editorial-header'; props: { eyebrow: string; headline: string; body: string } }> };
};

export function listenForKibblePdpLivePreview(input: {
	expectation: KibblePdpLivePreviewExpectation;
	products: readonly KibbleProduct[];
	getCurrentPresentation: () => KibblePresentationSnapshot;
	onApplied: (preview: KibblePdpLivePreview) => void;
	onStatus: (status: KibbleLivePreviewStatus) => void;
}): () => void {
	let active = true;
	let controller: AbortController | null = null;
	const onRequest = async () => {
		if (controller) return;
		const next = new AbortController();
		controller = next;
		input.onStatus({ state: 'updating', mode: 'model' });
		const presentationBefore = input.getCurrentPresentation();
		let failedModelCallCount: number | null = null;
		let timedOut = false;
		const timeout = window.setTimeout(() => { timedOut = true; next.abort(); }, KIBBLE_DEMO_MAX_PUBLIC_CLIENT_TIMEOUT_MS);
		try {
			const response = await fetch('/api/kibble/pdp-related-decision?observe=true', {
				method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'model', routePath: input.expectation.routePath }), signal: next.signal,
			});
			if (!response.ok) { failedModelCallCount = await readKibbleModelFailureCallCount(response); throw new Error(`Preview request failed (${response.status})`); }
			const payload: unknown = await response.json(); failedModelCallCount = kibbleModelCallCountFromPayload(payload);
			const preview = validateKibblePdpLivePreview(payload, input.expectation, input.products);
			if (!preview || !active || next.signal.aborted) throw new Error('Preview response rejected');
			const before = input.products.map(({ id, name }) => ({ id, name }));
			const after = preview.products.map(({ id, name }) => ({ id, name }));
			const presentationAfter = snapshotKibblePdpPresentation(materializeKibblePdpPresentation(preview.presentationDecision));
			const evidence = buildKibbleDecisionEvidence({
				surface: 'pdp', zoneIds: KIBBLE_PDP_PRESENTATION_POLICY.zoneIds, zoneLabel: 'Product-detail presentation', policyVersion: KIBBLE_PDP_PRESENTATION_POLICY.policyVersion,
				before, after, provider: preview.provider, model: preview.modelId, calls: preview.modelCallCount, state: 'applied', presentationBefore, presentationAfter,
			});
			input.onApplied(preview);
			input.onStatus({
				state: 'applied', mode: 'model', persona: preview.persona,
				changed: hasChanges(evidence),
				evidence,
			});
		} catch (error) {
			if (!active || (next.signal.aborted && !timedOut)) return;
			console.warn('Kibble PDP live preview was rejected; retaining the approved related rail.', error);
			const before = input.products.map(({ id, name }) => ({ id, name }));
			input.onStatus({ state: 'failed', mode: 'model', evidence: buildKibbleDecisionEvidence({ surface: 'pdp', zoneIds: KIBBLE_PDP_PRESENTATION_POLICY.zoneIds, zoneLabel: 'Product-detail presentation', policyVersion: KIBBLE_PDP_PRESENTATION_POLICY.policyVersion, before, after: before, provider: null, model: null, calls: failedModelCallCount, state: 'failed', presentationBefore, presentationAfter: presentationBefore }) });
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
		|| value.version !== 'kibble-pdp-presentation-preview-v2' || value.previewOnly !== true
		|| value.routePath !== expected.routePath || value.policyVersion !== expected.policyVersion
		|| !isPersona(value.persona)
		|| !Array.isArray(value.rankedProductIds) || value.rankedProductIds.some((id) => typeof id !== 'string')
		|| !sameIdSet(value.rankedProductIds, expected.productIds)) return null;
	const modelCallCount = value.modelCallCount;
	if (!isModelCallCount(modelCallCount)
		|| value.provider !== 'anthropic' || typeof value.modelId !== 'string' || value.modelId.length < 1
		|| !samePolicy(value.presentationPolicy)) return null;
	const parsedArtifacts = parsePdpZoneArtifacts(value.zoneArtifacts, value.rankedProductIds, modelCallCount);
	if (!parsedArtifacts) return null;
	const byEntityId = new Map(products.map((product) => [String(product.entityId), product]));
	const reordered = value.rankedProductIds.map((id) => byEntityId.get(id));
	if (reordered.some((product): product is undefined => product === undefined)) return null;
	return {
		products: reordered as KibbleProduct[], zoneAdapter: parsedArtifacts.artifacts.related,
		presentationDecision: parsedArtifacts.decision, zoneArtifacts: parsedArtifacts.artifacts,
		persona: value.persona, provider: value.provider, modelId: value.modelId, modelCallCount,
	};
}

function isRelatedAdapter(value: unknown, ids: readonly string[], modelCallCount: number, relatedHeading: string): value is KibbleRenderedModelZoneAdapterBinding<RelatedContent> {
	if (!isRecord(value) || !hasOnlyKeys(value, ADAPTER_KEYS)
		|| value.instanceId !== 'pdp.related' || value.sharedStatus !== 'live' || value.sharedContentKind !== 'content'
		|| value.decisionMode !== 'model' || value.modelCallCount !== modelCallCount
		|| value.adapterId !== 'kibble.zone.pdp.related' || value.componentVariantId !== 'kibble.product-detail.related-products'
		|| typeof value.inputSha256 !== 'string' || !HEX_64.test(value.inputSha256)
		|| !isRecord(value.selection) || !hasOnlyKeys(value.selection, MODEL_SELECTION_KEYS)
		|| !isRecord(value.content) || !hasOnlyKeys(value.content, CONTENT_KEYS)
		|| value.content.component !== 'product-carousel' || !isRecord(value.content.props) || !hasOnlyKeys(value.content.props, PROPS_KEYS)
		|| value.content.props.title !== relatedHeading || value.content.props.showQuickAdd !== false || !Array.isArray(value.content.props.products)) return false;
	const refs = value.content.props.products;
	return refs.every((ref) => isRecord(ref) && hasOnlyKeys(ref, PRODUCT_REF_KEYS) && typeof ref.productId === 'string' && ref.role === 'standard')
		&& refs.length === ids.length && refs.every((ref, index) => ref.productId === ids[index]);
}

function parsePdpZoneArtifacts(
	value: unknown,
	rankedProductIds: readonly string[],
	modelCallCount: number,
): { artifacts: KibblePdpLivePreview['zoneArtifacts']; decision: KibblePdpPresentationDecision } | null {
	if (!isRecord(value) || !hasOnlyKeys(value, ZONE_ARTIFACT_KEYS)
		|| !isRecord(value.related) || !isRecord(value.marketing)
		|| !isRecord(value.related.selection) || !isRecord(value.marketing.selection)) return null;
	const decision = parseKibblePdpPresentationDecision({
		relatedCopyVariantId: value.related.selection.copyVariantId,
		marketingBlockVariantId: value.marketing.selection.copyVariantId,
	});
	if (!decision) return null;
	const selected = materializeKibblePdpPresentation(decision);
	if (!isRelatedAdapter(value.related, rankedProductIds, modelCallCount, selected.relatedHeading)
		|| !sameSelection(value.related.selection, {
			componentVariantId: 'kibble.product-detail.related-products',
			copyVariantId: decision.relatedCopyVariantId,
		})) return null;
	const visible = decision.marketingBlockVariantId !== 'none';
	if (!isModelArtifactBase(value.marketing, {
		instanceId: 'pdp.below-description', adapterId: 'kibble.zone.pdp.below-description',
		componentVariantId: 'kibble.hero.zone-editorial-header', modelCallCount,
	}) || !sameSelection(value.marketing.selection, {
		componentVariantId: 'kibble.hero.zone-editorial-header',
		copyVariantId: decision.marketingBlockVariantId,
		visible,
	}) || value.marketing.sharedContentKind !== (visible ? 'content' : 'hidden')) return null;
	if (visible) {
		if (!selected.marketingBlock || !isEditorialContent(value.marketing.content, selected.marketingBlock)) return null;
	} else if ('content' in value.marketing) return null;
	return { artifacts: value as KibblePdpLivePreview['zoneArtifacts'], decision };
}

function isModelArtifactBase(value: unknown, expected: {
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
function isModelCallCount(value: unknown): value is number { return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 2; }
function hasOnlyKeys(value: Record<string, unknown>, allowed: Set<string>) { return Object.keys(value).every((key) => allowed.has(key)); }
function sameIdSet(actual: readonly string[], expected: readonly string[]) {
	return actual.length === expected.length && new Set(actual).size === actual.length && actual.every((id) => expected.includes(id));
}
function sameIds(left: readonly { id: string }[], right: readonly { id: string }[]) {
	return left.length === right.length && left.every((product, index) => product.id === right[index]?.id);
}
function isPersona(value: unknown): value is KibblePdpLivePreview['persona'] { return value === 'gatherer' || value === 'hunter' || value === 'researcher' || value === 'gifter'; }
function samePolicy(value: unknown) { return isRecord(value) && Object.keys(value).length === 3 && value.policyVersion === KIBBLE_PDP_PRESENTATION_POLICY.policyVersion && sameStringArray(value.zoneIds, KIBBLE_PDP_PRESENTATION_POLICY.zoneIds) && sameStringArray(value.capabilities, KIBBLE_PDP_PRESENTATION_POLICY.capabilities); }
function sameStringArray(value: unknown, expected: readonly string[]) { return Array.isArray(value) && value.length === expected.length && value.every((entry, index) => entry === expected[index]); }
function hasChanges(evidence: ReturnType<typeof buildKibbleDecisionEvidence>) { return !sameIds(evidence.before, evidence.after) || [...evidence.copy, ...evidence.components, ...evidence.sections, ...evidence.marketingBlocks].some(({ changed }) => changed); }
