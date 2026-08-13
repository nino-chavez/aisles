import type { KibbleProduct } from './types';
import {
	type KibbleDevInspectorData,
	type KibbleInspectorPersona,
	type KibbleInspectorZone,
	type KibbleLivePreviewStatus,
} from './kibble-dev-inspector';

const PERSONAS = new Set<KibbleInspectorPersona>(['gatherer', 'hunter', 'researcher', 'gifter']);
const RESPONSE_KEYS = new Set(['version', 'previewOnly', 'reference', 'policyVersion', 'persona', 'products', 'inspector']);
const PRODUCT_KEYS = new Set(['id', 'entityId', 'name', 'price', 'salePrice', 'image', 'imageAlt', 'description', 'specs', 'tags', 'category']);
const INSPECTOR_KEYS = new Set(['reference', 'surface', 'preset', 'policyVersion', 'publicationMode', 'inference', 'dataSourceLabel', 'zones', 'provenance']);
const ZONE_KEYS = new Set(['id', 'label', 'authority', 'componentVariant', 'capabilities', 'decisionSummary', 'changed', 'inputProducts', 'outputProducts', 'modelCallStatus', 'decision']);
const INFERENCE_KEYS = new Set(['primary', 'probabilities', 'confidence', 'entropy', 'certainty', 'dominantSource', 'signalCount', 'lastUpdated', 'modifiers', 'shift', 'ruleMatches']);
const MODIFIER_KEYS = new Set(['priceSensitivity', 'urgency', 'familiarityWithStore']);
const SHIFT_KEYS = new Set(['detected', 'from', 'trigger']);
const RULE_KEYS = new Set(['ruleName', 'reason', 'weight', 'adjustment']);
const ADJUSTMENT_KEYS = new Set([...PERSONAS, ...MODIFIER_KEYS]);
const PRODUCT_SUMMARY_KEYS = new Set(['id', 'name', 'variant']);
const MODEL_STATUS_KEYS = new Set(['calls', 'authorized']);
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
const CATALOG_HASH = /^catalog:[0-9a-f]{16}$/;

export type KibbleLivePreviewExpectation = {
	reference: { id: string; version: string };
	policyVersion: string;
};

export type KibbleLivePreview = {
	persona: KibbleInspectorPersona;
	products: KibbleProduct[];
	inspector: KibbleDevInspectorData;
};

export type KibbleLivePreviewValidation =
	| { ok: true; preview: KibbleLivePreview }
	| { ok: false; reason: string };

export type KibbleLivePreviewListenerOptions = {
	expectation: KibbleLivePreviewExpectation;
	onApplied: (preview: KibbleLivePreview) => void;
	onStatus: (status: KibbleLivePreviewStatus) => void;
};

/**
 * Install the dev-only signal-to-preview bridge. The caller lazy-loads this
 * module behind SvelteKit's compile-time dev flag so none of the endpoint or
 * validation machinery enters the production shopper bundle.
 */
export function listenForKibbleLivePreview({
	expectation,
	onApplied,
	onStatus,
}: KibbleLivePreviewListenerOptions): () => void {
	let active = true;
	let generation = 0;
	let controller: AbortController | null = null;

	const requestPreview = async () => {
		const requestGeneration = ++generation;
		controller?.abort();
		const requestController = new AbortController();
		controller = requestController;
		onStatus({ state: 'updating' });

		try {
			const response = await fetch('/api/kibble/home-decision?dev=true', {
				method: 'POST',
				signal: requestController.signal,
			});
			if (!response.ok) throw new Error(`Preview request failed (${response.status})`);
			const validation = validateKibbleLivePreview(await response.json(), expectation);
			if (!validation.ok) throw new Error(validation.reason);
			if (!active || requestController.signal.aborted || requestGeneration !== generation) return;
			onApplied(validation.preview);
			onStatus({ state: 'applied', persona: validation.preview.persona });
		} catch (error) {
			if (!active || requestController.signal.aborted || requestGeneration !== generation) return;
			console.warn('Kibble live preview was rejected; retaining the approved shelf.', error);
			onStatus({ state: 'failed' });
		} finally {
			if (controller === requestController) controller = null;
		}
	};

	const onInferenceUpdate = () => void requestPreview();
	window.addEventListener('aisles-inference-update', onInferenceUpdate);
	return () => {
		active = false;
		generation += 1;
		controller?.abort();
		controller = null;
		window.removeEventListener('aisles-inference-update', onInferenceUpdate);
	};
}

