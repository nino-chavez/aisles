import { createHash } from 'node:crypto';
import {
	getTrustedKibbleObserveHomeZonePolicy,
	getTrustedKibbleObservePdpRelatedZonePolicy,
	getTrustedKibbleZonePolicy,
} from '$lib/brand/composition-policy';
import { getBrand } from '$lib/brand/config';
import {
	SHOPPER_ROUTE_MANIFEST_DIGEST,
	SHOPPER_ROUTE_MANIFEST_VERSION,
	normalizeTrustedShopperRoute,
	tryNormalizeTrustedErrorRoute,
} from '$lib/foundation/autonomy-zone-route';
import { findTrustedZoneIdentity, TRUSTED_ZONE_IDENTITIES } from '$lib/foundation/trusted-zone-identity';
import type { TrustedZoneFieldCatalog } from '$lib/foundation/zone-decision-schema';
import {
	executeZoneDecision,
	type TrustedBoundZoneCatalog,
	type TrustedZoneExecutionIdentity,
	type ZoneModelRunner,
	type ZoneDecisionExecution,
} from '$lib/server/zone-decision-executor';
import { KIBBLE_REFERENCE_CONTRACT } from './kibble';
import { KIBBLE_PRESERVE_MANIFEST } from './kibble-manifest';
import { KIBBLE_ZONE_TERMINALS, type KibbleZoneTerminal } from './kibble-zone-union';

const ORGANIZATION_ID = 'kibble-demo-merchant';
const CATALOG_ID = 'kibble-preserve-catalog';
const CATALOG_VERSION = KIBBLE_REFERENCE_CONTRACT.source.fixtureSha256;
const FALLBACK_PRODUCT_ID = String(KIBBLE_PRESERVE_MANIFEST.display.featuredBundle.entityId);

const ROUTE_BY_SURFACE: Readonly<Record<KibbleZoneTerminal['surface'], string>> = {
	home: '/',
	plp: '/category/dog-food',
	pdp: '/product/reference-product',
	cart: '/cart',
	checkout: '/checkout',
	search: '/search',
	account: '/account',
	locator: '/store-locator',
	'error-404': '/missing-kibble-route',
	'error-empty': '/search',
};

export type KibbleZoneTerminalExecution = {
	terminal: KibbleZoneTerminal;
	execution: ZoneDecisionExecution;
	adapter: null | {
		adapterId: string;
		componentVariantId: string;
		inputSha256: string;
		content: unknown;
	};
};

export function kibbleNativeAdapterBinding(result: KibbleZoneTerminalExecution) {
	if (!result.adapter) throw new Error(`Kibble terminal ${result.terminal.instanceId} has no native adapter binding.`);
	if (result.execution.status !== 'live' && result.execution.status !== 'approval_candidate') {
		throw new Error(`Kibble terminal ${result.terminal.instanceId} is not authorized for native content.`);
	}
	const sharedRender = result.execution.status === 'approval_candidate'
		? result.execution.candidate.render
		: result.execution.render;
	if (sharedRender.kind !== 'content') {
		throw new Error(`Kibble terminal ${result.terminal.instanceId} has no shared content result.`);
	}
	return {
		instanceId: result.terminal.instanceId,
		sharedStatus: result.execution.status,
		sharedContentKind: sharedRender.kind,
		decisionMode: result.execution.status === 'approval_candidate'
			? result.execution.candidate.decisionMode
			: result.execution.decisionMode,
		modelCallCount: 0,
		...result.adapter,
	};
}

function terminalById(instanceId: string): KibbleZoneTerminal {
	const terminal = KIBBLE_ZONE_TERMINALS.find((candidate) => candidate.instanceId === instanceId);
	if (!terminal) throw new Error(`Unknown Kibble terminal ${instanceId}.`);
	return terminal;
}

