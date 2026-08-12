/**
 * Inference engine: consumes an InferenceContext and outputs a PersonaInference.
 *
 * Math: the engine computes a Bayesian posterior over the 4 personas.
 *
 *     log P(persona | signals) = log P(persona) + Σ log P(signal_i | persona) + C
 *
 * Each rule contributes `weight × adjustment` as a log-likelihood-ratio for the
 * named persona(s). The persona-independent evidence term C cancels under
 * softmax normalization, so we only track the unnormalized log-posterior and
 * softmax at the end.
 *
 * Two calibration constants (PRIOR_STRENGTH, TEMPERATURE) account for the fact
 * that the current rule weights are hand-tuned rather than empirically fitted.
 * Once session outcomes (conversion, dwell-to-buy, return visits) are logged
 * and used to fit real likelihood ratios, both should move to 1.0.
 *
 * See docs/signals-and-inference.md for the full derivation.
 */

import {
	PERSONAS,
	type InferenceContext,
	type InferenceRule,
	type PersonaInference,
	type PersonaProbabilities,
	type PersonaScoreAdjustment,
	type Persona,
	type RuleMatch,
} from './types';
import learnedWeights from './learned-weights.json';

// ─── Learned weights (optional empirical override) ─────────────────
//
// scripts/fit-inference-lrs.ts produces a JSON map of rule → per-persona
// log-likelihood-ratios from labeled session outcomes. When a rule has an
// entry here with enough samples, its learned log-LR replaces the hand-tuned
// `adjustment × weight` product for that persona in the accumulation loop.
// Rules not present in the learned set fall back to the hand-tuned weights.

interface LearnedRuleEntry {
	fires: number;
	logLR: Record<Persona, number>;
}

interface LearnedWeightsFile {
	fittedAt: string | null;
	totalSessions: number;
	minSamples: number;
	rules: Record<string, LearnedRuleEntry>;
}

const LEARNED: LearnedWeightsFile = learnedWeights as LearnedWeightsFile;
const HAS_LEARNED_WEIGHTS = LEARNED.totalSessions > 0 && Object.keys(LEARNED.rules).length > 0;

// ─── Rules ─────────────────────────────────────────────────────────

