/**
 * Zone resolver — three-source cascade precedence tests.
 *
 * Run: npx vitest run src/lib/foundation
 *
 * Covers:
 * - Cascade precedence: engine > admin > fallback
 * - Schema validation: invalid content is rejected, cascade continues
 * - Multiplicity: singleton, indexed
 * - Hidden semantic: fallback returning null is a valid resolution
 * - Catalog integrity: every zone has a schema and vice versa
 * - Instance ID parsing: indexed instances resolve to correct family + index
 *
 * Ported from bealls-aisles' resolve-zone.test.ts, adapted to Aisles'
 * narrower zone catalog (see zones.ts) and multi-brand fixtures (haven /
 * volt, both real BRANDS entries in $lib/brand/config.ts).
 */

import { describe, it, expect } from 'vitest';
import {
	resolveZone,
	type EngineZoneDecision,
	type PolicyAwareResolveZoneOpts,
	type TrustedCompositionApproval,
	type TrustedCompositionContext,
	type TrustedMerchantOverride,
} from './resolve-zone';
import { ZONES, parseZoneInstance, enumerateZoneInstances, ZONE_IDS } from './zones';
import { ZoneSchemas } from './zone-schemas';
import type { CompositionPolicyProvenance, EffectiveCompositionPolicy } from './composition-policy';

// Valid content fixtures (used across multiple tests)

const heroEditorial = {
	component: 'editorial-header',
	props: { eyebrow: 'NEW SEASON', headline: 'Spring 2026', body: 'Fresh picks.' },
};

const heroFromAdmin = {
	component: 'editorial-header',
	props: { eyebrow: 'AUTHORED', headline: 'Merchant pick', body: 'Hand-picked.' },
};

const productCarousel = {
	component: 'product-carousel',
	props: {
		title: 'Best Sellers',
		products: [
			{ productId: 'p1', role: 'standard' },
			{ productId: 'p2', role: 'standard' },
			{ productId: 'p3', role: 'standard' },
		],
	},
};

describe('cascade precedence: engine > admin > fallback', () => {
	it('engine wins when both engine + admin present', () => {
		const r = resolveZone({
			zoneId: 'home.hero',
			brandId: 'haven',
			engineOutput: { zones: { 'home.hero': heroEditorial } },
			adminContent: { zones: { 'home.hero': heroFromAdmin } },
		});
		expect(r.source).toBe('engine');
		expect(r.content).toEqual(heroEditorial);
	});

	it('admin wins when no engine output', () => {
		const r = resolveZone({
			zoneId: 'home.hero',
			brandId: 'haven',
			adminContent: { zones: { 'home.hero': heroFromAdmin } },
		});
		expect(r.source).toBe('admin');
		expect(r.content).toEqual(heroFromAdmin);
	});

	it('fallback fires when neither engine nor admin', () => {
		const r = resolveZone({ zoneId: 'home.hero', brandId: 'haven' });
		expect(r.source).toBe('fallback');
		expect((r.content as { component?: string }).component).toBe('editorial-header');
	});

	it('zones with no registered fallback resolve to source=fallback, content=null', () => {
		// home.editorial-strip is intentionally left Hidden — see fallbacks/home.ts.
		const r = resolveZone({ zoneId: 'home.editorial-strip', brandId: 'haven' });
		expect(r.source).toBe('fallback');
		expect(r.content).toBeNull();
	});

	it('home.hero fallback differs by brand (brand-aware)', () => {
		const haven = resolveZone({ zoneId: 'home.hero', brandId: 'haven' });
		const volt = resolveZone({ zoneId: 'home.hero', brandId: 'volt' });
		const havenHeadline = (haven.content as { props: { headline: string } }).props.headline;
		const voltHeadline = (volt.content as { props: { headline: string } }).props.headline;
		expect(havenHeadline).not.toBe(voltHeadline);
	});

	it('unknown brandId resolves to source=fallback, content=null', () => {
		const r = resolveZone({ zoneId: 'home.hero', brandId: 'not-a-brand' });
		expect(r.source).toBe('fallback');
		expect(r.content).toBeNull();
	});
});