export async function executeKibbleHomeZoneAdapters(input: {
	hero: { eyebrow: string; headline: string; body: string };
	products: Array<{ entityId: number }>;
	featuredCopy: { title: string };
	categoryEyebrow: string;
	categoryTitle: string;
	serviceProof: Array<{ title: string; body: string }>;
}) {
	const [hero, featuredRows] = await Promise.all([
		executeKibbleZoneTerminal(terminalById('home.hero'), '/', {
			component: 'editorial-header',
			props: {
				eyebrow: input.hero.eyebrow,
				headline: input.hero.headline,
				body: input.hero.body,
			},
		}),
		executeKibbleHomeFeaturedZoneAdapters(input.products),
	]);
	const [editorial, belowFold] = await Promise.all([
		executeKibbleZoneTerminal(terminalById('home.editorial-strip'), '/', {
			component: 'editorial-header',
			props: { eyebrow: input.categoryEyebrow, headline: input.categoryTitle, body: 'Browse the current storefront catalog by category.' },
		}),
		executeKibbleZoneTerminal(terminalById('home.below-fold'), '/', {
			component: 'service-callouts-grid',
			props: {
				columns: 3,
				callouts: input.serviceProof.map((item, index) => ({ icon: ['quality', 'store', 'support'][index] ?? 'support', label: item.title, body: item.body })),
			},
		}),
	]);
	return {
		hero: kibbleNativeAdapterBinding(hero),
		featuredRows,
		editorial: kibbleNativeAdapterBinding(editorial),
		belowFold: kibbleNativeAdapterBinding(belowFold),
	};
}

/** Bind the deterministic Home shelf order to the exact three rendered zones. */
export async function executeKibbleHomeFeaturedZoneAdapters(
	products: Array<{ entityId: number }>,
) {
	if (products.length < 3) throw new Error('Kibble Home needs at least three products to bind its three ranked shelf instances.');
	const segmentSize = Math.ceil(products.length / 3);
	const segments = [
		products.slice(0, segmentSize),
		products.slice(segmentSize, segmentSize * 2),
		products.slice(segmentSize * 2),
	];
	if (segments.some((segment) => segment.length === 0)) throw new Error('Kibble Home ranked shelf instances must all consume a non-empty product segment.');
	return Promise.all(segments.map(async (segment, index) => kibbleNativeAdapterBinding(
		await executeKibbleZoneTerminal(terminalById(`home.featured-row.${index + 1}`), '/', productGridContent(
			segment.map(({ entityId }) => String(entityId)),
		)),
	)));
}

/**
 * One explicit live-model boundary for the prospect demo. The model receives
 * only the strict rank_products schema and the eight server-approved product
 * IDs. The fixed Kibble component and every product field remain server-owned.
 */
export async function executeKibbleHomeModelShelf(input: {
	products: Array<{ entityId: number }>;
	runModel: ZoneModelRunner;
}) {
	if (input.products.length < 1 || input.products.length > 8) {
		throw new Error('Kibble Home model ranking requires one to eight approved shelf products.');
	}
	const terminal = terminalById('home.featured-row.1');
	if (!terminal.adapterId || !terminal.componentVariantId) {
		throw new Error('Kibble Home model terminal lacks a native adapter binding.');
	}
	const policy = getTrustedKibbleObserveHomeZonePolicy({
		origin: terminal.origin,
		familyId: 'home.featured-row',
		instanceId: terminal.instanceId,
		routePath: '/',
	});
	const allowedDecisionModes = policy.provenance.zoneBinding?.allowedDecisionModes;
	if (!allowedDecisionModes) throw new Error('Kibble observe Home policy lacks an attested zone binding.');
	const identity = executionIdentity(terminal, policy.policyVersion, '/', allowedDecisionModes);
	const productIds = input.products.map(({ entityId }) => String(entityId));
	if (new Set(productIds).size !== productIds.length) {
		throw new Error('Kibble Home model ranking received duplicate product identities.');
	}
	const fields = fieldsFor(terminal, policy.allowedComponentVariantIds, productIds);
	const baseline = productGridContent(productIds);
	const catalog: TrustedBoundZoneCatalog = {
		identity,
		fields,
		products: {
			organizationId: ORGANIZATION_ID,
			brandId: 'kibble',
			referenceId: KIBBLE_REFERENCE_CONTRACT.id,
			referenceVersion: KIBBLE_REFERENCE_CONTRACT.version,
			catalogId: CATALOG_ID,
			catalogVersion: CATALOG_VERSION,
			productIds,
		},
		materialize: ({ decision }) => {
			const raw = decision?.envelope.rawModelContent;
			const ranked = raw && typeof raw === 'object'
				? (raw as Record<string, unknown>).rankedProductIds
				: null;
			return productGridContent(Array.isArray(ranked) ? ranked.filter(isString) : productIds);
		},
	};
	const execution = await executeZoneDecision({
		policy,
		catalog,
		fallback: { identity, kind: 'content', content: baseline },
		runModel: input.runModel,
	});
	if (execution.status !== 'live' || execution.decisionMode !== 'model' || execution.render.kind !== 'content') {
		throw new Error(`Kibble Home model ranking did not publish: ${execution.status === 'fallback' ? execution.reason : execution.status}.`);
	}
	const adapter = kibbleNativeAdapterBinding({ terminal, execution, adapter: {
		adapterId: terminal.adapterId,
		componentVariantId: terminal.componentVariantId,
		inputSha256: hashAdapterInput(terminal, execution.render.content),
		content: execution.render.content,
	} });
	const raw = execution.decision?.envelope.rawModelContent;
	const rankedValue = raw && typeof raw === 'object'
		? (raw as Record<string, unknown>).rankedProductIds
		: null;
	const rankedProductIds: string[] = Array.isArray(rankedValue) ? rankedValue.filter(isString) : [];
	return { policy, execution, adapter, rankedProductIds };
}

