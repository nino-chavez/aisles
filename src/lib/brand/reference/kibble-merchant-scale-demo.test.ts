import { describe, expect, it } from 'vitest';
import {
	KIBBLE_MERCHANT_OPERATING_MODEL_IDS,
	KIBBLE_MERCHANT_SCALE_COVERAGE,
	KIBBLE_MERCHANT_SCALE_OWNERSHIP,
	KIBBLE_MERCHANT_SCALE_SCENARIOS,
	KIBBLE_CURRENT_CATALOG_LEDGER,
	KIBBLE_RESEARCH_CANDIDATE_LEDGER,
	getKibbleMerchantScaleScenario,
} from './kibble-merchant-scale-demo';

describe('Kibble merchant-scale demonstration', () => {
	it('keeps merchant size and capability maturity as separate axes', () => {
		expect(KIBBLE_MERCHANT_SCALE_SCENARIOS.map(({ id }) => id)).toEqual(KIBBLE_MERCHANT_OPERATING_MODEL_IDS);
		expect(KIBBLE_MERCHANT_SCALE_SCENARIOS.map(({ maturity }) => maturity)).toEqual(['assist', 'orchestrate', 'govern']);
		expect(new Set(KIBBLE_MERCHANT_SCALE_SCENARIOS.map(({ operatingModel }) => operatingModel)).size).toBe(3);
	});

	it('accounts for all current catalog and research rows exactly once', () => {
		expect(KIBBLE_CURRENT_CATALOG_LEDGER).toHaveLength(49);
		expect(KIBBLE_RESEARCH_CANDIDATE_LEDGER).toHaveLength(33);
		expect(new Set(KIBBLE_CURRENT_CATALOG_LEDGER.map(({ key }) => key)).size).toBe(49);
		expect(new Set(KIBBLE_RESEARCH_CANDIDATE_LEDGER.map(({ key }) => key)).size).toBe(33);
		expect(KIBBLE_CURRENT_CATALOG_LEDGER.every(({ merchantStatus }) => merchantStatus === 'current-catalog-evidence')).toBe(true);
		expect(KIBBLE_RESEARCH_CANDIDATE_LEDGER.every(({ merchantStatus }) => merchantStatus === 'not-approved-research')).toBe(true);
		expect(KIBBLE_MERCHANT_SCALE_COVERAGE.uniqueCatalogRowsIfApproved).toBe(82);
	});

	it('preserves overlapping reptile applicability without duplicating product rows', () => {
		const shared = KIBBLE_RESEARCH_CANDIDATE_LEDGER.filter(({ species }) =>
			species.includes('snake') && species.includes('bearded-dragon')
		);
		expect(shared).toHaveLength(4);
		expect(KIBBLE_MERCHANT_SCALE_COVERAGE).toMatchObject({
			snakeApplicableCandidates: 8,
			beardedDragonApplicableCandidates: 11,
			sharedReptileRows: 4,
		});
	});

	it('labels every medium and enterprise mock input as synthetic', () => {
		const medium = getKibbleMerchantScaleScenario('regional-team');
		const enterprise = getKibbleMerchantScaleScenario('enterprise-network');
		expect(medium.evidenceNote).toContain('Mock');
		expect(medium.evidenceNote).toContain('must not be quoted');
		expect(medium.inputs.filter(({ label }) => label !== 'Current category subset').every(({ evidenceClass }) =>
			evidenceClass === 'synthetic-operating-data'
		)).toBe(true);
		expect(enterprise.inputs.some(({ evidenceClass }) => evidenceClass === 'synthetic-operating-data')).toBe(true);
	});

	it('renders a reason and evidence class for every changed, kept, or withheld result', () => {
		for (const scenario of KIBBLE_MERCHANT_SCALE_SCENARIOS) {
			expect(scenario.decisions.length, scenario.id).toBeGreaterThan(0);
			for (const decision of scenario.decisions) {
				expect(['kept', 'changed', 'withheld']).toContain(decision.disposition);
				expect(decision.reason.length, decision.key).toBeGreaterThan(20);
				expect(decision.evidenceClass, decision.key).toBeTruthy();
			}
		}
	});

	it('keeps ownership boundaries explicit and non-overlapping', () => {
		expect(KIBBLE_MERCHANT_SCALE_OWNERSHIP.map(({ owner }) => owner)).toEqual([
			'merchant',
			'shopper',
			'aisles',
			'commerce-platform',
			'subscription-provider',
		]);
		expect(KIBBLE_MERCHANT_SCALE_OWNERSHIP.every(({ owns, doesNotOwn }) =>
			owns.length > 20 && doesNotOwn.length > 20
		)).toBe(true);
	});

	it('prevents portal-only enterprise capabilities from becoming catalog purchase evidence', () => {
		const decisions = getKibbleMerchantScaleScenario('enterprise-network').decisions;
		for (const key of ['enterprise-3066-prepaid', 'enterprise-3035-gift-plan', 'enterprise-3071-box-host']) {
			const decision = decisions.find((candidate) => candidate.key === key);
			expect(decision?.disposition, key).toBe('withheld');
			expect(decision?.after, key).toMatch(/Withheld/);
		}
	});
});
