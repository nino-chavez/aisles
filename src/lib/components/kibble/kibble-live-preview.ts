import type { KibbleProduct, KibbleRenderedModelZoneAdapterBinding, KibbleZoneAdapterBinding } from './types';
import { KIBBLE_DEMO_MAX_PUBLIC_CLIENT_TIMEOUT_MS, kibbleModelCallCountFromPayload, readKibbleModelFailureCallCount } from '$lib/kibble-demo-ai-boundary';
import {
	type KibbleDevInspectorData,
	buildKibbleDecisionEvidence,
	type KibbleDecisionEvidence,
	type KibbleInspectorPersona,
	type KibbleInspectorProductSummary,
	type KibbleInspectorZone,
	type KibbleLivePreviewStatus,
} from './kibble-dev-inspector';
import {
	KIBBLE_HOME_DEFAULT_PRESENTATION,
	KIBBLE_HOME_PRESENTATION_POLICY,
	materializeKibbleHomePresentation,
	parseKibbleHomePresentationDecision,
	snapshotKibbleHomePresentation,
	type KibbleHomePresentationContext,
	type KibbleHomePresentationDecision,
	type KibblePresentationSnapshot,
} from '$lib/brand/reference/kibble-presentation-decisions';

const PERSONAS = new Set<KibbleInspectorPersona>(['gatherer', 'hunter', 'researcher', 'gifter']);
const RESPONSE_KEYS = new Set(['version', 'previewOnly', 'reference', 'policyVersion', 'persona', 'products', 'featuredZoneAdapters', 'presentationPolicy', 'zoneArtifacts', 'inspector', 'provider', 'modelId', 'modelCallCount']);
const PRODUCT_KEYS = new Set(['id', 'entityId', 'name', 'price', 'salePrice', 'image', 'imageAlt', 'description', 'specs', 'tags', 'category']);
const INSPECTOR_KEYS = new Set(['reference', 'surface', 'preset', 'policyVersion', 'publicationMode', 'inference', 'dataSourceLabel', 'zones', 'provenance', 'availableModelDecision']);
const ZONE_KEYS = new Set(['id', 'label', 'authority', 'componentVariant', 'capabilities', 'decisionSummary', 'changed', 'inputProducts', 'outputProducts', 'modelCallStatus', 'decision']);
const INFERENCE_KEYS = new Set(['primary', 'probabilities', 'confidence', 'entropy', 'certainty', 'dominantSource', 'signalCount', 'lastUpdated', 'modifiers', 'shift', 'ruleMatches']);
const MODIFIER_KEYS = new Set(['priceSensitivity', 'urgency', 'familiarityWithStore']);
const SHIFT_KEYS = new Set(['detected', 'from', 'trigger']);
const RULE_KEYS = new Set(['ruleName', 'reason', 'weight', 'adjustment']);
const ADJUSTMENT_KEYS = new Set([...PERSONAS, ...MODIFIER_KEYS]);
const PRODUCT_SUMMARY_KEYS = new Set(['id', 'name', 'variant']);
const MODEL_STATUS_KEYS = new Set(['calls', 'authorized']);
const AVAILABLE_MODEL_DECISION_KEYS = new Set(['policyVersion', 'zoneIds', 'capabilities', 'publicationMode']);
const ADAPTER_KEYS = new Set(['instanceId', 'sharedStatus', 'sharedContentKind', 'decisionMode', 'modelCallCount', 'adapterId', 'componentVariantId', 'inputSha256', 'content']);
const MODEL_ADAPTER_KEYS = new Set([...ADAPTER_KEYS, 'selection']);
const MODEL_SELECTION_KEYS = new Set(['componentVariantId', 'copyVariantId', 'placementId', 'visible']);
const PRESENTATION_ADAPTER_KEYS = new Set(['hero', 'featured', 'editorial']);
const ADAPTER_CONTENT_KEYS = new Set(['component', 'props']);
const PRODUCT_GRID_PROP_KEYS = new Set(['columns', 'products', 'imageRatio', 'showDescription', 'showSpecs', 'showQuickAdd']);
const PRODUCT_REF_KEYS = new Set(['productId', 'role']);
const MODEL_DECISION_KEYS = new Set(['model', 'outputField', 'productCount']);
const PROVENANCE_KEYS = new Set(['version', 'organizationId', 'brandId', 'reference', 'policyVersion', 'surface', 'route', 'persona', 'viewportClass', 'renderer', 'decisionSource', 'inputHash', 'catalogVersion', 'shopperContextHash', 'picksHash', 'incentiveHash', 'autonomy', 'promptVersion', 'schemaVersion', 'synthetic']);
const PROVENANCE_REFERENCE_KEYS = new Set(['status', 'id', 'version']);
const RENDERER_KEYS = new Set(['componentId', 'variantId']);
const AUTONOMY_KEYS = new Set(['preset', 'effectiveCapabilities', 'decisionMode', 'publicationMode']);
const SYNTHETIC_KEYS = new Set(['value', 'scenarioId']);
const HOME_CAPABILITIES = ['rank_products', 'select_products'] as const;
type ExpectedHomeZone = {
	id: string;
	label: string;
	authority: 'fixed' | 'rules' | 'model';
	componentVariantIds: readonly string[];
	capabilities: readonly string[];
	hasProductOrder?: boolean;
};
const HOME_RULES_ZONES: readonly ExpectedHomeZone[] = [
	{ id: 'merchant-chrome', label: 'Root header', authority: 'fixed', componentVariantIds: ['kibble.header.responsive-chrome'], capabilities: [] },
	{ id: 'opening-merchandising', label: 'Opening hero', authority: 'fixed', componentVariantIds: ['kibble.hero.flagship-bundle'], capabilities: [] },
	{ id: 'ranked-products', label: 'Ranked products', authority: 'rules', componentVariantIds: ['kibble.featured-grid.four-column'], capabilities: HOME_CAPABILITIES, hasProductOrder: true },
	{ id: 'catalog-entry', label: 'Catalog entry', authority: 'fixed', componentVariantIds: ['kibble.visual-module.category'], capabilities: [] },
	{ id: 'service-proof', label: 'Service proof', authority: 'fixed', componentVariantIds: ['kibble.service-proof.three-column'], capabilities: [] },
	{ id: 'merchant-footer', label: 'Root footer', authority: 'fixed', componentVariantIds: ['kibble.footer.four-column'], capabilities: [] },
];
const HOME_MODEL_ZONES: readonly ExpectedHomeZone[] = [
	HOME_RULES_ZONES[0],
	{ id: 'home.hero', label: 'Opening hero', authority: 'model', componentVariantIds: ['kibble.hero.zone-editorial-header'], capabilities: ['select_copy_variant'] },
	{ id: 'home.featured-row.1', label: 'Featured product shelf', authority: 'model', componentVariantIds: ['kibble.featured-grid.ranked-segment'], capabilities: ['rank_products', 'select_copy_variant', 'reorder_zones'], hasProductOrder: true },
	{ id: 'home.editorial-strip', label: 'Catalog entry', authority: 'model', componentVariantIds: ['kibble.visual-module.category', 'kibble.visual-module.routine'], capabilities: ['select_copy_variant', 'select_component_variant'] },
	HOME_RULES_ZONES[4],
	HOME_RULES_ZONES[5],
];
const HEX_16 = /^[0-9a-f]{16}$/;
const HEX_64 = /^[0-9a-f]{64}$/;
const CATALOG_HASH = /^catalog:[0-9a-f]{16}$/;
export const KIBBLE_LIVE_PREVIEW_TIMEOUT_MS = 10_000;
export const KIBBLE_MODEL_PREVIEW_TIMEOUT_MS = KIBBLE_DEMO_MAX_PUBLIC_CLIENT_TIMEOUT_MS;