const rules: InferenceRule[] = [
	// Explicit intent param — strongest signal
	{
		name: 'intent-param',
		weight: 1.0,
		evaluate: (ctx) => {
			if (!ctx.intentParam) return null;
			const p = ctx.intentParam as Persona;
			if (!PERSONAS.includes(p)) return null;
			return { [p]: 0.8 };
		},
	},

	// Search query keyword patterns
	{
		name: 'search-hunter-keywords',
		weight: 0.9,
		evaluate: (ctx) => {
			if (!ctx.searchQuery) return null;
			const q = ctx.searchQuery.toLowerCase();
			if (/cheap|budget|deal|dorm|under \$|affordable|sale|discount|clearance/.test(q)) {
				return { hunter: 0.4, priceSensitivity: 0.5 };
			}
			return null;
		},
	},
	{
		name: 'search-researcher-keywords',
		weight: 0.9,
		evaluate: (ctx) => {
			if (!ctx.searchQuery) return null;
			const q = ctx.searchQuery.toLowerCase();
			if (/review|compare|spec|vs\b|rating|best|versus|dimension|material/.test(q)) {
				return { researcher: 0.4 };
			}
			return null;
		},
	},
	{
		name: 'search-gifter-keywords',
		weight: 0.9,
		evaluate: (ctx) => {
			if (!ctx.searchQuery) return null;
			const q = ctx.searchQuery.toLowerCase();
			if (/gift|birthday|anniversary|present|for him|for her|housewarming|wedding/.test(q)) {
				return { gifter: 0.5 };
			}
			return null;
		},
	},
	{
		name: 'search-gatherer-keywords',
		weight: 0.8,
		evaluate: (ctx) => {
			if (!ctx.searchQuery) return null;
			const q = ctx.searchQuery.toLowerCase();
			if (/browse|explore|inspiration|ideas|modern|style|aesthetic|cozy/.test(q)) {
				return { gatherer: 0.3 };
			}
			return null;
		},
	},

	// Referrer signals
	{
		name: 'referrer-social',
		weight: 0.7,
		evaluate: (ctx) => {
			if (!ctx.referrer) return null;
			const r = ctx.referrer.toLowerCase();
			if (/pinterest|instagram|houzz/.test(r)) {
				return { gatherer: 0.3 };
			}
			return null;
		},
	},
	{
		name: 'referrer-deal-site',
		weight: 0.7,
		evaluate: (ctx) => {
			if (!ctx.referrer) return null;
			const r = ctx.referrer.toLowerCase();
			if (/slickdeals|retailmenot|honey|google\.com\/shopping/.test(r)) {
				return { hunter: 0.3, priceSensitivity: 0.3 };
			}
			return null;
		},
	},
	{
		name: 'referrer-review-site',
		weight: 0.7,
		evaluate: (ctx) => {
			if (!ctx.referrer) return null;
			const r = ctx.referrer.toLowerCase();
			if (/wirecutter|consumerreports|reddit/.test(r)) {
				return { researcher: 0.3 };
			}
			return null;
		},
	},

	// UTM signals
	{
		name: 'utm-gift-campaign',
		weight: 0.8,
		evaluate: (ctx) => {
			const campaign = (ctx.utmCampaign || '').toLowerCase();
			const source = (ctx.utmSource || '').toLowerCase();
			if (/gift|holiday|mother|father|wedding/.test(campaign) || /gift/.test(source)) {
				return { gifter: 0.4 };
			}
			return null;
		},
	},
	{
		name: 'utm-sale-campaign',
		weight: 0.7,
		evaluate: (ctx) => {
			const campaign = (ctx.utmCampaign || '').toLowerCase();
			if (/sale|clearance|deal|promo/.test(campaign)) {
				return { hunter: 0.2, priceSensitivity: 0.3 };
			}
			return null;
		},
	},

	// Device + time signals
	{
		name: 'mobile-evening-impulse',
		weight: 0.5,
		evaluate: (ctx) => {
			if (ctx.deviceType === 'mobile' && (ctx.hourOfDay >= 20 || ctx.hourOfDay <= 5)) {
				return { hunter: 0.1, urgency: 0.2 };
			}
			return null;
		},
	},
	{
		name: 'desktop-weekday-deliberate',
		weight: 0.4,
		evaluate: (ctx) => {
			if (ctx.deviceType === 'desktop' && ctx.dayOfWeek >= 1 && ctx.dayOfWeek <= 5 && ctx.hourOfDay >= 9 && ctx.hourOfDay <= 17) {
				return { researcher: 0.1 };
			}
			return null;
		},
	},

	// Cross-session signals
	{
		name: 'returning-same-category',
		weight: 0.7,
		evaluate: (ctx) => {
			if (!ctx.storedPersona || ctx.storedCategory !== ctx.currentCategory) return null;
			// Boost the stored persona — continuity
			return { [ctx.storedPersona]: 0.3, familiarityWithStore: 0.2 };
		},
	},
	{
		name: 'returning-different-category',
		weight: 0.5,
		evaluate: (ctx) => {
			if (!ctx.storedPersona || ctx.storedCategory === ctx.currentCategory) return null;
			// Soft continuity — stored persona still gets a mild boost
			return { [ctx.storedPersona]: 0.1, familiarityWithStore: 0.1 };
		},
	},
	{
		name: 'repeat-visitor-familiarity',
		weight: 0.5,
		evaluate: (ctx) => {
			if (ctx.visitCount <= 1) return null;
			const familiarity = Math.min(ctx.visitCount / 10, 1.0);
			return { familiarityWithStore: familiarity * 0.3 };
		},
	},

	// ─── Behavioral signals (in-session) ──────────────────────

	{
		name: 'broad-category-browsing',
		weight: 0.6,
		evaluate: (ctx) => {
			if (ctx.uniqueCategoriesViewed.length < 3) return null;
			// Browsing 3+ categories = exploratory gatherer behavior
			return { gatherer: 0.3 };
		},
	},
	{
		name: 'rapid-cart-adds',
		weight: 0.7,
		evaluate: (ctx) => {
			if (ctx.cartAddCount < 2) return null;
			// Multiple cart adds in one session = decisive hunter
			return { hunter: 0.3, urgency: 0.2 };
		},
	},
	{
		name: 'comparison-browsing',
		weight: 0.6,
		evaluate: (ctx) => {
			if (ctx.backNavigationCount < 2) return null;
			// Going back to grid multiple times = comparing products (researcher)
			return { researcher: 0.3 };
		},
	},
	{
		name: 'in-session-search',
		weight: 0.6,
		evaluate: (ctx) => {
			if (ctx.searchCount < 2) return null;
			// Multiple searches in one session = refining what they want (hunter or researcher)
			return { hunter: 0.15, researcher: 0.15 };
		},
	},
	{
		name: 'deep-product-exploration',
		weight: 0.5,
		evaluate: (ctx) => {
			if (ctx.productViewCount < 4) return null;
			// Viewing 4+ product pages = thorough research
			return { researcher: 0.25 };
		},
	},
	{
		name: 'refinement-chat-engaged',
		weight: 0.6,
		evaluate: (ctx) => {
			if (ctx.refineMessageCount === 0) return null;
			// Using the chat at all shows high engagement
			if (ctx.refineMessageCount >= 3) {
				return { researcher: 0.2, priceSensitivity: 0.1 };
			}
			return { hunter: 0.1 };
		},
	},
	{
		name: 'deep-scroll-exploration',
		weight: 0.5,
		evaluate: (ctx) => {
			if (ctx.maxScrollDepth < 75) return null;
			// Scrolled to bottom of page = thorough browsing
			return { gatherer: 0.15, researcher: 0.15 };
		},
	},
	{
		name: 'long-product-dwell',
		weight: 0.6,
		evaluate: (ctx) => {
			if (ctx.longDwellCount === 0) return null;
			// Spent 15s+ on product pages = reading carefully (not impulsive hunter)
			return { researcher: 0.25 };
		},
	},
	{
		name: 'quick-product-scanning',
		weight: 0.5,
		evaluate: (ctx) => {
			if (ctx.productViewCount < 3 || ctx.avgDwellTimeMs === 0) return null;
			if (ctx.avgDwellTimeMs > 8000) return null;
			// Short dwell + many views = scanning quickly (hunter behavior)
			return { hunter: 0.2, urgency: 0.1 };
		},
	},
	{
		name: 'single-category-focus',
		weight: 0.5,
		evaluate: (ctx) => {
			if (ctx.categoryViewCount < 3 || ctx.uniqueCategoriesViewed.length > 1) return null;
			// Multiple views but all in one category = focused intent
			return { hunter: 0.2 };
		},
	},

	// ─── Negative signals (Spotify skip-equivalent) ───────────

	{
		name: 'quick-bounce-pattern',
		weight: 0.6,
		evaluate: (ctx) => {
			if (ctx.quickBounceCount < 2) return null;
			// Multiple quick bounces (<3s dwell) = not finding what they want
			// Reduces hunter confidence (a hunter who found their target wouldn't bounce)
			return { gatherer: 0.2 };
		},
	},
	{
		name: 'cart-removal-indecision',
		weight: 0.7,
		evaluate: (ctx) => {
			if (ctx.cartRemovalCount === 0) return null;
			// Removing items from cart = reconsidering (researcher behavior)
			return { researcher: 0.2, priceSensitivity: 0.15 };
		},
	},

	// ─── Incentive signals (Phase 2 UIP integration) ──────────
	// Landing with a code is a strong hunter signal — they came with deal intent.
	{
		name: 'promo-landing-hunter',
		weight: 0.9,
		evaluate: (ctx) => {
			if (!ctx.landedWithCode) return null;
			return { hunter: 0.4, priceSensitivity: 0.4, urgency: 0.2 };
		},
	},
	// Multiple applied codes in one session = stacking deals = pure hunter behavior.
	{
		name: 'multi-code-stacking',
		weight: 0.6,
		evaluate: (ctx) => {
			if (ctx.appliedCodeCount < 2) return null;
			return { hunter: 0.2, priceSensitivity: 0.3 };
		},
	},
	// Within ~20% of the next loyalty tier — urgency to push over the threshold.
	{
		name: 'tier-boundary-hunter',
		weight: 0.7,
		evaluate: (ctx) => {
			if (ctx.tierUnitsToNext == null || ctx.tierUnitsToNext <= 0) return null;
			// "Close" = under 500 units for small tiers, under 20% of a guessed-2000 for larger.
			// Using a flat 500-unit threshold keeps the rule explainable.
			if (ctx.tierUnitsToNext > 500) return null;
			return { hunter: 0.25, urgency: 0.25 };
		},
	},
	// Wallet with a balance = returning member with something to spend. They browse,
	// not hunt — the money's already there so exploration is cheap.
	{
		name: 'wallet-balance-gatherer',
		weight: 0.5,
		evaluate: (ctx) => {
			if (ctx.walletBalanceMinor <= 0) return null;
			return { gatherer: 0.2, familiarityWithStore: 0.3 };
		},
	},

	// ─── Kibble subscription signals ───────────────────────────
	// These rules are deliberately brand-gated: a standing order is meaningful
	// for Kibble's replenishment model, but is not evidence for other brands.
	{
		name: 'kibble-subscription-cadence-selected',
		weight: 0.5,
		evaluate: (ctx) => {
			if (ctx.brandId !== 'kibble' || !ctx.selectedCadenceMonths) return null;
			if (ctx.selectedCadenceMonths === 1) {
				return { hunter: 0.15, urgency: 0.25, familiarityWithStore: 0.1 };
			}
			return { hunter: 0.1, familiarityWithStore: 0.1 };
		},
	},
	{
		name: 'kibble-subscription-skip',
		weight: 0.5,
		evaluate: (ctx) => {
			if (ctx.brandId !== 'kibble' || ctx.subscriptionSkipCount === 0) return null;
			return { researcher: 0.15, priceSensitivity: 0.1, familiarityWithStore: 0.1 };
		},
	},
	{
		name: 'kibble-subscription-swap',
		weight: 0.6,
		evaluate: (ctx) => {
			if (ctx.brandId !== 'kibble' || ctx.subscriptionSwapCount === 0) return null;
			return { researcher: 0.25, familiarityWithStore: 0.1 };
		},
	},
	{
		name: 'kibble-subscription-pause',
		weight: 0.5,
		evaluate: (ctx) => {
			if (ctx.brandId !== 'kibble' || ctx.subscriptionPauseCount === 0) return null;
			return { researcher: 0.15, priceSensitivity: 0.15, familiarityWithStore: 0.1 };
		},
	},
	{
		name: 'kibble-subscription-due-proximity',
		weight: 0.7,
		evaluate: (ctx) => {
			if (ctx.brandId !== 'kibble' || ctx.dueProximityDays == null || ctx.dueProximityDays > 7) return null;
			return ctx.dueProximityDays <= 3
				? { hunter: 0.2, urgency: 0.35, familiarityWithStore: 0.1 }
				: { hunter: 0.1, urgency: 0.2, familiarityWithStore: 0.1 };
		},
	},
	{
		name: 'kibble-subscription-tenure',
		weight: 0.7,
		evaluate: (ctx) => {
			if (ctx.brandId !== 'kibble' || ctx.subscriptionTenureMonths == null || ctx.subscriptionTenureMonths < 1) return null;
			return { familiarityWithStore: Math.min(ctx.subscriptionTenureMonths / 12, 1) * 0.5 };
		},
	},
	{
		name: 'kibble-commerce-autoship-mix',
		weight: 0.7,
		evaluate: (ctx) => {
			if (ctx.brandId !== 'kibble' || ctx.autoshipMix == null || ctx.autoshipMix <= 0) return null;
			// A standing order proves repeat familiarity, not Haven-style hunting.
			return { familiarityWithStore: ctx.autoshipMix * 0.5 };
		},
	},
];

