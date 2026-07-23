/**
 * Validates the inference engine against the design spine scenarios.
 *
 * These are the 3 acts from design-spine.md — the acceptance criteria
 * for whether persona detection works correctly. Run with:
 *   npx tsx src/lib/signals/inference.test.ts
 */

import { infer } from './inference';
import type { InferenceContext } from './types';

// ─── Helpers ───────────────────────────────────────────────────────

const defaults: InferenceContext = {
	intentParam: null,
	searchQuery: null,
	referrer: null,
	utmSource: null,
	utmMedium: null,
	utmCampaign: null,
	deviceType: 'desktop',
	hourOfDay: 10, // Saturday morning
	dayOfWeek: 6,  // Saturday
	storedPersona: null,
	storedCategory: null,
	visitCount: 0,
	currentCategory: 'living-room',
	categoryViewCount: 0,
	uniqueCategoriesViewed: [],
	productViewCount: 0,
	cartAddCount: 0,
	searchCount: 0,
	refineMessageCount: 0,
	backNavigationCount: 0,
	maxScrollDepth: 0,
	avgDwellTimeMs: 0,
	longDwellCount: 0,
	quickBounceCount: 0,
	cartRemovalCount: 0,
	landedWithCode: false,
	appliedCodeCount: 0,
	walletBalanceMinor: 0,
	tierUnitsToNext: null,
};

function ctx(overrides: Partial<InferenceContext>): InferenceContext {
	return { ...defaults, ...overrides };
}

let passed = 0;
let failed = 0;

function assert(name: string, condition: boolean, detail: string) {
	if (condition) {
		console.log(`  PASS  ${name}`);
		passed++;
	} else {
		console.error(`  FAIL  ${name} — ${detail}`);
		failed++;
	}
}

// ─── Act 1: Cold Start — "modern living room furniture" ────────────

console.log('\nAct 1: Cold Start (new visitor, exploratory search)');
{
	const result = infer(ctx({
		searchQuery: 'modern living room furniture',
		referrer: 'https://www.google.com',
	}));

	assert(
		'Primary is gatherer',
		result.primary === 'gatherer',
		`got ${result.primary} (${JSON.stringify(result.probabilities)})`,
	);
	assert(
		'No persona shift',
		!result.shift.detected,
		`shift detected from ${result.shift.from}`,
	);
	assert(
		'Low price sensitivity',
		result.modifiers.priceSensitivity < 0.3,
		`priceSensitivity = ${result.modifiers.priceSensitivity}`,
	);
}

// ─── Act 2: Return Visit — Same Category, Continuity ──────────────

console.log('\nAct 2: Returning visitor, same category (continuity)');
{
	const result = infer(ctx({
		storedPersona: 'gatherer',
		storedCategory: 'living-room',
		visitCount: 2,
		currentCategory: 'living-room',
	}));

	assert(
		'Primary is still gatherer',
		result.primary === 'gatherer',
		`got ${result.primary} (${JSON.stringify(result.probabilities)})`,
	);
	assert(
		'No persona shift',
		!result.shift.detected,
		`shift detected from ${result.shift.from}`,
	);
	assert(
		'Some store familiarity',
		result.modifiers.familiarityWithStore > 0,
		`familiarity = ${result.modifiers.familiarityWithStore}`,
	);
}

// ─── Act 3: Return Visit — "dorm room desk" ───────────────────────

console.log('\nAct 3: Returning visitor, searches "dorm room desk" (persona shift)');
{
	const result = infer(ctx({
		searchQuery: 'dorm room desk',
		storedPersona: 'gatherer',
		storedCategory: 'living-room',
		visitCount: 3,
		currentCategory: 'office',
	}));

	assert(
		'Primary shifts to hunter',
		result.primary === 'hunter',
		`got ${result.primary} (${JSON.stringify(result.probabilities)})`,
	);
	assert(
		'Persona shift detected',
		result.shift.detected,
		'no shift detected',
	);
	assert(
		'Shift is from gatherer',
		result.shift.from === 'gatherer',
		`shift.from = ${result.shift.from}`,
	);
	assert(
		'High price sensitivity',
		result.modifiers.priceSensitivity > 0.3,
		`priceSensitivity = ${result.modifiers.priceSensitivity}`,
	);
	assert(
		'Shift trigger mentions search query',
		result.shift.trigger?.includes('dorm room desk') ?? false,
		`trigger = ${result.shift.trigger}`,
	);
}