type ProductGridContent = {
	component: 'product-grid';
	props: {
		columns: 4;
		products: Array<{ productId: string; role: 'standard' }>;
		imageRatio: 'square';
		showDescription: false;
		showSpecs: false;
		showQuickAdd: false;
	};
};

type EditorialContent = { component: 'editorial-header'; props: { eyebrow: string; headline: string; body: string } };

export type KibbleLivePreviewExpectation = {
	reference: { id: string; version: string };
	policyVersion: string;
	dataSourceLabel: string;
	synthetic: { value: boolean; scenarioId: string | null };
	modelDecision: NonNullable<KibbleDevInspectorData['availableModelDecision']> | null;
	presentationContext: KibbleHomePresentationContext;
};

export type KibbleLivePreview = {
	persona: KibbleInspectorPersona;
	products: KibbleProduct[];
	featuredZoneAdapters?: KibbleZoneAdapterBinding<ProductGridContent>[];
	inspector: KibbleDevInspectorData;
	provider?: 'anthropic';
	modelId?: string;
	modelCallCount?: number;
	presentationDecision?: KibbleHomePresentationDecision;
	zoneArtifacts?: {
		hero: KibbleRenderedModelZoneAdapterBinding<EditorialContent>;
		featured: KibbleRenderedModelZoneAdapterBinding<ProductGridContent>;
		editorial: KibbleRenderedModelZoneAdapterBinding<EditorialContent>;
	};
};

export type KibbleLivePreviewValidation =
	| { ok: true; preview: KibbleLivePreview }
	| { ok: false; reason: string };

export type KibbleLivePreviewListenerOptions = {
	expectation: KibbleLivePreviewExpectation;
	getCurrentProductIds: () => readonly string[];
	getCurrentProductSummaries?: () => readonly KibbleInspectorProductSummary[];
	getCurrentPresentation?: () => KibblePresentationSnapshot;
	snapshotPresentationDecision?: (decision: KibbleHomePresentationDecision) => KibblePresentationSnapshot;
	onApplied: (preview: KibbleLivePreview) => void;
	onStatus: (status: KibbleLivePreviewStatus) => void;
};

/**
 * Install the opt-in demo signal-to-preview bridge. The caller lazy-loads this
 * module only when the public Kibble inspector is open.
 */