export function validateKibbleLivePreview(
	value: unknown,
	expected: KibbleLivePreviewExpectation,
): KibbleLivePreviewValidation {
	if (!isRecord(value) || !hasOnlyKeys(value, RESPONSE_KEYS)) return invalid('response shape');
	if (containsPersonaFit(value)) return invalid('personaFit is not public preview data');
	if (value.version !== 'kibble-live-home-preview-v1' || value.previewOnly !== true) return invalid('preview contract');
	if (!matchesReference(value.reference, expected.reference)) return invalid('reference');
	if (value.policyVersion !== expected.policyVersion) return invalid('policy version');
	if (!isPersona(value.persona)) return invalid('persona');
	if (!Array.isArray(value.products) || value.products.length < 1 || value.products.length > 8) return invalid('products');
	if (!value.products.every(isKibbleProduct) || new Set(value.products.map((product) => product.id)).size !== value.products.length) return invalid('products');
	if (!isInspector(value.inspector, expected, value.persona, value.products)) return invalid('inspector');

	return { ok: true, preview: { persona: value.persona, products: value.products, inspector: value.inspector } };
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
): value is KibbleDevInspectorData {
	if (!isRecord(value) || !hasOnlyKeys(value, INSPECTOR_KEYS)) return false;
	const inference = value.inference;
	if (!isInference(inference)) return false;
	if (!matchesReference(value.reference, expected.reference)
		|| value.policyVersion !== expected.policyVersion
		|| value.surface !== 'home'
		|| value.preset !== 'preserve'
		|| value.publicationMode !== 'live'
		|| typeof value.dataSourceLabel !== 'string'
		|| !Array.isArray(value.zones) || value.zones.length !== HOME_ZONES.length
		|| !value.zones.every((zone, index) => isZone(zone, HOME_ZONES[index], products))) return false;
	if (inference.primary !== persona) return false;
	return isContractedHomeProvenance(value.provenance, expected, persona);
}

function isZone(
	value: unknown,
	expected: (typeof HOME_ZONES)[number],
	products: KibbleProduct[],
): value is KibbleInspectorZone {
	if (!isRecord(value) || !hasOnlyKeys(value, ZONE_KEYS)) return false;
	if (value.id !== expected.id || value.label !== expected.label || value.componentVariant !== expected.componentVariant
		|| typeof value.decisionSummary !== 'string' || typeof value.changed !== 'boolean') return false;
	if (value.authority !== expected.authority || !sameStringArray(value.capabilities, expected.capabilities)) return false;
	if (!isRecord(value.modelCallStatus) || !hasOnlyKeys(value.modelCallStatus, MODEL_STATUS_KEYS)
		|| value.modelCallStatus.calls !== 0 || value.modelCallStatus.authorized !== false) return false;
	if ('decision' in value) return false;

	if (expected.id !== 'ranked-products') {
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
) {
	if (!isRecord(value) || !hasOnlyKeys(value, PROVENANCE_KEYS)) return false;
	if (value.version !== 'layout-provenance-v1' || value.organizationId !== 'kibble-demo-merchant'
		|| value.brandId !== 'kibble' || value.policyVersion !== expected.policyVersion
		|| value.surface !== 'home' || value.route !== '/' || value.persona !== persona
		|| value.viewportClass !== 'responsive' || value.decisionSource !== 'rules'
		|| value.promptVersion !== 'no-model-preserve-v1'
		|| value.schemaVersion !== `kibble-reference-${expected.reference.version}`
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
		|| value.autonomy.preset !== 'preserve' || !sameStringArray(value.autonomy.effectiveCapabilities, HOME_CAPABILITIES)
		|| value.autonomy.decisionMode !== 'rules' || value.autonomy.publicationMode !== 'live') return false;
	return isRecord(value.synthetic) && hasOnlyKeys(value.synthetic, SYNTHETIC_KEYS)
		&& typeof value.synthetic.value === 'boolean'
		&& (value.synthetic.value
			? typeof value.synthetic.scenarioId === 'string' && value.synthetic.scenarioId.length > 0
			: value.synthetic.scenarioId === null);
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
