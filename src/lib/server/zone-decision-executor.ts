/** Strict, identity-bound and provider-free zone decision execution seam. */

import { isCompiledTrustedZonePolicy, type DecisionMode, type EffectiveCompositionPolicy, type PublicationMode } from '$lib/foundation/composition-policy';
import { tryNormalizeTrustedErrorRoute, tryNormalizeTrustedShopperRoute } from '$lib/foundation/autonomy-zone-route';
import { ZONE_CATALOG } from '$lib/foundation/zone-catalog';
import { findTrustedZoneIdentity, isAislesRendererIdentity, type TrustedZoneIdentityDefinition } from '$lib/foundation/trusted-zone-identity';
import {
	createZoneDecisionContract,
	materializeTrustedZoneDecision,
	type GenerativeZoneDecisionContract,
	type MaterializedTrustedZoneDecision,
	type TrustedZoneFieldCatalog,
} from '$lib/foundation/zone-decision-schema';
import { parseZoneContent, type AnyZoneContent } from '$lib/foundation/zone-schemas';
import { ZONES, type Surface } from '$lib/foundation/zones';

export interface TrustedZoneExecutionIdentity {
	organizationId: string;
	brandId: string;
	referenceId: string;
	referenceVersion: string;
	policyVersion: string;
	routeSource: 'pathname' | 'error-state';
	routePath: string;
	surface: Surface;
	routeManifestVersion: string;
	routeManifestDigest: string;
	zoneOrigin: 'aisles' | 'bealls-aisles';
	/** Family selects its schema; it is never inferred from an indexed instance. */
	familyId: string;
	/** Exact reviewed instance identity, including an index where the catalog has one. */
	instanceId: string;
	productCatalogId: string;
	productCatalogVersion: string;
	allowedDecisionModes: readonly DecisionMode[];
}

export interface TrustedBoundProductCatalog {
	organizationId: string;
	brandId: string;
	referenceId: string;
	referenceVersion: string;
	catalogId: string;
	catalogVersion: string;
	productIds: readonly string[];
}

export interface TrustedZoneMaterializationInput {
	kind: 'fixed' | 'rules' | 'model';
	fixed: TrustedZoneFieldCatalog['fixed'];
	decision?: MaterializedTrustedZoneDecision;
}

export interface TrustedBoundZoneCatalog {
	identity: TrustedZoneExecutionIdentity;
	fields: TrustedZoneFieldCatalog;
	products: TrustedBoundProductCatalog;
	/** Server-owned variant-to-renderer adapter. Its result is still schema and product checked. */
	materialize(input: TrustedZoneMaterializationInput): unknown;
}

export type TrustedZoneFallback = {
	identity: TrustedZoneExecutionIdentity;
} & ({ kind: 'hidden' } | { kind: 'content'; content: unknown });

export interface ZoneRulesRunner {
	(contract: GenerativeZoneDecisionContract): unknown;
}

export interface ZoneModelRunner {
	/** Model-facing authority is the strict derived schema and nothing else. */
	(contract: Pick<GenerativeZoneDecisionContract, 'outputSchema'>): Promise<unknown>;
}

export type ZoneExecutionFailureReason =
	| 'policy_not_zone_scoped'
	| 'identity_mismatch'
	| 'route_surface_mismatch'
	| 'surface_zone_mismatch'
	| 'decision_mode_not_approved'
	| 'live_model_not_approved'
	| 'fixed_only_zone'
	| 'product_catalog_mismatch'
	| 'invalid_contract'
	| 'runner_unavailable'
	| 'rules_runner_failed'
	| 'provider_failed'
	| 'invalid_output'
	| 'materialization_failed'
	| 'invalid_renderer_content'
	| 'untrusted_product_reference';

export interface ZoneExecutionProvenance {
	organizationId: string;
	brandId: string;
	referenceId: string;
	referenceVersion: string;
	policyVersion: string;
	productCatalogId: string;
	productCatalogVersion: string;
	routeSource: 'pathname' | 'error-state';
	routePath: string;
	surface: Surface;
	routeManifestVersion: string;
	routeManifestDigest: string;
	zoneOrigin: 'aisles' | 'bealls-aisles';
	familyId: string;
	instanceId: string;
	decisionMode: DecisionMode;
	publicationMode: PublicationMode;
	liveModelApproved: boolean;
}

export type TrustedZoneRenderResult =
	| { kind: 'hidden' }
	| { kind: 'content'; content: AnyZoneContent | AnyZoneContent[] };

export interface ZoneCandidate {
	decisionMode: DecisionMode;
	render: TrustedZoneRenderResult;
	decision?: MaterializedTrustedZoneDecision;
}

