/**
 * Zone resolver — legacy and policy-aware precedence cascades.
 *
 *     legacy: raw engine → admin-authored content → static fallback
 *     policy: trusted merchant pin → permitted engine decision → fallback
 *
 * The policy path is opt-in. It keeps authority outside browser-shaped
 * engine output, rejects decisions beyond the compiled policy, and carries
 * a machine-readable trace even when it falls through. The legacy path is
 * behavior-compatible with the original resolver.
 *
 * The resolver is a pure function, called once per zone instance per
 * request. The return shape carries source attribution so a future
 * decisions-inspector view can render the cascade per zone.
 *
 * The legacy cascade was ported from bealls-aisles unchanged. The
 * policy-aware cascade is Aisles' bounded-autonomy extension.
 */

import { ZoneSchemas } from './zone-schemas';
import {
	ZONES,
	parseZoneInstance,
	type Surface,
	type ZoneId,
	type ZoneInstanceId,
	type ZoneMetadata,
} from './zones';
import { getFallback } from './fallbacks';
import {
	composeEffectivePolicyVersion,
	type AutonomyCapability,
	type CompositionPolicyProvenance,
	type DecisionMode,
	type EffectiveCompositionPolicy,
} from './composition-policy';

export type ZoneSource = 'merchant' | 'engine' | 'admin' | 'fallback';

export type PolicyRejectionReason =
	| 'trusted_identity_mismatch'
	| 'policy_not_compiled'
	| 'policy_provenance_mismatch'
	| 'merchant_override_not_authorized'
	| 'merchant_override_policy_version_mismatch'
	| 'merchant_override_reference_mismatch'
	| 'zone_not_merchant_authorable'
	| 'zone_not_engine_composable'
	| 'publication_holdout'
	| 'approval_required'
	| 'approval_reference_mismatch'
	| 'fixed_policy_rejects_engine'
	| 'invalid_decision_envelope'
	| 'decision_mode_exceeds_policy'
	| 'capability_not_allowed'
	| 'component_variant_not_allowed'
	| 'css_variant_not_allowed'
	| 'copy_variant_not_allowed'
	| 'contract_validator_missing'
	| 'contract_validation_failed'
	| 'invalid_zone_content';

export const DECISION_CONTENT_REJECTION_CODES = [
	'unregistered_contract',
	'variant_content_mismatch',
	'capability_scope_violation',
	'invalid_contract_content',
	'validator_exception',
] as const;

export type DecisionContentRejectionCode = (typeof DECISION_CONTENT_REJECTION_CODES)[number];

export type PolicySourceOutcome = 'accepted' | 'rejected' | 'not_provided' | 'superseded';

export interface PolicySourceTrace {
	outcome: PolicySourceOutcome;
	rejectionReason?: PolicyRejectionReason;
	contractRejectionCode?: DecisionContentRejectionCode;
}

export interface PolicyResolutionTrace {
	/** The exact compiled policy provenance evaluated for this zone. */
	provenance: CompositionPolicyProvenance;
	policy: PolicySourceTrace;
	merchantOverride: PolicySourceTrace;
	engineDecision: PolicySourceTrace;
}

export interface ZoneResolution {
	zoneId: ZoneInstanceId;
	family: ZoneId;
	index?: number;
	source: ZoneSource;
	/** `null` indicates the Hidden semantic — render no DOM. */
	content: unknown | null;
	/** Present only for the opt-in policy-aware path. */
	policyTrace?: PolicyResolutionTrace;
}

interface ResolveZoneCommonOpts {
	/**
	 * Full instance ID (e.g., `home.hero`, `home.featured-row.1`,
	 * `pdp.related`). For singleton + array zones this is the family ID;
	 * for indexed zones it is `{family}.{index}` (1-based).
	 */
	zoneId: ZoneInstanceId;
	brandId: string;
}

/**
 * Existing whole-page compatibility. Raw engine content has no policy
 * envelope and must not be used by new callers.
 */
export interface LegacyResolveZoneOpts extends ResolveZoneCommonOpts {
	mode?: 'legacy';
	/** Raw engine content retained only for explicit legacy compatibility. */
	engineOutput?: { zones?: Record<ZoneInstanceId, unknown> };
	/** Raw admin content retained only for explicit legacy compatibility. */
	adminContent?: { zones?: Record<ZoneInstanceId, unknown> };
}

