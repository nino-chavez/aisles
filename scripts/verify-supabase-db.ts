/**
 * Smoke-test a linked Supabase database after `supabase db push`.
 *
 * Requires DATABASE_URL. It only creates and deletes rows with this run's
 * generated IDs. It does not exercise the public Data API.
 */

import 'dotenv/config';
import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const runId = `aisles-db-smoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const brands = [`${runId}-a`, `${runId}-b`];
const entityId = 987654321;
const sessionId = `${runId}-session`;
const sql = postgres(databaseUrl, { max: 5, idle_timeout: 60 });

async function main() {
	try {
		for (const brandId of brands) {
			await sql`
				INSERT INTO enriched_products (brand_id, bc_entity_id, bc_product_path, enrichment_model)
				VALUES (${brandId}, ${entityId}, ${`/${runId}`}, 'db-smoke')
			`;
			await sql`
				INSERT INTO generation_logs (brand_id, type, persona, category_slug, generation_ms, session_id)
				VALUES (${brandId}, 'layout', 'hunter', 'db-smoke', 1, ${sessionId})
			`;
			await sql`
				INSERT INTO session_outcomes (
					brand_id, session_id, primary_final, probabilities_final,
					entropy_final, certainty_final, prior_at_start
				) VALUES (
					${brandId}, ${sessionId}, 'hunter',
					${JSON.stringify({ gatherer: 0.1, hunter: 0.7, researcher: 0.1, gifter: 0.1 })}::jsonb,
					0.8, 0.6,
					${JSON.stringify({ gatherer: 0.25, hunter: 0.25, researcher: 0.25, gifter: 0.25 })}::jsonb
				)
			`;
		}

		const products = await sql`
			SELECT brand_id FROM enriched_products
			WHERE brand_id = ANY(${brands}) AND bc_entity_id = ${entityId}
			ORDER BY brand_id
		`;
		const logs = await sql`SELECT COUNT(*)::int AS count FROM generation_logs WHERE brand_id = ANY(${brands}) AND session_id = ${sessionId}`;
		const outcomes = await sql`SELECT COUNT(*)::int AS count FROM session_outcomes WHERE brand_id = ANY(${brands}) AND session_id = ${sessionId}`;

		if (products.length !== 2 || logs[0]?.count !== 2 || outcomes[0]?.count !== 2) {
			throw new Error(`Isolation smoke failed: products=${products.length} logs=${logs[0]?.count} outcomes=${outcomes[0]?.count}`);
		}

		console.log(`Supabase database smoke passed for ${brands.join(', ')}`);
	} finally {
		await sql`DELETE FROM generation_logs WHERE brand_id = ANY(${brands}) AND session_id = ${sessionId}`;
		await sql`DELETE FROM session_outcomes WHERE brand_id = ANY(${brands}) AND session_id = ${sessionId}`;
		await sql`DELETE FROM enriched_products WHERE brand_id = ANY(${brands}) AND bc_entity_id = ${entityId}`;
		await sql.end();
	}
}

main().catch((error) => {
	console.error('verify-supabase-db failed:', error);
	process.exitCode = 1;
});
