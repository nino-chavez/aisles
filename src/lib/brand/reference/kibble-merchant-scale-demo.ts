import {
	KIBBLE_MERCHANDISING_GRAPH_SOURCES,
	KIBBLE_MERCHANDISING_PRODUCTS,
	getKibbleCatalogPurchaseEvidence,
} from './kibble-merchandising-graph';
import {
	KIBBLE_MULTIPET_CATALOG,
	kibbleMultipetCatalogCoverage,
} from './kibble-multipet-catalog';

export const KIBBLE_MERCHANT_OPERATING_MODEL_IDS = [
	'owner-led',
	'regional-team',
	'enterprise-network',
] as const;

export type KibbleMerchantOperatingModelId = typeof KIBBLE_MERCHANT_OPERATING_MODEL_IDS[number];

export type KibbleMerchantDemoEvidenceClass =
	| 'source-backed-current'
	| 'source-backed-research'
	| 'shopper-provided-scenario'
	| 'synthetic-operating-data';

export type KibbleMerchantDemoOwner =
	| 'merchant'
	| 'shopper'
	| 'aisles'
	| 'commerce-platform'
	| 'subscription-provider';

export type KibbleMerchantDecisionDisposition = 'kept' | 'changed' | 'withheld';

export type KibbleMerchantScaleInput = {
	readonly owner: KibbleMerchantDemoOwner;
	readonly label: string;
	readonly value: string;
	readonly evidenceClass: KibbleMerchantDemoEvidenceClass;
};

export type KibbleMerchantScaleDecision = {
	readonly key: string;
	readonly label: string;
	readonly scope: string;
	readonly before: string;
	readonly after: string;
	readonly disposition: KibbleMerchantDecisionDisposition;
	readonly reason: string;
	readonly evidenceClass: KibbleMerchantDemoEvidenceClass;
};

export type KibbleMerchantScaleScenario = {
	readonly id: KibbleMerchantOperatingModelId;
	readonly sizeLabel: 'Small merchant' | 'Medium merchant' | 'Enterprise merchant';
	readonly operatingModel: string;
	readonly maturity: 'assist' | 'orchestrate' | 'govern';
	readonly headline: string;
	readonly merchantJob: string;
	readonly shopperStory: string;
	readonly result: string;
	readonly proofNow: readonly string[];
	readonly missingIntegration: readonly string[];
	readonly inputs: readonly KibbleMerchantScaleInput[];
	readonly decisions: readonly KibbleMerchantScaleDecision[];
	readonly evidenceNote: string;
};

export type KibbleMerchantCatalogLedgerRow = {
	readonly key: string;
	readonly sku: string;
	readonly name: string;
	readonly species: readonly string[];
	readonly role: string;
	readonly merchantStatus: 'current-catalog-evidence' | 'not-approved-research';
	readonly sourceLabel: string;
	readonly sourceUrl: string | null;
};

export const KIBBLE_MERCHANT_SCALE_OWNERSHIP = Object.freeze([
	{
		owner: 'merchant',
		label: 'Merchant',
		owns: 'Products, claims, price, availability, assortment, policy, and approval.',
		doesNotOwn: 'Shopper consent or Aisles ranking implementation.',
	},
	{
		owner: 'shopper',
		label: 'Shopper',
		owns: 'Pet profile, household context, preferences, consent, and intent.',
		doesNotOwn: 'Merchant facts, product eligibility, or provider status.',
	},
	{
		owner: 'aisles',
		label: 'Aisles',
		owns: 'Ranking approved candidates, applying supplied constraints, and explaining changed, kept, and withheld results.',
		doesNotOwn: 'Catalog facts, medical suitability, inventory, price, plans, orders, or approval.',
	},
	{
		owner: 'commerce-platform',
		label: 'Commerce platform',
		owns: 'Authoritative catalog reads and authorized catalog, cart, checkout, and order writes.',
		doesNotOwn: 'Personalization policy or shopper consent.',
	},
	{
		owner: 'subscription-provider',
		label: 'Subscription provider',
		owns: 'Plan availability, eligibility, cadence, enrollment, and subscription lifecycle.',
		doesNotOwn: 'Storefront ranking or merchant product approval.',
	},
] as const satisfies readonly {
	owner: KibbleMerchantDemoOwner;
	label: string;
	owns: string;
	doesNotOwn: string;
}[]);

export const KIBBLE_CURRENT_CATALOG_LEDGER: readonly KibbleMerchantCatalogLedgerRow[] = Object.freeze(
	KIBBLE_MERCHANDISING_PRODUCTS.map((product) => ({
		key: String(product.entityId),
		sku: product.sku,
		name: product.name,
		species: ['dog'],
		role: product.role,
		merchantStatus: 'current-catalog-evidence' as const,
		sourceLabel: KIBBLE_MERCHANDISING_GRAPH_SOURCES.currentCategoryMapping.path,
		sourceUrl: null,
	})),
);

