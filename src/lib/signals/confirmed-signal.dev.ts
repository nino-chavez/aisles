import type { SignalEmitter } from './emitter';
import type { PersonaInference, SignalEventType } from './types';

export const SIGNAL_CONFIRMATION_TIMEOUT_MS = 10_000;

export type SignalConfirmationFailure =
	| 'timeout'
	| 'cancelled'
	| 'network'
	| 'http'
	| 'invalid-response'
	| 'no-session';

export class SignalConfirmationError extends Error {
	constructor(public readonly code: SignalConfirmationFailure, message: string) {
		super(message);
		this.name = 'SignalConfirmationError';
	}
}

export type ConfirmedSignal = {
	sequence: number;
	confirmation: Promise<PersonaInference>;
	cancel: () => void;
};

export type ConfirmedSignalBatch = {
	sequences: readonly number[];
	confirmation: Promise<PersonaInference>;
	cancel: () => void;
};

export interface DeferredSignalInput {
	type: SignalEventType;
	data?: Record<string, unknown>;
}

export type SignalBatchReport =
	| { status: 'confirmed'; inference: PersonaInference }
	| { status: 'http'; code: number }
	| { status: 'network' }
	| { status: 'invalid-response' }
	| { status: 'no-session' };

type PendingConfirmation = {
	resolve: (inference: PersonaInference) => void;
	reject: (error: SignalConfirmationError) => void;
	timer: ReturnType<typeof setTimeout>;
};

const pendingByEmitter = new WeakMap<SignalEmitter, Map<number, PendingConfirmation>>();
const listeningTargets = new WeakSet<EventTarget>();
const IMMEDIATE_SIGNAL_TYPES = new Set<SignalEventType>([
	'commerce.add_to_cart',
	'subscription.cadence_selected',
	'subscription.skip',
	'subscription.swap',
	'subscription.pause',
	'refine.message',
	'nav.search',
]);

/**
 * Development-only exact-sequence receipt. The shared SignalEmitter remains
 * the only queue and transport; this helper merely observes its validated
 * batch result and never enters the production shopper bundle.
 */
export function registerConfirmedSignal(
	emitter: SignalEmitter,
	type: SignalEventType,
	data: Record<string, unknown> = {},
	timeoutMs = SIGNAL_CONFIRMATION_TIMEOUT_MS,
): ConfirmedSignal {
	ensureBatchListener();
	const sequence = emitter.emit(type, data);
	return registerSequenceConfirmation(emitter, sequence, timeoutMs);
}

/**
 * Queue a synthetic multi-event behavior as one normal emitter batch. Only
 * deferred signal types are accepted so no early auto-flush can split the
 * behavior before every exact-sequence receipt has been registered.
 */
export function registerConfirmedDeferredSignalBatch(
	emitter: SignalEmitter,
	events: readonly DeferredSignalInput[],
	timeoutMs = SIGNAL_CONFIRMATION_TIMEOUT_MS,
): ConfirmedSignalBatch {
	if (events.length === 0 || events.length > 20) {
		throw new Error('A confirmed development behavior requires 1 through 20 signals.');
	}
	for (const event of events) {
		if (IMMEDIATE_SIGNAL_TYPES.has(event.type)) {
			throw new Error(`${event.type} auto-flushes and cannot enter a deferred development batch.`);
		}
	}

	ensureBatchListener();
	const attempts = events.map((event) => {
		const sequence = emitter.emit(event.type, event.data ?? {});
		return registerSequenceConfirmation(emitter, sequence, timeoutMs);
	});
	void emitter.flush();

	return {
		sequences: attempts.map(({ sequence }) => sequence),
		confirmation: Promise.all(attempts.map(({ confirmation }) => confirmation)).then((inferences) => inferences.at(-1)!),
		cancel: () => attempts.forEach(({ cancel }) => cancel()),
	};
}

function registerSequenceConfirmation(
	emitter: SignalEmitter,
	sequence: number,
	timeoutMs: number,
): ConfirmedSignal {
	let resolve!: (inference: PersonaInference) => void;
	let reject!: (error: SignalConfirmationError) => void;
	const confirmation = new Promise<PersonaInference>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	const pending = confirmationsFor(emitter);
	const timer = setTimeout(() => {
		if (!pending.delete(sequence)) return;
		reject(new SignalConfirmationError(
			'timeout',
			'Signal was not confirmed within 10 seconds. Delivery is uncertain; no preview confirmation was received.',
		));
	}, timeoutMs);
	pending.set(sequence, { resolve, reject, timer });

	return {
		sequence,
		confirmation,
		cancel: () => settleFailure(emitter, sequence, new SignalConfirmationError('cancelled', 'Signal confirmation was cancelled.')),
	};
}

function ensureBatchListener(): void {
	if (listeningTargets.has(window)) return;
	listeningTargets.add(window);
	window.addEventListener('aisles-dev-signal-batch-result', (event) => {
		if (!(event instanceof CustomEvent) || !isBatchEventDetail(event.detail)) return;
		reportConfirmedSignalBatch(event.detail.emitter, event.detail.sequences, event.detail.report);
	});
}

function isBatchEventDetail(value: unknown): value is {
	emitter: SignalEmitter;
	sequences: number[];
	report: SignalBatchReport;
} {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
	const detail = value as Record<string, unknown>;
	return !!detail.emitter
		&& typeof detail.emitter === 'object'
		&& Array.isArray(detail.sequences)
		&& detail.sequences.every((sequence) => Number.isSafeInteger(sequence) && sequence >= 0)
		&& !!detail.report
		&& typeof detail.report === 'object';
}

/** Called only from SignalEmitter's compile-time development branch. */
export function reportConfirmedSignalBatch(
	emitter: SignalEmitter,
	sequences: readonly number[],
	report: SignalBatchReport,
): void {
	for (const sequence of sequences) {
		if (report.status === 'confirmed') {
			settleSuccess(emitter, sequence, report.inference);
			continue;
		}
		if (report.status === 'http') {
			settleFailure(emitter, sequence, new SignalConfirmationError('http', `Signal endpoint returned ${report.code}.`));
			continue;
		}
		if (report.status === 'no-session') {
			settleFailure(emitter, sequence, new SignalConfirmationError('no-session', 'Signal endpoint returned no active inference session.'));
			continue;
		}
		if (report.status === 'network') {
			settleFailure(emitter, sequence, new SignalConfirmationError(
				'network',
				'Signal delivery is uncertain because the development request did not complete; no preview confirmation was received.',
			));
			continue;
		}
		settleFailure(emitter, sequence, new SignalConfirmationError('invalid-response', 'Signal endpoint returned an invalid confirmation.'));
	}
}

function confirmationsFor(emitter: SignalEmitter): Map<number, PendingConfirmation> {
	let confirmations = pendingByEmitter.get(emitter);
	if (!confirmations) {
		confirmations = new Map();
		pendingByEmitter.set(emitter, confirmations);
	}
	return confirmations;
}

function settleSuccess(emitter: SignalEmitter, sequence: number, inference: PersonaInference): void {
	const pending = pendingByEmitter.get(emitter);
	const confirmation = pending?.get(sequence);
	if (!confirmation) return;
	pending?.delete(sequence);
	clearTimeout(confirmation.timer);
	confirmation.resolve(inference);
}

function settleFailure(emitter: SignalEmitter, sequence: number, error: SignalConfirmationError): void {
	const pending = pendingByEmitter.get(emitter);
	const confirmation = pending?.get(sequence);
	if (!confirmation) return;
	pending?.delete(sequence);
	clearTimeout(confirmation.timer);
	confirmation.reject(error);
}
