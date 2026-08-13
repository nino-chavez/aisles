import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';

const COOLDOWN_SECONDS = 8;
const SESSION_DAILY_LIMIT = 12;
const GLOBAL_DAILY_LIMIT = 120;
const MAX_PROVIDER_CALLS_PER_ACTION = 2;
const DAY_SECONDS = 24 * 60 * 60;

export type KibbleDemoAiBudgetDecision =
	| { ok: true; sessionUsed: number; globalUsed: number }
	| { ok: false; reason: 'disabled' | 'cooldown' | 'session_limit' | 'global_limit' | 'unavailable' };

const localCooldown = new Map<string, number>();
const localSessionUsage = new Map<string, { day: string; count: number }>();
let localGlobalUsage = { day: '', count: 0 };

const RESERVE_SCRIPT = `
local cooldown_key = KEYS[1]
local session_key = KEYS[2]
local global_key = KEYS[3]
local cooldown_seconds = tonumber(ARGV[1])
local session_limit = tonumber(ARGV[2])
local global_limit = tonumber(ARGV[3])
local day_seconds = tonumber(ARGV[4])
local reserve_units = tonumber(ARGV[5])

if redis.call('EXISTS', cooldown_key) == 1 then
  return {0, 'cooldown', 0, 0}
end

local session_used = tonumber(redis.call('GET', session_key) or '0')
if session_used + reserve_units > session_limit then
  return {0, 'session_limit', session_used, 0}
end

local global_used = tonumber(redis.call('GET', global_key) or '0')
if global_used + reserve_units > global_limit then
  return {0, 'global_limit', session_used, global_used}
end

redis.call('SET', cooldown_key, '1', 'EX', cooldown_seconds)
session_used = redis.call('INCRBY', session_key, reserve_units)
if session_used == reserve_units then redis.call('EXPIRE', session_key, day_seconds) end
global_used = redis.call('INCRBY', global_key, reserve_units)
if global_used == reserve_units then redis.call('EXPIRE', global_key, day_seconds) end
return {1, 'ok', session_used, global_used}
`;

/**
 * Reserve the worst-case provider cost for one prospect-triggered action
 * before contacting a provider. The runner may use a second call for its one
 * fallback, so each action consumes two call-budget units even when the first
 * model succeeds. Production fails closed without Redis so a public query
 * cannot create an unmetered paid endpoint. Local development uses the same
 * conservative semantics.
 */
export async function reserveKibbleDemoAiCall(
	sessionId: string,
	now = new Date(),
): Promise<KibbleDemoAiBudgetDecision> {
	if (env.KIBBLE_DEMO_AI_ENABLED !== 'true') return { ok: false, reason: 'disabled' };
	if (!/^[A-Za-z0-9-]{8,128}$/.test(sessionId)) return { ok: false, reason: 'unavailable' };
	const day = now.toISOString().slice(0, 10);
	const url = env.KV_REST_API_URL;
	const token = env.KV_REST_API_TOKEN;
	if (!url || !token) return dev ? reserveLocal(sessionId, day, now.getTime()) : { ok: false, reason: 'unavailable' };

	try {
		const { Redis } = await import('@upstash/redis');
		const redis = new Redis({ url, token });
		const scope = 'aisles:kibble:observe-ai';
		const result = await redis.eval(
			RESERVE_SCRIPT,
			[
				`${scope}:cooldown:${sessionId}`,
				`${scope}:session:${day}:${sessionId}`,
				`${scope}:global:${day}`,
			],
			[
				String(COOLDOWN_SECONDS),
				String(SESSION_DAILY_LIMIT),
				String(GLOBAL_DAILY_LIMIT),
				String(DAY_SECONDS),
				String(MAX_PROVIDER_CALLS_PER_ACTION),
			],
		);
		return parseReservation(result);
	} catch (error) {
		console.warn('[kibble-observe-ai] Budget reservation failed closed:', error instanceof Error ? error.message : 'unknown error');
		return { ok: false, reason: 'unavailable' };
	}
}

function reserveLocal(sessionId: string, day: string, nowMs: number): KibbleDemoAiBudgetDecision {
	const cooldownUntil = localCooldown.get(sessionId) ?? 0;
	if (cooldownUntil > nowMs) return { ok: false, reason: 'cooldown' };
	const session = localSessionUsage.get(sessionId);
	const sessionUsed = session?.day === day ? session.count : 0;
	if (sessionUsed >= SESSION_DAILY_LIMIT) return { ok: false, reason: 'session_limit' };
	if (localGlobalUsage.day !== day) localGlobalUsage = { day, count: 0 };
	if (localGlobalUsage.count >= GLOBAL_DAILY_LIMIT) return { ok: false, reason: 'global_limit' };
	const nextSession = sessionUsed + MAX_PROVIDER_CALLS_PER_ACTION;
	if (nextSession > SESSION_DAILY_LIMIT) return { ok: false, reason: 'session_limit' };
	if (localGlobalUsage.count + MAX_PROVIDER_CALLS_PER_ACTION > GLOBAL_DAILY_LIMIT) {
		return { ok: false, reason: 'global_limit' };
	}
	localCooldown.set(sessionId, nowMs + COOLDOWN_SECONDS * 1000);
	localSessionUsage.set(sessionId, { day, count: nextSession });
	localGlobalUsage.count += MAX_PROVIDER_CALLS_PER_ACTION;
	return { ok: true, sessionUsed: nextSession, globalUsed: localGlobalUsage.count };
}

function parseReservation(value: unknown): KibbleDemoAiBudgetDecision {
	if (!Array.isArray(value) || value.length !== 4) return { ok: false, reason: 'unavailable' };
	const [allowed, reason, sessionUsed, globalUsed] = value;
	if (Number(allowed) === 1 && reason === 'ok') {
		const parsedSession = Number(sessionUsed);
		const parsedGlobal = Number(globalUsed);
		if (Number.isInteger(parsedSession) && Number.isInteger(parsedGlobal)) {
			return { ok: true, sessionUsed: parsedSession, globalUsed: parsedGlobal };
		}
	}
	if (reason === 'cooldown' || reason === 'session_limit' || reason === 'global_limit') {
		return { ok: false, reason };
	}
	return { ok: false, reason: 'unavailable' };
}