/**
 * Server-established envelope. The mode, capabilities, and variant IDs are
 * derived from the selected pipeline and schema; a model must never author
 * them. Only `rawModelContent` may contain model output, and it is opaque to
 * the resolver until the trusted contract validator materializes it.
 */
export interface TrustedEngineDecisionEnvelope {
	decisionModeUsed: DecisionMode;
	requiredCapabilityIds: readonly AutonomyCapability[];
	componentVariantId: string;
	cssVariantId?: string;
	copyVariantId?: string;
	rawModelContent: unknown;
}

interface BoundTrustedMarker {
	organizationId: string;
	brandId: string;
	surface: Surface;
	zoneId: ZoneInstanceId;
	policyVersion: string;
	referenceId: string;
	referenceVersion: string;
}

export interface TrustedCompositionApproval extends BoundTrustedMarker {
	approved: true;
	approvalId: string;
}

export interface TrustedMerchantOverride extends BoundTrustedMarker {
	authorized: true;
	authorizationId: string;
	componentVariantId: string;
	cssVariantId?: string;
	copyVariantId?: string;
	content: unknown;
}

/**
 * Server-established identity and authorization. Callers must build this
 * from trusted host/session state, never from request JSON. Engine fields
 * that resemble these markers are deliberately ignored.
 */
export interface TrustedCompositionContext {
	organizationId: string;
	brandId: string;
	surface: Surface;
	zoneId: ZoneInstanceId;
	approval?: TrustedCompositionApproval;
	merchantOverride?: TrustedMerchantOverride;
}

export interface DecisionContentValidationInput {
	source: 'engine' | 'merchant';
	family: ZoneId;
	zoneId: ZoneInstanceId;
	decisionModeUsed: DecisionMode;
	requiredCapabilityIds: readonly AutonomyCapability[];
	componentVariantId: string;
	cssVariantId?: string;
	copyVariantId?: string;
	policy: EffectiveCompositionPolicy;
	rawContent: unknown;
}

export type DecisionContentValidationResult =
	| { ok: true; content: unknown }
	| { ok: false; code: DecisionContentRejectionCode };

export type DecisionContentValidator = (
	input: DecisionContentValidationInput,
) => DecisionContentValidationResult;

export interface PolicyAwareResolveZoneOpts extends ResolveZoneCommonOpts {
	mode: 'policy';
	policy: EffectiveCompositionPolicy;
	trustedContext: TrustedCompositionContext;
	trustedEngineDecisions?: { zones?: Record<ZoneInstanceId, TrustedEngineDecisionEnvelope> };
	/**
	 * Trusted reference-contract seam. This function must bind declared
	 * variants and capabilities to the content they may actually produce.
	 * A policy allow-list alone is not content validation.
	 */
	validateDecisionContent: DecisionContentValidator;
}

export type ResolveZoneOpts = LegacyResolveZoneOpts | PolicyAwareResolveZoneOpts;

/**
 * Resolve a single zone instance through the selected compatibility or
 * policy-aware cascade.
 *
 * Legacy engine/admin blocks receive schema validation. Policy decisions
 * must first pass the supplied trusted reference-contract validator, then
 * the zone schema. A decision's own IDs never validate its raw content.
 *
 * Throws only when `zoneId` does not match any zone in the catalog. Every
 * other path returns a `ZoneResolution`.
 */
export function resolveZone(opts: ResolveZoneOpts): ZoneResolution {
	const parsed = parseZoneInstance(opts.zoneId);
	if (!parsed) {
		throw new Error(`resolveZone: unknown zone instance "${opts.zoneId}"`);
	}
	const { family, index } = parsed;
	const meta = ZONES[family] as ZoneMetadata;
	const schema = ZoneSchemas[family];

	if (opts.mode === 'policy') {
		return resolvePolicyAware(opts, family, index, meta, schema);
	}

	// 1. Engine
	const engineRaw = opts.engineOutput?.zones?.[opts.zoneId];
	if (engineRaw !== undefined && meta.engineComposable) {
		const validated = validateForZone(family, engineRaw, schema, meta);
		if (validated.ok) {
			return { zoneId: opts.zoneId, family, index, source: 'engine', content: validated.content };
		}
	}

	// 2. Admin
	const adminRaw = opts.adminContent?.zones?.[opts.zoneId];
	if (adminRaw !== undefined && meta.adminAuthorable) {
		const validated = validateForZone(family, adminRaw, schema, meta);
		if (validated.ok) {
			return { zoneId: opts.zoneId, family, index, source: 'admin', content: validated.content };
		}
	}

	// 3. Static fallback
	const content = getFallback(family, opts.brandId);
	return { zoneId: opts.zoneId, family, index, source: 'fallback', content };
}