describe('schema validation rejects invalid content; cascade continues', () => {
	it('invalid engine content is rejected, cascade falls through to admin', () => {
		const r = resolveZone({
			zoneId: 'home.hero',
			brandId: 'haven',
			engineOutput: { zones: { 'home.hero': { component: 'product-grid', props: {} } } }, // wrong block for hero
			adminContent: { zones: { 'home.hero': heroFromAdmin } },
		});
		expect(r.source).toBe('admin');
	});

	it('engine content missing props falls through to fallback', () => {
		const r = resolveZone({
			zoneId: 'home.hero',
			brandId: 'haven',
			engineOutput: { zones: { 'home.hero': { component: 'editorial-header' } } }, // missing props
		});
		expect(r.source).toBe('fallback');
	});
});

describe('zone metadata gates which sources can populate', () => {
	it('admin-disabled zone ignores admin content even if present', () => {
		// pdp.recently-viewed is engineComposable: true, adminAuthorable: false
		const r = resolveZone({
			zoneId: 'pdp.recently-viewed',
			brandId: 'haven',
			adminContent: {
				zones: {
					'pdp.recently-viewed': productCarousel,
				},
			},
		});
		expect(r.source).toBe('fallback');
	});

	it('engine-disabled zone ignores engine content even if present', () => {
		// plp.below-grid is engineComposable: false, adminAuthorable: true
		const r = resolveZone({
			zoneId: 'plp.below-grid',
			brandId: 'haven',
			engineOutput: { zones: { 'plp.below-grid': { component: 'category-tile-grid', props: { tiles: [] } } } },
		});
		expect(r.source).toBe('fallback');
	});
});

describe('indexed zones resolve through family schema + index', () => {
	it('indexed instance resolves with engine content', () => {
		const r = resolveZone({
			zoneId: 'home.featured-row.1',
			brandId: 'haven',
			engineOutput: { zones: { 'home.featured-row.1': productCarousel } },
		});
		expect(r.source).toBe('engine');
		expect(r.family).toBe('home.featured-row');
		expect(r.index).toBe(1);
	});

	it('max-index instance accepted', () => {
		const r = resolveZone({
			zoneId: 'home.featured-row.3',
			brandId: 'haven',
			engineOutput: { zones: { 'home.featured-row.3': productCarousel } },
		});
		expect(r.source).toBe('engine');
		expect(r.index).toBe(3);
	});

	it('out-of-range index throws (catalog max is 3)', () => {
		expect(() => resolveZone({ zoneId: 'home.featured-row.4', brandId: 'haven' })).toThrow();
	});
});

describe('catalog integrity', () => {
	it('every zone in registry has a corresponding schema', () => {
		for (const zoneId of ZONE_IDS) {
			expect(zoneId in ZoneSchemas, `missing schema for ${zoneId}`).toBe(true);
		}
	});

	it('every schema corresponds to a registered zone', () => {
		for (const zoneId of Object.keys(ZoneSchemas)) {
			expect(zoneId in ZONES, `schema declared for unknown zone ${zoneId}`).toBe(true);
		}
	});

	it('enumerateZoneInstances returns every instance and each parses back', () => {
		const instances = enumerateZoneInstances();
		// One indexed family (home.featured-row, maxIndex 3) contributes
		// (3 - 1) extra instances beyond its single catalog entry.
		const expected = ZONE_IDS.length + (3 - 1);
		expect(instances.length).toBe(expected);
		for (const id of instances) {
			expect(parseZoneInstance(id), `unparsable instance ${id}`).not.toBeNull();
		}
	});
});

describe('unknown zone IDs', () => {
	it('unknown zone ID throws', () => {
		expect(() => resolveZone({ zoneId: 'home.does-not-exist', brandId: 'haven' })).toThrow();
	});
});

