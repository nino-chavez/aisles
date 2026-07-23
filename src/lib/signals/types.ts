/**
 * Signal and inference types for Aisles' persona detection system.
 *
 * Phase 2 replaces the one-shot regex → persona string with a continuous
 * signal stream → probability vector pipeline. These types define the
 * contract between signal sources, the inference engine, and layout generation.
 */

// ─── Personas ──────────────────────────────────────────────────────

export const PERSONAS = ['gatherer', 'hunter', 'researcher', 'gifter'] as const;
export type Persona = (typeof PERSONAS)[number];

// ─── Signal Event Schema ───────────────────────────────────────────

export type SignalSource =
	| 'request'     // Server-side, from HTTP request headers
	| 'navigation'  // Client-side, from page/route changes
	| 'interaction' // Client-side, from user actions (click, scroll, type)
	| 'commerce'    // Client-side, from cart/checkout actions
	| 'refinement'  // Client-side, from the refinement chat
	| 'external';   // Server-side, from CDP/BC/third-party

export type SignalEventType =
	// Request signals (server-side, page load)
	| 'request.pageview'
	| 'request.device'
	| 'request.geo'
	| 'request.search_landing'
	| 'request.returning'
	| 'request.promo_landing'
	// Navigation signals (client-side)
	| 'nav.category_view'
	| 'nav.product_view'
	| 'nav.search'
	| 'nav.back'
	// Interaction signals (client-side) — Phase 3
	| 'interact.scroll_depth'
	| 'interact.dwell_time'
	| 'interact.filter_use'
	| 'interact.sort_change'
	// Commerce signals (client-side)
	| 'commerce.add_to_cart'
	| 'commerce.remove_from_cart'
	| 'commerce.promo_applied'
	| 'commerce.tier_progress_view'
	// Refinement signals (client-side)
	| 'refine.message';

export interface SignalEvent {
	id: string;
	sessionId: string;
	timestamp: number;
	sequence: number;
	type: SignalEventType;
	source: SignalSource;
	data: Record<string, unknown>;
	context: {
		page: string;
		category: string | null;
		viewport: 'mobile' | 'tablet' | 'desktop';
	};
}

// ─── Inference Output ──────────────────────────────────────────────

export interface PersonaProbabilities {
	gatherer: number;
	hunter: number;
	researcher: number;
	gifter: number;
}

export interface PersonaModifiers {
	priceSensitivity: number;  // 0 = price-insensitive, 1 = very price-driven
	urgency: number;           // 0 = browsing, 1 = buying now
	familiarityWithStore: number; // 0 = first visit, 1 = loyal customer
}

export interface PersonaShift {
	detected: boolean;
	from: Persona | null;
	trigger: string | null;
}

export interface RuleMatch {
	ruleName: string;
	weight: number;
	adjustment: PersonaScoreAdjustment;
	reason: string;
}

export interface PersonaInference {
	probabilities: PersonaProbabilities;
	primary: Persona;
	/** Probability gap between primary and runner-up. Backward-compat confidence. */
	confidence: number;
	/** Posterior Shannon entropy in nats. Higher = less certain. Range [0, log(4) ≈ 1.386]. */
	entropy: number;
	/** 1 - entropy/log(4). Range [0, 1]. Higher = more certain. Principled confidence. */
	certainty: number;
	modifiers: PersonaModifiers;
	shift: PersonaShift;
	signalCount: number;
	lastUpdated: number;
	dominantSource: SignalSource;
	ruleMatches: RuleMatch[];
}

// ─── Inference Rules ───────────────────────────────────────────────

export interface PersonaScoreAdjustment {
	gatherer?: number;
	hunter?: number;
	researcher?: number;
	gifter?: number;
	priceSensitivity?: number;
	urgency?: number;
	familiarityWithStore?: number;
}

export interface InferenceRule {
	name: string;
	weight: number;
	evaluate: (ctx: InferenceContext) => PersonaScoreAdjustment | null;
}

/**
 * The context available to inference rules.
 * Populated from the full SignalStore: request-time + behavioral events.
 */
export interface InferenceContext {
	// Request-time signals
	intentParam: string | null;
	searchQuery: string | null;
	referrer: string | null;
	utmSource: string | null;
	utmMedium: string | null;
	utmCampaign: string | null;
	deviceType: 'mobile' | 'tablet' | 'desktop';
	hourOfDay: number;
	dayOfWeek: number; // 0 = Sunday
	// Cross-session signals (from cookies)
	storedPersona: Persona | null;
	storedCategory: string | null;
	visitCount: number;
	currentCategory: string;
	// Behavioral signals (accumulated in-session)
	categoryViewCount: number;       // How many different categories browsed
	uniqueCategoriesViewed: string[]; // Which categories
	productViewCount: number;        // Product detail page views
	cartAddCount: number;            // Items added to cart this session
	searchCount: number;             // In-session searches performed
	refineMessageCount: number;      // Refinement chat messages sent
	backNavigationCount: number;     // Times user went back to grid from product
	maxScrollDepth: number;          // Deepest scroll % on any category page (0-100)
	avgDwellTimeMs: number;          // Average time spent on product pages
	longDwellCount: number;          // Product pages with 15s+ dwell time
	// Negative signals (Spotify skip-equivalent)
	quickBounceCount: number;        // Product pages with <3s dwell (bounced)
	cartRemovalCount: number;        // Items removed from cart
	// Incentive signals (Phase 2 UIP integration)
	landedWithCode: boolean;         // URL had ?code= or ?ref= on entry
	appliedCodeCount: number;        // Count of promo codes applied this session
	walletBalanceMinor: number;      // Loyalty wallet active balance, minor units. 0 = no wallet.
	tierUnitsToNext: number | null;  // Units to next tier. null = no tier, 0 = at top tier.
}
