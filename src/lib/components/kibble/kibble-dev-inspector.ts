/**
 * Client-safe shape for the Kibble developer inspector. The route adapter owns
 * population; this component intentionally has no server or policy imports.
 */
import type { KibblePresentationSnapshot } from '$lib/brand/reference/kibble-presentation-decisions';

export type KibbleInspectorPersona = 'gatherer' | 'hunter' | 'researcher' | 'gifter';
export type KibbleInspectorAuthority = 'fixed' | 'rules' | 'model';

export interface KibbleInspectorInference {
	primary: KibbleInspectorPersona;
	probabilities: Record<KibbleInspectorPersona, number>;
	confidence: number;
	dominantSource: string;
	signalCount: number;
	modifiers: {
		priceSensitivity: number;
		urgency: number;
		familiarityWithStore: number;
	};
	shift: {
		detected: boolean;
		from: KibbleInspectorPersona | null;
		trigger: string | null;
	};
	ruleMatches: Array<{
		ruleName: string;
		reason: string;
		weight: number;
		adjustment: Partial<Record<KibbleInspectorPersona | 'priceSensitivity' | 'urgency' | 'familiarityWithStore', number>>;
	}>;
}

export interface KibbleInspectorProductSummary {
	id: string;
	name: string;
	variant?: string;
}

export interface KibbleInspectorZone {
	id: string;
	label: string;
	authority: KibbleInspectorAuthority;
	componentVariant: string;
	capabilities: readonly string[];
	decisionSummary: string;
	changed: boolean;
	inputProducts?: readonly KibbleInspectorProductSummary[];
	outputProducts?: readonly KibbleInspectorProductSummary[];
	/** Omit for the Preserve default: no model call and no authorization. */
	modelCallStatus?: {
		calls: number;
		authorized: boolean;
	};
	decision?: Record<string, unknown>;
}

export interface KibbleDevInspectorData {
	reference: { id: string; version: string };
	surface: string;
	preset: string;
	policyVersion: string;
	publicationMode: string;
	inference: KibbleInspectorInference;
	dataSourceLabel: string;
	zones: readonly KibbleInspectorZone[];
	provenance?: Record<string, unknown>;
	availableModelDecision?: {
		policyVersion: string;
		zoneId: 'home.featured-row';
		capabilities: readonly ['rank_products'];
		publicationMode: 'live';
	};
}

export type KibbleDecisionEvidence = {
	surface: 'home' | 'plp' | 'pdp' | 'search' | 'cart' | 'checkout';
	zoneId: string;
	zoneLabel: string;
	policyVersion: string;
	provider: 'anthropic' | null;
	model: string | null;
	calls: number | null;
	before: KibbleInspectorProductSummary[];
	after: KibbleInspectorProductSummary[];
	moved: KibbleInspectorProductSummary[];
	added: KibbleInspectorProductSummary[];
	removed: KibbleInspectorProductSummary[];
	unchanged: KibbleInspectorProductSummary[];
	copy: KibblePresentationChange[];
	components: KibblePresentationChange[];
	sections: KibblePresentationChange[];
	marketingBlocks: KibblePresentationChange[];
	state: 'applied' | 'failed';
	fallback: boolean;
};

export type KibblePresentationChange = {
	id: string;
	label: string;
	before: string;
	after: string;
	changed: boolean;
};

export type KibbleLivePreviewStatus =
	| { state: 'waiting' | 'updating' | 'failed'; mode?: 'rules' | 'model'; evidence?: KibbleDecisionEvidence }
	| { state: 'applied'; mode?: 'rules' | 'model'; persona: KibbleInspectorPersona; changed: boolean; evidence?: KibbleDecisionEvidence };

