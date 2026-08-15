import type { KibbleZoneAdapterBinding } from './types';
import { KIBBLE_DEMO_MAX_PUBLIC_CLIENT_TIMEOUT_MS, kibbleModelCallCountFromPayload, readKibbleModelFailureCallCount } from '$lib/kibble-demo-ai-boundary';
import { buildKibbleDecisionEvidence, type KibbleLivePreviewStatus } from './kibble-dev-inspector';
import {
	KIBBLE_CART_PRESENTATION_POLICY,
	KIBBLE_CHECKOUT_PRESENTATION_POLICY,
	KIBBLE_SEARCH_PRESENTATION_POLICY,
	materializeKibbleCartPresentation,
	materializeKibbleCheckoutPresentation,
	materializeKibbleSearchPresentation,
	parseKibbleCartPresentationDecision,
	parseKibbleCheckoutPresentationDecision,
	parseKibbleSearchPresentationDecision,
	snapshotKibbleCartPresentation,
	snapshotKibbleCheckoutPresentation,
	snapshotKibbleSearchPresentation,
	type KibblePresentationSnapshot,
} from '$lib/brand/reference/kibble-presentation-decisions';

type Surface = 'search' | 'cart' | 'checkout';
type Expectation =
	| { surface: 'search'; routePath: '/search'; query: string; policyVersion: string }
	| { surface: 'cart'; routePath: '/cart'; policyVersion: string }
	| { surface: 'checkout'; routePath: '/checkout/gift' | '/checkout/prepaid'; subtype: 'gift' | 'prepaid'; policyVersion: string };

export function listenForKibbleBoundedCopyLivePreview(input: {
	expectation: Expectation;
	requestEvent: string;
	getCurrentPresentation: () => KibblePresentationSnapshot;
	onApplied: (preview: { zoneAdapter: KibbleZoneAdapterBinding; presentationDecision: Record<string, string>; persona: string; modelId: string; modelCallCount: number }) => void;
	onStatus: (status: KibbleLivePreviewStatus) => void;
}): () => void {
	let active = true;
	let controller: AbortController | null = null;
	let lastAppliedPresentation: KibblePresentationSnapshot | null = null;
	const onRequest = async () => {
		if (controller) return;
		const next = new AbortController();
		controller = next;
		input.onStatus({ state: 'updating', mode: 'model' });
		const presentationBefore = lastAppliedPresentation ?? input.getCurrentPresentation();
		let failedModelCallCount: number | null = null;
		let timedOut = false;
		const timeout = window.setTimeout(() => { timedOut = true; next.abort(); }, KIBBLE_DEMO_MAX_PUBLIC_CLIENT_TIMEOUT_MS);
		try {
			const requestBody = input.expectation.surface === 'search'
				? { mode: 'model', surface: 'search', query: input.expectation.query }
				: input.expectation.surface === 'cart'
					? { mode: 'model', surface: 'cart' }
					: { mode: 'model', surface: 'checkout', subtype: input.expectation.subtype };
			const response = await fetch('/api/kibble/bounded-copy-decision?observe=true', {
				method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody), signal: next.signal,
			});
			if (!response.ok) { failedModelCallCount = await readKibbleModelFailureCallCount(response); throw new Error(`Preview request failed (${response.status})`); }
			const payload: unknown = await response.json(); failedModelCallCount = kibbleModelCallCountFromPayload(payload);
			const preview = validateKibbleBoundedCopyPreview(payload, input.expectation);
			if (!preview || !active || next.signal.aborted) throw new Error('Preview response rejected');
			const presentationAfter = snapshotFor(input.expectation, preview.presentationDecision);
			const evidence = buildKibbleDecisionEvidence({
				surface: input.expectation.surface, zoneIds: [preview.zoneAdapter.instanceId],
				zoneLabel: zoneLabel(input.expectation.surface), policyVersion: presentationPolicy(input.expectation.surface).policyVersion,
				before: [], after: [], provider: 'anthropic', model: preview.modelId, calls: preview.modelCallCount,
				state: 'applied', presentationBefore, presentationAfter,
			});
			input.onApplied(preview);
			lastAppliedPresentation = presentationAfter;
			input.onStatus({ state: 'applied', mode: 'model', persona: preview.persona as 'gatherer' | 'hunter' | 'researcher' | 'gifter', changed: presentationAfter.copy.some((entry, index) => entry.value !== presentationBefore.copy[index]?.value), evidence });
		} catch (error) {
			if (!active || (next.signal.aborted && !timedOut)) return;
			console.warn(`Kibble ${input.expectation.surface} live preview was rejected; retaining the approved presentation.`, error);
			input.onStatus({ state: 'failed', mode: 'model', evidence: buildKibbleDecisionEvidence({
				surface: input.expectation.surface, zoneIds: presentationPolicy(input.expectation.surface).zoneIds,
				zoneLabel: zoneLabel(input.expectation.surface), policyVersion: presentationPolicy(input.expectation.surface).policyVersion,
				before: [], after: [], provider: null, model: null, calls: failedModelCallCount, state: 'failed',
				presentationBefore, presentationAfter: presentationBefore,
			}) });
		} finally {
			window.clearTimeout(timeout);
			if (controller === next) controller = null;
		}
	};
	window.addEventListener(input.requestEvent, onRequest);
	return () => { active = false; controller?.abort(); window.removeEventListener(input.requestEvent, onRequest); };
}

