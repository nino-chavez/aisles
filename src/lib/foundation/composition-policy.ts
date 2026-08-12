import { ZONES, type Surface, type ZoneId } from './zones';

export const AUTONOMY_CAPABILITIES = [
	'rank_products',
	'select_products',
	'select_copy_variant',
	'generate_bounded_copy',
	'select_component_variant',
	'toggle_zone',
	'reorder_zones',
	'select_page_recipe',
] as const;

export type AutonomyCapability = (typeof AUTONOMY_CAPABILITIES)[number];

export const AUTONOMY_PRESETS = ['preserve', 'assist', 'compose', 'explore'] as const;
export type AutonomyPreset = (typeof AUTONOMY_PRESETS)[number];

export const DECISION_MODES = ['fixed', 'rules', 'model'] as const;
export type DecisionMode = (typeof DECISION_MODES)[number];

export const PUBLICATION_MODES = ['live', 'holdout', 'approval_required'] as const;
export type PublicationMode = (typeof PUBLICATION_MODES)[number];

export const PRESET_CAPABILITIES = {
	preserve: ['rank_products', 'select_products'],
	assist: [
		'rank_products',
		'select_products',
		'select_copy_variant',
		'generate_bounded_copy',
		'select_component_variant',
	],
	compose: [...AUTONOMY_CAPABILITIES],
	explore: [...AUTONOMY_CAPABILITIES],
} as const satisfies Record<AutonomyPreset, readonly AutonomyCapability[]>;

export interface PolicyMaximum {
	capabilities: readonly AutonomyCapability[];
	decisionMode: DecisionMode;
	publicationMode: PublicationMode;
}

export interface OrganizationCompositionPolicy {
	organizationId: string;
	policyVersion: string;
	maximum: PolicyMaximum;
}

export interface ZoneCompositionPolicy {
	capabilities?: readonly AutonomyCapability[];
	decisionMode?: DecisionMode;
	publicationMode?: PublicationMode;
	allowedComponentVariantIds?: readonly string[];
	allowedCssVariantIds?: readonly string[];
	allowedCopyVariantIds?: readonly string[];
}

export interface SurfaceCompositionPolicy {
	preset: AutonomyPreset;
	/** Optional capability override may only narrow the preset. */
	capabilities?: readonly AutonomyCapability[];
	decisionMode: DecisionMode;
	publicationMode: PublicationMode;
	allowedComponentVariantIds: readonly string[];
	allowedCssVariantIds: readonly string[];
	allowedCopyVariantIds: readonly string[];
	zoneOverrides?: Partial<Record<ZoneId, ZoneCompositionPolicy>>;
}

export interface BrandCompositionPolicy {
	organizationId: string;
	brandId: string;
	policyVersion: string;
	maximum: PolicyMaximum;
	registeredComponentVariantIds: readonly string[];
	registeredCssVariantIds: readonly string[];
	registeredCopyVariantIds: readonly string[];
	reference: {
		referenceId: string;
		referenceVersion: string;
	};
	surfaces: Partial<Record<Surface, SurfaceCompositionPolicy>>;
}

export interface CompositionPolicyRegistry {
	organizations: Readonly<Record<string, OrganizationCompositionPolicy>>;
	brands: Readonly<Record<string, BrandCompositionPolicy>>;
}

export interface CompileCompositionPolicyInput {
	/** Trusted deploy or host identity, not a browser-authored policy field. */
	organizationId: string;
	/** Trusted deploy or host identity, not a browser-authored policy field. */
	brandId: string;
	surface: Surface;
	zoneId?: ZoneId;
	registry: CompositionPolicyRegistry;
}

export interface CompositionPolicyProvenance {
	kind: 'compiled' | 'legacy_generated_compatibility';
	organizationId: string;
	organizationPolicyVersion: string;
	brandId: string;
	brandPolicyVersion: string;
	referenceId: string | null;
	referenceVersion: string | null;
	surface: Surface;
	zoneId: ZoneId | null;
	preset: AutonomyPreset | null;
}