describe('PDP recommendation zones', () => {
	const pdpProductCarousel = {
		component: 'product-carousel',
		props: {
			title: 'You might also like',
			products: [
				{ productId: 'p1', role: 'standard' },
				{ productId: 'p2', role: 'standard' },
				{ productId: 'p3', role: 'standard' },
			],
		},
	};

	it('pdp.related accepts product-carousel from engine', () => {
		const r = resolveZone({
			zoneId: 'pdp.related',
			brandId: 'haven',
			engineOutput: { zones: { 'pdp.related': pdpProductCarousel } },
		});
		expect(r.source).toBe('engine');
	});

	it('pdp.cross-sell accepts product-carousel from engine', () => {
		const r = resolveZone({
			zoneId: 'pdp.cross-sell',
			brandId: 'haven',
			engineOutput: { zones: { 'pdp.cross-sell': pdpProductCarousel } },
		});
		expect(r.source).toBe('engine');
	});

	it('pdp.recently-viewed accepts product-carousel from engine', () => {
		const r = resolveZone({
			zoneId: 'pdp.recently-viewed',
			brandId: 'haven',
			engineOutput: { zones: { 'pdp.recently-viewed': pdpProductCarousel } },
		});
		expect(r.source).toBe('engine');
	});

	it('pdp.below-description has no fallback — Hidden by default', () => {
		const r = resolveZone({ zoneId: 'pdp.below-description', brandId: 'haven' });
		expect(r.source).toBe('fallback');
		expect(r.content).toBeNull();
	});
});

describe('cart specialization', () => {
	it('cart.above-checkout-cta accepts product-carousel from engine', () => {
		const r = resolveZone({
			zoneId: 'cart.above-checkout-cta',
			brandId: 'haven',
			engineOutput: { zones: { 'cart.above-checkout-cta': productCarousel } },
		});
		expect(r.source).toBe('engine');
	});

	it('cart.above-checkout-cta rejects out-of-vocabulary block', () => {
		const r = resolveZone({
			zoneId: 'cart.above-checkout-cta',
			brandId: 'haven',
			engineOutput: {
				zones: {
					'cart.above-checkout-cta': {
						component: 'editorial-hero',
						props: { image: 'x', headline: 'Spring 2026', textPosition: 'center' },
					},
				},
			},
		});
		// editorial-hero is a valid component elsewhere, but not in
		// cart.above-checkout-cta's schema union (product-carousel only) —
		// it's the discriminant, not the component name, that's out of
		// vocabulary for *this* zone.
		expect(r.source).toBe('fallback');
	});

	it('cart.above-checkout-cta has Hidden default fallback', () => {
		const r = resolveZone({ zoneId: 'cart.above-checkout-cta', brandId: 'haven' });
		expect(r.source).toBe('fallback');
		expect(r.content).toBeNull();
	});
});

describe('checkout specialization', () => {
	const assuranceStripEngine = {
		component: 'service-callouts-grid',
		props: {
			columns: 3,
			callouts: [
				{ icon: 'secure', label: 'Secure checkout', body: 'PCI-compliant.' },
				{ icon: 'returns', label: 'Easy returns', body: 'Within 60 days.' },
				{ icon: 'shipping', label: 'Free shipping', body: 'On qualifying orders.' },
			],
		},
	};

	it('checkout.assurance-strip accepts engine variant', () => {
		const r = resolveZone({
			zoneId: 'checkout.assurance-strip',
			brandId: 'haven',
			engineOutput: { zones: { 'checkout.assurance-strip': assuranceStripEngine } },
		});
		expect(r.source).toBe('engine');
	});

	it('checkout.assurance-strip falls back to brand-default trust strip', () => {
		const r = resolveZone({ zoneId: 'checkout.assurance-strip', brandId: 'haven' });
		const c = r.content as { component?: string; props?: { callouts?: unknown[] } } | null;
		expect(r.source).toBe('fallback');
		expect(c?.component).toBe('service-callouts-grid');
		expect(Array.isArray(c?.props?.callouts)).toBe(true);
		expect((c?.props?.callouts?.length ?? 0) >= 3).toBe(true);
	});

	it('checkout.last-chance-upsell accepts product-carousel from engine', () => {
		const r = resolveZone({
			zoneId: 'checkout.last-chance-upsell',
			brandId: 'haven',
			engineOutput: { zones: { 'checkout.last-chance-upsell': productCarousel } },
		});
		expect(r.source).toBe('engine');
	});
});

describe('search + error rescues', () => {
	it('search.empty-state falls back to brand-aware copy', () => {
		const r = resolveZone({ zoneId: 'search.empty-state', brandId: 'haven' });
		const c = r.content as { component?: string } | null;
		expect(r.source).toBe('fallback');
		expect(c?.component).toBe('editorial-header');
	});

	it('error-404.rescue falls back to brand-aware copy', () => {
		const r = resolveZone({ zoneId: 'error-404.rescue', brandId: 'haven' });
		const c = r.content as { component?: string } | null;
		expect(r.source).toBe('fallback');
		expect(c?.component).toBe('editorial-header');
	});

	it('error-empty.rescue falls back to brand-aware copy', () => {
		const r = resolveZone({ zoneId: 'error-empty.rescue', brandId: 'haven' });
		const c = r.content as { component?: string } | null;
		expect(r.source).toBe('fallback');
		expect(c?.component).toBe('editorial-header');
	});
});