// ─── Bayesian Engine ───────────────────────────────────────────────

/**
 * Default prior P(persona) for a cold-start session. Leans toward gatherer
 * because the exploratory layout is the safest default for an unknown
 * shopper. Must sum to 1.0.
 */
const DEFAULT_PRIOR: PersonaProbabilities = {
	gatherer: 0.375,
	hunter: 0.25,
	researcher: 0.25,
	gifter: 0.125,
};

/**
 * Category-conditional priors: P(persona | category). When a category
 * pattern matches `ctx.currentCategory`, its prior overrides the default.
 * These are hand-set from domain knowledge — swap for learned priors once
 * we have enough outcome data per category.
 *
 * Pattern match is a case-insensitive substring on the category slug.
 */
const CATEGORY_PRIORS: Array<{ pattern: RegExp; prior: PersonaProbabilities }> = [
	{
		// Sale / clearance / outlet — hunters lead, researchers second
		pattern: /sale|clearance|outlet|deal/i,
		prior: { gatherer: 0.15, hunter: 0.5, researcher: 0.25, gifter: 0.1 },
	},
	{
		// Gifts / registry — gifters dominate, rest flat
		pattern: /gift|registry|present|wedding/i,
		prior: { gatherer: 0.2, hunter: 0.2, researcher: 0.15, gifter: 0.45 },
	},
	{
		// New / trending / inspiration / lookbook — gatherers strongly lead
		pattern: /new|trend|inspir|lookbook|editorial/i,
		prior: { gatherer: 0.55, hunter: 0.15, researcher: 0.2, gifter: 0.1 },
	},
	{
		// Review / comparison / spec pages — researchers lead
		pattern: /review|compare|spec|guide/i,
		prior: { gatherer: 0.2, hunter: 0.2, researcher: 0.5, gifter: 0.1 },
	},
];

