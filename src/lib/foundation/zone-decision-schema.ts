/**
 * Bounded zone-decision contract.
 *
 * This is the narrow boundary between a compiled autonomy policy and a
 * structured-output model call. The model only sees fields whose capability
 * is permitted and whose values are registered by a trusted reference
 * contract. Identity, policy version, publication state, and required
 * capability IDs are deliberately server-owned.
 */

import { Output } from 'ai';
import { z } from 'zod';
import type { AutonomyCapability, DecisionMode, EffectiveCompositionPolicy, PublicationMode } from './composition-policy';
import type { TrustedEngineDecisionEnvelope } from './resolve-zone';

export const COPY_SOURCE_CLASSES = [
	'reference-copy',
	'merchant-catalog',
	'merchant-policy',
	'computed-fact',
] as const;

export type CopySourceClass = (typeof COPY_SOURCE_CLASSES)[number];

export interface BoundedCopyField {
	/** A field key, never a dotted object path or an unbounded prop bag. */
	key: string;
	maxLength: number;
	sourceClasses: readonly CopySourceClass[];
}

/** A reference-authorized component configuration; CSS never varies independently. */
export interface TrustedCompleteComponentVariant {
	componentVariantId: string;
	cssVariantId?: string;
	compatibleCopyVariantIds: readonly string[];
}

/**
 * Trusted, contract-authored vocabulary for one zone. Nothing in this type
 * comes from browser input or from model output.
 */
export interface TrustedZoneFieldCatalog {
	registeredComponentVariantIds: readonly string[];
	registeredCssVariantIds: readonly string[];
	registeredCopyVariantIds: readonly string[];
	registeredRecipeIds: readonly string[];
	registeredProductIds: readonly string[];
	registeredPlacementIds: readonly string[];
	completeComponentVariants: readonly TrustedCompleteComponentVariant[];
	/** Additional per-zone policy bounds for values the current policy type does not own. */
	allowedRecipeIds: readonly string[];
	allowedProductIds: readonly string[];
	allowedPlacementIds: readonly string[];
	boundedCopyFields: readonly BoundedCopyField[];
	/**
	 * The reference-owned baseline used when a permitted field is absent.
	 * These are not model choices and are validated against the same registry.
	 */
	fixed: {
		componentVariantId: string;
		copyVariantId?: string;
		recipeId?: string;
		productIds?: readonly string[];
		placementId?: string;
	};
}

export class ZoneDecisionSchemaError extends Error {
	constructor(message: string) {
		super(`zone decision schema: ${message}`);
		this.name = 'ZoneDecisionSchemaError';
	}
}

interface ZoneDecisionMetadata {
	decisionMode: Exclude<DecisionMode, 'fixed'>;
	publicationMode: PublicationMode;
	policyVersion: string;
}

export interface FixedZoneDecisionContract {
	kind: 'fixed';
	decisionMode: 'fixed';
	publicationMode: PublicationMode;
	policyVersion: string;
	fixed: TrustedZoneFieldCatalog['fixed'];
}

export interface GenerativeZoneDecisionContract extends ZoneDecisionMetadata {
	kind: 'rules' | 'model';
	/** Strict Zod schema passed to AI SDK v6 Output.object for model mode. */
	outputSchema: z.ZodType<Record<string, unknown>>;
	/** Server-side candidate sets, used when materializing a parsed decision. */
	allowed: {
		componentVariantIds: readonly string[];
		completeComponentVariants: readonly TrustedCompleteComponentVariant[];
		copyVariantIds: readonly string[];
		recipeIds: readonly string[];
		productIds: readonly string[];
		placementIds: readonly string[];
		boundedCopyFields: readonly BoundedCopyField[];
	};
	fixed: TrustedZoneFieldCatalog['fixed'];
}

export type ZoneDecisionContract = FixedZoneDecisionContract | GenerativeZoneDecisionContract;

export interface MaterializedTrustedZoneDecision {
	envelope: TrustedEngineDecisionEnvelope;
	publicationMode: PublicationMode;
	policyVersion: string;
}

