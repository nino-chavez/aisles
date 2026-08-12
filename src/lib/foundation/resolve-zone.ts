/**
 * Zone resolver — legacy and policy-aware precedence cascades.
 *
 *     legacy: raw engine → admin-authored content → static fallback
 *     policy: trusted merchant pin → permitted engine decision → admin → fallback
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
import type {
	AutonomyCapability,
	CompositionPolicyProvenance,
	DecisionMode,
	EffectiveCompositionPolicy,
} from './composition-policy';

export type ZoneSource = 'merchant' | 'engine' | 'admin' | 'fallback';

export type PolicyRejectionReason =
	| 'trusted_identity_mismatch'
	| 'policy_not_compiled'
	| 'policy_provenance_mismatch'
	| 'merchant_override_not_authorized'
	| 'merchant_override_policy_version_mismatch'
	| 'zone_not_merchant_authorable'
	| 'zone_not_engine_composable'
	| 'publication_holdout'
	| 'approval_required'
	| 'invalid_decision_envelope'
	| 'decision_mode_exceeds_policy'
	| 'capability_not_allowed'
	| 'component_variant_not_allowed'
	| 'css_variant_not_allowed'
	| 'copy_variant_not_allowed'
	| 'invalid_zone_content';

export type PolicySourceOutcome = 'accepted' | 'rejected' | 'not_provided' | 'superseded';

export interface PolicySourceTrace {
	outcome: PolicySourceOutcome;
	rejectionReason?: PolicyRejectionReason;
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
	/**
	 * Admin-authored content keyed by instance ID. Always undefined until
	 * an admin app exists — the resolver falls through to the static
	 * fallback whenever this is omitted.
	 */
	adminContent?: { zones?: Record<ZoneInstanceId, unknown> };
}

/**
 * Existing whole-page compatibility. Raw engine content has no policy
 * envelope and must not be used by new callers.
 */
export interface LegacyResolveZoneOpts extends ResolveZoneCommonOpts {
	mode?: 'legacy';
	/** Raw engine content retained only for explicit legacy compatibility. */
	engineOutput?: { zones?: Record<ZoneInstanceId, unknown> };
}

export interface EngineZoneDecision {
	decisionModeUsed: DecisionMode;
	requiredCapabilityIds: readonly AutonomyCapability[];
	componentVariantId: string;
	cssVariantId?: string;
	copyVariantId?: string;
	content: unknown;
}

interface BoundTrustedMarker {
	organizationId: string;
	brandId: string;
	surface: Surface;
	zoneId: ZoneInstanceId;
	policyVersion: string;
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

export interface PolicyAwareResolveZoneOpts extends ResolveZoneCommonOpts {
	mode: 'policy';
	policy: EffectiveCompositionPolicy;
	trustedContext: TrustedCompositionContext;
	engineDecisions?: { zones?: Record<ZoneInstanceId, EngineZoneDecision> };
}

export type ResolveZoneOpts = LegacyResolveZoneOpts | PolicyAwareResolveZoneOpts;

/**
 * Resolve a single zone instance through the three-source cascade.
 *
 * Validates engine and admin content against the zone's Zod schema before
 * accepting it. Invalid content from a source is treated as if the source
 * had no content for that zone — the cascade continues.
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
			outcome: opts.engineDecisions?.zones?.[opts.zoneId] === undefined ? 'not_provided' : 'rejected',
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
				trace.engineDecision = opts.engineDecisions?.zones?.[opts.zoneId]
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

		const engineDecision = opts.engineDecisions?.zones?.[opts.zoneId];
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
		if (opts.engineDecisions?.zones?.[opts.zoneId]) {
			trace.engineDecision = { outcome: 'rejected', rejectionReason: reason };
		}
	}

	// Ordinary admin content remains a separate, lower-priority source. It
	// cannot claim the trusted merchant-pin authority above.
	const adminRaw = opts.adminContent?.zones?.[opts.zoneId];
	if (adminRaw !== undefined && meta.adminAuthorable) {
		const validated = validateForZone(family, adminRaw, schema, meta);
		if (validated.ok) {
			return {
				zoneId: opts.zoneId,
				family,
				index,
				source: 'admin',
				content: validated.content,
				policyTrace: trace,
			};
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
	if (!meta.adminAuthorable) return rejected('zone_not_merchant_authorable');
	const variantReason = validateVariants(override, opts.policy);
	if (variantReason) return rejected(variantReason);
	const validated = validateForZone(family, override.content, schema, meta);
	if (!validated.ok) return rejected('invalid_zone_content');
	return { ok: true, content: validated.content, trace: { outcome: 'accepted' } };
}

function evaluateEngineDecision(
	decision: EngineZoneDecision,
	opts: PolicyAwareResolveZoneOpts,
	meta: ZoneMetadata,
	family: ZoneId,
	schema: (typeof ZoneSchemas)[ZoneId],
): SourceEvaluation {
	if (!meta.engineComposable) return rejected('zone_not_engine_composable');
	if (opts.policy.publicationMode === 'holdout') return rejected('publication_holdout');
	if (opts.policy.publicationMode === 'approval_required' && !hasValidApproval(opts)) {
		return rejected('approval_required');
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
	const validated = validateForZone(family, decision.content, schema, meta);
	if (!validated.ok) return rejected('invalid_zone_content');
	return { ok: true, content: validated.content, trace: { outcome: 'accepted' } };
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
		policy.policyVersion !== policy.provenance.brandPolicyVersion ||
		policy.provenance.organizationId !== trusted.organizationId ||
		policy.provenance.brandId !== trusted.brandId ||
		policy.provenance.surface !== surface ||
		policy.provenance.zoneId !== family
	) {
		return 'policy_provenance_mismatch';
	}
	return undefined;
}

function hasValidApproval(opts: PolicyAwareResolveZoneOpts): boolean {
	const approval = opts.trustedContext.approval;
	return Boolean(
		approval?.approved === true &&
			isNonBlank(approval.approvalId) &&
			markerMatches(approval, opts) &&
			approval.policyVersion === opts.policy.policyVersion,
	);
}

function markerMatches(marker: BoundTrustedMarker, opts: PolicyAwareResolveZoneOpts): boolean {
	return (
		marker.organizationId === opts.trustedContext.organizationId &&
		marker.brandId === opts.trustedContext.brandId &&
		marker.surface === opts.trustedContext.surface &&
		marker.zoneId === opts.trustedContext.zoneId
	);
}

function validateVariants(
	decision: Pick<EngineZoneDecision, 'componentVariantId' | 'cssVariantId' | 'copyVariantId'>,
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

function isDecisionEnvelope(value: unknown): value is EngineZoneDecision {
	if (!value || typeof value !== 'object') return false;
	const candidate = value as Partial<EngineZoneDecision>;
	return (
		typeof candidate.decisionModeUsed === 'string' &&
		decisionModes.has(candidate.decisionModeUsed) &&
		Array.isArray(candidate.requiredCapabilityIds) &&
		candidate.requiredCapabilityIds.length > 0 &&
		candidate.requiredCapabilityIds.every(isNonBlank) &&
		isNonBlank(candidate.componentVariantId) &&
		'content' in candidate
	);
}

function isNonBlank(value: unknown): value is string {
	return typeof value === 'string' && value.trim() !== '';
}

function rejected(reason: PolicyRejectionReason): SourceEvaluation {
	return { ok: false, trace: { outcome: 'rejected', rejectionReason: reason } };
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