// ─── Edge Cases ────────────────────────────────────────────────────

console.log('\nEdge: Explicit intent param overrides everything');
{
	const result = infer(ctx({
		intentParam: 'hunter',
		searchQuery: 'browse inspiration ideas',
		storedPersona: 'gatherer',
		storedCategory: 'living-room',
		visitCount: 5,
	}));

	assert(
		'Primary follows intent param',
		result.primary === 'hunter',
		`got ${result.primary} (${JSON.stringify(result.probabilities)})`,
	);
}

console.log('\nEdge: Gift campaign UTM');
{
	const result = infer(ctx({
		utmCampaign: 'holiday-gift-guide',
		utmSource: 'email',
	}));

	assert(
		'Gifter gets a meaningful boost',
		result.probabilities.gifter > result.probabilities.researcher,
		`gifter=${result.probabilities.gifter.toFixed(2)}, researcher=${result.probabilities.researcher.toFixed(2)}`,
	);
}

console.log('\nEdge: Review-site referrer');
{
	const result = infer(ctx({
		referrer: 'https://www.wirecutter.com/reviews/best-desks',
	}));

	assert(
		'Researcher gets boosted above base',
		result.probabilities.researcher > 0.25, // base is ~0.22 without signals
		`researcher=${result.probabilities.researcher.toFixed(2)}`,
	);
}

console.log('\nEdge: Cold start with no signals');
{
	const result = infer(ctx({}));

	assert(
		'Defaults to gatherer',
		result.primary === 'gatherer',
		`got ${result.primary}`,
	);
	assert(
		'Probabilities sum to ~1.0',
		Math.abs(
			result.probabilities.gatherer +
			result.probabilities.hunter +
			result.probabilities.researcher +
			result.probabilities.gifter - 1.0
		) < 0.01,
		`sum = ${result.probabilities.gatherer + result.probabilities.hunter + result.probabilities.researcher + result.probabilities.gifter}`,
	);
}

console.log('\nEdge: Category-conditional priors');
{
	const sale = infer(ctx({ currentCategory: 'sale-furniture' }));
	const newArrivals = infer(ctx({ currentCategory: 'new-arrivals' }));
	const gifts = infer(ctx({ currentCategory: 'gift-guide' }));
	const reviews = infer(ctx({ currentCategory: 'desk-reviews' }));

	assert(
		'Sale category biases toward hunter',
		sale.primary === 'hunter',
		`sale primary=${sale.primary} (${JSON.stringify(sale.probabilities)})`,
	);
	assert(
		'New-arrivals biases toward gatherer',
		newArrivals.primary === 'gatherer',
		`new-arrivals primary=${newArrivals.primary}`,
	);
	assert(
		'Gift category biases toward gifter',
		gifts.primary === 'gifter',
		`gifts primary=${gifts.primary}`,
	);
	assert(
		'Review category biases toward researcher',
		reviews.primary === 'researcher',
		`reviews primary=${reviews.primary}`,
	);
}

console.log('\nEdge: Entropy is maximal on cold start, lower on strong signal');
{
	const cold = infer(ctx({}));
	const sharp = infer(ctx({ intentParam: 'hunter' }));

	assert(
		'Cold start has high entropy (close to log(4))',
		cold.entropy > 1.2,
		`cold entropy = ${cold.entropy.toFixed(3)}`,
	);
	assert(
		'Sharp signal has lower entropy than cold start',
		sharp.entropy < cold.entropy,
		`sharp=${sharp.entropy.toFixed(3)} cold=${cold.entropy.toFixed(3)}`,
	);
	assert(
		'Certainty is in [0, 1]',
		sharp.certainty >= 0 && sharp.certainty <= 1 && cold.certainty >= 0 && cold.certainty <= 1,
		`sharp=${sharp.certainty}, cold=${cold.certainty}`,
	);
	assert(
		'Sharp signal certainty > cold certainty',
		sharp.certainty > cold.certainty,
		`sharp=${sharp.certainty.toFixed(3)}, cold=${cold.certainty.toFixed(3)}`,
	);
}

