import type { AutonomyCapability, DecisionMode } from './composition-policy';
import type { Surface } from './zones';

const ALL_CAPABILITIES: readonly AutonomyCapability[] = [
	'rank_products',
	'select_products',
	'select_copy_variant',
	'generate_bounded_copy',
	'select_component_variant',
	'toggle_zone',
	'reorder_zones',
	'select_page_recipe',
];
const DECISION_MODES: readonly DecisionMode[] = ['fixed', 'rules', 'model'];

/**
 * Canonical generative-commerce authority gradient.
 *
 * This is a ceiling, not an instruction to turn every zone on. A merchant
 * policy may narrow any entry, but it may not make a narrower surface behave
 * like Home. Account and locator are deliberately fixed until a real bounded
 * use case exists.
 */
export type SurfaceLatitude = 'wide' | 'medium' | 'narrow' | 'narrower' | 'narrowest' | 'none';

export interface SurfaceAuthorityContract {
	latitude: SurfaceLatitude;
	maximumDecisionMode: DecisionMode;
	maximumCapabilities: readonly AutonomyCapability[];
	modelDescription: string;
}

export const CANONICAL_SURFACE_AUTHORITY: Readonly<Record<Surface, SurfaceAuthorityContract>> = {
	home: {
		latitude: 'wide',
		maximumDecisionMode: 'model',
		maximumCapabilities: ALL_CAPABILITIES,
		modelDescription: 'composition and merchandising may vary inside approved Home zones',
	},
	plp: {
		latitude: 'medium',
		maximumDecisionMode: 'model',
		maximumCapabilities: [
			'rank_products',
			'select_products',
			'select_copy_variant',
			'generate_bounded_copy',
			'select_component_variant',
		],
		modelDescription: 'CLP framing, marketing, and bounded product ranking may vary',
	},
	pdp: {
		latitude: 'narrow',
		maximumDecisionMode: 'model',
		maximumCapabilities: [
			'rank_products',
			'select_products',
			'select_copy_variant',
			'generate_bounded_copy',
			'select_component_variant',
		],
		modelDescription: 'related recommendations, bounded copy, and marketing may vary',
	},
	search: {
		latitude: 'narrow',
		maximumDecisionMode: 'model',
		maximumCapabilities: ['select_copy_variant', 'generate_bounded_copy'],
		modelDescription: 'only approved recovery copy may vary',
	},
	cart: {
		latitude: 'narrower',
		maximumDecisionMode: 'model',
		maximumCapabilities: ['select_copy_variant', 'generate_bounded_copy'],
		modelDescription: 'only approved recovery copy may vary; cart state stays fixed',
	},
	checkout: {
		latitude: 'narrowest',
		maximumDecisionMode: 'model',
		maximumCapabilities: ['select_copy_variant', 'generate_bounded_copy'],
		modelDescription: 'only approved assurance copy may vary; transaction state stays fixed',
	},
	account: {
		latitude: 'none',
		maximumDecisionMode: 'fixed',
		maximumCapabilities: [],
		modelDescription: 'no AI use case is approved',
	},
	locator: {
		latitude: 'none',
		maximumDecisionMode: 'fixed',
		maximumCapabilities: [],
		modelDescription: 'merchant-owned locator remains fixed',
	},
	'error-404': {
		latitude: 'none',
		maximumDecisionMode: 'fixed',
		maximumCapabilities: [],
		modelDescription: 'error recovery remains merchant-owned',
	},
	'error-empty': {
		latitude: 'none',
		maximumDecisionMode: 'fixed',
		maximumCapabilities: [],
		modelDescription: 'empty-state recovery remains merchant-owned',
	},
} as const;

const decisionAuthority: Record<DecisionMode, number> = { fixed: 0, rules: 1, model: 2 };

export function surfaceAuthorityFor(surface: Surface): SurfaceAuthorityContract {
	return CANONICAL_SURFACE_AUTHORITY[surface];
}

export function isDecisionModeWithinSurface(surface: Surface, mode: DecisionMode): boolean {
	return decisionAuthority[mode] <= decisionAuthority[CANONICAL_SURFACE_AUTHORITY[surface].maximumDecisionMode];
}

export function capabilitiesWithinSurface(surface: Surface, capabilities: readonly AutonomyCapability[]): boolean {
	const allowed = new Set(CANONICAL_SURFACE_AUTHORITY[surface].maximumCapabilities);
	return capabilities.every((capability) => allowed.has(capability));
}

export function assertCanonicalSurfaceAuthority(
	surface: Surface,
	decisionMode: DecisionMode,
	capabilities: readonly AutonomyCapability[],
): void {
	if (!isDecisionModeWithinSurface(surface, decisionMode)) {
		throw new Error(`surface authority: ${surface} cannot use ${decisionMode} decisions`);
	}
	if (!capabilitiesWithinSurface(surface, capabilities)) {
		const allowed = CANONICAL_SURFACE_AUTHORITY[surface].maximumCapabilities;
		const invalid = capabilities.filter((capability) => !allowed.includes(capability));
		throw new Error(`surface authority: ${surface} cannot use ${[...new Set(invalid)].join(', ')}`);
	}
}

export const SURFACE_AUTHORITY_DECISION_MODES = DECISION_MODES;