export type ZoneDecisionExecution =
	| { status: 'live'; render: TrustedZoneRenderResult; decisionMode: DecisionMode; decision?: MaterializedTrustedZoneDecision; provenance: ZoneExecutionProvenance }
	| { status: 'held'; gate: 'holdout'; candidate: ZoneCandidate; render: TrustedZoneRenderResult; provenance: ZoneExecutionProvenance }
	| { status: 'approval_candidate'; gate: 'approval_required'; candidate: ZoneCandidate; render: TrustedZoneRenderResult; provenance: ZoneExecutionProvenance }
	| { status: 'fallback'; reason: ZoneExecutionFailureReason; render: TrustedZoneRenderResult; provenance: ZoneExecutionProvenance };

export async function executeZoneDecision(input: {
	policy: EffectiveCompositionPolicy;
	catalog: TrustedBoundZoneCatalog;
	fallback: TrustedZoneFallback;
	runRules?: ZoneRulesRunner;
	runModel?: ZoneModelRunner;
}): Promise<ZoneDecisionExecution> {
	const provenance = provenanceFrom(input.catalog.identity, input.policy);
	const identityDefinition = findTrustedZoneIdentity(
		input.catalog.identity.zoneOrigin,
		input.catalog.identity.familyId,
		input.catalog.identity.instanceId,
	);
	const bindingFailure = validateBindings(input.policy, input.catalog, input.fallback, identityDefinition);
	const fallback = bindingFailure || !identityDefinition || !isAislesRendererIdentity(identityDefinition)
		? { kind: 'hidden' as const }
		: normalizeFallback(input.fallback, input.catalog, identityDefinition);
	if (bindingFailure) return failure(bindingFailure, fallback, provenance);
	/** The generic Aisles renderer has no reviewed schema for this Bealls-only instance. */
	if (!identityDefinition || !isAislesRendererIdentity(identityDefinition)) {
		return { status: 'live', render: { kind: 'hidden' }, decisionMode: 'fixed', provenance };
	}

	let contract;
	try {
		contract = createZoneDecisionContract(input.policy, input.catalog.fields);
	} catch {
		return failure('invalid_contract', fallback, provenance);
	}

	if (contract.kind === 'fixed') {
		return finishMaterialization({ kind: 'fixed', fixed: contract.fixed }, input, fallback, provenance, identityDefinition);
	}

	let decision: MaterializedTrustedZoneDecision;
	if (contract.kind === 'rules') {
		if (!input.runRules) return failure('runner_unavailable', fallback, provenance);
		let output: unknown;
		try {
			output = input.runRules(contract);
		} catch {
			return failure('rules_runner_failed', fallback, provenance);
		}
		try {
			decision = materializeTrustedZoneDecision(contract, output);
		} catch {
			return failure('invalid_output', fallback, provenance);
		}
	} else {
		if (!input.runModel) return failure('runner_unavailable', fallback, provenance);
		let output: unknown;
		try {
			output = await input.runModel({ outputSchema: contract.outputSchema });
		} catch {
			return failure('provider_failed', fallback, provenance);
		}
		try {
			decision = materializeTrustedZoneDecision(contract, output);
		} catch {
			return failure('invalid_output', fallback, provenance);
		}
	}

	return finishMaterialization(
		{ kind: contract.kind, fixed: contract.fixed, decision },
		input,
		fallback,
		provenance,
		identityDefinition,
	);
}

function finishMaterialization(
	materializationInput: TrustedZoneMaterializationInput,
	input: { policy: EffectiveCompositionPolicy; catalog: TrustedBoundZoneCatalog },
	fallback: TrustedZoneRenderResult,
	provenance: ZoneExecutionProvenance,
	identityDefinition: TrustedZoneIdentityDefinition,
): ZoneDecisionExecution {
	let rawContent: unknown;
	try {
		rawContent = input.catalog.materialize(materializationInput);
	} catch {
		return failure('materialization_failed', fallback, provenance);
	}
	if (!isAislesRendererIdentity(identityDefinition)) return failure('surface_zone_mismatch', { kind: 'hidden' }, provenance);
	const parsed = parseZoneContent(identityDefinition.familyId, rawContent);
	if (!parsed.ok) return failure('invalid_renderer_content', fallback, provenance);
	const authorizedProducts = materializationProductIds(materializationInput);
	if (parsed.productIds.some((productId) => !authorizedProducts.includes(productId))) {
		return failure('untrusted_product_reference', fallback, provenance);
	}
	const render = parsed.content === null
		? { kind: 'hidden' as const }
		: { kind: 'content' as const, content: parsed.content };
	const candidate: ZoneCandidate = {
		decisionMode: materializationInput.kind,
		render,
		...(materializationInput.decision === undefined ? {} : { decision: materializationInput.decision }),
	};
	if (input.policy.publicationMode === 'holdout') {
		return { status: 'held', gate: 'holdout', candidate, render: fallback, provenance };
	}
	if (input.policy.publicationMode === 'approval_required') {
		return { status: 'approval_candidate', gate: 'approval_required', candidate, render: fallback, provenance };
	}
	return {
		status: 'live',
		render,
		decisionMode: materializationInput.kind,
		...(materializationInput.decision === undefined ? {} : { decision: materializationInput.decision }),
		provenance,
	};
}

