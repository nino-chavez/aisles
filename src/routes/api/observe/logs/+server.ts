import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';

const OBSERVE_KEY = 'aisles-observe';

/**
 * GET /api/observe/logs?limit=20&key=aisles-observe
 * Returns recent generation logs from Postgres.
 */
export const GET: RequestHandler = async ({ url }) => {
	if (url.searchParams.get('key') !== OBSERVE_KEY) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
	const sessionId = url.searchParams.get('session') || null;

	try {
		const sql = getDb();
		const rows = sessionId
			? await sql`
				SELECT
					type, persona, category_slug, cache_hit,
					generation_ms, product_count, input_tokens, output_tokens,
					eval_score, prompt_version, model, estimated_cost, session_id, created_at
				FROM generation_logs
				WHERE session_id = ${sessionId}
				ORDER BY created_at DESC
				LIMIT ${limit}
			`
			: await sql`
				SELECT
					type, persona, category_slug, cache_hit,
					generation_ms, product_count, input_tokens, output_tokens,
					eval_score, prompt_version, model, estimated_cost, session_id, created_at
				FROM generation_logs
				ORDER BY created_at DESC
				LIMIT ${limit}
			`;

		const logs = rows.map((row) => ({
			type: row.type,
			persona: row.persona,
			categorySlug: row.category_slug,
			cacheHit: row.cache_hit,
			generationMs: row.generation_ms,
			productCount: row.product_count,
			inputTokens: row.input_tokens,
			outputTokens: row.output_tokens,
			evalScore: row.eval_score,
			promptVersion: row.prompt_version,
			model: row.model,
			estimatedCost: row.estimated_cost,
			sessionId: row.session_id,
			createdAt: row.created_at,
		}));

		return json({ logs });
	} catch (err) {
		console.warn('[observe/logs] Failed to query generation_logs:', err);
		return json({ logs: [] });
	}
};
