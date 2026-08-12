/**
 * Server-side request signal extraction.
 *
 * Reads request-time signals (referrer, UTM, device, search query,
 * intent param, cookies) and emits them into a SignalStore.
 *
 * Uses the session manager to reuse stores across requests within
 * the same session, so client-side signals accumulate.
 */

import type { Persona } from './types';
import { PERSONAS } from './types';
import { getSessionStore, persistSession } from './session';
import { getBrand } from '$lib/brand/config';

const SESSION_COOKIE = 'aisles_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

interface RequestContext {
	url: URL;
	request: Request;
	cookies: {
		get: (name: string) => string | undefined;
		set: (name: string, value: string, opts: { path: string; maxAge?: number }) => void;
	};
	category: string;
}

/**
 * Get or create a session store and populate it with request-time signals.
 * Returns the store (which may already contain client-side signals from
 * earlier in the session) and the visit count for cookie updates.
 */
export async function createStoreFromRequest(ctx: RequestContext): Promise<{ store: Awaited<ReturnType<typeof getSessionStore>>; visitCount: number }> {
	// Get or create session
	let sessionId = ctx.cookies.get(SESSION_COOKIE) || null;
	if (!sessionId) {
		sessionId = crypto.randomUUID();
		ctx.cookies.set(SESSION_COOKIE, sessionId, { path: '/', maxAge: COOKIE_MAX_AGE });
	}

	const store = await getSessionStore(sessionId);
	store.setBrandId(getBrand().id);

	// Cross-session state from cookies
	const storedPersonaRaw = ctx.cookies.get('aisles_persona') || null;
	const storedPersona = (storedPersonaRaw && PERSONAS.includes(storedPersonaRaw as Persona))
		? storedPersonaRaw as Persona
		: null;
	const storedCategory = ctx.cookies.get('aisles_last_category') || null;
	const visitCount = parseInt(ctx.cookies.get('aisles_visits') || '0') + 1;

	store.setCrossSessionContext({
		storedPersona,
		storedCategory,
		visitCount,
		currentCategory: ctx.category,
	});

	const userAgent = ctx.request.headers.get('user-agent') || '';
	const viewport = detectDeviceType(userAgent);
	const eventContext = {
		page: ctx.url.pathname,
		category: ctx.category,
		viewport,
	};

	// Emit request.pageview
	store.emit('request.pageview', 'request', {
		referrer: ctx.request.headers.get('referer') || null,
		utm_source: ctx.url.searchParams.get('utm_source') || null,
		utm_medium: ctx.url.searchParams.get('utm_medium') || null,
		utm_campaign: ctx.url.searchParams.get('utm_campaign') || null,
		intent: ctx.url.searchParams.get('intent') || null,
	}, eventContext);

	// Emit request.device
	store.emit('request.device', 'request', {
		userAgent,
		deviceType: viewport,
	}, eventContext);

	// Emit request.search_landing if search query present
	const searchQuery = ctx.url.searchParams.get('q');
	if (searchQuery) {
		store.emit('request.search_landing', 'request', {
			query: searchQuery,
		}, eventContext);
	}

	// Emit request.promo_landing if entered with a promo or referral code
	const landedCode = ctx.url.searchParams.get('code');
	const landedRef = ctx.url.searchParams.get('ref');
	if (landedCode || landedRef) {
		store.emit('request.promo_landing', 'request', {
			code: landedCode,
			ref: landedRef,
		}, eventContext);
	}

	// Emit request.returning if visitor has history
	if (storedPersona || visitCount > 1) {
		store.emit('request.returning', 'request', {
			previousPersona: storedPersona,
			previousCategory: storedCategory,
			visitCount,
		}, eventContext);
	}

	// Persist to Redis after emitting request signals
	await persistSession(store);

	return { store, visitCount };
}

function detectDeviceType(userAgent: string): 'mobile' | 'tablet' | 'desktop' {
	if (/mobile|android.*mobile|iphone|ipod/i.test(userAgent)) return 'mobile';
	if (/tablet|ipad|android(?!.*mobile)/i.test(userAgent)) return 'tablet';
	return 'desktop';
}