type PolicyOverrides = Partial<Omit<EffectiveCompositionPolicy, 'provenance'>> & {
	provenance?: Partial<CompositionPolicyProvenance>;
};

function makePolicy(overrides: PolicyOverrides = {}): EffectiveCompositionPolicy {
	return {
		policyVersion: 'brand-policy-v1',
		capabilities: ['rank_products', 'select_products', 'select_component_variant', 'select_copy_variant'],
		decisionMode: 'model',
		publicationMode: 'live',
		allowedComponentVariantIds: ['editorial-header'],
		allowedCssVariantIds: ['hero-css-v1'],
		allowedCopyVariantIds: ['hero-copy-v1'],
		...overrides,
		provenance: {
			kind: 'compiled',
			organizationId: 'example-org',
			organizationPolicyVersion: 'org-policy-v1',
			brandId: 'haven',
			brandPolicyVersion: overrides.policyVersion ?? 'brand-policy-v1',
			referenceId: 'haven-reference',
			referenceVersion: 'reference-v1',
			surface: 'home',
			zoneId: 'home.hero',
			preset: 'assist',
			...overrides.provenance,
		},
	};
}

function makeDecision(overrides: Partial<EngineZoneDecision> = {}): EngineZoneDecision {
	return {
		decisionModeUsed: 'model',
		requiredCapabilityIds: ['select_component_variant'],
		componentVariantId: 'editorial-header',
		cssVariantId: 'hero-css-v1',
		copyVariantId: 'hero-copy-v1',
		content: heroEditorial,
		...overrides,
	};
}

function makeTrusted(
	policy: EffectiveCompositionPolicy,
	overrides: Partial<TrustedCompositionContext> = {},
): TrustedCompositionContext {
	return {
		organizationId: 'example-org',
		brandId: 'haven',
		surface: 'home',
		zoneId: 'home.hero',
		...overrides,
	};
}

function makeApproval(policy: EffectiveCompositionPolicy): TrustedCompositionApproval {
	return {
		approved: true,
		approvalId: 'approval-1',
		organizationId: 'example-org',
		brandId: 'haven',
		surface: 'home',
		zoneId: 'home.hero',
		policyVersion: policy.policyVersion,
	};
}

function makeMerchantOverride(policy: EffectiveCompositionPolicy): TrustedMerchantOverride {
	return {
		authorized: true,
		authorizationId: 'merchant-pin-1',
		organizationId: 'example-org',
		brandId: 'haven',
		surface: 'home',
		zoneId: 'home.hero',
		policyVersion: policy.policyVersion,
		componentVariantId: 'editorial-header',
		cssVariantId: 'hero-css-v1',
		copyVariantId: 'hero-copy-v1',
		content: heroFromAdmin,
	};
}

function makePolicyOpts({
	policy = makePolicy(),
	decision = makeDecision(),
	trustedContext,
	adminContent,
}: {
	policy?: EffectiveCompositionPolicy;
	decision?: EngineZoneDecision | undefined;
	trustedContext?: TrustedCompositionContext;
	adminContent?: PolicyAwareResolveZoneOpts['adminContent'];
} = {}): PolicyAwareResolveZoneOpts {
	return {
		mode: 'policy',
		zoneId: 'home.hero',
		brandId: 'haven',
		policy,
		trustedContext: trustedContext ?? makeTrusted(policy),
		engineDecisions: decision ? { zones: { 'home.hero': decision } } : undefined,
		adminContent,
	};
}