function validateBindings(
	policy: EffectiveCompositionPolicy,
	catalog: TrustedBoundZoneCatalog,
	fallback: TrustedZoneFallback,
	identityDefinition: TrustedZoneIdentityDefinition | null,
): ZoneExecutionFailureReason | null {
	const identity = catalog.identity;
	const policyBinding = policy.provenance.zoneBinding;
	const normalizedRoute = identity.routeSource === 'pathname'
		? tryNormalizeTrustedShopperRoute(identity.routePath)
		: identity.routeSource === 'error-state'
			? tryNormalizeTrustedErrorRoute(identity.routePath, identity.surface)
			: null;
	if (!normalizedRoute || normalizedRoute.surface !== identity.surface ||
		normalizedRoute.routeManifestVersion !== identity.routeManifestVersion ||
		normalizedRoute.routeManifestDigest !== identity.routeManifestDigest) return 'route_surface_mismatch';
	if (!identityDefinition || identityDefinition.surface !== identity.surface || policy.provenance.surface !== identity.surface) {
		return 'surface_zone_mismatch';
	}
	if (policy.provenance.zoneId === null) return 'policy_not_zone_scoped';
	if (
		!isCompiledTrustedZonePolicy(policy) ||
		policy.provenance.kind !== 'compiled' ||
		!policyBinding ||
		![identity.organizationId, identity.brandId, identity.referenceId, identity.referenceVersion, identity.policyVersion, identity.routePath].every(isNonBlank) ||
		policy.policyVersion !== identity.policyVersion ||
		policy.provenance.organizationId !== identity.organizationId ||
		policy.provenance.brandId !== identity.brandId ||
		policy.provenance.referenceId !== identity.referenceId ||
		policy.provenance.referenceVersion !== identity.referenceVersion ||
		policyBinding.zoneOrigin !== identity.zoneOrigin ||
		policyBinding.familyId !== identity.familyId ||
		policyBinding.instanceId !== identity.instanceId ||
		policyBinding.rendererContract !== identityDefinition.rendererContract ||
		policyBinding.routeSource !== identity.routeSource ||
		policyBinding.routePath !== identity.routePath ||
		policyBinding.routeManifestVersion !== identity.routeManifestVersion ||
		policyBinding.routeManifestDigest !== identity.routeManifestDigest ||
		!sameDecisionModes(policyBinding.allowedDecisionModes, identity.allowedDecisionModes) ||
		!sameIdentity(fallback.identity, identity)
	) return 'identity_mismatch';
	if (policy.provenance.zoneId !== identity.familyId) return 'identity_mismatch';
	const products = catalog.products;
	if (
		![products.catalogId, products.catalogVersion].every(isNonBlank) ||
		products.organizationId !== identity.organizationId ||
		products.brandId !== identity.brandId ||
		products.referenceId !== identity.referenceId ||
		products.referenceVersion !== identity.referenceVersion ||
		products.catalogId !== identity.productCatalogId ||
		products.catalogVersion !== identity.productCatalogVersion ||
		new Set(products.productIds).size !== products.productIds.length ||
		products.productIds.some((productId) => !isSafeId(productId)) ||
		catalog.fields.registeredProductIds.some((productId) => !products.productIds.includes(productId)) ||
		catalog.fields.allowedProductIds.some((productId) => !products.productIds.includes(productId))
	) return 'product_catalog_mismatch';
	if (
		!Array.isArray(identity.allowedDecisionModes) ||
		new Set(identity.allowedDecisionModes).size !== identity.allowedDecisionModes.length ||
		identity.allowedDecisionModes.some((mode) => !['fixed', 'rules', 'model'].includes(mode)) ||
		!identity.allowedDecisionModes.includes(policy.decisionMode)
	) return 'decision_mode_not_approved';
	if (policy.decisionMode === 'model' && policy.publicationMode === 'live' && !liveModelApprovedFor(identity.familyId)) {
		return 'live_model_not_approved';
	}
	if (isAislesRendererIdentity(identityDefinition) && policy.decisionMode !== 'fixed' && !ZONES[identityDefinition.familyId].engineComposable) return 'fixed_only_zone';
	return null;
}

