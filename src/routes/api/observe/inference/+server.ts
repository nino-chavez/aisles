import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { outcomesSummary } from '$lib/server/outcomes';
import learnedWeights from '$lib/signals/learned-weights.json';
import { getBrand } from '$lib/brand/config';

const OBSERVE_KEY = 'aisles-observe';

/**
 * GET /api/observe/inference?key=aisles-observe
 *
 * Inference health dashboard data. Returns aggregate stats over
 * session_outcomes: labeled volume, rule hit counts, mean posterior entropy,
 * conversion rate by predicted primary, shift detection rate, and whether
 * learned weights are currently active.
 *
 * Operational endpoint: an unavailable database returns a visible 500 instead
 * of a healthy-looking empty dashboard.
 */
export const GET: RequestHandler = async ({ url }) => {
	if (url.searchParams.get('key') !== OBSERVE_KEY) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const learnedActive =
		(learnedWeights as { totalSessions?: number }).totalSessions !== undefined &&
		(learnedWeights as { totalSessions: number }).totalSessions > 0;

	try {
		const summary = await outcomesSummary();
		const sql = getDb();
		const brandId = getBrand().id;

		// Rule hit counts from rule_matches array
		const ruleHitRows = await sql`
			SELECT UNNEST(rule_matches) AS rule_name, COUNT(*)::int AS n
			FROM session_outcomes
			WHERE brand_id = ${brandId} AND synthetic = FALSE
			GROUP BY rule_name
			ORDER BY n DESC
			LIMIT 30
		`;

		// Mean posterior entropy and certainty
		const statsRows = await sql`
			SELECT
				AVG(entropy_final)::real AS mean_entropy,
				AVG(certainty_final)::real AS mean_certainty,
				AVG(CASE WHEN converted THEN 1.0 ELSE 0.0 END)::real AS conversion_rate,
				COUNT(*)::int AS total
			FROM session_outcomes
			WHERE brand_id = ${brandId} AND synthetic = FALSE
		`;

		// Conversion rate by predicted primary
		const conversionRows = await sql`
			SELECT
				primary_final,
				COUNT(*)::int AS n,
				SUM(CASE WHEN converted THEN 1 ELSE 0 END)::int AS conv
			FROM session_outcomes
			WHERE brand_id = ${brandId} AND synthetic = FALSE
			GROUP BY primary_final
		`;

		const conversionByPrimary: Record<string, { n: number; converted: number; rate: number }> = {};
		for (const row of conversionRows) {
			const n = Number(row.n);
			const conv = Number(row.conv);
			conversionByPrimary[row.primary_final as string] = {
				n,
				converted: conv,
				rate: n > 0 ? conv / n : 0,
			};
		}

		return json({
			learnedWeights: {
				active: learnedActive,
				fittedAt: (learnedWeights as { fittedAt: string | null }).fittedAt,
				ruleCount: Object.keys((learnedWeights as { rules: Record<string, unknown> }).rules).length,
			},
			outcomes: summary,
			stats: statsRows[0] ?? null,
			topRules: ruleHitRows.map((r) => ({ name: r.rule_name, hits: Number(r.n) })),
			conversionByPrimary,
		});
	} catch (err) {
		return json(
			{
				error: 'Failed to read outcomes',
				detail: err instanceof Error ? err.message : String(err),
				learnedWeights: { active: learnedActive, fittedAt: null, ruleCount: 0 },
			},
			{ status: 500 },
		);
	}
};
