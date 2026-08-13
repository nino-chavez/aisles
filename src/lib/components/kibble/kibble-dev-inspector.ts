/**
 * Client-safe shape for the Kibble developer inspector. The route adapter owns
 * population; this component intentionally has no server or policy imports.
 */
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
		...structuredClone(inference),
		shift: {
			...inference.shift,
			trigger: inference.shift.trigger ? '[request detail withheld]' : null,
		},
		ruleMatches: inference.ruleMatches.map((rule) => ({
			...structuredClone(rule),
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
