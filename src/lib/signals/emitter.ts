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

import { PERSONAS, type PersonaInference, type SignalEventType, type SignalSource } from './types';

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

export interface SignalReceipt {
	sequence: number;
	inference: PersonaInference;
}

type PendingReceipt = {
	resolve: (receipt: SignalReceipt) => void;
	reject: (error: Error) => void;
};

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
	private flushPromise: Promise<void> | null = null;
	private pendingReceipts = new Map<number, PendingReceipt>();

	constructor() {
		// Flush buffered events every 5 seconds
		this.flushTimer = setInterval(() => void this.flush(), 5000);
	}

	emit(type: SignalEventType, data: Record<string, unknown> = {}) {
		this.enqueue(type, data);

		// Immediate flush for high-priority events
		if (HIGH_PRIORITY.includes(type)) {
			void this.flush();
		}
	}

	/**
	 * Emit one signal and resolve only when the batch containing that exact
	 * client sequence receives a scoped inference response. This is intended
	 * for development/operator controls that must not treat an unrelated global
	 * inference event as confirmation of their own action.
	 */
	emitConfirmed(type: SignalEventType, data: Record<string, unknown> = {}): Promise<SignalReceipt> {
		const event = this.enqueue(type, data);
		const receipt = new Promise<SignalReceipt>((resolve, reject) => {
			this.pendingReceipts.set(event.sequence, { resolve, reject });
		});
		void this.flush();
		return receipt;
	}

	private enqueue(type: SignalEventType, data: Record<string, unknown>): EmittedEvent {
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
		return event;
	}

	flush(): Promise<void> {
		if (this.flushPromise) return this.flushPromise;
		if (this.buffer.length === 0) return Promise.resolve();

		this.flushPromise = this.drainBuffer().finally(() => {
			this.flushPromise = null;
		});
		return this.flushPromise;
	}

	private async drainBuffer(): Promise<void> {
		while (this.buffer.length > 0) {
			const events = [...this.buffer];
			this.buffer = [];

			let res: Response;
			try {
				res = await fetch('/api/signals', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ events }),
				});
			} catch {
				// A failed request may still have reached the server. Do not retry
				// explicitly confirmed events and later report a contradictory result.
				const ordinaryEvents = events.filter((event) => !this.pendingReceipts.has(event.sequence));
				this.rejectReceipts(events, 'Signal confirmation failed; preview was not requested.');
				this.buffer = [...ordinaryEvents, ...this.buffer];
				return;
			}

			if (!res.ok) {
				this.rejectReceipts(events, `Signal endpoint rejected the event batch (${res.status}).`);
				continue;
			}

			let data: unknown;
			try {
				data = await res.json();
			} catch {
				this.rejectReceipts(events, 'Signal response could not be confirmed; preview was not requested.');
				continue;
			}

			if (!isRecord(data) || data.received !== events.length) {
				this.rejectReceipts(events, 'Signal response did not confirm the complete event batch; preview was not requested.');
				continue;
			}

			if (data.inference === null) {
				this.rejectReceipts(events, 'Signal endpoint returned no scoped inference; preview was not requested.');
				continue;
			}
			if (!isPersonaInference(data.inference)) {
				this.rejectReceipts(events, 'Signal response contained invalid inference; preview was not requested.');
				continue;
			}

			window.dispatchEvent(new CustomEvent('aisles-inference-update', {
				detail: data.inference,
			}));
			this.resolveReceipts(events, data.inference);
		}
	}

	private resolveReceipts(events: readonly EmittedEvent[], inference: PersonaInference) {
		for (const event of events) {
			const pending = this.pendingReceipts.get(event.sequence);
			if (!pending) continue;
			this.pendingReceipts.delete(event.sequence);
			pending.resolve({ sequence: event.sequence, inference });
		}
	}

	private rejectReceipts(events: readonly EmittedEvent[], message: string) {
		for (const event of events) {
			const pending = this.pendingReceipts.get(event.sequence);
			if (!pending) continue;
			this.pendingReceipts.delete(event.sequence);
			pending.reject(new Error(message));
		}
	}

	destroy() {
		if (this.flushTimer) {
			clearInterval(this.flushTimer);
			this.flushTimer = null;
		}
		void this.flush(); // Final flush
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

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

function isPersonaInference(value: unknown): value is PersonaInference {
	if (!isRecord(value) || typeof value.primary !== 'string' || !PERSONAS.includes(value.primary as PersonaInference['primary'])) return false;
	const probabilities = value.probabilities;
	if (!isRecord(probabilities) || !PERSONAS.every((persona) => isFiniteNumber(probabilities[persona]))) return false;
	if (!isFiniteNumber(value.confidence) || !isFiniteNumber(value.entropy) || !isFiniteNumber(value.certainty)) return false;
	if (!isRecord(value.modifiers)
		|| !isFiniteNumber(value.modifiers.priceSensitivity)
		|| !isFiniteNumber(value.modifiers.urgency)
		|| !isFiniteNumber(value.modifiers.familiarityWithStore)) return false;
	if (!isRecord(value.shift)
		|| typeof value.shift.detected !== 'boolean'
		|| !(value.shift.from === null || (typeof value.shift.from === 'string' && PERSONAS.includes(value.shift.from as PersonaInference['primary'])))
		|| !(value.shift.trigger === null || typeof value.shift.trigger === 'string')) return false;
	if (!Number.isInteger(value.signalCount) || (value.signalCount as number) < 0 || !isFiniteNumber(value.lastUpdated)) return false;
	if (!['request', 'navigation', 'interaction', 'commerce', 'refinement', 'external'].includes(value.dominantSource as string)) return false;
	if (!Array.isArray(value.ruleMatches) || !value.ruleMatches.every((match) => {
		if (!isRecord(match) || typeof match.ruleName !== 'string' || typeof match.reason !== 'string' || !isFiniteNumber(match.weight)) return false;
		if (!isRecord(match.adjustment)) return false;
		return Object.values(match.adjustment).every(isFiniteNumber);
	})) return false;
	return true;
}