export interface EffectiveCompositionPolicy {
	/** Deterministic composite of organization and brand policy versions. */
	policyVersion: string;
	capabilities: readonly AutonomyCapability[];
	decisionMode: DecisionMode;
	publicationMode: PublicationMode;
	allowedComponentVariantIds: readonly string[];
	allowedCssVariantIds: readonly string[];
	allowedCopyVariantIds: readonly string[];
	provenance: CompositionPolicyProvenance;
}

export class CompositionPolicyValidationError extends Error {
	constructor(message: string) {
		super(`composition policy: ${message}`);
		this.name = 'CompositionPolicyValidationError';
	}
}

export function compileAutonomyPreset(preset: AutonomyPreset): readonly AutonomyCapability[] {
	const capabilities = (PRESET_CAPABILITIES as Readonly<Record<string, readonly AutonomyCapability[]>>)[preset];
	if (!capabilities) {
		throw new CompositionPolicyValidationError(`unknown autonomy preset "${preset}"`);
	}
	return [...capabilities];
}

export function compileCompositionPolicy(input: CompileCompositionPolicyInput): EffectiveCompositionPolicy {
	assertIdentity(input.organizationId, 'organization');
	assertIdentity(input.brandId, 'brand');
	const organization = ownLookup(input.registry.organizations, input.organizationId);
	if (organization === undefined) {
		throw new CompositionPolicyValidationError(`missing organization policy "${input.organizationId}"`);
	}
	if (organization.organizationId !== input.organizationId) {
		throw new CompositionPolicyValidationError(
			`organization policy key "${input.organizationId}" does not match identity "${organization.organizationId}"`,
		);
	}
	assertVersion(organization.policyVersion, 'organization');
	assertMaximum(organization.maximum, 'organization maximum');

	const brand = ownLookup(input.registry.brands, input.brandId);
	if (brand === undefined) {
		throw new CompositionPolicyValidationError(`missing brand policy "${input.brandId}"`);
	}
	if (brand.brandId !== input.brandId || brand.organizationId !== input.organizationId) {
		throw new CompositionPolicyValidationError(
			`brand policy "${input.brandId}" does not belong to organization "${input.organizationId}"`,
		);
	}
	assertVersion(brand.policyVersion, 'brand');
	assertMaximum(brand.maximum, 'brand maximum');
	assertNarrowerMaximum(brand.maximum, organization.maximum, 'brand maximum');
	assertVariantIds(brand.registeredComponentVariantIds, 'brand component registry');
	assertVariantIds(brand.registeredCssVariantIds, 'brand CSS registry');
	assertVariantIds(brand.registeredCopyVariantIds, 'brand copy registry');
	if (!brand.reference) {
		throw new CompositionPolicyValidationError('brand reference contract is required');
	}
	assertNonBlank(brand.reference.referenceId, 'reference identifier');
	assertNonBlank(brand.reference.referenceVersion, 'reference version');

	if (!surfaceSet.has(input.surface)) {
		throw new CompositionPolicyValidationError(`unknown surface "${input.surface}"`);
	}
	const surfacePolicy = ownLookup(brand.surfaces, input.surface);
	if (surfacePolicy === undefined) {
		throw new CompositionPolicyValidationError(
			`missing surface policy "${input.surface}" for brand "${input.brandId}"`,
		);
	}

	const presetCapabilities = compileAutonomyPreset(surfacePolicy.preset);
	const surfaceCapabilities = surfacePolicy.capabilities
		? uniqueCapabilities(surfacePolicy.capabilities, `${input.surface} surface`)
		: presetCapabilities;
	if (surfacePolicy.capabilities) {
		assertSubset(surfaceCapabilities, presetCapabilities, `${input.surface} surface`, 'preset');
	}
	assertSubset(surfaceCapabilities, brand.maximum.capabilities, `${input.surface} surface`, 'brand maximum');
	assertDecisionNarrower(surfacePolicy.decisionMode, brand.maximum.decisionMode, `${input.surface} surface`);
	assertPublicationNarrower(surfacePolicy.publicationMode, brand.maximum.publicationMode, `${input.surface} surface`);
	if (surfacePolicy.preset === 'explore' && surfacePolicy.publicationMode === 'live') {
		throw new CompositionPolicyValidationError('explore surface requires holdout or approval publication');
	}
	const surfaceComponents = uniqueVariantIds(surfacePolicy.allowedComponentVariantIds, `${input.surface} surface components`);
	const surfaceCss = uniqueVariantIds(surfacePolicy.allowedCssVariantIds, `${input.surface} surface CSS`);
	const surfaceCopy = uniqueVariantIds(surfacePolicy.allowedCopyVariantIds, `${input.surface} surface copy`);
	assertSubset(surfaceComponents, brand.registeredComponentVariantIds, `${input.surface} surface components`, 'brand registry');
	assertSubset(surfaceCss, brand.registeredCssVariantIds, `${input.surface} surface CSS`, 'brand registry');
	assertSubset(surfaceCopy, brand.registeredCopyVariantIds, `${input.surface} surface copy`, 'brand registry');

	validateZoneOverrideKeys(surfacePolicy, input.surface);
	let zonePolicy: ZoneCompositionPolicy | undefined;
	if (input.zoneId !== undefined) {
		const zoneMetadata = ZONES[input.zoneId];
		if (!zoneMetadata || zoneMetadata.surface !== input.surface) {
			throw new CompositionPolicyValidationError(
				`unknown zone "${input.zoneId}" for surface "${input.surface}"`,
			);
		}
		zonePolicy = surfacePolicy.zoneOverrides?.[input.zoneId];
	}

	const zoneCapabilities = zonePolicy?.capabilities
		? uniqueCapabilities(zonePolicy.capabilities, `${input.zoneId} zone`)
		: surfaceCapabilities;
	if (zonePolicy?.capabilities) {
		assertSubset(zoneCapabilities, surfaceCapabilities, `${input.zoneId} zone`, 'surface');
	}
	const decisionMode = zonePolicy?.decisionMode ?? surfacePolicy.decisionMode;
	const publicationMode = zonePolicy?.publicationMode ?? surfacePolicy.publicationMode;
	assertDecisionNarrower(decisionMode, surfacePolicy.decisionMode, `${input.zoneId ?? input.surface} effective policy`);
	assertPublicationNarrower(publicationMode, surfacePolicy.publicationMode, `${input.zoneId ?? input.surface} effective policy`);

	const zoneComponents = zonePolicy?.allowedComponentVariantIds
		? uniqueVariantIds(zonePolicy.allowedComponentVariantIds, `${input.zoneId} zone components`)
		: surfaceComponents;
	const zoneCss = zonePolicy?.allowedCssVariantIds
		? uniqueVariantIds(zonePolicy.allowedCssVariantIds, `${input.zoneId} zone CSS`)
		: surfaceCss;
	const zoneCopy = zonePolicy?.allowedCopyVariantIds
		? uniqueVariantIds(zonePolicy.allowedCopyVariantIds, `${input.zoneId} zone copy`)
		: surfaceCopy;
	if (zonePolicy?.allowedComponentVariantIds) {
		assertSubset(zoneComponents, surfaceComponents, `${input.zoneId} zone components`, 'surface');
	}
	if (zonePolicy?.allowedCssVariantIds) {
		assertSubset(zoneCss, surfaceCss, `${input.zoneId} zone CSS`, 'surface');
	}
	if (zonePolicy?.allowedCopyVariantIds) {
		assertSubset(zoneCopy, surfaceCopy, `${input.zoneId} zone copy`, 'surface');
	}

	return {
		policyVersion: composeEffectivePolicyVersion(organization.policyVersion, brand.policyVersion),
		capabilities: intersectCapabilities(
			organization.maximum.capabilities,
			brand.maximum.capabilities,
			presetCapabilities,
			surfaceCapabilities,
			zoneCapabilities,
		),
		decisionMode,
		publicationMode,
		allowedComponentVariantIds: intersectStrings(
			brand.registeredComponentVariantIds,
			surfaceComponents,
			zoneComponents,
		),
		allowedCssVariantIds: intersectStrings(brand.registeredCssVariantIds, surfaceCss, zoneCss),
		allowedCopyVariantIds: intersectStrings(brand.registeredCopyVariantIds, surfaceCopy, zoneCopy),
		provenance: {
			kind: 'compiled',
			organizationId: input.organizationId,
			organizationPolicyVersion: organization.policyVersion,
			brandId: input.brandId,
			brandPolicyVersion: brand.policyVersion,
			referenceId: brand.reference.referenceId,
			referenceVersion: brand.reference.referenceVersion,
			surface: input.surface,
			zoneId: input.zoneId ?? null,
			preset: surfacePolicy.preset,
		},
	};
}