export function listenForKibbleLivePreview({
	expectation,
	getCurrentProductIds,
	getCurrentProductSummaries,
	getCurrentPresentation,
	snapshotPresentationDecision,
	onApplied,
	onStatus,
}: KibbleLivePreviewListenerOptions): () => void {
	let active = true;
	let generation = 0;
	let controller: AbortController | null = null;

	const requestPreview = async (mode: 'rules' | 'model') => {
		const requestGeneration = ++generation;
		controller?.abort();
		const requestController = new AbortController();
		controller = requestController;
		let timedOut = false;
		const timeout = setTimeout(() => {
			timedOut = true;
			requestController.abort();
		}, mode === 'model' ? KIBBLE_MODEL_PREVIEW_TIMEOUT_MS : KIBBLE_LIVE_PREVIEW_TIMEOUT_MS);
		onStatus({ state: 'updating', mode });
		const before = getCurrentProductSummaries?.() ?? getCurrentProductIds().map((id) => ({ id, name: id }));
		const presentationBefore = getCurrentPresentation?.();
		let failedModelCallCount: number | null = null;

		try {
			const response = await fetch('/api/kibble/home-decision?observe=true', {
				method: 'POST',
				...(mode === 'model' ? {
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ mode: 'model' }),
				} : {}),
				signal: requestController.signal,
			});
			if (!response.ok) {
				failedModelCallCount = await readKibbleModelFailureCallCount(response);
				throw new Error(`Preview request failed (${response.status})`);
			}
			const payload: unknown = await response.json();
			failedModelCallCount = kibbleModelCallCountFromPayload(payload);
			const validation = validateKibbleLivePreview(payload, expectation);
			if (!validation.ok) throw new Error(validation.reason);
			if (!active || requestController.signal.aborted || requestGeneration !== generation) return;
			const currentProductIds = getCurrentProductIds();
			const nextProductIds = validation.preview.products.map(({ id }) => id);
			const presentationAfter = validation.preview.presentationDecision
				? snapshotPresentationDecision?.(validation.preview.presentationDecision)
					?? snapshotKibbleHomePresentation(materializeKibbleHomePresentation(validation.preview.presentationDecision))
				: presentationBefore;
			const evidence = mode === 'model' ? buildKibbleDecisionEvidence({
				surface: 'home', zoneIds: KIBBLE_HOME_PRESENTATION_POLICY.zoneIds, zoneLabel: 'Home presentation',
				policyVersion: KIBBLE_HOME_PRESENTATION_POLICY.policyVersion,
				before, after: validation.preview.products, provider: validation.preview.provider ?? null,
				model: validation.preview.modelId ?? null,
				calls: validation.preview.modelCallCount ?? null, state: 'applied',
				presentationBefore, presentationAfter,
			}) : undefined;
			const changed = evidence ? hasDecisionChanged(evidence) : !sameStringArray(currentProductIds, nextProductIds);
			onApplied(validation.preview);
			onStatus({
				state: 'applied', mode, persona: validation.preview.persona, changed,
				...(evidence ? { evidence } : {}),
			});
		} catch (error) {
			if (!active || requestGeneration !== generation) return;
			if (requestController.signal.aborted && !timedOut) return;
			console.warn('Kibble live preview was rejected; retaining the approved shelf.', error);
			onStatus({
			state: 'failed', mode,
			...(mode === 'model' ? {
				evidence: buildKibbleDecisionEvidence({
					surface: 'home', zoneIds: KIBBLE_HOME_PRESENTATION_POLICY.zoneIds, zoneLabel: 'Home presentation',
					policyVersion: KIBBLE_HOME_PRESENTATION_POLICY.policyVersion,
					before, after: before, provider: null, model: null, calls: failedModelCallCount, state: 'failed',
					presentationBefore, presentationAfter: presentationBefore,
				}),
			} : {}),
		});
		} finally {
			clearTimeout(timeout);
			if (controller === requestController) controller = null;
		}
	};

	const onInferenceUpdate = () => void requestPreview('rules');
	const onModelRequest = () => void requestPreview('model');
	window.addEventListener('aisles-inference-update', onInferenceUpdate);
	window.addEventListener('aisles-kibble-model-request', onModelRequest);
	return () => {
		active = false;
		generation += 1;
		controller?.abort();
		controller = null;
		window.removeEventListener('aisles-inference-update', onInferenceUpdate);
		window.removeEventListener('aisles-kibble-model-request', onModelRequest);
	};
}

export function expectationFromTrustedInspector(
	inspector: KibbleDevInspectorData,
	presentationContext: KibbleHomePresentationContext,
): KibbleLivePreviewExpectation | null {
	const synthetic = inspector.provenance?.synthetic;
	const modelDecision = inspector.availableModelDecision;
	if (!isRecord(synthetic) || !hasOnlyKeys(synthetic, SYNTHETIC_KEYS)
		|| typeof synthetic.value !== 'boolean'
		|| (synthetic.value
			? typeof synthetic.scenarioId !== 'string' || synthetic.scenarioId.length === 0
			: synthetic.scenarioId !== null)
		|| (modelDecision !== undefined && !isAvailableModelDecision(modelDecision))) return null;
	return {
		reference: { ...inspector.reference },
		policyVersion: inspector.policyVersion,
		dataSourceLabel: inspector.dataSourceLabel,
		synthetic: { value: synthetic.value, scenarioId: synthetic.scenarioId as string | null },
		presentationContext: structuredClone(presentationContext),
		modelDecision: modelDecision ? {
			policyVersion: modelDecision.policyVersion,
			zoneIds: [...modelDecision.zoneIds],
			capabilities: ['rank_products', 'select_copy_variant', 'select_component_variant', 'reorder_zones'],
			publicationMode: modelDecision.publicationMode,
		} : null,
	};
}

