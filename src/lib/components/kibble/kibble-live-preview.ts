import type { KibbleProduct, KibbleZoneAdapterBinding } from './types';
import {
	type KibbleDevInspectorData,
	type KibbleInspectorPersona,
	type KibbleInspectorZone,
	type KibbleLivePreviewStatus,
} from './kibble-dev-inspector';

const PERSONAS = new Set<KibbleInspectorPersona>(['gatherer', 'hunter', 'researcher', 'gifter']);
const RESPONSE_KEYS = new Set(['version', 'previewOnly', 'reference', 'policyVersion', 'persona', 'products', 'featuredZoneAdapters', 'inspector']);
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
const AVAILABLE_MODEL_DECISION_KEYS = new Set(['policyVersion', 'zoneId', 'capabilities', 'publicationMode']);
const ADAPTER_KEYS = new Set(['instanceId', 'sharedStatus', 'sharedContentKind', 'decisionMode', 'modelCallCount', 'adapterId', 'componentVariantId', 'inputSha256', 'content']);
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
const HOME_ZONES = [
	{ id: 'merchant-chrome', label: 'Root header', authority: 'fixed', componentVariant: 'kibble.header.responsive-chrome', capabilities: [] },
	{ id: 'opening-merchandising', label: 'Opening hero', authority: 'fixed', componentVariant: 'kibble.hero.flagship-bundle', capabilities: [] },
	{ id: 'ranked-products', label: 'Ranked products', authority: 'rules', componentVariant: 'kibble.featured-grid.four-column', capabilities: HOME_CAPABILITIES },
	{ id: 'catalog-entry', label: 'Catalog entry', authority: 'fixed', componentVariant: 'kibble.visual-module.category', capabilities: [] },
	{ id: 'service-proof', label: 'Service proof', authority: 'fixed', componentVariant: 'kibble.service-proof.three-column', capabilities: [] },
	{ id: 'merchant-footer', label: 'Root footer', authority: 'fixed', componentVariant: 'kibble.footer.four-column', capabilities: [] },
] as const;
const HEX_16 = /^[0-9a-f]{16}$/;
const HEX_64 = /^[0-9a-f]{64}$/;
const CATALOG_HASH = /^catalog:[0-9a-f]{16}$/;
export const KIBBLE_LIVE_PREVIEW_TIMEOUT_MS = 10_000;
export const KIBBLE_MODEL_PREVIEW_TIMEOUT_MS = 30_000;

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

export type KibbleLivePreviewExpectation = {
	reference: { id: string; version: string };
	policyVersion: string;
	dataSourceLabel: string;
	synthetic: { value: boolean; scenarioId: string | null };
	modelDecision: NonNullable<KibbleDevInspectorData['availableModelDecision']> | null;
};

export type KibbleLivePreview = {
	persona: KibbleInspectorPersona;
	products: KibbleProduct[];
	featuredZoneAdapters?: KibbleZoneAdapterBinding<ProductGridContent>[];
	inspector: KibbleDevInspectorData;
};

export type KibbleLivePreviewValidation =
	| { ok: true; preview: KibbleLivePreview }
	| { ok: false; reason: string };