export const LEGACY_GENERATED_POLICY_VERSION = 'legacy_generated_v1';

export interface CompileLegacyGeneratedPolicyInput {
	organizationId: string;
	brandId: string;
	surface: Surface;
	registeredComponentVariantIds: readonly string[];
	registeredCssVariantIds: readonly string[];
	registeredCopyVariantIds: readonly string[];
}

/** Explicit compatibility for the current registered, whole-page generated renderer. */
export function compileLegacyGeneratedCompatibilityPolicy(
	input: CompileLegacyGeneratedPolicyInput,
): EffectiveCompositionPolicy {
	assertIdentity(input.organizationId, 'organization');
	assertIdentity(input.brandId, 'brand');
	if (!surfaceSet.has(input.surface)) {
		throw new CompositionPolicyValidationError(`unknown surface "${input.surface}"`);
	}
	const componentVariantIds = uniqueVariantIds(
		input.registeredComponentVariantIds,
		'legacy component registry',
	);
	const cssVariantIds = uniqueVariantIds(input.registeredCssVariantIds, 'legacy CSS registry');
	const copyVariantIds = uniqueVariantIds(input.registeredCopyVariantIds, 'legacy copy registry');

	return {
		policyVersion: LEGACY_GENERATED_POLICY_VERSION,
		capabilities: [...AUTONOMY_CAPABILITIES],
		decisionMode: 'model',
		publicationMode: 'live',
		allowedComponentVariantIds: componentVariantIds,
		allowedCssVariantIds: cssVariantIds,
		allowedCopyVariantIds: copyVariantIds,
		provenance: {
			kind: 'legacy_generated_compatibility',
			organizationId: input.organizationId,
			organizationPolicyVersion: LEGACY_GENERATED_POLICY_VERSION,
			brandId: input.brandId,
			brandPolicyVersion: LEGACY_GENERATED_POLICY_VERSION,
			referenceId: null,
			referenceVersion: null,
			surface: input.surface,
			zoneId: null,
			preset: null,
		},
	};
}

