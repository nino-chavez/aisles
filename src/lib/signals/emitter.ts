/**
 * Client-side signal emitter.
 *
 * Captures interaction and navigation signals in the browser,
 * buffers them, and flushes to /api/signals periodically or
 * immediately for high-priority events.
 *
 * Phase 2: emits nav.category_view via afterNavigate.
 * Phase 3+: scroll depth, dwell time, cart actions, etc.
 */

import { dev } from '$app/environment';
import type { SignalEventType, SignalSource } from './types';
import { parseConfirmedSignalBatch } from './client-inference-contract';

export const DEV_SIGNAL_REQUEST_TIMEOUT_MS = 8_000;
const DEV_SIGNAL_RETRY_DELAY_MS = 250;

interface EmittedEvent {
	type: SignalEventType;
	source: SignalSource;
	data: Record<string, unknown>;
	context: {
		page: string;
		category: string | null;
		viewport: 'mobile' | 'tablet' | 'desktop';
	};
	timestamp: number;
	sequence: number;
}

const HIGH_PRIORITY: SignalEventType[] = [
	'commerce.add_to_cart',
	'subscription.cadence_selected',
	'subscription.skip',
	'subscription.swap',
	'subscription.pause',
	'refine.message',
	'nav.search',
];

export class SignalEmitter {
	private buffer: EmittedEvent[] = [];
	private sequence = 0;
	private flushTimer: ReturnType<typeof setInterval> | null = null;
	private flushing = false;
	private destroyed = false;

	constructor() {
		// Flush buffered events every 5 seconds
		this.flushTimer = setInterval(() => this.flush(), 5000);
	}

	emit(type: SignalEventType, data: Record<string, unknown> = {}) {
		if (type === 'subscription.due_proximity' || type === 'subscription.tenure') {
			throw new Error(`${type} is provider-derived and must be sent to /api/signals as an external event`);
		}

		const event: EmittedEvent = {
			type,
			source: inferSource(type),
			data,
			context: {
				page: window.location.pathname,
				category: extractCategory(window.location.pathname),
				viewport: getViewport(),
			},
			timestamp: Date.now(),
			sequence: this.sequence++,
		};

		this.buffer.push(event);

		// Immediate flush for high-priority events
		if (HIGH_PRIORITY.includes(type)) {
			void this.flush();
		}

		return event.sequence;
	}

	async flush() {
		if (this.destroyed || this.buffer.length === 0 || this.flushing) return;

		this.flushing = true;
		const events = [...this.buffer];
		this.buffer = [];

		let retryLater = false;
		const requestController = dev ? new AbortController() : null;
		const requestTimeout = requestController
			? setTimeout(() => requestController.abort(), DEV_SIGNAL_REQUEST_TIMEOUT_MS)
			: null;
		try {
			const res = await fetch('/api/signals', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ events }),
				signal: requestController?.signal,
			});

			if (!res.ok) {
				this.reportDevelopmentBatch(events, { status: 'http', code: res.status });
				return;
			}

			let body: unknown;
			try {
				body = await res.json();
			} catch {
				this.reportDevelopmentBatch(events, { status: 'invalid-response' });
				return;
			}
			const data = parseConfirmedSignalBatch(body, events.length);
			if (!data) {
				this.reportDevelopmentBatch(events, { status: 'invalid-response' });
				return;
			}
			if (!data.inference) {
				this.reportDevelopmentBatch(events, { status: 'no-session' });
				return;
			}
			window.dispatchEvent(new CustomEvent('aisles-inference-update', {
				detail: data.inference,
			}));
			this.reportDevelopmentBatch(events, { status: 'confirmed', inference: data.inference });
		} catch {
			// Re-buffer on failure — prepend so order is preserved
			this.buffer = [...events, ...this.buffer];
			retryLater = true;
			if (dev && !this.destroyed) setTimeout(() => void this.flush(), DEV_SIGNAL_RETRY_DELAY_MS);
		} finally {
			if (requestTimeout) clearTimeout(requestTimeout);
			this.flushing = false;
			// A high-priority event may arrive while another batch is in flight.
			// Drain it immediately after a completed request instead of waiting for
			// the five-second interval. Network failures retain the original retry.
			if (!this.destroyed && !retryLater && this.buffer.length > 0) void this.flush();
		}
	}

	private reportDevelopmentBatch(
		events: readonly EmittedEvent[],
		report:
			| { status: 'confirmed'; inference: import('./types').PersonaInference }
			| { status: 'http'; code: number }
			| { status: 'invalid-response' | 'no-session' },
	): void {
		if (!dev) return;
		const sequences = events.map(({ sequence }) => sequence);
		void import('./confirmed-signal.dev').then(({ reportConfirmedSignalBatch }) => {
			reportConfirmedSignalBatch(this, sequences, report);
		});
	}

	destroy() {
		if (this.flushTimer) {
			clearInterval(this.flushTimer);
			this.flushTimer = null;
		}
		void this.flush(); // Final flush
		this.destroyed = true;
	}

	/**
	 * Send a best-effort finalize beacon on page unload. Uses navigator.sendBeacon
	 * when available so the request survives the unload. Called from a pagehide
	 * listener set up by initEmitter().
	 */
	finalize(converted = false) {
		if (typeof navigator === 'undefined') return;
		const body = JSON.stringify({ converted });
		try {
			if ('sendBeacon' in navigator) {
				const blob = new Blob([body], { type: 'application/json' });
				navigator.sendBeacon('/api/signals/finalize', blob);
				return;
			}
			// Fallback: keepalive fetch
			fetch('/api/signals/finalize', {
				method: 'POST',
				body,
				headers: { 'content-type': 'application/json' },
				keepalive: true,
			}).catch(() => {});
		} catch {
			// Swallow — best effort
		}
	}
}

function inferSource(type: SignalEventType): SignalSource {
	if (type.startsWith('request.')) return 'request';
	if (type.startsWith('nav.')) return 'navigation';
	if (type.startsWith('interact.')) return 'interaction';
	if (type.startsWith('commerce.')) return 'commerce';
	if (type.startsWith('subscription.')) return 'interaction';
	if (type.startsWith('refine.')) return 'refinement';
	return 'navigation';
}

// ─── Singleton access ──────────────────────────────────────────

let instance: SignalEmitter | null = null;

/** Initialize the global emitter. Called once in +layout.svelte. */
export function initEmitter(): SignalEmitter {
	instance?.destroy();
	instance = new SignalEmitter();

	// Finalize the session on page hide. pagehide fires for tab close, nav
	// away, and backgrounding on mobile — more reliable than beforeunload.
	if (typeof window !== 'undefined') {
		window.addEventListener('pagehide', () => {
			instance?.finalize();
		});
	}

	return instance;
}

/** Get the global emitter. Returns null if not initialized (SSR). */
export function getEmitter(): SignalEmitter | null {
	return instance;
}

/** Destroy the global emitter. Called on layout cleanup. */
export function destroyEmitter() {
	instance?.destroy();
	instance = null;
}

function extractCategory(pathname: string): string | null {
	const match = pathname.match(/^\/category\/([^/]+)/);
	return match ? match[1] : null;
}

function getViewport(): 'mobile' | 'tablet' | 'desktop' {
	const w = window.innerWidth;
	if (w < 768) return 'mobile';
	if (w < 1024) return 'tablet';
	return 'desktop';
}
