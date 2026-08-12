/**
 * Validates that the SignalStore + request signal extraction produces
 * the same InferenceContext shape as the manual construction from Step 1.
 *
 * Run with: npx tsx src/lib/signals/store.test.ts
 */

import { SignalStore } from './store';
import { infer } from './inference';
import type { InferenceContext } from './types';

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

// ─── Test 1: Store produces valid InferenceContext ──────────────────

console.log('\nStore: basic request signals → InferenceContext');
{
	const store = new SignalStore('test-session-1');
	store.setCrossSessionContext({
		storedPersona: 'gatherer',
		storedCategory: 'living-room',
		visitCount: 3,
		currentCategory: 'office',
	});

	store.emit('request.pageview', 'request', {
		referrer: 'https://www.google.com',
		utm_source: 'email',
		utm_medium: null,
		utm_campaign: 'holiday-gift-guide',
		intent: null,
	});

	store.emit('request.device', 'request', {
		deviceType: 'mobile',
	});

	store.emit('request.search_landing', 'request', {
		query: 'dorm room desk',
	});

	store.emit('request.returning', 'request', {
		previousPersona: 'gatherer',
		previousCategory: 'living-room',
		visitCount: 3,
	});

	const ctx = store.toInferenceContext();

	assert('has referrer', ctx.referrer === 'https://www.google.com', `got ${ctx.referrer}`);
	assert('has utm_source', ctx.utmSource === 'email', `got ${ctx.utmSource}`);
	assert('has utm_campaign', ctx.utmCampaign === 'holiday-gift-guide', `got ${ctx.utmCampaign}`);
	assert('has search query', ctx.searchQuery === 'dorm room desk', `got ${ctx.searchQuery}`);
	assert('has device type', ctx.deviceType === 'mobile', `got ${ctx.deviceType}`);
	assert('has stored persona', ctx.storedPersona === 'gatherer', `got ${ctx.storedPersona}`);
	assert('has stored category', ctx.storedCategory === 'living-room', `got ${ctx.storedCategory}`);
	assert('has visit count', ctx.visitCount === 3, `got ${ctx.visitCount}`);
	assert('has current category', ctx.currentCategory === 'office', `got ${ctx.currentCategory}`);
	assert('no intent param', ctx.intentParam === null, `got ${ctx.intentParam}`);
	assert('event count is 4', store.eventCount === 4, `got ${store.eventCount}`);
}

// ─── Test 2: Store-based inference matches direct inference ─────────

console.log('\nStore: inference result matches direct construction');
{
	// Build context directly (the old way)
	const directCtx: InferenceContext = {
		brandId: 'haven',
		intentParam: null,
		searchQuery: 'dorm room desk',
		referrer: null,
		utmSource: null,
		utmMedium: null,
		utmCampaign: null,
		deviceType: 'desktop',
		hourOfDay: 10,
		dayOfWeek: 6,
		storedPersona: 'gatherer',
		storedCategory: 'living-room',
		visitCount: 3,
		currentCategory: 'office',
		categoryViewCount: 0,
		uniqueCategoriesViewed: [],
		productViewCount: 0,
		cartAddCount: 0,
		searchCount: 1,
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
		selectedCadenceMonths: null,
		subscriptionSkipCount: 0,
		subscriptionSwapCount: 0,
		subscriptionPauseCount: 0,
		dueProximityDays: null,
		subscriptionTenureMonths: null,
		autoshipMix: null,
	};

	// Build same context via store
	const store = new SignalStore('test-session-2');
	store.setCrossSessionContext({
		storedPersona: 'gatherer',
		storedCategory: 'living-room',
		visitCount: 3,
		currentCategory: 'office',
	});
	store.emit('request.pageview', 'request', {
		referrer: null,
		utm_source: null,
		utm_medium: null,
		utm_campaign: null,
		intent: null,
	});
	store.emit('request.device', 'request', { deviceType: 'desktop' });
	store.emit('request.search_landing', 'request', { query: 'dorm room desk' });
	store.emit('request.returning', 'request', {
		previousPersona: 'gatherer',
		previousCategory: 'living-room',
		visitCount: 3,
	});

	const storeCtx = store.toInferenceContext();

	// Compare the fields that matter for inference
	assert('searchQuery matches', storeCtx.searchQuery === directCtx.searchQuery, `${storeCtx.searchQuery} vs ${directCtx.searchQuery}`);
	assert('storedPersona matches', storeCtx.storedPersona === directCtx.storedPersona, `${storeCtx.storedPersona} vs ${directCtx.storedPersona}`);
	assert('currentCategory matches', storeCtx.currentCategory === directCtx.currentCategory, `${storeCtx.currentCategory} vs ${directCtx.currentCategory}`);
	assert('visitCount matches', storeCtx.visitCount === directCtx.visitCount, `${storeCtx.visitCount} vs ${directCtx.visitCount}`);
	assert('deviceType matches', storeCtx.deviceType === directCtx.deviceType, `${storeCtx.deviceType} vs ${directCtx.deviceType}`);

	// Run inference on both — primary persona should match
	const directResult = infer(directCtx);
	const storeResult = infer(storeCtx);

	assert(
		'same primary persona',
		directResult.primary === storeResult.primary,
		`direct=${directResult.primary}, store=${storeResult.primary}`,
	);
	assert(
		'same shift detection',
		directResult.shift.detected === storeResult.shift.detected,
		`direct=${directResult.shift.detected}, store=${storeResult.shift.detected}`,
	);
}