const surfaceSet = new Set<string>([
	'home',
	'plp',
	'pdp',
	'cart',
	'checkout',
	'search',
	'error-404',
	'error-empty',
] satisfies Surface[]);

const capabilitySet = new Set<string>(AUTONOMY_CAPABILITIES);
const decisionSet = new Set<string>(DECISION_MODES);
const publicationSet = new Set<string>(PUBLICATION_MODES);
const decisionAuthority: Record<DecisionMode, number> = { fixed: 0, rules: 1, model: 2 };

function assertMaximum(maximum: PolicyMaximum, label: string): void {
	uniqueCapabilities(maximum.capabilities, label);
	assertDecisionMode(maximum.decisionMode, label);
	assertPublicationMode(maximum.publicationMode, label);
}

function assertNarrowerMaximum(child: PolicyMaximum, parent: PolicyMaximum, label: string): void {
	assertSubset(child.capabilities, parent.capabilities, label, 'organization maximum');
	assertDecisionNarrower(child.decisionMode, parent.decisionMode, label);
	assertPublicationNarrower(child.publicationMode, parent.publicationMode, label);
}

function assertDecisionNarrower(child: DecisionMode, parent: DecisionMode, label: string): void {
	assertDecisionMode(child, label);
	assertDecisionMode(parent, 'parent');
	if (decisionAuthority[child] > decisionAuthority[parent]) {
		throw new CompositionPolicyValidationError(`${label} expands decision mode beyond "${parent}"`);
	}
}