/**
 * Builds the only shape a rules engine or model may emit for a zone.
 * A fixed policy intentionally yields no schema and cannot initiate a model
 * call. Rules still use the exact same output vocabulary, but their mode is
 * truthfully retained when the server materializes the envelope.
 */
export function createZoneDecisionContract(
	policy: EffectiveCompositionPolicy,
	catalog: TrustedZoneFieldCatalog,
): ZoneDecisionContract {
	validateCatalog(catalog);
	const completeComponentVariants = eligibleCompleteVariants(catalog, policy);
	const allowed = {
		componentVariantIds: completeComponentVariants.map(({ componentVariantId }) => componentVariantId),
		completeComponentVariants,
		copyVariantIds: intersect(catalog.registeredCopyVariantIds, policy.allowedCopyVariantIds),
		recipeIds: intersect(catalog.registeredRecipeIds, catalog.allowedRecipeIds),
		productIds: intersect(catalog.registeredProductIds, catalog.allowedProductIds),
		placementIds: intersect(catalog.registeredPlacementIds, catalog.allowedPlacementIds),
		boundedCopyFields: catalog.boundedCopyFields.map((field) => ({ ...field, sourceClasses: [...field.sourceClasses] })),
	};
	validateFixed(catalog.fixed, allowed);

	if (policy.decisionMode === 'fixed') {
		return {
			kind: 'fixed',
			decisionMode: 'fixed',
			publicationMode: policy.publicationMode,
			policyVersion: policy.policyVersion,
			fixed: cloneFixed(catalog.fixed),
		};
	}

	const shape: Record<string, z.ZodType> = {};
	if (policy.capabilities.includes('select_component_variant') && allowed.componentVariantIds.length > 0) {
		shape.componentVariantId = enumFor(allowed.componentVariantIds).optional();
	}
	if (policy.capabilities.includes('select_copy_variant') && allowed.copyVariantIds.length > 0) {
		shape.copyVariantId = enumFor(allowed.copyVariantIds).optional();
	}
	if (policy.capabilities.includes('select_page_recipe') && allowed.recipeIds.length > 0) {
		shape.recipeId = enumFor(allowed.recipeIds).optional();
	}
	if (policy.capabilities.includes('select_products') && allowed.productIds.length > 0) {
		shape.productIds = uniqueIdArray(allowed.productIds).optional();
	}
	if (policy.capabilities.includes('rank_products') && allowed.productIds.length > 0) {
		shape.rankedProductIds = uniqueIdArray(allowed.productIds).optional();
	}
	if (policy.capabilities.includes('toggle_zone')) {
		shape.visible = z.boolean().optional();
	}
	if (policy.capabilities.includes('reorder_zones') && allowed.placementIds.length > 0) {
		shape.placementId = enumFor(allowed.placementIds).optional();
	}
	if (policy.capabilities.includes('generate_bounded_copy') && allowed.boundedCopyFields.length > 0) {
		const copyShape: Record<string, z.ZodType> = {};
		for (const field of allowed.boundedCopyFields) {
			copyShape[field.key] = z.string().trim().min(1).max(field.maxLength).optional();
		}
		shape.boundedCopy = z.object(copyShape).strict().superRefine((copy, ctx) => {
			if (Object.keys(copy).length === 0) {
				ctx.addIssue({ code: 'custom', message: 'boundedCopy must contain at least one approved field' });
			}
		}).optional();
	}

	if (Object.keys(shape).length === 0) {
		throw new ZoneDecisionSchemaError(
			`${policy.decisionMode} policy has no eligible, contract-registered fields; do not call a model`,
		);
	}

	const outputSchema = z
		.object(shape)
		.strict()
		.superRefine((value, ctx) => {
			if (Object.keys(value).length === 0) {
				ctx.addIssue({ code: 'custom', message: 'at least one permitted decision field is required' });
			}
			const componentVariantId = readOptionalString(value, 'componentVariantId') ?? catalog.fixed.componentVariantId;
			const completeVariant = allowed.completeComponentVariants.find(
				(binding) => binding.componentVariantId === componentVariantId,
			);
			const copyVariantId = readOptionalString(value, 'copyVariantId');
			if (copyVariantId !== undefined && !completeVariant?.compatibleCopyVariantIds.includes(copyVariantId)) {
				ctx.addIssue({ code: 'custom', message: 'copy variant is not compatible with the selected complete component variant' });
			}
			validateProductDecision(value, allowed.productIds, policy.capabilities, ctx);
		}) as unknown as z.ZodType<Record<string, unknown>>;

	return {
		kind: policy.decisionMode,
		decisionMode: policy.decisionMode,
		publicationMode: policy.publicationMode,
		policyVersion: policy.policyVersion,
		outputSchema,
		allowed,
		fixed: cloneFixed(catalog.fixed),
	};
}