export function buildKibbleDecisionEvidence(input: {
	surface: KibbleDecisionEvidence['surface'];
	zoneId: string;
	zoneLabel: string;
	policyVersion: string;
	before: readonly KibbleInspectorProductSummary[];
	after: readonly KibbleInspectorProductSummary[];
	provider: 'anthropic' | null;
	model: string | null;
	calls: number | null;
	state: KibbleDecisionEvidence['state'];
	presentationBefore?: KibblePresentationSnapshot;
	presentationAfter?: KibblePresentationSnapshot;
}): KibbleDecisionEvidence {
	const before = input.before.map(({ id, name }) => ({ id, name }));
	const after = input.after.map(({ id, name }) => ({ id, name }));
	const beforeById = new Map(before.map((product, index) => [product.id, { product, index }]));
	const afterIds = new Set(after.map(({ id }) => id));
	const beforeIds = new Set(before.map(({ id }) => id));
	const presentationBefore = input.presentationBefore ?? emptyPresentationSnapshot();
	const presentationAfter = input.presentationAfter ?? presentationBefore;
	return {
		surface: input.surface,
		zoneId: input.zoneId,
		zoneLabel: input.zoneLabel,
		policyVersion: input.policyVersion,
		provider: input.provider,
		model: input.model,
		calls: input.calls,
		before,
		after,
		moved: after.filter((product, index) => beforeById.has(product.id) && beforeById.get(product.id)?.index !== index),
		added: after.filter(({ id }) => !beforeIds.has(id)),
		removed: before.filter(({ id }) => !afterIds.has(id)),
		unchanged: after.filter((product, index) => beforeById.get(product.id)?.index === index),
		copy: comparePresentationEntries(presentationBefore.copy, presentationAfter.copy),
		components: comparePresentationEntries(presentationBefore.components, presentationAfter.components),
		sections: comparePresentationEntries(presentationBefore.sections, presentationAfter.sections),
		marketingBlocks: comparePresentationEntries(presentationBefore.marketingBlocks, presentationAfter.marketingBlocks),
		state: input.state,
		fallback: input.state === 'failed',
	};
}

export function hasKibbleDecisionChanged(evidence: KibbleDecisionEvidence): boolean {
	return evidence.moved.length > 0
		|| evidence.added.length > 0
		|| evidence.removed.length > 0
		|| [...evidence.copy, ...evidence.components, ...evidence.sections, ...evidence.marketingBlocks].some(({ changed }) => changed);
}

export function describeKibbleDecisionDimensions(evidence: KibbleDecisionEvidence): string {
	if (evidence.state === 'failed') return 'Fallback kept the existing presentation.';
	const changed: string[] = [];
	if (evidence.moved.length || evidence.added.length || evidence.removed.length) changed.push('product order');
	if (evidence.copy.some((entry) => entry.changed)) changed.push('copy');
	if (evidence.components.some((entry) => entry.changed)) changed.push('component treatment');
	if (evidence.sections.some((entry) => entry.changed)) changed.push('section order');
	if (evidence.marketingBlocks.some((entry) => entry.changed)) changed.push('marketing block');
	return changed.length ? `AI changed ${changed.join(', ')}.` : 'AI kept the existing order, copy, and presentation.';
}

export function describeKibbleRehearsalStatus(
	requestedPersona: KibbleInspectorPersona | null,
	status: KibbleLivePreviewStatus,
	queued = false,
	error: string | null = null,
): string {
	if (error) return error;
	if (!requestedPersona) return 'Choose a persona to send one synthetic search signal.';
	if (queued) return `Signal ${requestedPersona} queued. Waiting for the signal endpoint.`;
	if (status.state === 'updating') return `Signal ${requestedPersona} accepted. Server decision updating.`;
	if (status.state === 'failed') return `Signal ${requestedPersona} accepted. Preview failed; last approved shelf retained.`;
	if (status.state === 'applied') {
		return `Signal ${requestedPersona} accepted. Server applied ${status.persona}; shelf order ${status.changed ? 'changed' : 'unchanged'}.`;
	}
	return `Signal ${requestedPersona} accepted. Waiting for the server decision.`;
}

