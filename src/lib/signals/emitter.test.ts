import { afterEach, describe, expect, it, vi } from 'vitest';
import { SignalEmitter } from './emitter';
import type { Persona, PersonaInference } from './types';

function inference(primary: Persona): PersonaInference {
	return {
		primary,
		probabilities: {
			gatherer: primary === 'gatherer' ? 0.7 : 0.1,
			hunter: primary === 'hunter' ? 0.7 : 0.1,
			researcher: primary === 'researcher' ? 0.7 : 0.1,
			gifter: primary === 'gifter' ? 0.7 : 0.1,
		},
		confidence: 0.6,
		entropy: 0.5,
		certainty: 0.7,
		modifiers: { priceSensitivity: 0, urgency: 0, familiarityWithStore: 0 },
		shift: { detected: false, from: null, trigger: null },
		signalCount: 1,
		lastUpdated: 1,
		dominantSource: 'navigation',
		ruleMatches: [],
	};
}

function signalResponse(primary: Persona, status = 200, received = 1) {
	return new Response(JSON.stringify({ received, inference: inference(primary) }), {
		status,
		headers: { 'content-type': 'application/json' },
	});
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, resolve, reject };
}

function installWindow() {
	const target = new EventTarget() as EventTarget & {
		location: { pathname: string };
		innerWidth: number;
	};
	target.location = { pathname: '/' };
	target.innerWidth = 1280;
	vi.stubGlobal('window', target);
	return target;
}

let emitter: SignalEmitter | null = null;

afterEach(() => {
	emitter?.destroy();
	emitter = null;
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('SignalEmitter confirmed receipts', () => {
	it('waits for the batch containing the exact sequence while an older flush is in flight', async () => {
		const target = installWindow();
		const first = deferred<Response>();
		const second = deferred<Response>();
		const fetchMock = vi.fn()
			.mockReturnValueOnce(first.promise)
			.mockReturnValueOnce(second.promise);
		vi.stubGlobal('fetch', fetchMock);
		const primaries: Persona[] = [];
		target.addEventListener('aisles-inference-update', (event) => {
			primaries.push((event as CustomEvent<PersonaInference>).detail.primary);
		});

		emitter = new SignalEmitter();
		emitter.emit('nav.search', { query: 'older request' });
		const receipt = emitter.emitConfirmed('nav.search', { query: 'clicked request' });
		let exactReceiptSettled = false;
		void receipt.finally(() => { exactReceiptSettled = true; });

		first.resolve(signalResponse('hunter'));
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
		expect(exactReceiptSettled).toBe(false);
		expect(primaries).toEqual(['hunter']);

		second.resolve(signalResponse('researcher'));
		await expect(receipt).resolves.toMatchObject({ sequence: 1, inference: { primary: 'researcher' } });
		expect(primaries).toEqual(['hunter', 'researcher']);

		const firstBatch = JSON.parse(fetchMock.mock.calls[0][1].body as string);
		const secondBatch = JSON.parse(fetchMock.mock.calls[1][1].body as string);
		expect(firstBatch.events.map(({ sequence }: { sequence: number }) => sequence)).toEqual([0]);
		expect(secondBatch.events.map(({ sequence }: { sequence: number }) => sequence)).toEqual([1]);
	});

	it('rejects only the exact confirmed signal when a mixed batch loses its response', async () => {
		installWindow();
		const fetchMock = vi.fn()
			.mockRejectedValueOnce(new Error('network lost'))
			.mockResolvedValueOnce(signalResponse('gatherer'));
		vi.stubGlobal('fetch', fetchMock);

		emitter = new SignalEmitter();
		emitter.emit('interact.scroll_depth', { depth: 0.5 });
		const receipt = emitter.emitConfirmed('nav.search', { query: 'clicked request' });
		await expect(receipt).rejects.toThrow('Signal confirmation failed; preview was not requested.');
		await Promise.resolve();
		await emitter.flush();

		expect(fetchMock).toHaveBeenCalledTimes(2);
		const retryBatch = JSON.parse(fetchMock.mock.calls[1][1].body as string);
		expect(retryBatch.events.map(({ sequence }: { sequence: number }) => sequence)).toEqual([0]);
	});

	it('settles every receipt in one captured batch from that batch response', async () => {
		installWindow();
		const prior = deferred<Response>();
		const receiptBatch = deferred<Response>();
		const fetchMock = vi.fn()
			.mockReturnValueOnce(prior.promise)
			.mockReturnValueOnce(receiptBatch.promise);
		vi.stubGlobal('fetch', fetchMock);

		emitter = new SignalEmitter();
		emitter.emit('nav.search', { query: 'prior request' });
		const firstReceipt = emitter.emitConfirmed('interact.scroll_depth', { depth: 0.25 });
		const secondReceipt = emitter.emitConfirmed('interact.scroll_depth', { depth: 0.75 });
		prior.resolve(signalResponse('gatherer'));
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

		receiptBatch.resolve(signalResponse('hunter', 200, 2));
		await expect(Promise.all([firstReceipt, secondReceipt])).resolves.toMatchObject([
			{ sequence: 1, inference: { primary: 'hunter' } },
			{ sequence: 2, inference: { primary: 'hunter' } },
		]);
		const batch = JSON.parse(fetchMock.mock.calls[1][1].body as string);
		expect(batch.events.map(({ sequence }: { sequence: number }) => sequence)).toEqual([1, 2]);
	});

	it('rejects a confirmed signal when the endpoint returns no scoped inference', async () => {
		const target = installWindow();
		const eventListener = vi.fn();
		target.addEventListener('aisles-inference-update', eventListener);
		vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ received: 1, inference: null }), {
			status: 200,
			headers: { 'content-type': 'application/json' },
		})));

		emitter = new SignalEmitter();
		await expect(emitter.emitConfirmed('nav.search', { query: 'clicked request' }))
			.rejects.toThrow('Signal endpoint returned no scoped inference; preview was not requested.');
		expect(eventListener).not.toHaveBeenCalled();
	});

	it('rejects count mismatches and malformed inference without dispatching an update', async () => {
		const target = installWindow();
		const eventListener = vi.fn();
		target.addEventListener('aisles-inference-update', eventListener);
		const fetchMock = vi.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({ received: 0, inference: inference('hunter') }), { status: 200 }))
			.mockResolvedValueOnce(new Response(JSON.stringify({ received: 1, inference: { primary: 'hunter' } }), { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);

		emitter = new SignalEmitter();
		await expect(emitter.emitConfirmed('nav.search', { query: 'count mismatch' }))
			.rejects.toThrow('Signal response did not confirm the complete event batch');
		await expect(emitter.emitConfirmed('nav.search', { query: 'malformed inference' }))
			.rejects.toThrow('Signal response contained invalid inference');
		expect(eventListener).not.toHaveBeenCalled();
	});
});
