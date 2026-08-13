import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ enabled: '', url: '', token: '' }));
const redisEval = vi.hoisted(() => vi.fn());

vi.mock('$app/environment', () => ({ dev: true }));
vi.mock('$env/dynamic/private', () => ({
	env: new Proxy({}, {
		get: (_target, key) => key === 'KIBBLE_DEMO_AI_ENABLED' ? state.enabled
			: key === 'KV_REST_API_URL' ? state.url
				: key === 'KV_REST_API_TOKEN' ? state.token : undefined,
	}),
}));
vi.mock('@upstash/redis', () => ({ Redis: class { eval = redisEval; } }));

import { KIBBLE_DEMO_ACTION_COOLDOWN_MS, KIBBLE_DEMO_MAX_PROVIDER_CALLS_PER_ACTION, KIBBLE_DEMO_MAX_PUBLIC_CLIENT_TIMEOUT_MS, KIBBLE_DEMO_PLP_CLIENT_TIMEOUT_MS, KIBBLE_DEMO_PROVIDER_DEADLINE_MS } from '$lib/kibble-demo-ai-boundary';
import { reserveKibbleDemoAiCall } from './kibble-demo-ai-budget';

beforeEach(() => {
	state.enabled = '';
	state.url = '';
	state.token = '';
	redisEval.mockReset();
});

describe('Kibble demo AI budget', () => {
	it('fails closed while the paid demo flag is disabled', async () => {
		expect(await reserveKibbleDemoAiCall('session-12345')).toEqual({ ok: false, reason: 'disabled' });
	});

	it('holds one shared session gate past the 12s deadline and both 15s/30s public retries', async () => {
		state.enabled = 'true';
		const now = new Date('2026-08-13T12:00:00.000Z');
		expect(await reserveKibbleDemoAiCall('session-12345', now)).toMatchObject({ ok: true, sessionUsed: 2, globalUsed: 2 });
		for (const retryAt of [KIBBLE_DEMO_PROVIDER_DEADLINE_MS, KIBBLE_DEMO_PLP_CLIENT_TIMEOUT_MS, KIBBLE_DEMO_MAX_PUBLIC_CLIENT_TIMEOUT_MS]) {
			expect(await reserveKibbleDemoAiCall('session-12345', new Date(now.getTime() + retryAt))).toEqual({ ok: false, reason: 'cooldown' });
		}
		expect(await reserveKibbleDemoAiCall('session-12345', new Date(now.getTime() + KIBBLE_DEMO_ACTION_COOLDOWN_MS))).toMatchObject({ ok: true, sessionUsed: 4, globalUsed: 4 });
	});

	it('rejects unsafe session identifiers', async () => {
		state.enabled = 'true';
		expect(await reserveKibbleDemoAiCall('bad/session')).toEqual({ ok: false, reason: 'unavailable' });
	});

	it('reserves two production budget units before a possible fallback call', async () => {
		state.enabled = 'true';
		state.url = 'https://redis.example';
		state.token = 'test-token';
		redisEval.mockResolvedValue([1, 'ok', 2, 2]);

		expect(await reserveKibbleDemoAiCall('session-prod-1')).toEqual({ ok: true, sessionUsed: 2, globalUsed: 2 });
		expect(redisEval).toHaveBeenCalledOnce();
		expect(redisEval.mock.calls[0]?.[2]).toEqual(['45', '12', '120', '86400', String(KIBBLE_DEMO_MAX_PROVIDER_CALLS_PER_ACTION)]);
	});

	it('caps one local session at six two-call reservations per day', async () => {
		state.enabled = 'true';
		const start = new Date('2026-08-14T12:00:00.000Z');
		for (let index = 0; index < 6; index += 1) {
			expect(await reserveKibbleDemoAiCall(
				'session-limit-1',
				new Date(start.getTime() + index * KIBBLE_DEMO_ACTION_COOLDOWN_MS),
			)).toMatchObject({ ok: true, sessionUsed: (index + 1) * 2 });
		}
		expect(await reserveKibbleDemoAiCall(
			'session-limit-1',
			new Date(start.getTime() + 6 * KIBBLE_DEMO_ACTION_COOLDOWN_MS),
		)).toEqual({ ok: false, reason: 'session_limit' });
	});
});
