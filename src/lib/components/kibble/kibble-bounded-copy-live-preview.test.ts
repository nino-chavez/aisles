import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	KIBBLE_SEARCH_DEFAULT_PRESENTATION,
	KIBBLE_SEARCH_PRESENTATION_POLICY,
	materializeKibbleSearchPresentation,
	snapshotKibbleSearchPresentation,
} from '$lib/brand/reference/kibble-presentation-decisions';
import type { KibbleLivePreviewStatus } from './kibble-dev-inspector';
import { listenForKibbleBoundedCopyLivePreview, validateKibbleBoundedCopyPreview } from './kibble-bounded-copy-live-preview';

const query = 'not-in-catalog';
const expectation = { surface: 'search' as const, routePath: '/search' as const, query, policyVersion: 'kibble-observe-assist-v2' };
const baseline = snapshotKibbleSearchPresentation(materializeKibbleSearchPresentation(KIBBLE_SEARCH_DEFAULT_PRESENTATION, query));

function response(copyVariantId = 'broaden-search') {
	return {
		version: 'kibble-bounded-copy-preview-v1', previewOnly: true, surface: 'search', routePath: '/search', query,
		policyVersion: expectation.policyVersion, provider: 'anthropic', modelId: 'claude-haiku-4-5', modelCallCount: 1,
		persona: 'researcher', presentationPolicy: KIBBLE_SEARCH_PRESENTATION_POLICY,
		presentationDecision: { emptyCopyVariantId: copyVariantId }, provenance: {}, descriptor: {},
		zoneAdapter: {
			instanceId: 'search.empty-state', sharedStatus: 'live', sharedContentKind: 'content', decisionMode: 'model', modelCallCount: 1,
			adapterId: 'kibble.zone.search.empty-state', componentVariantId: 'kibble.search.empty-state', inputSha256: 'a'.repeat(64),
			content: { component: 'editorial-header', props: { eyebrow: 'Try another path', headline: 'Search by routine instead.', body: 'Try an approved category.' } },
		},
	};
}

describe('Kibble bounded copy live preview', () => {
	afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

	it('accepts changed and unchanged merchant-approved copy decisions and rejects unapproved output', () => {
		expect(validateKibbleBoundedCopyPreview(response('broaden-search'), expectation)?.presentationDecision).toEqual({ emptyCopyVariantId: 'broaden-search' });
		expect(validateKibbleBoundedCopyPreview(response('merchant-baseline'), expectation)?.presentationDecision).toEqual(KIBBLE_SEARCH_DEFAULT_PRESENTATION);
		expect(validateKibbleBoundedCopyPreview(response('model-wrote-this'), expectation)).toBeNull();
	});

	it('reports exact changed-copy evidence after one validated provider response', async () => {
		const listeners = new EventTarget();
		vi.stubGlobal('window', Object.assign(listeners, { setTimeout, clearTimeout }));
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(response()), { status: 200 })));
		const statuses: KibbleLivePreviewStatus[] = [];
		const stop = listenForKibbleBoundedCopyLivePreview({ expectation, requestEvent: 'test-search-request', getCurrentPresentation: () => baseline, onApplied: () => {}, onStatus: (status) => statuses.push(status) });
		window.dispatchEvent(new Event('test-search-request'));
		await vi.waitFor(() => expect(statuses.at(-1)?.state).toBe('applied'));
		expect(statuses.at(-1)).toMatchObject({ changed: true, evidence: { provider: 'anthropic', calls: 1, copy: [expect.objectContaining({ changed: true })] } });
		stop();
	});

	it('keeps unchanged copy explicit and suppresses a duplicate in-flight dispatch', async () => {
		const listeners = new EventTarget();
		vi.stubGlobal('window', Object.assign(listeners, { setTimeout, clearTimeout }));
		let release!: (value: Response) => void;
		vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { release = resolve; })));
		const statuses: KibbleLivePreviewStatus[] = [];
		const stop = listenForKibbleBoundedCopyLivePreview({ expectation, requestEvent: 'test-search-request', getCurrentPresentation: () => baseline, onApplied: () => {}, onStatus: (status) => statuses.push(status) });
		window.dispatchEvent(new Event('test-search-request'));
		window.dispatchEvent(new Event('test-search-request'));
		expect(fetch).toHaveBeenCalledTimes(1);
		release(new Response(JSON.stringify(response('merchant-baseline')), { status: 200 }));
		await vi.waitFor(() => expect(statuses.at(-1)?.state).toBe('applied'));
		expect(statuses.at(-1)).toMatchObject({ changed: false, evidence: { copy: [expect.objectContaining({ changed: false })] } });
		stop();
	});

	it('compares a retry with the presentation currently on screen', async () => {
		const listeners = new EventTarget();
		vi.stubGlobal('window', Object.assign(listeners, { setTimeout, clearTimeout }));
		vi.stubGlobal('fetch', vi.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify(response('broaden-search')), { status: 200 }))
			.mockResolvedValueOnce(new Response(JSON.stringify(response('broaden-search')), { status: 200 })));
		const statuses: KibbleLivePreviewStatus[] = [];
		const stop = listenForKibbleBoundedCopyLivePreview({ expectation, requestEvent: 'test-search-request', getCurrentPresentation: () => baseline, onApplied: () => {}, onStatus: (status) => statuses.push(status) });
		window.dispatchEvent(new Event('test-search-request'));
		await vi.waitFor(() => expect(statuses.filter(({ state }) => state === 'applied')).toHaveLength(1));
		await Promise.resolve();
		window.dispatchEvent(new Event('test-search-request'));
		await vi.waitFor(() => expect(statuses.filter(({ state }) => state === 'applied')).toHaveLength(2));
		expect(statuses.at(-1)).toMatchObject({ changed: false, evidence: { copy: [expect.objectContaining({ changed: false })] } });
		stop();
	});

	it('times out safely, retains the baseline, and releases the dispatch lock', async () => {
		vi.useFakeTimers();
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const listeners = new EventTarget();
		vi.stubGlobal('window', Object.assign(listeners, { setTimeout, clearTimeout }));
		vi.stubGlobal('fetch', vi.fn((_url, init: RequestInit) => new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))));
		const statuses: KibbleLivePreviewStatus[] = [];
		const stop = listenForKibbleBoundedCopyLivePreview({ expectation, requestEvent: 'test-search-request', getCurrentPresentation: () => baseline, onApplied: () => {}, onStatus: (status) => statuses.push(status) });
		window.dispatchEvent(new Event('test-search-request'));
		await vi.advanceTimersByTimeAsync(16_000);
		expect(statuses.at(-1)).toMatchObject({ state: 'failed', evidence: { fallback: true, copy: [expect.objectContaining({ changed: false })] } });
		window.dispatchEvent(new Event('test-search-request'));
		expect(fetch).toHaveBeenCalledTimes(2);
		stop();
	});
});
