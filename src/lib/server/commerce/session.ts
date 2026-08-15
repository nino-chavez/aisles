import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import type { Cookies } from '@sveltejs/kit';
import { getBrand } from '$lib/brand/config';

// Production's __Host- prefix prevents a sibling subdomain from planting a
// domain-scoped commerce session cookie. Local HTTP development keeps the
// unprefixed name because __Host- requires Secure.
const COOKIE_NAME = dev ? 'kibble_commerce_session' : '__Host-kibble_commerce_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const IDEMPOTENCY_TTL_SECONDS = 60 * 60 * 24;
// Every provider call has a 20-second deadline. The longest mutation path makes
// two provider calls, so this lease leaves ample persistence time without
// letting a crashed request block the cart indefinitely.
const LOCK_TTL_SECONDS = 120;
const RATE_WINDOW_SECONDS = 60;
export const COMMERCE_MUTATION_CLIENT_LIMIT = 20;
const COMMERCE_MUTATION_GLOBAL_LIMIT = 300;
export const CUSTOMER_AUTH_CLIENT_LIMIT = 5;
const CUSTOMER_AUTH_GLOBAL_LIMIT = 100;
const SESSION_ID_PATTERN = /^[a-f0-9-]{36}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

export interface CommerceSessionState {
	sessionId: string;
	organizationId: string;
	brandId: string;
	cartEntityId: string | null;
	/** Server-only provider credential. The browser receives only sessionId. */
	customerSession: CustomerSessionReference | null;
	/** Prevents checkout when a subscription-intent outcome cannot be reconciled. */
	checkoutBlock: { reason: 'subscription_intent_unconfirmed'; setAt: string } | null;
	updatedAt: string;
}

export interface CustomerSessionReference {
	provider: 'bigcommerce';
	customerEntityId: number;
	customerAccessToken: string;
	expiresAt: string;
}

interface StoredResult<T> {
	fingerprint: string;
	value: T;
}

export interface CoordinatedResult<T> {
	value: T;
	replayed: boolean;
}

export class CommerceSessionUnavailableError extends Error {}
export class CommerceOperationInProgressError extends Error {}
export class CommerceIdempotencyMismatchError extends Error {}
export class CommerceRateLimitError extends Error {}

const memorySessions = new Map<string, CommerceSessionState>();
const memoryResults = new Map<string, StoredResult<unknown>>();
const memoryClaims = new Set<string>();
const memoryLocks = new Set<string>();
const memoryRateWindows = new Map<string, { expiresAt: number; count: number }>();

let redis: import('@upstash/redis').Redis | null = null;
let redisInitialized = false;

async function getRedis(): Promise<import('@upstash/redis').Redis | null> {
	if (redisInitialized) return redis;
	redisInitialized = true;
	const url = env.KV_REST_API_URL;
	const token = env.KV_REST_API_TOKEN;
	if (!url || !token) return null;
	const { Redis } = await import('@upstash/redis');
	redis = new Redis({ url, token });
	return redis;
}

function scope() {
	const brand = getBrand();
	return { organizationId: brand.organizationId, brandId: brand.id };
}

function prefix(sessionId: string): string {
	const active = scope();
	return `aisles:commerce:${encodeURIComponent(active.organizationId)}:${encodeURIComponent(active.brandId)}:${sessionId}`;
}

function scopePrefix(): string {
	const active = scope();
	return `aisles:commerce:${encodeURIComponent(active.organizationId)}:${encodeURIComponent(active.brandId)}`;
}

function stateKey(sessionId: string): string {
	return `${prefix(sessionId)}:state`;
}

function freshState(sessionId: string): CommerceSessionState {
	return {
		sessionId,
		...scope(),
		cartEntityId: null,
		customerSession: null,
		checkoutBlock: null,
		updatedAt: new Date().toISOString(),
	};
}

function validState(value: unknown, sessionId: string): value is CommerceSessionState {
	if (!value || typeof value !== 'object') return false;
	const state = value as CommerceSessionState;
	const active = scope();
	return state.sessionId === sessionId && state.organizationId === active.organizationId && state.brandId === active.brandId;
}

