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
	if (!isInspector(value.inspector, expected, value.persona)) return invalid('inspector');

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

function isInspector(value: unknown, expected: KibbleLivePreviewExpectation, persona: KibbleInspectorPersona): value is KibbleDevInspectorData {
	if (!isRecord(value) || !hasOnlyKeys(value, INSPECTOR_KEYS)) return false;
	const inference = value.inference;
	if (!isInference(inference)) return false;
	if (!matchesReference(value.reference, expected.reference)
		|| value.policyVersion !== expected.policyVersion
		|| typeof value.surface !== 'string'
		|| typeof value.preset !== 'string'
		|| typeof value.publicationMode !== 'string'
		|| typeof value.dataSourceLabel !== 'string'
		|| !Array.isArray(value.zones)
		|| !value.zones.every(isZone)) return false;
	if (inference.primary !== persona) return false;
	return !('provenance' in value) || isRecord(value.provenance);
}

function isZone(value: unknown): value is KibbleInspectorZone {
	if (!isRecord(value) || !hasOnlyKeys(value, ZONE_KEYS)) return false;
	if (typeof value.id !== 'string' || typeof value.label !== 'string' || typeof value.componentVariant !== 'string'
		|| typeof value.decisionSummary !== 'string' || typeof value.changed !== 'boolean') return false;
	if (value.authority !== 'fixed' && value.authority !== 'rules' && value.authority !== 'model') return false;
	if (!Array.isArray(value.capabilities) || !value.capabilities.every((capability) => typeof capability === 'string')) return false;
	if ('modelCallStatus' in value && (!isRecord(value.modelCallStatus) || !hasOnlyKeys(value.modelCallStatus, MODEL_STATUS_KEYS)
		|| typeof value.modelCallStatus.calls !== 'number' || typeof value.modelCallStatus.authorized !== 'boolean')) return false;
	if ('inputProducts' in value && !isProductSummaryList(value.inputProducts)) return false;
	if ('outputProducts' in value && !isProductSummaryList(value.outputProducts)) return false;
	if ('decision' in value && !isRecord(value.decision)) return false;
	return true;
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

function isFiniteNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

function containsPersonaFit(value: unknown): boolean {
	if (Array.isArray(value)) return value.some(containsPersonaFit);
	if (!isRecord(value)) return false;
	return Object.entries(value).some(([key, entry]) => key === 'personaFit' || containsPersonaFit(entry));
}