export function validateKibbleLivePreview(
	value: unknown,
	expected: KibbleLivePreviewExpectation,
): KibbleLivePreviewValidation {
	if (!isRecord(value) || !hasOnlyKeys(value, RESPONSE_KEYS)) return invalid('response shape');
	if (containsPersonaFit(value)) return invalid('personaFit is not public preview data');
	if (value.version !== 'kibble-live-home-preview-v3' || value.previewOnly !== true) return invalid('preview contract');
	if (!matchesReference(value.reference, expected.reference)) return invalid('reference');
	const mode = value.policyVersion === expected.policyVersion
		? 'rules'
		: expected.modelDecision && value.policyVersion === expected.modelDecision.policyVersion ? 'model' : null;
	if (!mode) return invalid('policy version');
	if (mode === 'model' && (!isProvider(value.provider) || typeof value.modelId !== 'string' || value.modelId.length < 1 || !isModelCallCount(value.modelCallCount))) return invalid('model provider evidence');
	if (mode === 'rules' && ('provider' in value || 'modelId' in value || 'modelCallCount' in value)) return invalid('unexpected model provider evidence');
	if (mode === 'model' && !samePresentationPolicy(value.presentationPolicy, KIBBLE_HOME_PRESENTATION_POLICY)) return invalid('presentation contract');
	if (mode === 'rules' && ('presentationPolicy' in value || 'zoneArtifacts' in value)) return invalid('unexpected presentation artifacts');
	if (!isPersona(value.persona)) return invalid('persona');
	if (!Array.isArray(value.products) || value.products.length < 1 || value.products.length > 8) return invalid('products');
	if (!value.products.every(isKibbleProduct) || new Set(value.products.map((product) => product.id)).size !== value.products.length) return invalid('products');
	if (!isInspector(value.inspector, expected, value.persona, value.products, mode, mode === 'model' ? value.modelCallCount as number : 0)) return invalid('inspector');
	if (mode === 'rules' && !isFeaturedZoneAdapters(value.featuredZoneAdapters, value.products, value.inspector, mode)) return invalid('shelf adapters');
	if (mode === 'model' && 'featuredZoneAdapters' in value) return invalid('duplicate model shelf adapters');
	const modelArtifacts = mode === 'model'
		? parseHomeZoneArtifacts(value.zoneArtifacts, value.products, value.inspector, value.modelCallCount as number, expected.presentationContext)
		: null;
	if (mode === 'model' && !modelArtifacts) return invalid('named zone artifacts');

	return {
		ok: true,
		preview: {
			persona: value.persona,
			products: value.products,
			...(mode === 'rules' ? { featuredZoneAdapters: value.featuredZoneAdapters as KibbleZoneAdapterBinding<ProductGridContent>[] } : {}),
			inspector: value.inspector,
			...(mode === 'model' ? { provider: 'anthropic' as const, modelId: value.modelId as string, modelCallCount: value.modelCallCount as number } : {}),
			...(modelArtifacts ? { presentationDecision: modelArtifacts.decision, zoneArtifacts: modelArtifacts.artifacts } : {}),
		},
	};
}

/** A rejected response must leave the last approved shelf and trace untouched. */
export function applyKibbleLivePreview<T extends { products: KibbleProduct[]; inspector: KibbleDevInspectorData }>(
	current: T,
	response: unknown,
	expected: KibbleLivePreviewExpectation,
): T | (T & KibbleLivePreview) {
	const validation = validateKibbleLivePreview(response, expected);
	return validation.ok ? { ...current, ...validation.preview } : current;
}

function invalid(reason: string): KibbleLivePreviewValidation {
	return { ok: false, reason };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: Set<string>) {
	return Object.keys(value).every((key) => allowed.has(key));
}

function matchesReference(value: unknown, expected: KibbleLivePreviewExpectation['reference']) {
	return isRecord(value) && Object.keys(value).length === 2 && value.id === expected.id && value.version === expected.version;
}

function isPersona(value: unknown): value is KibbleInspectorPersona {
	return typeof value === 'string' && PERSONAS.has(value as KibbleInspectorPersona);
}

function isProvider(value: unknown): value is 'anthropic' {
	return value === 'anthropic';
}

function isKibbleProduct(value: unknown): value is KibbleProduct {
	if (!isRecord(value) || !hasOnlyKeys(value, PRODUCT_KEYS)) return false;
	const requiredStrings = ['id', 'name', 'image', 'imageAlt', 'description', 'category'];
	if (!requiredStrings.every((key) => typeof value[key] === 'string')) return false;
	if (typeof value.entityId !== 'number' || typeof value.price !== 'number') return false;
	if ('salePrice' in value && typeof value.salePrice !== 'number') return false;
	if (!Array.isArray(value.tags) || !value.tags.every((tag) => typeof tag === 'string')) return false;
	return isRecord(value.specs) && Object.values(value.specs).every((spec) => typeof spec === 'string');
}

