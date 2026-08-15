import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	KIBBLE_CART_PRESENTATION_POLICY,
	KIBBLE_CHECKOUT_PRESENTATION_POLICY,
	KIBBLE_SEARCH_DEFAULT_PRESENTATION,
	KIBBLE_SEARCH_PRESENTATION_POLICY,
	materializeKibbleCartPresentation,
	materializeKibbleCheckoutPresentation,
	materializeKibbleSearchPresentation,
	snapshotKibbleSearchPresentation,
} from '$lib/brand/reference/kibble-presentation-decisions';
import type { KibbleLivePreviewStatus } from './kibble-dev-inspector';
import { listenForKibbleBoundedCopyLivePreview, validateKibbleBoundedCopyPreview } from './kibble-bounded-copy-live-preview';

const query = 'not-in-catalog';
const expectation = { surface: 'search' as const, routePath: '/search' as const, query, policyVersion: 'kibble-observe-assist-v2' };
const baseline = snapshotKibbleSearchPresentation(materializeKibbleSearchPresentation(KIBBLE_SEARCH_DEFAULT_PRESENTATION, query));
const cartExpectation = { surface: 'cart' as const, routePath: '/cart' as const, policyVersion: 'kibble-observe-assist-v2' };
const checkoutExpectation = { surface: 'checkout' as const, routePath: '/checkout/prepaid' as const, subtype: 'prepaid' as const, policyVersion: 'kibble-observe-assist-v2' };

function response(copyVariantId = 'broaden-search') {
	const approvedDecision = copyVariantId === 'merchant-baseline'
		? KIBBLE_SEARCH_DEFAULT_PRESENTATION
		: { emptyCopyVariantId: 'broaden-search' as const };
	const copy = materializeKibbleSearchPresentation(approvedDecision, query).copy;
	return {
		version: 'kibble-bounded-copy-preview-v1', previewOnly: true, surface: 'search', routePath: '/search', query,
		policyVersion: expectation.policyVersion, provider: 'anthropic', modelId: 'claude-haiku-4-5', modelCallCount: 1,
		persona: 'researcher', presentationPolicy: KIBBLE_SEARCH_PRESENTATION_POLICY,
		presentationDecision: { emptyCopyVariantId: copyVariantId }, provenance: {}, descriptor: {},
		zoneAdapter: {
			instanceId: 'search.empty-state', sharedStatus: 'live', sharedContentKind: 'content', decisionMode: 'model', modelCallCount: 1,
			adapterId: 'kibble.zone.search.empty-state', componentVariantId: 'kibble.search.empty-state', inputSha256: 'a'.repeat(64),
			content: { component: 'editorial-header', props: { ...copy } },
		},
	};
}

function cartResponse() {
	const decision = { emptyCopyVariantId: 'return-to-routine' as const };
	const copy: { eyebrow: string; headline: string; body: string } = materializeKibbleCartPresentation(decision).copy;
	return {
		version: 'kibble-bounded-copy-preview-v1', previewOnly: true, surface: 'cart', routePath: '/cart',
		policyVersion: cartExpectation.policyVersion, provider: 'anthropic', modelId: 'claude-haiku-4-5', modelCallCount: 1,
		persona: 'gatherer', presentationPolicy: KIBBLE_CART_PRESENTATION_POLICY, presentationDecision: decision,
		zoneAdapter: {
			instanceId: 'cart.empty-state', sharedStatus: 'live', sharedContentKind: 'content', decisionMode: 'model', modelCallCount: 1,
			adapterId: 'kibble.zone.cart.empty-state', componentVariantId: 'kibble.cart.reference-shell', inputSha256: 'b'.repeat(64),
			content: { component: 'editorial-header', props: { ...copy } },
		},
	};
}