function normalizeState(state: CommerceSessionState): CommerceSessionState {
	return {
		...state,
		customerSession: validCustomerSessionReference(state.customerSession)
			? state.customerSession
			: null,
		checkoutBlock: state.checkoutBlock?.reason === 'subscription_intent_unconfirmed' && Number.isFinite(Date.parse(state.checkoutBlock.setAt))
			? state.checkoutBlock
			: null,
	};
}

function validCustomerSessionReference(value: unknown): value is CustomerSessionReference {
	if (!value || typeof value !== 'object') return false;
	const session = value as CustomerSessionReference;
	return session.provider === 'bigcommerce' &&
		Number.isInteger(session.customerEntityId) &&
		session.customerEntityId > 0 &&
		typeof session.customerAccessToken === 'string' &&
		session.customerAccessToken.length > 0 &&
		typeof session.expiresAt === 'string' &&
		Number.isFinite(Date.parse(session.expiresAt));
}

export function activeCustomerSession(
	state: CommerceSessionState,
	now = Date.now(),
): CustomerSessionReference | null {
	const session = state.customerSession;
	return validCustomerSessionReference(session) && Date.parse(session.expiresAt) > now
		? session
		: null;
}

export function clearExpiredCustomerSession(
	state: CommerceSessionState,
	now = Date.now(),
): CommerceSessionState {
	if (state.customerSession && !activeCustomerSession(state, now)) state.customerSession = null;
	return state;
}

function requireStore(redisClient: import('@upstash/redis').Redis | null): 'redis' | 'memory' {
	if (redisClient) return 'redis';
	if (dev) return 'memory';
	throw new CommerceSessionUnavailableError('Durable commerce sessions are unavailable.');
}

export function commerceSessionId(cookies: Cookies): string {
	const existing = cookies.get(COOKIE_NAME);
	if (existing && SESSION_ID_PATTERN.test(existing)) return existing;
	const sessionId = crypto.randomUUID();
	cookies.set(COOKIE_NAME, sessionId, {
		path: '/',
		maxAge: SESSION_TTL_SECONDS,
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
	});
	return sessionId;
}

export function requireCommerceSessionId(cookies: Cookies): string {
	const existing = cookies.get(COOKIE_NAME);
	if (!existing || !SESSION_ID_PATTERN.test(existing)) {
		throw new CommerceSessionUnavailableError('Establish a commerce session before changing the cart.');
	}
	return existing;
}

export function requireIdempotencyKey(request: Request): string {
	const key = request.headers.get('Idempotency-Key')?.trim() ?? '';
	if (!IDEMPOTENCY_KEY_PATTERN.test(key)) throw new TypeError('A valid Idempotency-Key header is required.');
	return key;
}

export function requireSameOrigin(request: Request): void {
	const expected = new URL(request.url).origin;
	const origin = request.headers.get('Origin');
	const referer = request.headers.get('Referer');
	let supplied = origin;
	if (!supplied && referer) {
		try {
			supplied = new URL(referer).origin;
		} catch {
			throw new TypeError('A same-origin commerce request is required.');
		}
	}
	if (!supplied || supplied !== expected) throw new TypeError('A same-origin commerce request is required.');
}

/**
 * Bound anonymous mutation traffic before a session or provider cart is
 * created. The client address is one-way hashed before it becomes a Redis key;
 * the raw address is neither stored nor returned as evidence.
 */
export async function requireCommerceMutationCapacity(clientAddress: string): Promise<void> {
	return requireRateCapacity(clientAddress, 'cart', COMMERCE_MUTATION_CLIENT_LIMIT, COMMERCE_MUTATION_GLOBAL_LIMIT);
}

export async function requireCustomerAuthenticationCapacity(clientAddress: string): Promise<void> {
	return requireRateCapacity(clientAddress, 'customer-auth', CUSTOMER_AUTH_CLIENT_LIMIT, CUSTOMER_AUTH_GLOBAL_LIMIT);
}