export function describeKibbleBehaviorStatus(
	behavior: { label: string; eventCount: number } | null,
	status: KibbleLivePreviewStatus,
	queued = false,
	error: string | null = null,
): string {
	if (error) return error;
	if (!behavior) return 'Choose a customer behavior to simulate.';
	const signalLabel = `${behavior.eventCount} synthetic signal${behavior.eventCount === 1 ? '' : 's'}`;
	if (queued) return `${behavior.label}: sending ${signalLabel} through the storefront pipeline.`;
	if (status.state === 'updating') return `${behavior.label}: ${signalLabel} accepted. Server decision updating.`;
	if (status.state === 'failed') return `${behavior.label}: ${signalLabel} accepted. Preview failed; last approved shelf retained.`;
	if (status.state === 'applied') {
		return `${behavior.label}: ${signalLabel} accepted. Server inferred ${status.persona}; shelf order ${status.changed ? 'changed' : 'unchanged'}.`;
	}
	return `${behavior.label}: ${signalLabel} accepted. Waiting for the server decision.`;
}

export function describeKibbleModelDecisionStatus(status: KibbleLivePreviewStatus): string {
	if (status.state === 'updating') return 'Bounded AI presentation is running.';
	if (status.state === 'failed') return 'Bounded AI presentation failed; the last approved storefront was retained.';
	if (status.state === 'applied') {
		return status.evidence
			? `Bounded AI presentation applied for ${status.persona}; ${describeKibbleDecisionDimensions(status.evidence)}`
			: `Bounded AI presentation applied for ${status.persona}.`;
	}
	return 'Bounded AI presentation is ready.';
}

function comparePresentationEntries(
	before: KibblePresentationSnapshot['copy'],
	after: KibblePresentationSnapshot['copy'],
): KibblePresentationChange[] {
	const beforeById = new Map(before.map((entry) => [entry.id, entry]));
	const afterById = new Map(after.map((entry) => [entry.id, entry]));
	const ids = [...new Set([...beforeById.keys(), ...afterById.keys()])];
	return ids.map((id) => {
		const beforeEntry = beforeById.get(id);
		const afterEntry = afterById.get(id);
		const beforeValue = beforeEntry?.value ?? 'Not shown';
		const afterValue = afterEntry?.value ?? 'Not shown';
		return { id, label: afterEntry?.label ?? beforeEntry?.label ?? id, before: beforeValue, after: afterValue, changed: beforeValue !== afterValue };
	});
}

function emptyPresentationSnapshot(): KibblePresentationSnapshot {
	return { copy: [], components: [], sections: [], marketingBlocks: [] };
}

export const KIBBLE_INSPECTOR_PERSONAS: readonly KibbleInspectorPersona[] = [
	'gatherer',
	'hunter',
	'researcher',
	'gifter',
];

const restrictedKey = /(secret|password|credential|authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|prompt|instruction)/i;
const inlineSecret = /\b(access[_-]?token|refresh[_-]?token|api[_-]?key|password|secret|credential)=([^&\s]+)/gi;
const emailAddress = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const bearerToken = /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi;

/** Keep inference mechanics visible without echoing shopper-controlled values. */
export function sanitizeInspectorInference<T extends KibbleInspectorInference>(inference: T): T {
	return {
		...inference,
		probabilities: { ...inference.probabilities },
		modifiers: { ...inference.modifiers },
		shift: {
			...inference.shift,
			trigger: inference.shift.trigger ? '[request detail withheld]' : null,
		},
		ruleMatches: inference.ruleMatches.map((rule) => ({
			...rule,
			adjustment: { ...rule.adjustment },
			reason: 'Matched; raw request detail withheld.',
		})),
	} as T;
}

/** Remove credential-like fields before opening a raw debugging view. */
export function redactInspectorDebugValue(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(redactInspectorDebugValue);
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
				key,
				restrictedKey.test(key) ? '[redacted]' : redactInspectorDebugValue(entry),
			]),
		);
	}
	if (typeof value === 'string') {
		return value
			.replace(inlineSecret, '$1=[redacted]')
			.replace(emailAddress, '[redacted-email]')
			.replace(bearerToken, 'Bearer [redacted]');
	}
	return value;
}

export function isKibbleInspectorInference(value: unknown): value is KibbleInspectorInference {
	if (!value || typeof value !== 'object') return false;
	const candidate = value as Partial<KibbleInspectorInference>;
	return typeof candidate.primary === 'string'
		&& !!candidate.probabilities
		&& typeof candidate.confidence === 'number'
		&& typeof candidate.signalCount === 'number'
		&& Array.isArray(candidate.ruleMatches);
}
