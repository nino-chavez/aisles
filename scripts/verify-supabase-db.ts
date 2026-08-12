/**
 * Smoke-test a linked Supabase database after `supabase db push`.
 *
 * Requires DATABASE_URL for cleanup. Set RUNTIME_DATABASE_URL to exercise the
 * least-privilege application role. It only creates and deletes rows with this
 * run's generated IDs. It does not exercise the public Data API.
 */

import 'dotenv/config';
import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const runtimeDatabaseUrl = process.env.RUNTIME_DATABASE_URL || databaseUrl;

const runId = `aisles-db-smoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const brands = [`${runId}-a`, `${runId}-b`];
const entityId = 987654321;
const sessionId = `${runId}-session`;
const sql = postgres(runtimeDatabaseUrl, { max: 5, idle_timeout: 60 });
const adminSql = runtimeDatabaseUrl === databaseUrl
	? sql
	: postgres(databaseUrl, { max: 1, idle_timeout: 30 });

async function main() {
	try {
		const expectedProvenanceColumns = [
			'organization_id', 'provenance_version', 'reference_status', 'reference_id',
			'reference_version', 'policy_version', 'surface', 'route', 'viewport_class',
			'renderer_component_id', 'renderer_variant_id', 'decision_source', 'input_hash',
			'catalog_version', 'shopper_context_hash', 'picks_hash', 'incentive_hash',
			'autonomy_preset', 'effective_capabilities', 'decision_mode', 'publication_mode',
			'schema_version',
		];
		const provenanceColumns = await adminSql`
			SELECT column_name
			FROM information_schema.columns
			WHERE table_schema = 'public'
				AND table_name = 'generation_logs'
				AND column_name = ANY(${expectedProvenanceColumns})
		`;
		const actualColumns = new Set(provenanceColumns.map((row) => row.column_name as string));
		const missingColumns = expectedProvenanceColumns.filter((column) => !actualColumns.has(column));
		if (missingColumns.length > 0) {
			throw new Error(`Missing generation provenance columns: ${missingColumns.join(', ')}`);
		}

		const provenanceConstraints = await adminSql`
			SELECT conname
			FROM pg_constraint
			WHERE conrelid = 'public.generation_logs'::regclass
				AND conname LIKE 'generation_logs_%_check'
		`;
		const constraintNames = new Set(provenanceConstraints.map((row) => row.conname as string));
		for (const required of [
			'generation_logs_provenance_completeness_check',
			'generation_logs_reference_identity_check',
			'generation_logs_viewport_class_check',
			'generation_logs_effective_capabilities_check',
			'generation_logs_decision_mode_check',
			'generation_logs_publication_mode_check',
		]) {
			if (!constraintNames.has(required)) throw new Error(`Missing generation provenance constraint: ${required}`);
		}
		const [rls] = await adminSql`
			SELECT relrowsecurity
			FROM pg_class
			WHERE oid = 'public.generation_logs'::regclass
		`;
		if (!rls?.relrowsecurity) throw new Error('generation_logs RLS is not enabled');

		if (runtimeDatabaseUrl !== databaseUrl) {
			const [role] = await sql`
				SELECT current_user, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls
				FROM pg_roles
				WHERE rolname = current_user
			`;
			if (
				role?.current_user !== 'aisles_app'
				|| role?.rolsuper
				|| role?.rolcreatedb
				|| role?.rolcreaterole
				|| role?.rolbypassrls
			) {
				throw new Error(`Unexpected runtime role attributes: ${JSON.stringify(role)}`);
			}
			const [schemaPrivilege] = await adminSql`
				SELECT has_schema_privilege('aisles_app', 'public', 'CREATE') AS can_create
			`;
			if (schemaPrivilege?.can_create) {
				throw new Error('Runtime role unexpectedly has CREATE on schema public');
			}

			const publicGrants = await adminSql`
				SELECT grantee, table_name, privilege_type
				FROM information_schema.role_table_grants
				WHERE table_schema = 'public'
					AND grantee IN ('anon', 'authenticated')
					AND table_name = ANY(${[
						'enriched_products',
						'generation_logs',
						'session_outcomes',
						'merchandising_rules',
					]})
			`;
			if (publicGrants.length > 0) {
				throw new Error(`Unexpected public table grants: ${JSON.stringify(publicGrants)}`);
			}

			const policies = await adminSql`
				SELECT policyname, roles
				FROM pg_policies
				WHERE schemaname = 'public'
					AND tablename = ANY(${[
						'enriched_products',
						'generation_logs',
						'session_outcomes',
						'merchandising_rules',
					]})
			`;
			if (policies.some((policy) => (
				(policy.roles as string[]).length !== 1
				|| (policy.roles as string[])[0] !== 'aisles_app'
			))) {
				throw new Error(`Unexpected RLS policy roles: ${JSON.stringify(policies)}`);
			}
		}

		for (const brandId of brands) {
			await sql`
				INSERT INTO enriched_products (brand_id, bc_entity_id, bc_product_path, enrichment_model)
				VALUES (${brandId}, ${entityId}, ${`/${runId}`}, 'db-smoke')
			`;
			await sql`
				INSERT INTO generation_logs (
					organization_id, brand_id, type, persona, category_slug, generation_ms, session_id,
					prompt_version, provenance_version, reference_status, policy_version,
					surface, route, viewport_class, renderer_component_id, renderer_variant_id,
					decision_source, input_hash, catalog_version, shopper_context_hash,
					effective_capabilities, decision_mode, publication_mode, schema_version
				) VALUES (
					${`${brandId}-org`}, ${brandId}, 'layout', 'hunter', 'db-smoke', 1, ${sessionId},
					'v5', 'layout-provenance-v1', 'uncontracted_legacy', 'legacy_generated_v1',
					'plp', '/category/db-smoke', 'responsive',
					'legacy.layout-renderer', 'legacy.whole-page-responsive-v1',
					'model', '0123456789abcdef', 'catalog:0123456789abcdef',
					'fedcba9876543210', ${JSON.stringify(['rank_products'])}::jsonb,
					'model', 'live', 'legacy-layout-schema-v1'
				)
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

		if (runtimeDatabaseUrl !== databaseUrl) {
			let deleteDenied = false;
			try {
				await sql`DELETE FROM enriched_products WHERE brand_id = ${brands[0]} AND bc_entity_id = ${entityId}`;
			} catch (error) {
				deleteDenied = (error as { code?: string }).code === '42501';
			}
			if (!deleteDenied) throw new Error('Runtime role unexpectedly has DELETE access');
		}

		console.log(`Supabase database smoke passed for ${brands.join(', ')}`);
	} finally {
		await adminSql`DELETE FROM generation_logs WHERE brand_id = ANY(${brands}) AND session_id = ${sessionId}`;
		await adminSql`DELETE FROM session_outcomes WHERE brand_id = ANY(${brands}) AND session_id = ${sessionId}`;
		await adminSql`DELETE FROM enriched_products WHERE brand_id = ANY(${brands}) AND bc_entity_id = ${entityId}`;
		await sql.end();
		if (adminSql !== sql) await adminSql.end();
	}
}

main().catch((error) => {
	console.error('verify-supabase-db failed:', error);
	process.exitCode = 1;
});