function resolvePolicyAware(
	opts: PolicyAwareResolveZoneOpts,
	family: ZoneId,
	index: number | undefined,
	meta: ZoneMetadata,
	schema: (typeof ZoneSchemas)[ZoneId],
): ZoneResolution {
	const trace: PolicyResolutionTrace = {
		provenance: opts.policy.provenance,
		policy: { outcome: 'accepted' },
		merchantOverride: { outcome: opts.trustedContext.merchantOverride ? 'rejected' : 'not_provided' },
		engineDecision: {
			outcome: opts.trustedEngineDecisions?.zones?.[opts.zoneId] === undefined ? 'not_provided' : 'rejected',
		},
	};

	const trustedIdentityMatches =
		opts.trustedContext.brandId === opts.brandId &&
		opts.trustedContext.surface === meta.surface &&
		opts.trustedContext.zoneId === opts.zoneId;
	const policyReason = validatePolicyProvenance(opts.policy, opts.trustedContext, family, meta.surface);
	if (!trustedIdentityMatches) {
		trace.policy = { outcome: 'rejected', rejectionReason: 'trusted_identity_mismatch' };
	} else if (policyReason) {
		trace.policy = { outcome: 'rejected', rejectionReason: policyReason };
	}

	if (trace.policy.outcome === 'accepted') {
		const merchantOverride = opts.trustedContext.merchantOverride;
		if (merchantOverride !== undefined) {
			const evaluated = evaluateMerchantOverride(merchantOverride, opts, meta, family, schema);
			trace.merchantOverride = evaluated.trace;
			if (evaluated.ok) {
				trace.engineDecision = opts.trustedEngineDecisions?.zones?.[opts.zoneId]
					? { outcome: 'superseded' }
					: { outcome: 'not_provided' };
				return {
					zoneId: opts.zoneId,
					family,
					index,
					source: 'merchant',
					content: evaluated.content,
					policyTrace: trace,
				};
			}
		}

		const engineDecision = opts.trustedEngineDecisions?.zones?.[opts.zoneId];
		if (engineDecision !== undefined) {
			const evaluated = evaluateEngineDecision(engineDecision, opts, meta, family, schema);
			trace.engineDecision = evaluated.trace;
			if (evaluated.ok) {
				return {
					zoneId: opts.zoneId,
					family,
					index,
					source: 'engine',
					content: evaluated.content,
					policyTrace: trace,
				};
			}
		}
	} else {
		const reason = trace.policy.rejectionReason;
		if (opts.trustedContext.merchantOverride) {
			trace.merchantOverride = { outcome: 'rejected', rejectionReason: reason };
		}
		if (opts.trustedEngineDecisions?.zones?.[opts.zoneId]) {
			trace.engineDecision = { outcome: 'rejected', rejectionReason: reason };
		}
	}

	return {
		zoneId: opts.zoneId,
		family,
		index,
		source: 'fallback',
		content: getFallback(family, opts.trustedContext.brandId),
		policyTrace: trace,
	};
}

type SourceEvaluation =
	| { ok: true; content: unknown; trace: PolicySourceTrace }
	| { ok: false; trace: PolicySourceTrace };

function evaluateMerchantOverride(
	override: TrustedMerchantOverride,
	opts: PolicyAwareResolveZoneOpts,
	meta: ZoneMetadata,
	family: ZoneId,
	schema: (typeof ZoneSchemas)[ZoneId],
): SourceEvaluation {
	if (
		override.authorized !== true ||
		!isNonBlank(override.authorizationId) ||
		!markerMatches(override, opts)
	) {
		return rejected('merchant_override_not_authorized');
	}
	if (override.policyVersion !== opts.policy.policyVersion) {
		return rejected('merchant_override_policy_version_mismatch');
	}
	if (!markerReferenceMatches(override, opts.policy)) {
		return rejected('merchant_override_reference_mismatch');
	}
	if (!meta.adminAuthorable) return rejected('zone_not_merchant_authorable');
	const variantReason = validateVariants(override, opts.policy);
	if (variantReason) return rejected(variantReason);
	const contractResult = validateContractContent(opts.validateDecisionContent, {
		source: 'merchant',
		family,
		zoneId: opts.zoneId,
		decisionModeUsed: 'fixed',
		requiredCapabilityIds: [],
		componentVariantId: override.componentVariantId,
		cssVariantId: override.cssVariantId,
		copyVariantId: override.copyVariantId,
		policy: opts.policy,
		rawContent: override.content,
	});
	if (!contractResult.ok) return contractResult;
	const validated = validateForZone(family, contractResult.content, schema, meta);
	if (!validated.ok) return rejected('invalid_zone_content');
	return { ok: true, content: validated.content, trace: { outcome: 'accepted' } };
}