describe('policy-aware zone resolution', () => {
	it('accepts a permitted decision and records compiled provenance', () => {
		const policy = makePolicy();
		const r = resolveZone(makePolicyOpts({ policy }));

		expect(r.source).toBe('engine');
		expect(r.content).toEqual(heroEditorial);
		expect(r.policyTrace).toMatchObject({
			policy: { outcome: 'accepted' },
			merchantOverride: { outcome: 'not_provided' },
			engineDecision: { outcome: 'accepted' },
			provenance: policy.provenance,
		});
	});

	it('keeps raw engine precedence unchanged in explicit legacy mode', () => {
		const r = resolveZone({
			mode: 'legacy',
			zoneId: 'home.hero',
			brandId: 'haven',
			engineOutput: { zones: { 'home.hero': heroEditorial } },
			adminContent: { zones: { 'home.hero': heroFromAdmin } },
		});

		expect(r.source).toBe('engine');
		expect(r.content).toEqual(heroEditorial);
		expect(r.policyTrace).toBeUndefined();
	});

	it('does not admit a legacy compatibility policy through the new decision path', () => {
		const policy = makePolicy({
			policyVersion: 'legacy_generated_v1',
			provenance: {
				kind: 'legacy_generated_compatibility',
				organizationPolicyVersion: 'legacy_generated_v1',
				brandPolicyVersion: 'legacy_generated_v1',
				referenceId: null,
				referenceVersion: null,
				preset: null,
			},
		});
		const r = resolveZone(makePolicyOpts({ policy }));

		expect(r.source).toBe('fallback');
		expect(r.policyTrace?.policy.rejectionReason).toBe('policy_not_compiled');
	});

	it.each([
		['fixed', 'fixed', 'engine', undefined],
		['fixed', 'model', 'fallback', 'decision_mode_exceeds_policy'],
		['rules', 'fixed', 'engine', undefined],
		['rules', 'rules', 'engine', undefined],
		['rules', 'model', 'fallback', 'decision_mode_exceeds_policy'],
		['model', 'model', 'engine', undefined],
	] as const)(
		'enforces %s policy authority against a %s decision',
		(policyMode, decisionMode, expectedSource, expectedReason) => {
			const policy = makePolicy({ decisionMode: policyMode });
			const r = resolveZone(makePolicyOpts({ policy, decision: makeDecision({ decisionModeUsed: decisionMode }) }));

			expect(r.source).toBe(expectedSource);
			expect(r.policyTrace?.engineDecision.rejectionReason).toBe(expectedReason);
		},
	);

	it('rejects a capability outside the effective allowlist and falls through to admin', () => {
		const r = resolveZone(
			makePolicyOpts({
				decision: makeDecision({ requiredCapabilityIds: ['reorder_zones'] }),
				adminContent: { zones: { 'home.hero': heroFromAdmin } },
			}),
		);

		expect(r.source).toBe('admin');
		expect(r.policyTrace?.engineDecision).toEqual({
			outcome: 'rejected',
			rejectionReason: 'capability_not_allowed',
		});
	});

	it.each([
		['component', { componentVariantId: 'invented-component' }, 'component_variant_not_allowed'],
		['CSS', { cssVariantId: 'invented-css' }, 'css_variant_not_allowed'],
		['copy', { copyVariantId: 'invented-copy' }, 'copy_variant_not_allowed'],
	] as const)('rejects an invented %s variant ID', (_label, decisionOverride, reason) => {
		const r = resolveZone(makePolicyOpts({ decision: makeDecision(decisionOverride) }));

		expect(r.source).toBe('fallback');
		expect(r.policyTrace?.engineDecision.rejectionReason).toBe(reason);
	});

	it('rejects a malformed decision envelope before reading its content', () => {
		const malformed = makeDecision({ requiredCapabilityIds: [] });
		const r = resolveZone(makePolicyOpts({ decision: malformed }));

		expect(r.source).toBe('fallback');
		expect(r.policyTrace?.engineDecision.rejectionReason).toBe('invalid_decision_envelope');
	});

	it('rejects schema-invalid content with a machine-readable reason', () => {
		const r = resolveZone(
			makePolicyOpts({
				decision: makeDecision({ content: { component: 'editorial-header', props: {} } }),
			}),
		);

		expect(r.source).toBe('fallback');
		expect(r.policyTrace?.engineDecision.rejectionReason).toBe('invalid_zone_content');
	});

	it.each([
		['organization', { organizationId: 'other-org' }],
		['brand', { brandId: 'volt' }],
		['surface', { surface: 'plp' }],
		['zone', { zoneId: 'home.featured-row' }],
	] as const)('rejects cross-%s policy provenance', (_label, provenance) => {
		const policy = makePolicy({ provenance });
		const r = resolveZone(makePolicyOpts({ policy }));

		expect(r.source).toBe('fallback');
		expect(r.policyTrace?.policy.rejectionReason).toBe('policy_provenance_mismatch');
		expect(r.policyTrace?.engineDecision.rejectionReason).toBe('policy_provenance_mismatch');
	});

	it('rejects a trusted context that does not match the requested brand', () => {
		const policy = makePolicy();
		const r = resolveZone(
			makePolicyOpts({ policy, trustedContext: makeTrusted(policy, { brandId: 'volt' }) }),
		);

		expect(r.source).toBe('fallback');
		expect(r.policyTrace?.policy.rejectionReason).toBe('trusted_identity_mismatch');
	});

	it('never publishes holdout engine output, even when an approval is present', () => {
		const policy = makePolicy({ publicationMode: 'holdout' });
		const trusted = makeTrusted(policy, { approval: makeApproval(policy) });
		const r = resolveZone(makePolicyOpts({ policy, trustedContext: trusted }));

		expect(r.source).toBe('fallback');
		expect(r.policyTrace?.engineDecision.rejectionReason).toBe('publication_holdout');
	});

	it('requires a separately trusted approval for approval-required output', () => {
		const policy = makePolicy({ publicationMode: 'approval_required' });
		const browserShapedDecision = {
			...makeDecision(),
			approved: true,
			approvalId: 'browser-claim',
		} as EngineZoneDecision;
		const r = resolveZone(makePolicyOpts({ policy, decision: browserShapedDecision }));

		expect(r.source).toBe('fallback');
		expect(r.policyTrace?.engineDecision.rejectionReason).toBe('approval_required');
	});

	it('accepts approval-required output only when the trusted marker is fully bound', () => {
		const policy = makePolicy({ publicationMode: 'approval_required' });
		const trusted = makeTrusted(policy, { approval: makeApproval(policy) });
		const r = resolveZone(makePolicyOpts({ policy, trustedContext: trusted }));

		expect(r.source).toBe('engine');
		expect(r.policyTrace?.engineDecision.outcome).toBe('accepted');
	});

	it('rejects an approval marker bound to another zone', () => {
		const policy = makePolicy({ publicationMode: 'approval_required' });
		const approval = { ...makeApproval(policy), zoneId: 'home.featured-row.1' };
		const trusted = makeTrusted(policy, { approval });
		const r = resolveZone(makePolicyOpts({ policy, trustedContext: trusted }));

		expect(r.source).toBe('fallback');
		expect(r.policyTrace?.engineDecision.rejectionReason).toBe('approval_required');
	});

	it('lets an authorized merchant pin beat otherwise permitted engine output', () => {
		const policy = makePolicy();
		const trusted = makeTrusted(policy, { merchantOverride: makeMerchantOverride(policy) });
		const r = resolveZone(makePolicyOpts({ policy, trustedContext: trusted }));

		expect(r.source).toBe('merchant');
		expect(r.content).toEqual(heroFromAdmin);
		expect(r.policyTrace?.merchantOverride.outcome).toBe('accepted');
		expect(r.policyTrace?.engineDecision.outcome).toBe('superseded');
	});

	it('does not treat a merchant-looking engine field as trusted authority', () => {
		const browserShapedDecision = {
			...makeDecision(),
			merchantOverride: makeMerchantOverride(makePolicy()),
		} as EngineZoneDecision;
		const r = resolveZone(makePolicyOpts({ decision: browserShapedDecision }));

		expect(r.source).toBe('engine');
		expect(r.content).toEqual(heroEditorial);
		expect(r.policyTrace?.merchantOverride.outcome).toBe('not_provided');
	});

	it('rejects an unbound merchant pin and continues to the permitted engine decision', () => {
		const policy = makePolicy();
		const override = { ...makeMerchantOverride(policy), brandId: 'volt' };
		const trusted = makeTrusted(policy, { merchantOverride: override });
		const r = resolveZone(makePolicyOpts({ policy, trustedContext: trusted }));

		expect(r.source).toBe('engine');
		expect(r.policyTrace?.merchantOverride.rejectionReason).toBe('merchant_override_not_authorized');
		expect(r.policyTrace?.engineDecision.outcome).toBe('accepted');
	});
});
