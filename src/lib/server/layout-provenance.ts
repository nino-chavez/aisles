import { z } from 'zod';
import type { BrandConfig } from '$lib/brand/config';
import {
	AUTONOMY_CAPABILITIES,
	DECISION_MODES,
	LEGACY_GENERATED_POLICY_VERSION,
	PUBLICATION_MODES,
	type AutonomyCapability,
} from '$lib/foundation/composition-policy';
import type { Surface } from '$lib/foundation/zones';
import type { EffectiveCompositionPolicy } from '$lib/foundation/composition-policy';

export const LAYOUT_PROVENANCE_VERSION = 'layout-provenance-v1' as const;
export const RESPONSIVE_VIEWPORT_CLASS = 'responsive' as const;
export const LEGACY_LAYOUT_SCHEMA_VERSION = 'legacy-layout-schema-v1' as const;
export const LEGACY_REFINE_SCHEMA_VERSION = 'legacy-refine-schema-v1' as const;

const AutonomyCapabilitySchema = z.enum(AUTONOMY_CAPABILITIES);

export const LayoutProvenanceSchema = z.object({
	version: z.literal(LAYOUT_PROVENANCE_VERSION),
	organizationId: z.string().min(1),
	brandId: z.string().min(1),
	reference: z.object({
		status: z.enum(['contracted', 'uncontracted_legacy']),
		id: z.string().min(1).nullable(),
		version: z.string().min(1).nullable(),
	}).strict(),
	policyVersion: z.string().min(1),
	surface: z.enum(['home', 'plp', 'pdp', 'cart', 'checkout', 'search', 'error-404', 'error-empty']),
	route: z.string().startsWith('/'),
	persona: z.string().min(1),
	viewportClass: z.literal(RESPONSIVE_VIEWPORT_CLASS),
	renderer: z.object({
		componentId: z.string().min(1),
		variantId: z.string().min(1),
	}).strict(),
	decisionSource: z.enum(['fixed', 'rules', 'model', 'merchant', 'fallback']),
	inputHash: z.string().regex(/^[0-9a-f]{16}$/),
	catalogVersion: z.string().regex(/^catalog:[0-9a-f]{16}$/),
	shopperContextHash: z.string().regex(/^[0-9a-f]{16}$/),
	picksHash: z.string().regex(/^[0-9a-f]{16}$/).nullable(),
	incentiveHash: z.string().regex(/^[0-9a-f]{16}$/).nullable(),
	autonomy: z.object({
		preset: z.enum(['preserve', 'assist', 'compose', 'explore']).nullable(),
		effectiveCapabilities: z.array(AutonomyCapabilitySchema),
		decisionMode: z.enum(DECISION_MODES),
		publicationMode: z.enum(PUBLICATION_MODES),
	}).strict(),
	promptVersion: z.string().min(1),
	schemaVersion: z.string().min(1),
	synthetic: z.object({
		value: z.boolean(),
		scenarioId: z.string().min(1).nullable(),
	}).strict(),
}).strict().superRefine((value, context) => {
	const hasReference = value.reference.id !== null && value.reference.version !== null;
	if ((value.reference.status === 'contracted') !== hasReference) {
		context.addIssue({
			code: 'custom',
			message: 'Contracted references require both id and version; legacy references require neither',
			path: ['reference'],
		});
	}
	if (value.synthetic.value !== (value.synthetic.scenarioId !== null)) {
		context.addIssue({
			code: 'custom',
			message: 'Synthetic provenance requires a scenario id and real provenance forbids one',
			path: ['synthetic'],
		});
	}
});

export type LayoutProvenance = z.infer<typeof LayoutProvenanceSchema>;

export interface BuildLegacyLayoutProvenanceInput {
	/** Trusted deploy-selected brand. Browser input cannot select this identity. */
	brand: Pick<BrandConfig, 'organizationId' | 'id'>;
	surface: Surface;
	route: string;
	persona: string;
	promptVersion: string;
	schemaVersion: string;
	prompt: string;
	catalogInput: unknown;
	shopperContext: unknown;
	picksContext?: unknown;
	incentiveContext?: unknown;
	scenarioId?: string | null;
}

export interface BuildContractedLayoutProvenanceInput {
	policy: EffectiveCompositionPolicy;
	surface: Surface;
	route: string;
	persona: string;
	rendererComponentId: string;
	rendererVariantId: string;
	decisionSource: 'fixed' | 'rules' | 'merchant' | 'fallback';
	promptVersion: string;
	schemaVersion: string;
	contractInput: unknown;
	catalogInput: unknown;
	shopperContext: unknown;
	scenarioId?: string | null;
}