function evaluateEngineDecision(
	decision: TrustedEngineDecisionEnvelope,
	opts: PolicyAwareResolveZoneOpts,
	meta: ZoneMetadata,
	family: ZoneId,
	schema: (typeof ZoneSchemas)[ZoneId],
): SourceEvaluation {
	if (!meta.engineComposable) return rejected('zone_not_engine_composable');
	if (opts.policy.decisionMode === 'fixed') return rejected('fixed_policy_rejects_engine');
	if (opts.policy.publicationMode === 'holdout') return rejected('publication_holdout');
	if (opts.policy.publicationMode === 'approval_required') {
		const approvalReason = validateApproval(opts);
		if (approvalReason) return rejected(approvalReason);
	}
	if (!isDecisionEnvelope(decision)) return rejected('invalid_decision_envelope');
	if (decisionAuthority[decision.decisionModeUsed] > decisionAuthority[opts.policy.decisionMode]) {
		return rejected('decision_mode_exceeds_policy');
	}
	if (decision.requiredCapabilityIds.some((capability) => !opts.policy.capabilities.includes(capability))) {
		return rejected('capability_not_allowed');
	}
	const variantReason = validateVariants(decision, opts.policy);
	if (variantReason) return rejected(variantReason);
	const contractResult = validateContractContent(opts.validateDecisionContent, {
		source: 'engine',
		family,
		zoneId: opts.zoneId,
		decisionModeUsed: decision.decisionModeUsed,
		requiredCapabilityIds: decision.requiredCapabilityIds,
		componentVariantId: decision.componentVariantId,
		cssVariantId: decision.cssVariantId,
		copyVariantId: decision.copyVariantId,
		policy: opts.policy,
		rawContent: decision.rawModelContent,
	});
	if (!contractResult.ok) return contractResult;
	const validated = validateForZone(family, contractResult.content, schema, meta);
	if (!validated.ok) return rejected('invalid_zone_content');
	return { ok: true, content: validated.content, trace: { outcome: 'accepted' } };
}

function validateContractContent(
	validator: DecisionContentValidator | undefined,
	input: DecisionContentValidationInput,
): SourceEvaluation {
	if (typeof validator !== 'function') return rejected('contract_validator_missing');
	try {
		const result = validator(input);
		if (result?.ok === true) {
			return { ok: true, content: result.content, trace: { outcome: 'accepted' } };
		}
		const code = isDecisionContentRejectionCode(result?.code)
			? result.code
			: 'invalid_contract_content';
		return rejectedContract(code);
	} catch {
		return rejectedContract('validator_exception');
	}
}

function validatePolicyProvenance(
	policy: EffectiveCompositionPolicy,
	trusted: TrustedCompositionContext,
	family: ZoneId,
	surface: Surface,
): PolicyRejectionReason | undefined {
	if (policy.provenance.kind !== 'compiled') return 'policy_not_compiled';
	if (
		!isNonBlank(trusted.organizationId) ||
		!isNonBlank(trusted.brandId) ||
		!isNonBlank(policy.provenance.organizationPolicyVersion) ||
		!isNonBlank(policy.provenance.brandPolicyVersion) ||
		!isNonBlank(policy.provenance.referenceId) ||
		!isNonBlank(policy.provenance.referenceVersion) ||
		policy.policyVersion !==
			composeEffectivePolicyVersion(
				policy.provenance.organizationPolicyVersion,
				policy.provenance.brandPolicyVersion,
			) ||
		policy.provenance.organizationId !== trusted.organizationId ||
		policy.provenance.brandId !== trusted.brandId ||
		policy.provenance.surface !== surface ||
		policy.provenance.zoneId !== family
	) {
		return 'policy_provenance_mismatch';
	}
	return undefined;
}

function validateApproval(opts: PolicyAwareResolveZoneOpts): PolicyRejectionReason | undefined {
	const approval = opts.trustedContext.approval;
	if (
		approval?.approved !== true ||
		!isNonBlank(approval.approvalId) ||
		!markerMatches(approval, opts) ||
		approval.policyVersion !== opts.policy.policyVersion
	) {
		return 'approval_required';
	}
	return markerReferenceMatches(approval, opts.policy) ? undefined : 'approval_reference_mismatch';
}

