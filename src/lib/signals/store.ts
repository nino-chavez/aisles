/**
 * Signal Store: session-scoped buffer of SignalEvent objects.
 *
 * The store accumulates events, computes aggregates, and exposes
 * a toInferenceContext() method that the inference engine consumes.
 *
 * Phase 2: created per-request on the server. No persistence yet.
 * Phase 3: backed by Upstash Redis with 30-min session TTL.
 */

import type {
	SignalEvent,
	SignalEventType,
	SignalSource,
	InferenceContext,
	Persona,
} from './types';
export class SignalStore {
	readonly sessionId: string;
	private events: SignalEvent[] = [];
	private sequence = 0;

	// Cross-session state (populated from cookies on creation)
	private storedPersona: Persona | null = null;
	private storedCategory: string | null = null;
	private visitCount = 0;
	private currentCategory = '';
	private brandId = 'haven';
	private scenarioId: string | null = null;

	// Loyalty state (populated from UIP evaluator at render time)
	private walletBalanceMinor = 0;
	private tierUnitsToNext: number | null = null;

	constructor(sessionId: string) {
		this.sessionId = sessionId;
	}

	/** Set cross-session context from cookies. Called once at store creation. */
	setCrossSessionContext(opts: {
		storedPersona: Persona | null;
		storedCategory: string | null;
		visitCount: number;
		currentCategory: string;
	}) {
		this.storedPersona = opts.storedPersona;
		this.storedCategory = opts.storedCategory;
		this.visitCount = opts.visitCount;
		this.currentCategory = opts.currentCategory;
	}

	/** Set the active storefront brand. Persisted with the session for API events. */
	setBrandId(brandId: string) {
		this.brandId = brandId;
	}

	/** Scenario provenance is explicit so demo sessions never pass as observed behavior. */
	setScenarioId(scenarioId: string | null) {
		this.scenarioId = scenarioId;
	}

	/** Set loyalty state from the UIP evaluator. Called after cart eval, before inference. */
	setLoyaltyContext(opts: { walletBalanceMinor: number; tierUnitsToNext: number | null }) {
		this.walletBalanceMinor = opts.walletBalanceMinor;
		this.tierUnitsToNext = opts.tierUnitsToNext;
	}

	/** Append a signal event to the store. */
	emit(type: SignalEventType, source: SignalSource, data: Record<string, unknown>, context?: Partial<SignalEvent['context']>) {
		const event: SignalEvent = {
			id: crypto.randomUUID(),
			sessionId: this.sessionId,
			timestamp: Date.now(),
			sequence: this.sequence++,
			type,
			source,
			data,
			context: {
				page: context?.page ?? '/',
				category: context?.category ?? (this.currentCategory || null),
				viewport: context?.viewport ?? 'desktop',
			},
		};
		this.events.push(event);
		return event;
	}

	/** Restore a previously-persisted event without generating new ID/timestamp. */
	restore(event: SignalEvent) {
		this.events.push(event);
		if (event.sequence >= this.sequence) {
			this.sequence = event.sequence + 1;
		}
	}

	/** Get all events in order. */
	getEvents(): readonly SignalEvent[] {
		return this.events;
	}

	/** How many events are in the store. */
	get eventCount(): number {
		return this.events.length;
	}

	/** Get cross-session context (for Redis persistence). */
	getCrossSessionContext() {
		return {
			brandId: this.brandId,
			scenarioId: this.scenarioId,
			storedPersona: this.storedPersona as string | null,
			storedCategory: this.storedCategory,
			visitCount: this.visitCount,
			currentCategory: this.currentCategory,
		};
	}