export const KIBBLE_RESEARCH_CANDIDATE_LEDGER: readonly KibbleMerchantCatalogLedgerRow[] = Object.freeze(
	KIBBLE_MULTIPET_CATALOG.products.map((product) => ({
		key: product.id,
		sku: product.sku,
		name: product.name,
		species: product.metadata.species,
		role: product.metadata.productRole,
		merchantStatus: 'not-approved-research' as const,
		sourceLabel: product.source.retailer,
		sourceUrl: product.source.url,
	})),
);

const currentCatalogById = new Map<number, (typeof KIBBLE_MERCHANDISING_PRODUCTS)[number]>(
	KIBBLE_MERCHANDISING_PRODUCTS.map((product) => [product.entityId, product]),
);

function currentCatalogName(entityId: number): string {
	const product = currentCatalogById.get(entityId);
	if (!product) throw new Error(`Missing Kibble current catalog product ${entityId}.`);
	return product.name;
}

function assertCatalogPurchaseEvidence(entityId: number): void {
	if (!getKibbleCatalogPurchaseEvidence(entityId)) {
		throw new Error(`Missing catalog purchase evidence for Kibble product ${entityId}.`);
	}
}

for (const entityId of [3023, 3024, 3025, 3026, 3035, 3038]) {
	assertCatalogPurchaseEvidence(entityId);
}

