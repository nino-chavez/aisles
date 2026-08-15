import { describe, expect, it } from 'vitest';
import {
	KIBBLE_HOME_DEFAULT_PRESENTATION,
	KIBBLE_PDP_DEFAULT_PRESENTATION,
	KIBBLE_PLP_DEFAULT_PRESENTATION,
	materializeKibbleHomePresentation,
	materializeKibblePdpPresentation,
	materializeKibblePlpPresentation,
	parseKibbleHomePresentationDecision,
	parseKibblePdpPresentationDecision,
	parseKibblePlpPresentationDecision,
	snapshotKibbleHomePresentation,
	snapshotKibblePdpPresentation,
	snapshotKibblePlpPresentation,
} from './kibble-presentation-decisions';
import { buildKibbleDecisionEvidence, describeKibbleDecisionDimensions, hasKibbleDecisionChanged } from '$lib/components/kibble/kibble-dev-inspector';

const products = [
	{ id: 'one', name: 'Product One' },
	{ id: 'two', name: 'Product Two' },
];
const plpContext = { title: 'Dog Food', productCount: 8, productSingular: 'product', productPlural: 'products' };

describe('Kibble merchant presentation allow-lists', () => {
	it('accepts exact IDs and rejects extra fields, arbitrary copy, and unknown variants', () => {
		expect(parseKibbleHomePresentationDecision(KIBBLE_HOME_DEFAULT_PRESENTATION)).toEqual(KIBBLE_HOME_DEFAULT_PRESENTATION);
		expect(parseKibblePlpPresentationDecision(KIBBLE_PLP_DEFAULT_PRESENTATION)).toEqual(KIBBLE_PLP_DEFAULT_PRESENTATION);
		expect(parseKibblePdpPresentationDecision(KIBBLE_PDP_DEFAULT_PRESENTATION)).toEqual(KIBBLE_PDP_DEFAULT_PRESENTATION);
		expect(parseKibbleHomePresentationDecision({ ...KIBBLE_HOME_DEFAULT_PRESENTATION, copy: 'model-authored' })).toBeNull();
		expect(parseKibblePlpPresentationDecision({ ...KIBBLE_PLP_DEFAULT_PRESENTATION, marketingBlockVariantId: 'outside' })).toBeNull();
		expect(parseKibblePdpPresentationDecision({ ...KIBBLE_PDP_DEFAULT_PRESENTATION, relatedCopyVariantId: 'outside' })).toBeNull();
	});

	it('reports changed copy, component treatment, and section order even when product order is unchanged', () => {
		const before = snapshotKibbleHomePresentation(materializeKibbleHomePresentation(KIBBLE_HOME_DEFAULT_PRESENTATION));
		const after = snapshotKibbleHomePresentation(materializeKibbleHomePresentation({
			heroCopyVariantId: 'visit-fast-path',
			featuredCopyVariantId: 'visit-start',
			catalogCopyVariantId: 'routine-builder',
			catalogComponentVariantId: 'two-column',
			sectionOrderId: 'catalog-then-featured',
		}));
		const evidence = buildKibbleDecisionEvidence({
			surface: 'home', zoneIds: ['home.hero', 'home.featured-row.1', 'home.editorial-strip'], zoneLabel: 'Home presentation', policyVersion: 'home-v1',
			before: products, after: products, provider: 'anthropic', model: 'claude-haiku-4-5', calls: 1, state: 'applied',
			presentationBefore: before, presentationAfter: after,
		});
		expect(evidence.moved).toEqual([]);
		expect(evidence.zoneIds).toEqual(['home.hero', 'home.featured-row.1', 'home.editorial-strip']);
		expect(evidence.copy.filter(({ changed }) => changed)).toHaveLength(3);
		expect(evidence.components).toEqual([expect.objectContaining({ changed: true, before: 'Four-column category grid', after: 'Two-column category grid' })]);
		expect(evidence.sections).toEqual([expect.objectContaining({ changed: true })]);
		expect(hasKibbleDecisionChanged(evidence)).toBe(true);
		expect(describeKibbleDecisionDimensions(evidence)).toContain('copy, component treatment, section order');
	});

	it('states plainly when the model keeps the existing order and presentation', () => {
		const snapshot = snapshotKibbleHomePresentation(materializeKibbleHomePresentation(KIBBLE_HOME_DEFAULT_PRESENTATION));
		const evidence = buildKibbleDecisionEvidence({
			surface: 'home', zoneIds: ['home.hero', 'home.featured-row.1', 'home.editorial-strip'], zoneLabel: 'Home presentation', policyVersion: 'home-v1',
			before: products, after: products, provider: 'anthropic', model: 'claude-haiku-4-5', calls: 1, state: 'applied',
			presentationBefore: snapshot, presentationAfter: snapshot,
		});
		expect(hasKibbleDecisionChanged(evidence)).toBe(false);
		expect(evidence.copy.every(({ changed }) => !changed)).toBe(true);
		expect(describeKibbleDecisionDimensions(evidence)).toBe('AI kept the existing order, copy, and presentation.');
	});

	it('records optional PLP and PDP marketing blocks as added or unchanged', () => {
		const plpBefore = snapshotKibblePlpPresentation(materializeKibblePlpPresentation(KIBBLE_PLP_DEFAULT_PRESENTATION, plpContext));
		const plpAfter = snapshotKibblePlpPresentation(materializeKibblePlpPresentation({ headerCopyVariantId: 'guided-start', marketingBlockVariantId: 'routine-builder' }, plpContext));
		const pdpBefore = snapshotKibblePdpPresentation(materializeKibblePdpPresentation(KIBBLE_PDP_DEFAULT_PRESENTATION));
		const pdpAfter = snapshotKibblePdpPresentation(materializeKibblePdpPresentation({ relatedCopyVariantId: 'continue-routine', marketingBlockVariantId: 'compare-current' }));
		expect(plpBefore.marketingBlocks[0]).toMatchObject({ value: 'Not shown' });
		expect(plpAfter.marketingBlocks[0]).toMatchObject({ value: 'Explore what comes next.' });
		expect(pdpBefore.marketingBlocks[0]).toMatchObject({ value: 'Not shown' });
		expect(pdpAfter.marketingBlocks[0]).toMatchObject({ value: 'Keep product facts in view.' });
	});
});