export function priorFor(currentCategory: string): PersonaProbabilities {
	if (currentCategory) {
		for (const { pattern, prior } of CATEGORY_PRIORS) {
			if (pattern.test(currentCategory)) return prior;
		}
	}
	return DEFAULT_PRIOR;
}

/**
 * Damping factor on the log-prior. The hand-tuned rule adjustments are small
 * in magnitude (≈0.1–0.8), so using the full log-prior (log(0.375) ≈ -0.98)
 * would overwhelm a single behavioral rule match. Weakening the prior keeps
 * the system responsive to in-session signals without discarding the prior
 * entirely. Once empirical likelihood ratios are fit from session outcomes,
 * this should move to 1.0.
 */
const PRIOR_STRENGTH = 0.3;

/**
 * Softmax temperature. T < 1 sharpens the posterior (more decisive), T > 1
 * flattens it. Our rule weights are conservative, so we sharpen to preserve
 * the decisiveness the linear-additive scoring had. When empirical LRs are
 * available this should move to 1.0.
 */
const TEMPERATURE = 0.5;

function logPriorFor(currentCategory: string): PersonaProbabilities {
	const prior = priorFor(currentCategory);
	return {
		gatherer: Math.log(prior.gatherer) * PRIOR_STRENGTH,
		hunter: Math.log(prior.hunter) * PRIOR_STRENGTH,
		researcher: Math.log(prior.researcher) * PRIOR_STRENGTH,
		gifter: Math.log(prior.gifter) * PRIOR_STRENGTH,
	};
}