// ─── Test 3: Empty store produces sane defaults ─────────────────────

console.log('\nStore: empty store → default InferenceContext');
{
	const store = new SignalStore('test-session-3');
	store.setCrossSessionContext({
		storedPersona: null,
		storedCategory: null,
		visitCount: 1,
		currentCategory: 'living-room',
	});

	const ctx = store.toInferenceContext();

	assert('no intent param', ctx.intentParam === null, `got ${ctx.intentParam}`);
	assert('no search query', ctx.searchQuery === null, `got ${ctx.searchQuery}`);
	assert('no referrer', ctx.referrer === null, `got ${ctx.referrer}`);
	assert('default device desktop', ctx.deviceType === 'desktop', `got ${ctx.deviceType}`);
	assert('current category set', ctx.currentCategory === 'living-room', `got ${ctx.currentCategory}`);

	const result = infer(ctx);
	assert('defaults to gatherer', result.primary === 'gatherer', `got ${result.primary}`);
}

// ─── Test 4: Kibble subscription event payloads ────────────────────

console.log('\nStore: subscription events → Kibble inference fields');
{
	const store = new SignalStore('test-session-subscription');
	store.setBrandId('kibble');
	store.setCrossSessionContext({
		storedPersona: null,
		storedCategory: null,
		visitCount: 1,
		currentCategory: 'dog-food',
	});
	store.emit('subscription.cadence_selected', 'interaction', { months: 2 });
	store.emit('subscription.skip', 'interaction', {});
	store.emit('subscription.swap', 'interaction', {});
	store.emit('subscription.pause', 'interaction', {});
	store.emit('subscription.due_proximity', 'external', { days: 3 });
	store.emit('subscription.tenure', 'external', { months: 8 });
	store.emit('commerce.autoship_mix', 'commerce', { mix: 0.75 });
	// Invalid numeric payloads are deliberately ignored rather than coerced.
	store.emit('subscription.due_proximity', 'external', { days: -1 });
	store.emit('commerce.autoship_mix', 'commerce', { mix: 2 });

	const ctx = store.toInferenceContext();
	assert('retains Kibble brand', ctx.brandId === 'kibble', `got ${ctx.brandId}`);
	assert('retains selected cadence', ctx.selectedCadenceMonths === 2, `got ${ctx.selectedCadenceMonths}`);
	assert('counts subscription controls', ctx.subscriptionSkipCount === 1 && ctx.subscriptionSwapCount === 1 && ctx.subscriptionPauseCount === 1, `got skip=${ctx.subscriptionSkipCount}, swap=${ctx.subscriptionSwapCount}, pause=${ctx.subscriptionPauseCount}`);
	assert('retains valid due proximity', ctx.dueProximityDays === 3, `got ${ctx.dueProximityDays}`);
	assert('retains subscription tenure', ctx.subscriptionTenureMonths === 8, `got ${ctx.subscriptionTenureMonths}`);
	assert('retains valid autoship mix', ctx.autoshipMix === 0.75, `got ${ctx.autoshipMix}`);
}

// ─── Summary ───────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);
