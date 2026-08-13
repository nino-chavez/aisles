import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEV_SIGNAL_REQUEST_TIMEOUT_MS, SignalEmitter } from './emitter';
import { infer } from './inference';
import { SignalStore } from './store';
import {
	registerConfirmedSignal,
	registerConfirmedDeferredSignalBatch,
	reportConfirmedSignalBatch,
	SignalConfirmationError,
} from './confirmed-signal.dev';

function actualInference(query = 'budget sale discount') {
	const store = new SignalStore(`confirmed-signal-${query}`);
	store.setBrandId('kibble');
	store.emit('nav.search', 'navigation', { query });
	return infer(store.toInferenceContext());
}

function installWindow() {
	const target = new EventTarget() as EventTarget & { location: { pathname: string }; innerWidth: number };
	target.location = { pathname: '/' };
	target.innerWidth = 390;
	vi.stubGlobal('window', target);
	return target;
}

let emitter: SignalEmitter | null = null;

afterEach(() => {
	emitter?.destroy();
	emitter = null;
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('development signal receipts', () => {
	it('settles only the exact registered sequence from a validated batch report', async () => {
		installWindow();
		vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})));
		emitter = new SignalEmitter();
		const first = registerConfirmedSignal(emitter, 'nav.search', { query: 'cozy inspiration ideas' });
		const second = registerConfirmedSignal(emitter, 'nav.search', { query: 'budget sale discount' });
		let secondSettled = false;
		void second.confirmation.finally(() => { secondSettled = true; });

		reportConfirmedSignalBatch(emitter, [first.sequence], { status: 'confirmed', inference: actualInference('cozy inspiration ideas') });
		await expect(first.confirmation).resolves.toMatchObject({ primary: 'gatherer' });
		expect(secondSettled).toBe(false);

		reportConfirmedSignalBatch(emitter, [second.sequence], { status: 'confirmed', inference: actualInference() });
		await expect(second.confirmation).resolves.toMatchObject({ primary: 'hunter' });
	});

	it('confirms a deferred multi-event behavior through one emitter request', async () => {
		installWindow();
		const store = new SignalStore('confirmed-behavior');
		store.setBrandId('kibble');
		for (const category of ['dog-food', 'treats-chews', 'walk-gear']) {
			store.emit('nav.category_view', 'navigation', { category });
		}
		const inference = infer(store.toInferenceContext());
		const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ received: 3, inference }), { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);
		emitter = new SignalEmitter();
		const attempt = registerConfirmedDeferredSignalBatch(emitter, [
			{ type: 'nav.category_view', data: { category: 'dog-food' } },
			{ type: 'nav.category_view', data: { category: 'treats-chews' } },
			{ type: 'nav.category_view', data: { category: 'walk-gear' } },
		]);

		await expect(attempt.confirmation).resolves.toMatchObject({ primary: 'gatherer' });
		expect(attempt.sequences).toEqual([0, 1, 2]);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).events).toHaveLength(3);
	});

	it('rejects an auto-flushing signal before creating a partial batch', () => {
		installWindow();
		vi.stubGlobal('fetch', vi.fn());
		const currentEmitter = new SignalEmitter();
		emitter = currentEmitter;
		expect(() => registerConfirmedDeferredSignalBatch(currentEmitter, [
			{ type: 'nav.category_view', data: { category: 'dog-food' } },
			{ type: 'nav.search', data: { query: 'gift' } },
		])).toThrow('nav.search auto-flushes');
		expect(fetch).not.toHaveBeenCalled();
	});

	it('times out without claiming the signal was rejected or unapplied', async () => {
		vi.useFakeTimers();
		installWindow();
		vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})));
		emitter = new SignalEmitter();
		const attempt = registerConfirmedSignal(emitter, 'nav.search', { query: 'compare best reviews' });
		const rejection = expect(attempt.confirmation).rejects.toMatchObject({ code: 'timeout' });
		await vi.advanceTimersByTimeAsync(10_000);
		await rejection;
	});

	it('drains a newer confirmed control after dropping an older stalled development batch', async () => {
		vi.useFakeTimers();
		installWindow();
		const inference = actualInference();
		const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
			if (fetchMock.mock.calls.length === 1) {
				return new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
				});
			}
			return Promise.resolve(new Response(JSON.stringify({ received: 1, inference }), { status: 200 }));
		});
		vi.stubGlobal('fetch', fetchMock);
		emitter = new SignalEmitter();
		emitter.emit('nav.search', { query: 'older stalled signal' });
		const attempt = registerConfirmedSignal(emitter, 'nav.search', { query: 'budget sale discount' });

		await vi.advanceTimersByTimeAsync(DEV_SIGNAL_REQUEST_TIMEOUT_MS);
		await expect(attempt.confirmation).resolves.toEqual(inference);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('ignores a late result after cancellation and does not affect a newer attempt', async () => {
		installWindow();
		vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})));
		emitter = new SignalEmitter();
		const oldAttempt = registerConfirmedSignal(emitter, 'nav.search', { query: 'cozy inspiration ideas' });
		oldAttempt.cancel();
		const oldRejection = expect(oldAttempt.confirmation).rejects.toBeInstanceOf(SignalConfirmationError);
		const currentAttempt = registerConfirmedSignal(emitter, 'nav.search', { query: 'budget sale discount' });

		reportConfirmedSignalBatch(emitter, [oldAttempt.sequence], { status: 'confirmed', inference: actualInference('cozy inspiration ideas') });
		await oldRejection;
		let currentSettled = false;
		void currentAttempt.confirmation.finally(() => { currentSettled = true; });
		await Promise.resolve();
		expect(currentSettled).toBe(false);

		reportConfirmedSignalBatch(emitter, [currentAttempt.sequence], { status: 'confirmed', inference: actualInference() });
		await expect(currentAttempt.confirmation).resolves.toMatchObject({ primary: 'hunter' });
	});
});