function checkoutResponse() {
	const decision = { assuranceCopyVariantId: 'trust-first' as const };
	const assurance = materializeKibbleCheckoutPresentation(decision).assurance;
	const callouts: Array<{ icon: string; label: string; body: string }> = assurance.callouts.map((item) => ({ ...item }));
	return {
		version: 'kibble-bounded-copy-preview-v1', previewOnly: true, surface: 'checkout', routePath: '/checkout/prepaid', subtype: 'prepaid',
		policyVersion: checkoutExpectation.policyVersion, provider: 'anthropic', modelId: 'claude-haiku-4-5', modelCallCount: 2,
		persona: 'hunter', presentationPolicy: KIBBLE_CHECKOUT_PRESENTATION_POLICY, presentationDecision: decision,
		zoneAdapter: {
			instanceId: 'checkout.assurance-strip', sharedStatus: 'live', sharedContentKind: 'content', decisionMode: 'model', modelCallCount: 2,
			adapterId: 'kibble.zone.checkout.assurance-strip', componentVariantId: 'kibble.checkout.reference-shell', inputSha256: 'c'.repeat(64),
			content: { component: 'service-callouts-grid', props: { columns: 3, callouts } },
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

	it('rejects adapter content, identity, and adjacent fields that do not match the approved decision', () => {
		const tamperedCopy = response();
		tamperedCopy.zoneAdapter.content.props.headline = 'Model-authored copy';
		expect(validateKibbleBoundedCopyPreview(tamperedCopy, expectation)).toBeNull();

		const tamperedIdentity = response();
		tamperedIdentity.zoneAdapter.adapterId = 'kibble.zone.search.adjacent';
		expect(validateKibbleBoundedCopyPreview(tamperedIdentity, expectation)).toBeNull();

		const extraAdapterField = response() as ReturnType<typeof response> & { zoneAdapter: ReturnType<typeof response>['zoneAdapter'] & { rawModelContent?: unknown } };
		extraAdapterField.zoneAdapter.rawModelContent = { headline: 'bypass' };
		expect(validateKibbleBoundedCopyPreview(extraAdapterField, expectation)).toBeNull();
	});

	it('binds Cart and Checkout adapters to the exact selected merchant variants', () => {
		expect(validateKibbleBoundedCopyPreview(cartResponse(), cartExpectation)?.zoneAdapter.instanceId).toBe('cart.empty-state');
		const tamperedCart = cartResponse();
		tamperedCart.zoneAdapter.content.props.body = 'Unapproved cart claim';
		expect(validateKibbleBoundedCopyPreview(tamperedCart, cartExpectation)).toBeNull();

		expect(validateKibbleBoundedCopyPreview(checkoutResponse(), checkoutExpectation)?.zoneAdapter.instanceId).toBe('checkout.assurance-strip');
		const tamperedCheckout = checkoutResponse();
		tamperedCheckout.zoneAdapter.content.props.callouts[0]!.body = 'Unapproved payment claim';
		expect(validateKibbleBoundedCopyPreview(tamperedCheckout, checkoutExpectation)).toBeNull();
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

	it('keeps rendered zones at zero while preserving the server-reported failed attempt count', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const listeners = new EventTarget();
		vi.stubGlobal('window', Object.assign(listeners, { setTimeout, clearTimeout }));
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
			error: 'Failed to preview Kibble bounded presentation decision',
			modelCallCount: 2,
		}), { status: 500 })));
		const statuses: KibbleLivePreviewStatus[] = [];
		const stop = listenForKibbleBoundedCopyLivePreview({ expectation, requestEvent: 'test-search-request', getCurrentPresentation: () => baseline, onApplied: () => {}, onStatus: (status) => statuses.push(status) });
		window.dispatchEvent(new Event('test-search-request'));
		await vi.waitFor(() => expect(statuses.at(-1)?.state).toBe('failed'));
		expect(statuses.at(-1)).toMatchObject({
			state: 'failed',
			evidence: { calls: 2, fallback: true, after: [] },
		});
		stop();
	});
});