export async function executeKibblePlpZoneAdapter(input: { routePath: string; eyebrow: string; title: string; productCount: number }): Promise<ReturnType<typeof kibbleNativeAdapterBinding>> {
	return kibbleNativeAdapterBinding(await executeKibbleZoneTerminal(terminalById('plp.editorial-header'), input.routePath, {
		component: 'editorial-header',
		props: { eyebrow: input.eyebrow, headline: input.title, body: `${input.productCount} ${input.productCount === 1 ? 'product' : 'products'}` },
	}));
}

export async function executeKibblePdpRelatedZoneAdapter(
	relatedProducts: Array<{ entityId: number }>,
	heading: string,
	routePath: string,
): Promise<ReturnType<typeof kibbleNativeAdapterBinding> | null> {
	if (relatedProducts.length < 3) {
		await executeKibbleZoneTerminal(terminalById('pdp.related'), routePath, null, { inapplicable: true });
		return null;
	}
	return kibbleNativeAdapterBinding(await executeKibbleZoneTerminal(terminalById('pdp.related'), routePath, {
		component: 'product-carousel',
		props: { title: heading, products: relatedProducts.map(({ entityId }) => ({ productId: String(entityId), role: 'standard' })), showQuickAdd: false },
	}));
}

/**
 * Exact-route PDP model boundary. It can only return one permutation of the
 * server-reloaded related products; all PDP structure and product facts stay fixed.
 */
export async function executeKibblePdpRelatedModelShelf(input: {
	relatedProducts: Array<{ entityId: number }>;
	heading: string;
	routePath: '/product/puppy-starter-kit';
	runModel: ZoneModelRunner;
}) {
	if (input.relatedProducts.length < 3 || input.relatedProducts.length > 4) {
		throw new Error('Kibble PDP model ranking requires three to four approved related products.');
	}
	const terminal = terminalById('pdp.related');
	if (!terminal.adapterId || !terminal.componentVariantId) {
		throw new Error('Kibble PDP model terminal lacks a native adapter binding.');
	}
	const policy = getTrustedKibbleObservePdpRelatedZonePolicy({
		origin: terminal.origin,
		familyId: 'pdp.related',
		instanceId: 'pdp.related',
		routePath: input.routePath,
	});
	const allowedDecisionModes = policy.provenance.zoneBinding?.allowedDecisionModes;
	if (!allowedDecisionModes) throw new Error('Kibble observe PDP policy lacks an attested zone binding.');
	const productIds = input.relatedProducts.map(({ entityId }) => String(entityId));
	if (new Set(productIds).size !== productIds.length) throw new Error('Kibble PDP model ranking received duplicate product identities.');
	const identity = executionIdentity(terminal, policy.policyVersion, input.routePath, allowedDecisionModes);
	const baseline = pdpRelatedContent(input.heading, productIds);
	const catalog: TrustedBoundZoneCatalog = {
		identity,
		fields: fieldsFor(terminal, policy.allowedComponentVariantIds, productIds),
		products: {
			organizationId: ORGANIZATION_ID, brandId: 'kibble',
			referenceId: KIBBLE_REFERENCE_CONTRACT.id, referenceVersion: KIBBLE_REFERENCE_CONTRACT.version,
			catalogId: CATALOG_ID, catalogVersion: CATALOG_VERSION, productIds,
		},
		materialize: ({ decision }) => {
			const raw = decision?.envelope.rawModelContent;
			const ranked = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).rankedProductIds : null;
			return pdpRelatedContent(input.heading, Array.isArray(ranked) ? ranked.filter(isString) : productIds);
		},
	};
	const execution = await executeZoneDecision({
		policy, catalog, fallback: { identity, kind: 'content', content: baseline }, runModel: input.runModel,
	});
	if (execution.status !== 'live' || execution.decisionMode !== 'model' || execution.render.kind !== 'content') {
		throw new Error(`Kibble PDP model ranking did not publish: ${execution.status === 'fallback' ? execution.reason : execution.status}.`);
	}
	const adapter = kibbleNativeAdapterBinding({ terminal, execution, adapter: {
		adapterId: terminal.adapterId,
		componentVariantId: terminal.componentVariantId,
		inputSha256: hashAdapterInput(terminal, execution.render.content),
		content: execution.render.content,
	} });
	const raw = execution.decision?.envelope.rawModelContent;
	const rankedValue = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).rankedProductIds : null;
	const rankedProductIds = Array.isArray(rankedValue) ? rankedValue.filter(isString) : [];
	return { policy, execution, adapter, rankedProductIds };
}

