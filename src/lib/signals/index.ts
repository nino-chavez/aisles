export { infer } from './inference';
export { SignalStore } from './store';
export { createStoreFromRequest } from './request';
export { getSessionStore, hasSession, sessionCount } from './session';
export { SignalEmitter, initEmitter, destroyEmitter, getEmitter } from './emitter';
export { PERSONAS } from './types';
export type {
	Persona,
	PersonaInference,
	PersonaProbabilities,
	PersonaModifiers,
	PersonaShift,
	SignalEvent,
	SignalEventType,
	SignalSource,
	InferenceContext,
	InferenceRule,
	PersonaScoreAdjustment,
	RuleMatch,
} from './types';
