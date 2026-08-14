import type { EffectiveCompositionPolicy, AutonomyCapability, DecisionMode } from '$lib/foundation/composition-policy';
import type { PersonaInference } from '$lib/signals/types';
import type { PersonaFitScores } from '$lib/server/enrichment/types';
import type { Product } from '$lib/types';
import type { KibbleCatalogSignals } from './kibble-catalog-enrichment';
import { assertKibblePreserveRoutePolicy, getContractSurfaceDecision } from '../composition-policy';
import { KIBBLE_PRESERVE_MANIFEST } from './kibble-manifest';
import { KIBBLE_REFERENCE_CONTRACT } from './kibble';

export const KIBBLE_HOME_SHELF_CAPACITY = 8;

export type KibbleHomeCandidateProduct = Product & {
	personaFit?: PersonaFitScores | null;
	catalogSignals?: KibbleCatalogSignals;
};

export interface KibbleHomeProductSummary {
	id: string;
	name: string;
	variant?: string;
}

export interface KibbleHomeZoneTrace {
	id: string;
	label: string;
	authority: DecisionMode;
	componentVariant: string;
	capabilities: AutonomyCapability[];
	decisionSummary: string;
	changed: boolean;
	inputProducts?: KibbleHomeProductSummary[];
	outputProducts?: KibbleHomeProductSummary[];
	modelCallStatus: { calls: 0; authorized: false };
}

export interface KibbleHomeDecisionInspector {
	reference: { id: string; version: string };
	surface: 'home';
	preset: 'preserve';
	policyVersion: string;
	publicationMode: 'live';
	inference: PersonaInference;
	dataSourceLabel: 'merchant-enrichment' | 'merchant-order-fallback';
	zones: KibbleHomeZoneTrace[];
}

export interface KibbleHomeDecision {
	products: KibbleHomeCandidateProduct[];
	inspector: KibbleHomeDecisionInspector;
}

/** Apply only the exact deterministic product authority granted to Kibble Preserve Home. */
export function decideKibbleHome(
	policy: EffectiveCompositionPolicy,
	inference: PersonaInference,
	candidates: readonly KibbleHomeCandidateProduct[],
): KibbleHomeDecision {
	const trusted = getContractSurfaceDecision('kibble', 'home');
	if (trusted.mode !== 'reference-preserve') throw new Error('Kibble Preserve Home policy is unavailable.');
	if (
		policy.policyVersion !== trusted.policy.policyVersion ||
		JSON.stringify(policy.provenance) !== JSON.stringify(trusted.policy.provenance)
	) {
		throw new Error('Kibble Preserve policy identity does not authorize home.');
	}
	if (!sameCapabilities(policy.capabilities, trusted.policy.capabilities)) {
		throw new Error('Kibble Preserve home capabilities do not match the approved route contract.');
	}
	assertKibblePreserveRoutePolicy(policy, 'home');

	const eligible = uniqueCandidates(candidates).filter(
		(product) => product.entityId !== KIBBLE_PRESERVE_MANIFEST.display.featuredBundle.entityId,
	);
	const scoredSlots = eligible
		.map((product, index) => ({ index, product, score: validScore(product.personaFit?.[inference.primary]) }))
		.filter((entry): entry is typeof entry & { score: number } => entry.score !== null);
	const ranked = [...eligible];
	const sortedScoredProducts = scoredSlots
		.map(({ product, score, index }) => ({ product, score, index }))
		.sort((left, right) => right.score - left.score || left.index - right.index)
		.map(({ product }) => product);
	for (const [position, slot] of scoredSlots.entries()) ranked[slot.index] = sortedScoredProducts[position];
	const products = ranked.slice(0, KIBBLE_HOME_SHELF_CAPACITY);
	const dataSource = scoredSlots.length > 0 ? 'merchant-enrichment' : 'merchant-order-fallback';
	const inputProducts = candidates.map((product) => summarizeProduct(product, inference.primary));
	const outputProducts = products.map((product) => summarizeProduct(product, inference.primary));
	const changed = !sameProductOrder(inputProducts, outputProducts);

	return {
		products,
		inspector: {
			reference: { id: KIBBLE_REFERENCE_CONTRACT.id, version: KIBBLE_REFERENCE_CONTRACT.version },
			surface: 'home',
			preset: 'preserve',
			policyVersion: policy.policyVersion,
			publicationMode: 'live',
			inference: structuredClone(inference),
			dataSourceLabel: dataSource,
			zones: buildZoneTrace(inputProducts, outputProducts, inference.primary, dataSource, changed),
		},
	};
}

function buildZoneTrace(
	inputProducts: KibbleHomeProductSummary[],
	outputProducts: KibbleHomeProductSummary[],
	persona: PersonaInference['primary'],
	dataSource: KibbleHomeDecisionInspector['dataSourceLabel'],
	changed: boolean,
): KibbleHomeZoneTrace[] {
	const labels: Record<string, string> = {
		'merchant-chrome': 'Root header',
		'opening-merchandising': 'Opening hero',
		'ranked-products': 'Ranked products',
		'catalog-entry': 'Catalog entry',
		'service-proof': 'Service proof',
		'merchant-footer': 'Root footer',
	};
	return KIBBLE_REFERENCE_CONTRACT.recipes.home.orderedAnatomy.map((slot) => {
		const isProductZone = slot.slot === 'ranked-products';
		return {
			id: slot.slot,
			label: labels[slot.slot] ?? slot.slot,
			authority: isProductZone ? 'rules' : 'fixed',
			componentVariant: slot.variantId,
			capabilities: isProductZone ? ['rank_products', 'select_products'] : [],
			decisionSummary: isProductZone
				? dataSource === 'merchant-enrichment'
					? `Ranked enriched candidates for the inferred ${persona} persona, then selected up to ${KIBBLE_HOME_SHELF_CAPACITY}.`
					: `No ${persona} fit enrichment was available; retained merchant candidate order and selected up to ${KIBBLE_HOME_SHELF_CAPACITY}.`
				: 'Rendered the pinned reference component without a runtime decision.',
			changed: isProductZone ? changed : false,
			...(isProductZone ? { inputProducts, outputProducts } : {}),
			modelCallStatus: { calls: 0, authorized: false },
		};
	});
}

function uniqueCandidates(candidates: readonly KibbleHomeCandidateProduct[]): KibbleHomeCandidateProduct[] {
	const unique = new Map<number, KibbleHomeCandidateProduct>();
	for (const product of candidates) if (!unique.has(product.entityId)) unique.set(product.entityId, product);
	return [...unique.values()];
}

function validScore(score: number | undefined): number | null {
	return typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 1 ? score : null;
}

function sameCapabilities(
	actual: readonly AutonomyCapability[],
	expected: readonly AutonomyCapability[],
): boolean {
	return actual.length === expected.length &&
		actual.every((capability) => expected.includes(capability)) &&
		expected.every((capability) => actual.includes(capability));
}

function summarizeProduct(
	product: KibbleHomeCandidateProduct,
	persona: PersonaInference['primary'],
): KibbleHomeProductSummary {
	const score = validScore(product.personaFit?.[persona]);
	return {
		id: product.id,
		name: product.name,
		...(score === null ? {} : { variant: `${persona} fit ${score.toFixed(3)}` }),
	};
}

function sameProductOrder(left: readonly KibbleHomeProductSummary[], right: readonly KibbleHomeProductSummary[]): boolean {
	return left.length === right.length && left.every((product, index) => product.id === right[index]?.id);
}