/** Truthful provenance for a server-rendered, compiled Preserve route. */
export function buildContractedLayoutProvenance(
	input: BuildContractedLayoutProvenanceInput,
): LayoutProvenance {
	const referenceId = input.policy.provenance.referenceId;
	const referenceVersion = input.policy.provenance.referenceVersion;
	const preset = input.policy.provenance.preset;
	if (input.policy.provenance.kind !== 'compiled' || !referenceId || !referenceVersion || !preset) {
		throw new Error('layout provenance: contracted rendering requires compiled reference policy');
	}
	const scenarioId = input.scenarioId ?? null;
	return LayoutProvenanceSchema.parse({
		version: LAYOUT_PROVENANCE_VERSION,
		organizationId: input.policy.provenance.organizationId,
		brandId: input.policy.provenance.brandId,
		reference: { status: 'contracted', id: referenceId, version: referenceVersion },
		policyVersion: input.policy.policyVersion,
		surface: input.surface,
		route: normalizeRoute(input.route),
		persona: input.persona,
		viewportClass: RESPONSIVE_VIEWPORT_CLASS,
		renderer: { componentId: input.rendererComponentId, variantId: input.rendererVariantId },
		decisionSource: input.decisionSource,
		inputHash: stableHash({ contractInput: input.contractInput, schemaVersion: input.schemaVersion }),
		catalogVersion: `catalog:${stableHash(input.catalogInput)}`,
		shopperContextHash: stableHash(input.shopperContext),
		picksHash: null,
		incentiveHash: null,
		autonomy: {
			preset,
			effectiveCapabilities: [...input.policy.capabilities],
			decisionMode: input.policy.decisionMode,
			publicationMode: input.policy.publicationMode,
		},
		promptVersion: input.promptVersion,
		schemaVersion: input.schemaVersion,
		synthetic: { value: scenarioId !== null, scenarioId },
	});
}

/**
 * Truthful identity for the existing whole-page model renderer.
 *
 * This path has no approved external reference contract. In particular, a
 * Kibble request reaching these endpoints is still legacy generation, not a
 * Preserve decision.
 */
export function buildLegacyLayoutProvenance(
	input: BuildLegacyLayoutProvenanceInput,
): LayoutProvenance {
	const scenarioId = input.scenarioId ?? null;
	const provenance: LayoutProvenance = {
		version: LAYOUT_PROVENANCE_VERSION,
		organizationId: input.brand.organizationId,
		brandId: input.brand.id,
		reference: { status: 'uncontracted_legacy', id: null, version: null },
		policyVersion: LEGACY_GENERATED_POLICY_VERSION,
		surface: input.surface,
		route: normalizeRoute(input.route),
		persona: input.persona,
		viewportClass: RESPONSIVE_VIEWPORT_CLASS,
		renderer: {
			componentId: 'legacy.layout-renderer',
			variantId: 'legacy.whole-page-responsive-v1',
		},
		decisionSource: 'model',
		inputHash: stableHash({ prompt: input.prompt, schemaVersion: input.schemaVersion }),
		catalogVersion: `catalog:${stableHash(input.catalogInput)}`,
		shopperContextHash: stableHash(input.shopperContext),
		picksHash: input.picksContext === undefined ? null : stableHash(input.picksContext),
		incentiveHash: input.incentiveContext === undefined ? null : stableHash(input.incentiveContext),
		autonomy: {
			preset: null,
			effectiveCapabilities: [...AUTONOMY_CAPABILITIES] as AutonomyCapability[],
			decisionMode: 'model',
			publicationMode: 'live',
		},
		promptVersion: input.promptVersion,
		schemaVersion: input.schemaVersion,
		synthetic: { value: scenarioId !== null, scenarioId },
	};

	return LayoutProvenanceSchema.parse(provenance);
}

/** Canonical JSON serialization: object keys sort recursively and undefined is omitted. */
export function canonicalSerialize(value: unknown): string {
	return JSON.stringify(toCanonicalJson(value));
}

/** Stable 64-bit FNV-1a over canonical UTF-8. This is an identity hash, not a security primitive. */
export function stableHash(value: unknown): string {
	let hash = 0xcbf29ce484222325n;
	for (const byte of new TextEncoder().encode(canonicalSerialize(value))) {
		hash ^= BigInt(byte);
		hash = BigInt.asUintN(64, hash * 0x100000001b3n);
	}
	return hash.toString(16).padStart(16, '0');
}

function toCanonicalJson(value: unknown): unknown {
	if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
	if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
	if (Array.isArray(value)) return value.map((entry) => entry === undefined ? null : toCanonicalJson(entry));
	if (typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.filter(([, entry]) => entry !== undefined)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, entry]) => [key, toCanonicalJson(entry)]),
		);
	}
	return String(value);
}

function normalizeRoute(route: string): string {
	const trimmed = route.trim();
	if (!trimmed.startsWith('/')) throw new Error('layout provenance: route must start with /');
	return trimmed.replace(/\/{2,}/g, '/');
}