function isInspector(
	value: unknown,
	expected: KibbleLivePreviewExpectation,
	persona: KibbleInspectorPersona,
	products: KibbleProduct[],
	mode: 'rules' | 'model',
	modelCallCount: number,
): value is KibbleDevInspectorData {
	if (mode === 'model' && !expected.modelDecision) return false;
	const policyVersion = mode === 'model' ? expected.modelDecision!.policyVersion : expected.policyVersion;
	if (!isRecord(value) || !hasOnlyKeys(value, INSPECTOR_KEYS)) return false;
	const inference = value.inference;
	if (!isInference(inference)) return false;
	const expectedZones = mode === 'model' ? HOME_MODEL_ZONES : HOME_RULES_ZONES;
	if (!matchesReference(value.reference, expected.reference)
		|| value.policyVersion !== policyVersion
		|| value.surface !== 'home'
		|| value.preset !== (mode === 'model' ? 'compose' : 'preserve')
		|| value.publicationMode !== 'live'
		|| value.dataSourceLabel !== (mode === 'model' ? 'bounded-model-presentation' : expected.dataSourceLabel)
		|| !sameAvailableModelDecision(value.availableModelDecision, expected.modelDecision)
		|| !Array.isArray(value.zones) || value.zones.length !== expectedZones.length
		|| !value.zones.every((zone, index) => isZone(zone, expectedZones[index], products, modelCallCount))) return false;
	if (inference.primary !== persona) return false;
	return isContractedHomeProvenance(value.provenance, expected, persona, mode);
}

function isZone(
	value: unknown,
	expected: ExpectedHomeZone,
	products: KibbleProduct[],
	modelCallCount: number,
): value is KibbleInspectorZone {
	if (!isRecord(value) || !hasOnlyKeys(value, ZONE_KEYS)) return false;
	if (value.id !== expected.id || value.label !== expected.label || typeof value.componentVariant !== 'string'
		|| !expected.componentVariantIds.includes(value.componentVariant)
		|| typeof value.decisionSummary !== 'string' || typeof value.changed !== 'boolean') return false;
	const isModel = expected.authority === 'model';
	if (value.authority !== expected.authority || !sameStringArray(value.capabilities, expected.capabilities)) return false;
	if (!isRecord(value.modelCallStatus) || !hasOnlyKeys(value.modelCallStatus, MODEL_STATUS_KEYS)) return false;
	if (isModel) {
		if (value.modelCallStatus.calls !== modelCallCount || value.modelCallStatus.authorized !== true) return false;
		if (expected.id === 'home.featured-row.1') {
			if (!isRecord(value.decision) || !hasOnlyKeys(value.decision, MODEL_DECISION_KEYS)
				|| typeof value.decision.model !== 'string' || value.decision.model.length < 1
				|| value.decision.outputField !== 'rankedProductIds'
				|| value.decision.productCount !== products.length) return false;
		} else if ('decision' in value) return false;
	} else {
		if (value.modelCallStatus.calls !== 0 || value.modelCallStatus.authorized !== false || 'decision' in value) return false;
	}

	if (!expected.hasProductOrder) {
		return !('inputProducts' in value) && !('outputProducts' in value)
			&& (isModel || value.changed === false);
	}
	if (!isProductSummaryList(value.inputProducts) || !isProductSummaryList(value.outputProducts)) return false;
	const input = value.inputProducts as Array<{ id: string; name: string; variant?: string }>;
	const output = value.outputProducts as Array<{ id: string; name: string; variant?: string }>;
	if (new Set(input.map(({ id }) => id)).size !== input.length || input.some(({ variant }) => variant !== undefined)) return false;
	if (output.length !== products.length || output.some(({ variant }) => variant !== undefined)) return false;
	if (!output.every((summary, index) => summary.id === products[index].id && summary.name === products[index].name)) return false;
	const orderChanged = input.length !== output.length || input.some((summary, index) => summary.id !== output[index]?.id);
	return isModel || value.changed === orderChanged;
}

function isContractedHomeProvenance(
	value: unknown,
	expected: KibbleLivePreviewExpectation,
	persona: KibbleInspectorPersona,
	mode: 'rules' | 'model',
) {
	if (mode === 'model' && !expected.modelDecision) return false;
	const policyVersion = mode === 'model' ? expected.modelDecision!.policyVersion : expected.policyVersion;
	const capabilities = mode === 'model' ? expected.modelDecision!.capabilities : HOME_CAPABILITIES;
	if (!isRecord(value) || !hasOnlyKeys(value, PROVENANCE_KEYS)) return false;
	if (value.version !== 'layout-provenance-v1' || value.organizationId !== 'kibble-demo-merchant'
		|| value.brandId !== 'kibble' || value.policyVersion !== policyVersion
		|| value.surface !== 'home' || value.route !== '/' || value.persona !== persona
		|| value.viewportClass !== 'responsive' || value.decisionSource !== mode
		|| value.promptVersion !== (mode === 'model' ? 'kibble-home-bounded-presentation-v2' : 'no-model-preserve-v1')
		|| value.schemaVersion !== (mode === 'model' ? 'kibble-home-presentation-decision-v2' : `kibble-reference-${expected.reference.version}`)
		|| typeof value.inputHash !== 'string' || !HEX_16.test(value.inputHash)
		|| typeof value.catalogVersion !== 'string' || !CATALOG_HASH.test(value.catalogVersion)
		|| typeof value.shopperContextHash !== 'string' || !HEX_16.test(value.shopperContextHash)
		|| value.picksHash !== null || value.incentiveHash !== null) return false;
	if (!isRecord(value.reference) || !hasOnlyKeys(value.reference, PROVENANCE_REFERENCE_KEYS)
		|| value.reference.status !== 'contracted' || value.reference.id !== expected.reference.id
		|| value.reference.version !== expected.reference.version) return false;
	if (!isRecord(value.renderer) || !hasOnlyKeys(value.renderer, RENDERER_KEYS)
		|| value.renderer.componentId !== 'kibble.home' || value.renderer.variantId !== 'kibble-home-reference-v1') return false;
	if (!isRecord(value.autonomy) || !hasOnlyKeys(value.autonomy, AUTONOMY_KEYS)
		|| value.autonomy.preset !== (mode === 'model' ? 'compose' : 'preserve')
		|| !sameStringArray(value.autonomy.effectiveCapabilities, capabilities)
		|| value.autonomy.decisionMode !== mode || value.autonomy.publicationMode !== 'live') return false;
	return isRecord(value.synthetic) && hasOnlyKeys(value.synthetic, SYNTHETIC_KEYS)
		&& value.synthetic.value === expected.synthetic.value
		&& value.synthetic.scenarioId === expected.synthetic.scenarioId;
}