/** Shannon entropy of a probability distribution, in nats. */
function posteriorEntropy(p: PersonaProbabilities): number {
	let h = 0;
	for (const persona of PERSONAS) {
		const x = p[persona];
		if (x > 0) h -= x * Math.log(x);
	}
	return h;
}

/** Softmax a log-posterior into a normalized probability distribution. */
function softmax(logs: PersonaProbabilities, temperature: number): PersonaProbabilities {
	const scaled = {
		gatherer: logs.gatherer / temperature,
		hunter: logs.hunter / temperature,
		researcher: logs.researcher / temperature,
		gifter: logs.gifter / temperature,
	};
	// Subtract the max for numerical stability before exponentiation
	const max = Math.max(scaled.gatherer, scaled.hunter, scaled.researcher, scaled.gifter);
	const e = {
		gatherer: Math.exp(scaled.gatherer - max),
		hunter: Math.exp(scaled.hunter - max),
		researcher: Math.exp(scaled.researcher - max),
		gifter: Math.exp(scaled.gifter - max),
	};
	const sum = e.gatherer + e.hunter + e.researcher + e.gifter;
	return {
		gatherer: e.gatherer / sum,
		hunter: e.hunter / sum,
		researcher: e.researcher / sum,
		gifter: e.gifter / sum,
	};
}