function normalizeFallback(
	fallback: TrustedZoneFallback,
	catalog: TrustedBoundZoneCatalog,
	identityDefinition: TrustedZoneIdentityDefinition,
): TrustedZoneRenderResult {
	if (!sameIdentity(fallback.identity, catalog.identity) || fallback.kind === 'hidden') return { kind: 'hidden' };
	if (!isAislesRendererIdentity(identityDefinition)) return { kind: 'hidden' };
	const parsed = parseZoneContent(identityDefinition.familyId, fallback.content);
	if (!parsed.ok || parsed.content === null) return { kind: 'hidden' };
	if (parsed.productIds.some((productId) => !catalog.products.productIds.includes(productId))) return { kind: 'hidden' };
	return { kind: 'content', content: parsed.content };
}

function materializationProductIds(input: TrustedZoneMaterializationInput): readonly string[] {
	const output = input.decision?.envelope.rawModelContent;
	if (output && typeof output === 'object') {
		const candidate = output as Record<string, unknown>;
		if (Array.isArray(candidate.rankedProductIds)) return candidate.rankedProductIds.filter(isString);
		if (Array.isArray(candidate.productIds)) return candidate.productIds.filter(isString);
	}
	return input.fixed.productIds ?? [];
}

function provenanceFrom(identity: TrustedZoneExecutionIdentity, policy: EffectiveCompositionPolicy): ZoneExecutionProvenance {
	return {
		organizationId: identity.organizationId,
		brandId: identity.brandId,
		referenceId: identity.referenceId,
		referenceVersion: identity.referenceVersion,
		policyVersion: identity.policyVersion,
		productCatalogId: identity.productCatalogId,
		productCatalogVersion: identity.productCatalogVersion,
		routeSource: identity.routeSource,
		routePath: identity.routePath,
		surface: identity.surface,
		routeManifestVersion: identity.routeManifestVersion,
		routeManifestDigest: identity.routeManifestDigest,
		zoneOrigin: identity.zoneOrigin,
		familyId: identity.familyId,
		instanceId: identity.instanceId,
		decisionMode: policy.decisionMode,
		publicationMode: policy.publicationMode,
		liveModelApproved: liveModelApprovedFor(identity.familyId),
	};
}

function sameIdentity(left: TrustedZoneExecutionIdentity, right: TrustedZoneExecutionIdentity): boolean {
	if (!Array.isArray(left.allowedDecisionModes) || !Array.isArray(right.allowedDecisionModes)) return false;
	return left.organizationId === right.organizationId &&
		left.brandId === right.brandId &&
		left.referenceId === right.referenceId &&
		left.referenceVersion === right.referenceVersion &&
		left.policyVersion === right.policyVersion &&
		left.routeSource === right.routeSource &&
		left.routePath === right.routePath &&
		left.surface === right.surface &&
		left.routeManifestVersion === right.routeManifestVersion &&
		left.routeManifestDigest === right.routeManifestDigest &&
		left.zoneOrigin === right.zoneOrigin &&
		left.familyId === right.familyId &&
		left.instanceId === right.instanceId &&
		left.productCatalogId === right.productCatalogId &&
		left.productCatalogVersion === right.productCatalogVersion &&
		left.allowedDecisionModes.length === right.allowedDecisionModes.length &&
		left.allowedDecisionModes.every((mode) => right.allowedDecisionModes.includes(mode));
}

function failure(
	reason: ZoneExecutionFailureReason,
	render: TrustedZoneRenderResult,
	provenance: ZoneExecutionProvenance,
): ZoneDecisionExecution {
	return { status: 'fallback', reason, render, provenance };
}

function isString(value: unknown): value is string {
	return typeof value === 'string';
}

function isNonBlank(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}

function isSafeId(value: unknown): value is string {
	return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value);
}

function sameDecisionModes(left: readonly DecisionMode[], right: readonly DecisionMode[]): boolean {
	return left.length === right.length && left.every((mode, index) => mode === right[index]);
}

function liveModelApprovedFor(zoneId: string): boolean {
	return Object.prototype.hasOwnProperty.call(ZONE_CATALOG, zoneId) && ZONE_CATALOG[zoneId].liveModelApproved;
}
