import type { Surface } from './zones';

export type PresentationProduct = {
	id: string;
	name: string;
	variant?: string;
};

export type PresentationChange = {
	id: string;
	label: string;
	before: string;
	after: string;
	changed: boolean;
};

export type PresentationSnapshot = {
	copy: Array<{ id: string; label: string; value: string }>;
	components: Array<{ id: string; label: string; value: string }>;
	sections: Array<{ id: string; label: string; value: string }>;
	marketingBlocks: Array<{ id: string; label: string; value: string }>;
};

export type PresentationDecisionEvidence<SurfaceName extends string = Surface> = {
	surface: SurfaceName;
	zoneId: string;
	zoneLabel: string;
	policyVersion: string;
	provider: string | null;
	model: string | null;
	calls: number | null;
	before: PresentationProduct[];
	after: PresentationProduct[];
	moved: PresentationProduct[];
	added: PresentationProduct[];
	removed: PresentationProduct[];
	unchanged: PresentationProduct[];
	copy: PresentationChange[];
	components: PresentationChange[];
	sections: PresentationChange[];
	marketingBlocks: PresentationChange[];
	state: 'applied' | 'failed';
	outcome: 'changed' | 'kept';
	fallback: boolean;
};

export function buildPresentationDecisionEvidence<SurfaceName extends string>(input: {
	surface: SurfaceName;
	zoneId: string;
	zoneLabel: string;
	policyVersion: string;
	before: readonly PresentationProduct[];
	after: readonly PresentationProduct[];
	provider: string | null;
	model: string | null;
	calls: number | null;
	state: 'applied' | 'failed';
	presentationBefore?: PresentationSnapshot;
	presentationAfter?: PresentationSnapshot;
}): PresentationDecisionEvidence<SurfaceName> {
	const before = input.before.map(({ id, name }) => ({ id, name }));
	const after = input.after.map(({ id, name }) => ({ id, name }));
	const beforeById = new Map(before.map((product, index) => [product.id, { product, index }]));
	const afterIds = new Set(after.map(({ id }) => id));
	const beforeIds = new Set(before.map(({ id }) => id));
	const presentationBefore = input.presentationBefore ?? emptyPresentationSnapshot();
	const presentationAfter = input.presentationAfter ?? presentationBefore;
	const copy = comparePresentationEntries(presentationBefore.copy, presentationAfter.copy);
	const components = comparePresentationEntries(presentationBefore.components, presentationAfter.components);
	const sections = comparePresentationEntries(presentationBefore.sections, presentationAfter.sections);
	const marketingBlocks = comparePresentationEntries(presentationBefore.marketingBlocks, presentationAfter.marketingBlocks);
	const moved = after.filter((product, index) => beforeById.has(product.id) && beforeById.get(product.id)?.index !== index);
	const added = after.filter(({ id }) => !beforeIds.has(id));
	const removed = before.filter(({ id }) => !afterIds.has(id));
	const unchanged = after.filter((product, index) => beforeById.get(product.id)?.index === index);
	const changed = moved.length > 0 || added.length > 0 || removed.length > 0
		|| [...copy, ...components, ...sections, ...marketingBlocks].some(({ changed: entryChanged }) => entryChanged);

	return {
		surface: input.surface,
		zoneId: input.zoneId,
		zoneLabel: input.zoneLabel,
		policyVersion: input.policyVersion,
		provider: input.provider,
		model: input.model,
		calls: input.calls,
		before,
		after,
		moved,
		added,
		removed,
		unchanged,
		copy,
		components,
		sections,
		marketingBlocks,
		state: input.state,
		outcome: changed ? 'changed' : 'kept',
		fallback: input.state === 'failed',
	};
}

export function hasPresentationDecisionChanged(evidence: Pick<PresentationDecisionEvidence, 'outcome'>): boolean {
	return evidence.outcome === 'changed';
}

export function describePresentationDecisionOutcome(evidence: Pick<PresentationDecisionEvidence, 'state' | 'outcome'>): string {
	if (evidence.state === 'failed') return 'Fallback kept the existing presentation.';
	return evidence.outcome === 'changed' ? 'AI changed the approved presentation.' : 'AI kept the existing presentation.';
}

function comparePresentationEntries(
	before: PresentationSnapshot['copy'],
	after: PresentationSnapshot['copy'],
): PresentationChange[] {
	const beforeById = new Map(before.map((entry) => [entry.id, entry]));
	const afterById = new Map(after.map((entry) => [entry.id, entry]));
	const ids = [...new Set([...beforeById.keys(), ...afterById.keys()])];
	return ids.map((id) => {
		const beforeEntry = beforeById.get(id);
		const afterEntry = afterById.get(id);
		const beforeValue = beforeEntry?.value ?? 'Not shown';
		const afterValue = afterEntry?.value ?? 'Not shown';
		return { id, label: afterEntry?.label ?? beforeEntry?.label ?? id, before: beforeValue, after: afterValue, changed: beforeValue !== afterValue };
	});
}

function emptyPresentationSnapshot(): PresentationSnapshot {
	return { copy: [], components: [], sections: [], marketingBlocks: [] };
}