export function infer(ctx: InferenceContext): PersonaInference {
	// Accumulate the unnormalized log-posterior. Start from the damped log-prior
	// conditioned on the current category; each matching rule adds its weighted
	// log-likelihood-ratio.
	const logPosterior: PersonaProbabilities = { ...logPriorFor(ctx.currentCategory) };
	let priceSensitivity = 0;
	let urgency = 0;
	let familiarityWithStore = ctx.visitCount > 1 ? 0.1 : 0;
	let signalCount = 0;
	const dominantSource: 'request' | 'navigation' = 'request';
	const ruleMatches: RuleMatch[] = [];

	for (const rule of rules) {
		const adjustment = rule.evaluate(ctx);
		if (!adjustment) continue;

		signalCount++;

		ruleMatches.push({
			ruleName: rule.name,
			weight: rule.weight,
			adjustment,
			reason: describeRuleMatch(rule.name, ctx, adjustment),
		});

		// Each (weight × adjustment) is a log-likelihood-ratio contribution to
		// log P(persona | signals). Summed across rules under a naive-Bayes
		// independence assumption between signals. If a learned log-LR exists
		// for this rule, it replaces the hand-tuned product.
		const learned = HAS_LEARNED_WEIGHTS ? LEARNED.rules[rule.name] : undefined;
		if (learned) {
			// Empirical override — add the learned log-LR for every persona
			// (including ones the hand-tuned rule doesn't mention, since
			// empirical ratios capture full co-occurrence structure)
			for (const persona of PERSONAS) {
				logPosterior[persona] += learned.logLR[persona];
			}
		} else {
			for (const persona of PERSONAS) {
				if (adjustment[persona]) {
					logPosterior[persona] += adjustment[persona]! * rule.weight;
				}
			}
		}
		if (adjustment.priceSensitivity) {
			priceSensitivity = Math.min(1, priceSensitivity + adjustment.priceSensitivity * rule.weight);
		}
		if (adjustment.urgency) {
			urgency = Math.min(1, urgency + adjustment.urgency * rule.weight);
		}
		if (adjustment.familiarityWithStore) {
			familiarityWithStore = Math.min(1, familiarityWithStore + adjustment.familiarityWithStore * rule.weight);
		}
	}

	// Posterior = softmax(log-posterior / T)
	const probabilities = softmax(logPosterior, TEMPERATURE);

	// Shannon entropy in nats: H(p) = -Σ p log p
	// 0 if one persona has all the mass, log(4) ≈ 1.386 if uniform
	const entropy = posteriorEntropy(probabilities);
	const certainty = 1 - entropy / Math.log(PERSONAS.length);

	// Find primary persona and confidence
	const sorted = PERSONAS
		.map((p) => ({ persona: p, prob: probabilities[p] }))
		.sort((a, b) => b.prob - a.prob);

	const primary = sorted[0].persona;
	const confidence = sorted[0].prob - sorted[1].prob; // Gap between #1 and #2

	// Shift detection
	const shift = detectShift(primary, confidence, ctx);

	return {
		probabilities,
		primary,
		confidence,
		entropy,
		certainty,
		modifiers: {
			priceSensitivity,
			urgency,
			familiarityWithStore,
		},
		shift,
		signalCount,
		lastUpdated: Date.now(),
		dominantSource,
		ruleMatches,
	};
}

