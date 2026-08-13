import {
	PERSONAS,
	type PersonaInference,
	type SignalSource,
} from './types';

const INFERENCE_KEYS = new Set([
	'probabilities', 'primary', 'confidence', 'entropy', 'certainty', 'modifiers',
	'shift', 'signalCount', 'lastUpdated', 'dominantSource', 'ruleMatches',
]);
const PROBABILITY_KEYS = new Set(PERSONAS);
const MODIFIER_KEYS = new Set(['priceSensitivity', 'urgency', 'familiarityWithStore']);
const SHIFT_KEYS = new Set(['detected', 'from', 'trigger']);
const RULE_MATCH_KEYS = new Set(['ruleName', 'weight', 'adjustment', 'reason']);
const ADJUSTMENT_KEYS = new Set([...PERSONAS, ...MODIFIER_KEYS]);
const RESPONSE_KEYS = new Set(['received', 'inference']);
const SOURCES = new Set<SignalSource>(['request', 'navigation', 'interaction', 'commerce', 'refinement', 'external']);
const EPSILON = 1e-9;

export type ConfirmedSignalBatch = {
	received: number;
	inference: PersonaInference | null;
};

/**
 * Validate the browser-facing /api/signals success contract before dispatching
 * its inference globally. Exact keys keep authority-like lookalikes and future
 * server additions from silently becoming client behavior.
 */
export function parseConfirmedSignalBatch(value: unknown, expectedCount: number): ConfirmedSignalBatch | null {
	if (!isRecord(value) || !hasExactKeys(value, RESPONSE_KEYS)) return null;
	if (!Number.isInteger(value.received) || value.received !== expectedCount) return null;
	if (value.inference === null) return { received: expectedCount, inference: null };
	const inference = parsePersonaInference(value.inference);
	return inference ? { received: expectedCount, inference } : null;
}

export function parsePersonaInference(value: unknown): PersonaInference | null {
	if (!isRecord(value) || !hasExactKeys(value, INFERENCE_KEYS)) return null;
	if (!isPersona(value.primary)) return null;

	const probabilities = value.probabilities;
	if (!isRecord(probabilities) || !hasExactKeys(probabilities, PROBABILITY_KEYS)) return null;
	if (!PERSONAS.every((persona) => isUnitInterval(probabilities[persona]))) return null;
	const probabilityValues = PERSONAS.map((persona) => probabilities[persona] as number);
	if (!approximately(probabilityValues.reduce((sum, probability) => sum + probability, 0), 1)) return null;
	const orderedProbabilities = [...probabilityValues].sort((left, right) => right - left);
	const expectedPrimary = PERSONAS.reduce((best, persona) =>
		(probabilities[persona] as number) > (probabilities[best] as number) ? persona : best,
	PERSONAS[0]);
	if (value.primary !== expectedPrimary) return null;

	if (!isUnitInterval(value.confidence)
		|| !approximately(value.confidence, orderedProbabilities[0] - orderedProbabilities[1])) return null;
	const expectedEntropy = probabilityValues.reduce((sum, probability) =>
		probability === 0 ? sum : sum - probability * Math.log(probability), 0);
	if (!isFiniteNumber(value.entropy) || value.entropy < 0 || value.entropy > Math.log(PERSONAS.length) + EPSILON
		|| !approximately(value.entropy, expectedEntropy)) return null;
	if (!isUnitInterval(value.certainty) || !approximately(value.certainty, 1 - value.entropy / Math.log(PERSONAS.length))) return null;

	const modifiers = value.modifiers;
	if (!isRecord(modifiers) || !hasExactKeys(modifiers, MODIFIER_KEYS)
		|| !isUnitInterval(modifiers.priceSensitivity)
		|| !isUnitInterval(modifiers.urgency)
		|| !isUnitInterval(modifiers.familiarityWithStore)) return null;

	const shift = value.shift;
	if (!isRecord(shift) || !hasExactKeys(shift, SHIFT_KEYS) || typeof shift.detected !== 'boolean') return null;
	if (!(shift.from === null || isPersona(shift.from))) return null;
	if (!(shift.trigger === null || isBoundedString(shift.trigger, 2_000))) return null;
	if (!shift.detected && (shift.from !== null || shift.trigger !== null)) return null;
	if (shift.detected && (shift.from === null || shift.from === value.primary || (value.confidence as number) < 0.1)) return null;

	if (!Number.isSafeInteger(value.signalCount) || (value.signalCount as number) < 0) return null;
	if (!Number.isSafeInteger(value.lastUpdated) || (value.lastUpdated as number) <= 0) return null;
	if (typeof value.dominantSource !== 'string' || !SOURCES.has(value.dominantSource as SignalSource)) return null;

	if (!Array.isArray(value.ruleMatches) || value.ruleMatches.length !== value.signalCount) return null;
	if (!value.ruleMatches.every(isRuleMatch)) return null;
	if (new Set(value.ruleMatches.map((match) => (match as Record<string, unknown>).ruleName)).size !== value.ruleMatches.length) return null;

	return value as unknown as PersonaInference;
}

function isRuleMatch(value: unknown): boolean {
	if (!isRecord(value) || !hasExactKeys(value, RULE_MATCH_KEYS)) return false;
	if (!isBoundedString(value.ruleName, 200) || !isBoundedString(value.reason, 2_000)) return false;
	if (!isFiniteNumber(value.weight) || value.weight < 0 || value.weight > 1) return false;
	if (!isRecord(value.adjustment) || !hasAllowedKeys(value.adjustment, ADJUSTMENT_KEYS)) return false;
	if (Object.keys(value.adjustment).length === 0) return false;
	return Object.values(value.adjustment).every(isUnitInterval);
}

function isPersona(value: unknown): value is PersonaInference['primary'] {
	return typeof value === 'string' && PERSONAS.includes(value as PersonaInference['primary']);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: ReadonlySet<string>): boolean {
	const keys = Object.keys(value);
	return keys.length === expected.size && keys.every((key) => expected.has(key));
}

function hasAllowedKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
	return Object.keys(value).every((key) => allowed.has(key));
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

function isUnitInterval(value: unknown): value is number {
	return isFiniteNumber(value) && value >= 0 && value <= 1;
}

function isBoundedString(value: unknown, maxLength: number): value is string {
	return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
}

function approximately(left: number, right: number): boolean {
	return Math.abs(left - right) <= EPSILON;
}