/**
 * The AI SDK v6 consumer shape. Callers use this as
 * `generateText({ model, output: aiSdkObjectOutput(contract), prompt })`.
 * This module deliberately does not select a model or make a network call.
 */
export function aiSdkObjectOutput(contract: GenerativeZoneDecisionContract) {
	if (contract.kind !== 'model') {
		throw new ZoneDecisionSchemaError('rules decisions are server-executed and must not initiate a model call');
	}
	return Output.object({ schema: contract.outputSchema });
}

/**
 * Parse structured output and construct the resolver's trusted envelope.
 * Authority fields are calculated from known field presence, never accepted
 * from the parsed JSON.
 */
export function materializeTrustedZoneDecision(
	contract: GenerativeZoneDecisionContract,
	modelOutput: unknown,
): MaterializedTrustedZoneDecision {
	const parsed = contract.outputSchema.safeParse(modelOutput);
	if (!parsed.success) {
		throw new ZoneDecisionSchemaError(`invalid structured output: ${parsed.error.issues[0]?.message ?? 'unknown error'}`);
	}
	const output = parsed.data;
	const requiredCapabilityIds = deriveRequiredCapabilities(output);
	if (requiredCapabilityIds.length === 0) {
		throw new ZoneDecisionSchemaError('structured output did not make a permitted decision');
	}

	const componentVariantId = readOptionalString(output, 'componentVariantId') ?? contract.fixed.componentVariantId;
	const completeVariant = contract.allowed.completeComponentVariants.find(
		(binding) => binding.componentVariantId === componentVariantId,
	);
	if (!completeVariant) throw new ZoneDecisionSchemaError(`component variant "${componentVariantId}" has no trusted complete binding`);
	const cssVariantId = completeVariant.cssVariantId;
	const copyVariantId = readOptionalString(output, 'copyVariantId') ?? contract.fixed.copyVariantId;
	assertChoice(componentVariantId, contract.allowed.componentVariantIds, 'component variant');
	if (copyVariantId !== undefined && !completeVariant.compatibleCopyVariantIds.includes(copyVariantId)) {
		throw new ZoneDecisionSchemaError(`copy variant "${copyVariantId}" is not compatible with component variant "${componentVariantId}"`);
	}

	return {
		envelope: {
			decisionModeUsed: contract.decisionMode,
			requiredCapabilityIds,
			componentVariantId,
			...(cssVariantId === undefined ? {} : { cssVariantId }),
			...(copyVariantId === undefined ? {} : { copyVariantId }),
			// The downstream reference validator receives only the parsed,
			// strict vocabulary; unknown keys never make it past this boundary.
			rawModelContent: output,
		},
		publicationMode: contract.publicationMode,
		policyVersion: contract.policyVersion,
	};
}

function deriveRequiredCapabilities(output: Record<string, unknown>): AutonomyCapability[] {
	const capabilities = new Set<AutonomyCapability>();
	if (hasOwn(output, 'componentVariantId')) capabilities.add('select_component_variant');
	if (hasOwn(output, 'copyVariantId')) capabilities.add('select_copy_variant');
	if (hasOwn(output, 'recipeId')) capabilities.add('select_page_recipe');
	if (hasOwn(output, 'productIds')) capabilities.add('select_products');
	if (hasOwn(output, 'rankedProductIds')) capabilities.add('rank_products');
	if (hasOwn(output, 'visible')) capabilities.add('toggle_zone');
	if (hasOwn(output, 'placementId')) capabilities.add('reorder_zones');
	if (hasOwn(output, 'boundedCopy')) capabilities.add('generate_bounded_copy');
	return [...capabilities];
}