	/**
	 * Build an InferenceContext from accumulated events + cross-session state.
	 * This is the bridge between the signal store and the inference engine.
	 */
	toInferenceContext(): InferenceContext {
		// Extract values from request-time events
		let intentParam: string | null = null;
		let searchQuery: string | null = null;
		let referrer: string | null = null;
		let utmSource: string | null = null;
		let utmMedium: string | null = null;
		let utmCampaign: string | null = null;
		let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop';
		let hourOfDay = new Date().getHours();
		let dayOfWeek = new Date().getDay();

		// Behavioral counters
		const categoriesViewed = new Set<string>();
		let categoryViewCount = 0;
		let productViewCount = 0;
		let cartAddCount = 0;
		let searchCount = 0;
		let refineMessageCount = 0;
		let backNavigationCount = 0;
		let maxScrollDepth = 0;
		const dwellTimes: number[] = [];
		let cartRemovalCount = 0;
		let landedWithCode = false;
		let appliedCodeCount = 0;
		let selectedCadenceMonths: 1 | 2 | 3 | null = null;
		let subscriptionSkipCount = 0;
		let subscriptionSwapCount = 0;
		let subscriptionPauseCount = 0;
		let dueProximityDays: number | null = null;
		let subscriptionTenureMonths: number | null = null;
		let autoshipMix: number | null = null;

		for (const event of this.events) {
			switch (event.type) {
				// Request-time signals (server-side)
				case 'request.pageview':
					referrer = (event.data.referrer as string) || null;
					utmSource = (event.data.utm_source as string) || null;
					utmMedium = (event.data.utm_medium as string) || null;
					utmCampaign = (event.data.utm_campaign as string) || null;
					intentParam = (event.data.intent as string) || null;
					break;
				case 'request.device':
					deviceType = (event.data.deviceType as 'mobile' | 'tablet' | 'desktop') || 'desktop';
					break;
				case 'request.search_landing':
					searchQuery = (event.data.query as string) || null;
					searchCount++;
					break;
				case 'request.returning':
					break;

				// Client-side behavioral signals
				case 'nav.search':
					searchQuery = (event.data.query as string) || null;
					searchCount++;
					break;
				case 'nav.category_view':
					if (event.data.category) {
						this.currentCategory = event.data.category as string;
						categoriesViewed.add(this.currentCategory);
						categoryViewCount++;
					}
					break;
				case 'nav.product_view':
					productViewCount++;
					break;
				case 'nav.back':
					backNavigationCount++;
					break;
				case 'commerce.add_to_cart':
					cartAddCount++;
					break;
				case 'refine.message':
					refineMessageCount++;
					break;
				case 'interact.scroll_depth': {
					const depth = (event.data.depth as number) || 0;
					if (depth > maxScrollDepth) maxScrollDepth = depth;
					break;
				}
				case 'interact.dwell_time': {
					const ms = (event.data.dwellMs as number) || 0;
					if (ms > 0) dwellTimes.push(ms);
					break;
				}
				case 'commerce.remove_from_cart':
					cartRemovalCount++;
					break;
				case 'request.promo_landing':
					landedWithCode = true;
					appliedCodeCount++;
					break;
				case 'commerce.promo_applied':
					appliedCodeCount++;
					break;
				case 'subscription.cadence_selected': {
					const months = event.data.months;
					if (months === 1 || months === 2 || months === 3) selectedCadenceMonths = months;
					break;
				}
				case 'subscription.skip':
					subscriptionSkipCount++;
					break;
				case 'subscription.swap':
					subscriptionSwapCount++;
					break;
				case 'subscription.pause':
					subscriptionPauseCount++;
					break;
				case 'subscription.due_proximity': {
					const days = event.data.days;
					if (typeof days === 'number' && Number.isFinite(days) && days >= 0) dueProximityDays = days;
					break;
				}
				case 'subscription.tenure': {
					const months = event.data.months;
					if (typeof months === 'number' && Number.isFinite(months) && months >= 0) subscriptionTenureMonths = months;
					break;
				}
				case 'commerce.autoship_mix': {
					const mix = event.data.mix;
					if (typeof mix === 'number' && Number.isFinite(mix) && mix >= 0 && mix <= 1) autoshipMix = mix;
					break;
				}
			}

			// Time context from the most recent event
			if (event.timestamp) {
				const d = new Date(event.timestamp);
				hourOfDay = d.getHours();
				dayOfWeek = d.getDay();
			}
		}

		return {
			brandId: this.brandId,
			intentParam,
			searchQuery,
			referrer,
			utmSource,
			utmMedium,
			utmCampaign,
			deviceType,
			hourOfDay,
			dayOfWeek,
			storedPersona: this.storedPersona,
			storedCategory: this.storedCategory,
			visitCount: this.visitCount,
			currentCategory: this.currentCategory,
			categoryViewCount,
			uniqueCategoriesViewed: [...categoriesViewed],
			productViewCount,
			cartAddCount,
			searchCount,
			refineMessageCount,
			backNavigationCount,
			maxScrollDepth,
			avgDwellTimeMs: dwellTimes.length > 0 ? dwellTimes.reduce((a, b) => a + b, 0) / dwellTimes.length : 0,
			longDwellCount: dwellTimes.filter((d) => d >= 15000).length,
			quickBounceCount: dwellTimes.filter((d) => d < 3000).length,
			cartRemovalCount,
			landedWithCode,
			appliedCodeCount,
			walletBalanceMinor: this.walletBalanceMinor,
			tierUnitsToNext: this.tierUnitsToNext,
			selectedCadenceMonths,
			subscriptionSkipCount,
			subscriptionSwapCount,
			subscriptionPauseCount,
			dueProximityDays,
			subscriptionTenureMonths,
			autoshipMix,
		};
	}
}
