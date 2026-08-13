import { createHash } from 'node:crypto';

/** Canonical server-only bindings for the bounded PLP ranking action. */
export const KIBBLE_PLP_RANKING_ROUTE = '/category/dog-food' as const;
export const KIBBLE_PLP_RANKING_SORT = 'FEATURED' as const;

export type KibblePlpRankableCandidate = {
	entityId: number;
	name: string;
	category: string;
	price: number;
};

export function hashKibblePlpRankingInput(prefixIds: readonly string[], tailIds: readonly string[]) {
	return sha256Hex(JSON.stringify({ routePath: KIBBLE_PLP_RANKING_ROUTE, sort: KIBBLE_PLP_RANKING_SORT, cursor: null, prefixIds, tailIds }));
}

/** Binds exact current server-reloaded candidate facts, never a fixture. */
export function hashKibblePlpCandidateCatalog(candidates: readonly KibblePlpRankableCandidate[]) {
	return sha256Hex(JSON.stringify({ catalog: 'kibble-live-plp-candidates-v1', candidates: candidates.map(({ entityId, name, category, price }) => ({ entityId, name, category, price })) }));
}

export function sha256Hex(value: string) {
	return createHash('sha256').update(value).digest('hex');
}