export const KIBBLE_MERCHANT_SCALE_SCENARIOS: readonly KibbleMerchantScaleScenario[] = Object.freeze([
	{
		id: 'owner-led',
		sizeLabel: 'Small merchant',
		operatingModel: 'Owner-led specialist',
		maturity: 'assist',
		headline: 'Turn research into a decision without accidentally publishing it.',
		merchantJob: 'Review a multi-pet expansion while one owner still holds the merchandising decision.',
		shopperStory: 'A household with two dogs, two cats, a snake, and a bearded dragon needs one relevant routine without unsafe cross-species guesses.',
		result: 'The current 49 dog products stay shopper-eligible. All 33 cat, bird, and reptile rows stay in a merchant review queue until approved.',
		proofNow: [
			'Every current catalog product and every research row has one status.',
			'The four shared reptile products appear once in the catalog ledger while retaining both species uses.',
			'Bird and reptile rows retain their required profile fields and stop conditions.',
		],
		missingIntegration: [
			'Merchant approve, reject, edit, and publish controls.',
			'Authoritative images, inventory, dimensions, weight units, and publication state for the 33 candidates.',
		],
		inputs: [
			{ owner: 'merchant', label: 'Current assortment', value: '49 source-backed dog products', evidenceClass: 'source-backed-current' },
			{ owner: 'merchant', label: 'Expansion review', value: '33 research candidates; none approved', evidenceClass: 'source-backed-research' },
			{ owner: 'shopper', label: 'Household context', value: 'Two dogs, two cats, one snake, one bearded dragon; not stored', evidenceClass: 'shopper-provided-scenario' },
			{ owner: 'aisles', label: 'Allowed action', value: 'Group, compare, flag missing inputs, and explain the review status', evidenceClass: 'source-backed-current' },
		],
		decisions: [
			{ key: 'current-dog-catalog', label: 'Current dog catalog', scope: '49 exact rows', before: 'Current catalog evidence', after: 'Kept shopper-eligible in the demo', disposition: 'kept', reason: 'The expansion cannot demote or rewrite the current merchant catalog.', evidenceClass: 'source-backed-current' },
			{ key: 'cat-research', label: 'Cat expansion', scope: '11 exact rows', before: 'Research candidate', after: 'Withheld for merchant review', disposition: 'withheld', reason: 'Research provenance is not merchant approval.', evidenceClass: 'source-backed-research' },
			{ key: 'bird-research', label: 'Bird expansion', scope: '7 exact rows', before: 'Research candidate', after: 'Withheld; profile gates visible', disposition: 'withheld', reason: 'Bird species, life stage, sizing, and habitat inputs remain required.', evidenceClass: 'source-backed-research' },
			{ key: 'snake-only-research', label: 'Snake-only expansion', scope: '4 exact rows', before: 'Research candidate', after: 'Withheld; environment gates visible', disposition: 'withheld', reason: 'Heat, substrate, and enclosure choices cannot be inferred from persona alone.', evidenceClass: 'source-backed-research' },
			{ key: 'beardie-only-research', label: 'Bearded-dragon-only expansion', scope: '7 exact rows', before: 'Research candidate', after: 'Withheld; life-stage and habitat gates visible', disposition: 'withheld', reason: 'Food, UVB, heat, and fixture choices require the recorded profile inputs.', evidenceClass: 'source-backed-research' },
			{ key: 'shared-reptile-research', label: 'Shared reptile essentials', scope: '4 products / 8 species uses', before: 'Two species mappings', after: 'Four unique rows, still withheld', disposition: 'changed', reason: 'Aisles may reuse an applicable SKU without duplicating the product record.', evidenceClass: 'source-backed-research' },
		],
		evidenceNote: 'Observed catalog and research evidence. The household shape was supplied for this demo and is not a stored shopper profile.',
	},
	{
		id: 'regional-team',
		sizeLabel: 'Medium merchant',
		operatingModel: 'Regional merchandising team',
		maturity: 'orchestrate',
		headline: 'Use one current catalog differently by location without changing the facts.',
		merchantJob: 'Coordinate ecommerce and pickup shelves while category and location teams keep control of assortment and availability.',
		shopperStory: 'A shopper asks for an everyday dog food, prefers salmon, and wants pickup from the North location today.',
		result: 'The mock North-location shelf keeps three current-catalog foods, moves the salmon option first, and withholds one unavailable item. No new product or availability fact is invented.',
		proofNow: [
			'The before and after shelf use exact products from the current 49-product catalog.',
			'The reason for every move or exclusion names the merchant or shopper input that caused it.',
			'Changing location data can change the shelf without changing product identity.',
		],
		missingIntegration: [
			'Live location, channel, price, inventory, and fulfillment feeds.',
			'Merchant-authored regional assortment rules and approval workflow.',
		],
		inputs: [
			{ owner: 'merchant', label: 'Current category subset', value: 'Products 3023–3026 from current catalog evidence', evidenceClass: 'source-backed-current' },
			{ owner: 'merchant', label: 'North-location availability', value: '3024 unavailable; 3023, 3025, and 3026 available', evidenceClass: 'synthetic-operating-data' },
			{ owner: 'shopper', label: 'Pickup intent', value: 'North location, today, salmon preferred', evidenceClass: 'synthetic-operating-data' },
			{ owner: 'aisles', label: 'Allowed action', value: 'Filter by supplied availability, then rank the remaining current-catalog products', evidenceClass: 'synthetic-operating-data' },
		],
		decisions: [
			{ key: 'regional-3025', label: currentCatalogName(3025), scope: 'Product 3025', before: 'Position 3', after: 'Position 1', disposition: 'changed', reason: 'The shopper supplied a salmon preference and the mock location marks the product available.', evidenceClass: 'synthetic-operating-data' },
			{ key: 'regional-3023', label: currentCatalogName(3023), scope: 'Product 3023', before: 'Position 1', after: 'Position 2', disposition: 'changed', reason: 'It remains in the current catalog and mock-available set, but the shopper preference moves the salmon option ahead.', evidenceClass: 'synthetic-operating-data' },
			{ key: 'regional-3026', label: currentCatalogName(3026), scope: 'Product 3026', before: 'Position 4', after: 'Position 3', disposition: 'changed', reason: 'It remains inside the current catalog and mock-available set.', evidenceClass: 'synthetic-operating-data' },
			{ key: 'regional-3024', label: currentCatalogName(3024), scope: 'Product 3024', before: 'Position 2', after: 'Withheld from pickup shelf', disposition: 'withheld', reason: 'The mock merchant availability input marks it unavailable at this location.', evidenceClass: 'synthetic-operating-data' },
		],
		evidenceNote: 'Mock — synthetic operating data. Every location and preference value in this scenario is invented for demonstration and must not be quoted as merchant reality.',
	},
	{
		id: 'enterprise-network',
		sizeLabel: 'Enterprise merchant',
		operatingModel: 'Multi-channel policy network',
		maturity: 'govern',
		headline: 'Personalize across channels while proving which authority stopped each action.',
		merchantJob: 'Compose storefront and subscription experiences across teams without leaking portal-only capability into catalog purchase evidence.',
		shopperStory: 'A shopper wants recurring dog food, an annual wellness option, and a gift while browsing the web storefront.',
		result: 'Storefront-supported monthly and annual choices remain eligible. One-time gifting stays one-time. Prepaid, gift-plan, and build-a-box portal references stay outside catalog purchase evidence.',
		proofNow: [
			'Exact provider-plan references remain attached to exact product families.',
			'Storefront purchase evidence and portal service references render as different states.',
			'Product 3071 remains a provider seed host, never a build-a-box purchase candidate.',
		],
		missingIntegration: [
			'Live market, channel, brand, entitlement, consent, and policy services.',
			'Authenticated provider reads and an authorized transaction workflow.',
			'Enterprise audit storage, approval history, and rollback.',
		],
		inputs: [
			{ owner: 'merchant', label: 'Experience policy', value: 'Web storefront; recurring food, annual wellness, and one-time gift allowed', evidenceClass: 'synthetic-operating-data' },
			{ owner: 'shopper', label: 'Intent and consent', value: 'Compare eligible recurring and gift options; no transaction requested', evidenceClass: 'synthetic-operating-data' },
			{ owner: 'subscription-provider', label: 'Plan evidence', value: 'Pinned monthly and annual plan references for exact catalog products', evidenceClass: 'source-backed-current' },
			{ owner: 'aisles', label: 'Allowed action', value: 'Assemble and explain eligible choices; withhold authority mismatches', evidenceClass: 'source-backed-current' },
		],
		decisions: [
			{ key: 'enterprise-3023-monthly', label: `${currentCatalogName(3023)} · monthly`, scope: 'Product 3023', before: 'Provider plan reference', after: 'Kept as catalog purchase evidence', disposition: 'kept', reason: 'The provider seed supplies exact monthly plan IDs for this product family.', evidenceClass: 'source-backed-current' },
			{ key: 'enterprise-3038-annual', label: `${currentCatalogName(3038)} · annual`, scope: 'Product 3038', before: 'Annual provider plan', after: 'Kept as catalog purchase evidence', disposition: 'kept', reason: 'The annual scenario is attached to the exact yearly provider plan.', evidenceClass: 'source-backed-current' },
			{ key: 'enterprise-3070-gift', label: `${currentCatalogName(3070)} · one-time gift`, scope: 'Product 3070', before: 'Current one-time catalog product', after: 'Kept one-time; no gift subscription claim', disposition: 'kept', reason: 'The catalog has a Gift Bundle, but no catalog purchase evidence turns it into a gift subscription.', evidenceClass: 'source-backed-current' },
			{ key: 'enterprise-3066-prepaid', label: `${currentCatalogName(3066)} · prepaid`, scope: 'Product 3066 capability', before: 'Portal service reference', after: 'Withheld from storefront purchase evidence', disposition: 'withheld', reason: 'Prepaid is recorded as portal-only even though the product separately has storefront subscribe-and-save evidence.', evidenceClass: 'source-backed-current' },
			{ key: 'enterprise-3035-gift-plan', label: `${currentCatalogName(3035)} · gift plan`, scope: 'Product 3035 capability', before: 'Portal service reference', after: 'Withheld from storefront purchase evidence', disposition: 'withheld', reason: 'The gift plan is a portal reference and cannot alter the product detail page into a gift-subscription surface.', evidenceClass: 'source-backed-current' },
			{ key: 'enterprise-3071-box-host', label: `${currentCatalogName(3071)} · build-a-box`, scope: 'Product 3071 provider host', before: 'Provider seed host', after: 'Withheld as a purchase candidate', disposition: 'withheld', reason: 'The product hosts provider data only; the source explicitly does not make it the build-a-box purchase item.', evidenceClass: 'source-backed-current' },
		],
		evidenceNote: 'The plan and portal boundaries are source-backed. The enterprise market, channel, consent, and policy values are mock operating data and are labeled as such.',
	},
]);