// ─── Phase 2: Incentive signals ────────────────────────────────────

console.log('\nPhase 2: Landing with a promo code biases toward hunter');
{
	const landed = infer(ctx({ landedWithCode: true, appliedCodeCount: 1 }));
	const cold = infer(ctx({}));

	assert(
		'Landing with code → hunter is primary',
		landed.primary === 'hunter',
		`got ${landed.primary} (${JSON.stringify(landed.probabilities)})`,
	);
	assert(
		'Landing with code raises priceSensitivity',
		landed.modifiers.priceSensitivity > 0.2,
		`priceSensitivity = ${landed.modifiers.priceSensitivity}`,
	);
	assert(
		'Landing with code raises hunter probability vs cold start',
		landed.probabilities.hunter > cold.probabilities.hunter,
		`landed=${landed.probabilities.hunter.toFixed(3)} cold=${cold.probabilities.hunter.toFixed(3)}`,
	);
	const rule = landed.ruleMatches.find((r) => r.ruleName === 'promo-landing-hunter');
	assert(
		'promo-landing-hunter rule fired',
		rule !== undefined,
		`rules fired: ${landed.ruleMatches.map((r) => r.ruleName).join(', ')}`,
	);
	assert(
		'Rule reason is human-readable',
		Boolean(rule?.reason && rule.reason.includes('deal intent')),
		`reason = "${rule?.reason}"`,
	);
}

console.log('\nPhase 2: Near a loyalty tier boundary adds urgency');
{
	const nearTier = infer(ctx({ tierUnitsToNext: 200 }));
	const farFromTier = infer(ctx({ tierUnitsToNext: 2000 }));

	assert(
		'Near-tier session has higher urgency than far-tier',
		nearTier.modifiers.urgency > farFromTier.modifiers.urgency,
		`near=${nearTier.modifiers.urgency} far=${farFromTier.modifiers.urgency}`,
	);
	const rule = nearTier.ruleMatches.find((r) => r.ruleName === 'tier-boundary-hunter');
	assert(
		'tier-boundary-hunter rule fires when within 500 units',
		rule !== undefined,
		'rule did not fire',
	);
	assert(
		'tier-boundary rule does not fire at 2000 units out',
		farFromTier.ruleMatches.find((r) => r.ruleName === 'tier-boundary-hunter') === undefined,
		'rule fired when it should not have',
	);
}

console.log('\nPhase 2: Wallet balance biases toward gatherer + familiarity');
{
	const withBalance = infer(ctx({ walletBalanceMinor: 2500 }));

	assert(
		'Wallet balance raises familiarityWithStore',
		withBalance.modifiers.familiarityWithStore > 0.1,
		`familiarity = ${withBalance.modifiers.familiarityWithStore}`,
	);
	const rule = withBalance.ruleMatches.find((r) => r.ruleName === 'wallet-balance-gatherer');
	assert(
		'wallet-balance-gatherer rule fired',
		rule !== undefined,
		'rule did not fire',
	);
	assert(
		'Reason describes the wallet balance',
		Boolean(rule?.reason && rule.reason.includes('$25.00')),
		`reason = "${rule?.reason}"`,
	);
}

console.log('\nPhase 2: Multi-code stacking compounds hunter signal');
{
	const stacked = infer(ctx({ landedWithCode: true, appliedCodeCount: 3 }));

	const ruleNames = stacked.ruleMatches.map((r) => r.ruleName);
	assert(
		'Both promo-landing-hunter and multi-code-stacking fire',
		ruleNames.includes('promo-landing-hunter') && ruleNames.includes('multi-code-stacking'),
		`rules fired: ${ruleNames.join(', ')}`,
	);
	assert(
		'Stacked session has very high priceSensitivity',
		stacked.modifiers.priceSensitivity > 0.5,
		`priceSensitivity = ${stacked.modifiers.priceSensitivity}`,
	);
}

// ─── Summary ───────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);
