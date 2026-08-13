import { KIBBLE_REFERENCE_CONTRACT } from './kibble';

export const KIBBLE_PARITY_METADATA = {
	contractId: 'data-reference-id',
	contractVersion: 'data-reference-contract-version',
	fixedDataIdentity: 'data-reference-fixture-sha256',
} as const;

export const KIBBLE_PARITY_FIXED_DATA_IDENTITY = KIBBLE_REFERENCE_CONTRACT.source.fixtureSha256;

export const KIBBLE_PARITY_VIEWPORTS = [
	{ name: 'mobile', width: 390, height: 844 },
	{ name: 'tablet', width: 768, height: 1024 },
	{ name: 'desktop', width: 1280, height: 900 },
] as const;

export const STRUCTURAL_METRIC_KEYS = [
	'header',
	'nav',
	'main',
	'footer',
	'h1',
	'h2',
	'h3',
	'section',
	'image',
	'link',
	'button',
	'pageHeight',
] as const;

export type StructuralMetricKey = (typeof STRUCTURAL_METRIC_KEYS)[number];
export type StructuralMetrics = Record<StructuralMetricKey, number>;

export const STYLE_METRIC_KEYS = [
	'rootBackgroundColor', 'rootColor', 'rootFontFamily',
	'h1FontFamily', 'h1FontSize', 'h1FontWeight', 'h1LineHeight', 'h1LetterSpacing',
	'containerRectLeft', 'containerRectRight', 'containerLeftGutter', 'containerRightGutter',
	'containerContentLeft', 'containerContentRight', 'containerContentWidth',
	'headerHeight', 'headerPosition',
] as const;

export type StyleMetricKey = (typeof STYLE_METRIC_KEYS)[number];
export type StyleMetrics = {
	rootBackgroundColor: string;
	rootColor: string;
	rootFontFamily: string;
	h1FontFamily: string;
	h1FontSize: string;
	h1FontWeight: string;
	h1LineHeight: string;
	h1LetterSpacing: string;
	containerRectLeft: number;
	containerRectRight: number;
	containerLeftGutter: number;
	containerRightGutter: number;
	containerContentLeft: number;
	containerContentRight: number;
	containerContentWidth: number;
	headerHeight: string;
	headerPosition: string;
};

export type ParityMetadata = {
	contractId: string;
	contractVersion: string;
	fixedDataIdentity: string;
};

export type ParityMask = {
	x: number;
	y: number;
	width: number;
	height: number;
	reason: string;
};

export type StructuralTolerances = Record<StructuralMetricKey, number>;

export type KibbleParityConfig = {
	referenceUrl: string;
	candidateUrl: string;
	expected: ParityMetadata;
	masks: ParityMask[];
	maxPixelDifferenceRatio: number;
	structuralTolerances: StructuralTolerances;
	outputDirectory: string;
};

export type ParityProblem = {
	field: string;
	message: string;
};

function required(environment: Record<string, string | undefined>, name: string): string {
	const value = environment[name]?.trim();
	if (!value) throw new Error(`${name} is required for a Kibble parity run`);
	return value;
}

function parseUrl(value: string, field: string): string {
	try {
		const url = new URL(value);
		if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol');
		return url.toString();
	} catch {
		throw new Error(`${field} must be an absolute http(s) URL`);
	}
}

function parseJson(value: string, field: string): unknown {
	try {
		return JSON.parse(value);
	} catch {
		throw new Error(`${field} must be valid JSON`);
	}
}

function parseMasks(value: string): ParityMask[] {
	const parsed = parseJson(value, 'KIBBLE_PARITY_MASKS');
	if (!Array.isArray(parsed)) throw new Error('KIBBLE_PARITY_MASKS must be a JSON array, including [] when no masks are allowed');

	return parsed.map((mask, index) => {
		if (!mask || typeof mask !== 'object') throw new Error(`KIBBLE_PARITY_MASKS[${index}] must be an object`);
		const candidate = mask as Record<string, unknown>;
		for (const field of ['x', 'y', 'width', 'height'] as const) {
			if (typeof candidate[field] !== 'number' || !Number.isFinite(candidate[field]) || candidate[field] < 0) {
				throw new Error(`KIBBLE_PARITY_MASKS[${index}].${field} must be a non-negative finite number`);
			}
		}
		if (candidate.width === 0 || candidate.height === 0) throw new Error(`KIBBLE_PARITY_MASKS[${index}] must cover a non-zero rectangle`);
		if (typeof candidate.reason !== 'string' || candidate.reason.trim().length === 0) {
			throw new Error(`KIBBLE_PARITY_MASKS[${index}].reason is required`);
		}
		return {
			x: candidate.x as number,
			y: candidate.y as number,
			width: candidate.width as number,
			height: candidate.height as number,
			reason: candidate.reason,
		};
	});
}

