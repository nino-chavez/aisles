import { describe, expect, it } from 'vitest';
import {
	KIBBLE_PARITY_FIXED_DATA_IDENTITY,
	assessPixelDifference,
	compareParityMetadata,
	compareStyleMetrics,
	compareStructuralMetrics,
	readKibbleParityConfig,
	type StructuralMetrics,
} from './kibble-parity';

const metrics: StructuralMetrics = {
	header: 1, nav: 1, main: 1, footer: 1, h1: 1, h2: 3, h3: 15,
	section: 4, image: 13, link: 31, button: 4, pageHeight: 3120,
};

const environment = {
	KIBBLE_PARITY_REFERENCE_URL: 'http://reference.test/',
	KIBBLE_PARITY_CANDIDATE_URL: 'http://candidate.test/',
	KIBBLE_PARITY_CONTRACT_ID: 'kibble-shelf-native',
	KIBBLE_PARITY_CONTRACT_VERSION: '1.5.0',
	KIBBLE_PARITY_FIXED_DATA_IDENTITY,
	KIBBLE_PARITY_MASKS: '[]',
	KIBBLE_PARITY_MAX_PIXEL_DIFFERENCE_RATIO: '0.025',
	KIBBLE_PARITY_STRUCTURE_TOLERANCES: JSON.stringify({
		header: 0, nav: 0, main: 0, footer: 0, h1: 0, h2: 1, h3: 2,
		section: 1, image: 2, link: 3, button: 1, pageHeight: 120,
	}),
};

describe('Kibble visual parity configuration', () => {
	it('requires explicit URLs, identity, masks, and tolerances', () => {
		const config = readKibbleParityConfig(environment);
		expect(config.expected.fixedDataIdentity).toBe(KIBBLE_PARITY_FIXED_DATA_IDENTITY);
		expect(config.masks).toEqual([]);
		expect(() => readKibbleParityConfig({ ...environment, KIBBLE_PARITY_MASKS: undefined })).toThrow(/KIBBLE_PARITY_MASKS is required/);
		expect(() => readKibbleParityConfig({ ...environment, KIBBLE_PARITY_STRUCTURE_TOLERANCES: '{"header":0}' })).toThrow(/nav must be a non-negative/);
	});

	it('fails closed for missing or mismatched rendered provenance', () => {
		const expected = readKibbleParityConfig(environment).expected;
		expect(compareParityMetadata(expected, {}, 'reference')).toHaveLength(3);
		expect(compareParityMetadata(expected, { ...expected, contractVersion: '1.0.0' }, 'candidate')[0]?.message).toContain('mismatch');
	});

	it('compares declared structural tolerances and screenshot threshold', () => {
		const config = readKibbleParityConfig(environment);
		expect(compareStructuralMetrics(metrics, { ...metrics, h2: 4, pageHeight: 3240 }, config.structuralTolerances)).toEqual([]);
		expect(compareStructuralMetrics(metrics, { ...metrics, header: 2 }, config.structuralTolerances)[0]?.field).toBe('header');
		expect(assessPixelDifference(0.025, config.maxPixelDifferenceRatio)).toEqual([]);
		expect(assessPixelDifference(0.026, config.maxPixelDifferenceRatio)[0]?.message).toContain('exceeds');
		expect(assessPixelDifference(null, config.maxPixelDifferenceRatio)[0]?.message).toContain('dimensions differ');
	});

	it('fails when a computed visual token changes', () => {
		const styles = {
			rootBackgroundColor: 'rgb(243, 246, 252)', rootColor: 'rgb(30, 33, 80)', rootFontFamily: 'Plus Jakarta Sans',
			h1FontFamily: 'Plus Jakarta Sans', h1FontWeight: '800', h1LineHeight: '61.2px', h1LetterSpacing: '-2.1px',
			containerMaxWidth: '1200px', containerPaddingLeft: '0px', containerPaddingRight: '0px', headerHeight: '64px', headerPosition: 'sticky',
		};
		expect(compareStyleMetrics(styles, styles)).toEqual([]);
		expect(compareStyleMetrics(styles, { ...styles, h1FontWeight: '700' })[0]?.field).toBe('style.h1FontWeight');
	});
});