function validateCatalog(catalog: TrustedZoneFieldCatalog): void {
	assertIds(catalog.registeredComponentVariantIds, 'registered component variants');
	assertIds(catalog.registeredCssVariantIds, 'registered CSS variants');
	assertIds(catalog.registeredCopyVariantIds, 'registered copy variants');
	assertIds(catalog.registeredRecipeIds, 'registered recipes');
	assertIds(catalog.registeredProductIds, 'registered products');
	assertIds(catalog.registeredPlacementIds, 'registered placements');
	validateCompleteComponentVariants(catalog);
	assertIds(catalog.allowedRecipeIds, 'allowed recipes');
	assertIds(catalog.allowedProductIds, 'allowed products');
	assertIds(catalog.allowedPlacementIds, 'allowed placements');
	for (const field of catalog.boundedCopyFields) {
		if (!isSafeCopyKey(field.key)) throw new ZoneDecisionSchemaError(`invalid bounded copy key "${field.key}"`);
		if (!Number.isInteger(field.maxLength) || field.maxLength < 1) {
			throw new ZoneDecisionSchemaError(`bounded copy field "${field.key}" needs a positive integer maxLength`);
		}
		if (field.sourceClasses.length === 0 || field.sourceClasses.some((source) => !COPY_SOURCE_CLASSES.includes(source))) {
			throw new ZoneDecisionSchemaError(`bounded copy field "${field.key}" needs registered source classes`);
		}
	}
	if (new Set(catalog.boundedCopyFields.map(({ key }) => key)).size !== catalog.boundedCopyFields.length) {
		throw new ZoneDecisionSchemaError('bounded copy field keys must be unique');
	}
}

function validateCompleteComponentVariants(catalog: TrustedZoneFieldCatalog): void {
	if (catalog.completeComponentVariants.length === 0) {
		throw new ZoneDecisionSchemaError('at least one trusted complete component variant is required');
	}
	const componentIds = catalog.completeComponentVariants.map(({ componentVariantId }) => componentVariantId);
	assertIds(componentIds, 'complete component variant identifiers');
	for (const binding of catalog.completeComponentVariants) {
		assertChoice(binding.componentVariantId, catalog.registeredComponentVariantIds, 'complete component variant');
		if (binding.cssVariantId !== undefined) {
			assertChoice(binding.cssVariantId, catalog.registeredCssVariantIds, 'complete component CSS variant');
		}
		assertIds(binding.compatibleCopyVariantIds, 'complete component compatible copy variants');
		for (const copyVariantId of binding.compatibleCopyVariantIds) {
			assertChoice(copyVariantId, catalog.registeredCopyVariantIds, 'complete component copy variant');
		}
	}
}

function eligibleCompleteVariants(
	catalog: TrustedZoneFieldCatalog,
	policy: EffectiveCompositionPolicy,
): TrustedCompleteComponentVariant[] {
	const componentSet = new Set(intersect(catalog.registeredComponentVariantIds, policy.allowedComponentVariantIds));
	const cssSet = new Set(intersect(catalog.registeredCssVariantIds, policy.allowedCssVariantIds));
	const copySet = new Set(intersect(catalog.registeredCopyVariantIds, policy.allowedCopyVariantIds));
	return catalog.completeComponentVariants
		.filter((binding) => componentSet.has(binding.componentVariantId))
		.filter((binding) => binding.cssVariantId === undefined || cssSet.has(binding.cssVariantId))
		.map((binding) => ({
			componentVariantId: binding.componentVariantId,
			...(binding.cssVariantId === undefined ? {} : { cssVariantId: binding.cssVariantId }),
			compatibleCopyVariantIds: binding.compatibleCopyVariantIds.filter((copyVariantId) => copySet.has(copyVariantId)),
		}));
}

