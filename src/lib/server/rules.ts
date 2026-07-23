/**
 * Merchandising rules — read from the shared Neon Postgres database.
 *
 * Rules are created by the Aisles Admin app (BC marketplace app)
 * and read here at layout generation time. They override the AI's
 * default persona-driven behavior.
 *
 * Rule types:
 * - pin: force a product into a specific layout position
 * - exclude: hide a product from a persona's layouts
 * - boost: increase a category's priority
 * - seasonal: time-bound override that auto-activates/expires
 */

import { getDb } from './db';

export interface MerchandisingRule {
	id: number;
	ruleType: 'pin' | 'exclude' | 'boost' | 'seasonal';
	persona: string | null;
	categorySlug: string | null;
	productId: string | null;
	config: Record<string, unknown>;
}

/**
 * Get active merchandising rules for the current persona + category.
 * Returns rules that match the given persona (or apply to all personas)
 * and the given category (or apply to all categories), and are within
 * their active date window.
 */
export async function getActiveRules(
	persona: string,
	categorySlug: string,
): Promise<MerchandisingRule[]> {
	try {
		const sql = getDb();

		const rows = await sql`
			SELECT id, rule_type, persona, category_slug, product_id, config
			FROM merchandising_rules
			WHERE active = true
				AND (persona IS NULL OR persona = ${persona})
				AND (category_slug IS NULL OR category_slug = ${categorySlug})
				AND (expires_at IS NULL OR expires_at > NOW())
				AND (starts_at IS NULL OR starts_at <= NOW())
			ORDER BY rule_type, created_at DESC
		`;

		return rows.map((r) => ({
			id: r.id as number,
			ruleType: r.rule_type as MerchandisingRule['ruleType'],
			persona: r.persona as string | null,
			categorySlug: r.category_slug as string | null,
			productId: r.product_id as string | null,
			config: (r.config as Record<string, unknown>) || {},
		}));
	} catch {
		// Table might not exist yet (admin app not installed). Non-fatal.
		return [];
	}
}

/**
 * Format active rules as prompt context for the AI layout generator.
 * Returns empty string if no rules apply.
 */
export function rulesToPromptContext(rules: MerchandisingRule[]): string {
	if (rules.length === 0) return '';

	const lines = rules.map((r) => {
		switch (r.ruleType) {
			case 'pin': {
				const position = (r.config as any).position || 'hero';
				return `- PIN: Product "${r.productId}" must appear as ${position} (set by store admin)`;
			}
			case 'exclude':
				return `- EXCLUDE: Do not include product "${r.productId}" in this layout (set by store admin)`;
			case 'boost':
				return `- BOOST: Prioritize products from category "${r.categorySlug}" (set by store admin)`;
			case 'seasonal': {
				const instruction = (r.config as any).instruction || 'Apply seasonal override';
				return `- SEASONAL: ${instruction} (set by store admin)`;
			}
			default:
				return null;
		}
	}).filter(Boolean);

	if (lines.length === 0) return '';

	return `\nMERCHANDISING RULES (from the store admin — these override your defaults):\n${lines.join('\n')}\nYou MUST respect these rules. They take priority over persona defaults.\n`;
}
