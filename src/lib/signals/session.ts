/**
 * Server-side session manager for signal stores.
 *
 * Hybrid approach: in-memory Map as hot cache + Upstash Redis for
 * durability. The hot cache avoids a Redis roundtrip on every request
 * within the same function instance. Redis ensures sessions survive
 * cold starts and work across multiple function instances.
 *
 * Falls back to in-memory only if Redis is not configured (dev without env vars).
 */

import { SignalStore } from './store';
import type { SignalEvent } from './types';
import { env } from '$env/dynamic/private';

const SESSION_TTL_S = 30 * 60; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

interface SessionEntry {
	store: SignalStore;
	lastAccessed: number;
}

// ─── Hot cache (in-memory) ─────────────────────────────────────────

const sessions = new Map<string, SessionEntry>();

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
	if (cleanupTimer) return;
	cleanupTimer = setInterval(() => {
		const now = Date.now();
		for (const [id, entry] of sessions) {
			if (now - entry.lastAccessed > SESSION_TTL_S * 1000) {
				sessions.delete(id);
			}
		}
		if (sessions.size === 0 && cleanupTimer) {
			clearInterval(cleanupTimer);
			cleanupTimer = null;
		}
	}, CLEANUP_INTERVAL_MS);
}

// ─── Redis (durable) ───────────────────────────────────────────────

let redis: import('@upstash/redis').Redis | null = null;
let redisInitialized = false;

async function getRedis(): Promise<import('@upstash/redis').Redis | null> {
	if (redisInitialized) return redis;
	redisInitialized = true;

	try {
		const url = env.KV_REST_API_URL;
		const token = env.KV_REST_API_TOKEN;

		if (!url || !token) {
			console.warn('[session] No Redis credentials found, using in-memory only');
			return null;
		}

		const { Redis } = await import('@upstash/redis');
		redis = new Redis({ url, token });
		return redis;
	} catch (err) {
		console.warn('[session] Failed to initialize Redis:', err);
		return null;
	}
}

function sessionKey(sessionId: string): string {
	return `aisles:session:${sessionId}`;
}

/** Serializable snapshot of a SignalStore for Redis persistence. */
interface SessionSnapshot {
	sessionId: string;
	events: SignalEvent[];
	crossSession: {
		brandId?: string;
		scenarioId?: string | null;
		storedPersona: string | null;
		storedCategory: string | null;
		visitCount: number;
		currentCategory: string;
	};
}

// ─── Public API ────────────────────────────────────────────────────

/**
 * Get an existing session store or create a new one.
 * Checks in-memory cache first, then Redis, then creates fresh.
 * Pass fresh=true to bypass the hot cache and always read from Redis.
 */
export async function getSessionStore(sessionId: string, { fresh = false } = {}): Promise<SignalStore> {
	// Hot cache hit (skip if caller needs fresh data)
	if (!fresh) {
		const cached = sessions.get(sessionId);
		if (cached) {
			cached.lastAccessed = Date.now();
			return cached.store;
		}
	}

	// Try Redis
	const r = await getRedis();
	if (r) {
		try {
			const snapshot = await r.get<SessionSnapshot>(sessionKey(sessionId));
			if (snapshot) {
				const store = restoreFromSnapshot(snapshot);
				sessions.set(sessionId, { store, lastAccessed: Date.now() });
				ensureCleanup();
				return store;
			}
		} catch {
			// Redis read failed — fall through to create fresh
		}
	}

	// Create fresh
	const store = new SignalStore(sessionId);
	sessions.set(sessionId, { store, lastAccessed: Date.now() });
	ensureCleanup();
	return store;
}

/**
 * Persist the session store to Redis.
 * Called after events are appended or inference runs.
 */
export async function persistSession(store: SignalStore): Promise<void> {
	const r = await getRedis();
	if (!r) return;

	const snapshot: SessionSnapshot = {
		sessionId: store.sessionId,
		events: [...store.getEvents()],
		crossSession: store.getCrossSessionContext(),
	};

	try {
		await r.set(sessionKey(store.sessionId), snapshot, { ex: SESSION_TTL_S });
	} catch {
		// Redis write failed — session still lives in memory
	}
}

/** Replace a session atomically for deterministic scenario seeding. Never appends events. */
export async function replaceSessionStore(store: SignalStore): Promise<void> {
	sessions.set(store.sessionId, { store, lastAccessed: Date.now() });
	ensureCleanup();
	await persistSession(store);
}

/** Check if a session exists in cache or Redis. */
export async function hasSession(sessionId: string): Promise<boolean> {
	if (sessions.has(sessionId)) return true;

	const r = await getRedis();
	if (!r) return false;

	try {
		return await r.exists(sessionKey(sessionId)) > 0;
	} catch {
		return false;
	}
}

/** Number of active sessions in the hot cache (for observability). */
export function sessionCount(): number {
	return sessions.size;
}

/** List all active session IDs from Redis (scanning aisles:session:* keys). */
export async function listSessionIds(): Promise<string[]> {
	const ids: string[] = [];

	const r = await getRedis();
	if (r) {
		try {
			let cursor = 0;
			do {
				const result = await r.scan(cursor, { match: 'aisles:session:*', count: 100 });
				cursor = typeof result[0] === 'string' ? parseInt(result[0]) : result[0];
				const keys = result[1] as string[];

				for (const key of keys) {
					ids.push(key.replace('aisles:session:', ''));
				}
			} while (cursor !== 0);
		} catch {
			// Redis scan failed — fall through to hot cache
		}
	}

	// Merge in hot cache IDs not already found
	for (const id of sessions.keys()) {
		if (!ids.includes(id)) ids.push(id);
	}

	return ids;
}

// ─── Helpers ───────────────────────────────────────────────────────

function restoreFromSnapshot(snapshot: SessionSnapshot): SignalStore {
	const store = new SignalStore(snapshot.sessionId);

	store.setCrossSessionContext({
		storedPersona: snapshot.crossSession.storedPersona as any,
		storedCategory: snapshot.crossSession.storedCategory,
		visitCount: snapshot.crossSession.visitCount,
		currentCategory: snapshot.crossSession.currentCategory,
	});
	store.setBrandId(snapshot.crossSession.brandId ?? 'haven');
	store.setScenarioId(snapshot.crossSession.scenarioId ?? null);

	// Restore events with original IDs and timestamps
	for (const event of snapshot.events) {
		store.restore(event);
	}

	return store;
}
