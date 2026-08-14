import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';
import type { Cookies } from '@sveltejs/kit';
import type { KibbleCustomer } from './kibble-commerce';

export const KIBBLE_COMMERCE_SESSION_COOKIE = 'commerce_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export type KibbleCommerceSession = {
	customer: KibbleCustomer;
	accessToken: string;
	accessTokenExpiresAt: string | null;
	cartEntityId: string | null;
	providerSessionCookie: string | null;
};

type SessionEntry = {
	session: KibbleCommerceSession;
	expiresAt: number;
};

const memoryFallback = new Map<string, SessionEntry>();
let redis: import('@upstash/redis').Redis | null = null;
let redisInitialized = false;

export function hasKibbleCommerceSessionStorage(): boolean {
	return Boolean(env.KV_REST_API_URL && env.KV_REST_API_TOKEN);
}

function sessionKey(sessionId: string): string {
	return `aisles:kibble-commerce-session:${sessionId}`;
}

function randomSessionId(): string {
	return crypto.randomUUID();
}

async function getRedis(): Promise<import('@upstash/redis').Redis | null> {
	if (redisInitialized) return redis;
	redisInitialized = true;
	if (!env.KV_REST_API_URL || !env.KV_REST_API_TOKEN) return null;
	try {
		const { Redis } = await import('@upstash/redis');
		redis = new Redis({ url: env.KV_REST_API_URL, token: env.KV_REST_API_TOKEN });
		return redis;
	} catch (error) {
		console.warn('[kibble-commerce-session] Redis initialization failed:', error instanceof Error ? error.message : error);
		return null;
	}
}

async function writeSession(sessionId: string, session: KibbleCommerceSession): Promise<void> {
	const entry: SessionEntry = { session, expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000 };
	const store = await getRedis();
	if (store) {
		try {
			await store.set(sessionKey(sessionId), JSON.stringify(entry), { ex: SESSION_TTL_SECONDS });
			return;
		} catch (error) {
			console.warn('[kibble-commerce-session] Redis write failed; using memory fallback:', error instanceof Error ? error.message : error);
		}
	}
	memoryFallback.set(sessionId, entry);
}

async function readSession(sessionId: string): Promise<KibbleCommerceSession | null> {
	const store = await getRedis();
	if (store) {
		try {
			const raw = await store.get<string | SessionEntry>(sessionKey(sessionId));
			if (!raw) return null;
			const entry = typeof raw === 'string' ? JSON.parse(raw) as SessionEntry : raw;
			if (entry.expiresAt <= Date.now()) return null;
			return entry.session;
		} catch (error) {
			console.warn('[kibble-commerce-session] Redis read failed; using memory fallback:', error instanceof Error ? error.message : error);
		}
	}
	const entry = memoryFallback.get(sessionId);
	if (!entry || entry.expiresAt <= Date.now()) {
		memoryFallback.delete(sessionId);
		return null;
	}
	return entry.session;
}

async function deleteSession(sessionId: string): Promise<void> {
	const store = await getRedis();
	if (store) {
		try { await store.del(sessionKey(sessionId)); } catch (error) {
			console.warn('[kibble-commerce-session] Redis delete failed:', error instanceof Error ? error.message : error);
		}
	}
	memoryFallback.delete(sessionId);
}

export async function createKibbleCommerceSession(session: KibbleCommerceSession): Promise<string> {
	const sessionId = randomSessionId();
	await writeSession(sessionId, session);
	return sessionId;
}

export async function getKibbleCommerceSession(cookies: Pick<Cookies, 'get'>): Promise<KibbleCommerceSession | null> {
	const sessionId = cookies.get(KIBBLE_COMMERCE_SESSION_COOKIE);
	if (!sessionId) return null;
	const session = await readSession(sessionId);
	if (session?.accessTokenExpiresAt && Date.parse(session.accessTokenExpiresAt) <= Date.now()) return null;
	return session;
}

export async function setKibbleCommerceSessionCookie(cookies: Cookies, sessionId: string): Promise<void> {
	cookies.set(KIBBLE_COMMERCE_SESSION_COOKIE, sessionId, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		maxAge: SESSION_TTL_SECONDS,
	});
}

export async function clearKibbleCommerceSession(cookies: Cookies): Promise<void> {
	const sessionId = cookies.get(KIBBLE_COMMERCE_SESSION_COOKIE);
	if (sessionId) await deleteSession(sessionId);
	cookies.delete(KIBBLE_COMMERCE_SESSION_COOKIE, { path: '/' });
}

export function resetKibbleCommerceSessionsForTest(): void {
	memoryFallback.clear();
	redis = null;
	redisInitialized = false;
}
