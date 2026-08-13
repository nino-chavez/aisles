import { afterEach, describe, expect, it, vi } from 'vitest';
import { SignalEmitter } from './emitter';
import { infer } from './inference';
import { SignalStore } from './store';

function actualInference(query: string) {
	const store = new SignalStore(`emitter-${query}`);
	store.setBrandId('kibble');
	store.emit('nav.search', 'navigation', { query });
	return infer(store.toInferenceContext());
}

function response(query: string) {
	return new Response(JSON.stringify({ received: 1, inference: actualInference(query) }), { status: 200 });
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => { resolve = done; });
	return { promise, resolve };
}

function installWindow() {
	const target = new EventTarget() as EventTarget & { location: { pathname: string }; innerWidth: number };
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

describe('SignalEmitter response boundary', () => {
	it('immediately drains a high-priority event that arrived during an older request', async () => {
		installWindow();
		const first = deferred<Response>();
		const second = deferred<Response>();
		const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
			fetchMock.mock.calls.length === 1 ? first.promise : second.promise);
		vi.stubGlobal('fetch', fetchMock);

		emitter = new SignalEmitter();
		expect(emitter.emit('nav.search', { query: 'cozy inspiration ideas' })).toBe(0);
		expect(emitter.emit('nav.search', { query: 'budget sale discount' })).toBe(1);
		first.resolve(response('cozy inspiration ideas'));
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

		const secondBody = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string);
		expect(secondBody.events.map(({ sequence }: { sequence: number }) => sequence)).toEqual([1]);
		second.resolve(response('budget sale discount'));
		await emitter.flush();
	});

	it('does not dispatch malformed or count-mismatched inference responses', async () => {
		const target = installWindow();
		const listener = vi.fn();
		target.addEventListener('aisles-inference-update', listener);
		const fetchMock = vi.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({ received: 1, inference: { ...actualInference('sale'), approved: true } }), { status: 200 }))
			.mockResolvedValueOnce(new Response(JSON.stringify({ received: 2, inference: actualInference('sale') }), { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);

		emitter = new SignalEmitter();
		emitter.emit('nav.search', { query: 'sale' });
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		await emitter.flush();
		emitter.emit('nav.search', { query: 'sale' });
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
		await emitter.flush();
		expect(listener).not.toHaveBeenCalled();
	});
});