async function requireRateCapacity(
	clientAddress: string,
	scopeName: string,
	clientLimit: number,
	globalLimit: number,
): Promise<void> {
	if (!clientAddress || clientAddress.length > 256) {
		throw new CommerceSessionUnavailableError('Commerce mutation identity is unavailable.');
	}
	const addressKey = await sha256(clientAddress);
	const redisClient = await getRedis();
	const store = requireStore(redisClient);
	const base = scopePrefix();
	if (store === 'memory') {
		const now = Date.now();
		if (!reserveMemoryRate(`${base}:rate:${scopeName}:client:${addressKey}`, clientLimit, now)) {
			throw new CommerceRateLimitError('Commerce mutation rate limit exceeded.');
		}
		if (!reserveMemoryRate(`${base}:rate:${scopeName}:global`, globalLimit, now)) {
			throw new CommerceRateLimitError('Commerce mutation rate limit exceeded.');
		}
		return;
	}

	try {
		const result = await redisClient!.eval(
			RATE_LIMIT_SCRIPT,
			[`${base}:rate:${scopeName}:client:${addressKey}`, `${base}:rate:${scopeName}:global`],
			[String(clientLimit), String(globalLimit), String(RATE_WINDOW_SECONDS)],
		);
		if (!Array.isArray(result) || result.length !== 3) {
			throw new CommerceSessionUnavailableError('Commerce rate limit returned an invalid result.');
		}
		if (Number(result[0]) !== 1) throw new CommerceRateLimitError('Commerce mutation rate limit exceeded.');
	} catch (cause) {
		if (cause instanceof CommerceRateLimitError || cause instanceof CommerceSessionUnavailableError) throw cause;
		throw new CommerceSessionUnavailableError('Commerce mutation rate limit is unavailable.');
	}
}

export async function loadCommerceSession(sessionId: string): Promise<CommerceSessionState> {
	const redisClient = await getRedis();
	const store = requireStore(redisClient);
	if (store === 'memory') return normalizeState(memorySessions.get(stateKey(sessionId)) ?? freshState(sessionId));
	const value = await redisClient!.get<CommerceSessionState>(stateKey(sessionId));
	return validState(value, sessionId) ? normalizeState(value) : freshState(sessionId);
}

export async function saveCommerceSession(state: CommerceSessionState): Promise<void> {
	if (!validState(state, state.sessionId)) throw new CommerceSessionUnavailableError('Commerce session scope mismatch.');
	state.updatedAt = new Date().toISOString();
	const redisClient = await getRedis();
	const store = requireStore(redisClient);
	if (store === 'memory') {
		memorySessions.set(stateKey(state.sessionId), structuredClone(state));
		return;
	}
	await redisClient!.set(stateKey(state.sessionId), state, {
		ex: SESSION_TTL_SECONDS,
	});
}

/**
 * Atomically claims one idempotency key, serializes all mutations for the same
 * server-owned session, and stores the terminal response for safe replay.
 */
export async function coordinateCommerceMutation<T>(options: {
	sessionId: string;
	idempotencyKey: string;
	fingerprint: string;
	persistResult?: boolean;
	execute: (state: CommerceSessionState) => Promise<{ state: CommerceSessionState; value: T }>;
}): Promise<CoordinatedResult<T>> {
	const { sessionId, idempotencyKey, fingerprint, persistResult = true, execute } = options;
	const base = prefix(sessionId);
	const resultKey = `${base}:idempotency:${idempotencyKey}:result`;
	const claimKey = `${base}:idempotency:${idempotencyKey}:claim`;
	const lockKey = `${base}:lock`;
	const owner = crypto.randomUUID();
	const redisClient = await getRedis();
	const store = requireStore(redisClient);

	if (store === 'memory') {
		const previous = persistResult ? (memoryResults.get(resultKey) as StoredResult<T> | undefined) : undefined;
		if (previous) return replay(previous, fingerprint);
		if (memoryClaims.has(claimKey) || memoryLocks.has(lockKey)) throw new CommerceOperationInProgressError();
		memoryClaims.add(claimKey);
		memoryLocks.add(lockKey);
		try {
			const current = normalizeState(memorySessions.get(stateKey(sessionId)) ?? freshState(sessionId));
			const completed = await execute(structuredClone(current));
			completed.state.updatedAt = new Date().toISOString();
			memorySessions.set(stateKey(sessionId), structuredClone(completed.state));
			if (persistResult) {
				memoryResults.set(resultKey, {
					fingerprint,
					value: structuredClone(completed.value),
				});
			}
			return { value: completed.value, replayed: false };
		} finally {
			memoryClaims.delete(claimKey);
			memoryLocks.delete(lockKey);
		}
	}

	const previous = persistResult ? await redisClient!.get<StoredResult<T>>(resultKey) : null;
	if (previous) return replay(previous, fingerprint);
	const claimed = await claimOwned(redisClient!, claimKey, owner, IDEMPOTENCY_TTL_SECONDS);
	if (!claimed) {
		const racedResult = persistResult ? await redisClient!.get<StoredResult<T>>(resultKey) : null;
		if (racedResult) return replay(racedResult, fingerprint);
		throw new CommerceOperationInProgressError();
	}
	const locked = await claimOwned(redisClient!, lockKey, owner, LOCK_TTL_SECONDS);
	if (!locked) {
		await releaseOwned(redisClient!, claimKey, owner);
		throw new CommerceOperationInProgressError();
	}

	try {
		const stateValue = await redisClient!.get<CommerceSessionState>(stateKey(sessionId));
		const current = validState(stateValue, sessionId) ? normalizeState(stateValue) : freshState(sessionId);
		const completed = await execute(current);
		completed.state.updatedAt = new Date().toISOString();
		const finished = await redisClient!.eval(
			FINISH_SCRIPT,
			[claimKey, lockKey, stateKey(sessionId), resultKey],
			[owner, JSON.stringify(completed.state), JSON.stringify({ fingerprint, value: completed.value }), String(SESSION_TTL_SECONDS), String(IDEMPOTENCY_TTL_SECONDS), persistResult ? '1' : '0'],
		);
		if (Number(finished) !== 1) throw new CommerceSessionUnavailableError('Commerce mutation lease expired before persistence.');
		return { value: completed.value, replayed: false };
	} catch (cause) {
		// Once the session lock was acquired, a provider mutation may have been
		// sent. Keep the idempotency claim reserved if terminal persistence fails;
		// releasing it would allow the same request key to mutate twice.
		await Promise.allSettled([releaseOwned(redisClient!, lockKey, owner)]);
		throw cause;
	}
}