export const KIBBLE_MERCHANT_SCALE_COVERAGE = Object.freeze({
	operatingModels: KIBBLE_MERCHANT_SCALE_SCENARIOS.length,
	currentCatalogRows: KIBBLE_CURRENT_CATALOG_LEDGER.length,
	researchCandidateRows: KIBBLE_RESEARCH_CANDIDATE_LEDGER.length,
	uniqueCatalogRowsIfApproved: KIBBLE_CURRENT_CATALOG_LEDGER.length + KIBBLE_RESEARCH_CANDIDATE_LEDGER.length,
	catCandidates: kibbleMultipetCatalogCoverage.cat,
	birdCandidates: kibbleMultipetCatalogCoverage.bird,
	snakeApplicableCandidates: kibbleMultipetCatalogCoverage.snake,
	beardedDragonApplicableCandidates: kibbleMultipetCatalogCoverage.beardedDragon,
	sharedReptileRows: kibbleMultipetCatalogCoverage.sharedSnakeAndBeardedDragon,
});

export function getKibbleMerchantScaleScenario(id: KibbleMerchantOperatingModelId): KibbleMerchantScaleScenario {
	const scenario = KIBBLE_MERCHANT_SCALE_SCENARIOS.find((candidate) => candidate.id === id);
	if (!scenario) throw new Error(`Unknown Kibble merchant operating model: ${id}.`);
	return scenario;
}
