/**
 * Database availability is intentionally not uniform across the app.
 *
 * Storefront enrichment, search, and merchandising rules can fall back to
 * BigCommerce/default behavior. Operational telemetry cannot: returning a
 * success response when its database is absent hides a broken feedback loop.
 */
export type DatabaseRequirement = 'required' | 'optional';

export function requireDatabaseUrl(
	url: string | undefined,
	requirement: DatabaseRequirement = 'required',
): string | null {
	if (url) return url;
	if (requirement === 'optional') return null;
	throw new Error('DATABASE_URL not configured');
}