/** Generate a human-readable explanation for why a rule matched */
function describeRuleMatch(ruleName: string, ctx: InferenceContext, adj: PersonaScoreAdjustment): string {
	switch (ruleName) {
		case 'intent-param':
			return `URL param ?intent=${ctx.intentParam}`;
		case 'search-hunter-keywords':
			return `Search "${ctx.searchQuery}" matches deal/budget keywords`;
		case 'search-researcher-keywords':
			return `Search "${ctx.searchQuery}" matches research/comparison keywords`;
		case 'search-gifter-keywords':
			return `Search "${ctx.searchQuery}" matches gift/occasion keywords`;
		case 'search-gatherer-keywords':
			return `Search "${ctx.searchQuery}" matches inspiration/browse keywords`;
		case 'referrer-social':
			return `Referrer from social/visual platform: ${ctx.referrer}`;
		case 'referrer-deal-site':
			return `Referrer from deal site: ${ctx.referrer}`;
		case 'referrer-review-site':
			return `Referrer from review site: ${ctx.referrer}`;
		case 'utm-gift-campaign':
			return `UTM campaign "${ctx.utmCampaign}" indicates gifting intent`;
		case 'utm-sale-campaign':
			return `UTM campaign "${ctx.utmCampaign}" indicates deal-seeking`;
		case 'mobile-evening-impulse':
			return `Mobile device at ${ctx.hourOfDay}:00 — evening impulse pattern`;
		case 'desktop-weekday-deliberate':
			return `Desktop on weekday at ${ctx.hourOfDay}:00 — deliberate browsing`;
		case 'returning-same-category':
			return `Returning visitor, same category (${ctx.storedCategory}) — continuity boost for ${ctx.storedPersona}`;
		case 'returning-different-category':
			return `Returning visitor, different category (was ${ctx.storedCategory}, now ${ctx.currentCategory})`;
		case 'repeat-visitor-familiarity':
			return `Visit #${ctx.visitCount} — familiarity increases with repeat visits`;
		case 'broad-category-browsing':
			return `Browsed ${ctx.uniqueCategoriesViewed.length} categories (${ctx.uniqueCategoriesViewed.join(', ')}) — exploratory behavior`;
		case 'rapid-cart-adds':
			return `${ctx.cartAddCount} items added to cart — decisive, goal-oriented shopping`;
		case 'comparison-browsing':
			return `${ctx.backNavigationCount} back-navigations — comparing products in grid`;
		case 'in-session-search':
			return `${ctx.searchCount} searches this session — refining intent`;
		case 'deep-product-exploration':
			return `${ctx.productViewCount} product pages viewed — thorough research pattern`;
		case 'refinement-chat-engaged':
			return `${ctx.refineMessageCount} refinement messages — high engagement with AI assistant`;
		case 'deep-scroll-exploration':
			return `Scrolled to ${ctx.maxScrollDepth}% depth — exploring the full page`;
		case 'long-product-dwell':
			return `${ctx.longDwellCount} product page(s) with 15s+ dwell time — reading carefully`;
		case 'quick-product-scanning':
			return `${ctx.productViewCount} products viewed, avg ${Math.round(ctx.avgDwellTimeMs / 1000)}s each — scanning quickly`;
		case 'single-category-focus':
			return `${ctx.categoryViewCount} views in ${ctx.uniqueCategoriesViewed[0] || ctx.currentCategory} only — focused intent`;
		case 'quick-bounce-pattern':
			return `${ctx.quickBounceCount} product pages bounced in <3s — not finding what they want`;
		case 'cart-removal-indecision':
			return `${ctx.cartRemovalCount} item(s) removed from cart — reconsidering choices`;
		case 'promo-landing-hunter':
			return `Landed with a promo/referral code — came with deal intent`;
		case 'multi-code-stacking':
			return `${ctx.appliedCodeCount} promo codes applied — stacking deals`;
		case 'tier-boundary-hunter':
			return `${ctx.tierUnitsToNext} units from next loyalty tier — close to a reward`;
		case 'wallet-balance-gatherer':
			return `Loyalty wallet balance $${(ctx.walletBalanceMinor / 100).toFixed(2)} — returning member browsing with credit`;
		case 'kibble-subscription-cadence-selected':
			return `Kibble Auto-Refill cadence set to every ${ctx.selectedCadenceMonths} month${ctx.selectedCadenceMonths === 1 ? '' : 's'}`;
		case 'kibble-subscription-skip':
			return `${ctx.subscriptionSkipCount} Kibble shipment skip action(s) — actively managing a known subscription`;
		case 'kibble-subscription-swap':
			return `${ctx.subscriptionSwapCount} Kibble subscription swap action(s) — comparing a replacement item`;
		case 'kibble-subscription-pause':
			return `${ctx.subscriptionPauseCount} Kibble subscription pause action(s) — actively managing a known subscription`;
		case 'kibble-subscription-due-proximity':
			return `Kibble shipment due in ${ctx.dueProximityDays} day${ctx.dueProximityDays === 1 ? '' : 's'}`;
		case 'kibble-subscription-tenure':
			return `${ctx.subscriptionTenureMonths} month${ctx.subscriptionTenureMonths === 1 ? '' : 's'} subscribed to Kibble — strong store familiarity`;
		case 'kibble-commerce-autoship-mix':
			return `${Math.round((ctx.autoshipMix ?? 0) * 100)}% of the Kibble cart is on Auto-Refill — familiarity, not a new persona`;
		default: {
			const boosts = PERSONAS.filter((p) => adj[p] && adj[p]! > 0).map((p) => `+${adj[p]!.toFixed(1)} ${p}`);
			return boosts.length ? boosts.join(', ') : 'Rule matched';
		}
	}
}

function detectShift(
	primary: Persona,
	confidence: number,
	ctx: InferenceContext,
): PersonaInference['shift'] {
	if (!ctx.storedPersona || ctx.storedPersona === primary) {
		return { detected: false, from: null, trigger: null };
	}

	// Only flag a shift if the new primary has reasonable confidence
	if (confidence < 0.1) {
		return { detected: false, from: null, trigger: null };
	}

	// Determine what triggered the shift
	let trigger: string | null = null;
	if (ctx.searchQuery) {
		trigger = `search query "${ctx.searchQuery}" conflicts with stored ${ctx.storedPersona} model`;
	} else if (ctx.intentParam) {
		trigger = `explicit intent param override to ${ctx.intentParam}`;
	} else if (ctx.utmCampaign) {
		trigger = `UTM campaign "${ctx.utmCampaign}" suggests different intent`;
	} else if (ctx.referrer) {
		trigger = `referrer "${ctx.referrer}" suggests different intent`;
	}

	return {
		detected: true,
		from: ctx.storedPersona,
		trigger,
	};
}