export async function executeKibbleSearchEmptyZoneAdapter(input: { query: string; body: string }) {
	return kibbleNativeAdapterBinding(await executeKibbleZoneTerminal(terminalById('search.empty-state'), '/search', {
		component: 'editorial-header',
		props: {
			eyebrow: input.query ? 'No matches' : 'Catalog search',
			headline: input.query ? `No products match “${input.query}”` : 'Search the catalog',
			body: input.body,
		},
	}));
}

export async function executeKibbleSearchEmptyZoneTerminal(input: { query: string; body: string } | null) {
	return input
		? executeKibbleZoneTerminal(terminalById('search.empty-state'), '/search', {
			component: 'editorial-header',
			props: {
				eyebrow: input.query ? 'No matches' : 'Catalog search',
				headline: input.query ? `No products match “${input.query}”` : 'Search the catalog',
				body: input.body,
			},
		})
		: executeKibbleZoneTerminal(terminalById('search.empty-state'), '/search', null, { inapplicable: true });
}

export async function executeKibbleErrorZoneAdapter(input: { surface: 'error-404' | 'error-empty'; routePath: string; status: number; message: string }) {
	return kibbleNativeAdapterBinding(await executeKibbleZoneTerminal(terminalById(`${input.surface}.rescue`), input.routePath, {
		component: 'editorial-header',
		props: {
			eyebrow: `${KIBBLE_PRESERVE_MANIFEST.display.error.eyebrow} · ${input.status}`,
			headline: input.surface === 'error-404'
				? KIBBLE_PRESERVE_MANIFEST.display.error.notFoundHeadline
				: KIBBLE_PRESERVE_MANIFEST.display.error.headline,
			body: input.message,
		},
	}));
}

function defaultVariant(terminal: KibbleZoneTerminal, policyVariants: readonly string[]): string {
	return terminal.componentVariantId ?? policyVariants[0] ?? 'kibble.error.reference-shell';
}

function fieldsFor(terminal: KibbleZoneTerminal, policyVariants: readonly string[], productIds: readonly string[]): TrustedZoneFieldCatalog {
	const componentVariantId = defaultVariant(terminal, policyVariants);
	return {
		registeredComponentVariantIds: [componentVariantId],
		registeredCssVariantIds: [],
		registeredCopyVariantIds: [],
		registeredRecipeIds: [],
		registeredProductIds: productIds,
		registeredPlacementIds: [],
		completeComponentVariants: [{ componentVariantId, compatibleCopyVariantIds: [] }],
		allowedRecipeIds: [],
		allowedProductIds: productIds,
		allowedPlacementIds: [],
		boundedCopyFields: [],
		fixed: { componentVariantId, productIds },
	};
}