function assertPublicationNarrower(child: PublicationMode, parent: PublicationMode, label: string): void {
	assertPublicationMode(child, label);
	assertPublicationMode(parent, 'parent');
	// Holdout and approval are distinct restrictions; neither silently replaces the other.
	if (child !== parent && parent !== 'live') {
		throw new CompositionPolicyValidationError(`${label} expands publication mode beyond "${parent}"`);
	}
}

function assertDecisionMode(mode: DecisionMode, label: string): void {
	if (!decisionSet.has(mode)) {
		throw new CompositionPolicyValidationError(`${label} has unknown decision mode "${mode}"`);
	}
}

function assertPublicationMode(mode: PublicationMode, label: string): void {
	if (!publicationSet.has(mode)) {
		throw new CompositionPolicyValidationError(`${label} has unknown publication mode "${mode}"`);
	}
}

function uniqueCapabilities(capabilities: readonly AutonomyCapability[], label: string): AutonomyCapability[] {
	for (const capability of capabilities) {
		if (!capabilitySet.has(capability)) {
			throw new CompositionPolicyValidationError(`${label} has unknown capability "${capability}"`);
		}
	}
	return [...new Set(capabilities)];
}

function assertVariantIds(ids: readonly string[], label: string): void {
	uniqueVariantIds(ids, label);
}

function uniqueVariantIds(ids: readonly string[], label: string): string[] {
	for (const id of ids) {
		if (typeof id !== 'string' || id.trim() === '') {
			throw new CompositionPolicyValidationError(`${label} contains an invalid registered variant ID`);
		}
	}
	return [...new Set(ids)];
}

function assertSubset<T extends string>(
	child: readonly T[],
	parent: readonly T[],
	childLabel: string,
	parentLabel: string,
): void {
	const parentSet = new Set<string>(parent);
	const expansions = child.filter((value) => !parentSet.has(value));
	if (expansions.length > 0) {
		throw new CompositionPolicyValidationError(
			`${childLabel} expands ${parentLabel} with ${[...new Set(expansions)].join(', ')}`,
		);
	}
}

function intersectCapabilities(...lists: readonly (readonly AutonomyCapability[])[]): AutonomyCapability[] {
	return AUTONOMY_CAPABILITIES.filter((capability) => lists.every((list) => list.includes(capability)));
}

function intersectStrings(...lists: readonly (readonly string[])[]): string[] {
	const [first = [], ...rest] = lists;
	return [...new Set(first)].filter((value) => rest.every((list) => list.includes(value)));
}

function assertVersion(version: string, label: string): void {
	assertNonBlank(version, `${label} policy version`);
}

function assertIdentity(identity: string, label: string): void {
	assertNonBlank(identity, `${label} identity`);
}

function assertNonBlank(value: string, label: string): void {
	if (typeof value !== 'string' || value.trim() === '') {
		throw new CompositionPolicyValidationError(`${label} is required`);
	}
}

function ownLookup<T>(registry: Readonly<Record<string, T>>, id: string): T | undefined {
	return Object.prototype.hasOwnProperty.call(registry, id) ? registry[id] : undefined;
}

/** Length-prefixing makes the composite stable without delimiter collisions. */
export function composeEffectivePolicyVersion(organizationVersion: string, brandVersion: string): string {
	return `org:${organizationVersion.length}:${organizationVersion}|brand:${brandVersion.length}:${brandVersion}`;
}

function validateZoneOverrideKeys(policy: SurfaceCompositionPolicy, surface: Surface): void {
	for (const zoneId of Object.keys(policy.zoneOverrides ?? {})) {
		const metadata = ZONES[zoneId as ZoneId];
		if (!metadata || metadata.surface !== surface) {
			throw new CompositionPolicyValidationError(`unknown zone override "${zoneId}" for surface "${surface}"`);
		}
	}
}
