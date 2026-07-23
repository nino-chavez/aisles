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

import type { SignalEventType, SignalSource } from './types';

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
	'refine.message',
	'nav.search',
];

export class SignalEmitter {
	private buffer: EmittedEvent[] = [];
	private sequence = 0;
	private flushTimer: ReturnType<typeof setInterval> | null = null;
	private flushing = false;

	constructor() {
		// Flush buffered events every 5 seconds
		this.flushTimer = setInterval(() => this.flush(), 5000);
	}

	emit(type: SignalEventType, data: Record<string, unknown> = {}) {
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
			this.flush();
		}
	}

	async flush() {
		if (this.buffer.length === 0 || this.flushing) return;

		this.flushing = true;
		const events = [...this.buffer];
		this.buffer = [];

		try {
			const res = await fetch('/api/signals', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ events }),
			});

			if (res.ok) {
				const data = await res.json();
				if (data.inference) {
					window.dispatchEvent(new CustomEvent('aisles-inference-update', {
						detail: data.inference,
					}));
				}
			}
		} catch {
			// Re-buffer on failure — prepend so order is preserved
			this.buffer = [...events, ...this.buffer];
		} finally {
			this.flushing = false;
		}
	}

	destroy() {
		if (this.flushTimer) {
			clearInterval(this.flushTimer);
			this.flushTimer = null;
		}
		this.flush(); // Final flush
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