function executionIdentity(
	terminal: KibbleZoneTerminal,
	policyVersion: string,
	routePath: string,
	allowedDecisionModes: TrustedZoneExecutionIdentity['allowedDecisionModes'],
): TrustedZoneExecutionIdentity {
	const routeSource = terminal.surface === 'error-404' || terminal.surface === 'error-empty' ? 'error-state' : 'pathname';
	return {
		organizationId: ORGANIZATION_ID,
		brandId: 'kibble',
		referenceId: KIBBLE_REFERENCE_CONTRACT.id,
		referenceVersion: KIBBLE_REFERENCE_CONTRACT.version,
		policyVersion,
		routeSource,
		routePath,
		surface: terminal.surface,
		routeManifestVersion: SHOPPER_ROUTE_MANIFEST_VERSION,
		routeManifestDigest: SHOPPER_ROUTE_MANIFEST_DIGEST,
		zoneOrigin: terminal.origin,
		familyId: terminal.familyId,
		instanceId: terminal.instanceId,
		productCatalogId: CATALOG_ID,
		productCatalogVersion: CATALOG_VERSION,
		allowedDecisionModes,
	};
}

/**
 * Executes the shared compiler/executor terminal for one exact union identity.
 * Visible terminals require shared content that is consumed by one exact
 * Kibble-native adapter. Hidden terminals return no adapter and render no DOM.
 */
export async function executeKibbleZoneTerminal(
	terminal: KibbleZoneTerminal,
	routePath = ROUTE_BY_SURFACE[terminal.surface],
	content: unknown = null,
	options: { inapplicable?: boolean } = {},
): Promise<KibbleZoneTerminalExecution> {
	const routeSource = terminal.surface === 'error-404' || terminal.surface === 'error-empty' ? 'error-state' : 'pathname';
	const normalized = routeSource === 'pathname'
		? normalizeTrustedShopperRoute(routePath)
		: tryNormalizeTrustedErrorRoute(routePath, terminal.surface);
	if (!normalized || normalized.surface !== terminal.surface) {
		throw new Error(`Kibble zone ${terminal.instanceId} does not belong to ${routePath}.`);
	}
	const policy = getTrustedKibbleZonePolicy({
		brandId: getBrand().id,
		origin: terminal.origin,
		familyId: terminal.familyId,
		instanceId: terminal.instanceId,
		routeSource,
		routePath,
	});
	if (!policy) throw new Error(`Kibble policy is unavailable for ${terminal.instanceId}.`);
	const allowedDecisionModes = policy.provenance.zoneBinding?.allowedDecisionModes;
	if (!allowedDecisionModes) throw new Error(`Kibble zone policy lacks an attested binding for ${terminal.instanceId}.`);
	const identity = executionIdentity(terminal, policy.policyVersion, routePath, allowedDecisionModes);
	if (terminal.terminal === 'kibble-native' && content === null && !options.inapplicable) {
		throw new Error(`Kibble-native terminal ${terminal.instanceId} requires semantic adapter content.`);
	}
	if (options.inapplicable && content !== null) throw new Error(`Inapplicable terminal ${terminal.instanceId} cannot accept renderer content.`);
	if (terminal.terminal === 'trusted-hidden' && content !== null) {
		throw new Error(`Trusted Hidden terminal ${terminal.instanceId} cannot accept renderer content.`);
	}
	const semanticProductIds = collectProductIds(content);
	const productIds = semanticProductIds.length > 0 ? semanticProductIds : [FALLBACK_PRODUCT_ID];
	const fields = fieldsFor(terminal, policy.allowedComponentVariantIds, productIds);
	const catalog: TrustedBoundZoneCatalog = {
		identity,
		fields,
		products: {
			organizationId: ORGANIZATION_ID,
			brandId: 'kibble',
			referenceId: KIBBLE_REFERENCE_CONTRACT.id,
			referenceVersion: KIBBLE_REFERENCE_CONTRACT.version,
			catalogId: CATALOG_ID,
			catalogVersion: CATALOG_VERSION,
			productIds,
		},
		materialize: () => content,
	};
	const execution = await executeZoneDecision({
		policy,
		catalog,
		fallback: { identity, kind: 'hidden' },
		...(policy.decisionMode === 'rules' ? {
			runRules: () => ({ productIds, rankedProductIds: productIds }),
		} : {}),
	});
	if (terminal.terminal === 'trusted-hidden' || options.inapplicable) {
		if (execution.render.kind !== 'hidden') throw new Error(`Trusted Hidden terminal ${terminal.instanceId} produced DOM content.`);
		return { terminal, execution, adapter: null };
	}
	const adapterContent = execution.status === 'approval_candidate'
		? execution.candidate.render.kind === 'content' ? execution.candidate.render.content : null
		: execution.render.kind === 'content' ? execution.render.content : null;
	if (adapterContent === null || !terminal.adapterId || !terminal.componentVariantId) {
		throw new Error(`Kibble-native terminal ${terminal.instanceId} did not produce adapter content.`);
	}
	return {
		terminal,
		execution,
		adapter: {
			adapterId: terminal.adapterId,
			componentVariantId: terminal.componentVariantId,
			inputSha256: hashAdapterInput(terminal, adapterContent),
			content: adapterContent,
		},
	};
}