function parseTolerances(value: string): StructuralTolerances {
	const parsed = parseJson(value, 'KIBBLE_PARITY_STRUCTURE_TOLERANCES');
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error('KIBBLE_PARITY_STRUCTURE_TOLERANCES must be a JSON object with every structural metric');
	}
	const candidate = parsed as Record<string, unknown>;
	const tolerances = {} as StructuralTolerances;
	for (const metric of STRUCTURAL_METRIC_KEYS) {
		const valueForMetric = candidate[metric];
		if (typeof valueForMetric !== 'number' || !Number.isFinite(valueForMetric) || valueForMetric < 0) {
			throw new Error(`KIBBLE_PARITY_STRUCTURE_TOLERANCES.${metric} must be a non-negative finite number`);
		}
		tolerances[metric] = valueForMetric;
	}
	return tolerances;
}

/**
 * A run has no defaults for URLs, contract identity, masks, or thresholds.
 * That keeps the runner from turning a locally convenient screenshot into an
 * unreviewed green baseline.
 */
export function readKibbleParityConfig(
	environment: Record<string, string | undefined>,
): KibbleParityConfig {
	const maxPixelDifferenceRatio = Number(required(environment, 'KIBBLE_PARITY_MAX_PIXEL_DIFFERENCE_RATIO'));
	if (!Number.isFinite(maxPixelDifferenceRatio) || maxPixelDifferenceRatio < 0 || maxPixelDifferenceRatio > 1) {
		throw new Error('KIBBLE_PARITY_MAX_PIXEL_DIFFERENCE_RATIO must be a number between 0 and 1');
	}

	return {
		referenceUrl: parseUrl(required(environment, 'KIBBLE_PARITY_REFERENCE_URL'), 'KIBBLE_PARITY_REFERENCE_URL'),
		candidateUrl: parseUrl(required(environment, 'KIBBLE_PARITY_CANDIDATE_URL'), 'KIBBLE_PARITY_CANDIDATE_URL'),
		expected: {
			contractId: required(environment, 'KIBBLE_PARITY_CONTRACT_ID'),
			contractVersion: required(environment, 'KIBBLE_PARITY_CONTRACT_VERSION'),
			fixedDataIdentity: required(environment, 'KIBBLE_PARITY_FIXED_DATA_IDENTITY'),
		},
		masks: parseMasks(required(environment, 'KIBBLE_PARITY_MASKS')),
		maxPixelDifferenceRatio,
		structuralTolerances: parseTolerances(required(environment, 'KIBBLE_PARITY_STRUCTURE_TOLERANCES')),
		outputDirectory: environment.KIBBLE_PARITY_OUTPUT_DIR?.trim() || 'validation/kibble-parity',
	};
}

export function compareParityMetadata(
	expected: ParityMetadata,
	actual: Partial<ParityMetadata>,
	pageLabel: string,
): ParityProblem[] {
	const problems: ParityProblem[] = [];
	for (const field of Object.keys(expected) as Array<keyof ParityMetadata>) {
		const received = actual[field];
		if (!received) {
			problems.push({ field, message: `${pageLabel} is missing ${KIBBLE_PARITY_METADATA[field]}` });
		} else if (received !== expected[field]) {
			problems.push({ field, message: `${pageLabel} ${field} mismatch: expected ${expected[field]}, received ${received}` });
		}
	}
	return problems;
}

export function compareStructuralMetrics(
	reference: StructuralMetrics,
	candidate: StructuralMetrics,
	tolerances: StructuralTolerances,
): ParityProblem[] {
	return STRUCTURAL_METRIC_KEYS.flatMap((metric) => {
		const delta = Math.abs(reference[metric] - candidate[metric]);
		return delta > tolerances[metric]
			? [{ field: metric, message: `${metric} delta ${delta} exceeds allowed ${tolerances[metric]} (reference ${reference[metric]}, candidate ${candidate[metric]})` }]
			: [];
	});
}

/** Computed styles are exact identity checks; do not normalize the page first. */
export function compareStyleMetrics(reference: StyleMetrics, candidate: StyleMetrics): ParityProblem[] {
	return STYLE_METRIC_KEYS.flatMap((metric) => reference[metric] === candidate[metric]
		? []
		: [{ field: `style.${metric}`, message: `${metric} mismatch: reference ${reference[metric]}, candidate ${candidate[metric]}` }]);
}

export function assessPixelDifference(
	differenceRatio: number | null,
	maxDifferenceRatio: number,
): ParityProblem[] {
	if (differenceRatio === null) return [{ field: 'screenshot', message: 'Screenshot dimensions differ; pixels are not comparable.' }];
	if (differenceRatio > maxDifferenceRatio) {
		return [{ field: 'screenshot', message: `Pixel difference ${(differenceRatio * 100).toFixed(3)}% exceeds allowed ${(maxDifferenceRatio * 100).toFixed(3)}%.` }];
	}
	return [];
}