function replay<T>(stored: StoredResult<T>, fingerprint: string): CoordinatedResult<T> {
	if (stored.fingerprint !== fingerprint) throw new CommerceIdempotencyMismatchError();
	return { value: stored.value, replayed: true };
}

const RELEASE_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;

const CLAIM_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
local claimed = redis.call('SET', KEYS[1], ARGV[1], 'NX', 'EX', tonumber(ARGV[2]))
if claimed then return 1 end
return 0
`;

const FINISH_SCRIPT = `
local claim = redis.call('GET', KEYS[1])
local lock = redis.call('GET', KEYS[2])
if claim ~= ARGV[1] or lock ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[3], ARGV[2], 'EX', tonumber(ARGV[4]))
if ARGV[6] == '1' then
  redis.call('SET', KEYS[4], ARGV[3], 'EX', tonumber(ARGV[5]))
end
redis.call('DEL', KEYS[1])
redis.call('DEL', KEYS[2])
return 1
`;

const RATE_LIMIT_SCRIPT = `
local client_count = redis.call('INCR', KEYS[1])
if client_count == 1 then redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3])) end
if client_count > tonumber(ARGV[1]) then return {0, client_count, 0} end
local global_count = redis.call('INCR', KEYS[2])
if global_count == 1 then redis.call('EXPIRE', KEYS[2], tonumber(ARGV[3])) end
if global_count > tonumber(ARGV[2]) then return {0, client_count, global_count} end
return {1, client_count, global_count}
`;

function reserveMemoryRate(key: string, limit: number, now: number): boolean {
	const current = memoryRateWindows.get(key);
	if (!current || current.expiresAt <= now) {
		memoryRateWindows.set(key, { expiresAt: now + RATE_WINDOW_SECONDS * 1000, count: 1 });
		return true;
	}
	current.count += 1;
	return current.count <= limit;
}

async function sha256(value: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function releaseOwned(client: import('@upstash/redis').Redis, key: string, owner: string): Promise<void> {
	await client.eval(RELEASE_SCRIPT, [key], [owner]);
}

async function claimOwned(client: import('@upstash/redis').Redis, key: string, owner: string, ttlSeconds: number): Promise<boolean> {
	return Number(await client.eval(CLAIM_SCRIPT, [key], [owner, String(ttlSeconds)])) === 1;
}

export function _resetCommerceSessionMemoryForTests(): void {
	memorySessions.clear();
	memoryResults.clear();
	memoryClaims.clear();
	memoryLocks.clear();
	memoryRateWindows.clear();
}