export async function executeKibbleHiddenZoneTerminalsForRoute(routePath: string): Promise<KibbleZoneTerminalExecution[]> {
	const route = normalizeTrustedShopperRoute(routePath);
	return Promise.all(
		KIBBLE_ZONE_TERMINALS
			.filter((terminal) => terminal.surface === route.surface && terminal.terminal === 'trusted-hidden')
			.map((terminal) => executeKibbleZoneTerminal(terminal, route.routePath)),
	);
}

function collectProductIds(value: unknown): string[] {
	const result = new Set<string>();
	const visit = (candidate: unknown): void => {
		if (Array.isArray(candidate)) return void candidate.forEach(visit);
		if (!candidate || typeof candidate !== 'object') return;
		for (const [key, child] of Object.entries(candidate as Record<string, unknown>)) {
			if (key === 'productId' && typeof child === 'string') result.add(child);
			else visit(child);
		}
	};
	visit(value);
	return [...result];
}

function productGridContent(productIds: readonly string[]) {
	return {
		component: 'product-grid' as const,
		props: {
			columns: 4 as const,
			products: productIds.map((productId) => ({ productId, role: 'standard' as const })),
			imageRatio: 'square' as const,
			showDescription: false as const,
			showSpecs: false as const,
			showQuickAdd: false as const,
		},
	};
}

function pdpRelatedContent(title: string, productIds: readonly string[]) {
	return {
		component: 'product-carousel' as const,
		props: { title, products: productIds.map((productId) => ({ productId, role: 'standard' as const })), showQuickAdd: false as const },
	};
}

function isString(value: unknown): value is string {
	return typeof value === 'string';
}

function hashAdapterInput(terminal: KibbleZoneTerminal, content: unknown): string {
	return createHash('sha256').update(JSON.stringify(canonical({
		instanceId: terminal.instanceId,
		adapterId: terminal.adapterId,
		componentVariantId: terminal.componentVariantId,
		content,
	}))).digest('hex');
}

function canonical(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonical);
	if (value && typeof value === 'object') {
		return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, canonical(child)]));
	}
	return value;
}

/** Mechanical startup guard against a declaration drifting from the registry. */
export function assertKibbleZoneTerminalRegistry(): void {
	for (const terminal of KIBBLE_ZONE_TERMINALS) {
		if (!findTrustedZoneIdentity(terminal.origin, terminal.familyId, terminal.instanceId)) {
			throw new Error(`Kibble terminal is not backed by the frozen union registry: ${terminal.origin}:${terminal.instanceId}.`);
		}
	}
	if (KIBBLE_ZONE_TERMINALS.length !== 36 || new Set(KIBBLE_ZONE_TERMINALS.map(({ instanceId }) => instanceId)).size !== 36) {
		throw new Error('Kibble terminal matrix must contain the exact 36 expanded union instances.');
	}
	const selected = new Set(KIBBLE_ZONE_TERMINALS.map(({ origin, instanceId }) => `${origin}:${instanceId}`));
	if (selected.size !== 36 || [...selected].some((key) => !TRUSTED_ZONE_IDENTITIES.some(({ origin, instanceId }) => `${origin}:${instanceId}` === key))) {
		throw new Error('Kibble terminal matrix contains an unissued identity.');
	}
}

assertKibbleZoneTerminalRegistry();