function isAvailableModelDecision(
	value: unknown,
): value is NonNullable<KibbleDevInspectorData['availableModelDecision']> {
	return isRecord(value)
		&& hasOnlyKeys(value, AVAILABLE_MODEL_DECISION_KEYS)
		&& typeof value.policyVersion === 'string'
		&& value.policyVersion.length > 0
		&& sameStringArray(value.zoneIds, ['home.hero', 'home.featured-row.1', 'home.editorial-strip'])
		&& sameStringArray(value.capabilities, ['rank_products', 'select_copy_variant', 'select_component_variant', 'reorder_zones'])
		&& value.publicationMode === 'live';
}

function sameAvailableModelDecision(
	value: unknown,
	expected: NonNullable<KibbleDevInspectorData['availableModelDecision']> | null,
): boolean {
	if (expected === null) return value === undefined;
	return isAvailableModelDecision(value)
		&& value.policyVersion === expected.policyVersion
		&& sameStringArray(value.zoneIds, expected.zoneIds)
		&& value.publicationMode === expected.publicationMode
		&& sameStringArray(value.capabilities, expected.capabilities);
}

function isFeaturedZoneAdapters(
	value: unknown,
	products: KibbleProduct[],
	inspectorValue: unknown,
	mode: 'rules' | 'model',
): value is KibbleZoneAdapterBinding<ProductGridContent>[] {
	const expectedInstances = mode === 'model'
		? ['home.featured-row.1']
		: ['home.featured-row.1', 'home.featured-row.2', 'home.featured-row.3'];
	if (!Array.isArray(value) || value.length !== expectedInstances.length) return false;
	const renderedProductIds: string[] = [];
	for (const [index, adapter] of value.entries()) {
		const instanceId = expectedInstances[index];
		const expectedAdapterId = index === 0
			? 'kibble.zone.home.featured-row.primary'
			: `kibble.zone.home.featured-row.continuation-${index}`;
		if (!isRecord(adapter) || !hasOnlyKeys(adapter, mode === 'model' ? MODEL_ADAPTER_KEYS : ADAPTER_KEYS)
			|| adapter.instanceId !== instanceId
			|| adapter.sharedStatus !== 'live'
			|| adapter.sharedContentKind !== 'content'
			|| adapter.decisionMode !== mode
			|| !Number.isInteger(adapter.modelCallCount)
			|| (mode === 'model'
				? (adapter.modelCallCount as number) < 1 || (adapter.modelCallCount as number) > 2
				: adapter.modelCallCount !== 0)
			|| adapter.adapterId !== expectedAdapterId
			|| adapter.componentVariantId !== 'kibble.featured-grid.ranked-segment'
			|| typeof adapter.inputSha256 !== 'string' || !HEX_64.test(adapter.inputSha256)
			|| !isRecord(adapter.content) || !hasOnlyKeys(adapter.content, ADAPTER_CONTENT_KEYS)
			|| adapter.content.component !== 'product-grid'
			|| !isRecord(adapter.content.props) || !hasOnlyKeys(adapter.content.props, PRODUCT_GRID_PROP_KEYS)) return false;
		const props = adapter.content.props;
		if (props.columns !== 4 || props.imageRatio !== 'square' || props.showDescription !== false
			|| props.showSpecs !== false || props.showQuickAdd !== false || !Array.isArray(props.products)
			|| props.products.length < 1) return false;
		if (mode === 'model' && (!isRecord(adapter.selection) || !hasOnlyKeys(adapter.selection, MODEL_SELECTION_KEYS)
			|| adapter.selection.componentVariantId !== 'kibble.featured-grid.ranked-segment')) return false;
		for (const entry of props.products) {
			if (!isRecord(entry) || !hasOnlyKeys(entry, PRODUCT_REF_KEYS)
				|| typeof entry.productId !== 'string' || entry.role !== 'standard') return false;
			renderedProductIds.push(entry.productId);
		}
	}
	if (!sameStringArray(renderedProductIds, products.map(({ entityId }) => String(entityId)))) return false;
	if (!isRecord(inspectorValue) || !Array.isArray(inspectorValue.zones)) return false;
	const rankedZoneId = mode === 'model' ? 'home.featured-row.1' : 'ranked-products';
	const rankedZone = inspectorValue.zones.find((zone) => isRecord(zone) && zone.id === rankedZoneId);
	return isRecord(rankedZone) && isRecord(rankedZone.modelCallStatus)
		&& rankedZone.modelCallStatus.calls === (mode === 'model' ? value[0].modelCallCount : 0);
}

