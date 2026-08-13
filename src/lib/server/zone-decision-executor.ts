/** Strict, provider-free zone-decision execution seam. */

import {
	createZoneDecisionContract,
	materializeTrustedZoneDecision,
	type GenerativeZoneDecisionContract,
	type MaterializedTrustedZoneDecision,
	type TrustedZoneFieldCatalog,
} from '$lib/foundation/zone-decision-schema';
import type { EffectiveCompositionPolicy } from '$lib/foundation/composition-policy';

export type ZonePublicationDisposition = 'publishable' | 'holdout' | 'approval_required';

export interface ZoneRulesRunner {
	/** Server-owned deterministic logic. It receives no model or prompt. */
	(contract: GenerativeZoneDecisionContract): unknown;
}

export interface ZoneModelRunner {
	/** The only model-facing input is the strict policy-derived schema. */
	(contract: Pick<GenerativeZoneDecisionContract, 'outputSchema' | 'allowed'>): Promise<unknown>;
}

export type ZoneDecisionExecution =
	| { kind: 'fixed'; publication: ZonePublicationDisposition; fixed: TrustedZoneFieldCatalog['fixed'] }
	| { kind: 'rules' | 'model'; publication: ZonePublicationDisposition; decision: MaterializedTrustedZoneDecision };

export class ZoneDecisionExecutionError extends Error {
	constructor(message: string) {
		super(`zone decision executor: ${message}`);
		this.name = 'ZoneDecisionExecutionError';
	}
}

export async function executeZoneDecision(input: {
	policy: EffectiveCompositionPolicy;
	catalog: TrustedZoneFieldCatalog;
	runRules?: ZoneRulesRunner;
	runModel?: ZoneModelRunner;
}): Promise<ZoneDecisionExecution> {
	const contract = createZoneDecisionContract(input.policy, input.catalog);
	const publication = publicationDisposition(contract.publicationMode);
	if (contract.kind === 'fixed') {
		// Fixed values are server-owned. This branch cannot invoke a runner.
		return { kind: 'fixed', publication, fixed: contract.fixed };
	}

	if (contract.kind === 'rules') {
		if (!input.runRules) throw new ZoneDecisionExecutionError('rules policy requires a server-owned rules runner');
		return {
			kind: 'rules', publication,
			decision: materializeTrustedZoneDecision(contract, input.runRules(contract)),
		};
	}

	if (!input.runModel) throw new ZoneDecisionExecutionError('model policy requires an injected model runner');
	const output = await input.runModel({ outputSchema: contract.outputSchema, allowed: contract.allowed });
	return { kind: 'model', publication, decision: materializeTrustedZoneDecision(contract, output) };
}

function publicationDisposition(mode: 'live' | 'holdout' | 'approval_required'): ZonePublicationDisposition {
	return mode === 'live' ? 'publishable' : mode;
}