function markerMatches(marker: BoundTrustedMarker, opts: PolicyAwareResolveZoneOpts): boolean {
	return (
		marker.organizationId === opts.trustedContext.organizationId &&
		marker.brandId === opts.trustedContext.brandId &&
		marker.surface === opts.trustedContext.surface &&
		marker.zoneId === opts.trustedContext.zoneId
	);
}

function markerReferenceMatches(marker: BoundTrustedMarker, policy: EffectiveCompositionPolicy): boolean {
	return (
		policy.provenance.referenceId !== null &&
		policy.provenance.referenceVersion !== null &&
		marker.referenceId === policy.provenance.referenceId &&
		marker.referenceVersion === policy.provenance.referenceVersion
	);
}

function validateVariants(
	decision: Pick<TrustedEngineDecisionEnvelope, 'componentVariantId' | 'cssVariantId' | 'copyVariantId'>,
	policy: EffectiveCompositionPolicy,
): PolicyRejectionReason | undefined {
	if (!isNonBlank(decision.componentVariantId) || !policy.allowedComponentVariantIds.includes(decision.componentVariantId)) {
		return 'component_variant_not_allowed';
	}
	if (
		decision.cssVariantId !== undefined &&
		(!isNonBlank(decision.cssVariantId) || !policy.allowedCssVariantIds.includes(decision.cssVariantId))
	) {
		return 'css_variant_not_allowed';
	}
	if (
		decision.copyVariantId !== undefined &&
		(!isNonBlank(decision.copyVariantId) || !policy.allowedCopyVariantIds.includes(decision.copyVariantId))
	) {
		return 'copy_variant_not_allowed';
	}
	return undefined;
}

const decisionAuthority: Record<DecisionMode, number> = { fixed: 0, rules: 1, model: 2 };
const decisionModes = new Set<string>(['fixed', 'rules', 'model']);
const decisionContentRejectionCodes = new Set<string>(DECISION_CONTENT_REJECTION_CODES);

function isDecisionEnvelope(value: unknown): value is TrustedEngineDecisionEnvelope {
	if (!value || typeof value !== 'object') return false;
	const candidate = value as Partial<TrustedEngineDecisionEnvelope>;
	return (
		typeof candidate.decisionModeUsed === 'string' &&
		decisionModes.has(candidate.decisionModeUsed) &&
		Array.isArray(candidate.requiredCapabilityIds) &&
		candidate.requiredCapabilityIds.length > 0 &&
		candidate.requiredCapabilityIds.every(isNonBlank) &&
		isNonBlank(candidate.componentVariantId) &&
		'rawModelContent' in candidate
	);
}

function isNonBlank(value: unknown): value is string {
	return typeof value === 'string' && value.trim() !== '';
}

function isDecisionContentRejectionCode(value: unknown): value is DecisionContentRejectionCode {
	return typeof value === 'string' && decisionContentRejectionCodes.has(value);
}

function rejected(reason: PolicyRejectionReason): SourceEvaluation {
	return { ok: false, trace: { outcome: 'rejected', rejectionReason: reason } };
}

function rejectedContract(code: DecisionContentRejectionCode): SourceEvaluation {
	return {
		ok: false,
		trace: {
			outcome: 'rejected',
			rejectionReason: 'contract_validation_failed',
			contractRejectionCode: code,
		},
	};
}

/**
 * Validate raw zone content against the family's schema, accounting for
 * array multiplicity (each array element is validated independently).
 */
function validateForZone(
	_family: ZoneId,
	raw: unknown,
	schema: (typeof ZoneSchemas)[ZoneId],
	meta: ZoneMetadata,
): { ok: true; content: unknown } | { ok: false } {
	if (meta.multiplicity === 'array') {
		if (!Array.isArray(raw)) return { ok: false };
		if (meta.maxItems !== undefined && raw.length > meta.maxItems) return { ok: false };
		const validated: unknown[] = [];
		for (const item of raw) {
			const r = schema.safeParse(item);
			if (!r.success) return { ok: false };
			validated.push(r.data);
		}
		return { ok: true, content: validated };
	}
	const r = schema.safeParse(raw);
	if (!r.success) return { ok: false };
	return { ok: true, content: r.data };
}
