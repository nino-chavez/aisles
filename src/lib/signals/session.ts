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
import { getBrand, getBrandById } from '$lib/brand/config';

const SESSION_TTL_S = 30 * 60; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

interface SessionEntry {
	store: SignalStore;
	lastAccessed: number;
	scope: SessionScope;
}

interface SessionScope {
	organizationId: string;
	brandId: string;
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

function activeScope(): SessionScope {
	const brand = getBrand();
	return { organizationId: brand.organizationId, brandId: brand.id };
}

function scopedSessionKey(scope: SessionScope, sessionId: string): string {
	return `aisles:session:${encodeURIComponent(scope.organizationId)}:${encodeURIComponent(scope.brandId)}:${encodeURIComponent(sessionId)}`;
}

function legacySessionKey(sessionId: string): string {
	return `aisles:session:${sessionId}`;
}

/** Serializable snapshot of a SignalStore for Redis persistence. */
interface SessionSnapshot {
	sessionId: string;
	events: SignalEvent[];
	crossSession: {
		brandId?: string;
		organizationId?: string;
		scenarioId?: string | null;
		storedPersona: string | null;
		storedCategory: string | null;
		visitCount: number;
		currentCategory: string;
	};
}

function storeMatchesScope(store: SignalStore, scope: SessionScope): boolean {
	const identity = store.getCrossSessionContext();
	return identity.brandId === scope.brandId && identity.organizationId === scope.organizationId;
}

/**
 * Legacy snapshots did not persist organizationId. A brand ID maps to one
 * configured organization, so accepting this narrow shape is safe only when
 * it resolves exactly to the active scope. Snapshots without a brand ID fail
 * closed.
 */
function snapshotMatchesScope(snapshot: SessionSnapshot, scope: SessionScope, { allowLegacyOrganization = false } = {}): boolean {
	const identity = snapshot.crossSession;
	if (identity.brandId !== scope.brandId) return false;
	if (identity.organizationId === scope.organizationId) return true;
	if (!allowLegacyOrganization || identity.organizationId !== undefined) return false;
	return getBrandById(identity.brandId)?.organizationId === scope.organizationId;
}

function createStore(sessionId: string, scope: SessionScope): SignalStore {
	const store = new SignalStore(sessionId);
	store.setBrandId(scope.brandId);
	store.setOrganizationId(scope.organizationId);
	return store;
}

function cacheStore(store: SignalStore, scope: SessionScope) {
	sessions.set(scopedSessionKey(scope, store.sessionId), { store, scope, lastAccessed: Date.now() });
	ensureCleanup();
}

// ─── Public API ────────────────────────────────────────────────────

/**
 * Get an existing session store or create a new one.
 * Checks in-memory cache first, then Redis, then creates fresh.
 * Pass fresh=true to bypass the hot cache and always read from Redis.
 */
export async function getSessionStore(sessionId: string, { fresh = false } = {}): Promise<SignalStore> {
	const scope = activeScope();
	const cacheKey = scopedSessionKey(scope, sessionId);
	// Hot cache hit (skip if caller needs fresh data)
	if (!fresh) {
		const cached = sessions.get(cacheKey);
		if (cached && storeMatchesScope(cached.store, scope)) {
			cached.lastAccessed = Date.now();
			return cached.store;
		}
	}

	// Try Redis
	const r = await getRedis();
	if (r) {
		try {
			const snapshot = await r.get<SessionSnapshot>(scopedSessionKey(scope, sessionId));
			if (snapshot && snapshotMatchesScope(snapshot, scope)) {
				const store = restoreFromSnapshot(snapshot);
				cacheStore(store, scope);
				return store;
			}

			// Read a previous global key only after proving its brand maps to this
			// organization. New writes always use the scoped key above.
			const legacy = await r.get<SessionSnapshot>(legacySessionKey(sessionId));
			if (legacy && snapshotMatchesScope(legacy, scope, { allowLegacyOrganization: true })) {
				const store = restoreFromSnapshot(legacy);
				store.setOrganizationId(scope.organizationId);
				cacheStore(store, scope);
				return store;
			}
		} catch {
			// Redis read failed — fall through to create fresh
		}
	}

	// Create fresh
	const store = createStore(sessionId, scope);
	cacheStore(store, scope);
	return store;
}

/**
 * Persist the session store to Redis.
 * Called after events are appended or inference runs.
 */
export async function persistSession(store: SignalStore): Promise<void> {
	const scope = activeScope();
	if (!storeMatchesScope(store, scope)) return;
	const r = await getRedis();
	if (!r) return;

	const snapshot: SessionSnapshot = {
		sessionId: store.sessionId,
		events: [...store.getEvents()],
		crossSession: store.getCrossSessionContext(),
	};

	try {
		await r.set(scopedSessionKey(scope, store.sessionId), snapshot, { ex: SESSION_TTL_S });
	} catch {
		// Redis write failed — session still lives in memory
	}
}

/** Replace a session atomically for deterministic scenario seeding. Never appends events. */
export async function replaceSessionStore(store: SignalStore): Promise<void> {
	const scope = activeScope();
	if (!storeMatchesScope(store, scope)) return;
	cacheStore(store, scope);
	await persistSession(store);
}

/** Check if a session exists in cache or Redis. */
export async function hasSession(sessionId: string): Promise<boolean> {
	return (await findSessionStore(sessionId)) !== null;
}

/** Find a session only when its stored identity belongs to the active brand. */
export async function findSessionStore(sessionId: string, { fresh = false } = {}): Promise<SignalStore | null> {
	const scope = activeScope();
	const cacheKey = scopedSessionKey(scope, sessionId);
	if (!fresh) {
		const cached = sessions.get(cacheKey);
		if (cached && storeMatchesScope(cached.store, scope)) {
			cached.lastAccessed = Date.now();
			return cached.store;
		}
	}

	const r = await getRedis();
	if (!r) return null;

	try {
		const snapshot = await r.get<SessionSnapshot>(scopedSessionKey(scope, sessionId));
		if (snapshot && snapshotMatchesScope(snapshot, scope)) {
			const store = restoreFromSnapshot(snapshot);
			cacheStore(store, scope);
			return store;
		}
		const legacy = await r.get<SessionSnapshot>(legacySessionKey(sessionId));
		if (legacy && snapshotMatchesScope(legacy, scope, { allowLegacyOrganization: true })) {
			const store = restoreFromSnapshot(legacy);
			store.setOrganizationId(scope.organizationId);
			cacheStore(store, scope);
			return store;
		}
		return null;
	} catch {
		return null;
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
			const scope = activeScope();
			const prefix = `aisles:session:${encodeURIComponent(scope.organizationId)}:${encodeURIComponent(scope.brandId)}:`;
			let cursor = 0;
			do {
				const result = await r.scan(cursor, { match: `${prefix}*`, count: 100 });
				cursor = typeof result[0] === 'string' ? parseInt(result[0]) : result[0];
				const keys = result[1] as string[];

				for (const key of keys) {
					const snapshot = await r.get<SessionSnapshot>(key);
					if (snapshot && snapshotMatchesScope(snapshot, scope)) {
						ids.push(decodeURIComponent(key.slice(prefix.length)));
					}
				}
			} while (cursor !== 0);
		} catch {
			// Redis scan failed — fall through to hot cache
		}
	}

	// Merge in hot cache IDs not already found
	const scope = activeScope();
	for (const entry of sessions.values()) {
		if (entry.scope.organizationId === scope.organizationId && entry.scope.brandId === scope.brandId && storeMatchesScope(entry.store, scope) && !ids.includes(entry.store.sessionId)) {
			ids.push(entry.store.sessionId);
		}
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
	store.setOrganizationId(snapshot.crossSession.organizationId ?? 'haven-demo-merchant');
	store.setScenarioId(snapshot.crossSession.scenarioId ?? null);

	// Restore events with original IDs and timestamps
	for (const event of snapshot.events) {
		store.restore(event);
	}

	return store;
}