export type KibbleLivePreviewListenerOptions = {
	expectation: KibbleLivePreviewExpectation;
	getCurrentProductIds: () => readonly string[];
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
		onStatus({ state: 'updating' });

		try {
			const response = await fetch('/api/kibble/home-decision?observe=true', {
				method: 'POST',
				...(mode === 'model' ? {
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ mode: 'model' }),
				} : {}),
				signal: requestController.signal,
			});
			if (!response.ok) throw new Error(`Preview request failed (${response.status})`);
			const validation = validateKibbleLivePreview(await response.json(), expectation);
			if (!validation.ok) throw new Error(validation.reason);
			if (!active || requestController.signal.aborted || requestGeneration !== generation) return;
			const currentProductIds = getCurrentProductIds();
			const nextProductIds = validation.preview.products.map(({ id }) => id);
			const changed = !sameStringArray(currentProductIds, nextProductIds);
			onApplied(validation.preview);
			onStatus({ state: 'applied', persona: validation.preview.persona, changed });
		} catch (error) {
			if (!active || requestGeneration !== generation) return;
			if (requestController.signal.aborted && !timedOut) return;
			console.warn('Kibble live preview was rejected; retaining the approved shelf.', error);
			onStatus({ state: 'failed' });
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

export function expectationFromTrustedInspector(inspector: KibbleDevInspectorData): KibbleLivePreviewExpectation | null {
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
		modelDecision: modelDecision ? {
			policyVersion: modelDecision.policyVersion,
			zoneId: modelDecision.zoneId,
			capabilities: ['rank_products'],
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
	if (value.version !== 'kibble-live-home-preview-v2' || value.previewOnly !== true) return invalid('preview contract');
	if (!matchesReference(value.reference, expected.reference)) return invalid('reference');
	const mode = value.policyVersion === expected.policyVersion
		? 'rules'
		: expected.modelDecision && value.policyVersion === expected.modelDecision.policyVersion ? 'model' : null;
	if (!mode) return invalid('policy version');
	if (!isPersona(value.persona)) return invalid('persona');
	if (!Array.isArray(value.products) || value.products.length < 1 || value.products.length > 8) return invalid('products');
	if (!value.products.every(isKibbleProduct) || new Set(value.products.map((product) => product.id)).size !== value.products.length) return invalid('products');
	if (!isInspector(value.inspector, expected, value.persona, value.products, mode)) return invalid('inspector');
	if (!isFeaturedZoneAdapters(value.featuredZoneAdapters, value.products, value.inspector, mode)) return invalid('shelf adapters');

	return {
		ok: true,
		preview: {
			persona: value.persona,
			products: value.products,
			featuredZoneAdapters: value.featuredZoneAdapters,
			inspector: value.inspector,
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
): value is KibbleDevInspectorData {
	if (mode === 'model' && !expected.modelDecision) return false;
	const policyVersion = mode === 'model' ? expected.modelDecision!.policyVersion : expected.policyVersion;
	if (!isRecord(value) || !hasOnlyKeys(value, INSPECTOR_KEYS)) return false;
	const inference = value.inference;
	if (!isInference(inference)) return false;
	if (!matchesReference(value.reference, expected.reference)
		|| value.policyVersion !== policyVersion
		|| value.surface !== 'home'
		|| value.preset !== (mode === 'model' ? 'assist' : 'preserve')
		|| value.publicationMode !== 'live'
		|| value.dataSourceLabel !== (mode === 'model' ? 'bounded-model-ranking' : expected.dataSourceLabel)
		|| !sameAvailableModelDecision(value.availableModelDecision, expected.modelDecision)
		|| !Array.isArray(value.zones) || value.zones.length !== HOME_ZONES.length
		|| !value.zones.every((zone, index) => isZone(zone, HOME_ZONES[index], products, mode))) return false;
	if (inference.primary !== persona) return false;
	return isContractedHomeProvenance(value.provenance, expected, persona, mode);
}

function isZone(
	value: unknown,
	expected: (typeof HOME_ZONES)[number],
	products: KibbleProduct[],
	mode: 'rules' | 'model',
): value is KibbleInspectorZone {
	if (!isRecord(value) || !hasOnlyKeys(value, ZONE_KEYS)) return false;
	const expectedComponentVariant = mode === 'model' && expected.id === 'ranked-products'
		? 'kibble.featured-grid.ranked-segment'
		: expected.componentVariant;
	if (value.id !== expected.id || value.label !== expected.label || value.componentVariant !== expectedComponentVariant
		|| typeof value.decisionSummary !== 'string' || typeof value.changed !== 'boolean') return false;
	const isRanked = expected.id === 'ranked-products';
	const expectedAuthority = mode === 'model' && isRanked ? 'model' : expected.authority;
	const expectedCapabilities = mode === 'model' && isRanked ? ['rank_products'] : expected.capabilities;
	if (value.authority !== expectedAuthority || !sameStringArray(value.capabilities, expectedCapabilities)) return false;
	if (!isRecord(value.modelCallStatus) || !hasOnlyKeys(value.modelCallStatus, MODEL_STATUS_KEYS)) return false;
	if (mode === 'model' && isRanked) {
		if (!Number.isInteger(value.modelCallStatus.calls) || (value.modelCallStatus.calls as number) < 1
			|| (value.modelCallStatus.calls as number) > 2 || value.modelCallStatus.authorized !== true) return false;
		if (!isRecord(value.decision) || !hasOnlyKeys(value.decision, MODEL_DECISION_KEYS)
			|| typeof value.decision.model !== 'string' || value.decision.model.length < 1
			|| value.decision.outputField !== 'rankedProductIds'
			|| value.decision.productCount !== products.length) return false;
	} else {
		if (value.modelCallStatus.calls !== 0 || value.modelCallStatus.authorized !== false || 'decision' in value) return false;
	}

	if (!isRanked) {
		return value.changed === false && !('inputProducts' in value) && !('outputProducts' in value);
	}
	if (!isProductSummaryList(value.inputProducts) || !isProductSummaryList(value.outputProducts)) return false;
	const input = value.inputProducts as Array<{ id: string; name: string; variant?: string }>;
	const output = value.outputProducts as Array<{ id: string; name: string; variant?: string }>;
	if (new Set(input.map(({ id }) => id)).size !== input.length || input.some(({ variant }) => variant !== undefined)) return false;
	if (output.length !== products.length || output.some(({ variant }) => variant !== undefined)) return false;
	if (!output.every((summary, index) => summary.id === products[index].id && summary.name === products[index].name)) return false;
	const orderChanged = input.length !== output.length || input.some((summary, index) => summary.id !== output[index]?.id);
	return value.changed === orderChanged;
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
		|| value.promptVersion !== (mode === 'model' ? 'kibble-home-bounded-rank-v1' : 'no-model-preserve-v1')
		|| value.schemaVersion !== (mode === 'model' ? 'kibble-home-zone-decision-v1' : `kibble-reference-${expected.reference.version}`)
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
		|| value.autonomy.preset !== (mode === 'model' ? 'assist' : 'preserve')
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
		&& value.zoneId === 'home.featured-row'
		&& sameStringArray(value.capabilities, ['rank_products'])
		&& value.publicationMode === 'live';
}

function sameAvailableModelDecision(
	value: unknown,
	expected: NonNullable<KibbleDevInspectorData['availableModelDecision']> | null,
): boolean {
	if (expected === null) return value === undefined;
	return isAvailableModelDecision(value)
		&& value.policyVersion === expected.policyVersion
		&& value.zoneId === expected.zoneId
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
		if (!isRecord(adapter) || !hasOnlyKeys(adapter, ADAPTER_KEYS)
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
		for (const entry of props.products) {
			if (!isRecord(entry) || !hasOnlyKeys(entry, PRODUCT_REF_KEYS)
				|| typeof entry.productId !== 'string' || entry.role !== 'standard') return false;
			renderedProductIds.push(entry.productId);
		}
	}
	if (!sameStringArray(renderedProductIds, products.map(({ entityId }) => String(entityId)))) return false;
	if (!isRecord(inspectorValue) || !Array.isArray(inspectorValue.zones)) return false;
	const rankedZone = inspectorValue.zones.find((zone) => isRecord(zone) && zone.id === 'ranked-products');
	return isRecord(rankedZone) && isRecord(rankedZone.modelCallStatus)
		&& rankedZone.modelCallStatus.calls === (mode === 'model' ? value[0].modelCallCount : 0);
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