function parseHomeZoneArtifacts(
	value: unknown,
	products: KibbleProduct[],
	inspector: unknown,
	modelCallCount: number,
	presentationContext: KibbleHomePresentationContext,
): { artifacts: NonNullable<KibbleLivePreview['zoneArtifacts']>; decision: KibbleHomePresentationDecision } | null {
	if (!isRecord(value) || !hasOnlyKeys(value, PRESENTATION_ADAPTER_KEYS)
		|| !isRecord(value.hero) || !isRecord(value.featured) || !isRecord(value.editorial)
		|| !isRecord(value.hero.selection) || !isRecord(value.featured.selection) || !isRecord(value.editorial.selection)) return null;
	const catalogComponentVariantId = value.editorial.selection.componentVariantId === 'kibble.visual-module.category'
		? 'four-column'
		: value.editorial.selection.componentVariantId === 'kibble.visual-module.routine'
			? 'two-column'
			: null;
	const decision = parseKibbleHomePresentationDecision({
		heroCopyVariantId: value.hero.selection.copyVariantId,
		featuredCopyVariantId: value.featured.selection.copyVariantId,
		catalogCopyVariantId: value.editorial.selection.copyVariantId,
		catalogComponentVariantId,
		sectionOrderId: value.featured.selection.placementId,
	});
	if (!decision || !isFeaturedZoneAdapters([value.featured], products, inspector, 'model')
		|| value.hero.modelCallCount !== modelCallCount || value.featured.modelCallCount !== modelCallCount
		|| value.editorial.modelCallCount !== modelCallCount) return null;
	const selected = materializeKibbleHomePresentation(decision, presentationContext);
	const expectedCatalogComponent = decision.catalogComponentVariantId === 'four-column'
		? 'kibble.visual-module.category'
		: 'kibble.visual-module.routine';
	if (!isEditorialModelAdapter(value.hero, {
		instanceId: 'home.hero', adapterId: 'kibble.zone.home.hero', componentVariantId: 'kibble.hero.zone-editorial-header',
		copyVariantId: decision.heroCopyVariantId, content: selected.hero,
	})) return null;
	if (!isProductGridModelAdapter(value.featured, {
		instanceId: 'home.featured-row.1', adapterId: 'kibble.zone.home.featured-row.primary',
		componentVariantId: 'kibble.featured-grid.ranked-segment', copyVariantId: decision.featuredCopyVariantId,
		placementId: decision.sectionOrderId,
	})) return null;
	if (!isEditorialModelAdapter(value.editorial, {
		instanceId: 'home.editorial-strip', adapterId: 'kibble.zone.home.editorial-strip', componentVariantId: expectedCatalogComponent,
		copyVariantId: decision.catalogCopyVariantId,
		content: { eyebrow: selected.catalogCopy.eyebrow, headline: selected.catalogCopy.title, body: 'Browse the current storefront catalog by category.' },
	})) return null;
	if (!matchesHomeModelInspectorEvidence(inspector, decision)) return null;
	return { artifacts: value as NonNullable<KibbleLivePreview['zoneArtifacts']>, decision };
}

function matchesHomeModelInspectorEvidence(inspector: unknown, decision: KibbleHomePresentationDecision): boolean {
	if (!isRecord(inspector) || !Array.isArray(inspector.zones)) return false;
	const byId = new Map(inspector.zones.filter(isRecord).map((zone) => [zone.id, zone]));
	const hero = byId.get('home.hero');
	const featured = byId.get('home.featured-row.1');
	const editorial = byId.get('home.editorial-strip');
	if (!hero || !featured || !editorial || !Array.isArray(featured.inputProducts) || !Array.isArray(featured.outputProducts)) return false;
	const inputProducts = featured.inputProducts;
	const outputProducts = featured.outputProducts;
	const orderChanged = inputProducts.length !== outputProducts.length
		|| inputProducts.some((product, index) => !isRecord(product) || !isRecord(outputProducts[index])
			|| product.id !== (outputProducts[index] as Record<string, unknown>).id);
	return hero.changed === (decision.heroCopyVariantId !== KIBBLE_HOME_DEFAULT_PRESENTATION.heroCopyVariantId)
		&& featured.changed === (orderChanged
			|| decision.featuredCopyVariantId !== KIBBLE_HOME_DEFAULT_PRESENTATION.featuredCopyVariantId
			|| decision.sectionOrderId !== KIBBLE_HOME_DEFAULT_PRESENTATION.sectionOrderId)
		&& editorial.changed === (decision.catalogCopyVariantId !== KIBBLE_HOME_DEFAULT_PRESENTATION.catalogCopyVariantId
			|| decision.catalogComponentVariantId !== KIBBLE_HOME_DEFAULT_PRESENTATION.catalogComponentVariantId);
}

function isEditorialModelAdapter(value: unknown, expected: {
	instanceId: string; adapterId: string; componentVariantId: string; copyVariantId: string;
	content: { eyebrow: string; headline: string; body: string };
}): boolean {
	if (!isModelContentAdapter(value, expected) || !isRecord(value.content) || !hasOnlyKeys(value.content, ADAPTER_CONTENT_KEYS)
		|| value.content.component !== 'editorial-header' || !isRecord(value.content.props)) return false;
	return sameJson(value.content.props, expected.content)
		&& isModelSelection(value.selection, { componentVariantId: expected.componentVariantId, copyVariantId: expected.copyVariantId });
}

