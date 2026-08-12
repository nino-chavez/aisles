/** Validation for the browser-facing signal route. Provider facts must not be forgeable by a client. */
export function validatePublicSignalProvenance(type: unknown, source: unknown): string | null {
	if (source === 'external') return 'External signals require a server-side authenticated producer';
	if (type === 'subscription.due_proximity' || type === 'subscription.tenure') {
		return `${type} is provider-derived and cannot be submitted from the public signal route`;
	}
	if (type === 'subscription.cadence_selected' || type === 'subscription.skip' || type === 'subscription.swap' || type === 'subscription.pause') {
		return source === 'interaction' ? null : `${type} must use source "interaction"`;
	}
	if (type === 'commerce.autoship_mix') return source === 'commerce' ? null : `${type} must use source "commerce"`;
	return null;
}