export function validateKibbleBoundedCopyPreview(value: unknown, expected: Expectation) {
	if (!isRecord(value) || value.version !== 'kibble-bounded-copy-preview-v1' || value.previewOnly !== true
		|| value.surface !== expected.surface || value.routePath !== expected.routePath || value.policyVersion !== expected.policyVersion
		|| value.provider !== 'anthropic' || typeof value.modelId !== 'string' || !isModelCallCount(value.modelCallCount)
		|| !isPersona(value.persona) || !isRecord(value.presentationPolicy) || !samePolicy(value.presentationPolicy, expected.surface)
		|| !isRecord(value.presentationDecision)) return null;
	if (expected.surface === 'search' && value.query !== expected.query) return null;
	if (expected.surface === 'checkout' && value.subtype !== expected.subtype) return null;
	const decision = expected.surface === 'search' ? parseKibbleSearchPresentationDecision(value.presentationDecision)
		: expected.surface === 'cart' ? parseKibbleCartPresentationDecision(value.presentationDecision)
			: parseKibbleCheckoutPresentationDecision(value.presentationDecision);
	if (!decision || !isAdapter(value.zoneAdapter, expected, decision as Record<string, string>, value.modelCallCount)) return null;
	return { zoneAdapter: value.zoneAdapter as KibbleZoneAdapterBinding, presentationDecision: decision as unknown as Record<string, string>, persona: value.persona, modelId: value.modelId, modelCallCount: value.modelCallCount as number };
}

function snapshotFor(expected: Expectation, decision: Record<string, string>) {
	if (expected.surface === 'search') return snapshotKibbleSearchPresentation(materializeKibbleSearchPresentation(decision as never, expected.query));
	if (expected.surface === 'cart') return snapshotKibbleCartPresentation(materializeKibbleCartPresentation(decision as never));
	return snapshotKibbleCheckoutPresentation(materializeKibbleCheckoutPresentation(decision as never));
}

function presentationPolicy(surface: Surface) {
	return surface === 'search' ? KIBBLE_SEARCH_PRESENTATION_POLICY : surface === 'cart' ? KIBBLE_CART_PRESENTATION_POLICY : KIBBLE_CHECKOUT_PRESENTATION_POLICY;
}
function zoneLabel(surface: Surface) { return surface === 'search' ? 'Search recovery presentation' : surface === 'cart' ? 'Cart recovery presentation' : 'Checkout assurance presentation'; }
function isRecord(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function isModelCallCount(value: unknown): value is number { return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 2; }
function isPersona(value: unknown) { return value === 'gatherer' || value === 'hunter' || value === 'researcher' || value === 'gifter'; }
function samePolicy(value: Record<string, unknown>, surface: Surface) {
	const expected = presentationPolicy(surface);
	return value.policyVersion === expected.policyVersion && sameStringArray(value.zoneIds, expected.zoneIds) && sameStringArray(value.capabilities, expected.capabilities);
}
function sameStringArray(value: unknown, expected: readonly string[]) { return Array.isArray(value) && value.length === expected.length && value.every((entry, index) => entry === expected[index]); }
const ADAPTER_KEYS = ['instanceId', 'sharedStatus', 'sharedContentKind', 'decisionMode', 'modelCallCount', 'adapterId', 'componentVariantId', 'inputSha256', 'content'] as const;
const ADAPTER_IDENTITIES = {
	search: { adapterId: 'kibble.zone.search.empty-state', componentVariantId: 'kibble.search.empty-state' },
	cart: { adapterId: 'kibble.zone.cart.empty-state', componentVariantId: 'kibble.cart.reference-shell' },
	checkout: { adapterId: 'kibble.zone.checkout.assurance-strip', componentVariantId: 'kibble.checkout.reference-shell' },
} as const;

function isAdapter(value: unknown, expected: Expectation, decision: Record<string, string>, calls: number) {
	if (!isRecord(value) || !hasOnlyKeys(value, ADAPTER_KEYS)) return false;
	const identity = ADAPTER_IDENTITIES[expected.surface];
	return value.instanceId === presentationPolicy(expected.surface).zoneIds[0]
		&& value.sharedStatus === 'live'
		&& value.sharedContentKind === 'content'
		&& value.decisionMode === 'model'
		&& value.modelCallCount === calls
		&& value.adapterId === identity.adapterId
		&& value.componentVariantId === identity.componentVariantId
		&& typeof value.inputSha256 === 'string'
		&& /^[0-9a-f]{64}$/.test(value.inputSha256)
		&& sameJson(value.content, expectedAdapterContent(expected, decision));
}

function expectedAdapterContent(expected: Expectation, decision: Record<string, string>) {
	if (expected.surface === 'search') {
		return { component: 'editorial-header', props: materializeKibbleSearchPresentation(decision as never, expected.query).copy };
	}
	if (expected.surface === 'cart') {
		return { component: 'editorial-header', props: materializeKibbleCartPresentation(decision as never).copy };
	}
	const assurance = materializeKibbleCheckoutPresentation(decision as never).assurance;
	return { component: 'service-callouts-grid', props: { columns: 3, callouts: assurance.callouts.map((item) => ({ ...item })) } };
}

function hasOnlyKeys(value: Record<string, unknown>, expected: readonly string[]) {
	const keys = Object.keys(value);
	return keys.length === expected.length && keys.every((key) => expected.includes(key));
}

function sameJson(value: unknown, expected: unknown): boolean {
	if (value === expected) return true;
	if (Array.isArray(value) || Array.isArray(expected)) {
		return Array.isArray(value) && Array.isArray(expected) && value.length === expected.length
			&& value.every((entry, index) => sameJson(entry, expected[index]));
	}
	if (!isRecord(value) || !isRecord(expected)) return false;
	const keys = Object.keys(value);
	const expectedKeys = Object.keys(expected);
	return keys.length === expectedKeys.length && keys.every((key) => Object.hasOwn(expected, key) && sameJson(value[key], expected[key]));
}
