import type { SignalEmitter } from './emitter';
import type { PersonaInference, SignalEventType } from './types';

export const SIGNAL_CONFIRMATION_TIMEOUT_MS = 10_000;

export type SignalConfirmationFailure =
	| 'timeout'
	| 'cancelled'
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

export type SignalBatchReport =
	| { status: 'confirmed'; inference: PersonaInference }
	| { status: 'http'; code: number }
	| { status: 'invalid-response' }
	| { status: 'no-session' };

type PendingConfirmation = {
	resolve: (inference: PersonaInference) => void;
	reject: (error: SignalConfirmationError) => void;
	timer: ReturnType<typeof setTimeout>;
};

const pendingByEmitter = new WeakMap<SignalEmitter, Map<number, PendingConfirmation>>();

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
	let resolve!: (inference: PersonaInference) => void;
	let reject!: (error: SignalConfirmationError) => void;
	const confirmation = new Promise<PersonaInference>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	const sequence = emitter.emit(type, data);
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
