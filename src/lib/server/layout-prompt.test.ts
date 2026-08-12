/**
 * Verifies that buildLayoutPrompt textually reflects the probability vector,
 * so the AI layout generator has the information needed to differentiate
 * sharp (confident) from flat (ambiguous) posteriors.
 *
 * Run: npx tsx src/lib/server/layout-prompt.test.ts
 */

import { buildLayoutPrompt } from './layout-prompt';

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

const products = [
	{
		id: 'p1',
		name: 'Harvest Chicken Air Dried Recipe',
		price: 34.99,
		salePrice: null,
		specs: { brand: 'Open Farm', recipe: 'chicken' },
		personaFit: { gatherer: 0.8, hunter: 0.4, researcher: 0.6, gifter: 0.3 },
		petProfile: {
			protein: 'chicken',
			lifeStage: 'adult',
			format: 'air-dried',
			dietary: 'grain-free',
			petSize: 'any',
			replenishmentDays: 30,
			subscriptionFit: 0.9,
		},
	} as unknown as Parameters<typeof buildLayoutPrompt>[2][number],
];

console.log('\nSharp vs flat probability vector');
{
	const sharp = buildLayoutPrompt(
		'hunter',
		'Dog Food',
		products,
		undefined,
		undefined,
		{ gatherer: 0.05, hunter: 0.9, researcher: 0.03, gifter: 0.02 },
	);
	const flat = buildLayoutPrompt(
		'hunter',
		'Dog Food',
		products,
		undefined,
		undefined,
		{ gatherer: 0.3, hunter: 0.35, researcher: 0.25, gifter: 0.1 },
	);

	assert(
		'Sharp prompt contains 90% hunter',
		sharp.includes('hunter 90%'),
		`no hunter 90% in sharp prompt`,
	);
	assert(
		'Flat prompt contains 35% hunter',
		flat.includes('hunter 35%'),
		`no hunter 35% in flat prompt`,
	);
	assert(
		'Sharp and flat prompts differ',
		sharp !== flat,
		'prompts identical — probability vector is decoration',
	);
	assert(
		'Sharp prompt reflects <25% secondaries (no blend hint activation)',
		sharp.includes('gatherer 5%') && sharp.includes('researcher 3%'),
		'sharp prompt missing low secondary percentages',
	);
	assert(
		'Flat prompt keeps researcher > 25% threshold visible',
		flat.includes('researcher 25%'),
		'flat prompt missing researcher 25%',
	);
}

console.log('\nKibble product profile injection');
{
	const prompt = buildLayoutPrompt('hunter', 'Dog Food', products);
	assert(
		'Prompt includes the pet profile and Auto-Refill fit',
		prompt.includes('chicken, adult, air-dried, grain-free, any') && prompt.includes('Auto-Refill fit: 90%'),
		'pet profile or subscription fit missing from product summary',
	);
	assert(
		'Prompt includes the expected replenishment cadence',
		prompt.includes('typical reorder: 30 days'),
		'replenishment cadence missing from product summary',
	);
}

console.log('\nPrompt without probabilities omits the blend hint');
{
	const noProbs = buildLayoutPrompt('hunter', 'Dog Food', products);
	const withProbs = buildLayoutPrompt('hunter', 'Dog Food', products, undefined, undefined, {
		gatherer: 0.05,
		hunter: 0.9,
		researcher: 0.03,
		gifter: 0.02,
	});

	assert(
		'No-probs prompt omits PROBABILITY VECTOR line',
		!noProbs.includes('PROBABILITY VECTOR'),
		'no-probs prompt leaked the probability line',
	);
	assert(
		'With-probs prompt includes PROBABILITY VECTOR line',
		withProbs.includes('PROBABILITY VECTOR'),
		'with-probs prompt missing the probability line',
	);
}

console.log('\nIncentive context injection');
{
	const withIncentives = buildLayoutPrompt(
		'hunter',
		'Dog Food',
		products,
		undefined,
		undefined,
		undefined,
		{
			walletBalanceMinor: 750,
			walletUnit: 'points',
			tierCurrent: 'Resident',
			tierNext: 'Host',
			tierUnitsToNext: 250,
			appliedCodes: ['BLCKFRDY'],
		},
	);
	const withoutIncentives = buildLayoutPrompt('hunter', 'Dog Food', products);

	assert(
		'Prompt surfaces wallet balance line',
		withIncentives.includes('750 points'),
		'missing wallet balance',
	);
	assert(
		'Prompt surfaces tier-progress line',
		withIncentives.includes('250 points from Host') && withIncentives.includes('Resident'),
		'missing tier progress',
	);
	assert(
		'Prompt surfaces applied code',
		withIncentives.includes('BLCKFRDY'),
		'missing applied code',
	);
	assert(
		'Prompt without incentives omits INCENTIVE STATE block',
		!withoutIncentives.includes('INCENTIVE STATE'),
		'leaked the incentives block when none were provided',
	);
}

console.log('\nIncentive context with empty/zero values stays silent');
{
	const empty = buildLayoutPrompt('hunter', 'Dog Food', products, undefined, undefined, undefined, {
		walletBalanceMinor: 0,
		appliedCodes: [],
	});
	assert(
		'Zero wallet + empty codes = no INCENTIVE STATE block',
		!empty.includes('INCENTIVE STATE'),
		'incentive block leaked despite zero/empty state',
	);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);