function isProductGridModelAdapter(value: unknown, expected: {
	instanceId: string; adapterId: string; componentVariantId: string; copyVariantId: string; placementId: string;
}): boolean {
	return isModelContentAdapter(value, expected)
		&& isModelSelection(value.selection, {
			componentVariantId: expected.componentVariantId,
			copyVariantId: expected.copyVariantId,
			placementId: expected.placementId,
		});
}

function isModelContentAdapter(value: unknown, expected: { instanceId: string; adapterId: string; componentVariantId: string }): value is Record<string, unknown> {
	return isRecord(value) && hasOnlyKeys(value, MODEL_ADAPTER_KEYS)
		&& value.instanceId === expected.instanceId && value.adapterId === expected.adapterId
		&& value.componentVariantId === expected.componentVariantId && value.sharedStatus === 'live'
		&& value.sharedContentKind === 'content' && value.decisionMode === 'model'
		&& isModelCallCount(value.modelCallCount) && typeof value.inputSha256 === 'string' && HEX_64.test(value.inputSha256);
}

function isModelSelection(value: unknown, expected: Record<string, unknown>): boolean {
	return isRecord(value) && hasOnlyKeys(value, MODEL_SELECTION_KEYS)
		&& Object.keys(value).length === Object.keys(expected).length
		&& Object.entries(expected).every(([key, expectedValue]) => value[key] === expectedValue);
}

function isModelCallCount(value: unknown): value is number {
	return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 2;
}

function sameJson(left: unknown, right: unknown): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}

function isInference(value: unknown): value is { primary: KibbleInspectorPersona } {
	if (!isRecord(value) || !hasOnlyKeys(value, INFERENCE_KEYS) || !isPersona(value.primary) || typeof value.dominantSource !== 'string'
		|| !isFiniteNumber(value.confidence) || !isFiniteNumber(value.signalCount)
		|| !isProbabilityRecord(value.probabilities) || !isModifiers(value.modifiers) || !isShift(value.shift)
		|| !Array.isArray(value.ruleMatches)) return false;
	if ('entropy' in value && !isFiniteNumber(value.entropy)) return false;
	if ('certainty' in value && !isFiniteNumber(value.certainty)) return false;
	if ('lastUpdated' in value && !isFiniteNumber(value.lastUpdated)) return false;
	return value.ruleMatches.every(isRuleMatch);
}

function isProbabilityRecord(value: unknown) {
	if (!isRecord(value) || Object.keys(value).length !== PERSONAS.size) return false;
	return [...PERSONAS].every((persona) => isFiniteNumber(value[persona]) && value[persona] >= 0 && value[persona] <= 1);
}

function isModifiers(value: unknown) {
	return isRecord(value) && hasOnlyKeys(value, MODIFIER_KEYS)
		&& [...MODIFIER_KEYS].every((key) => isFiniteNumber(value[key]));
}

function isShift(value: unknown) {
	return isRecord(value) && hasOnlyKeys(value, SHIFT_KEYS) && typeof value.detected === 'boolean'
		&& (value.from === null || isPersona(value.from)) && (value.trigger === null || typeof value.trigger === 'string');
}

function isRuleMatch(value: unknown) {
	return isRecord(value) && hasOnlyKeys(value, RULE_KEYS) && typeof value.ruleName === 'string' && typeof value.reason === 'string'
		&& isFiniteNumber(value.weight) && isRecord(value.adjustment) && hasOnlyKeys(value.adjustment, ADJUSTMENT_KEYS)
		&& Object.values(value.adjustment).every(isFiniteNumber);
}

function isProductSummaryList(value: unknown) {
	return Array.isArray(value) && value.every((product) => isRecord(product) && hasOnlyKeys(product, PRODUCT_SUMMARY_KEYS) && typeof product.id === 'string'
		&& typeof product.name === 'string' && (!('variant' in product) || typeof product.variant === 'string'));
}

function sameStringArray(value: unknown, expected: readonly string[]) {
	return Array.isArray(value) && value.length === expected.length
		&& value.every((entry, index) => entry === expected[index]);
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

function containsPersonaFit(value: unknown): boolean {
	if (Array.isArray(value)) return value.some(containsPersonaFit);
	if (!isRecord(value)) return false;
	return Object.entries(value).some(([key, entry]) => key === 'personaFit' || containsPersonaFit(entry));
}

function samePresentationPolicy(value: unknown, expected: typeof KIBBLE_HOME_PRESENTATION_POLICY): boolean {
	return isRecord(value)
		&& Object.keys(value).length === 3
		&& value.policyVersion === expected.policyVersion
		&& sameStringArray(value.zoneIds, expected.zoneIds)
		&& sameStringArray(value.capabilities, expected.capabilities);
}

function hasDecisionChanged(evidence: KibbleDecisionEvidence): boolean {
	return evidence.moved.length > 0 || evidence.added.length > 0 || evidence.removed.length > 0
		|| [...evidence.copy, ...evidence.components, ...evidence.sections, ...evidence.marketingBlocks].some(({ changed }) => changed);
}
