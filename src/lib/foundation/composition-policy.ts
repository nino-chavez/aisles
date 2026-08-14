import { tryNormalizeTrustedErrorRoute, tryNormalizeTrustedShopperRoute } from './autonomy-zone-route';
import {
	isAislesRendererIdentity,
	isIssuedTrustedZoneIdentity,
	type TrustedZoneIdentityDefinition,
} from './trusted-zone-identity';
import { assertCanonicalSurfaceAuthority } from './surface-authority';
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
	/** Existing local family-only compiler path. Not sufficient for zone execution. */
	zoneId?: ZoneId;
	/** Registry-issued exact identity required by the identity-bound executor. */
	zoneIdentity?: TrustedZoneIdentityDefinition;
	routeSource?: 'pathname' | 'error-state';
	routePath?: string;
	registry: CompositionPolicyRegistry;
}

export interface TrustedZonePolicyBinding {
	zoneOrigin: 'aisles' | 'bealls-aisles';
	familyId: string;
	instanceId: string;
	rendererContract: 'aisles-renderer' | 'trusted-hidden';
	routeSource: 'pathname' | 'error-state';
	routePath: string;
	routeManifestVersion: string;
	routeManifestDigest: string;
	allowedDecisionModes: readonly DecisionMode[];
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
	/** String keeps provenance compatible with externally pinned union families;
	 * compiler inputs and override keys remain the local typed ZoneId boundary. */
	zoneId: string | null;
	/** Present only for an exact registry-issued identity and compiler-normalized route. */
	zoneBinding?: TrustedZonePolicyBinding | null;
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

interface NormalizedZoneTarget {
	familyId: string | null;
	localZoneId?: ZoneId;
	identity?: TrustedZoneIdentityDefinition;
	routeSource?: 'pathname' | 'error-state';
	route?: {
		routePath: string;
		surface: Surface;
		routeManifestVersion: string;
		routeManifestDigest: string;
	};
}

const compiledTrustedZonePolicies = new WeakSet<object>();

/** Runtime attestation: the executor does not accept hand-built provenance. */
export function isCompiledTrustedZonePolicy(value: unknown): value is EffectiveCompositionPolicy {
	return typeof value === 'object' && value !== null && compiledTrustedZonePolicies.has(value);
}

export function compileAutonomyPreset(preset: AutonomyPreset): readonly AutonomyCapability[] {
	const presets = PRESET_CAPABILITIES as Readonly<Record<string, readonly AutonomyCapability[]>>;
	if (!Object.prototype.hasOwnProperty.call(presets, preset)) {
		throw new CompositionPolicyValidationError(`unknown autonomy preset "${preset}"`);
	}
	const capabilities = presets[preset];
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
	const zoneTarget = normalizeZoneTarget(input);
	const surfacePolicy = ownLookup(brand.surfaces, input.surface);
	if (surfacePolicy === undefined) {
		throw new CompositionPolicyValidationError(
			`missing surface policy "${input.surface}" for brand "${input.brandId}"`,
		);
	}

	const trustedHidden = zoneTarget.identity?.rendererContract === 'trusted-hidden';
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
	if (!trustedHidden) {
		try {
			assertCanonicalSurfaceAuthority(input.surface, surfacePolicy.decisionMode, surfaceCapabilities);
		} catch (cause) {
			throw new CompositionPolicyValidationError(cause instanceof Error ? cause.message : 'surface exceeds canonical authority');
		}
	}
	const surfaceComponents = uniqueVariantIds(surfacePolicy.allowedComponentVariantIds, `${input.surface} surface components`);
	const surfaceCss = uniqueVariantIds(surfacePolicy.allowedCssVariantIds, `${input.surface} surface CSS`);
	const surfaceCopy = uniqueVariantIds(surfacePolicy.allowedCopyVariantIds, `${input.surface} surface copy`);
	assertSubset(surfaceComponents, brand.registeredComponentVariantIds, `${input.surface} surface components`, 'brand registry');
	assertSubset(surfaceCss, brand.registeredCssVariantIds, `${input.surface} surface CSS`, 'brand registry');
	assertSubset(surfaceCopy, brand.registeredCopyVariantIds, `${input.surface} surface copy`, 'brand registry');

	validateZoneOverrideKeys(surfacePolicy, input.surface);
	let zonePolicy: ZoneCompositionPolicy | undefined;
	if (zoneTarget.localZoneId !== undefined) {
		const zoneMetadata = ZONES[zoneTarget.localZoneId];
		if (!zoneMetadata || zoneMetadata.surface !== input.surface) {
			throw new CompositionPolicyValidationError(
				`unknown zone "${zoneTarget.localZoneId}" for surface "${input.surface}"`,
			);
		}
		zonePolicy = surfacePolicy.zoneOverrides?.[zoneTarget.localZoneId];
	}

	const zoneLabel = zoneTarget.familyId ?? input.surface;
	const zoneCapabilities = trustedHidden ? [] : zonePolicy?.capabilities
		? uniqueCapabilities(zonePolicy.capabilities, `${zoneLabel} zone`)
		: surfaceCapabilities;
	if (zonePolicy?.capabilities) {
		assertSubset(zoneCapabilities, surfaceCapabilities, `${zoneLabel} zone`, 'surface');
	}
	const decisionMode = trustedHidden ? 'fixed' : zonePolicy?.decisionMode ?? surfacePolicy.decisionMode;
	const publicationMode = zonePolicy?.publicationMode ?? surfacePolicy.publicationMode;
	assertDecisionNarrower(decisionMode, surfacePolicy.decisionMode, `${zoneLabel} effective policy`);
	assertPublicationNarrower(publicationMode, surfacePolicy.publicationMode, `${zoneLabel} effective policy`);

	const zoneComponents = trustedHidden ? [] : zonePolicy?.allowedComponentVariantIds
		? uniqueVariantIds(zonePolicy.allowedComponentVariantIds, `${zoneLabel} zone components`)
		: surfaceComponents;
	const zoneCss = trustedHidden ? [] : zonePolicy?.allowedCssVariantIds
		? uniqueVariantIds(zonePolicy.allowedCssVariantIds, `${zoneLabel} zone CSS`)
		: surfaceCss;
	const zoneCopy = trustedHidden ? [] : zonePolicy?.allowedCopyVariantIds
		? uniqueVariantIds(zonePolicy.allowedCopyVariantIds, `${zoneLabel} zone copy`)
		: surfaceCopy;
	if (zonePolicy?.allowedComponentVariantIds) {
		assertSubset(zoneComponents, surfaceComponents, `${zoneLabel} zone components`, 'surface');
	}
	if (zonePolicy?.allowedCssVariantIds) {
		assertSubset(zoneCss, surfaceCss, `${zoneLabel} zone CSS`, 'surface');
	}
	if (zonePolicy?.allowedCopyVariantIds) {
		assertSubset(zoneCopy, surfaceCopy, `${zoneLabel} zone copy`, 'surface');
	}

	const effective: EffectiveCompositionPolicy = {
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
			zoneId: zoneTarget.familyId,
			zoneBinding: zoneTarget.identity && zoneTarget.route ? {
				zoneOrigin: zoneTarget.identity.origin,
				familyId: zoneTarget.identity.familyId,
				instanceId: zoneTarget.identity.instanceId,
				rendererContract: zoneTarget.identity.rendererContract,
				routeSource: zoneTarget.routeSource!,
				routePath: zoneTarget.route.routePath,
				routeManifestVersion: zoneTarget.route.routeManifestVersion,
				routeManifestDigest: zoneTarget.route.routeManifestDigest,
				allowedDecisionModes: trustedHidden ? ['fixed'] : decisionModesAtOrBelow(surfacePolicy.decisionMode),
			} : null,
			preset: surfacePolicy.preset,
		},
	};
	return zoneTarget.identity ? attestTrustedZonePolicy(effective) : effective;
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

function normalizeZoneTarget(input: CompileCompositionPolicyInput): NormalizedZoneTarget {
	if (input.zoneIdentity === undefined) {
		if (input.routeSource !== undefined || input.routePath !== undefined) {
			throw new CompositionPolicyValidationError('route binding requires an exact trusted zone identity');
		}
		return {
			familyId: input.zoneId ?? null,
			...(input.zoneId === undefined ? {} : { localZoneId: input.zoneId }),
		};
	}
	if (input.zoneId !== undefined) {
		throw new CompositionPolicyValidationError('zoneId and zoneIdentity are mutually exclusive');
	}
	if (!isIssuedTrustedZoneIdentity(input.zoneIdentity)) {
		throw new CompositionPolicyValidationError('zone identity must be an exact registry-issued object');
	}
	if (input.zoneIdentity.surface !== input.surface) {
		throw new CompositionPolicyValidationError(
			`zone identity "${input.zoneIdentity.instanceId}" does not belong to surface "${input.surface}"`,
		);
	}
	if ((input.routeSource !== 'pathname' && input.routeSource !== 'error-state') || input.routePath === undefined) {
		throw new CompositionPolicyValidationError('trusted zone identity requires routeSource and routePath');
	}
	const route = input.routeSource === 'pathname'
		? tryNormalizeTrustedShopperRoute(input.routePath)
		: tryNormalizeTrustedErrorRoute(input.routePath, input.surface);
	if (!route || route.surface !== input.surface) {
		throw new CompositionPolicyValidationError(
			`route "${String(input.routePath)}" is not trusted for surface "${input.surface}"`,
		);
	}
	return {
		familyId: input.zoneIdentity.familyId,
		...(isAislesRendererIdentity(input.zoneIdentity) ? { localZoneId: input.zoneIdentity.familyId } : {}),
		identity: input.zoneIdentity,
		routeSource: input.routeSource,
		route,
	};
}

function attestTrustedZonePolicy(policy: EffectiveCompositionPolicy): EffectiveCompositionPolicy {
	const binding = policy.provenance.zoneBinding;
	if (!binding) throw new CompositionPolicyValidationError('trusted zone policy binding is required');
	Object.freeze(binding.allowedDecisionModes);
	Object.freeze(binding);
	Object.freeze(policy.provenance);
	Object.freeze(policy.capabilities);
	Object.freeze(policy.allowedComponentVariantIds);
	Object.freeze(policy.allowedCssVariantIds);
	Object.freeze(policy.allowedCopyVariantIds);
	Object.freeze(policy);
	compiledTrustedZonePolicies.add(policy);
	return policy;
}

const surfaceSet = new Set<string>([
	'home',
	'plp',
	'pdp',
	'cart',
	'checkout',
	'search',
	'account',
	'locator',
	'error-404',
	'error-empty',
] satisfies Surface[]);

const capabilitySet = new Set<string>(AUTONOMY_CAPABILITIES);
const decisionSet = new Set<string>(DECISION_MODES);
const publicationSet = new Set<string>(PUBLICATION_MODES);
const decisionAuthority: Record<DecisionMode, number> = { fixed: 0, rules: 1, model: 2 };

function decisionModesAtOrBelow(maximum: DecisionMode): DecisionMode[] {
	return DECISION_MODES.filter((mode) => decisionAuthority[mode] <= decisionAuthority[maximum]);
}

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
