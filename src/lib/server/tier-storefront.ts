/**
 * Tier-demo storefront derivation.
 *
 * When a merchant tier is active (kibble_tier cookie, see ./merchant-tier),
 * the Kibble reference-preserve pipeline cannot render: its contract asserts
 * the curated channel-1 catalog composition, and the tier channels carry a
 * deliberately different taxonomy. This module derives nav, home, and
 * category pages from the ACTIVE CHANNEL's own categoryTree instead, so the
 * store visibly restructures per tier. Absent/unprovisioned tier returns
 * null everywhere and the default render path is untouched.
 *
 * Tier category URLs carry the BC category id as a `-c<id>` suffix
 * (`/category/dry-food-c451`) so slugs resolve without any name mapping.
 */
import { getActiveMerchantTier, isMerchantTierProvisioned, type MerchantTier } from './merchant-tier';
import {
	getCategories,
	getProductsByCategory,
	getSubtreeProductCounts,
	type BCCategoryTreeNode,
} from './bigcommerce';
import { transformProduct } from './catalog';
import type { Product } from '$lib/types';

export interface TierCategoryNode {
	entityId: number;
	name: string;
	href: string;
	productCount: number;
	children: TierCategoryNode[];
}

export interface TierStorefrontHome {
	tier: MerchantTier;
	tree: TierCategoryNode[];
	categoryCount: number;
	rails: Array<{ title: string; href: string; products: Product[] }>;
}

export interface TierCategoryPage {
	tier: MerchantTier;
	category: { entityId: number; name: string };
	breadcrumb: Array<{ label: string; href: string }>;
	children: TierCategoryNode[];
	products: Product[];
	hasMore: boolean;
	/** Exact subtree total, or null when the category is a leaf. */
	totalItems: number | null;
}

export function getActiveProvisionedTier(): MerchantTier | null {
	const tier = getActiveMerchantTier();
	return tier && isMerchantTierProvisioned(tier) ? tier : null;
}

const slugify = (name: string) =>
	name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function tierCategoryHref(name: string, entityId: number): string {
	return `/category/${slugify(name)}-c${entityId}`;
}

export function parseTierCategorySlug(slug: string): number | null {
	const match = /-c(\d+)$/.exec(slug);
	return match ? Number(match[1]) : null;
}

function toNode(raw: BCCategoryTreeNode): TierCategoryNode {
	return {
		entityId: raw.entityId,
		name: raw.name,
		href: tierCategoryHref(raw.name, raw.entityId),
		productCount: raw.productCount,
		children: (raw.children ?? []).map(toNode),
	};
}

export async function loadTierCatalogTree(): Promise<TierCategoryNode[]> {
	return (await getCategories()).map(toNode);
}

function countNodes(nodes: TierCategoryNode[]): number {
	return nodes.reduce((n, node) => n + 1 + countNodes(node.children), 0);
}

function findNode(nodes: TierCategoryNode[], entityId: number): TierCategoryNode | null {
	for (const node of nodes) {
		if (node.entityId === entityId) return node;
		const hit = findNode(node.children, entityId);
		if (hit) return hit;
	}
	return null;
}

/**
 * A node's own id plus every descendant id, which is what both the product
 * query and the count query filter on. See getProductsByCategory's
 * `descendantIds` note for why the subtree has to be enumerated explicitly.
 */
function subtreeIds(node: TierCategoryNode): number[] {
	return [node.entityId, ...node.children.flatMap(subtreeIds)];
}

function pathToNode(
	nodes: TierCategoryNode[],
	entityId: number,
	trail: Array<{ label: string; href: string }> = [],
): Array<{ label: string; href: string }> | null {
	for (const node of nodes) {
		const next = [...trail, { label: node.name, href: node.href }];
		if (node.entityId === entityId) return next;
		const hit = pathToNode(node.children, entityId, next);
		if (hit) return hit;
	}
	return null;
}

/** Home payload for an active tier, or null when no provisioned tier is selected. */
export async function loadTierStorefrontHome(): Promise<TierStorefrontHome | null> {
	const tier = getActiveProvisionedTier();
	if (!tier) return null;
	const tree = await loadTierCatalogTree();
	// Every top-level node, not just those the tree claims hold products: on the
	// larger tiers the roots carry no directly-assigned products at all, so the
	// old `productCount > 0` filter kept the wrong three and then dropped them
	// again for coming back empty.
	const railSources = tree.slice(0, 3);
	const rails = (
		await Promise.all(
			railSources.map(async (node) => {
				const result = await getProductsByCategory(node.entityId, {
					first: 8,
					descendantIds: subtreeIds(node),
				});
				return { title: node.name, href: node.href, products: result.products.map(transformProduct) };
			}),
		)
	).filter((rail) => rail.products.length > 0);
	return { tier, tree, categoryCount: countNodes(tree), rails };
}

/** Category payload for an active tier, or null when inactive / slug not tier-shaped / category missing. */
export async function loadTierCategoryPage(slug: string): Promise<TierCategoryPage | null> {
	const tier = getActiveProvisionedTier();
	if (!tier) return null;
	const entityId = parseTierCategorySlug(slug);
	if (entityId === null) return null;
	// Tree first: the products query needs the subtree's ids, and the child
	// chips need exact counts rather than the tree's own unreliable ones.
	const tree = await loadTierCatalogTree();
	const node = findNode(tree, entityId);
	let result;
	try {
		result = await getProductsByCategory(entityId, {
			first: 24,
			descendantIds: node ? subtreeIds(node) : undefined,
		});
	} catch {
		return null;
	}
	const children = node?.children ?? [];
	let counted = children;
	if (children.length) {
		const counts = await getSubtreeProductCounts(
			children.map((child) => ({ entityId: child.entityId, ids: subtreeIds(child) })),
		);
		counted = children.map((child) => ({
			...child,
			productCount: counts.get(child.entityId) ?? child.productCount,
		}));
	}
	return {
		tier,
		category: { entityId, name: result.category.name },
		breadcrumb: pathToNode(tree, entityId) ?? [],
		children: counted,
		products: result.products.map(transformProduct),
		hasMore: result.pageInfo.hasNextPage,
		totalItems: result.totalItems,
	};
}