function validateProductDecision(
	value: Record<string, unknown>,
	allowedProductIds: readonly string[],
	capabilities: readonly AutonomyCapability[],
	ctx: z.RefinementCtx,
): void {
	const ranked = value.rankedProductIds;
	if (!Array.isArray(ranked)) return;
	const selected = value.productIds;
	const selectionAllowed = capabilities.includes('select_products');
	const expected = Array.isArray(selected) && selectionAllowed ? selected : allowedProductIds;
	if (!sameSet(ranked, expected)) {
		ctx.addIssue({
			code: 'custom',
			message: selectionAllowed
				? 'ranked products must be an exact ordering of the selected products or the trusted full rankable set'
				: 'rank-only output must be an exact permutation of the trusted rankable set',
		});
	}
}

function validateFixed(
	fixed: TrustedZoneFieldCatalog['fixed'],
	allowed: GenerativeZoneDecisionContract['allowed'],
): void {
	assertChoice(fixed.componentVariantId, allowed.componentVariantIds, 'fixed component variant');
	const completeVariant = allowed.completeComponentVariants.find((binding) => binding.componentVariantId === fixed.componentVariantId);
	if (!completeVariant) throw new ZoneDecisionSchemaError(`fixed component variant "${fixed.componentVariantId}" has no complete binding`);
	if (fixed.copyVariantId !== undefined && !completeVariant.compatibleCopyVariantIds.includes(fixed.copyVariantId)) {
		throw new ZoneDecisionSchemaError('fixed copy variant is not compatible with the fixed component variant');
	}
	if (fixed.recipeId !== undefined) assertChoice(fixed.recipeId, allowed.recipeIds, 'fixed recipe');
	for (const productId of fixed.productIds ?? []) assertChoice(productId, allowed.productIds, 'fixed product');
	if (fixed.placementId !== undefined) assertChoice(fixed.placementId, allowed.placementIds, 'fixed placement');
}

function assertChoice(value: string, choices: readonly string[], label: string): void {
	if (!choices.includes(value)) throw new ZoneDecisionSchemaError(`${label} "${value}" is not a registered, allowed value`);
}

function assertIds(ids: readonly string[], label: string): void {
	if (new Set(ids).size !== ids.length) throw new ZoneDecisionSchemaError(`${label} must be unique`);
	for (const id of ids) {
		if (!isSafeIdentifier(id)) throw new ZoneDecisionSchemaError(`${label} contain an unsafe identifier`);
	}
}

function isSafeIdentifier(value: unknown): value is string {
	if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value)) return false;
	return !value.split(/[._:-]/).some((segment) => segment === '__proto__' || segment === 'prototype' || segment === 'constructor');
}

function isSafeCopyKey(value: unknown): value is string {
	return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_-]*$/.test(value) && !['__proto__', 'prototype', 'constructor'].includes(value);
}

function enumFor(values: readonly string[]) {
	if (values.length === 0) throw new ZoneDecisionSchemaError('cannot make an enum with no allowed values');
	return z.enum(values as [string, ...string[]]);
}

function uniqueIdArray(values: readonly string[]) {
	return z.array(enumFor(values)).min(1).max(12).superRefine((items, ctx) => {
		if (new Set(items).size !== items.length) {
			ctx.addIssue({ code: 'custom', message: 'identifier arrays must not contain duplicates' });
		}
	});
}

function sameSet(values: readonly unknown[], expected: readonly string[]): boolean {
	return values.length === expected.length && values.every((value) => typeof value === 'string' && expected.includes(value));
}

function intersect(registered: readonly string[], allowed: readonly string[]): string[] {
	const allowedSet = new Set(allowed);
	return [...new Set(registered)].filter((value) => allowedSet.has(value));
}

function cloneFixed(fixed: TrustedZoneFieldCatalog['fixed']): TrustedZoneFieldCatalog['fixed'] {
	return { ...fixed, ...(fixed.productIds === undefined ? {} : { productIds: [...fixed.productIds] }) };
}

function readOptionalString(value: Record<string, unknown>, key: string): string | undefined {
	return hasOwn(value, key) && typeof value[key] === 'string' ? value[key] : undefined;
}

function hasOwn(value: object, key: string): boolean {
	return Object.prototype.hasOwnProperty.call(value, key);
}
